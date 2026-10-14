---
doc: spec
status: approved
---

# AI Chat Organizer — Technical Spec

## How This Works, In Plain Language

The AI Chat Organizer is a Chrome extension with two main pieces that run in different places and talk to each other.

The first piece is a **content script** — a JavaScript file that Chrome quietly injects into the ChatGPT page. It runs inside the ChatGPT tab and has direct access to the page's DOM (the tree of elements that make up the page). Its job is to find message elements, read their content, assign identities to them, and watch for changes as the conversation grows. Think of it as a reader that sits inside the page and takes notes.

The second piece is the **side panel** — a small React application that runs in Chrome's built-in side panel, separate from the ChatGPT page. It receives the notes from the content script, renders them as the clickable outline, and handles user interactions like clicking a row. Think of it as the display that shows what the reader found.

These two pieces can't directly call each other's functions — they're isolated by Chrome for security. They communicate by passing messages through Chrome's extension messaging system, like sending notes through a window.

The messaging direction matters: the content script can send messages to the side panel using `chrome.runtime.sendMessage` (broadcast to the extension). The side panel cannot use `chrome.runtime.sendMessage` to reach the content script — that only routes to the extension itself. Instead, the side panel uses `chrome.tabs.sendMessage(tabId, message)` to target the specific tab where the content script is running. The service worker (background script) bridges the connection when needed and supplies the active tab ID.

When you open the side panel on a ChatGPT conversation:
1. The side panel tells the content script "I'm open, start extracting" via `chrome.tabs.sendMessage` (routed through the background service worker to get the active tab ID).
2. The content script reads the page, identifies messages, and sends batches back to the side panel via `chrome.runtime.sendMessage`.
3. The side panel renders the outline progressively as batches arrive.
4. The content script keeps watching the page with a MutationObserver — a browser API that fires a callback whenever the DOM changes — so it can detect new messages, streaming responses, and edits.
5. When you click a row, the side panel sends a "navigate to message X" instruction to the content script via `chrome.tabs.sendMessage`, which finds the element and scrolls it into view.

This shape — content script reads and navigates, side panel displays and receives input — is the standard pattern for Chrome extensions that need to interact with a page they don't own.

## The Core Journey Through the System

1. **User opens the side panel** on a ChatGPT conversation page.
2. The side panel (React app) initializes and gets the active tab ID from the background service worker via `chrome.runtime.sendMessage({ type: 'GET_TAB_ID' })`. It then sends a `PANEL_READY` message to the content script via `chrome.tabs.sendMessage(tabId, { type: 'PANEL_READY' })`.
3. The **content script** receives `PANEL_READY`, begins scanning the DOM for message elements, and sends a `STATUS_UPDATE` (`"reading"`) back to the side panel via `chrome.runtime.sendMessage`.
4. The side panel receives `STATUS_UPDATE` and shows "Reading conversation…".
5. The content script identifies message elements — preferring `data-message-id` attributes, falling back to locally generated IDs — and sends batches of `MessageEntry` objects to the side panel via `chrome.runtime.sendMessage`.
6. The side panel receives each batch and appends entries to the outline list progressively. Clickable entries render immediately; in-progress entries render with a "Generating…" indicator.
7. When extraction is complete, the content script sends `STATUS_UPDATE` (`"ready"` or `"incomplete"`). The side panel updates the status indicator.
8. The **MutationObserver** in the content script continues watching. When a new message appears or a streaming response changes, it fires debounced reconciliation logic.
9. The content script sends incremental `MESSAGE_ADDED` or `MESSAGE_UPDATED` events to the side panel via `chrome.runtime.sendMessage`, which appends or updates the relevant entry.
10. **User clicks a row** → the side panel sends a `NAVIGATE_TO` message with the entry's ID to the content script via `chrome.tabs.sendMessage(tabId, { type: 'NAVIGATE_TO', id })`.
11. The content script receives `NAVIGATE_TO`, resolves the current DOM element for that ID (revalidating rather than trusting a stale reference), calls `element.scrollIntoView()`, and applies a brief CSS highlight class that auto-removes after ~1 second.
12. If the element cannot be confidently resolved, the content script sends a `NAVIGATE_FAILED` response via `chrome.runtime.sendMessage` and the side panel marks that row with a failed/unavailable state.

