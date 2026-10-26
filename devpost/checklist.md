---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Scaffold — extension loads in Chrome with a working side panel**
  Becomes usable: The extension installs from `dist/`, the side panel opens on any ChatGPT page, and the background service worker responds to `GET_TAB_ID`. No extraction yet — just the skeleton with all plumbing verified.
  Why now: Build tooling, manifest v3, `@crxjs/vite-plugin` version compatibility, and the messaging architecture must all work before anything else can be built. This is the highest-risk slice.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Extraction Status` (waiting state)
  Spec ref: `spec.md > Stack`, `spec.md > File Structure`, `spec.md > Components > BackgroundServiceWorker`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Scaffold the full file structure from the spec. Set up `package.json`, `vite.config.ts`, `tsconfig.json`, `manifest.json`. Install and pin `@crxjs/vite-plugin` + Vite at a compatible version pair. Create the background service worker (`GET_TAB_ID` handler). Create the minimal React side panel with Header showing "Waiting for conversation…". Create the content script stub that listens for `PANEL_READY`. Wire CSS tokens for light/dark theme.
  Verify (mechanical): Run `npm run build` — zero errors. Load `dist/` as an unpacked extension in Chrome. Open a ChatGPT page, open the side panel — it appears with the header and "Waiting for conversation…". Open DevTools → background service worker — no errors.
  Learner check: Open a ChatGPT conversation, click the extension's side panel button — confirm the panel opens and shows "Waiting for conversation…".
  Commit: `Scaffold: extension loads with side panel and background service worker`

- [x] **2. Content script extracts messages — panel shows the outline**
  Becomes usable: Open a real ChatGPT conversation, open the panel — it shows a scrollable chronological outline of every user question and AI response, with speaker labels and previews. Status progresses from "Reading…" to "Ready". This is the kernel.
  Why now: Everything else depends on reliable extraction. If this doesn't work well, nothing else matters.
  PRD ref: `prd.md > Conversation Extraction`, `prd.md > Outline Display`, `prd.md > Extraction Status`
  Spec ref: `spec.md > Components > ChatGPTAdapter`, `spec.md > Components > MessageIdentityService`, `spec.md > Components > ExtractionOrchestrator`, `spec.md > Components > OutlineList`, `spec.md > Components > OutlineEntry`, `spec.md > Data Model`
  Build: Implement `ChatGPTAdapter` — find message containers, read speaker + text, extract `data-message-id` if present (verify it exists and on which element), generate local IDs as fallback. Implement `MessageIdentityService` — registry with fingerprint storage. Implement `ExtractionOrchestrator` — full extraction on `PANEL_READY`, send `STATUS_UPDATE('reading')`, send `MESSAGE_BATCH` in chunks, send `STATUS_UPDATE('ready'/'incomplete')`. Implement `OutlineList` + `OutlineEntry` — scrollable list, speaker icon, preview, `line-clamp`. Wire `OutlineStore` with `SET_STATUS` + `APPEND_ENTRIES`. Apply theme tokens to entry rows.
  Verify (mechanical): Load extension, open a ChatGPT conversation with 20+ messages. Confirm: status shows "Reading conversation…" then "Ready". Count outline entries — matches visible message count. Each row shows correct speaker and readable preview. Check DevTools console — no errors.
  Learner check: Open a long ChatGPT conversation (50+ messages), open the panel — scan the outline and verify all your questions and ChatGPT's responses are listed in the correct order.
  Commit: `Slice 2: extract messages and render outline`

- [x] **3. Click a row — navigate to the correct message**
  Becomes usable: Click any row in the outline — the main ChatGPT window scrolls directly to that message, a brief highlight confirms the destination, and the clicked row shows a selected state. Failed navigation shows a clear per-row error state.
  Why now: This completes the kernel. The outline is only useful if clicking it works reliably.
  PRD ref: `prd.md > Click-to-Navigate`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components > MessageIdentityService`, `spec.md > Components > OutlineEntry`, `spec.md > Look and Feel` (navigation highlight)
  Build: Extend `MessageIdentityService` with element resolution — revalidate DOM element at click time, not from stale reference. In `OutlineEntry`, wire click → `chrome.tabs.sendMessage(tabId, { type: 'NAVIGATE_TO', id })` via background worker tab ID. In content script, handle `NAVIGATE_TO` — resolve element, call `scrollIntoView({ behavior: 'smooth', block: 'center' })`, apply highlight CSS class, remove after 800ms. Send `NAVIGATE_OK` or `NAVIGATE_FAILED`. In `OutlineEntry`, handle `NAVIGATE_OK` → selected state, `NAVIGATE_FAILED` → failed state. Add `@keyframes` highlight animation to `tokens.css`.
  Verify (mechanical): Click 5 different rows across the conversation — each time the main window scrolls to the correct message and a highlight briefly appears. Click a row, then immediately click another — the first deselects, the second selects and navigates. Check console — no errors.
  Learner check: Open a conversation with 50+ messages, click a question near the top of the outline, then one near the bottom — confirm you land on the exact correct message each time with no manual scrolling.
  Commit: `Slice 3: click-to-navigate with highlight and selected state`

