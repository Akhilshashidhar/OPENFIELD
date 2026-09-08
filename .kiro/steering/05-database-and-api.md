# Database Schema & API Design

> **Database:** Cloudflare D1 (SQLite at the edge)  
> **File Storage:** Cloudflare R2  
> **Cache / KV:** Cloudflare KV  
> **Realtime:** Cloudflare Durable Objects  
> **Auth:** Better-Auth (manages its own session/account tables)

---

## 1. Database Schema (Cloudflare D1 / SQLite)

### 1.1 Auth Tables (managed by Better-Auth — do not write manually)

```sql
-- Better-Auth generates these automatically via `better-auth generate`
-- Listed here for reference only

CREATE TABLE user (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,    -- boolean
  image        TEXT,
  createdAt    INTEGER NOT NULL,               -- unix timestamp
  updatedAt    INTEGER NOT NULL
);

CREATE TABLE session (
  id           TEXT PRIMARY KEY,
  expiresAt    INTEGER NOT NULL,
  token        TEXT NOT NULL UNIQUE,
  createdAt    INTEGER NOT NULL,
  updatedAt    INTEGER NOT NULL,
  ipAddress    TEXT,
  userAgent    TEXT,
  userId       TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE account (
  id                    TEXT PRIMARY KEY,
  accountId             TEXT NOT NULL,
  providerId            TEXT NOT NULL,         -- "google", "email"
  userId                TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken           TEXT,
  refreshToken          TEXT,
  idToken               TEXT,
  accessTokenExpiresAt  INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope                 TEXT,
  password              TEXT,                  -- hashed, email auth only
  createdAt             INTEGER NOT NULL,
  updatedAt             INTEGER NOT NULL
);

CREATE TABLE verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  INTEGER NOT NULL,
  createdAt  INTEGER,
  updatedAt  INTEGER
);
```

---

### 1.2 User Profile & Plan

```sql
CREATE TABLE user_profile (
  id            TEXT PRIMARY KEY,              -- same as user.id
  plan          TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
  stripeCustomerId    TEXT,
  stripeSubscriptionId TEXT,
  planExpiresAt INTEGER,                       -- unix timestamp
  storageUsedBytes    INTEGER NOT NULL DEFAULT 0,
  aiMinutesUsed       INTEGER NOT NULL DEFAULT 0,  -- this month
  aiMinutesResetAt    INTEGER NOT NULL,        -- start of current billing month
  createdAt     INTEGER NOT NULL,
  updatedAt     INTEGER NOT NULL,
  FOREIGN KEY (id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_profile_stripe ON user_profile(stripeCustomerId);
```

---

### 1.3 Projects

```sql
CREATE TABLE project (
  id           TEXT PRIMARY KEY,               -- nanoid
  userId       TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT 'Untitled Project',
  aspectRatio  TEXT NOT NULL DEFAULT '16:9',   -- '16:9' | '9:16' | '1:1' | '4:5'
  fps          INTEGER NOT NULL DEFAULT 30,
  duration     REAL NOT NULL DEFAULT 0,        -- seconds
  thumbnailUrl TEXT,                           -- R2 URL of project thumbnail
  templateId   TEXT,                           -- if created from template
  stateUrl     TEXT,                           -- R2 key for large project state JSON
  state        TEXT,                           -- project JSON (if small enough < 100KB)
  isDraft      INTEGER NOT NULL DEFAULT 1,     -- boolean
  isPublic     INTEGER NOT NULL DEFAULT 0,     -- boolean (for share links)
  createdAt    INTEGER NOT NULL,
  updatedAt    INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (templateId) REFERENCES template(id) ON DELETE SET NULL
);

CREATE INDEX idx_project_user ON project(userId, updatedAt DESC);
CREATE INDEX idx_project_public ON project(isPublic) WHERE isPublic = 1;
```

---

### 1.4 Project Share Links