PRD ref: `prd.md > The Core Journey`.

## Stack

| Piece | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Type safety across message contracts between content script and side panel; catches shape mismatches at compile time. |
| UI framework | React 18 | Dynamic outline list with multiple state dimensions (extraction status, streaming, selected row) — manageable in React, messy in vanilla JS. |
| Build tool | Vite + `@crxjs/vite-plugin` | First-class Chrome extension support: handles manifest v3, HMR during development, and bundles content scripts and side panel correctly. Docs: https://crxjs.dev/vite-plugin |
| Styling | CSS Modules | Scoped styles per component, no runtime overhead, works cleanly with Vite. Theme switching via CSS custom properties. |
| Testing | Vitest + jsdom | Unit tests for extraction logic and reconciliation against saved HTML fixtures. Docs: https://vitest.dev |
| Package manager | npm | Standard; no additional setup. |

**Unverified — check early in the build:** `@crxjs/vite-plugin` has had version compatibility issues with newer Vite releases. Verify the latest stable version pair at https://crxjs.dev before starting and pin both in `package.json`.

No external API, no backend, no database in the PoC. Everything runs locally in the browser.

## Where It Runs and How Someone Tries It

**Runtime:** Chrome browser (version 114+ for side panel API support). No server, no deployment required.

**Prerequisites:** Node.js 18+, npm, Chrome.

**Development setup:**
```
npm install
npm run dev
```
Then open `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select the `dist/` folder. The extension appears in Chrome's toolbar.

**For the demo recording:**
1. Open any long ChatGPT conversation (50+ messages works well).
2. Click the extension icon or the Chrome side panel button to open the panel.
3. Watch the outline populate progressively.
4. Click several entries to demonstrate navigation and the highlight effect.
5. Send a new message, show the in-progress indicator, and show the completed entry.

**Production build:**
```
npm run build
```
Produces a `dist/` folder that can be loaded as an unpacked extension or zipped for Chrome Web Store submission.

**Submission:** A short screen recording of the steps above is the required demo. The public GitHub repository includes `devpost/scope.md`, `devpost/prd.md`, and `devpost/spec.md` as required by the hackathon.

## Look and Feel

Implements `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

**Theme detection:** Read the `data-theme` attribute on `document.documentElement` (ChatGPT sets this to `"light"` or `"dark"`). Fall back to `window.matchMedia('(prefers-color-scheme: dark)')` if the attribute is absent. Apply the result as a `data-theme` attribute on the side panel's root element. Do not use ChatGPT's internal CSS class names.

**CSS custom properties (set per theme):**

| Token | Light | Dark |
|---|---|---|
| `--bg-primary` | `#ffffff` | `#1e1e1e` |
| `--bg-hover` | `#f5f5f5` | `#2a2a2a` |
| `--bg-selected` | `#ebebeb` | `#333333` |
| `--text-primary` | `#0d0d0d` | `#ececec` |
| `--text-secondary` | `#6e6e6e` | `#8e8e8e` |
| `--divider` | `#e5e5e5` | `#2f2f2f` |
| `--accent` | `#2563eb` | `#3b82f6` |

