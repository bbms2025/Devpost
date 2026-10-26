# AI Chat Organizer

A Chrome extension that turns a long ChatGPT conversation into a clickable, navigable outline — without leaving the page or sending anything to an external service.

## What It Does

Open any ChatGPT conversation, click **Load** in the side panel, and instantly see a chronological outline of every message. Click any entry to jump directly to that message. Bookmark AI answers into named collections and export them as Markdown, JSON, or plain text.

**Features:**
- Clickable conversation outline in Chrome's native side panel
- Click-to-navigate with smooth scroll and highlight animation
- Live updates as the conversation grows (MutationObserver)
- Extraction status indicator (waiting / reading / ready / incomplete)
- Bookmark ChatGPT answers into named collections (stored in IndexedDB)
- Browse saved collections and answers
- Export collections to `.md`, `.json`, or `.txt`
- Light and dark theme support
- 100% local — no external API, no server, no data transmitted

## Demo

> Open a ChatGPT conversation → click **Load** → click any entry to jump to that message → bookmark answers into collections → export for later.

## Installation (Developer Mode)

**Prerequisites:** Node.js 18+, npm, Chrome 114+

```bash
npm install
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

The extension icon appears in your toolbar. Open a ChatGPT conversation, click the side panel button, and click **Load**.

## Development

```bash
npm run dev
```

Load the `dist/` folder as an unpacked extension. Vite rebuilds on changes.

## Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript 5 |
| UI | React 18 |
| Build | Vite 5 |
| Styling | CSS Modules + CSS custom properties |
| Persistence | IndexedDB via Dexie.js |
| Extension | Chrome Manifest V3, Side Panel API |

## Project Structure

```
src/
  background/     Chrome service worker — tab ID bridge
  content/        Content script — DOM extraction, navigation, MutationObserver
    adapters/     ChatGPTAdapter — isolated DOM reading strategy
  panel/          React side panel app
    components/   UI components
    services/     BookmarkService (IndexedDB), ExportService
    styles/       CSS tokens (light/dark theme), global styles
  shared/         Shared types and message contracts
devpost/          Planning docs — scope, PRD, spec, bookmark spec
```

## Privacy

All data stays on your device. No conversation content is ever sent to a server, API, or third-party service. Saved bookmarks live in Chrome's IndexedDB, scoped to your local profile.

## Planning Docs

The `devpost/` folder contains the full planning trail:

- [`devpost/scope.md`](devpost/scope.md) — idea, kernel, POC boundary
- [`devpost/prd.md`](devpost/prd.md) — product requirements
- [`devpost/spec.md`](devpost/spec.md) — technical spec
- [`devpost/bookmark-feature-spec.md`](devpost/bookmark-feature-spec.md) — bookmark feature spec

## License

MIT
