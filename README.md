# Simple URL Shortner 

I wanted to save some money, and learn some more JavaScript as well as learn how to use KV's... I figured why not move away from hosting YOURLS and move my shortening system over to Cloudflare Workers. This allows me to save money on VPS hosting running a PHP web app... I figured I would share this app for others who just want a simple URL Shortener with a counter.

**Cons:**
 - There is no location of where people clicked
 - There is no referer information

**Pros:**
 - Simple and easy to use
 - Works with apps like [Short Menu](https://hack13.link/DS9QH)
 - Get metrics from the api

## How To Use

### Add Url
POST Request **NOTE:** You must send your API Token via header "X-API-KEY"
```json
{
    "action" : "add",
    "longURL" : "https://some-long.site/with/some/crazy/long-crazy-address",
    "customURI" : "crazysite" //optional
}
```
Example Response
```json
{
    "shortul" : "https://linksite.com/crazysite"
}
```
### Visit Site
GET Request
```
https://linksite.com/crazysite"
```
Example Response
```
301 Redirect -> https://some-long.site/with/some/crazy/long-crazy-address
```

### Metrics
POST Request **NOTE:** You must send your API Token via header "X-API-KEY"
```json
{
    "action" : "metrics"
}
```
Example Response:
```json
{
    "ShortID": "S8t71",
    "LongURL": "https://hack13.me/2021/10/cloudflare-workers-and-pages/",
    "Visits": null // From previous release and never called this will return null, but there is a check that will make it start counting upon first hit
}{
    "ShortID": "test",
    "LongURL": "https://hack13.me/",
    "Visits": "2"
}{
    "ShortID": "zkQPr",
    "LongURL": "https://example.com/lkdjf3432sef",
    "Visits": "0"
}
```

## Configuration

**Wrangler Config**
 - VARS
   - FALLBACK: Full URL to a page people should end up if the short URL doesn't exist ex: _https://google.com_
   - SHORTDOMAIN: The domain you want to use for your short urls ex: _https://example.com_
 - SECRETS
   - TOKEN: This is the super secret API Key you should generate to allow only those authorized to add links using header "X-API-KEY"

## Contributing/Feature Requests

Feel free to submit issues you find and/or make feature requests, just know this is a 1 person project and that I may not impliment everything.