---
doc: prd
status: approved
---

# AI Chat Organizer — Product Requirements

A Chrome extension for anyone who uses ChatGPT regularly: it turns a long, linear conversation into a clickable, navigable outline in a persistent side panel, so users can jump directly to any message without scrolling.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey

1. The user is on a ChatGPT conversation page — any length, any topic.
2. They open the AI Chat Organizer side panel (via the Chrome side panel button or extension icon).
3. The panel appears immediately with a loading state: the extension name at the top, a status line reading "Reading conversation…", and a subtle animation. The ChatGPT conversation remains fully visible and usable.
4. As extraction progresses, outline entries begin appearing in the panel in chronological order — user questions first, then AI responses, as each is identified.
5. Entries that can be navigated to are clickable as soon as they appear. The status indicator remains visible until extraction is complete.
6. When extraction finishes, the status indicator clears (or shows "Ready") and all entries are clickable.
7. The user scans the outline, finds a question or response they want to revisit, and clicks its row.
8. The main ChatGPT window scrolls directly to the corresponding original message. The message receives a brief highlight (a background flash or thin border that fades within ~1 second), confirming the correct destination.
9. The selected row in the panel receives a subtle selected state while the user is at that location.
10. The user clicks another entry and repeats the process — no scrolling, no browser search.
11. The user sends a new message. A new outline entry appears at the bottom of the panel for the question. While ChatGPT is generating its response, an in-progress entry appears showing that a response is being written. When the response is complete, the entry becomes a normal clickable row.
12. New entries appear at the bottom. If the user was already scrolled to the bottom of the panel (within ~50px), the panel auto-scrolls to keep the newest entry visible. If the user has scrolled up to read earlier entries, their position is preserved.

Success: the user identified a specific question in a conversation with hundreds of messages, clicked it, and the main window finished scrolling to the exact message within two seconds of the click — with no manual scrolling required. Timing is measured from the click on the outline row to the target message being visible and highlighted in the main window.

Source: `scope.md > What "Working" Looks Like`, `scope.md > The Core Loop`.

## Screens and Layout

**One surface: the Chrome side panel.**

The side panel is persistent — it stays open as the user interacts with ChatGPT. It does not replace or overlay the main conversation area.

Layout (top to bottom):
- **Header bar**: Extension name ("AI Chat Organizer") on the left. Extraction status indicator on the right (or inline below the name).
- **Outline list**: A scrollable vertical list of message entries, chronological from top to bottom. Each entry is a compact clickable row.
- No footer, settings panel, search bar, or additional controls in this proof of concept.

The outline list takes up the full remaining height of the panel below the header.

Source: `scope.md > The POC Boundary`.

## Look and Feel

Follows the user's active ChatGPT theme (light or dark) automatically. Theme detection uses a reliable signal — such as the `data-theme` attribute on the document root, the `prefers-color-scheme` media query, or a combination — and does not depend on ChatGPT's internal CSS class names.

**Light mode**: white or near-white background, dark text, subtle gray dividers between entries, restrained accent color for selected and hover states.

