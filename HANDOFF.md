# Nash — Project Handoff

A guide for a colleague picking up Nash. It covers what Nash is, how to run it, how the code is laid out, the backend/publishing setup, the MCP and skills it depends on, and the gotchas that will otherwise cost you a day.

> Note: the repo's `AGENTS.md` describes the *original* build (Cloudflare proxy, SharePoint, `/api/qualify`). That's outdated. This doc reflects how Nash actually works now (FluffyJaws + Document Authoring + App Builder). Trust this doc over `AGENTS.md` where they disagree.

---

## 1. What Nash is

Nash is an internal Adobe presales tool that qualifies sales opportunities. You upload a customer's RFI/RFP (plus optional context), and Nash scores the opportunity against Adobe solution knowledge and produces a structured qualification dossier: a 0-100 fit score, a Go / Conditional-Go / No-go verdict, scored dimensions, competitive analysis, a target-architecture diagram, an RFP-ready solution rationale, and deal accelerators. You can chat to refine it, re-run to fold in new context, publish each report as a shareable Document Authoring page, and generate sales content.

Built by Vitor Gabriel (vgabriel@adobe.com), Max, and Paul (pvanoosterho@adobe.com).

## 2. Environments & URLs

- **App (use this):** https://main--nash--vidobe.aem.page/ — the **preview** host. Sign in with Adobe Okta.
- **Live:** https://main--nash--vidobe.aem.live/ — only holds explicitly-published content (e.g. `/qualifications/*`), NOT the full app.
- **Repo:** https://github.com/vidobe/nash — local at `~/Sites/Nash/nash`
- **DA content editor:** https://da.live/#/vidobe/nash

**Important:** the app pages (`/indextest`, overview, etc.) live in *preview* and are not all published to live. So users run Nash on `.aem.page`. **Do not add a preview→live redirect** — it 404s the unpublished app pages (tried and reverted).

## 3. Run it locally

```bash
git clone https://github.com/vidobe/nash && cd nash
npm install
npx @adobe/aem-cli up      # serves http://localhost:3000, hot-reload
```

Open http://localhost:3000 and sign in with Adobe Okta. The local server uses your local code + previewed DA content.

**Prerequisites:** Adobe Okta access and FluffyJaws (Azure OpenAI) access — both Adobe-internal. Without them the UI loads but assessments won't run. Lint before committing: `npm run lint`.

## 4. Architecture

Vanilla JS Edge Delivery app — no build step, no framework, no npm imports in block code. The pieces:

- **Frontend:** AEM Edge Delivery Services (EDS). Almost all logic lives in `blocks/nash-session/nash-session.js` (+ `.css`) — it's large; that's expected.
- **AI backend — "FluffyJaws":** Azure OpenAI, reached via `scripts/fluffyjaws.js` (`streamQualification`, SSE streaming). This is what generates the dossier.
- **Auth:** Okta OIDC in `scripts/nash-auth.js` (`ensureFreshToken`, `getUserInfo`, `isAuthenticated`, `login`). Token in `localStorage` (`nash-fj-auth`). The whole app is gated — it can't be driven headless without real credentials.
- **Content:** Document Authoring (da.live), org `vidobe`, repo `nash`. Solution knowledge, published reports, and feedback all live in DA.
- **Publishing:** an Adobe App Builder (I/O Runtime) web action writes reports to DA and previews/publishes them. See §8.

## 5. Codebase map

**Blocks** (`blocks/`):
- `nash-session` — **the core.** The whole assessment experience: intake, interview, run, dossier, chat, re-run, publish, and the tabs (Assessment / DA content / Opp management / Sales content / Post-sales). Start here.
- `nash-sidebar` — left nav, assessment list, sort, feedback, admin link, usage tracking.
- `nash-overview` — the qualifications dashboard (cards, KPIs, search/sort, bookmark/delete).
- `nash-qualification` — renders a *published* `/qualifications/{slug}` page from an embedded payload; reuses `nash-session`'s renderer.
- `nash-admin` — admin-only (`/admin`) usage dashboard (logins + assessments). Gated to vgabriel@adobe.com.
- Others: `nash-login`, `nash-topbar`, `nash-hero`, `nash-about`, `nash-solutions`, `nash-solution-config`, `nash-feedback`, `nash-detail-view`.

