# Nash — AEM Qualification Hub

## What this project is
Nash is an internal Adobe sales tool that helps sales teams qualify 
opportunities for Adobe Experience Manager (AEM). It ingests RFI/RFP 
documents, scores them against a skills knowledge base, and produces 
structured qualification reports with fit scores, competitive analysis, 
red flags, and solution recommendations.

The UI is a dashboard application with:
- A reports overview showing all qualification cards (generating + complete)
- A real-time generation detail view showing pipeline progress
- A Claude-style chat interface for new qualifications
- A left sidebar navigation with two main sections: Overview and New Insight

This was previously built as a single HTML file. The goal now is to rebuild 
it properly as an AEM Edge Delivery Services project using blocks.

## Reference UI
The original single-file implementation is in the repo. Study it carefully 
before building any block — it defines the exact visual design, interactions, 
data structures, and component behaviour to replicate.

## AEM EDS rules — READ THESE BEFORE WRITING ANY CODE
- Vanilla HTML, CSS, and JavaScript ONLY — absolutely no React, Vue, Angular, 
  or any other framework
- No bundlers, no transpilation, no build steps — code runs directly in browser
- No npm packages imported in block JS — use only native browser APIs
- Blocks export a single default async function(block) — that's the entry point
- CSS uses BEM-style naming: .blockname__element--modifier
- Always fetch AEM docs from www.aem.live — NEVER confuse EDS with:
  * AEM Sites as a Cloud Service (Java/JCR/OSGi/Sling stack)
  * Cloudflare, Fastly, or Akamai edge compute
  * Medical "EDS" (Ehlers-Danlos Syndrome)
- When in doubt about any AEM pattern, use the docs-search skill on www.aem.live

## Project structure
nash/
├── blocks/
│   ├── nash-topbar/
│   │   ├── nash-topbar.js
│   │   └── nash-topbar.css
│   ├── nash-sidebar/
│   │   ├── nash-sidebar.js
│   │   └── nash-sidebar.css
│   ├── nash-report-card/
│   │   ├── nash-report-card.js
│   │   └── nash-report-card.css
│   ├── nash-chat/
│   │   ├── nash-chat.js
│   │   └── nash-chat.css
│   ├── nash-detail-view/
│   │   ├── nash-detail-view.js
│   │   └── nash-detail-view.css
│   └── nash-hero/
│       ├── nash-hero.js
│       └── nash-hero.css
├── scripts/
│   └── scripts.js
├── styles/
│   └── styles.css
├── .agents/          ← Adobe AEM skills (already installed)
├── CLAUDE.md         ← this file
└── AGENTS.md         ← same content, for non-Claude agents

## Blocks to build — in this order

### 1. nash-topbar
Top navigation bar. Contains:
- Adobe logo mark (red square with triangle) + "Nash" wordmark + "/ AEM Qualifier" subtitle
- Current page title (changes based on active view)
- "New Analysis" primary button (red)
- User avatar circle (initials "VG")
Fixed to top, 52px height, white background, 1px bottom border.

### 2. nash-sidebar
Left navigation column, 240px wide, sticky. Contains two nav sections:
- MAIN section: Overview (with report count badge), New Insight, Campaigns
- TOOLS section: CMS Detector, Skills Files, Feedback Hub
- REFERENCE section: About Nash, Insights Guide
- User card at bottom (avatar, name, email)
Active item: red background tint, red text.
Clicking Overview shows the reports dashboard.
Clicking New Insight shows the chat interface.

### 3. nash-report-card
The core repeating card shown in the reports grid. Two states:

GENERATING state:
- Red shimmer bar across top of card
- Company name + initial favicon + domain
- "Generating" badge (red, with spinning icon)
- Timestamp ("just now", "2m ago" etc)
- "Your report is being generated." message
- Live dot (green, pulsing) + "Live updates" label
- Progress bar (red fill, animated)
- Task label + step count (e.g. "Building report content (8/23 tasks)") + percentage
- Footer: user email + CMS detected

COMPLETE state:
- Company name + initial favicon + domain
- "Complete" badge (green)
- Fit score (large number, colour coded: green ≥70, amber 50-69, red <50)
- Verdict pill: "Go" / "Conditional" / "No-go"
- Footer: user email + CMS detected
Clicking a card opens the detail view for that report.

