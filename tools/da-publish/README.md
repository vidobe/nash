# Nash → DA publish Worker

A small Cloudflare Worker that lets the Nash app publish a completed assessment to
DA as a page under `/qualifications/{slug}`, then previews + publishes it so it
shows up in `/qualifications/query.json` (Overview + sidebar) for everyone.

## Why a Worker?

The browser only holds an Okta/FluffyJaws token, which DA won't accept. The Worker
holds an Adobe **service token** (never exposed to the browser) and writes to DA on
the user's behalf. It first validates the user's forwarded Okta token via
`/userinfo`, so only signed-in Adobe users can publish.

## Flow

```
Nash browser ──(Okta bearer + assessment JSON)──▶ Worker
   Worker validates the Okta token (→ user email)
   Worker mints/uses its DA service token
   PUT  https://admin.da.live/source/{org}/{repo}/qualifications/{slug}.html
   POST https://admin.hlx.page/preview/{org}/{repo}/main/qualifications/{slug}
   POST https://admin.hlx.page/live/{org}/{repo}/main/qualifications/{slug}
   ◀── { url, previewUrl, path }
```

## Deploy

1. Install Wrangler and log in:
   ```sh
   npm i -g wrangler
   wrangler login
   ```
2. From this folder, set the service credentials (pick ONE approach):
   - **Recommended — IMS Server-to-Server (auto-refreshing):**
     ```sh
     wrangler secret put IMS_CLIENT_ID
     wrangler secret put IMS_CLIENT_SECRET
     ```
     The credential's technical account needs access to DA and AEM admin for the
     `vidobe/nash` site. Adjust `IMS_SCOPES` in `wrangler.toml` if your integration
     requires different scopes.
   - **Fallback — static token:**
     ```sh
     wrangler secret put DA_TOKEN   # a long-lived IMS bearer with DA + AEM admin access
     ```
3. Deploy:
   ```sh
   wrangler deploy
   ```
4. Copy the deployed URL (e.g. `https://nash-da-publish.<subdomain>.workers.dev`)
   and set it as `WORKER_URL` in [`scripts/da-publish.js`](../../scripts/da-publish.js),
   then commit + push so the Nash app points at it.

## Notes

- CORS is restricted to `*--nash--vidobe.aem.page` / `.aem.live` origins.
- `org`/`repo` are the same for DA and AEM admin here (`vidobe`/`nash`).
- This Worker source is excluded from the project ESLint run (Cloudflare runtime,
  not browser) via `.eslintignore`.
