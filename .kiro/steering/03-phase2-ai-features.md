# Phase 2 — AI Features Layer

> **Goal:** Add AI-powered features that make editing 10x faster. This is the layer that makes OpenField competitive with Cardboard.ai.  
> **Prerequisite:** Phase 1 complete — core editor is fully working.  
> **Timeline estimate:** 8–10 weeks  
> **Definition of done:** A user can upload a raw video and in under 5 minutes have a captioned, silence-trimmed, reframed cut with a voiceover — all using AI.

---

## Architecture: How AI Jobs Work

All AI features follow the same async job pattern:

```
Frontend triggers AI action
       ↓
POST /api/ai/jobs  { type, payload }
       ↓
API validates + creates job record in D1 (status: "queued")
       ↓
Job pushed to Cloudflare Queue
       ↓
Queue Consumer Worker picks up job:
  - calls external AI API (Whisper, Claude, ElevenLabs, Fal.ai)
  - stores result in R2 / D1
  - updates job status to "completed" or "failed"
       ↓
Frontend polls GET /api/ai/jobs/:id  (or uses WebSocket push later)
       ↓
On completion: editor receives result + applies to timeline
```

**Job status model:**
```typescript
interface AIJob {
  id: string
  projectId: string
  type: AIJobType
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number          // 0–100
  payload: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  createdAt: Date
  completedAt?: Date
}

type AIJobType =
  | 'transcribe'            // Whisper — speech to text
  | 'captions'              // Generate styled captions on timeline
  | 'silence_removal'       // Strip dead air and filler words
  | 'smart_reframe'         // Auto-crop for different aspect ratios
  | 'translate_captions'    // Translate existing captions
  | 'voice_dub'             // Re-voice in another language
  | 'voice_cleanup'         // Remove background noise
  | 'audio_duck'            // Auto-duck music under voice
  | 'beat_sync'             // Snap cuts to music beats
  | 'color_grade'           // AI-consistent color grading
  | 'director_prompt'       // NLP → timeline edit operations
  | 'script_to_video'       // Text script → assembled timeline
  | 'background_remove'     // Remove background from clip
  | 'broll_suggest'         // Suggest stock B-roll clips
```

**New packages to add (`apps/api`):**
```
openai                      # Whisper + GPT fallback
@anthropic-ai/sdk           # Claude — AI Director
elevenlabs                  # Voice dubbing + cleanup
```

**New packages to add (`apps/web`):**
```
# No new heavy deps — AI panel is standard React UI
# AI results applied via existing Zustand store actions
```

---

## TASK 2.1 — AI Panel UI (Sidebar)

**What:** An AI assistant panel in the editor — a floating sidebar or drawer where all AI features live. This is the user's primary interaction point for all Phase 2 features.

**Design:**
- Accessible via a wand/sparkle icon button in the top toolbar
- Opens as a right-side drawer over the Inspector panel (or as a second tab in Inspector)
- Sections:
  - **Transcribe & Captions** — run Whisper, configure caption style, apply to timeline
  - **Silence Removal** — detect and strip dead air + fillers
  - **Smart Reframe** — reframe for different aspect ratios
  - **Voice Tools** — voice cleanup, voice dubbing
  - **AI Director** — free-text prompt box → edit operations
  - **Script to Video** — write a script → auto-assemble
  - **B-Roll Suggestions** — AI suggests stock clips
- Each section shows job status (queued/processing/done) with a progress bar
- Results shown inline with accept/reject actions before applying to timeline

**Files to create:**
- `apps/web/src/components/editor/ai/ai-panel.tsx`
- `apps/web/src/components/editor/ai/ai-panel-section.tsx`
- `apps/web/src/components/editor/ai/job-status-indicator.tsx`
- `apps/web/src/hooks/use-ai-job.ts` — polling hook for job status
- `apps/api/src/routes/ai-jobs.ts` — CRUD for AI jobs

---

## TASK 2.2 — Transcription (Whisper)

**What:** Convert speech in a video/audio clip to text. Foundation for captions, silence removal, AI Director, and B-roll suggestions — everything else in Phase 2 depends on the transcript.

