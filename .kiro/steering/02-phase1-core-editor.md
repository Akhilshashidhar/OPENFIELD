# Phase 1 — Core Editor Foundation

> **Goal:** A fully working browser-based video editor. No AI yet. Just solid, fast, reliable editing.  
> **Timeline estimate:** 8–12 weeks  
> **Definition of done:** A user can import clips, arrange them on a timeline, preview in real-time, and export an MP4.

---

## Overview of Deliverables

By the end of Phase 1, the editor must support:
- Upload and manage media assets
- Multi-track timeline with clip operations
- Real-time preview canvas
- Text overlays
- Basic audio mixing
- MP4 export
- Project save/load
- Auth + dashboard

---

## Task Breakdown

### TASK 1.1 — Project Setup & New Dependencies

**What:** Install all new packages needed for the editor. Keep existing stack intact.

**New packages to add to `apps/web`:**
```
zustand                        # editor state management
@ffmpeg/ffmpeg                 # FFmpeg.wasm
@ffmpeg/util                   # FFmpeg.wasm utilities
konva                          # canvas rendering
react-konva                    # React bindings for Konva
@dnd-kit/core                  # drag & drop
@dnd-kit/sortable              # sortable clips on timeline
@dnd-kit/utilities             # dnd-kit helpers
motion                         # Framer Motion v11 — UI animations
```

**New packages to add to `apps/api`:**
```
better-auth                    # authentication
@better-auth/cli               # schema generation
```

**Steps:**
1. Add packages via `bun add` in `apps/web` and `apps/api`
2. Configure FFmpeg.wasm (needs `SharedArrayBuffer` — requires COOP/COEP headers)
3. Add COOP/COEP headers to Vite dev server config and Cloudflare Worker headers config
4. Verify build still passes

**Files to create/modify:**
- `apps/web/package.json` — add new deps
- `apps/api/package.json` — add better-auth
- `apps/web/vite.config.ts` — add COOP/COEP headers for dev
- `apps/web/public/_headers` — Cloudflare Pages headers file for production

---

### TASK 1.2 — Authentication

**What:** Email + Google OAuth login. Users must be logged in to save projects.

**Implementation:**
- Use **Better-Auth** in `apps/api`
- Store sessions in **Cloudflare D1** (SQLite)
- Expose auth routes under `/api/auth/*`
- Frontend: login page at `/login`, signup at `/signup`
- Auth state stored in React context, synced on load

**Routes to build:**
```
POST /api/auth/sign-up/email
POST /api/auth/sign-in/email
POST /api/auth/sign-in/social (Google)
POST /api/auth/sign-out
GET  /api/auth/session
```

**Frontend pages:**
- `apps/web/src/routes/login.tsx` — email/password + Google button
- `apps/web/src/routes/signup.tsx` — registration form
- Auth guard on `/dashboard` and `/editor/*` routes

**Files to create:**
- `apps/api/src/auth.ts` — Better-Auth config
- `apps/web/src/lib/auth-client.ts` — Better-Auth client
- `apps/web/src/routes/login.tsx`
- `apps/web/src/routes/signup.tsx`
- `apps/web/src/context/auth-context.tsx`
- `apps/web/src/components/auth-guard.tsx`

---

### TASK 1.3 — Dashboard

**What:** After login, users land on a dashboard showing their projects with create/open/delete actions.

**UI:**
- Grid of project cards (thumbnail, name, last edited, duration)
- "New Project" button → opens modal to pick aspect ratio, name, or choose template (blank for now)
- Project card actions: Open, Rename, Duplicate, Delete
- Empty state illustration + CTA when no projects

**API routes:**
```
GET    /api/projects              → list user's projects
POST   /api/projects              → create new project
GET    /api/projects/:id          → get project
PUT    /api/projects/:id          → update project metadata
DELETE /api/projects/:id          → delete project
```

**Files to create:**
- `apps/web/src/routes/dashboard.tsx`
- `apps/web/src/components/dashboard/project-card.tsx`
- `apps/web/src/components/dashboard/new-project-modal.tsx`
- `apps/api/src/routes/projects.ts`

---

### TASK 1.4 — Editor Route & Layout Shell

