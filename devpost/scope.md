---
doc: scope
status: approved
---

# AI Chat Organizer

A Chrome extension that turns a long ChatGPT conversation into a clickable, navigable outline — without leaving the page or sending anything to an external service.

## The Unique Kernel
A persistent side panel that extracts every question and response from the currently open ChatGPT conversation and lets you click any entry to jump directly to that exact message. Not a search tool, not a summary — a live, clickable map of the conversation you're already in.

## Who It's For
Developers, students, researchers, and writers who have long, valuable AI conversations and currently have no way to navigate them except scrolling or browser search. They've had a conversation with hundreds of messages and spent real time finding something they know is in there somewhere.

## The Core Loop
Open a long ChatGPT conversation → the side panel automatically populates with a readable outline of every question and response → click an entry → land directly on that message in the original conversation. Come back any time to jump to a different point without losing your place.

## Inspiration & Identity
Lightweight and native-feeling — like a browser feature that was always supposed to be there, not a dashboard bolted on top. Clean, minimal, unobtrusive. The conversation stays front and center; the panel is a quiet navigator beside it. Think document outline in a word processor, or a table of contents that knows where you are.

## Why This Matters to the Learner
"Conversations with AI shouldn't be disposable. People spend a lot of time discussing ideas, debugging code, researching topics, learning new things — but there isn't always a good way to revisit, organize, and reuse that information." Built from a real personal pain point: important knowledge buried in long conversations with no way to find it again.

## What "Working" Looks Like
Load a ChatGPT conversation with hundreds of messages. The side panel is open and automatically shows a chronological outline — user questions and AI responses, readable enough to identify each one. Click any entry. The main window jumps directly to the correct original message and brings it into view. Click another entry. Land somewhere else. No scrolling. If extraction is incomplete or the conversation is still loading, the panel shows a clear status rather than silently pretending it worked.

The "oh, that's cool" beat: opening a conversation you've been scrolling through for weeks and immediately seeing its entire structure — then clicking straight to what you were looking for.

## The POC Boundary
- Chrome extension with a persistent side panel on ChatGPT
- Extract user prompts and AI responses from the currently open conversation
- Display a clickable, chronological outline in the side panel
- Click-to-navigate: scroll the main window to the correct original message
- Incremental updates: detect conversation changes and reconcile without full rebuilds
- Extraction status indicator: show incomplete or in-progress state clearly
- Local only: no external transmission, no API dependency

## Later
- Local search within the current conversation
- Save conversations to IndexedDB with configurable retention
- Export: Markdown, JSON, copy-ready context prompt
- Basic non-AI summary
- Bookmarks and topic grouping
- Support for Claude, Gemini, and other AI platforms
- Timeline and organizational views

## Explicitly Cut
- **Search** — the kernel is navigation, not search. Navigation must work reliably first.
- **Export** — useful, but doesn't prove the core idea. Deferred to after the outline works.
- **AI summaries** — explicitly out of scope for the entire MVP; no external API in v1.
- **IndexedDB persistence** — conversation data lives only in memory for the PoC; persistence is a later layer.
- **Multi-platform support** — ChatGPT only for now. The adapter boundary will be built correctly so Claude and Gemini can be added without rework, but only ChatGPT ships in the PoC.
- **Bookmarks and topic grouping** — post-MVP organizational features.
- **Deployment** — local extension only; no hosted service required or planned for the PoC.