**Flow:**
1. User selects a clip in media browser or timeline
2. Clicks "Transcribe" in AI panel
3. API extracts audio from clip (FFmpeg server-side) → sends to OpenAI Whisper API
4. Returns word-level timestamps + full transcript
5. Transcript stored in D1 linked to the asset
6. Transcript shown in AI panel as readable text with timestamp links
7. Clicking a word in transcript seeks preview to that moment

**Transcript data model:**
```typescript
interface Transcript {
  id: string
  assetId: string
  language: string
  fullText: string
  words: TranscriptWord[]
  segments: TranscriptSegment[]   // sentence-level chunks
}

interface TranscriptWord {
  word: string
  start: number       // seconds
  end: number
  confidence: number
}

interface TranscriptSegment {
  text: string
  start: number
  end: number
  words: TranscriptWord[]
}
```

**API:**
```
POST /api/ai/jobs         body: { type: 'transcribe', assetId }
GET  /api/transcripts/:assetId   → fetch existing transcript
```

**Whisper model:** `whisper-1` via OpenAI API with `response_format: 'verbose_json'` and `timestamp_granularities: ['word', 'segment']`

**Files to create:**
- `apps/web/src/components/editor/ai/transcription-section.tsx`
- `apps/web/src/components/editor/ai/transcript-viewer.tsx`
- `apps/api/src/workers/ai-jobs/transcribe.ts` — Whisper job handler
- `apps/api/src/lib/audio-extract.ts` — FFmpeg audio extraction

---

## TASK 2.3 — Auto-Captions

**What:** Generate styled subtitle captions on the timeline from a transcript. Multiple cinematic caption styles, like Cardboard.

**Flow:**
1. Transcription must exist (Task 2.2)
2. User picks caption style in AI panel → clicks "Generate Captions"
3. API converts transcript segments → caption text clips with timestamps
4. Caption clips added to a dedicated "Captions" text track on the timeline
5. Each caption is a standard text clip (editable like any other text clip)
6. User can manually edit any caption text or timing

**Caption styles (preset visual designs):**
```typescript
type CaptionStyle =
  | 'standard'        // white text, dark background, bottom-center
  | 'bold-pop'        // large bold white text, animated word highlight
  | 'cinematic'       // elegant serif, fade in, lower position
  | 'minimal'         // small clean sans-serif, no background
  | 'typewriter'      // monospace, typewriter reveal animation
  | 'social'          // TikTok/Reels style — large centered, word-by-word
```

**Word-highlight animation:**
- For "bold-pop" and "social" styles: each word highlights as it's spoken
- Stored as per-word keyframe animations on the text clip
- Renders via Konva text layer with active word in accent color

**API:**
```
POST /api/ai/jobs    body: { type: 'captions', assetId, clipId, style }
```

**Result format (edit operations applied to timeline):**
```typescript
interface CaptionsResult {
  captions: Array<{
    text: string
    start: number
    end: number
    words: TranscriptWord[]
    style: CaptionStyle
  }>
}
```

**Files to create:**
- `apps/web/src/components/editor/ai/captions-section.tsx`
- `apps/web/src/components/editor/ai/caption-style-picker.tsx`
- `apps/web/src/lib/captions-applier.ts` — convert captions result → timeline clips
- `apps/api/src/workers/ai-jobs/captions.ts` — caption generation job

---

## TASK 2.4 — Silence & Filler Word Removal

**What:** Automatically detect and remove silence, "ums", "ahs", repeated words, and dead air from clips. One of the highest-ROI AI features.

**Two modes:**
1. **Silence removal** — strip gaps where no one is talking (threshold-based)
2. **Filler removal** — strip "um", "uh", "like", "you know", "basically" (transcript-based)

**Flow:**
1. User selects clip(s) on timeline
2. Opens "Silence Removal" in AI panel
3. Configure: silence threshold (dB), minimum silence duration (ms), filler words list
4. Run job → API analyzes transcript + audio levels
5. Returns list of time ranges to cut
6. User previews the cut list (shown as a visual list with toggles)
7. User accepts → editor applies: each cut range becomes a ripple-delete on the clip

