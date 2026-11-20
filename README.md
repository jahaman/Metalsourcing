# Metal Sourcing — metalsourcing.ca

A catalog of aluminum profiles from Canadian extruders. One profile can be listed under many extruders' die numbers. Customers pick an alloy, finish, length and quantity and send a request. If their profile isn't in the catalog, they can draw it to size in the custom builder. No prices, shipping or payment.

Runs as a Cloudflare Worker with a D1 database. Nothing to build: Cloudflare deploys every push to `main` (Workers Builds, `npx wrangler deploy`).

## What's where

| Path | |
|---|---|
| `src/index.js` | Router, language (EN/FR), error handling |
| `src/site.js` | Public pages: home, catalog, search, profile, custom builder, request list |
| `src/api.js` | `/api/match`, `/api/profiles` (customer-drawn profiles, saved as *pending*), `/api/requests` |
| `src/admin.js` | `/admin`: requests, profiles and dies, extruders, options |
| `src/db.js` | Tables (created on first request) and sample data (loaded into an empty database) |
| `src/catalog.js` | Queries and search (understands "2 x 2 x 1/8 angle", "square tube 1", mm) |
| `src/mail.js` | New-request e-mail via Cloudflare Email Routing (optional) |
| `src/i18n.js` | English and French text |
| `public/shapes.js` | Shape geometry, weight per foot and SVG drawings (used by the browser and the Worker) |
| `public/app.js`, `public/app.css` | Front-end |

## First-time setup (Cloudflare dashboard)

1. **Admin password:** go to Workers & Pages → *metalsourcing* → Settings → Variables and Secrets. Add a **Secret** named `ADMIN_PASSWORD`, then sign in at `/admin`.
2. **Domain:** go to Settings → Domains & Routes → Add → Custom domain → `metalsourcing.ca` (and `www.metalsourcing.ca`).
3. **Request e-mails (optional):**
   - Turn on Email Routing for metalsourcing.ca and verify the address that should receive requests.
   - Uncomment `send_email` and `vars` in `wrangler.jsonc` with that address.

The D1 database `metalsourcing` is created on the first deploy. The tables and sample data are created on the first page view.

## Data

- The sample die numbers start with `S-` and are placeholders.
- Real catalogs (Extrudex, Can Art, Signature Aluminum, and the unique alustock shapes) will be loaded with an import script, from spreadsheets with one row per die: shape, dimensions, extruder, die number.

## Local development

```
npm install
echo "ADMIN_PASSWORD=choose-one" > .dev.vars
npx wrangler dev
```