**What:** The main editor page at `/editor/:projectId`. Establishes the 4-panel layout shell.

**Layout (as per spec):**
```
┌────────────────────────────────────────────────────────┐
│  Top Toolbar                                           │
├─────────────┬──────────────────────────┬───────────────┤
│ Media Panel │   Preview Panel          │ Inspector     │
│  (left)     │   (center)               │ (right)       │
├─────────────┴──────────────────────────┴───────────────┤
│  Timeline Panel (bottom, resizable)                    │
└────────────────────────────────────────────────────────┘
```

- All 4 panels are resizable (use `react-resizable-panels` — already in project)
- Panels remember their sizes in `localStorage`
- Top toolbar: logo, project name (editable), undo/redo, export button, user avatar
- Keyboard shortcut foundation: register global key handlers

**Files to create:**
- `apps/web/src/routes/editor/$projectId.tsx` — editor route
- `apps/web/src/components/editor/editor-layout.tsx` — 4-panel shell
- `apps/web/src/components/editor/top-toolbar.tsx`
- `apps/web/src/components/editor/panels/media-panel.tsx` — stub
- `apps/web/src/components/editor/panels/preview-panel.tsx` — stub
- `apps/web/src/components/editor/panels/inspector-panel.tsx` — stub
- `apps/web/src/components/editor/panels/timeline-panel.tsx` — stub
- `apps/web/src/hooks/use-keyboard-shortcuts.ts`

---

### TASK 1.5 — Editor State (Zustand Store)

**What:** The heart of the editor. All timeline state, selection state, playback state lives here.

**Store slices:**

```typescript
// 1. Project slice — project metadata
interface ProjectSlice {
  project: Project | null
  isDirty: boolean
  isSaving: boolean
  loadProject: (id: string) => Promise<void>
  saveProject: () => Promise<void>
  setProjectName: (name: string) => void
}

// 2. Timeline slice — tracks and clips
interface TimelineSlice {
  tracks: Track[]
  addTrack: (type: TrackType) => void
  removeTrack: (trackId: string) => void
  addClip: (trackId: string, clip: Clip) => void
  removeClip: (clipId: string) => void
  moveClip: (clipId: string, trackId: string, startTime: number) => void
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void
  splitClip: (clipId: string, atTime: number) => void
  updateClipProperties: (clipId: string, props: Partial<ClipProperties>) => void
}

// 3. Assets slice — media library
interface AssetsSlice {
  assets: Asset[]
  isUploading: boolean
  uploadProgress: number
  uploadAsset: (file: File) => Promise<Asset>
  removeAsset: (assetId: string) => void
}

// 4. Playback slice — preview state
interface PlaybackSlice {
  currentTime: number        // seconds
  isPlaying: boolean
  volume: number
  playbackRate: number
  play: () => void
  pause: () => void
  seek: (time: number) => void
  setVolume: (v: number) => void
}

// 5. Selection slice — what's selected
interface SelectionSlice {
  selectedClipIds: string[]
  selectedTrackId: string | null
  selectClip: (clipId: string, multiSelect?: boolean) => void
  selectTrack: (trackId: string) => void
  clearSelection: () => void
}

// 6. History slice — undo/redo
interface HistorySlice {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}
```

**Middleware:**
- `zustand/middleware/immer` — immutable state updates
- `zustand/middleware/devtools` — browser devtools
- Custom undo/redo middleware using a history stack (snapshot-based)

**Files to create:**
- `apps/web/src/store/editor-store.ts` — main combined store
- `apps/web/src/store/slices/project-slice.ts`
- `apps/web/src/store/slices/timeline-slice.ts`
- `apps/web/src/store/slices/assets-slice.ts`
- `apps/web/src/store/slices/playback-slice.ts`
- `apps/web/src/store/slices/selection-slice.ts`
- `apps/web/src/store/middleware/history.ts`
- `apps/web/src/store/types.ts` — all TypeScript interfaces

---

### TASK 1.6 — Media Browser Panel

**What:** Left panel. Upload media, view assets, drag onto timeline.

