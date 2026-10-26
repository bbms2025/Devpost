---
doc: bookmark-feature-spec
status: approved
---

# AI Chat Organizer — Bookmark Collections Technical Spec

## How This Works, In Plain Language

The Bookmark feature adds a persistence layer to the AI Chat Organizer. While the outline shows the current conversation in memory, bookmarks save specific ChatGPT answers into named collections that persist across sessions, conversation switches, and browser restarts.

When a user clicks the bookmark button on a ChatGPT answer row, a modal opens. The user can edit the suggested title, select an existing collection or create a new one, then save. The complete answer text, its metadata, and the source reference are stored locally in IndexedDB — a browser-native database that persists data indefinitely.

Collections are simple named groups. One collection (e.g., "Database Design") can contain multiple saved answers from different ChatGPT conversations. Each saved answer preserves the full text, not just the preview.

A separate "Saved" view shows all collections and their answers. Clicking a saved answer shows its content, even if the original conversation is no longer open. If the source message can still be resolved in an open conversation, a "Go to source" action navigates to it.

The bookmark modal, saved view, and persistence layer run entirely in the side panel. No new content script logic is needed — the panel already receives full message data via `MessageEntry` and can extract complete text from the DOM on demand.

## The Core Journey Through the System

1. **User opens a ChatGPT conversation** → the outline populates as usual.
2. **User clicks the bookmark button** on a completed ChatGPT answer row (button only appears on assistant messages, not user messages) → the "Save bookmark" modal opens.
3. The **bookmark modal** pre-fills the answer title from the first sentence of the response (max 60 chars). It lists existing collections and shows a "Create new collection" option.
4. User **selects a collection or creates a new one** → edits the title if desired → clicks Save.
5. The **BookmarkService** (in the panel) writes the saved answer to IndexedDB using Dexie.js:
   - Generates a unique saved-answer ID (UUID)
   - Stores: `{ id, collectionId, title, content, conversationId, messageId, savedAt }`
   - Updates the collection's `updatedAt` timestamp
6. The modal **closes and shows a confirmation toast**: "Saved to Database Design".
7. **User clicks "Saved Views" button in header** → `SavedViewsModal` opens showing all collections.
8. User **clicks a collection** → modal updates to show all saved answers within it.
9. User **clicks a saved answer** → modal shows the full text in detail view. If the source conversation is still open and the message can be resolved, a "Go to source" button appears. Clicking it sends `NAVIGATE_TO` to the content script and closes the modal.
10. User can **navigate back** through modal levels (Detail → Answers → Collections) or close the modal to return to the outline.

PRD ref: `bookmark-feature-prd.md > User Flows`.

## Stack Additions

| Addition | Choice | Rationale |
|---|---|---|
| Local persistence | IndexedDB via Dexie.js | Browser-native, persists indefinitely, no size limits like localStorage. Dexie wraps IndexedDB with promises and schema versioning. |
| UUID generation | `crypto.randomUUID()` | Built-in, secure, no dependencies. Supported in Chrome 92+. |
| Modal UI | React Portal | Render modal over the side panel without z-index issues. Standard React pattern. |
| Toast notifications | Simple inline component | Avoid external toast library. Minimal implementation: fixed position, auto-dismiss after 3s. |

**New npm dependency:**
- `dexie` (v3.2+) — IndexedDB wrapper with TypeScript support. Docs: https://dexie.org

## Components

### BookmarkButton
`src/panel/components/BookmarkButton.tsx`

Small icon button (🔖 or ⭐) rendered on each `OutlineEntry` row where `entry.speaker === 'assistant'` and `entry.status === 'ready'`. **Hidden for user messages** (`entry.speaker === 'user'`) and generating entries.

Props:
- `entry: MessageEntry`
- `onSave: (entry: MessageEntry) => void`

On click, calls `onSave(entry)` and opens the `SaveBookmarkModal` without triggering the row's navigate behavior.

PRD ref: `bookmark-feature-prd.md > Entry Point`.

### SaveBookmarkModal
`src/panel/components/SaveBookmarkModal.tsx`

Modal rendered via React Portal. Opens when a bookmark button is clicked.

**State:**
- `answerTitle: string` — user-editable, initialized from first sentence of `entry.preview` (max 60 chars)
- `selectedCollectionId: string | null`
- `newCollectionTitle: string` — shown when user selects "Create new collection"
- `isCreatingNew: boolean`
- `isSaving: boolean`