```sql
CREATE TABLE project_share (
  id           TEXT PRIMARY KEY,               -- nanoid (used as share token)
  projectId    TEXT NOT NULL,
  createdByUserId TEXT NOT NULL,
  permission   TEXT NOT NULL DEFAULT 'view',   -- 'view' | 'comment' | 'edit'
  password     TEXT,                           -- hashed, optional
  expiresAt    INTEGER,                        -- unix timestamp, null = never
  isRevoked    INTEGER NOT NULL DEFAULT 0,
  viewCount    INTEGER NOT NULL DEFAULT 0,
  createdAt    INTEGER NOT NULL,
  FOREIGN KEY (projectId) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (createdByUserId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_share_project ON project_share(projectId);
```

---

### 1.5 Project Collaborators

```sql
CREATE TABLE project_collaborator (
  id         TEXT PRIMARY KEY,
  projectId  TEXT NOT NULL,
  userId     TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'editor',   -- 'viewer' | 'commenter' | 'editor' | 'owner'
  invitedBy  TEXT NOT NULL,
  acceptedAt INTEGER,
  createdAt  INTEGER NOT NULL,
  UNIQUE(projectId, userId),
  FOREIGN KEY (projectId) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_collab_project ON project_collaborator(projectId);
CREATE INDEX idx_collab_user ON project_collaborator(userId);
```

---

### 1.6 Assets (Media Files)

```sql
CREATE TABLE asset (
  id           TEXT PRIMARY KEY,               -- nanoid
  projectId    TEXT NOT NULL,
  userId       TEXT NOT NULL,
  type         TEXT NOT NULL,                  -- 'video' | 'audio' | 'image' | 'font'
  name         TEXT NOT NULL,
  r2Key        TEXT NOT NULL UNIQUE,           -- R2 object key
  url          TEXT NOT NULL,                  -- public CDN URL
  thumbnailUrl TEXT,                           -- R2 URL for video thumbnail
  mimeType     TEXT NOT NULL,
  sizeBytes    INTEGER NOT NULL,
  durationMs   INTEGER,                        -- milliseconds (video/audio)
  width        INTEGER,                        -- pixels (video/image)
  height       INTEGER,                        -- pixels (video/image)
  fps          REAL,                           -- video fps
  hasTranscript INTEGER NOT NULL DEFAULT 0,    -- boolean
  createdAt    INTEGER NOT NULL,
  FOREIGN KEY (projectId) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_asset_project ON asset(projectId, createdAt DESC);
CREATE INDEX idx_asset_user ON asset(userId);
```

---

### 1.7 Transcripts

```sql
CREATE TABLE transcript (
  id         TEXT PRIMARY KEY,
  assetId    TEXT NOT NULL UNIQUE,
  language   TEXT NOT NULL DEFAULT 'en',
  fullText   TEXT NOT NULL,
  words      TEXT NOT NULL,                    -- JSON: TranscriptWord[]
  segments   TEXT NOT NULL,                    -- JSON: TranscriptSegment[]
  createdAt  INTEGER NOT NULL,
  FOREIGN KEY (assetId) REFERENCES asset(id) ON DELETE CASCADE
);

-- Translated transcripts (one per language per asset)
CREATE TABLE transcript_translation (
  id           TEXT PRIMARY KEY,
  transcriptId TEXT NOT NULL,
  language     TEXT NOT NULL,
  segments     TEXT NOT NULL,                  -- JSON: translated segments
  createdAt    INTEGER NOT NULL,
  UNIQUE(transcriptId, language),
  FOREIGN KEY (transcriptId) REFERENCES transcript(id) ON DELETE CASCADE
);
```

---

### 1.8 AI Jobs

