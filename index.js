const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json"
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
async function addURL(json) {
  //let jsonBody = json
  let longURL = json.longURL.replace(/(\r\n|\n|\r)/gm, "")
  let customURI = json.customURI

  if ( customURI == null ) {
    shortID = await makeURI(5)
  } else {
    shortID = customURI
  }

  let shortURI = `${SHORTDOMAIN}/${shortID}`

  await LINKS.put(shortID, longURL)
  await LINKCOUNT.put(shortID, 0)

  return JSON.stringify({
    "shorturl" : shortURI 
  })

}

async function listMetrics(){
  let shortIDs = await LINKS.list()
  let shortIDsLength = shortIDs.keys.length
  let buildup = []

  for (let i = 0 ; i < shortIDsLength; i++) {
    let count = await LINKCOUNT.get(shortIDs.keys[i].name, {cacheTtl: 3600})
    let longurl = await LINKS.get(shortIDs.keys[i].name, {cacheTtl: 86400})
    buildup.push({
      "ShortID" : shortIDs.keys[i].name,
      "LongURL" : longurl,
      "Visits" : count
    })
  }
  testing = JSON.stringify(buildup)
  return testing
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

  if (path == null) {
    return Response.redirect(FALLBACK, 301)
  }

  const location = await LINKS.get(path, {cacheTtl: 86400})
  let linkcount = await LINKCOUNT.get(path)

  if (location) {
    // If there isn't already a link counter, make it
    if ( linkcount == null ) {
      await LINKCOUNT.put(path, 0)
      linkcount = await LINKCOUNT.get(path)
    }
    await LINKCOUNT.put(path, parseInt(linkcount) + 1) // count up the times quried
    return Response.redirect(location, 301) // return the long url
  }
  return Response.redirect(FALLBACK, 301) // return the fallback
}

/**
 * Handle preflight checks for
*/
function handleOptions(request) {
  // Make sure the necessary headers are present
  // for this to be a valid pre-flight request
  let headers = request.headers;
  if (
    headers.get("Origin") !== null &&
    headers.get("Access-Control-Request-Method") !== null &&
    headers.get("Access-Control-Request-Headers") !== null
  ){
    // Handle CORS pre-flight request.
    // If you want to check or reject the requested method + headers
    // you can do that here.
    let respHeaders = {
      ...corsHeaders,
    // Allow all future content Request headers to go back to browser
    // such as Authorization (Bearer) or X-Client-Name-Version
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers"),
    }

    return new Response(null, {
      headers: respHeaders,
    })
  }
  else {
    // Handle standard OPTIONS request.
    // If you want to allow other HTTP Methods, you can do that here.
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS",
      },
    })
  }
}

/**
 * Handle the request checking for API Token and then route to correct function
 * @param {*} request 
 * @returns 
 */
async function routerMe(request){
  const apicheck = await tokenCheck(request)
  if ( apicheck == true ) {
    const reqBody = await readRequestBody(request)
    let jsonBody = JSON.parse(reqBody)
    let action = jsonBody.action
    
    if ( action == "add" ){
      newshort = await addURL(jsonBody)
      return new Response(newshort)
    } else if ( action == "metrics" ){
      metrics = await listMetrics()
      return new Response(metrics, { headers: corsHeaders })
    } else {
      return new Response(JSON.stringify({
        "message" : "Invalid Action"
      }),{
        headers: corsHeaders
      })
    }
  } else {
    return new Response(JSON.stringify({
      "message" : "Invalid API Token"
    }),{
      headers: corsHeaders
    })
  }
}

addEventListener("fetch", event => {
  const { request } = event
  const { url } = request

  if (request.method === "POST") {
    return event.respondWith(routerMe(request))
  }
  else if (request.method === "GET") {
    return event.respondWith(shortResponse(request))
  }
  else if (request.method === "OPTIONS"){
    event.respondWith(handleOptions(request))
  }
})