**Dark mode**: dark charcoal background (#1e1e1e or similar), light text, slightly lighter surfaces for hover and selected states.

**Typography**: compact, readable, system font or a clean sans-serif. Consistent spacing. No gradients, decorative cards, or unnecessary visual weight.

**Entry differentiation**: user questions and AI responses are distinguished by a small icon and a label ("You" / "ChatGPT"), not by different background colors for every row.

**Overall feel**: native browser feature — like a document outline in a word processor. Unobtrusive, minimal, always available. The conversation stays front and center.

Source: `scope.md > Inspiration & Identity`.

## Features and Behavior

### Conversation Extraction

The extension reads the currently open ChatGPT conversation and identifies every user prompt and every AI response as a separate message entry.

- Each entry captures: speaker identity (user or AI), a short text preview (enough to identify the message, truncated if necessary), and a reference sufficient to navigate back to the original DOM element.
- Extraction begins automatically when the side panel opens on a supported page.
- Entries appear in the outline progressively as they are identified — the panel does not wait for the full conversation to be processed before showing results.
- Extraction must handle long conversations (hundreds of messages) without blocking the page or degrading ChatGPT's responsiveness.

Acceptance criteria:
- [ ] All user prompts and AI responses in the open conversation appear in the outline in chronological order.
- [ ] Each entry shows the correct speaker label and a readable preview of the message text.
- [ ] Extraction of a long conversation does not visibly slow down or freeze the ChatGPT page.

### Outline Display

The side panel displays extracted entries as a scrollable vertical list.

Each row contains:
1. A small speaker icon (user icon for "You", AI icon for "ChatGPT").
2. A speaker label ("You" or "ChatGPT").
3. A one-to-two line text preview of the message, truncated with an ellipsis if longer.

Rows are ordered chronologically — the first message at the top, the most recent at the bottom.

Acceptance criteria:
- [ ] Every extracted message appears as its own row — one row per message, not one row per turn.
- [ ] Rows are in the same order as the original conversation.
- [ ] Each row correctly identifies the speaker and shows a readable preview.
- [ ] The outline is scrollable and handles a large number of entries without layout issues.

### Click-to-Navigate

Clicking a row in the outline scrolls the main ChatGPT window to the corresponding original message and brings it into view.

- The target message receives a brief visual highlight (background flash or thin border) that fades within approximately one second.
- The clicked row in the panel receives a subtle selected state.
- Navigation does not reload the page, open a new tab, or disrupt the side panel.
- If the extension cannot confidently identify or locate the original message, the row shows a clear unavailable or failed state instead of navigating to an incorrect location.

Acceptance criteria:
- [ ] Clicking a row scrolls the main window to the exact corresponding message.
- [ ] The target message is briefly highlighted so the user can immediately recognize it.
- [ ] The selected row in the panel reflects the current navigation location.
- [ ] A row whose original message cannot be located shows a clear failed/unavailable state and does not navigate to a wrong message.
- [ ] The side panel remains open and functional after navigation.

### Dynamic Updates

The outline updates automatically as the conversation continues — no manual refresh required.

- When the user sends a new message, a new entry appears at the bottom of the outline.
- While ChatGPT is generating a response, an in-progress entry appears for that response (e.g., a subtle animated indicator with the label "ChatGPT is responding…"). The in-progress entry is not clickable.
- When the response is complete, the in-progress entry becomes a normal clickable row with the response preview.
- Updates are incremental: existing entries remain in place and the panel does not rebuild from scratch unnecessarily.
- The panel does not duplicate entries or lose previously extracted messages during an update.
- New entries appear at the bottom without changing the user's current scroll position in the panel. Exception: if the user is already scrolled to the bottom of the panel (within ~50px of the end), the panel auto-scrolls to keep the newest entry visible — matching the behavior of chat interfaces like Slack.
- If the extension detects it has missed a message or cannot reconcile the conversation reliably, it shows an "Outline may be incomplete" status instead of silently showing incorrect results.

Acceptance criteria:
- [ ] A new user message appears in the outline immediately after it is sent.
- [ ] An in-progress indicator appears while ChatGPT is generating a response.
- [ ] The completed response appears as a clickable row once generation finishes.
- [ ] Existing entries are not duplicated or removed during an incremental update.
- [ ] The user's current scroll position in the panel is preserved when new entries are added, unless the user was already at the bottom of the panel, in which case the panel auto-scrolls to show the newest entry.
- [ ] Navigation works correctly for both old and newly added entries.

### Extraction Status

The panel provides honest, visible status throughout — never presenting partial results as complete or silently failing.

States:
- **Waiting**: "Waiting for conversation…" — the panel is open but no conversation has been detected yet (page still loading, or not on a conversation URL).
- **Reading**: "Reading conversation…" with a subtle animation — extraction is in progress.
- **Ready**: status clears or shows a brief "Ready" indicator — extraction is complete and all entries are navigable.
- **Incomplete**: "Outline may be incomplete" — extraction finished but some messages could not be reliably identified. Existing entries remain clickable.
- **In-progress response**: an animated indicator in the outline list showing that ChatGPT is currently generating a response.
- **Navigation failed**: individual row shows a failed/unavailable state when its original message cannot be located.

Acceptance criteria:
- [ ] The correct status is shown at each stage of extraction.
- [ ] The user is never shown a "complete" state when extraction is still running or has partially failed.
- [ ] Individual navigation failures are shown per-row, not as a global error that disables the whole panel.

## States and Boundaries

- **First open (page loading)**: panel shows "Waiting for conversation…" until a conversation is detected.
- **Extraction in progress**: entries appear progressively; status indicator is visible; already-extracted entries are clickable.
- **Extraction complete**: all entries are clickable; status clears.
- **Extraction incomplete**: entries that were identified are clickable; a persistent "Outline may be incomplete" notice is shown.
- **ChatGPT generating a response**: an in-progress row appears at the bottom of the outline; it becomes a normal row when the response is complete.
- **Navigation success**: main window scrolls to the correct message; brief highlight; row shows selected state.
- **Navigation failure**: the row shows a clear unavailable state; main window does not scroll to an incorrect location.
- **Panel closed and reopened**: extraction restarts for the current conversation. No persistence between sessions in the PoC.
- **User navigates to a different conversation**: the outline clears and extraction restarts for the new conversation.
- **Unsupported page**: the panel shows a message indicating that the extension only works on ChatGPT conversation pages.

## Product Decisions

- **One row per message** (not one row per turn) — makes individual responses directly navigable and keeps the outline's relationship to the original conversation clear and predictable.
- **Progressive extraction** — entries appear as they are identified rather than waiting for the full conversation, so users of very long conversations see results immediately.
- **Panel scroll on new entries** — auto-scroll to the newest entry only when the user is already at the bottom of the panel (within ~50px). If the user has scrolled up to read earlier entries, their position is preserved. This matches the behavior of chat interfaces like Slack and iMessage.
- **In-progress entry for streaming responses** — streaming content is not treated as a finished answer; the entry becomes clickable only when the response is complete.
- **Theme follows ChatGPT, not internal CSS** — detection uses a reliable public signal (e.g., `data-theme` attribute or `prefers-color-scheme`) to avoid breaking when ChatGPT changes its internal styling.
- **Navigation failure is explicit per-row** — the extension never silently navigates to a wrong message; a failed row shows a clear state and does nothing.
- **No memory between sessions** — the panel rebuilds from the live page each time it opens; IndexedDB persistence is deferred.

## What We're Building

- Chrome extension with a persistent side panel active on ChatGPT conversation pages.
- Automatic extraction of user prompts and AI responses into a chronological outline.
- One-row-per-message outline display with speaker identity and message preview.
- Click-to-navigate: scroll the main window to the original message with a brief highlight.
- Progressive extraction with live status indicators.
- Incremental dynamic updates as new messages are sent and received.
- Honest extraction status at every stage (waiting, reading, ready, incomplete).
- Light and dark theme support following the user's ChatGPT theme.

## Deferred From the POC

- **Local search** — searching extracted message text within the conversation. Requires a local index; deferred until the outline is reliable.
- **IndexedDB persistence** — saving conversation data between sessions. The PoC keeps data in memory only; persistence is the next layer after the outline works.
- **Export** — Markdown, JSON, and copy-ready context prompt generation. Useful but does not prove the navigation kernel.
- **Basic non-AI summary** — deferred with export; no external API in any version.
- **Bookmarks** — saving individual messages for later reference. Post-MVP organizational feature.
- **Topic grouping and timelines** — higher-order organizational views. Post-MVP.
- **Multi-platform support** — Claude, Gemini, and other AI sites. The adapter architecture will be built to support expansion, but only the ChatGPT adapter ships in the PoC.

## Non-Goals

- **No external transmission** — conversation content is never sent to a server, API, or third-party service. Local only, always.
- **No AI integration in the PoC** — no summarization, no embeddings, no API keys required.
- **No accounts or authentication** — the extension has no user accounts, login, or cloud sync.
- **No replacement of ChatGPT's UI** — the extension adds a panel; it does not modify, override, or inject into ChatGPT's own interface elements.
- **No support for other browsers** — Chrome only for this PoC. Firefox or Edge compatibility is not a goal.

## Open Questions

- **Exact streaming indicator attribute**: the combination detection approach is decided (`spec.md > Decisions and Open Issues`), but the specific `data-*` attribute or element ChatGPT uses as its streaming indicator must be verified against the live page during the first build slice. If it turns out to be a CSS class rather than a data attribute, weight the fingerprint fallback more heavily. *(Verify in build, slice 1.)*
- **`data-message-id` availability**: verify during the first extraction slice whether ChatGPT currently exposes this attribute on message elements and on which element in the hierarchy. This determines how much of the identity work relies on the fallback path. *(Verify in build, slice 1.)*