```sql
CREATE TABLE ai_job (
  id          TEXT PRIMARY KEY,               -- nanoid
  projectId   TEXT NOT NULL,
  userId      TEXT NOT NULL,
  type        TEXT NOT NULL,                  -- AIJobType enum value
  status      TEXT NOT NULL DEFAULT 'queued', -- 'queued'|'processing'|'completed'|'failed'
  progress    INTEGER NOT NULL DEFAULT 0,     -- 0–100
  payload     TEXT NOT NULL,                  -- JSON: job input params
  result      TEXT,                           -- JSON: job output (on completion)
  errorMessage TEXT,
  queueMessageId TEXT,                        -- Cloudflare Queue message ID
  createdAt   INTEGER NOT NULL,
  startedAt   INTEGER,
  completedAt INTEGER,
  FOREIGN KEY (projectId) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_job_project ON ai_job(projectId, createdAt DESC);
CREATE INDEX idx_ai_job_status ON ai_job(status) WHERE status IN ('queued', 'processing');
CREATE INDEX idx_ai_job_user ON ai_job(userId, createdAt DESC);
```

---

### 1.9 Comments

```sql
CREATE TABLE comment (
  id        TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  authorId  TEXT NOT NULL,
  timecode  REAL NOT NULL,                    -- seconds on timeline
  text      TEXT NOT NULL,
  resolved  INTEGER NOT NULL DEFAULT 0,       -- boolean
  resolvedBy TEXT,
  resolvedAt INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (projectId) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (authorId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE comment_reply (
  id        TEXT PRIMARY KEY,
  commentId TEXT NOT NULL,
  authorId  TEXT NOT NULL,
  text      TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (commentId) REFERENCES comment(id) ON DELETE CASCADE,
  FOREIGN KEY (authorId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_comment_project ON comment(projectId, timecode);
```

---

### 1.10 Version History

```sql
CREATE TABLE project_version (
  id         TEXT PRIMARY KEY,
  projectId  TEXT NOT NULL,
  createdById TEXT NOT NULL,
  label      TEXT,                            -- user-named versions: "Before client review"
  stateUrl   TEXT NOT NULL,                   -- R2 key for this version's project JSON
  isAutoSave INTEGER NOT NULL DEFAULT 1,      -- boolean
  createdAt  INTEGER NOT NULL,
  FOREIGN KEY (projectId) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (createdById) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_version_project ON project_version(projectId, createdAt DESC);
```

---

### 1.11 Templates

```sql
CREATE TABLE template (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL,
  tags         TEXT NOT NULL DEFAULT '[]',    -- JSON: string[]
  aspectRatio  TEXT NOT NULL,
  duration     REAL NOT NULL,
  thumbnailUrl TEXT NOT NULL,
  previewVideoUrl TEXT,
  stateUrl     TEXT NOT NULL,                 -- R2 key for template project JSON
  placeholders TEXT NOT NULL DEFAULT '[]',   -- JSON: Placeholder[]
  isPro        INTEGER NOT NULL DEFAULT 0,
  isOfficial   INTEGER NOT NULL DEFAULT 1,
  isPublished  INTEGER NOT NULL DEFAULT 0,    -- false until approved
  usageCount   INTEGER NOT NULL DEFAULT 0,
  authorId     TEXT,                          -- null for official templates
  submittedByUserId TEXT,                     -- who submitted for community templates
  reviewStatus TEXT DEFAULT 'approved',       -- 'pending'|'approved'|'rejected'
  reviewNote   TEXT,
  createdAt    INTEGER NOT NULL,
  updatedAt    INTEGER NOT NULL,
  FOREIGN KEY (authorId) REFERENCES user(id) ON DELETE SET NULL,
  FOREIGN KEY (submittedByUserId) REFERENCES user(id) ON DELETE SET NULL
);

CREATE INDEX idx_template_category ON template(category, isPublished);
CREATE INDEX idx_template_slug ON template(slug);
CREATE INDEX idx_template_review ON template(reviewStatus) WHERE reviewStatus = 'pending';
```

---

### 1.12 Brand Kit

```sql
CREATE TABLE brand_kit (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL,
  name      TEXT NOT NULL DEFAULT 'My Brand',
  logoUrl   TEXT,
  colors    TEXT NOT NULL DEFAULT '[]',       -- JSON: BrandColor[]
  fonts     TEXT NOT NULL DEFAULT '[]',       -- JSON: BrandFont[]
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_brand_kit_user ON brand_kit(userId);
```

