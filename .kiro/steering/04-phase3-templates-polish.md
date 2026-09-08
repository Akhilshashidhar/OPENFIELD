# Phase 3 — Templates, Polish & Collaboration

> **Goal:** Transform the editor from a capable tool into a polished product. Add the template system that differentiates OpenField from Cardboard, add real-time collaboration, performance optimizations, and the features needed to charge money (plans, billing).  
> **Prerequisite:** Phase 2 complete — AI features working.  
> **Timeline estimate:** 6–8 weeks  
> **Definition of done:** A user can start from a template, edit it with AI, share it with a collaborator, and export — all in under 10 minutes.

---

## TASK 3.1 — Template System (Data Model & Infrastructure)

**What:** The foundation for all templates. Define what a template IS, how it's stored, and how it gets applied to a new project.

**Template data model:**
```typescript
interface Template {
  id: string
  slug: string                    // URL-friendly: "youtube-intro-dark"
  name: string                    // "Dark YouTube Intro"
  description: string
  category: TemplateCategory
  tags: string[]
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5'
  duration: number                // seconds
  thumbnail: string               // R2 URL of preview image
  previewVideo: string            // R2 URL of preview video (silent, 5s loop)
  project: ProjectState           // serialized project JSON (the actual template)
  placeholders: Placeholder[]     // where users plug in their content
  isPro: boolean                  // free vs paid template
  isOfficial: boolean             // made by OpenField team vs community
  usageCount: number
  author?: { id, name, avatar }
  createdAt: Date
}

type TemplateCategory =
  | 'social-ads'          // Facebook/Instagram ads
  | 'youtube'             // Intros, outros, thumbnails (video)
  | 'reels-stories'       // TikTok, Reels, Stories (9:16)
  | 'testimonials'        // Customer testimonial format
  | 'product-demo'        // Product showcase
  | 'explainer'           // How-to, tutorial
  | 'event'               // Event promos, countdowns
  | 'corporate'           // Internal comms, presentations
  | 'music-video'         // Beat-synced edit templates
  | 'meme'                // Viral meme formats

interface Placeholder {
  id: string
  type: 'video' | 'image' | 'text' | 'logo' | 'audio'
  label: string            // "Your footage here", "Company logo"
  clipId: string           // which clip in the template project to replace
  required: boolean
  hint?: string            // "Upload a 10-30s talking head clip"
  defaultAssetUrl?: string // placeholder asset shown before user fills it
}
```

**Template as a Project:**
- A template is just a `ProjectState` with placeholder markers
- When user opens a template → create a new project from the template JSON
- Replace placeholder clips with user's uploaded content
- Text placeholders become editable text clips with cursor focus

**Storage:**
- Templates stored in D1 (`templates` table)
- Template project JSON stored in R2 (`templates/{id}/project.json`)
- Thumbnails + preview videos in R2 (`templates/{id}/thumbnail.jpg`, `preview.mp4`)

**API routes:**
```
GET  /api/templates                     → list templates (filter by category, aspectRatio, isPro)
GET  /api/templates/:id                 → get single template with full project JSON
POST /api/templates                     → create template (admin only, or community later)
PUT  /api/templates/:id                 → update template
GET  /api/templates/categories          → list categories with counts
GET  /api/templates/featured            → curated featured templates
```

**Files to create:**
- `apps/api/src/routes/templates.ts`
- `apps/api/src/lib/template-manager.ts` — seed, validate, manage templates
- `apps/web/src/store/types.ts` — add Template + Placeholder types

---

## TASK 3.2 — Template Gallery Page

**What:** A beautiful, browsable template gallery at `/templates`. The first thing new users see. This is the equivalent of Canva's template picker.

**Layout:**
```
/templates
┌──────────────────────────────────────────────────────┐
│  🎬 Start with a template                            │
│  [Search templates...]    [Aspect ratio ▼] [Sort ▼] │
├──────────────────────────────────────────────────────┤
│  Categories (horizontal scroll):                     │
│  [All] [Social Ads] [YouTube] [Reels] [Testimonials] │
│  [Product Demo] [Explainer] [Music Video] [Meme]...  │
├──────────────────────────────────────────────────────┤
│  Featured                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │ 🎥   │ │ 🎥   │ │ 🎥   │ │ 🎥   │               │
│  │      │ │      │ │      │ │      │               │
│  │Title │ │Title │ │Title │ │Title │               │
│  │16:9  │ │9:16  │ │1:1   │ │16:9  │               │
│  │Free  │ │Pro   │ │Free  │ │Pro   │               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│                                                      │
│  Social Ads (24)                         [See all →] │
│  [grid of template cards...]                         │
└──────────────────────────────────────────────────────┘
```

