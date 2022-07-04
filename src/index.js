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
                "counters": `${parsedLinkData.count}`
            }))
        }

        let build = '['+buildup+']'
        
        return new Response(build, {headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}})
    }else{
        return new Response('Failed to authenticate')
    }
})

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }))

// attach the router "handle" to the event handler
addEventListener('fetch', event => event.respondWith(router.handle(event.request)))