---

### 1.13 Export Jobs

```sql
CREATE TABLE export_job (
  id          TEXT PRIMARY KEY,
  projectId   TEXT NOT NULL,
  userId      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',  -- 'queued'|'processing'|'completed'|'failed'
  progress    INTEGER NOT NULL DEFAULT 0,
  settings    TEXT NOT NULL,                   -- JSON: ExportSettings
  outputUrl   TEXT,                            -- R2 URL of final MP4
  outputSizeBytes INTEGER,
  errorMessage TEXT,
  createdAt   INTEGER NOT NULL,
  completedAt INTEGER,
  expiresAt   INTEGER,                         -- signed URL expiry
  FOREIGN KEY (projectId) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_export_user ON export_job(userId, createdAt DESC);
```

---

## 2. R2 Storage Layout

All objects stored in the `openfield-assets` R2 bucket with the following key structure:

```
openfield-assets/
├── users/
│   └── {userId}/
│       └── avatar.jpg
│
├── projects/
│   └── {projectId}/
│       ├── thumbnail.jpg              ← project thumbnail
│       ├── state.json                 ← project state (if > 100KB)
│       └── versions/
│           └── {versionId}.json       ← version snapshots
│
├── assets/
│   └── {userId}/
│       └── {assetId}/
│           ├── original.{ext}         ← uploaded file
│           ├── thumbnail.jpg          ← video thumbnail
│           └── proxy.mp4              ← proxy resolution (720p) for preview
│
├── exports/
│   └── {userId}/
│       └── {exportJobId}.mp4          ← rendered export
│
├── templates/
│   └── {templateId}/
│       ├── thumbnail.jpg
│       ├── preview.mp4                ← 5s silent preview loop
│       └── project.json               ← template project state
│
└── brand/
    └── {userId}/
        └── {brandKitId}/
            └── logo.{ext}
```

---

## 3. Cloudflare KV Namespaces

```
OPENFIELD_KV
├── session:{token}                    → cached session data (TTL: 1h)
├── rate_limit:{userId}:{endpoint}     → request count (TTL: 1min)
├── plan:{userId}                      → cached plan data (TTL: 5min)
├── template_gallery_cache             → cached template list JSON (TTL: 10min)
└── feature_flags                      → JSON feature flag config
```

---

## 4. API Route Design

### Base URL
- Dev: `http://localhost:8787`
- Prod: `https://api.openfield.app`

### Authentication
All protected routes require `Authorization: Bearer {session_token}` header.  
Better-Auth middleware validates the token and injects `ctx.user` into request context.

---

### 4.1 Auth Routes (Better-Auth handles these automatically)

```
POST   /api/auth/sign-up/email
POST   /api/auth/sign-in/email
POST   /api/auth/sign-in/social
POST   /api/auth/sign-out
GET    /api/auth/session
POST   /api/auth/verify-email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

---

### 4.2 Projects

```
GET    /api/projects
  Query: page, limit, sort (updatedAt|createdAt)
  Response: { projects: Project[], total, page, hasMore }

POST   /api/projects
  Body: { name, aspectRatio, fps, templateId? }
  Response: { project: Project }

GET    /api/projects/:id
  Response: { project: Project, state: ProjectState }

PUT    /api/projects/:id
  Body: { name?, aspectRatio?, fps?, state?, thumbnailUrl? }
  Response: { project: Project }

DELETE /api/projects/:id
  Response: 204

POST   /api/projects/:id/duplicate
  Response: { project: Project }   ← new copy

GET    /api/projects/:id/versions
  Response: { versions: ProjectVersion[] }

POST   /api/projects/:id/versions
  Body: { label? }
  Response: { version: ProjectVersion }

POST   /api/projects/:id/versions/:versionId/restore
  Response: { project: Project }   ← restores as current state