**Algorithm:**
- Silence detection: analyze audio waveform amplitude below threshold for > min duration
- Filler detection: search transcript word list for filler words → get their timestamps → add to cut list
- Merge overlapping/adjacent cuts (within 100ms) to avoid jump cuts
- Apply minimum cut length (don't cut things shorter than 100ms — sounds unnatural)

**Cut list UI:**
```
Cut List (23 removals, saves 1m 14s)
───────────────────────────────────
☑ 0:00 – 0:03   "um..." (silence)
☑ 0:08 – 0:09   "uh" (filler)
☑ 0:23 – 0:28   [silence]
☐ 0:31 – 0:32   "basically" (filler)  ← user unchecked this one
...
[Apply 22 cuts]  [Cancel]
```

**Apply mechanism:**
- Each accepted cut = `splitClip` at start + `splitClip` at end + `removeClip` the middle piece
- Uses ripple-delete: all clips to the right shift left by cut duration
- Adds to undo history as a single batch operation

**Files to create:**
- `apps/web/src/components/editor/ai/silence-removal-section.tsx`
- `apps/web/src/components/editor/ai/cut-list-review.tsx`
- `apps/web/src/lib/silence-applier.ts` — apply cut list to timeline
- `apps/api/src/workers/ai-jobs/silence-removal.ts`
- `apps/api/src/lib/audio-analysis.ts` — amplitude analysis

---

## TASK 2.5 — Smart Reframe (Aspect Ratio Conversion)

**What:** Automatically convert a 16:9 landscape video to 9:16 (vertical) or 1:1 (square) while keeping the subject in frame. Critical for social media repurposing.

**Approach:**
- Use a face/subject detection model to find the region of interest (ROI) per frame
- Lightweight: use **MediaPipe Face Detection** (runs in-browser via WASM) for face tracking
- For non-face subjects: use saliency/motion detection
- Output: per-clip crop parameters (x offset over time as keyframes)
- Applied as animated `x` property keyframes on the clip in the timeline

**Flow:**
1. User clicks "Reframe" in AI panel
2. Picks target aspect ratio (9:16, 1:1, 4:5)
3. Detection runs in-browser (MediaPipe) for each clip — no server needed for this step
4. Preview shows the reframed output in the preview canvas
5. User can manually adjust any keyframe if detection was wrong
6. Apply → clip properties updated with crop keyframes

**Implementation note:** MediaPipe runs entirely in the browser via WebAssembly. No API calls needed. This keeps it fast and free.

**New package:**
```
@mediapipe/face_detection    # face detection WASM model
```

**Files to create:**
- `apps/web/src/components/editor/ai/reframe-section.tsx`
- `apps/web/src/components/editor/ai/reframe-preview.tsx`
- `apps/web/src/lib/face-detection.ts` — MediaPipe wrapper
- `apps/web/src/lib/reframe-calculator.ts` — compute crop keyframes from face positions

---

## TASK 2.6 — Caption Translation

**What:** Translate existing captions to another language. Requires captions to already exist on the timeline (Task 2.3).

**Flow:**
1. User opens "Translate Captions" in AI panel
2. Picks target language from dropdown (50+ languages)
3. API takes existing caption text → Claude or OpenAI → translated captions
4. Returns same caption structure with translated text (timestamps unchanged)
5. User can add as a new caption track (dual-language) or replace existing

**Supported languages:** All languages supported by Claude/GPT — approximately 90+

**Translation prompt strategy:**
- Send caption segments (not word by word) as a JSON array
- Ask model to translate while preserving timing-appropriate length
- Validate output has same number of segments as input

**API:**
```
POST /api/ai/jobs    body: { type: 'translate_captions', projectId, targetLanguage, captionClipIds[] }
```

**Files to create:**
- `apps/web/src/components/editor/ai/translate-captions-section.tsx`
- `apps/api/src/workers/ai-jobs/translate-captions.ts`

---

## TASK 2.7 — Voice Cleanup (Noise Removal)

**What:** Remove background noise from audio tracks — wind, traffic, room echo, keyboard clicks.

**Implementation:**
- Use **ElevenLabs Audio Isolation API** (isolates voice from background)
- Or fallback: **Krisp Noise Suppression** via WebAssembly (in-browser, no API key needed for basic)
- Input: audio clip from R2
- Output: cleaned audio file → stored back in R2 as a new asset
- Applied as a new audio clip replacing the original (original preserved as hidden track)

**Flow:**
1. User selects audio/video clip
2. Clicks "Clean Audio" in AI panel
3. Job runs → cleaned audio returned
4. Preview plays cleaned version
5. User accepts → cleaned audio replaces original in timeline

**API:**
```
POST /api/ai/jobs    body: { type: 'voice_cleanup', clipId, assetId }
```

**Files to create:**
- `apps/web/src/components/editor/ai/voice-tools-section.tsx`
- `apps/api/src/workers/ai-jobs/voice-cleanup.ts`

---

## TASK 2.8 — Audio Ducking

**What:** Automatically lower background music volume when someone is speaking. Makes voice-over-music videos sound professional.

**Implementation (fully client-side):**
- Analyze the voice track for speech segments (Web Audio API amplitude detection)
- Analyze the music track
- Generate volume automation keyframes on the music track:
  - Normal volume during non-speech segments
  - Ducked volume (e.g. -18dB, configurable) during speech segments
  - Smooth ramp transitions (100ms ease-in/out)
- Apply as volume keyframes on the music clip's `properties.volume` timeline

**UI:**
- Duck amount slider (0% to 80% reduction)
- Fade speed slider (50ms to 500ms)
- Preview with real-time audio mixing

**No API call needed** — runs entirely in Web Audio API.

**Files to create:**
- `apps/web/src/components/editor/ai/audio-ducking-section.tsx`
- `apps/web/src/lib/audio-ducker.ts` — speech detection + keyframe generation

---

## TASK 2.9 — Beat Sync

**What:** Automatically snap cut points to the beat of background music. Makes music-driven videos feel tight.

**Implementation (fully client-side):**
- Analyze music track with Web Audio API → detect beat timestamps
- BPM detection algorithm: FFT-based onset detection
- Show detected beats as tick marks on the timeline ruler
- "Snap to beats" mode: when enabled, clip edges snap to nearest beat
- "Auto cut to beat": given selected clips, automatically trim/arrange them to beat boundaries

**UI:**
- Analyze button → shows detected BPM + beat markers on timeline
- Toggle "Snap to beats" (replaces normal clip snapping)
- "Auto-sync cuts" button — redistributes existing clips to beat positions

**No API call needed** — pure Web Audio API + math.

**Files to create:**
- `apps/web/src/components/editor/ai/beat-sync-section.tsx`
- `apps/web/src/lib/beat-detector.ts` — BPM + beat timestamp detection
- `apps/web/src/components/editor/timeline/beat-markers.tsx` — render beats on ruler

---

## TASK 2.10 — AI Color Grading

**What:** Analyze all clips in the project and apply consistent color correction so they all look like they came from the same shoot.

**Approach:**
- Extract a frame from each clip
- Send frames to **Claude Vision** (or a dedicated color analysis model via Fal.ai)
- AI returns per-clip correction parameters (brightness offset, contrast, saturation, white balance)
- All clips adjusted to a common target look
- User can pick a "look" preset: Warm, Cool, Cinematic, Vintage, Natural

**Color grading parameters (applied to clip inspector):**
```typescript
interface ColorGrade {
  brightness: number      // -100 to 100
  contrast: number        // -100 to 100
  saturation: number      // -100 to 100
  temperature: number     // -100 to 100 (warm/cool)
  tint: number            // -100 to 100 (green/magenta)
  highlights: number      // -100 to 100
  shadows: number         // -100 to 100
}
```

**API:**
```
POST /api/ai/jobs    body: { type: 'color_grade', projectId, look: 'cinematic' }
```

**Files to create:**
- `apps/web/src/components/editor/ai/color-grade-section.tsx`
- `apps/api/src/workers/ai-jobs/color-grade.ts`
- `apps/web/src/lib/color-grade-applier.ts`

---

## TASK 2.11 — AI Director (Natural Language → Timeline Edits)

**What:** The signature AI feature. User types a natural language instruction and the AI edits the timeline. This is what Cardboard calls their "Director."

**Examples of what it handles:**
- "Make a 30-second highlight reel from this footage"
- "Cut out all the parts where nobody is talking"
- "Add a fade-in at the beginning and fade-out at the end"
- "Make the pacing faster — remove the slow parts"
- "Create a 60-second version for Instagram Reels"
- "Add captions and remove the silences"

**Implementation:**

Step 1 — Build context for the model:
```typescript
interface EditorContext {
  project: { duration, aspectRatio, fps }
  tracks: TrackSummary[]    // track types, clip counts
  clips: ClipSummary[]      // clip id, start, duration, hasTranscript
  transcript?: string       // full transcript if available
  currentTime: number
}
```

Step 2 — Send to Claude with a system prompt that explains edit operations:
```
System: You are an AI video editor. You receive the current state of a video editing
project and a user instruction. Return a JSON array of edit operations to apply.
Available operations: [list all timeline store actions with parameters]
```

Step 3 — Claude returns an edit plan:
```typescript
interface EditPlan {
  reasoning: string             // shown to user as explanation
  operations: EditOperation[]
}

type EditOperation =
  | { type: 'trim_clip'; clipId: string; trimStart: number; trimEnd: number }
  | { type: 'remove_clip'; clipId: string }
  | { type: 'move_clip'; clipId: string; startTime: number }
  | { type: 'add_transition'; clipId: string; transition: TransitionType }
  | { type: 'add_text'; trackId: string; text: string; startTime: number; duration: number; style: string }
  | { type: 'set_volume'; clipId: string; volume: number }
  | { type: 'set_clip_property'; clipId: string; property: string; value: unknown }
  | { type: 'run_job'; jobType: AIJobType; params: Record<string, unknown> }
```

Step 4 — Show edit plan to user with accept/reject + explanation before applying.

Step 5 — Apply operations via Zustand store actions (all undoable as a batch).

**UI:**
- Free-text prompt input in AI panel
- "What do you want to make?" placeholder
- Shows streaming response from Claude
- Edit plan displayed as a readable list of changes
- "Apply All" / "Apply Selected" / "Discard" actions

**API:**
```
POST /api/ai/director    body: { projectId, prompt, context: EditorContext }
```

**Files to create:**
- `apps/web/src/components/editor/ai/director-section.tsx`
- `apps/web/src/components/editor/ai/edit-plan-review.tsx`
- `apps/web/src/lib/edit-plan-executor.ts` — apply edit operations to Zustand store
- `apps/api/src/routes/ai-director.ts`
- `apps/api/src/lib/director-prompt.ts` — Claude system prompt + context builder

---

## TASK 2.12 — Voice Dubbing

**What:** Re-voice the entire video in a different language with AI-generated speech that matches the speaker's timing.

**Flow:**
1. Transcription must exist
2. User picks target language + voice style (ElevenLabs voice catalog)
3. API translates transcript → generates speech via ElevenLabs
4. ElevenLabs returns audio file with timing-matched segments
5. New audio track added to timeline with dubbed audio
6. Original audio track muted (user can toggle)

**ElevenLabs APIs used:**
- `POST /v1/speech-synthesis/translations` (dubbing endpoint)
- Or: translate text with Claude → TTS each segment with matched timing

**API:**
```
POST /api/ai/jobs    body: { type: 'voice_dub', assetId, targetLanguage, voiceId }
```

**Files to create:**
- `apps/web/src/components/editor/ai/voice-dub-section.tsx`
- `apps/api/src/workers/ai-jobs/voice-dub.ts`

---

## TASK 2.13 — Script to Video

**What:** User writes (or pastes) a script → AI assembles a video from their uploaded assets matching the script.

**Flow:**
1. User writes script in a text area (or pastes from clipboard)
2. Script is segmented into scenes/paragraphs
3. For each segment: AI searches the user's asset library semantically for matching clips
4. Assembly plan shown to user (segment → clip mapping, with overrides)
5. User accepts → clips placed on timeline matching script segments
6. Captions auto-generated from script text

**Semantic search implementation:**
- Generate text embeddings for each transcript segment (stored in D1 with vector extension, or Cloudflare Vectorize)
- On script-to-video, embed each script line → find nearest transcript segment → map to clip
- Fallback: show all clips and let user drag to match if no transcript exists

**Files to create:**
- `apps/web/src/components/editor/ai/script-to-video-section.tsx`
- `apps/web/src/components/editor/ai/assembly-plan-review.tsx`
- `apps/api/src/workers/ai-jobs/script-to-video.ts`
- `apps/api/src/lib/semantic-search.ts` — embedding-based clip search

---

## TASK 2.14 — B-Roll Suggestions

**What:** AI analyzes the transcript and suggests relevant stock footage clips to use as B-roll cutaways.

**Flow:**
1. Transcript must exist
2. AI (Claude) reads transcript → identifies segments that could use visual support
3. For each segment: generates 2–3 search queries for stock footage
4. Search Pexels API + Pixabay API with those queries
5. Results shown in media browser as a "Suggested B-Roll" section
6. User drags suggested clips onto timeline (or clicks "Add to timeline")
7. Suggested B-roll clips downloaded to R2 + added as assets

**API:**
```
POST /api/ai/jobs    body: { type: 'broll_suggest', assetId, transcriptId }
GET  /api/stock/search?q=...    → proxy Pexels/Pixabay search
```

**Files to create:**
- `apps/web/src/components/editor/ai/broll-section.tsx`
- `apps/web/src/components/editor/media/stock-footage-browser.tsx`
- `apps/api/src/workers/ai-jobs/broll-suggest.ts`
- `apps/api/src/routes/stock.ts` — Pexels/Pixabay proxy

---

## TASK 2.15 — Background Removal

**What:** Remove the background from a video clip — green screen replacement without a green screen.

**Implementation options (in preference order):**
1. **In-browser** via `@mediapipe/selfie_segmentation` (WASM, free, works for people)
2. **Fal.ai** background removal model (server-side, handles complex subjects)

**Flow:**
1. User selects a video clip
2. Clicks "Remove Background" in AI panel
3. For each frame: segmentation model generates a mask
4. Canvas compositor applies mask → transparent background
5. User can place a solid color, gradient, or another video clip behind it

**Note:** Frame-by-frame segmentation is expensive. Limit to clips under 60 seconds in Phase 2. Batch process async via Cloudflare Queue for longer clips.

**Files to create:**
- `apps/web/src/components/editor/ai/background-remove-section.tsx`
- `apps/web/src/lib/background-remover.ts` — MediaPipe segmentation wrapper
- `apps/api/src/workers/ai-jobs/background-remove.ts` — Fal.ai fallback

---

## Phase 2 Acceptance Criteria

- [ ] User can transcribe a video clip and view the word-level transcript
- [ ] User can generate captions in at least 3 visual styles
- [ ] Captions appear on the timeline as editable text clips
- [ ] Silence removal detects and presents a cut list; user can accept/reject individual cuts
- [ ] Smart reframe converts a 16:9 clip to 9:16 with subject tracking
- [ ] Captions can be translated to at least 5 languages
- [ ] Audio ducking generates correct volume keyframes automatically
- [ ] Beat sync detects BPM and shows beat markers on timeline
- [ ] AI Director accepts a natural language prompt and returns an actionable edit plan
- [ ] Edit plan can be reviewed and applied (or discarded) as a single undoable operation
- [ ] B-roll suggestions return relevant stock clips based on transcript content
- [ ] All AI jobs show progress and status in the AI panel
- [ ] All AI operations are undoable

---

## Phase 2 Build Order

```
2.1 AI Panel UI
    ↓
2.2 Transcription  (dependency for 2.3, 2.4, 2.11, 2.12, 2.13, 2.14)
    ↓
2.3 Captions       2.4 Silence Removal      2.8 Audio Ducking (no deps)
    ↓                    ↓                       ↓
2.6 Translation    (apply silence cuts)     2.9 Beat Sync (no deps)
    ↓
2.5 Smart Reframe      2.7 Voice Cleanup
    ↓
2.10 Color Grade   2.11 AI Director    2.12 Voice Dub
    ↓
2.13 Script to Video   2.14 B-Roll     2.15 Background Remove
```

Build 2.1 and 2.2 first — everything else depends on the panel UI and transcript.  
2.8 and 2.9 (audio ducking + beat sync) are fully client-side and can be built in parallel at any point.
