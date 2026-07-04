# Nash → DA publish — Adobe App Builder action

Same purpose as the Cloudflare Worker (`../da-publish/`), but as an Adobe I/O
Runtime web action — better fit for an Adobe internal tool (native IMS, runs on
Adobe infrastructure). Use this OR the Worker, not both.

## What it does

Receives a completed assessment from the Nash browser, validates the caller's
Okta token, then writes the page to DA and previews + publishes it:

```
Nash browser ──(Okta bearer + { slug, html })──▶ publish action
   validate Okta token via /userinfo (→ user email)
   mint/use DA service token
   PUT  https://admin.da.live/source/{ORG}/{REPO}/qualifications/{slug}.html
   POST https://admin.hlx.page/preview|live/{ORG}/{REPO}/main/qualifications/{slug}
   ◀── { url, previewUrl, path }
```

## Deploy

1. Install the CLI and sign in:
   ```sh
   npm i -g @adobe/aio-cli
   aio login
   ```
2. From this folder, point at your App Builder org / project / workspace:
   ```sh
   aio app use
   ```
   (or `aio console org select` / `project select` / `workspace select`)
3. Configure credentials — copy `.env.example` to `.env` and fill in ONE of:
   - **Recommended:** `IMS_CLIENT_ID` + `IMS_CLIENT_SECRET` from your project's
     **OAuth Server-to-Server** credential (Developer Console). The credential's
     technical account needs DA write + AEM admin access for `vidobe/nash`.
   - **Quick test:** `DA_TOKEN` = a short-lived token from da.live
     (`window.adobeIMS.getAccessToken().token` in the console). Expires ~24h.
4. Deploy:
   ```sh
   aio app deploy
   ```
5. Copy the action URL from the output — it looks like:
   ```
   https://<namespace>.adobeioruntime.net/api/v1/web/nash-da-publish/publish
   ```
   Set it as `PUBLISH_ENDPOINT` in
   [`scripts/da-publish.js`](../../scripts/da-publish.js), then commit + push.

## Notes

- `require-adobe-auth: false` — we validate the caller's Okta token in-action, so
  the runtime gateway must not demand an Adobe IMS token on the request.
- CORS is restricted to `*--nash--vidobe.aem.page` / `.aem.live`.
- Node 18 runtime provides global `fetch`, `FormData`, and `Blob` — no deps.
- This folder is excluded from the project ESLint run (runtime code, not browser).