**Features:**
- Upload button + drag-and-drop zone (accepts mp4, mov, webm, mp3, wav, png, jpg, gif)
- Grid/list view toggle
- Asset thumbnails (extracted via WebCodecs or canvas)
- Asset metadata on hover (duration, resolution, size)
- Search/filter assets
- Right-click context menu: Add to timeline, Delete, Rename
- Drag asset from panel → drop onto timeline track

**Upload flow:**
1. User selects/drops file
2. Frontend uploads to `POST /api/assets/upload` → get signed R2 upload URL
3. Upload directly to R2 from browser (pre-signed URL)
4. POST metadata to `POST /api/assets` → save to D1
5. Generate thumbnail in browser via WebCodecs → upload thumbnail to R2
6. Asset appears in media browser with thumbnail

**API routes:**
```
POST /api/assets/upload-url    → get pre-signed R2 upload URL
POST /api/assets               → save asset metadata
GET  /api/assets               → list project assets
DELETE /api/assets/:id         → delete asset + R2 object
```

**Files to create:**
- `apps/web/src/components/editor/panels/media-panel.tsx`
- `apps/web/src/components/editor/media/asset-grid.tsx`
- `apps/web/src/components/editor/media/asset-card.tsx`
- `apps/web/src/components/editor/media/upload-zone.tsx`
- `apps/web/src/lib/thumbnail.ts` — WebCodecs thumbnail extraction
- `apps/api/src/routes/assets.ts`

---

### TASK 1.7 — Preview Canvas

**What:** Center panel. Shows the current frame. Plays back the composition in real-time.

**Implementation approach:**
- `<canvas>` element renders the current frame
- **WebCodecs VideoDecoder** decodes frames from each video asset on-demand
- On each `requestAnimationFrame`, composite all visible clips at `currentTime`
- Konva.js for overlay layers (text, shapes, selection handles)
- Separate HTML5 `<video>` elements (hidden, off-screen) as decode sources for simpler initial implementation; upgrade to WebCodecs in Phase 1.5

**Playback loop:**
```
requestAnimationFrame → 
  calculate which clips are visible at currentTime →
  draw video frame from each clip's source →
  draw text/overlay layers via Konva →
  if playing: currentTime += dt; check if at end
```

**Features:**
- Play / Pause (spacebar)
- Scrub via clicking on preview
- Volume control
- Playback speed (0.5x, 1x, 1.5x, 2x)
- Aspect ratio frame (16:9, 9:16, 1:1)
- Fit-to-window / actual size zoom

**Files to create:**
- `apps/web/src/components/editor/panels/preview-panel.tsx`
- `apps/web/src/components/editor/preview/canvas-renderer.tsx`
- `apps/web/src/components/editor/preview/playback-controls.tsx`
- `apps/web/src/hooks/use-playback-loop.ts`
- `apps/web/src/lib/compositor.ts` — frame compositing logic

---

### TASK 1.8 — Timeline

**What:** Bottom panel. The core editing interface. Tracks + clips with drag, trim, split.

**Visual structure:**
```
[Timeline Header: zoom, time ruler, add track button]
[Track Header | Track Lane ────────────────────────]
  [ V1 🔒🔇 ]  [══clip 1══╗] [══clip 2══]
  [ A1 🔒🔇 ]  [════════audio clip══════════════]
  [ T1 🔒🔇 ]       [══title══]
[Playhead (red vertical line, draggable)]
```

**Features:**
- **Time ruler** with frame/second markers, scales with zoom
- **Playhead** — red line, draggable, shows current time
- **Track management** — add/remove tracks, lock, mute, rename
- **Clip rendering** — video clips show thumbnail strip, audio shows waveform
- **Clip drag** — move clips along timeline (snapping to other clips + playhead)
- **Clip trim** — drag left/right edge to trim in/out point
- **Clip split** — Cmd/Ctrl+K at playhead position
- **Clip delete** — Delete/Backspace key
- **Multi-select** — Shift+click, rubber-band select
- **Zoom** — Ctrl+scroll, or zoom slider; range 0.1x to 10x
- **Snap** — toggle snapping (S key)
- **Waveform rendering** — Web Audio API decode → draw waveform on canvas