### 4. nash-hero
Dashboard hero section at top of overview. Contains:
- Greeting: "Good afternoon, [name]"
- Headline: "Your secret weapon for customer meetings"
- Subtext description
- Two action buttons: "+ New Analysis" (primary red) and "Skills File Reference" (secondary)
- Four stat cards: Total qualifications, Generating now (red accent), Avg generation time, AI model

### 5. nash-detail-view
Full-page view opened when clicking a report card. Contains:
- Back button ("← Requests & Reports")
- Company name + status badge
- Four tabs: Request Details, Insights, Generation (default active), Report Issue
- Generation tab shows:
  * "How reports are generated" explainer with 3 steps (Data Collection, AI Analysis, Report Pages)
  * Pipeline progress card with: name, running badge, step counter (17/23), progress bar, percentage
  * Expandable task list: each task has icon (done=green check, running=blue spinner, waiting=gray), 
    name, description, status label, time taken
  * Running tasks auto-expand to show sub-tasks

### 6. nash-chat
Claude-style chat interface for new qualifications. Contains:
- Header: "New Qualification" title + description
- Chat message area: supports Nash (assistant) and user messages with avatars
- Welcome message from Nash with 4 quick-action option buttons
- Typing indicator (three bouncing dots) while waiting for response
- Input area at bottom (Claude.ai style):
  * File attachment chips shown above textarea when files selected
  * Auto-resizing textarea with placeholder text
  * Bottom toolbar: paperclip icon (file upload), microphone icon
  * Hint text: "Press ⏎ to send, Shift+⏎ for new line"
  * Send button (red arrow, disabled when empty)
- Calls /api/qualify endpoint (NOT api.anthropic.com directly)
- Nash has AEM qualification context loaded as system prompt

## API proxy rule — CRITICAL
The nash-chat block must NEVER call api.anthropic.com directly.
All Claude API calls go through: POST /api/qualify
This keeps the API key server-side. The proxy will be a Cloudflare Worker.
In development, you can use a local proxy or mock responses.

## Scoring dimensions (for reference when building chat/detail blocks)
1. Strategic Fit — 20%
2. Technical Fit — 20%  
3. Functional Coverage — 20%
4. Commercial Viability — 15%
5. Competitive Position — 15%
6. Delivery Risk — 10%
Verdict: ≥70 = Go, 50-69 = Conditional, <50 = No-go

## Content model — SharePoint authoring
Skills file content (AEM qualification criteria, signals, competitive intel)
lives in SharePoint as Word documents, published via AEM Sidekick.
Nash JS fetches /skills/query.json at runtime to load skills file content.
Reports index is fetched from /reports/query.json.
Neither is hardcoded in block JS.

## Design tokens
--red: #eb1000
--red-lt: #fff0ef
--ink: #111318
--ink-70: #4a4d55
--ink-40: #9a9da6
--ink-15: #e8e9ec
--ink-08: #f4f4f6
--white: #ffffff
--surface: #f8f8fa
--green: #0d7a45
--green-lt: #edf7f2
--green-dot: #22c55e
--amber: #b45309
--amber-lt: #fef3c7
--blue: #1d4ed8
--blue-lt: #eff6ff
--border: #e5e6ea
--sans: 'DM Sans', system-ui, sans-serif
--serif: 'DM Serif Display', Georgia, serif
Font import: https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap

## Local development
Run: aem up
Local preview: http://localhost:3000
The AEM Sidekick hot-reloads on file save.
Content is served from SharePoint or Google Drive depending on config.

## Build order
Build blocks in this sequence — each depends on the previous:
1. nash-topbar (shell, no dependencies)
2. nash-sidebar (navigation, no dependencies)
3. nash-hero (overview header)
4. nash-report-card (core repeating unit)
5. nash-detail-view (drill-down view)
6. nash-chat (most complex, needs proxy)

## Skills available
All 17 Adobe AEM EDS skills are in .agents/. Key ones:
- content-driven-development: use this for ALL block builds
- docs-search: use when you need to look up AEM patterns
- block-collection-and-party: find reference implementations
- testing-blocks: use after each block is built
Always invoke content-driven-development explicitly when starting a block.
