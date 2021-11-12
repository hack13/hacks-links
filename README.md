# Simple URL Shortner 

I wanted to save some money, and learn some more JavaScript as well as learn how to use KV's... I figured why not move away from hosting YOURLS and move my shortning system over ot Cloudflare Workers. This allows me to save money on VPS hosting running a PHP web app... I figured I would share this app for others who just want a simple URL Shortner with a counter.

**Cons:**
 - There is no location of where people clicked
 - There is no referer information
 - There is no nice to read titles just the slug and url with counts

**Pros:**
 - Simple and easy to use
 - Works with apps like [Short Menu](https://hack13.link/DS9QH)

## Configuration

**Wrangler Config**
 - VARS
   - FALLBACK: Full URL to a page people should end up if the short URL doesn't exist
 - SECRETS
   - TOKEN: This is the super secret API Key you should generate to allow only those authorized to add links using header "X-API-KEY"

## Contributing/Feature Requests

Feel free to submit issues you find and/or make feature requests, just know this is a 1 person project and that I may not impliment everything.