```

---

### 4.3 Assets

```
POST   /api/assets/upload-url
  Body: { projectId, filename, mimeType, sizeBytes }
  Response: { uploadUrl: string, assetId: string, r2Key: string }
  Note: returns pre-signed R2 PUT URL valid for 15 minutes

POST   /api/assets
  Body: { projectId, assetId, name, type, r2Key, url, mimeType, sizeBytes, durationMs?, width?, height?, fps? }
  Response: { asset: Asset }

GET    /api/assets?projectId=:id
  Response: { assets: Asset[] }

DELETE /api/assets/:id
  Response: 204
  Note: deletes R2 object + D1 record; updates user storage usage

GET    /api/assets/:id/transcript
  Response: { transcript: Transcript | null }
```

---

### 4.4 AI Jobs

```
POST   /api/ai/jobs
  Body: { type: AIJobType, projectId, payload: { ... } }
  Auth: validates plan limits (AI minutes)
  Response: { job: AIJob }

GET    /api/ai/jobs/:id
  Response: { job: AIJob }
  Note: used for polling; returns progress + result when complete

GET    /api/ai/jobs?projectId=:id
  Response: { jobs: AIJob[] }

DELETE /api/ai/jobs/:id
  Response: 204  (cancel a queued/processing job)

POST   /api/ai/director
  Body: { projectId, prompt, context: EditorContext }
  Auth: Pro plan only (or use AI minutes)
  Response: { plan: EditPlan }   ← streaming (SSE) response
  Note: streams Claude response as Server-Sent Events
```

**Rate limits (enforced via KV):**
- Free: 5 AI jobs/day, 30 min transcription/month
- Pro: 100 AI jobs/day, unlimited transcription

---

### 4.5 Stock Footage Proxy

```
GET    /api/stock/search
  Query: q (search term), page, per_page, type (video|photo)
  Response: { results: StockClip[], total }
  Note: proxies Pexels API (key kept server-side)

POST   /api/stock/import
  Body: { projectId, stockUrl, stockId, name, type }
  Response: { asset: Asset }
  Note: downloads from Pexels/Pixabay → uploads to R2 → creates asset record
```

---

### 4.6 Templates

```
GET    /api/templates
  Query: category?, aspectRatio?, isPro?, q?, page, limit
  Response: { templates: Template[], total, categories }
  Note: response cached in KV for 10 minutes

GET    /api/templates/featured
  Response: { templates: Template[] }   ← curated list (max 12)

GET    /api/templates/:idOrSlug
  Response: { template: Template, state: ProjectState }

POST   /api/templates/use/:id
  Body: { name }
  Response: { project: Project }   ← new project cloned from template

POST   /api/templates
  Auth: admin only
  Body: { ... full template fields ... }
  Response: { template: Template }

POST   /api/templates/submit
  Auth: any user
  Body: { projectId, name, description, category, tags, placeholders }
  Response: { template: Template }   ← status: 'pending'

PUT    /api/admin/templates/:id/review
  Auth: admin only
  Body: { status: 'approved' | 'rejected', note? }
  Response: { template: Template }
```

---

### 4.7 Collaboration

```
GET    /api/projects/:id/collaborators
  Response: { collaborators: Collaborator[] }

POST   /api/projects/:id/collaborators/invite
  Body: { email, role }
  Response: { collaborator: Collaborator }

PUT    /api/projects/:id/collaborators/:userId
  Body: { role }
  Response: { collaborator: Collaborator }

DELETE /api/projects/:id/collaborators/:userId
  Response: 204

GET    /api/projects/:id/share
  Response: { shares: ProjectShare[] }

POST   /api/projects/:id/share
  Body: { permission, password?, expiresAt? }
  Response: { share: ProjectShare, url: string }

DELETE /api/projects/:id/share/:shareId
  Response: 204

GET    /api/share/:token
  Response: { project: Project, permission: string }   ← public, no auth required