**Template card:**
- Thumbnail image (auto-plays preview video on hover)
- Template name + category badge
- Duration chip (e.g. "0:30")
- Aspect ratio icon
- Free / Pro badge
- "Use Template" button on hover

**Filtering:**
- By category (tabs or sidebar)
- By aspect ratio (dropdown)
- By duration range
- Free only toggle
- Search by name/tag

**Template detail page (`/templates/:slug`):**
- Full preview video (plays in a modal or inline)
- Description, tags, usage count
- Placeholder list: "This template needs: 1 video clip, 1 logo, 3 text fields"
- "Use This Template" CTA → opens template setup wizard

**Files to create:**
- `apps/web/src/routes/templates/index.tsx` — gallery
- `apps/web/src/routes/templates/$slug.tsx` — template detail
- `apps/web/src/components/templates/template-card.tsx`
- `apps/web/src/components/templates/template-grid.tsx`
- `apps/web/src/components/templates/category-filter.tsx`
- `apps/web/src/components/templates/template-preview-modal.tsx`

---

## TASK 3.3 — Template Setup Wizard

**What:** When a user picks a template, guide them through filling in the placeholders before opening the editor.

**Wizard steps:**
```
Step 1: Name your project
  [Project name input]
  [Aspect ratio confirmation]

Step 2: Fill your placeholders (one per required placeholder)
  "Upload your footage"
  [Drop zone — accepts video/image]
  — or —
  [Use existing asset from your library]

Step 3: Customize text
  [Edit each text placeholder inline]
  "Company Name" → [Your Company]
  "Tagline"      → [Your tagline here]

Step 4: Pick color scheme (if template supports it)
  [Color palette options — matches brand colors]

→ "Open in Editor"
```

**On "Open in Editor":**
1. Create new project from template JSON
2. Replace placeholder clip IDs with user's chosen assets
3. Update text clips with user's text values
4. Redirect to `/editor/:newProjectId`
5. Show onboarding tooltip highlighting where they can customize

**Files to create:**
- `apps/web/src/components/templates/template-wizard.tsx`
- `apps/web/src/components/templates/wizard-steps/upload-step.tsx`
- `apps/web/src/components/templates/wizard-steps/text-step.tsx`
- `apps/web/src/components/templates/wizard-steps/color-step.tsx`
- `apps/web/src/lib/template-hydrator.ts` — merge user content into template project

---

## TASK 3.4 — Brand Kit

**What:** Users define their brand identity once — logo, colors, fonts — and it's automatically available in all projects and templates.

**Brand kit model:**
```typescript
interface BrandKit {
  id: string
  userId: string
  name: string                    // "My Brand"
  logoUrl?: string                // R2 URL
  colors: BrandColor[]
  fonts: BrandFont[]
  defaultFont?: string
}

interface BrandColor {
  id: string
  name: string                    // "Primary", "Secondary", "Background"
  hex: string
}

interface BrandFont {
  id: string
  name: string
  url?: string                    // custom uploaded font
  googleFont?: string             // Google Fonts name
}
```

**Usage in editor:**
- Brand kit panel in Inspector → "Apply Brand Colors" button
- All text clips offer "Use brand font" toggle
- Templates with color scheme support auto-apply brand colors

**Settings page (`/settings/brand`):**
- Upload logo (PNG/SVG)
- Color swatches — add/edit/remove
- Font management — pick from Google Fonts or upload custom

**Files to create:**
- `apps/web/src/routes/settings/brand.tsx`
- `apps/web/src/components/settings/brand-kit-editor.tsx`
- `apps/web/src/components/editor/inspector/brand-kit-panel.tsx`
- `apps/api/src/routes/brand-kit.ts`

---

## TASK 3.5 — Export Presets & Platform Publishing Presets

**What:** Extend the export system with smart platform-specific presets and a preset management system.

**Platform presets:**
```typescript
interface ExportPreset {
  id: string
  name: string
  platform: 'youtube' | 'tiktok' | 'instagram-reels' | 'instagram-feed' | 'twitter' | 'facebook' | 'linkedin' | 'custom'
  aspectRatio: string
  resolution: { width: number, height: number }
  fps: 24 | 30 | 60
  codec: 'h264' | 'h265' | 'vp9'
  bitrate: number                 // kbps
  maxDuration?: number            // seconds (e.g. TikTok = 600s max)
  maxFileSize?: number            // MB
}
```

