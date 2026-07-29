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
```json3
{
    "action" : "add",
    "longURL" : "https://some-long.site/with/some/crazy/long-crazy-address",
    "customURI" : "crazysite" //optional
}
```
Example Response
```json3
{
    "shortul" : "https://linksite.com/crazysite"
}
```
### Visit Site
GET Request
```
https://linksite.com/crazysite
```
Example Response
```
301 Redirect -> https://some-long.site/with/some/crazy/long-crazy-address
```

### Metrics
POST Request **NOTE:** You must send your API Token via header "X-API-KEY"
```json3
{
    "action" : "metrics"
}
```
Example Response:
```json3
{
    "ShortID": "S8t71",
    "LongURL": "https://hack13.me/2021/10/cloudflare-workers-and-pages/",
    "Visits": null //From previous release and never called this will return null, but there is a check that will make it start counting upon first hit
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

### Export
POST Request **NOTE:** You must send your API Token via header "X-API-KEY"

Dumps every link in the KV namespace as CSV, ready to import elsewhere. The body is optional
&mdash; with no body you get the YOURLS layout.
```json3
{
    "format" : "yourls" //optional, "yourls" (default) or "raw"
}
```
Example Response (`format: "yourls"`), matching the columns of the YOURLS `yourls_url` table:
```csv
keyword,url,title,timestamp,ip,clicks
test,https://hack13.me/,,2024-05-01 12:00:00,,2
zkQPr,https://example.com/lkdjf3432sef,,2024-05-01 12:00:00,,0
```
Example Response (`format: "raw"`):
```csv
slug,longURL,count
test,https://hack13.me/,2
zkQPr,https://example.com/lkdjf3432sef,0
```
`title` and `ip` are always empty and `timestamp` is the time of the export, since none of the
three are tracked here. Records saved before the counter existed export with a count of `0`.

Save it straight to a file with:
```bash
curl -X POST https://linksite.com/export -H "X-API-KEY: $TOKEN" -o links-export.csv
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