**UI structure:**
1. Modal backdrop (click to cancel)
2. Modal content card
3. Header: "Save bookmark" + close button (X)
4. Answer title input (with label)
5. Collection selector:
   - Dropdown or radio list of existing collections
   - "Create new collection" option → reveals new collection title input
6. Actions: Cancel | Save (disabled when invalid)

**Validation:**
- Answer title cannot be blank or whitespace-only
- If creating new: collection title cannot be blank or whitespace-only
- If creating new: normalized title must not match an existing collection (case-insensitive, trimmed)

**On Save:**
1. Call `BookmarkService.saveAnswer({ entry, title, collectionId or newCollectionTitle })`
2. Set `isSaving = true` (disable Save button)
3. On success: close modal, show toast "Saved to {collectionTitle}"
4. On error: show error message, keep modal open, preserve user input
5. Set `isSaving = false`

**On Cancel/Close:**
- Close modal without saving

PRD ref: `bookmark-feature-prd.md > Save Bookmark Modal`.

### ExportService
`src/panel/services/ExportService.ts`

Static utility for generating export files from collections.

**Methods:**

`exportToMarkdown(collection: Collection, answers: SavedAnswer[]): string`
- Generates Markdown-formatted export
- Structure: H1 collection title, metadata, H2 answer titles with separators
- Preserves original Markdown formatting (code blocks, lists, tables)
- Handles nested code fences using `~~~` wrapper
- Includes source links when available

`exportToJSON(collection: Collection, answers: SavedAnswer[]): string`
- Generates JSON export with collection metadata and answers array
- Pretty-printed with 2-space indentation
- Includes all fields: id, title, content, savedAt, source

`exportToText(collection: Collection, answers: SavedAnswer[]): string`
- Generates plain text export with ASCII separators
- Uses `===` for collection header, `---` between answers
- Strips Markdown formatting from content

`downloadFile(content: string, filename: string, mimeType: string): void`
- Creates Blob, generates object URL, triggers download
- Automatically revokes object URL after download
- Sanitizes filename (removes special characters)

**Helper functions:**

`sanitizeFilename(title: string): string`
- Replaces non-alphanumeric characters with underscores
- Converts to lowercase
- Removes consecutive underscores

`formatDate(timestamp: number): string`
- Formats timestamp as YYYY-MM-DD for filenames
- Uses ISO format for JSON exports

