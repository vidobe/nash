# Nash — Project Handoff

A guide for a colleague picking up Nash. It covers what Nash is, how to run it, how the code is laid out, the backend/publishing setup, the MCP and skills it depends on, and the gotchas that will otherwise cost you a day.

> Note: the repo's `AGENTS.md` describes the *original* build (Cloudflare proxy, SharePoint, `/api/qualify`). That's outdated. This doc reflects how Nash actually works now (FluffyJaws + Document Authoring + App Builder). Trust this doc over `AGENTS.md` where they disagree.

---

## 1. What Nash is

Nash is an internal Adobe presales tool that qualifies sales opportunities against authored Adobe solution knowledge. It produces seven evidence-backed dimension reviews, a qualitative Go / Conditional-Go / No-go verdict, requirement coverage, architecture choices, competitive analysis and acceptance gates. New assessments remain numerically unscored until an approved calibrated rubric exists; historical scores remain unchanged. You can discuss a report, re-run with new evidence and publish a separate assessment as a Document Authoring page.

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
- `nash-session` — **the core.** Intake, interview, generation, assessment, chat, re-run and publishing. Main tabs are Assessment and Decision quality; the administrator also has a separate experimental report.
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
- `nash-assessment-guidance.js` — shared, versioned qualification guidance for every solution: modern-first selection, evidenced older-stack exceptions, score reasoning and source categories. The solution knowledge pages show the same guidance used during generation.
- `nash-assessment-prompts.js` — pure assessment prompt builders and the common output contract, used by ordinary assessments, re-runs and the experimental report.
- `nash-assessment-contract.js` — strict current-contract validation, immutable source-question manifests, canonical projection and complete follow-up context.
- `nash-assessment-workflow.js` — real completed core review, bounded requirement batches, bounded structure corrections, input-fingerprinted local checkpoints and final all-or-nothing validation.
- `nash-assessment-review.js` — a final model-backed critical review of all seven conclusions and the complete matrix. Uses field-level dimension corrections so a focused change cannot discard the other reviews or their AI tables. Reassesses draft vendor claims, source traceability, required versus conditional capability, modern architecture choices and cross-section consistency; source IDs/priorities/locations remain fixed.
- `nash-scoring.js` — shared nullable score/percentage helpers. Missing values are not zero, and an unscored assessment cannot fall back to a derived numeric score.
- `nash-perms.js` — permissions (`ADMINS`, `isAdmin`, `canDelete`). Only vgabriel@adobe.com can delete anything; others only their own.
- `nash-activity.js` — usage tracking (logins + assessments) → private DA summary; read by nash-admin.
- `da-publish.js` — client for the publish action (`publishAssessment`, `unpublishAssessment`, `PUBLISH_ENDPOINT`).
- `da-doc.js` — builds the DA document HTML for a report (incl. the base64 `nash-payload` the published page reconstructs from).
- `da-feedback.js` — writes feedback to a private DA `/feedback/` folder.
- `nash-opp.js` — opportunity-management tab data.

## 6. The assessment flow

1. **Intake** (in-chat, `runIntake`/`renderIntake`): customer name, DR (opportunity id), documents, solutions in scope. Not persisted until submitted.
2. **Pre-assessment interview** (`runInterview`): Nash reads the docs, then asks the analyst only about *gaps* (meeting notes, whether we shaped the RFI/RFP, champions/blockers). Answers become authoritative first-party context.
3. **Core review:** `buildQualPrompt` uses current selected solution skills and all available source text. FluffyJaws returns one `NASH_ASSESSMENT_V2` object with `version: 2, contractVersion: 3`, not independent metadata blocks that can disagree.
4. **Requirement review:** supported workbook question tables become a deterministic ID/priority manifest. Batches of at most 32 questions, with at most two concurrent requests, reuse the explicit core evidence. Every source ID must appear exactly once with unchanged priority. Unknown/unclassified priorities stay unknown/unclassified.
5. **Admission:** all seven reviews, evidence links, typed references, criteria, gates and the complete matrix must validate before replacing a report. A positive gateway completion is required; mocks, partial streams, invalid JSON and unresolved references cannot become completed reports. One bounded model correction can replay explicit source context; it cannot silently repair facts or invent verification.
6. **Recovery and aftercare:** validated stages can resume from a local `generationCheckpoint` only when the complete input fingerprint matches. Changed inputs start a fresh review. Checkpoints never publish. Follow-up chat receives the complete canonical record, including the matrix and AI analysis, on every turn rather than relying on an expiring response ID.
7. **Publishing:** standard successful runs synchronize automatically. Set `autoPublish: false` on an approval-preview record to keep it local until confirmation. The publish client revalidates current-contract records and excludes private generation checkpoints.

