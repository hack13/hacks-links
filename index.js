const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
}

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
 * readRequestBody reads in the incoming request body
 * Use await readRequestBody(..) in an async function to get the string
 * @param {Request} request the incoming request to read from
 */
 async function readRequestBody(request) {
  const { headers } = request
  const contentType = headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    return JSON.stringify(await request.json())
  }
  else if (contentType.includes("application/text")) {
    return request.text()
  }
  else if (contentType.includes("text/html")) {
    return request.text()
  }
  else if (contentType.includes("form")) {
    const formData = await request.formData()
    const body = {}
    for (const entry of formData.entries()) {
      body[entry[0]] = entry[1]
    }
    return JSON.stringify(body)
  }
  else {
    // Perhaps some other type of data was submitted in the form
    // like an image, or some other binary data. 
    return 'a file';
  }
}

/**
 * Simple function to handle API Key Check
 * @param {*} request the incoming request to read from
 * @returns Boolean if the API Token is correct or not
 */
async function tokenCheck(request) {
  const { headers } = request
  const apiToken = headers.get("X-API-KEY") || ""

  if ( apiToken == TOKEN ) {
    return true
  } else {
    return false
  }
}

/**
 * Shortens a URL and stores link in the KV Store
 * @param {*} request 
 * @returns Returns a Short URL Address 
 */
async function addURL(request) {
  const apicheck = await tokenCheck(request)

  if ( apicheck == true ) {
    const reqBody = await readRequestBody(request)
    const jsonBody = JSON.parse(reqBody)
    let longURL = jsonBody.longURL.replace(/(\r\n|\n|\r)/gm, "")
    let customURI = jsonBody.customURI
  
    if ( customURI == null ) {
      shortID = await makeURI(5)
    } else {
      shortID = customURI
    }
  
    let shortURI = `https://hack13.link/${shortID}`
  
    await LINKS.put(shortID, longURL)
  
    return new Response(JSON.stringify({
      "shorturl" : shortURI 
    }),{
      headers: corsHeaders
    })

  } else {
    return new Response(JSON.stringify({
      "message" : "Invalid API Token"
    }),{
      headers: corsHeaders
    })
  }

}

/**
 * Function reads to see if the shortURI exists in KV if not returns
 *  Fallback Address all as redirects
 * @param {*} request 
 * @returns Returns a redirect to the long URL or fallback address
 */
async function shortResponse(request) {
  const requestURL = new URL(request.url)
  const path = requestURL.pathname.split("/")[1]
  const location = await LINKS.get(path)
  let linkcount = await LINKCOUNT.get(path)

  // If there isn't already a link counter, make it
  if ( linkcount == null ) {
    await LINKCOUNT.put(path, 0)
    linkcount = await LINKCOUNT.get(path)
  }
  if (location) {
    await LINKCOUNT.put(path, parseInt(linkcount) + 1) // count up the times quried
    return Response.redirect(location, 301) // return the long url
  }
  return Response.redirect(FALLBACK, 301) // return the fallback
}

addEventListener("fetch", event => {
  const { request } = event
  const { url } = request

  if (request.method === "POST") {
    return event.respondWith(addURL(request))
  }
  else if (request.method === "GET") {
    return event.respondWith(shortResponse(request))
  }
})