**Typography:** System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`). 13px base size, 1.4 line height. Compact row height (~40px). No decorative fonts.

**Density:** Tight and minimal. No cards, gradients, or shadows. Subtle dividers between entries. Hover and selected states use background color only.

**Navigation highlight:** A `@keyframes` flash on `background-color` (accent color at 30% opacity → transparent), duration 800ms, applied via a temporary CSS class added and removed by the content script.

## Components

### BackgroundServiceWorker
`src/background/index.ts`

Chrome Manifest V3 service worker. Required to bridge the messaging gap between the side panel and the content script.
- Listens for `GET_TAB_ID` from the side panel and responds with the active tab's ID.
- The side panel uses this ID to call `chrome.tabs.sendMessage(tabId, message)` when sending instructions to the content script.

Without this, the side panel has no way to target the correct tab's content script.

### ExtensionRuntime (content script entry point)
`src/content/index.ts`

Boots when Chrome injects the content script into a ChatGPT tab. Initializes the `ChatGPTAdapter`, sets up the `chrome.runtime.onMessage` listener to receive instructions from the side panel (delivered via `chrome.tabs.sendMessage` from the panel), and manages the MutationObserver lifecycle.

PRD ref: `prd.md > Conversation Extraction`, `prd.md > Dynamic Updates`.

### ChatGPTAdapter
`src/content/adapters/chatgpt.ts`

The only component that knows ChatGPT's DOM structure. Responsible for:
- Identifying message container elements on the page.
- Reading speaker identity (user or assistant) and message text from each element.
- Extracting `data-message-id` when present; generating a local ID when not.
- Detecting the streaming indicator element (primary signal) and exposing a method to check it.

Isolated so that a Claude or Gemini adapter can be added later without touching anything else.

PRD ref: `prd.md > Conversation Extraction`.

### MessageIdentityService
`src/content/identity.ts`

Maintains the local registry of known messages. For each message:
- Stores: `{ id, speaker, contentFingerprint, domElement, siteId? }`
- Resolves a message ID to its current DOM element at navigation time (revalidates rather than trusting a stale reference).
- Reconciles after DOM changes: matches incoming elements against the registry using site ID → content fingerprint → speaker + neighbor context → DOM position (in that priority order).
- Reports ambiguous or missing targets rather than guessing.

PRD ref: `prd.md > Click-to-Navigate`, `prd.md > Dynamic Updates`.

### ExtractionOrchestrator
`src/content/extraction.ts`

Coordinates the MutationObserver and the extraction pipeline:
- Runs the initial full extraction on `PANEL_READY`.
- Debounces MutationObserver callbacks (300ms) to avoid processing every individual text node change during streaming.
- Detects streaming state using the combination approach: streaming indicator element (primary) + content fingerprint stabilization across two consecutive checks ~300ms apart (fallback).
- Sends `STATUS_UPDATE`, `MESSAGE_BATCH`, `MESSAGE_ADDED`, and `MESSAGE_UPDATED` messages to the side panel via `chrome.runtime.sendMessage`.

PRD ref: `prd.md > Dynamic Updates`, `prd.md > Extraction Status`.

### SidePanel (React app entry point)
`src/panel/main.tsx`

Mounts the React app into the side panel HTML. Initializes the `chrome.runtime.onMessage` listener to receive events from the content script.

### OutlineStore
`src/panel/store.ts`

Simple React state (or `useReducer`) managing:
- `entries: MessageEntry[]` — the ordered list of extracted messages.
- `status: 'waiting' | 'reading' | 'ready' | 'incomplete'` — overall extraction status.
- `selectedId: string | null` — the currently navigated entry.
- Actions: `SET_STATUS`, `APPEND_ENTRIES`, `ADD_ENTRY`, `UPDATE_ENTRY`.

No persistence — state is rebuilt from the live page each session.

PRD ref: `prd.md > Extraction Status`, `prd.md > States and Boundaries`.

### PanelApp
`src/panel/PanelApp.tsx`

Root React component. Renders the `Header` and `OutlineList`. Passes store state down as props.

### Header
`src/panel/components/Header.tsx`

Renders the extension name ("AI Chat Organizer") and the current extraction status indicator. Status text and animation keyed to `OutlineStore.status`.

PRD ref: `prd.md > Extraction Status`, `prd.md > Screens and Layout`.

### OutlineList
`src/panel/components/OutlineList.tsx`

Renders the scrollable list of `OutlineEntry` components. Manages scroll position: auto-scrolls to the newest entry only when the user is already at the bottom of the panel (within ~50px of the end). If the user has scrolled up to read earlier entries, their position is preserved and new entries are appended silently at the bottom.

PRD ref: `prd.md > Outline Display`, `prd.md > Dynamic Updates`.

### OutlineEntry
`src/panel/components/OutlineEntry.tsx`

Renders a single message row:
- Speaker icon + label ("You" / "ChatGPT").
- Message preview (truncated to two lines with CSS `line-clamp`).
- Visual states: default, hover, selected, in-progress (Generating…), failed/unavailable.
- On click: gets the active tab ID from the background service worker, then dispatches `NAVIGATE_TO` to the content script via `chrome.tabs.sendMessage(tabId, { type: 'NAVIGATE_TO', id })`. Disabled (no click) when `status === 'generating'` or `status === 'failed'`.

PRD ref: `prd.md > Outline Display`, `prd.md > Click-to-Navigate`.

## Data Model

All data lives in memory only — no persistence in the PoC.

### MessageEntry
The shared contract between content script and side panel. Defined in `src/shared/types.ts` and imported by both.

```typescript
type Speaker = 'user' | 'assistant';