Sections: 1 Executive Overview · 2 Market/Competitor/Financial · 3 Business Analysis · 4 Technical & Architecture (renders an SVG from `NASH_ARCH`) · 5 Qualification & Discovery Questions · 6 Competitive Positioning & Win Sentiment · 7 Final Recommendation & Scope · 8 AI, Agents & Coworker · 9 Solution Rationale (RFP-ready) · 10 Deal Accelerators & References.

The ten headings remain compact supporting notes inside `reportMarkdown`; the private experiment uses five supporting headings with the same canonical seven-dimension contract. The visible application is not reconstructed from these headings.

The prompt is assembled by `buildQualPrompt()` in `scripts/nash-assessment-prompts.js`. Every selected solution contributes its authored product facts and domain criteria. Illustrative weights are not a calibrated scoring rubric: new overall scores, dimension points and criterion points remain `null`, with `scoring.status: "not-calibrated"`. AI applicability is always reviewed, but adoption, purchasing or a fixed AI weight is never forced.

The visible assessment is a concise overview plus score explanations, not the raw ten-section dossier. Its executive heading is a short solution-and-customer title (for example, "Unified CMS and DAM for Acme Bank"); the fit conclusion and caveats belong in the summary and conditions, not the heading. Only selected components appear as recommended architecture cards. Conditional components, alternatives, exclusions and external systems are labelled separately. Architecture boundaries do not repeat the full rationale. Original report analysis is retained once in its own disclosure, rather than reinserted into several dimensions. Both in-app and published reports use this renderer.

Older reports do not need regeneration for these presentation corrections: the adapter derives the view without changing scores or saved payloads. Better analytical conclusions require a new assessment or re-run. Explicit V2 fields take precedence, including deliberately empty collections.

The current contract includes `solutions[].selection`, justified older-stack exceptions, dimension-specific reasons and criteria, structured analysis tables, use-case prerequisites, one verification-gate register, source coverage and provider provenance. AI explicitly covers native AI, product agents, Coworker/MCP, availability/entitlement and readiness/governance. Customer stories, product documentation and trust/compliance have separate reference groups; internal knowledge is not customer-shareable evidence. One public-source record contains one exact URL. All analysis tables use the functional-coverage table styles.

Legacy criterion points are displayed only when they reconcile with the recorded dimension; invalid historical arithmetic is flagged rather than recomputed. Genuine numeric zero and existing 59/62-style scores retain their meaning.

New assessment elements use the BEM names required by `AGENTS.md`; Stylelint accepts these alongside the existing kebab-case classes.

## 7. DA content model (org `vidobe`, repo `nash`)

- **Solution knowledge:** `/solutions/<slug>` — the current authored catalog has 41 solution files; discover it through `/solutions/query.json`, not a hardcoded fourteen-product list. Documents provide product-specific qualification knowledge and discovery questions; shared application guidance does not rewrite their facts.
- **Published reports:** `/qualifications/<slug>` — separate records per assessment, with opportunity plus assessment ID in the slug so a later report does not overwrite its predecessors. The overview reads `query.json`, including independent verdict and scoring-status metadata.
- **Feedback:** `/feedback/` — private DA source docs (comment + email), never published.

**Interview-questions contract:** each `/solutions/<slug>` can carry an `interview-questions` block (one question per row); Nash reads it from the solution's `.plain.html`. When editing these docs via the DA MCP (full-file replace), build the content deterministically and round-trip-verify — never hand-retype the big `nash-solution-config` block (silent-corruption risk). Any config-regeneration script MUST preserve the `interview-questions` block (it was once silently dropped when a config was regenerated).

**Reaching the app:** editing DA *source* does NOT preview/publish. After a source edit, the doc must be **Previewed + Published** in DA for the app to see it (the app reads preview `.plain.html`).

**Shared assessment guidance:** common reasoning and output rules are maintained once in `scripts/nash-assessment-guidance.js`, added to fetched solution knowledge and displayed on solution configuration pages. Updating these rules does not rewrite the authored solution documents or require republishing their interview blocks. For AEM web delivery, evaluate EDS first; API-only channels need not add a page tier. An older stack requires a specific requirement, modern comparison, sourced blocker and trade-off. Prefer supported, available technology rather than assuming beta availability or product age determines suitability.

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

- Preview + Publish affected `/solutions/<slug>` documents when their `interview-questions` blocks change; discover the current catalog through `/solutions/query.json`.
- Publish the `/admin` page in DA so the usage dashboard is reachable.
- Sales content and Post-sales content tabs: Sales content is built; Post-sales is a placeholder.

## 14. Who to ask

- **Vitor Gabriel** — vgabriel@adobe.com (owner, most context)
- **Paul van Oosterhout** — pvanoosterho@adobe.com (shared skills)
- **Max** — co-creator