`handleNestedCodeFences(content: string): string`
- Detects if content contains ` ``` ` markdown fences
- Wraps code blocks with `~~~` instead to prevent breakage

PRD ref: `bookmark-feature-prd.md > Export Collections`.
`src/panel/services/BookmarkService.ts`

Singleton service managing IndexedDB operations via Dexie.

**Database schema (Dexie):**
```typescript
const db = new Dexie('AIBookmarks');
db.version(1).stores({
  collections: 'id, title, createdAt, updatedAt',
  savedAnswers: 'id, collectionId, conversationId, messageId, savedAt, [collectionId+conversationId+messageId]',
});
```

**Methods:**

`async listCollections(): Promise<Collection[]>`
- Returns all collections ordered by `updatedAt` descending
- Used to populate the collection selector and the Saved view

`async getCollection(id: string): Promise<Collection | null>`
- Returns a single collection by ID

`async createCollection(title: string): Promise<Collection>`
- Generates UUID, creates collection record
- Returns: `{ id, title, createdAt: Date.now(), updatedAt: Date.now() }`

`async saveAnswer(params: { entry: MessageEntry; title: string; collectionId?: string; newCollectionTitle?: string }): Promise<SavedAnswer>`
- If `collectionId` provided: use it
- Else if `newCollectionTitle` provided: create collection first, use new ID
- Check for duplicate using compound index `[collectionId+conversationId+messageId]`
- If duplicate found: throw `DuplicateError`
- Extract full answer text from `entry` (content script already sent it via `MessageEntry`)
- Generate UUID for saved answer
- Write to `savedAnswers` table
- Update collection's `updatedAt`
- Return saved answer record

`async getAnswersByCollection(collectionId: string): Promise<SavedAnswer[]>`
- Returns all saved answers in a collection, ordered by `savedAt` descending

`async deleteAnswer(id: string): Promise<void>`
- Delete saved answer by ID
- Update parent collection's `updatedAt`

`async deleteCollection(id: string): Promise<void>`
- Delete collection and all its saved answers (cascade)

PRD ref: `bookmark-feature-prd.md > Data Saved Locally`.

### BookmarkService
`src/panel/components/SavedViewsModal.tsx`

Modal rendered via React Portal. Opens when "Saved Views" button in header is clicked. Provides three-level navigation without leaving the outline view.

**State:**
- `view: 'collections' | 'answers' | 'detail'`
- `collections: Collection[]`
- `selectedCollection: Collection | null`
- `answers: SavedAnswer[]`
- `selectedAnswer: SavedAnswer | null`

**Level 1: Collections view**
- Header: "Saved Collections" + close button (X)
- List of collection cards, each showing:
  - Collection title
  - Answer count
  - Last updated timestamp
  - Click to view answers
- Empty state: "No saved collections yet. Bookmark an answer to get started."

**Level 2: Answers view**
- Header: back button (←) + collection title + close button (X)
- List of saved answer cards, each showing:
  - Answer title
  - Preview (first ~120 chars of content)
  - Save timestamp
  - Click to view detail
- Empty state: "No saved answers in this collection yet."

**Level 3: Detail view**
- Header: back button (←) + answer title + close button (X)
- Full answer content (scrollable)
- Metadata: saved timestamp, source conversation (if available)
- Actions:
  - "Go to source" button (if source conversation is open and message can be resolved)
  - Delete button (with confirmation)
- Click "Go to source" → resolve source message via `MessageIdentityService`, send `NAVIGATE_TO` to content script, close modal

**Navigation:**
- Back button: Detail → Answers → Collections
- Close (X): Close modal from any level
- Click outside modal backdrop: Close modal

PRD ref: `bookmark-feature-prd.md > Saved Collection View`.

### Header (update)
`src/panel/components/Header.tsx`

Update to add "Saved Views" button next to the existing "Load Chat" button.

**Current layout:**
```
[AI Chat Organizer]                    [↻ Load Chat]
```

**New layout:**
```
[AI Chat Organizer]     [↻ Load Chat] [📁 Saved Views]
```

**Props additions:**
- `onOpenSavedViews: () => void` — callback when Saved Views button clicked

**Button styling:**
- Same style as Load Chat button
- Icon: 📁 or 🔖
- Label: "Saved Views"
- Hover state matches existing buttons

PRD ref: `bookmark-feature-prd.md > Saved Collection View`.

### PanelApp (update)
`src/panel/PanelApp.tsx`

Add state for managing `SavedViewsModal` visibility:
- `isSavedViewsOpen: boolean`
- Pass `onOpenSavedViews={() => setIsSavedViewsOpen(true)}` to Header
- Render `SavedViewsModal` when `isSavedViewsOpen === true`
- Close modal on backdrop click or close button

No tab navigation needed — modal overlays the existing outline view.

Fixed-position notification component:
- Shows at bottom-right of panel
- Auto-dismisses after 3 seconds
- Queue multiple toasts vertically if needed
- Simple slide-in animation

Props:
- `message: string`
- `type: 'success' | 'error'`
- `onDismiss: () => void`

## Data Model Additions

### Collection
```typescript
interface Collection {
  id: string;               // UUID
  title: string;            // user-defined, e.g. "Database Design"
  createdAt: number;        // timestamp
  updatedAt: number;        // timestamp (updated when answers added/removed)
}
```

### SavedAnswer
```typescript
interface SavedAnswer {
  id: string;                   // UUID
  collectionId: string;         // foreign key to Collection
  title: string;                // user-editable answer title
  content: string;              // full answer text
  conversationId: string | null; // from conversationKey() when saved
  messageId: string | null;     // from MessageEntry.id when saved
  savedAt: number;              // timestamp
}
```

### DuplicateError
```typescript
class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateError';
  }
}
```

## File Structure Additions

```
ai-chat-organizer/
├── src/
│   └── panel/
│       ├── services/
│       │   ├── BookmarkService.ts        # IndexedDB operations via Dexie
│       │   └── ExportService.ts          # Export to MD/JSON/TXT
│       └── components/
│           ├── BookmarkButton.tsx         # Bookmark icon on assistant answer rows only
│           ├── SaveBookmarkModal.tsx      # Modal for saving answers
│           ├── SavedViewsModal.tsx        # Modal for browsing collections + answers
│           └── Toast.tsx                  # Notification component
└── package.json                           # Add dexie dependency
```

## Persistence and Privacy

**Storage mechanism:** IndexedDB via Dexie.js
- Database name: `AIBookmarks`
- Stored per Chrome profile
- Persists across browser restarts
- No size limit (unlike localStorage's 5MB)
- No expiration (unlike session storage)

**What gets stored:**
- Collection metadata (title, timestamps)
- Full answer text (not just preview)
- Source conversation ID (for "Go to source" resolution)
- Source message ID (for duplicate detection)

**What does NOT get stored:**
- User messages (only ChatGPT answers are bookmarkable)
- ChatGPT's internal message IDs (we use our local MessageEntry.id)
- Any data sent to external services (all operations are local)

**Browser storage location:**
- Chrome profile directory: `IndexedDB/chrome-extension_{extension-id}_0.indexeddb.leveldb/`
- User can clear via Chrome Settings → Privacy → Clear browsing data → Cookies and site data

PRD ref: `bookmark-feature-prd.md > Persistence and Privacy`.

## Important Failure Modes

**Modal validation:**
- Blank answer title → Save button disabled, inline error shown
- Blank new collection title → Save button disabled, inline error shown
- Duplicate collection name (normalized) → Show warning "A collection named '{title}' already exists. Select it instead or choose a different name."

**Duplicate detection:**
- Same answer saved to same collection → `BookmarkService.saveAnswer()` throws `DuplicateError`, modal catches it and shows: "This answer is already saved in {collectionTitle}."
- Same answer saved to different collection → Allowed (intentional)

**Source resolution:**
- Original conversation closed → "Go to source" button hidden, saved content still readable
- Message no longer in DOM (deleted/regenerated) → "Go to source" shows "Source unavailable"
- `conversationId` or `messageId` missing → "Go to source" hidden

**IndexedDB failures:**
- Write failure (disk full, corrupted DB) → Modal shows error: "Could not save. Please try again."
- Read failure → Saved view shows: "Could not load collections. Try reloading the panel."

**Concurrent saves:**
- Multiple tabs with panel open → IndexedDB transactions handle this automatically (ACID guarantees)
- No explicit locking needed

## What Was Simplified and Why

**Answer title suggestion algorithm:**
- Uses first sentence of answer preview (max 60 chars)
- Fallback: first 60 chars if no sentence boundary found
- Does NOT use AI or NLP to generate semantic titles
- Rationale: Keep it deterministic and fast; user can edit if needed

**Collection organization:**
- Flat list of collections, no folders or hierarchy
- No tags, no color coding
- Rationale: Simple MVP; can add layers later

**Duplicate detection:**
- Uses `conversationId + messageId` compound index
- Does NOT use content fingerprint comparison (already available in identity service but not needed here)
- Rationale: Source identity is more reliable than text comparison for detecting true duplicates

**Search:**
- Not included in bookmark feature v1
- Rationale: Need collections and saving to work reliably first

**Export:**
- Not included in bookmark feature v1
- Can export individual saved answers via copy/paste
- Rationale: Defer until usage patterns emerge

**Sync across devices:**
- Not included
- All data is local to the Chrome profile
- Rationale: Requires backend or Chrome sync API integration, out of scope

## Decisions and Open Questions

**Decisions made:**

- **Dexie.js for IndexedDB** — much cleaner than raw IndexedDB API; promise-based, schema versioning included, TypeScript support
- **UUID for IDs** — `crypto.randomUUID()` is built-in, secure, no collision risk
- **Save full answer text, not DOM reference** — essential for durability when original conversation closes
- **"Go to source" as optional action** — saved content remains readable even when source is unavailable
- **Saved view as panel tab, not separate page** — keeps user in the same context, easier navigation
- **First sentence for title suggestion** — semantic without requiring AI; 60 char max keeps it readable
- **Block duplicate saves with error message** — prevents clutter, user gets clear feedback

**Open questions resolved:**

1. **Saved view placement?** → Same side panel, tab toggle with Outline view
2. **Rename/delete in v1?** → Yes, include basic delete operations (delete answer, delete collection with confirmation)
3. **Block or warn on duplicate?** → Block with clear error message
4. **Title suggestion algorithm?** → First sentence, max 60 chars, fallback to first 60 chars

**Implementation notes:**

- **Message content extraction:** The panel already receives `MessageEntry.preview` (truncated). For bookmarks, we need full text. Two options:
  1. Extend `MessageEntry` to include full `content` field (sent by content script)
  2. Send `GET_FULL_CONTENT` message to content script when saving
  → **Decision:** Option 1 is simpler and avoids round-trip delay. Extend `MessageEntry` interface.

- **Modal rendering:** Use React Portal to render modal at document root level, avoiding z-index issues with side panel container.

- **Toast positioning:** Fixed at `bottom: 16px; right: 16px;` within side panel viewport. Stack multiple toasts vertically.

## Build Slices (to be added to checklist.md)

### Slice 5: Bookmark persistence — save answers to IndexedDB

**Becomes usable:** User clicks bookmark button on an answer → modal opens with suggested title → user creates a collection → clicks Save → answer is persisted to IndexedDB and modal shows success toast.

**Why now:** Core bookmark feature. Must work before building the Saved view.

**PRD ref:** `bookmark-feature-prd.md > Save Bookmark Modal`, `bookmark-feature-prd.md > Entry Point`

**Build:**
- Install and configure Dexie.js
- Implement `BookmarkService` with schema, `createCollection`, `saveAnswer`, duplicate detection
- Implement `BookmarkButton` component (rendered on assistant entries)
- Implement `SaveBookmarkModal` with title editing, collection selection, "Create new collection" flow
- Implement `Toast` notification component
- Wire bookmark button to modal, modal Save to `BookmarkService`

**Verify (mechanical):**
- Open panel, click bookmark on an answer → modal opens with pre-filled title
- Create collection "Test Collection" → Save → toast shows "Saved to Test Collection"
- Open DevTools → Application → IndexedDB → AIBookmarks → verify collection and saved answer records exist
- Click bookmark on same answer → Save to same collection → shows duplicate error
- Click bookmark on different answer → Save to "Test Collection" → succeeds, second answer in same collection

**Learner check:** Bookmark 3 different answers into a new collection, then check IndexedDB to confirm all records persisted correctly.

**Commit:** `Slice 5: bookmark persistence with IndexedDB and save modal`

### Slice 6: Saved view — browse collections and answers

**Becomes usable:** User switches to "Saved" tab → sees list of collections → clicks a collection → sees saved answers → clicks an answer → views full content. Can delete answers and collections.

**Why now:** Saved bookmarks are only useful if you can view them later.

**PRD ref:** `bookmark-feature-prd.md > Saved Collection View`

**Build:**
- Add tab navigation to `PanelApp` ("Outline" | "Saved")
- Implement `SavedView` with three levels: collection list → answer list → answer detail
- Wire `BookmarkService.listCollections()`, `getAnswersByCollection()`
- Implement delete operations (answer, collection)
- Add empty states for no collections / no answers

**Verify (mechanical):**
- Switch to Saved tab → verify collections from Slice 5 appear
- Click collection → verify saved answers appear with correct titles
- Click answer → verify full content displays
- Delete answer → verify it's removed from list and IndexedDB
- Delete collection → verify confirmation prompt, then collection and all answers removed

**Learner check:** Save 3 answers across 2 collections, switch to Saved view, navigate through collections and answers, then delete one answer and one collection to confirm everything updates correctly.

**Commit:** `Slice 6: saved view with collection and answer browsing`

### Slice 7: Go to source — navigate from saved answer to original message

**Becomes usable:** User views a saved answer while the source conversation is open → "Go to source" button appears → clicking it navigates to the original message in the ChatGPT page and switches back to Outline tab.

**Why now:** Completes the bookmark feature. Users can jump from saved knowledge back to its context.

**PRD ref:** `bookmark-feature-prd.md > Saved Collection View`

**Build:**
- In `SavedView` answer detail: detect if `conversationId` matches current conversation
- If yes: resolve `messageId` via `MessageIdentityService`, show "Go to source" button
- On click: send `NAVIGATE_TO` to content script, switch to Outline tab, highlight message as usual
- If resolution fails: show "Source unavailable"

**Verify (mechanical):**
- Save an answer from conversation A
- Switch to Saved view → open the saved answer → "Go to source" button appears
- Click button → verify navigation to original message and panel switches to Outline tab
- Close conversation A, open conversation B, view same saved answer → "Go to source" hidden
- Reopen conversation A, view saved answer → "Go to source" reappears

**Learner check:** Bookmark an answer, switch to Saved tab, view the answer, click "Go to source" — confirm it jumps to the exact message and returns you to the Outline view.

**Commit:** `Slice 7: go to source navigation from saved answers`

---

**Total estimated build time:** 10-14 hours (depending on familiarity with IndexedDB and React Portals)
- Slice 5: 4-5 hours (Dexie setup, modal, validation, duplicate handling)
- Slice 6: 3-4 hours (three-level view, delete operations)
- Slice 7: 1-2 hours (source resolution, modal closing)
- Slice 8: 2-3 hours (export service, three formats, download handling)

**Dependencies:** Requires Slices 1-4 (outline extraction and navigation) to be complete.