**Drag & Drop:**
- `@dnd-kit` for clip dragging within timeline
- Custom collision detection for timeline grid
- Ghost clip shows position during drag

**Files to create:**
- `apps/web/src/components/editor/panels/timeline-panel.tsx`
- `apps/web/src/components/editor/timeline/time-ruler.tsx`
- `apps/web/src/components/editor/timeline/playhead.tsx`
- `apps/web/src/components/editor/timeline/track.tsx`
- `apps/web/src/components/editor/timeline/track-header.tsx`
- `apps/web/src/components/editor/timeline/clip.tsx`
- `apps/web/src/components/editor/timeline/clip-thumbnail-strip.tsx`
- `apps/web/src/components/editor/timeline/waveform.tsx`
- `apps/web/src/hooks/use-timeline-zoom.ts`
- `apps/web/src/hooks/use-snap.ts`
- `apps/web/src/lib/waveform.ts` — waveform data extraction

---

### TASK 1.9 — Inspector Panel

**What:** Right panel. Shows properties of the selected clip/text. Allows adjustment.

**For video clips:**
- Position: X, Y (number inputs + canvas drag handles)
- Scale: width, height, lock aspect ratio
- Rotation: slider + number
- Opacity: slider
- Volume: slider
- Trim: in/out point display (read + editable)
- Color correction: Brightness, Contrast, Saturation, Temperature sliders

**For text clips:**
- Text content (multi-line input)
- Font family picker (Google Fonts subset)
- Font size
- Bold / Italic / Underline
- Text color + background color
- Alignment (left, center, right)
- Text animation (none, fade in, slide in, typewriter)
- Position + scale (same as video)

**For audio clips:**
- Volume
- Fade in / fade out duration
- Speed

**Files to create:**
- `apps/web/src/components/editor/panels/inspector-panel.tsx`
- `apps/web/src/components/editor/inspector/video-inspector.tsx`
- `apps/web/src/components/editor/inspector/text-inspector.tsx`
- `apps/web/src/components/editor/inspector/audio-inspector.tsx`
- `apps/web/src/components/editor/inspector/color-correction.tsx`
- `apps/web/src/components/editor/inspector/font-picker.tsx`

---

### TASK 1.10 — Text / Title Overlays

**What:** Add text tracks to the timeline. Render text on the canvas preview.

**Flow:**
1. User clicks "Add Text" in toolbar or presses T
2. New text clip added to a text track at current playhead position
3. Text clip is selected; Inspector shows text properties
4. Text rendered on Konva canvas layer with all style properties
5. Click on text in preview to select + move

**Text clip types (built-in styles, like Cardboard):**
- Plain text
- Lower third (name + title)
- Subtitle style
- Big bold title
- Caption (bottom-center, for captions from AI)

**Files to create:**
- `apps/web/src/components/editor/text/text-clip.tsx` — Konva text renderer
- `apps/web/src/components/editor/text/text-styles.ts` — preset text styles
- `apps/web/src/lib/text-renderer.ts`

---

### TASK 1.11 — Transitions

**What:** Basic transitions between clips on the same track.

**Supported transitions:**
- Cut (default, no visual effect)
- Crossfade / Dissolve
- Dip to black
- Dip to white

**Implementation:**
- Transition stored as metadata on the clip (which transition + duration)
- Compositor renders blend between two frames during transition period
- Transition handle shown between adjacent clips on timeline (draggable to set duration)

**Files to create:**
- `apps/web/src/components/editor/timeline/transition-handle.tsx`
- `apps/web/src/lib/transitions.ts` — frame blending math

---

### TASK 1.12 — Export

**What:** Export the final composition as MP4.

**Implementation:**
- Use **FFmpeg.wasm** (`@ffmpeg/ffmpeg`)
- Export pipeline:
  1. Render all frames to canvas offscreen at target resolution
  2. Pipe frames to FFmpeg.wasm as PNG sequence or raw video
  3. Mux audio tracks
  4. Output MP4 (H.264 + AAC)
- Show progress bar during export
- Download file when complete

**Export settings modal:**
- Resolution: 720p, 1080p, 4K
- Frame rate: 24, 30, 60 fps
- Quality: Low / Medium / High (CRF value)
- Format: MP4, WebM
- Platform preset: YouTube, TikTok, Instagram, Twitter