**Scripts** (`scripts/`):
- `fluffyjaws.js` — Azure OpenAI client (`streamQualification`).
- `nash-auth.js` — Okta auth.
- `nash-assessments.js` — localStorage assessments (save/get/delete, bookmarks, hidden).
- `nash-assessment-view.js` — read-only compatibility adapter for assessment presentation. Converts existing Markdown solution/use-case tables and recorded evidence into the same seller-facing view as V2 payloads; recognizes numbered headings and numbered bold subsection titles.
- `nash-perms.js` — permissions (`ADMINS`, `isAdmin`, `canDelete`). Only vgabriel@adobe.com can delete anything; others only their own.
- `nash-activity.js` — usage tracking (logins + assessments) → private DA summary; read by nash-admin.
- `da-publish.js` — client for the publish action (`publishAssessment`, `unpublishAssessment`, `PUBLISH_ENDPOINT`).
- `da-doc.js` — builds the DA document HTML for a report (incl. the base64 `nash-payload` the published page reconstructs from).
- `da-feedback.js` — writes feedback to a private DA `/feedback/` folder.
- `nash-opp.js` — opportunity-management tab data.

## 6. The assessment flow

1. **Intake** (in-chat, `runIntake`/`renderIntake`): customer name, DR (opportunity id), documents, solutions in scope. Not persisted until submitted.
2. **Pre-assessment interview** (`runInterview`): Nash reads the docs, then asks the analyst only about *gaps* (meeting notes, whether we shaped the RFI/RFP, champions/blockers). Answers become authoritative first-party context.
3. **Run** (`runAssessment`): builds the prompt (`buildQualPrompt`), grounds in the in-scope solution skills, streams the dossier from FluffyJaws.
4. **Dossier:** fixed **10-section** markdown + machine-readable blocks (`NASH_META`, `NASH_DIMS`, `NASH_CONTEXT`, `NASH_ARCH`). Scored on 6 solution dimensions **plus** "AI & Agentic Fit" (~10-15%).
5. **After:** chat follow-up, re-run (folds in chat notes), and publish to DA. Runs persist (`status: running`) and resume on re-open; `beforeunload` warns mid-run.

Sections: 1 Executive Overview · 2 Market/Competitor/Financial · 3 Business Analysis · 4 Technical & Architecture (renders an SVG from `NASH_ARCH`) · 5 Qualification & Discovery Questions · 6 Competitive Positioning & Win Sentiment · 7 Final Recommendation & Scope · 8 AI, Agents & Coworker · 9 Solution Rationale (RFP-ready) · 10 Deal Accelerators & References.

The prompt is assembled in `buildQualPrompt()` in `nash-session.js` — read that function to understand exactly what the model is told and the output contract it must follow.

The visible assessment is a concise overview plus dimension briefs, not the raw ten-section dossier. Solution rationale uses a platform recommendation, channel-delivery callout, and product/deployment cards; the complete original rationale remains in an expandable disclosure. Both in-app and published reports use this renderer. Older reports do not need regeneration to get this presentation: the compatibility adapter derives it from their existing content without changing their scores or saved payloads. Explicit V2 fields take precedence, including deliberately empty collections. New V2 generations also include an `architecture` summary alongside the existing `architectureBoundary` and solution records.

New assessment elements use the BEM names required by `AGENTS.md`; Stylelint accepts these alongside the existing kebab-case classes.

## 7. DA content model (org `vidobe`, repo `nash`)

- **Solution knowledge:** `/solutions/<slug>` — 14 solutions: `aem, aem-assets, sites-optimizer, workfront, llmo, commerce, analytics, cja, target, journey-optimizer, rtcdp, experience-platform, campaign, marketo`. Each doc holds a `nash-solution-config` block (the scoring knowledge Nash grounds on) and an `interview-questions` block (5-7 discovery questions Nash reads for the interview step).
- **Published reports:** `/qualifications/<slug>` — one per opportunity, keyed on DR. `query.json` is the index the overview reads.
- **Feedback:** `/feedback/` — private DA source docs (comment + email), never published.

**Interview-questions contract:** each `/solutions/<slug>` can carry an `interview-questions` block (one question per row); Nash reads it from the solution's `.plain.html`. When editing these docs via the DA MCP (full-file replace), build the content deterministically and round-trip-verify — never hand-retype the big `nash-solution-config` block (silent-corruption risk). Any config-regeneration script MUST preserve the `interview-questions` block (it was once silently dropped when a config was regenerated).

**Reaching the app:** editing DA *source* does NOT preview/publish. After a source edit, the doc must be **Previewed + Published** in DA for the app to see it (the app reads preview `.plain.html`).

## 8. Publishing (App Builder action)

Reports are written to DA and previewed/published by an Adobe App Builder web action.