type EntryStatus =
  | 'ready'       // navigable
  | 'generating'  // streaming in progress
  | 'failed';     // cannot be navigated to

interface MessageEntry {
  id: string;               // local ID (stable within a session)
  siteId?: string;          // data-message-id from ChatGPT, if available
  speaker: Speaker;
  preview: string;          // first ~120 chars of message text, trimmed
  contentFingerprint: string; // hash or normalized content for reconciliation
  status: EntryStatus;
}
```

### Runtime messages (content script ↔ side panel)
Defined in `src/shared/messages.ts`.

```typescript
// Side panel → content script
type PanelMessage =
  | { type: 'PANEL_READY' }
  | { type: 'NAVIGATE_TO'; id: string };

// Content script → side panel
type ContentMessage =
  | { type: 'STATUS_UPDATE'; status: ExtractionStatus }
  | { type: 'MESSAGE_BATCH'; entries: MessageEntry[] }
  | { type: 'MESSAGE_ADDED'; entry: MessageEntry }
  | { type: 'MESSAGE_UPDATED'; entry: MessageEntry }
  | { type: 'NAVIGATE_OK'; id: string }
  | { type: 'NAVIGATE_FAILED'; id: string; reason: string };
```

### ExtractionStatus
```typescript
type ExtractionStatus = 'waiting' | 'reading' | 'ready' | 'incomplete';
```

## File Structure

```
ai-chat-organizer/
├── src/
│   ├── shared/
│   │   ├── types.ts          # MessageEntry, Speaker, EntryStatus
│   │   └── messages.ts       # PanelMessage, ContentMessage, ExtractionStatus
│   ├── background/
│   │   └── index.ts          # BackgroundServiceWorker — tab ID bridge
│   ├── content/
│   │   ├── index.ts          # ExtensionRuntime — content script entry point
│   │   ├── extraction.ts     # ExtractionOrchestrator — MutationObserver + pipeline
│   │   ├── identity.ts       # MessageIdentityService — ID registry + reconciliation
│   │   └── adapters/
│   │       └── chatgpt.ts    # ChatGPTAdapter — DOM reading, site ID extraction
│   └── panel/
│       ├── main.tsx          # SidePanel entry point
│       ├── PanelApp.tsx      # Root component
│       ├── store.ts          # OutlineStore — useReducer state
│       ├── components/
│       │   ├── Header.tsx        # Status indicator + extension name
│       │   ├── OutlineList.tsx   # Scrollable entry list
│       │   └── OutlineEntry.tsx  # Single message row
│       └── styles/
│           ├── tokens.css        # CSS custom properties (light + dark)
│           └── panel.css         # Global panel styles
├── public/
│   ├── icons/                # Extension icons (16, 48, 128px)
│   └── panel.html            # Side panel HTML shell
├── manifest.json             # Chrome extension manifest v3
├── vite.config.ts            # Vite + @crxjs/vite-plugin config
├── tsconfig.json
├── package.json
├── devpost/                  # Planning docs (scope.md, prd.md, spec.md)
└── README.md
```

## External Services and Dependencies

No external services. No API keys. No network calls from the extension.

**Key npm dependencies:**

| Package | Purpose | Docs |
|---|---|---|
| `react` + `react-dom` | Side panel UI | https://react.dev |
| `@crxjs/vite-plugin` | Chrome extension build support | https://crxjs.dev/vite-plugin |
| `vite` | Build tool + dev server | https://vitejs.dev |
| `typescript` | Type checking | https://www.typescriptlang.org |
| `vitest` | Unit test runner | https://vitest.dev |
| `jsdom` | DOM simulation for tests | https://github.com/jsdom/jsdom |

**⚠ Verify before starting the build:** Pin `@crxjs/vite-plugin` and `vite` versions together — compatibility between them has changed across releases. Check https://crxjs.dev for the current recommended pairing and pin both in `package.json` with exact versions.

## Important Failure Modes

- **ChatGPT changes its DOM structure** → `ChatGPTAdapter` fails to find message elements. The `ExtractionOrchestrator` catches zero results and sends `STATUS_UPDATE('incomplete')`. The panel shows "Outline may be incomplete." The adapter is isolated so it can be updated without touching anything else.

- **Message identity is ambiguous after edits or regeneration** → `MessageIdentityService` cannot confidently resolve a `NAVIGATE_TO` request. The content script sends `NAVIGATE_FAILED` instead of scrolling to a wrong message. The affected row in the panel shows a failed/unavailable state.

- **MutationObserver fires too frequently during streaming** → `ExtractionOrchestrator` debounces callbacks at 300ms. Individual text node mutations are batched; the side panel receives one `MESSAGE_UPDATED` event per settled change, not one per character.

- **Side panel opens before the ChatGPT conversation has loaded** → Content script sends `STATUS_UPDATE('waiting')`. Panel shows "Waiting for conversation…" and the `ExtractionOrchestrator` retries when the conversation container appears.

## What Was Simplified and Why

- **In-memory only, no IndexedDB** — conversation data is not persisted between sessions. The panel rebuilds from the live page each time it opens. This removes the entire persistence layer from the PoC so the build can focus on reliable extraction and navigation. IndexedDB is the next layer after the outline works.

- **No search index** — extracted message text is held in `MessageEntry.preview` only, not in a searchable local index. Search is deferred until the extraction foundation is solid.

- **Single adapter (ChatGPT only)** — the `adapters/` folder is designed for expansion, but only `chatgpt.ts` is built in the PoC. The shared internal format (`MessageEntry`) means Claude and Gemini adapters can be added without changing the side panel or the orchestrator.

- **No export or summary** — these features require the extraction foundation to be reliable first. Deferred cleanly.

## Decisions and Open Issues

**Decisions made:**

- **React + TypeScript** (learner's choice) — fits the dynamic state complexity of the outline. Tradeoff: more initial setup than vanilla JS, but manageable given existing React experience.

- **Combination message identity** (learner's choice) — prefer `data-message-id`, fall back to local ID + reconciliation using content fingerprint + speaker + neighbor context + DOM position. DOM position is a clue, not an identity. Tradeoff: more complex than position-only, but resilient to message edits, regeneration, and dynamic loading.

- **Combination streaming detection** (learner's choice) — streaming indicator element as primary signal, content fingerprint stabilization (two unchanged checks ~300ms apart) as fallback. Uncertain state stays in-progress rather than declaring completion prematurely. Tradeoff: slight detection delay on the fallback path, acceptable for the PoC.

- **Debounced MutationObserver at 300ms** — prevents expensive reconciliation on every individual text node mutation during streaming. Tradeoff: up to 300ms latency on outline updates, not perceptible in normal use.

- **Theme detection via `data-theme` attribute + `prefers-color-scheme` fallback** — avoids dependency on ChatGPT's internal CSS class names. Tradeoff: if ChatGPT changes its attribute name, the fallback still works.

- **`@crxjs/vite-plugin` for the build** — simplifies Chrome extension development significantly. Tradeoff: version compatibility must be verified and pinned before starting.

**Learner uncertainty explored:**

Streaming detection in ChatGPT's DOM — new territory. Explained three options: streaming indicator element watch, content fingerprint polling, and combining both. Chose Option 3 for the same reason as message identity: prefer the strongest available signal, don't depend on a single implementation detail. The build should verify the exact streaming indicator attribute early (Phase 1 of the build), since it's the primary signal.

**Open issues:**

- **Exact streaming indicator attribute** — needs to be verified against live ChatGPT during the first build slice. Look for a `data-*` attribute or element that appears while a response is generating and disappears when it completes. If it's a CSS class name rather than a data attribute, note that it's more likely to change and weight the fingerprint fallback more heavily.

- **`data-message-id` availability** — verify during the first extraction slice whether ChatGPT currently exposes this attribute on message elements, and on which element in the hierarchy (the container, the content div, or another element). This determines how much of the identity work relies on the fallback path.

- **Auto-scroll behavior when user is at the bottom of the panel** — resolved: auto-scroll only when the user is already within ~50px of the bottom, matching chat interface conventions. Documented in `prd.md > Dynamic Updates` and `prd.md > Product Decisions`.