GET    /api/projects/:id/comments
  Response: { comments: Comment[] }

POST   /api/projects/:id/comments
  Body: { timecode, text }
  Response: { comment: Comment }

PUT    /api/comments/:id
  Body: { text?, resolved? }
  Response: { comment: Comment }

DELETE /api/comments/:id
  Response: 204

POST   /api/comments/:id/replies
  Body: { text }
  Response: { reply: CommentReply }
```

---

### 4.8 Brand Kit

```
GET    /api/brand-kits
  Response: { brandKits: BrandKit[] }

POST   /api/brand-kits
  Body: { name, colors, fonts }
  Response: { brandKit: BrandKit }

PUT    /api/brand-kits/:id
  Body: { name?, logoUrl?, colors?, fonts? }
  Response: { brandKit: BrandKit }

DELETE /api/brand-kits/:id
  Response: 204

POST   /api/brand-kits/:id/logo-upload-url
  Response: { uploadUrl, logoKey }
```

---

### 4.9 Exports

```
POST   /api/exports
  Body: { projectId, settings: ExportSettings }
  Auth: validates plan (4K requires Pro, watermark added for free)
  Response: { job: ExportJob }

GET    /api/exports/:id
  Response: { job: ExportJob }   ← poll for progress + outputUrl

GET    /api/exports?projectId=:id
  Response: { jobs: ExportJob[] }
```

---

### 4.10 Billing (Stripe)

```
GET    /api/billing/plans
  Response: { plans: Plan[] }   ← public, no auth

GET    /api/billing/subscription
  Auth: required
  Response: { subscription: UserSubscription }

POST   /api/billing/checkout
  Body: { planId, successUrl, cancelUrl }
  Response: { checkoutUrl: string }   ← Stripe Checkout URL

POST   /api/billing/portal
  Response: { portalUrl: string }   ← Stripe Customer Portal URL

POST   /api/billing/webhooks
  Auth: Stripe-Signature header (not user auth)
  Body: raw Stripe event
  Response: 200
```

---

### 4.11 User / Settings

```
GET    /api/user/me
  Response: { user: User, profile: UserProfile }

PUT    /api/user/me
  Body: { name?, image? }
  Response: { user: User }

GET    /api/user/usage
  Response: { storageUsedBytes, storageQuotaBytes, aiMinutesUsed, aiMinutesQuota }

DELETE /api/user/me
  Response: 204   ← deletes all data (GDPR compliance)
```

---

## 5. Error Response Format

All API errors follow a consistent format:

```typescript
interface APIError {
  error: {
    code: string      // machine-readable: "NOT_FOUND", "PLAN_LIMIT_EXCEEDED"
    message: string   // human-readable: "This project was not found"
    details?: unknown // optional extra info
  }
  status: number      // HTTP status code
}
```

**Standard error codes:**
```
400  INVALID_REQUEST         — missing/invalid fields
401  UNAUTHORIZED            — not logged in
403  FORBIDDEN               — logged in but no permission
403  PLAN_LIMIT_EXCEEDED     — free plan limit hit
404  NOT_FOUND               — resource doesn't exist
409  CONFLICT                — duplicate (e.g. existing email)
413  FILE_TOO_LARGE          — upload exceeds size limit
415  UNSUPPORTED_MEDIA_TYPE  — wrong file format
429  RATE_LIMITED            — too many requests
500  INTERNAL_ERROR          — unexpected server error
503  AI_SERVICE_UNAVAILABLE  — upstream AI API down
```

---

## 6. Elysia Route Organization (`apps/api/src`)

```
apps/api/src/
├── index.ts              ← main entry, mounts all routes
├── auth.ts               ← Better-Auth config
├── middleware/
│   ├── auth.ts           ← session validation middleware
│   ├── plan-limits.ts    ← enforce plan quotas
│   └── rate-limit.ts     ← KV-based rate limiting
├── routes/
│   ├── projects.ts
│   ├── assets.ts
│   ├── ai-jobs.ts
│   ├── ai-director.ts
│   ├── stock.ts
│   ├── templates.ts
│   ├── comments.ts
│   ├── share.ts
│   ├── brand-kit.ts
│   ├── exports.ts
│   ├── billing.ts
│   ├── user.ts
│   └── admin.ts
├── workers/
│   ├── ai-jobs/
│   │   ├── transcribe.ts
│   │   ├── captions.ts
│   │   ├── silence-removal.ts
│   │   ├── translate-captions.ts
│   │   ├── voice-cleanup.ts
│   │   ├── voice-dub.ts
│   │   ├── color-grade.ts
│   │   ├── broll-suggest.ts
│   │   ├── script-to-video.ts
│   │   └── background-remove.ts
│   └── export.ts         ← server-side FFmpeg render worker
├── lib/
│   ├── db.ts             ← D1 query helpers
│   ├── r2.ts             ← R2 upload/download/delete helpers
│   ├── stripe.ts
│   ├── audio-extract.ts
│   ├── director-prompt.ts
│   └── semantic-search.ts
└── durable-objects/
    └── project-session.ts  ← Yjs Durable Object for collab