**Built-in presets:**
| Platform | Resolution | FPS | Notes |
|---|---|---|---|
| YouTube | 1920×1080 | 30 | Standard upload |
| YouTube 4K | 3840×2160 | 30 | Requires Pro plan |
| TikTok | 1080×1920 | 30 | 9:16, max 10min |
| Instagram Reels | 1080×1920 | 30 | 9:16, max 90s |
| Instagram Feed | 1080×1080 | 30 | 1:1 |
| Instagram Story | 1080×1920 | 30 | 9:16, max 60s |
| Twitter/X | 1280×720 | 30 | max 140s |
| LinkedIn | 1920×1080 | 30 | max 10min |

**Export modal enhancements:**
- Platform preset picker (with platform icon, resolution, FPS shown)
- Warning if project aspect ratio doesn't match preset (offer auto-reframe)
- Estimated file size indicator
- "Save as custom preset" option

**Server-side export (for large files):**
- If file > 500MB or resolution > 1080p → offer server-side export
- Upload raw clip files to R2 → queue FFmpeg render job → download when ready
- Progress shown in a "Exports" panel

**Files to modify/create:**
- `apps/web/src/components/editor/export/export-modal.tsx` — add presets UI
- `apps/web/src/components/editor/export/platform-preset-picker.tsx`
- `apps/api/src/routes/exports.ts` — server-side export job management
- `apps/api/src/workers/export.ts` — FFmpeg server-side render

---

## TASK 3.6 — Real-Time Collaboration

**What:** Multiple users can edit the same project simultaneously. Comments pinned to frames. Share via link.

**Architecture:**
- Use **Cloudflare Durable Objects** as the collaboration server per project
- Each project has one Durable Object instance that holds the live state
- Clients connect via WebSocket
- State sync via **operational transforms (OT)** or **CRDTs** (use `yjs` — mature, well-tested)

**Collaboration features:**

