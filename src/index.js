import { Router } from 'itty-router'
import { handleCors } from './coreshelper'

/**
 * Simple function that helps generate a URI for when a custom URI isn't specified
 * @param {*} length 
 * @returns Random alphanumeric string in the length you requested
 */
 async function makeURI(length) {
    let result           = '';
    let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
  charactersLength));
  }
  return result;
}

/**
 * Escapes a single value so it is safe to drop into a CSV cell
 * @param {*} value
 * @returns The value quoted/escaped when it contains a comma, quote or newline
 */
function csvEscape(value) {
    const cell = value === null || value === undefined ? '' : String(value)

    if (/[",\r\n]/.test(cell)) {
        return `"${cell.replace(/"/g, '""')}"`
    }

    return cell
}

/**
 * Formats a date the way YOURLS stores it in its `timestamp` column
 * @param {Date} date
 * @returns Date string in "YYYY-MM-DD HH:MM:SS" form (UTC)
 */
function yourlsTimestamp(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * Reads a stored link, coping with the legacy format where the value was just
 * the long URL as a plain string rather than JSON
 * @param {*} slug
 * @returns { longURL, count } or null when the key has gone away
 */
async function readLink(slug) {
    const raw = await LINKS.get(slug)

    if (raw === null) {
        return null
    }

    let longURL = raw
    let count = 0

    try {
        const parsed = JSON.parse(raw)
        longURL = parsed.longURL
        count = parseInt(parsed.count)
    } catch (err) {
        // Pre-upgrade record: the value is the long URL with no counter
    }

    return {
        longURL: longURL || '',
        count: Number.isNaN(count) ? 0 : count
    }
}

// now let's create a router (note the lack of "new")
const router = Router()

// Migration script for old urls (ONE TIME USE ONLY)
/*
router.post('/upgrade', async () => {
    let shortIDs = await LINKS.list()
    let shortIDsLength = shortIDs.keys.length
  
    for (let i = 0 ; i < shortIDsLength; i++) {
      let count = await LINKCOUNT.get(shortIDs.keys[i].name, {cacheTtl: 60})
      let longurl = await LINKS.get(shortIDs.keys[i].name, {cacheTtl: 60})
      await LINKS.put(shortIDs.keys[i].name,
        JSON.stringify({
            "longURL" : longurl,
            "count" : count
        }))
    }

    return new Response('Updated Links')
})
*/

// GET route to long path based on the shortID
router.get('/:slug', async ({ params }) => {
    const slugData = await LINKS.get(params.slug, {type: "json", cacheTtl: 60})
    if (!slugData) {
        return Response.redirect(FALLBACK, 301)
    } else {
        const location = JSON.stringify(slugData.longURL).replace(/"/g, "")
        const count = JSON.stringify(slugData.count).replace(/"/g, "")
        // Check if the count is missing... and fix it
        if (count === "NaN") {
            await LINKS.put(params.slug, JSON.stringify({'longURL': location, 'count': '1' }))
        } else {
            let newCount = parseInt(count) + 1
            await LINKS.put(params.slug, JSON.stringify({'longURL': location, 'count': `${newCount}` }))
        }
        
        return Response.redirect(location, 301)
    }
    
})

// POST to add URLs to the system
router.post('/add', async request => {
    const { headers } = await request
    const apiToken = headers.get('X-API-KEY') || ""

    const parsed = await request.json()
    console.log(parsed)

    if ( apiToken === TOKEN ) {
        let longURL = parsed.longURL.replace(/(\r\n|\n|\r)/gm, "")
        let customURI = parsed.customURI

        if ( customURI == null ) {
            shortID = await makeURI(8)
        } else {
            shortID = customURI
        }

        let shortURI = `${SHORTDOMAIN}/${shortID}`

        await LINKS.put(shortID, JSON.stringify({'longURL': longURL, 'count': '0' }))

        return new Response(JSON.stringify({"shorturl" : shortURI }))
    }else{
        return new Response('Failed to authenticate')
    }
})

// Add call for getting metrics
router.options('/metrics', handleCors({ methods: 'POST', maxAge: 86400 }));
router.post('/metrics', async request => {
    const { headers } = await request
    const apiToken = headers.get('X-API-KEY') || ""

    if ( apiToken === TOKEN ) {
        let allLinks = await LINKS.list()
        let allLinksLength = allLinks.keys.length
        let buildup = []

        for (let i = 0 ; i < allLinksLength; i++) {
            let linkData = await LINKS.get(allLinks.keys[i].name)
            let parsedLinkData = JSON.parse(linkData)
            buildup.push(JSON.stringify({
                "slug" : `${allLinks.keys[i].name}`,
                "longURL": `${parsedLinkData.longURL}`,
                "count": `${parsedLinkData.count}`
            }))
        }

        let build = '['+buildup+']'
        
        return new Response(build, {headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}})
    }else{
        return new Response('Failed to authenticate')
    }
})

// Dump every link to CSV so the whole set can be moved somewhere else
router.options('/export', handleCors({ methods: 'POST', maxAge: 86400 }));
router.post('/export', async request => {
    const { headers } = await request
    const apiToken = headers.get('X-API-KEY') || ""

    if ( apiToken !== TOKEN ) {
        return new Response('Failed to authenticate')
    }

    let format = 'yourls'

    try {
        const parsed = await request.json()
        if (parsed.format) {
            format = `${parsed.format}`.toLowerCase()
        }
    } catch (err) {
        // No body sent, so fall back to the YOURLS format
    }

    const timestamp = yourlsTimestamp(new Date())
    const rows = [
        format === 'raw'
            ? 'slug,longURL,count'
            : 'keyword,url,title,timestamp,ip,clicks'
    ]

    let cursor = undefined
    let listComplete = false

    // KV only hands back 1000 keys at a time, so page until the listing is done
    while (!listComplete) {
        const listing = await LINKS.list({ cursor })
        const keys = listing.keys.map(key => key.name)

        // Read in parallel batches rather than one key at a time, but cap how
        // many reads are in flight so a big namespace doesn't swamp the Worker
        for (let i = 0; i < keys.length; i += 50) {
            const batch = keys.slice(i, i + 50)
            const links = await Promise.all(batch.map(slug => readLink(slug)))

            for (let j = 0; j < batch.length; j++) {
                const link = links[j]
                if (!link) {
                    continue
                }

                if (format === 'raw') {
                    rows.push([batch[j], link.longURL, link.count].map(csvEscape).join(','))
                } else {
                    rows.push([
                        batch[j],       // keyword
                        link.longURL,   // url
                        '',             // title, not tracked here
                        timestamp,      // timestamp, we only know export time
                        '',             // ip, not tracked here
                        link.count      // clicks
                    ].map(csvEscape).join(','))
                }
            }
        }

        listComplete = listing.list_complete
        cursor = listing.cursor
    }

    return new Response(rows.join('\r\n') + '\r\n', {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="links-export.csv"',
            'Access-Control-Allow-Origin': '*'
        }
    })
})

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }))

// attach the router "handle" to the event handler
addEventListener('fetch', event => event.respondWith(router.handle(event.request)))