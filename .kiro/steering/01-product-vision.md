# OpenField — Product Vision & Architecture Spec

> **Status:** Active rewrite  
> **License:** MIT  
> **Target:** Compete with Cardboard.ai, InVideo.io — as a free, open-source, AI-powered web video editor  
> **Audience:** Creators, marketers, indie filmmakers, developers who want full control

---

## 1. What We're Building

OpenField is being rebuilt as a **full-featured, AI-powered, browser-based video editor** — free and open source. The goal is to deliver everything Cardboard.ai offers (agentic editing, smart captions, silence removal, reframing, collaboration) plus a rich **template system** (like InVideo), while remaining open source and self-hostable.

### Core Identity
- **Open source first** — MIT licensed, self-hostable, no lock-in
- **AI-native** — AI is not an add-on; it's woven into the editing workflow
- **Browser-first** — no install required, runs on WebGPU + WebCodecs
- **Templates-first** — rich template library for social content, ads, intros, testimonials
- **Developer-friendly** — plugin system, Editor API, MCP server, headless mode (planned)

### Who We Beat On
| Competitor | Our Edge |
|---|---|
| Cardboard.ai | Open source, templates, cheaper/free tier, manual editing power |
| InVideo.io | Better editor control, open source, self-hostable |
| CapCut | No data harvesting, web-native, developer API |
| DaVinci Resolve | Browser-based, no install, AI-native |

---

## 2. User Personas

### Primary — The Solo Creator
- YouTubers, TikTokers, Instagram Reels creators
- Wants: fast turnaround, captions, reframing, templates
- Pain: complex NLEs (Premiere, DaVinci) are overkill

### Secondary — Marketing Teams
- Social ad creation, product videos, testimonial cuts
- Wants: templates, brand kit, team collaboration, export presets
- Pain: expensive tools, slow iteration

### Tertiary — Developers / Self-hosters
- Want an open video editor they control, can extend, can embed
- Wants: plugin API, headless rendering, MCP integration
- Pain: no good open-source browser editor exists

---

## 3. Feature Set (Full Target)

### 3.1 Core Editor
- [ ] Multi-track timeline (video, audio, text, effects tracks)
- [ ] Media browser (import, organize, preview clips)
- [ ] Canvas preview with real-time playback
- [ ] Clip operations: trim, split, delete, duplicate, reorder
- [ ] Drag & drop clip placement on timeline
- [ ] Undo / redo (full history stack)
- [ ] Keyboard shortcuts (J/K/L playback, I/O in-out points, etc.)
- [ ] Snapping (clip-to-clip, clip-to-playhead)
- [ ] Zoom in/out on timeline
- [ ] Multi-select clips
- [ ] Clip properties inspector (position, scale, rotation, opacity)
- [ ] Text/title overlays with rich formatting
- [ ] Basic transitions (cut, crossfade, dip to black)
- [ ] Basic color correction (brightness, contrast, saturation, temperature)
- [ ] Audio mixer (per-track volume, mute, solo)
- [ ] Waveform visualization on audio clips

### 3.2 Media Management
- [ ] Upload from device (drag & drop + file picker)
- [ ] Cloud storage (Cloudflare R2)
- [ ] Project save/load (auto-save + manual)
- [ ] Media library (organized by project)
- [ ] Stock footage/music library (Pexels, Pixabay integrations)
- [ ] Built-in background music library

### 3.3 AI Features
- [ ] **Auto-captions** — Whisper-powered, cinematic caption styles
- [ ] **Multilingual translation** of captions
- [ ] **Silence / filler removal** — strip "ums", "ahs", dead air
- [ ] **Smart reframe** — auto-convert landscape → vertical/square
- [ ] **AI Director** — NLP prompt → timeline edit (e.g. "make a 30s highlight reel")
- [ ] **Semantic shot search** — find moments by description
- [ ] **AI script generation** — prompt → script → video assembly
- [ ] **Voice dubbing** — translate + re-voice in another language
- [ ] **Voice cleanup** — background noise removal
- [ ] **Audio ducking** — auto-lower music when voice detected
- [ ] **Beat sync** — snap cuts to music beats
- [ ] **Color auto-grade** — AI-powered consistent color across shots
- [ ] **Background removal** from clips
- [ ] **AI B-roll suggestions** — suggest cutaway clips from stock