**Note on performance:** FFmpeg.wasm is single-threaded in many browsers without SharedArrayBuffer. Ensure COOP/COEP headers are set (see Task 1.1). For heavy exports (4K, long videos), provide a server-side export option as fallback (Phase 2).

**Files to create:**
- `apps/web/src/components/editor/export/export-modal.tsx`
- `apps/web/src/components/editor/export/export-settings.tsx`
- `apps/web/src/components/editor/export/export-progress.tsx`
- `apps/web/src/lib/exporter.ts` — FFmpeg.wasm orchestration
- `apps/web/src/lib/frame-renderer.ts` — offscreen canvas frame rendering

---

### TASK 1.13 — Project Auto-Save & Persistence

**What:** Projects save automatically. No data loss.

**Behavior:**
- Auto-save to API every 10 seconds if `isDirty` is true
- Manual save on Ctrl/Cmd+S
- Visual indicator: "Saved" / "Saving..." / "Unsaved changes"
- On load: fetch project JSON → hydrate Zustand store
- Project JSON stored in D1 as a `state` TEXT column (serialized JSON, max ~1MB)
- For large projects: store state in R2, save only R2 key in D1

**Files to create/modify:**
- `apps/web/src/hooks/use-auto-save.ts`
- `apps/web/src/components/editor/top-toolbar.tsx` — add save indicator
- `apps/api/src/routes/projects.ts` — PUT /api/projects/:id endpoint

---

### TASK 1.14 — Keyboard Shortcuts

**What:** Standard NLE keyboard shortcuts for professional feel.

| Shortcut | Action |
|---|---|
| `Space` | Play / Pause |
| `J` | Play backward |
| `K` | Pause |
| `L` | Play forward |
| `I` | Set in-point |
| `O` | Set out-point |
| `←` / `→` | Move playhead 1 frame |
| `Shift+←/→` | Move playhead 1 second |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Ctrl/Cmd+S` | Save |
| `Delete/Backspace` | Delete selected clip |
| `Ctrl/Cmd+K` | Split clip at playhead |
| `Ctrl/Cmd+D` | Duplicate clip |
| `T` | Add text clip |
| `S` | Toggle snap |
| `+` / `-` | Zoom timeline in/out |
| `\` | Fit timeline to window |
| `Escape` | Deselect all |
| `Ctrl/Cmd+A` | Select all clips |

**Files to create/modify:**
- `apps/web/src/hooks/use-keyboard-shortcuts.ts` — register all shortcuts
- `apps/web/src/components/editor/editor-layout.tsx` — attach hook

---

## Phase 1 Acceptance Criteria

Before moving to Phase 2, all of these must work end-to-end:

- [ ] User can sign up, log in, log out
- [ ] User sees dashboard with their projects
- [ ] User can create a blank project (16:9, 9:16, 1:1)
- [ ] User can upload at least one video file and one audio file
- [ ] Uploaded clips appear in the media browser with thumbnails
- [ ] User can drag a clip from media browser onto a timeline track
- [ ] Clip plays back in the preview canvas when timeline is played
- [ ] User can trim a clip by dragging its edges
- [ ] User can split a clip with Ctrl+K
- [ ] User can delete a clip
- [ ] User can reorder clips by dragging
- [ ] User can add a text overlay with custom content and styling
- [ ] Undo and redo work for all timeline operations
- [ ] User can export the project as an MP4 file
- [ ] Project auto-saves every 10 seconds
- [ ] User can reload the page and resume editing the same project

---

## Phase 1 Suggested Build Order

```
1.1 Setup          → 1.2 Auth        → 1.3 Dashboard
       ↓
1.4 Editor Shell   → 1.5 Zustand Store
       ↓
1.6 Media Panel    → 1.7 Preview Canvas
       ↓
1.8 Timeline       → 1.9 Inspector
       ↓
1.10 Text Clips    → 1.11 Transitions
       ↓
1.12 Export        → 1.13 Auto-Save  → 1.14 Shortcuts
```

Each step depends on the one before. Build in this order — don't skip ahead to AI features before the core editor works.