```

---

## 7. Wrangler Config (`apps/api/wrangler.jsonc`)

Required bindings to add:

```jsonc
{
  "name": "openfield-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-06-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "openfield",
      "database_id": "<YOUR_D1_DATABASE_ID>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "ASSETS",
      "bucket_name": "openfield-assets"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "<YOUR_KV_NAMESPACE_ID>"
    }
  ],
  "queues": {
    "producers": [
      { "binding": "AI_QUEUE", "queue": "openfield-ai-jobs" },
      { "binding": "EXPORT_QUEUE", "queue": "openfield-exports" }
    ],
    "consumers": [
      {
        "queue": "openfield-ai-jobs",
        "max_batch_size": 5,
        "max_batch_timeout": 30
      },
      {
        "queue": "openfield-exports",
        "max_batch_size": 2,
        "max_batch_timeout": 60
      }
    ]
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "PROJECT_SESSION",
        "class_name": "ProjectSession"
      }
    ]
  },
  "vars": {
    "ENVIRONMENT": "production"
  }
  // Secrets (set via wrangler secret put):
  // OPENAI_API_KEY
  // ANTHROPIC_API_KEY
  // ELEVENLABS_API_KEY
  // PEXELS_API_KEY
  // STRIPE_SECRET_KEY
  // STRIPE_WEBHOOK_SECRET
  // BETTER_AUTH_SECRET
  // FAL_KEY
}
```

---

## 8. Environment Variables (`apps/web/.env`)

```bash
# Auth
VITE_API_URL=http://localhost:8787
VITE_BETTER_AUTH_URL=http://localhost:8787

# Feature Flags
VITE_ENABLE_AI=true
VITE_ENABLE_COLLAB=false

# External services (public keys only — never put secrets in web env)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 9. Database Migration Strategy

Since Cloudflare D1 doesn't have a built-in migration runner, use a simple numbered migration file system:

```
apps/api/migrations/
├── 0001_initial_auth.sql          ← Better-Auth tables
├── 0002_user_profile.sql
├── 0003_projects.sql
├── 0004_assets.sql
├── 0005_transcripts.sql
├── 0006_ai_jobs.sql
├── 0007_comments.sql
├── 0008_versions.sql
├── 0009_templates.sql
├── 0010_brand_kit.sql
├── 0011_exports.sql
├── 0012_collaboration.sql
└── 0013_billing.sql
```

Run migrations:
```bash
# Dev
wrangler d1 execute openfield --local --file=migrations/0001_initial_auth.sql

# Production
wrangler d1 execute openfield --file=migrations/0001_initial_auth.sql
```

Add a `moon.yml` task to run all pending migrations:
```yaml
tasks:
  db:migrate:
    command: 'for file in migrations/*.sql; do wrangler d1 execute openfield --file="$file"; done'
```