### 3.4 Templates
- [ ] Template gallery (browsable, filterable)
- [ ] Categories: Social Ads, YouTube Intros, Testimonials, Product Demos, Reels, Stories
- [ ] Template preview before applying
- [ ] Apply template to new project (placeholders for footage/text)
- [ ] Community template submissions (later)
- [ ] Brand kit (logo, colors, fonts — auto-applied to templates)

### 3.5 Export
- [ ] MP4 export (H.264, H.265)
- [ ] WebM export
- [ ] GIF export (short clips)
- [ ] Platform presets: TikTok (9:16), YouTube (16:9), Instagram (1:1, 4:5, 9:16), Twitter/X
- [ ] Quality settings (720p, 1080p, 4K)
- [ ] XML export to Premiere Pro / DaVinci Resolve
- [ ] Direct publish to social (later)

### 3.6 Collaboration
- [ ] Project sharing (view-only link, edit link)
- [ ] Frame-pinned comments
- [ ] Real-time co-editing (later — Durable Objects)
- [ ] Version history

### 3.7 User & Projects
- [ ] Auth (email, Google OAuth)
- [ ] Dashboard (my projects, templates, recent)
- [ ] Project folders / organization
- [ ] Usage limits by plan (free / pro)

---

## 4. Tech Stack

### Frontend (`apps/web`)

| Layer | Choice | Why |
|---|---|---|
| Framework | TanStack Start + TanStack Router | Already in project, SSR, type-safe routes |
| UI | React 19 + shadcn/ui | Already in project |
| Styling | Tailwind CSS v4 | Already in project |
| **Timeline State** | **Zustand** | Lightweight, devtools, middleware for undo/redo |
| **Editor Canvas** | **Konva.js** (Canvas2D) with **WebCodecs** for frame decode | Konva for overlay rendering; WebCodecs for video frame access |
| **Video Processing** | **FFmpeg.wasm** | In-browser encode/decode, no server needed for basic ops |
| **AI Captions** | Whisper via API | Server-side (too heavy for WASM) |
| Audio Analysis | Web Audio API | Beat detection, waveform rendering, silence detection |
| Realtime (later) | Cloudflare Durable Objects | Co-editing, presence |
| Animations | Motion (Framer Motion v11+) | Smooth UI transitions |
| Forms | React Hook Form + Zod | Already in project |
| Drag & Drop | `@dnd-kit/core` | Accessible, performant |
| Icons | Hugeicons (already in project) | Already in project |
| Package manager | Bun | Already in project |

### Backend (`apps/api`)

| Layer | Choice | Why |
|---|---|---|
| Framework | Elysia + Cloudflare Workers | Already in project |
| Auth | **Better-Auth** | Open source, edge-compatible, supports OAuth |
| Database | **Cloudflare D1** (SQLite) | Already in CF ecosystem, free tier |
| File Storage | **Cloudflare R2** | Already referenced in project |
| AI — Captions | **OpenAI Whisper API** | Best accuracy |
| AI — LLM (Director, Script) | **Anthropic Claude API** (primary) + OpenAI fallback | Best for instruction-following |
| AI — Video Models | **Fal.ai** (already a sponsor!) | Wan, Kling, etc. |
| AI — Voice | **ElevenLabs API** | Dubbing, voice cleanup |
| AI — Background removal | **Remove.bg API** or open model via Fal.ai | |
| Job Queue | **Cloudflare Queues** | Async AI jobs (captioning, rendering) |
| KV / Cache | **Cloudflare KV** | Session cache, feature flags |

### Infrastructure

| Thing | Choice |
|---|---|
| Hosting | Cloudflare Workers + Pages |
| CDN / Assets | Cloudflare R2 + CDN |
| Monorepo | Moon + Proto (already in project) |
| CI/CD | GitHub Actions → Moon CI (already in project) |
| Monitoring | Cloudflare Analytics + Sentry |
| Payments (later) | Stripe |

---

## 5. Application Architecture

### 5.1 Route Structure

```
/                          → Landing page (marketing)
/login                     → Auth (email + Google)
/dashboard                 → User's projects + templates
/editor/[projectId]        → Main editor
/editor/new                → Create new project (from template or blank)
/templates                 → Template gallery
/templates/[id]            → Template preview
/settings                  → User settings, brand kit, billing
```

### 5.2 Editor State Model

The editor state is managed by **Zustand** with a well-defined data model:

```typescript
// Core data model
interface Project {
  id: string
  name: string
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5'
  fps: 24 | 30 | 60
  duration: number          // total duration in seconds
  tracks: Track[]
  assets: Asset[]
  createdAt: Date
  updatedAt: Date
}

interface Track {
  id: string
  type: 'video' | 'audio' | 'text' | 'effects'
  name: string
  muted: boolean
  locked: boolean
  clips: Clip[]
}

interface Clip {
  id: string
  trackId: string
  assetId: string
  startTime: number         // position on timeline (seconds)
  duration: number          // how long it plays
  trimStart: number         // offset from beginning of source asset
  trimEnd: number           // offset from end of source asset
  properties: ClipProperties
}

interface ClipProperties {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  volume: number
  color?: ColorGrade
  effects?: Effect[]
}

interface Asset {
  id: string
  type: 'video' | 'audio' | 'image' | 'text'
  name: string
  url: string               // R2 URL
  duration?: number
  width?: number
  height?: number
  thumbnailUrl?: string
}
```

### 5.3 Editor Layout (UI)

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: File | Edit | View | Export        [AI Director]  │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│  Media   │         Preview Canvas           │  Inspector    │
│  Browser │         (canvas element)         │  (clip props) │
│          │                                  │               │
│  Assets  │  [◀◀] [◀] [▶/❚❚] [▶] [▶▶]      │  AI Panel     │
│  Library │  00:00:00 / 00:01:30             │               │
│          │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│                    Timeline                                 │
│  [+Track] [zoom -][=====       ][zoom +]   00:00:12.08      │
│  ┌──────┬────────────────────────────────────────────────── │
│  │ V1   │ [=clip 1======] [=clip 2=======] [=clip 3=]       │
│  │ A1   │ [=audio=====================================]      │
│  │ T1   │      [=title text=]                               │
│  └──────┴────────────────────────────────────────────────── │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Video Rendering Pipeline

```
Upload → R2 Storage
         ↓
     Thumbnail generation (Cloudflare Worker + FFmpeg)
         ↓
     Editor loads clips via signed R2 URLs
         ↓
     WebCodecs decodes frames for preview (in-browser, no server)
         ↓
     Canvas composites frames (Konva + requestAnimationFrame)
         ↓
     Export: FFmpeg.wasm encodes final MP4 in-browser
              (or server-side FFmpeg for 4K/heavy jobs)
```

### 5.5 AI Pipeline

```
User triggers AI action (caption, silence removal, director prompt)
         ↓
API call to apps/api (Elysia Worker)
         ↓
Job pushed to Cloudflare Queue
         ↓
Queue Consumer Worker runs AI job:
  - Caption: upload audio → Whisper API → return SRT/JSON
  - Director: send transcript + prompt → Claude → edit operations JSON
  - Voice dub: ElevenLabs → new audio track
  - Silence removal: audio analysis → clip trim instructions
         ↓
Result stored in D1 + R2 (if audio/video output)
         ↓
WebSocket / polling notifies editor
         ↓
Editor applies edit operations to timeline state
```

---

## 6. Data Flow: Editor Save/Load

```
Editor State (Zustand) 
  → auto-save every 10s → POST /api/projects/[id]/save
  → payload: project JSON (serialized state)
  → stored in D1 as JSON column

Load project:
  GET /api/projects/[id] → returns project JSON
  → hydrate Zustand store
  → lazy-load asset metadata (thumbnails, durations)
```

---

## 7. Competitive Differentiators (Summary)

1. **MIT licensed + self-hostable** — no other AI video editor offers this
2. **Template gallery** — Cardboard has none; InVideo's is behind a paywall
3. **Free tier with real capability** — not just a trial
4. **Plugin API** — extend the editor programmatically
5. **Fal.ai integration** — already a project sponsor; text-to-video, image gen built-in
6. **Export to Premiere / DaVinci** — XML export preserves edit decisions
7. **MCP server** — AI agents can control the editor (unique)
8. **No data harvesting** — GDPR-friendly, privacy-first

---

## 8. Non-Goals (for now)

- Mobile native app (web-first, mobile-responsive later)
- Desktop app (Rust/GPUI — Phase 2+)
- Real-time co-editing (Phase 3)
- Direct social publishing (Phase 3)
- 3D graphics / motion graphics engine
- Full color science (LUTs, scopes) — basic grades only