- [x] **4. Dynamic updates — outline stays current as the conversation grows**
  Becomes usable: Send a new message while the panel is open — it appears in the outline. While ChatGPT responds, a "Generating…" indicator appears. When the response finishes, it becomes a clickable row. No duplicates, no lost entries, panel scroll position preserved unless already at the bottom.
  Why now: The outline is only trustworthy if it stays in sync. Without this, users must reopen the panel after every exchange.
  PRD ref: `prd.md > Dynamic Updates`, `prd.md > Extraction Status`
  Spec ref: `spec.md > Components > ExtractionOrchestrator`, `spec.md > Components > OutlineList`
  Build: Add `MutationObserver` to `ExtractionOrchestrator` — debounce at 300ms. On new user message: send `MESSAGE_ADDED`. On new assistant element appearing: send `MESSAGE_ADDED` with `status: 'generating'`. Detect streaming completion using combination approach (streaming indicator element primary, fingerprint stabilization fallback — verify exact streaming indicator in ChatGPT DOM). On completion: send `MESSAGE_UPDATED` with `status: 'ready'`. In `OutlineList`: handle `ADD_ENTRY` + `UPDATE_ENTRY` actions. Auto-scroll only when within 50px of bottom. Prevent duplicate entries via ID check in `OutlineStore`.
  Verify (mechanical): Open panel on an existing conversation. Send a new prompt — new user entry appears. While ChatGPT responds — "Generating…" entry appears. After response completes — entry becomes clickable with preview text. Scroll to middle of outline, send another message — outline doesn't jump position. Click the new entry — navigates correctly. Check console — no duplicate entries.
  Learner check: Open the panel, scroll to the middle of the outline, send a new message and watch the bottom of the outline — confirm the new entries appear without moving your scroll position, and that the completed response is clickable and navigates correctly.
  Commit: `Slice 4: dynamic updates with MutationObserver and streaming detection`

- [x] **5. Bookmark persistence — save answers to IndexedDB**
  Becomes usable: User clicks bookmark button on an answer → modal opens with suggested title → user creates a collection → clicks Save → answer is persisted to IndexedDB and modal shows success toast.
  Why now: Core bookmark feature. Must work before building the Saved view.
  PRD ref: `bookmark-feature-prd.md > Save Bookmark Modal`, `bookmark-feature-prd.md > Entry Point`
  Spec ref: `bookmark-feature-spec.md > Components > BookmarkButton`, `bookmark-feature-spec.md > Components > SaveBookmarkModal`, `bookmark-feature-spec.md > Components > BookmarkService`
  Build: Install and configure Dexie.js. Implement `BookmarkService` with schema, `createCollection`, `saveAnswer`, duplicate detection. Implement `BookmarkButton` component (rendered on assistant entries). Implement `SaveBookmarkModal` with title editing, collection selection, "Create new collection" flow. Implement `Toast` notification component. Wire bookmark button to modal, modal Save to `BookmarkService`. Extend `MessageEntry` to include full `content` field.
  Verify (mechanical): Open panel, click bookmark on an answer → modal opens with pre-filled title. Create collection "Test Collection" → Save → toast shows "Saved to Test Collection". Open DevTools → Application → IndexedDB → AIBookmarks → verify collection and saved answer records exist. Click bookmark on same answer → Save to same collection → shows duplicate error. Click bookmark on different answer → Save to "Test Collection" → succeeds, second answer in same collection.
  Learner check: Bookmark 3 different answers into a new collection, then check IndexedDB to confirm all records persisted correctly.
  Commit: `Slice 5: bookmark persistence with IndexedDB and save modal`

