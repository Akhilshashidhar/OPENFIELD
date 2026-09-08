# OpenField — AI Video Editor Rebuild: Spec Index

> **Goal:** Rebuild OpenField as a full-featured, AI-powered, browser-based video editor.  
> **Competitors:** Cardboard.ai, InVideo.io  
> **License:** MIT (open source, self-hostable)  
> **Stack:** TanStack Start + React 19 + Zustand + Konva.js + FFmpeg.wasm + Elysia + Cloudflare (D1, R2, KV, Queues, Durable Objects)

---

## Spec Documents

| File | Contents |
|---|---|
| [`01-product-vision.md`](./01-product-vision.md) | Product vision, personas, full feature set checklist, tech stack decisions, app architecture, editor data model, rendering pipeline, AI pipeline, competitive differentiators |
| [`02-phase1-core-editor.md`](./02-phase1-core-editor.md) | **Phase 1** — 14 tasks: Auth, Dashboard, Editor shell, Zustand store, Media panel, Preview canvas, Timeline, Inspector, Text overlays, Transitions, FFmpeg.wasm export, Auto-save, Keyboard shortcuts |
| [`03-phase2-ai-features.md`](./03-phase2-ai-features.md) | **Phase 2** — 15 tasks: AI job architecture, Transcription (Whisper), Captions, Silence removal, Smart reframe, Caption translation, Voice cleanup, Audio ducking, Beat sync, Color grading, AI Director (Claude), Voice dubbing, Script-to-video, B-roll suggestions, Background removal |
| [`04-phase3-templates-polish.md`](./04-phase3-templates-polish.md) | **Phase 3** — 11 tasks: Template system, Template gallery, Template wizard, Brand kit, Export presets, Real-time collaboration (Yjs + Durable Objects), Plans & billing (Stripe), Landing page, Performance optimization, Onboarding & UX polish, Community templates |
| [`05-database-and-api.md`](./05-database-and-api.md) | Full D1 schema (13 tables), R2 storage layout, KV namespaces, complete REST API design (11 route groups), error format, Elysia file structure, wrangler.jsonc bindings, env vars, migration strategy |

---

## Build Order Summary

```
Phase 1 (8–12 weeks) ──► Phase 2 (8–10 weeks) ──► Phase 3 (6–8 weeks)
   Core Editor                AI Features              Templates + Polish
       ↓                           ↓                          ↓
 Import / Timeline          Captions / Silence        Template Gallery
 Preview / Export           AI Director               Collaboration
 Auth / Dashboard           Smart Reframe             Billing / Launch
```

**Total to public launch: ~6–8 months**

---

## Quick Reference: Key Tech Decisions

| Concern | Solution |
|---|---|
| Editor state | Zustand with immer + undo/redo middleware |
| Canvas rendering | Konva.js + WebCodecs VideoDecoder |
| In-browser export | FFmpeg.wasm (`@ffmpeg/ffmpeg`) |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Auth | Better-Auth (edge-compatible, OAuth) |
| Database | Cloudflare D1 (SQLite) |
| File storage | Cloudflare R2 |
| AI jobs queue | Cloudflare Queues |
| Real-time collab | Yjs CRDTs + Cloudflare Durable Objects |
| AI captions | OpenAI Whisper API |
| AI Director | Anthropic Claude API |
| AI video models | Fal.ai (project sponsor) |
| Voice dubbing | ElevenLabs API |
| Face/subject tracking | MediaPipe WASM (in-browser, free) |
| Payments | Stripe |
| Timeline virtualization | `@tanstack/react-virtual` |
| Stock footage | Pexels + Pixabay APIs (proxied) |

---

## Phase 1 Task Quick Reference

| Task | What |
|---|---|
| 1.1 | Project setup + new dependencies |
| 1.2 | Authentication (Better-Auth, email + Google) |
| 1.3 | Dashboard (project list, create/delete) |
| 1.4 | Editor route + 4-panel layout shell |
| 1.5 | Zustand editor store (6 slices + undo middleware) |
| 1.6 | Media browser panel (upload → R2, thumbnails) |
| 1.7 | Preview canvas (WebCodecs + Konva compositing) |
| 1.8 | Timeline (tracks, clips, drag, trim, split, waveform) |
| 1.9 | Inspector panel (clip properties, color correction) |
| 1.10 | Text/title overlay clips |
| 1.11 | Transitions (crossfade, dip to black) |
| 1.12 | Export (FFmpeg.wasm → MP4) |
| 1.13 | Project auto-save + persistence |
| 1.14 | Keyboard shortcuts (J/K/L, Ctrl+K, etc.) |

---

## Phase 2 Task Quick Reference

| Task | What |
|---|---|
| 2.1 | AI panel UI (drawer with job status indicators) |
| 2.2 | Whisper transcription (word-level timestamps) |
| 2.3 | Auto-captions (6 cinematic styles + word highlight) |
| 2.4 | Silence + filler word removal (cut list review) |
| 2.5 | Smart reframe (MediaPipe face tracking) |
| 2.6 | Caption translation (Claude/GPT, 90+ languages) |
| 2.7 | Voice cleanup (ElevenLabs noise removal) |
| 2.8 | Audio ducking (Web Audio API, client-side) |
| 2.9 | Beat sync (BPM detection, beat markers on timeline) |
| 2.10 | AI color grading (consistent look across clips) |
| 2.11 | AI Director (NLP prompt → edit plan → apply) |
| 2.12 | Voice dubbing (ElevenLabs multilingual) |
| 2.13 | Script-to-video (semantic clip search + assembly) |
| 2.14 | B-roll suggestions (Pexels/Pixabay via transcript) |
| 2.15 | Background removal (MediaPipe segmentation) |

---

## Phase 3 Task Quick Reference

| Task | What |
|---|---|
| 3.1 | Template data model + API + R2 storage |
| 3.2 | Template gallery page (browse, filter, preview) |
| 3.3 | Template setup wizard (fill placeholders) |
| 3.4 | Brand kit (logo, colors, fonts) |
| 3.5 | Export presets (YT, TikTok, Reels, Twitter) |
| 3.6 | Real-time collaboration (Yjs + Durable Objects) |
| 3.7 | Plans + billing (Stripe, Free/Pro limits) |
| 3.8 | Landing page (marketing site) |
| 3.9 | Performance optimization (virtualization, frame cache) |
| 3.10 | Onboarding + UX polish |
| 3.11 | Community template submissions |

---

## Start Here

When beginning implementation, start with Phase 1 in task order:

```bash
# Install dependencies first (Task 1.1)
cd apps/web
bun add zustand @ffmpeg/ffmpeg @ffmpeg/util konva react-konva @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities motion

cd ../api
bun add better-auth @better-auth/cli
```

Then follow the build order in `02-phase1-core-editor.md` top to bottom.  
**Do not start Phase 2 until Phase 1 acceptance criteria are all met.**