- **Endpoint:** `https://97154-nashdapublish-stage.adobeioruntime.net/api/v1/web/nash-da-publish/publish`
- **Code:** `tools/da-publish-app/actions/publish/index.js`
- **Console:** org `adobe-demo-emea-114`, project `nashdapublish`, workspace **Stage**.
- **Deploy:** from `tools/da-publish-app`, run `aio app deploy` (needs a valid `aio login`).

**How it authenticates:** it validates the *caller's* Okta token, then does server operations on an IMS service token (writing DA via `admin.da.live`) and previews/publishes via `admin.hlx.page` using `AEM_API_KEY`.

**`.env`** (in `tools/da-publish-app/.env`, NOT in git) needs: `OKTA_ISSUER`, `ORG=vidobe`, `REPO=nash`, IMS S2S creds (`IMS_CLIENT_ID`, `IMS_CLIENT_SECRET`), `IMS_SCOPES` (comma-separated CSV — not a JSON array), and `AEM_API_KEY` (a registered nash site API key).

**Gotchas (these will bite you):**
- `aio app use` **regenerates `.env`** with different var names (`IMS_OAUTH_S2S_*`) and drops the custom ones — you must re-add `OKTA_ISSUER`/`ORG`/`REPO`/`AEM_API_KEY` and the CSV `IMS_SCOPES` after running it.
- The `AEM_API_KEY` must be a **currently-registered** nash site key. If it's rotated/revoked, preview/publish returns 401 (DA write still works via the service token, so "Published to DA" goes green while preview 401s). Mint a fresh key via the AEM admin config API and redeploy.
- **Two copies of this project exist:** the canonical one is `~/Sites/Nash/nash/tools/da-publish-app` (in git, current code). A stale standalone copy at `~/Sites/nash-da-publish` (older code) deploys to the **same** action — deploying from it silently reverts features. **Only deploy from the `tools/da-publish-app` copy.**

## 9. MCP servers

- **Document Authoring (DA) MCP** — read/write DA source (`da_get_source`, `da_update_source`, `da_list_sources`, etc.), org `vidobe`, repo `nash`. Full-file replace only, so always round-trip-verify edits. Note: the DA MCP writes *source* only; it does not preview/publish, and `admin.hlx.page` requires auth for nash (so preview/publish is done from the DA editor UI or via the deployed action).

## 10. Skills

- **AEM EDS skills** (`.agents/` in the repo): use `content-driven-development` for any block work, `docs-search` for AEM patterns, `testing-blocks` after building.
- **Paul's 5 shared agent skills** (`briefing-analyst`, `use-case-creator`, `use-case-demo-maker`, `togaf-advisor`, `adobe-architecture-to-html`): these are *agent* skills for a file/MCP runtime, not browser code. "Incorporating" one means translating its prompt logic into Nash's JS. Status: `briefing-analyst` → the pre-assessment interview (done); architecture-diagram slice → the `NASH_ARCH` diagram in §4 (done); the rest deferred/skipped.
- **`working-with-vitor`** — Vitor's personal working-style + voice skill (how he likes output, and an anti-AI-slop writing bar). Useful context if you're generating anything in his voice.

## 11. Deploy workflow (frontend)

Push to `main` → **AEM Code Sync** auto-deploys to both preview (`.aem.page`) and live (`.aem.live`). No PR/CI gate is required to deploy, but `npm run lint` runs in CI — keep it green. The app runs on the preview host (see §2).

## 12. Known constraints & gotchas

- **Auth gates everything.** Okta + FluffyJaws access are required; you can't run assessments headless.
- **Secrets:** never commit `.env`, `AEM_API_KEY`, IMS secrets, or DA tokens (they're gitignored in `tools/da-publish-app`). If one leaks, rotate it.
- **Live pages cache for 2h** (`max-age=7200`). The app cache-busts links to freshly-published pages; if you hit a stale published page directly, hard-refresh.
- **`admin.hlx.page` 401s for nash without a valid key/token** — preview/publish is done from the DA UI or the deployed action, not raw curl.
- **`nash-session.js` is big.** Search within it (`buildQualPrompt`, `runAssessment`, `renderAssessment`, `renderBelowBar`, `salesPanelHtml`) rather than reading top-to-bottom.

## 13. Open items

- Preview + Publish the 14 `/solutions/<slug>` docs when their `interview-questions` blocks change (done as of 2026-08-27; re-do if edited).
- Publish the `/admin` page in DA so the usage dashboard is reachable.
- Sales content and Post-sales content tabs: Sales content is built; Post-sales is a placeholder.

## 14. Who to ask

- **Vitor Gabriel** — vgabriel@adobe.com (owner, most context)
- **Paul van Oosterhout** — pvanoosterho@adobe.com (shared skills)
- **Max** — co-creator