- [x] **6. Saved views modal — browse collections and answers**
  Becomes usable: User clicks "Saved Views" button in header → modal opens showing collections → clicks a collection → sees saved answers → clicks an answer → views full content. Can delete answers and collections.
  Why now: Saved bookmarks are only useful if you can view them later.
  PRD ref: `bookmark-feature-prd.md > Saved Collection View`
  Spec ref: `bookmark-feature-spec.md > Components > SavedViewsModal`, `bookmark-feature-spec.md > Components > Header (update)`
  Build: Update `Header` to add "Saved Views" button next to "Load Chat". Implement `SavedViewsModal` with three levels: collections list → answers list → answer detail. Wire `BookmarkService.listCollections()`, `getAnswersByCollection()`. Implement delete operations (answer, collection with confirmation). Add empty states for no collections / no answers. Add back navigation between levels.
  Verify (mechanical): Click "Saved Views" button → modal opens showing collections from Slice 5. Click collection → modal updates to show saved answers with correct titles. Click answer → modal shows full content in detail view. Click back button → navigates back through levels correctly. Delete answer → verify it's removed from list and IndexedDB. Delete collection → verify confirmation prompt, then collection and all answers removed. Click outside modal → modal closes, outline still visible.
  Learner check: Save 3 answers across 2 collections, click "Saved Views", navigate through all three levels, then delete one answer and one collection to confirm everything updates correctly.
  Commit: `Slice 6: saved views modal with collection and answer browsing`

- [x] **7. Go to source — navigate from saved answer to original message**
  Becomes usable: User views a saved answer in the modal while the source conversation is open → "Go to source" button appears → clicking it navigates to the original message in the ChatGPT page and closes the modal.
  Why now: Completes the bookmark feature. Users can jump from saved knowledge back to its context.
  PRD ref: `bookmark-feature-prd.md > Saved Collection View`
  Spec ref: `bookmark-feature-spec.md > Components > SavedViewsModal`
  Build: In `SavedViewsModal` detail view: detect if `conversationId` matches current conversation. If yes: resolve `messageId` via `MessageIdentityService`, show "Go to source" button. On click: send `NAVIGATE_TO` to content script, close modal, highlight message as usual. If resolution fails: show "Source unavailable".
  Verify (mechanical): Save an answer from conversation A. Click "Saved Views" → open the collection → open the saved answer → "Go to source" button appears. Click button → verify navigation to original message and modal closes. Close conversation A, open conversation B, view same saved answer in modal → "Go to source" hidden. Reopen conversation A, view saved answer → "Go to source" reappears.
  Learner check: Bookmark an answer, click "Saved Views", navigate to the answer, click "Go to source" — confirm it jumps to the exact message and closes the modal.
  Commit: `Slice 7: go to source navigation from saved answers`

- [x] **8. Export collections — download to Markdown, JSON, or plain text**
  Becomes usable: User views collections list → clicks export dropdown on a collection → selects format (.md, .json, or .txt) → file downloads with all collection answers and metadata.
  Why now: Completes the bookmark feature. Users can preserve saved knowledge outside the extension.
  PRD ref: `bookmark-feature-prd.md > Export Collections`
  Spec ref: `bookmark-feature-spec.md > Components > ExportService`
  Build: Implement `ExportService` with `exportToMarkdown()`, `exportToJSON()`, `exportToText()`, and `downloadFile()` methods. Add export dropdown button to collection cards in `SavedViewsModal` collections view. Handle nested code fences, sanitize filenames, format dates. Generate filename as `{CollectionTitle}_export_{Date}.{ext}`. Show toast on successful export.
  Verify (mechanical): Save 3-5 answers in a collection. Click export dropdown → select .md → file downloads. Open file, verify: collection title, export date, answer count, answer titles, full content preserved, source links included. Repeat for .json format → verify valid JSON structure. Repeat for .txt format → verify ASCII separators and plain text formatting. Try exporting empty collection → shows message "No answers to export". Try collection with special characters in title → filename is sanitized correctly.
  Learner check: Export a collection with code blocks and nested Markdown to .md format, open it in VS Code or a text editor, confirm all formatting is preserved and code blocks don't break the document structure.
  Commit: `Slice 8: export collections to MD/JSON/TXT`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after Slice 2 (outline renders on a real conversation)
- [x] Final kick-the-tires exploration and feedback completed

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- ChatGPT no longer uses `article` or `data-message-author-role` attributes — the spec assumed these. Live DOM inspection revealed `[class*="bg-user-message"]` for user turns and `[class*="MarkdownRoot"]` for assistant turns. Adapter updated accordingly.
- Manual load button added (`LOAD_CONVERSATION` message) — auto-extraction on `PANEL_READY` was replaced because ChatGPT's React app renders messages asynchronously after `document_idle` fires, making zero-element results unavoidable on initial injection.