**A. Presence (who's in the project):**
- User avatars shown in top toolbar when others are present
- Each user has a colored cursor on the timeline
- "X is editing track 2" tooltip

**B. Frame-Pinned Comments:**
```typescript
interface Comment {
  id: string
  projectId: string
  authorId: string
  authorName: string
  authorAvatar: string
  timecode: number          // seconds — which frame this is pinned to
  text: string
  resolved: boolean
  replies: CommentReply[]
  createdAt: Date
}
```
- Comment markers shown on timeline ruler as colored dots
- Click dot → shows comment in Inspector panel
- Thread replies
- Resolve / unresolve
- @mention collaborators

**C. Sharing:**
- Share button in toolbar → generates share link
- Permission levels: View only, Can comment, Can edit
- Link expiry option
- Password protection option (Pro)

**D. Version History:**
- Every 5-minute snapshot saved automatically
- User can name snapshots ("Before client review")
- Timeline of versions in settings drawer
- Restore any version (creates a copy, doesn't overwrite current)

**Implementation stack:**
- `yjs` — CRDT document model
- `y-websocket` provider custom-adapted for Cloudflare Durable Objects
- Durable Object: holds authoritative Y.Doc, broadcasts updates to all clients

**New packages:**
```
yjs                         # CRDT library
y-protocols                 # Yjs protocol
lib0                        # Yjs utilities
```

**Files to create:**
- `apps/web/src/lib/collaboration.ts` — Yjs setup + WebSocket provider
- `apps/web/src/hooks/use-collaboration.ts` — React hook for collab state
- `apps/web/src/components/editor/collaboration/presence-avatars.tsx`
- `apps/web/src/components/editor/collaboration/comment-marker.tsx`
- `apps/web/src/components/editor/collaboration/comment-thread.tsx`
- `apps/web/src/components/editor/collaboration/share-modal.tsx`
- `apps/web/src/components/editor/collaboration/version-history.tsx`
- `apps/api/src/durable-objects/project-session.ts` — Durable Object
- `apps/api/src/routes/comments.ts`
- `apps/api/src/routes/share.ts`

---

## TASK 3.7 — Plans, Limits & Billing

**What:** Free vs Pro tier. Cloudflare can handle all usage tracking. Stripe for payments.

**Free tier limits:**
| Feature | Free | Pro ($12/mo) |
|---|---|---|
| Projects | 5 | Unlimited |
| Storage | 5 GB | 100 GB |
| Export resolution | 1080p | 4K |
| Watermark on export | Yes | No |
| AI credits/month | 30 min transcription | Unlimited |
| Templates | Free templates only | All templates |
| Collaboration | View-only sharing | Full edit collaboration |
| Brand kits | 1 | Unlimited |
| Version history | 7 days | 90 days |
| Server-side export | ❌ | ✅ |

**Implementation:**
- Plan stored on user record in D1
- API enforces limits via middleware checks before job/export creation
- Stripe Checkout for upgrades
- Stripe webhooks update plan status in D1

**Billing pages (`/settings/billing`):**
- Current plan display
- Usage meters (storage, AI minutes)
- Upgrade CTA
- Invoice history (via Stripe Customer Portal)

**New packages:**
```
stripe                      # Stripe SDK (api)
@stripe/stripe-js           # Stripe.js (web)
```

**Files to create:**
- `apps/web/src/routes/settings/billing.tsx`
- `apps/web/src/components/settings/plan-card.tsx`
- `apps/web/src/components/settings/usage-meter.tsx`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/lib/stripe.ts`
- `apps/api/src/lib/plan-limits.ts` — limit enforcement middleware

---

## TASK 3.8 — Landing Page

**What:** A polished marketing landing page at `/` that converts visitors into signups. Currently just "hello world."

**Sections:**
1. **Hero** — "Edit videos with AI. Free, open source, no watermark."
   - Animated preview of the editor in action
   - "Start editing free" CTA → `/signup`
   - "Browse templates" secondary CTA → `/templates`

2. **Features grid** — 6 key features with icons and short descriptions
   - AI Captions, Silence Removal, Smart Reframe, AI Director, Templates, Open Source

3. **Template showcase** — Scrolling strip of featured templates

4. **AI features demo** — Side-by-side: before/after silence removal, caption styles

5. **Social proof** — GitHub stars, Discord members, community quotes

6. **Pricing table** — Free vs Pro comparison

7. **Open source CTA** — "Self-host it. Fork it. Make it yours." → GitHub link

8. **Footer** — Links, social, license badge

**Files to create/modify:**
- `apps/web/src/routes/index.tsx` — landing page (replaces "hello world")
- `apps/web/src/components/landing/hero.tsx`
- `apps/web/src/components/landing/features-grid.tsx`
- `apps/web/src/components/landing/template-showcase.tsx`
- `apps/web/src/components/landing/pricing-table.tsx`
- `apps/web/src/components/landing/footer.tsx`

---

## TASK 3.9 — Performance Optimization

**What:** Ensure the editor performs well at scale — large projects, long videos, many clips.

### 3.9.1 Timeline Virtualization
- Only render clips visible in the current scroll/zoom viewport
- Use virtual list for track lanes (100+ clips shouldn't lag)
- `@tanstack/react-virtual` for virtualized timeline rendering

### 3.9.2 Preview Canvas Optimization
- Frame cache: cache decoded frames in a LRU cache (limit: 200MB)
- Proxy resolution preview: play at 1/4 resolution during editing, full resolution only on export
- WebCodecs hardware acceleration path for supported browsers

### 3.9.3 Waveform Rendering
- Pre-compute waveform data on asset upload (Web Worker)
- Cache waveform data in IndexedDB (persists across sessions)
- Render waveform on OffscreenCanvas in a Web Worker

### 3.9.4 Asset Loading
- Lazy load video assets — only decode when clip is near current playhead
- Prefetch next 5 seconds of video ahead of playhead
- Use Intersection Observer to pause decode for off-screen clips

### 3.9.5 State Updates
- Debounce inspector property changes (don't update store on every slider tick — debounce 16ms)
- Batch undo history entries for continuous operations (slider drag = 1 undo entry, not 60)
- Use Zustand's `subscribeWithSelector` to avoid re-rendering unrelated components

**New packages:**
```
@tanstack/react-virtual      # Timeline virtualization
idb-keyval                   # IndexedDB for waveform cache
```

**Files to create/modify:**
- `apps/web/src/components/editor/timeline/virtual-track.tsx`
- `apps/web/src/lib/frame-cache.ts`
- `apps/web/src/lib/waveform-worker.ts` — Web Worker for waveform
- `apps/web/src/lib/asset-prefetcher.ts`

---

## TASK 3.10 — Onboarding & UX Polish

**What:** Make the first-time experience smooth. Reduce time-to-first-edit to under 2 minutes.

### Onboarding Flow
1. After signup → prompted: "Start from template" or "Start blank"
2. First blank project → interactive tooltip tour:
   - "Upload a video here (Media Browser)"
   - "Drag it to the timeline"
   - "Press Space to preview"
   - "Try AI features → the sparkle icon"
3. Empty state illustrations in every panel (not blank grey boxes)
4. "What to do next" hint bar at bottom when no clips exist

### UX Polish Checklist
- [ ] All loading states have skeleton screens (no blank flashes)
- [ ] All destructive actions have confirmation dialogs
- [ ] Keyboard shortcut reference panel (press `?` to open)
- [ ] Tooltips on all toolbar icons with shortcut shown
- [ ] Error boundaries — editor never fully crashes; shows recovery UI
- [ ] Offline detection banner — "No internet — changes saved locally"
- [ ] File format validation on upload with friendly error messages
- [ ] Drag-and-drop accepts files dropped anywhere on editor (not just media browser)
- [ ] Mobile warning — "OpenField editor requires a desktop browser"
- [ ] `<title>` updates to project name ("My Ad — OpenField Editor")

**Files to create:**
- `apps/web/src/components/editor/onboarding/tooltip-tour.tsx`
- `apps/web/src/components/editor/onboarding/empty-state.tsx`
- `apps/web/src/components/editor/keyboard-shortcuts-dialog.tsx`
- `apps/web/src/components/editor/error-boundary.tsx`
- `apps/web/src/hooks/use-online-status.ts`

---

## TASK 3.11 — Community Templates & Template Submission

**What:** Allow users to share their project as a template. Community-driven template library.

**Flow:**
1. From dashboard: right-click project → "Submit as Template"
2. Fill template metadata: name, description, category, tags
3. Mark placeholder clips (which clips should users replace)
4. Submit for review → status: "pending"
5. Team reviews + approves → published to gallery
6. Author credited on template card

**Moderation queue:**
- Admin dashboard (`/admin/templates`) to review pending submissions
- Approve / Reject with rejection reason
- Edit metadata before approving

**Incentives:**
- Template author badge on profile
- "Created by community" tag on template card
- Usage count shown to author

**Files to create:**
- `apps/web/src/components/dashboard/submit-template-modal.tsx`
- `apps/web/src/routes/admin/templates.tsx`
- `apps/api/src/routes/admin.ts`

---

## Phase 3 Acceptance Criteria

- [ ] Template gallery loads with at least 20 starter templates across 5 categories
- [ ] User can pick a template, fill placeholders in the wizard, and open it in the editor
- [ ] Brand kit saves logo + colors + fonts, and applies them to new templates
- [ ] Export presets work for YouTube, TikTok, Instagram Reels, Twitter
- [ ] Two users can open the same project and see each other's presence indicators
- [ ] Frame-pinned comments can be added, replied to, and resolved
- [ ] Version history shows last 10 snapshots and any named versions
- [ ] Project sharing link works with view-only and edit permissions
- [ ] Free plan limits are enforced (5 projects, 5GB storage, 1080p max, watermark)
- [ ] Stripe checkout upgrades user to Pro correctly
- [ ] Landing page is live with hero, features, template showcase, and pricing
- [ ] Timeline renders smoothly with 50+ clips (virtualization working)
- [ ] First-time user tooltip tour completes without errors
- [ ] Keyboard shortcuts reference dialog opens on `?`

---

## Phase 3 Build Order

```
3.1 Template Data Model + API
        ↓
3.2 Template Gallery        3.4 Brand Kit
        ↓                        ↓
3.3 Template Wizard    →   (brand applied in wizard)
        ↓
3.5 Export Presets          3.7 Plans & Billing
        ↓                        ↓
3.6 Collaboration         (enforce limits per plan)
        ↓
3.8 Landing Page       3.9 Performance Optimization
        ↓                        ↓
3.10 Onboarding & Polish     3.11 Community Templates
```

---

## Full Product Milestone Summary

| Phase | Duration | Outcome |
|---|---|---|
| **Phase 1** | 8–12 weeks | Working video editor — import, edit, export |
| **Phase 2** | 8–10 weeks | AI features — captions, silence removal, AI Director |
| **Phase 3** | 6–8 weeks | Templates, collaboration, billing, polish |
| **Total** | ~6–8 months | Competitive product ready for public launch |

After Phase 3, the product is ready for a public launch and can directly compete with Cardboard.ai and InVideo.io as a free, open-source alternative.
