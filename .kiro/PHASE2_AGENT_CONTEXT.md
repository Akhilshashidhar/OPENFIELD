# OpenField — Phase 2 Context: Agentic AI Video Editor (BYOK)

> READ-ONLY AUDIT DOCUMENT. Produced by a read/audit agent. No code was changed to create this.
> Purpose: give any downstream agent full, grounded context on the existing AI agent system so it can make changes safely. All paths are relative to the repo root `openfield/`. Line numbers are approximate anchors — always re-read before editing.

---

## 0. TL;DR / mental model

- The AI agent is a **self-contained, host-agnostic engine** in `packages/agent/src`, wired into the web editor in `apps/web/src`.
- **The only seam** between engine and app is the `EditingHost` interface (`packages/agent/src/host.ts`).
- **BYOK**: no server-side LLM keys. The user brings an OpenAI-compatible or Anthropic-compatible endpoint + key. Keys live in an encrypted browser vault (`secure-storage.ts`) or the OS keychain on desktop.
- **One turn = one LLM conversation = one undo unit.** The whole turn is wrapped in a transaction that commits normally and rolls back only on a thrown exception.
- **~285 tools across ~20 domains**, ~190 of which are Motion/creation. All declared in a single giant `TOOLS` array in `registry.ts`.
- **No streaming.** Each completion is a single request/response.
- Internally the product is still named **"OpenReel"** in code and prompts (verification token `openreel-verify-v1`, system prompt says "OpenReel's video-editing agent"). The workspace folder is `openfield`. Do NOT rename these as part of feature work — they are intentionally retained (crypto token breaks decryption of migrated keys; desktop IPC contract).

---

## 1. Agent loop — `packages/agent/src/loop.ts`

Entry: `runTurn(input: RunTurnInput)` (~`loop.ts:87`). One call = one user turn.

### Inputs (`RunTurnInput`, ~`loop.ts:13-31`)
`host` (EditingHost), `llm` (LLMClient), `tools` (provider-formatted defs), `system` prompt, `messages` (conversation incl. the new user turn), `confirmGate`, `onEvent`, `limits {maxSteps, maxToolCalls, maxTokens}`, `dryRun`, `turnLabel`.

### Control flow
1. `host.beginTransaction(turnLabel)` opens one undo group (~`loop.ts:111`).
2. `for` loop up to `maxSteps` (default **12**, ~`loop.ts:96`). Each iteration = one LLM completion.
3. **Budget check between steps** (~`loop.ts:117-131`): if `maxTokens` set and cumulative tokens ≥ limit → commit, return `stoppedReason:"budget"`. It is a **soft ceiling** — can overshoot by one completion.
4. `llm.complete({system, messages, tools})` (~`loop.ts:132`); usage accumulated; text emitted via `onEvent({type:"text_delta"})`.
5. **No tool calls** → push assistant msg, commit, emit `turn_complete`, return `end_turn`.
6. **Tool calls present:**
   - **Tool cap** (~`loop.ts:164-190`): once `toolCalls >= maxToolCalls` (default **64**), remaining tool_uses in the batch get a synthetic `MAX_TOOL_CALLS` error result (keeps transcript valid), then break.
   - **Confirm gate** (~`loop.ts:198-224`): if not dryRun, not already approved-for-turn, and tool `isDestructive || isExpensive` → emit `awaiting_confirmation`, await `confirmGate(call)`. `approve_for_turn` sets approve-all; `reject` returns a `REJECTED` error result and continues.
   - **Execution** (~`loop.ts:226-239`): dry-run of a non-readOnly tool → synthetic `[dry-run] would call X`; else `executeTool(name, args, host)`. Result → `tool_result` event → `LoopToolResult` (JSON of `{ok,summary,data,error}`; if tool returns an `image`, an Anthropic-style base64 image block is appended).
7. Loop exhausted → commit, return `max_steps`.

### Transactions & rollback
- `beginTransaction` at start; `commitTransaction` on every normal exit.
- **`rollbackTransaction` ONLY in the `catch`** (~`loop.ts:263-276`). A thrown error rolls back the whole turn, emits `error`, returns `committed:false`.
- **Gotcha:** failed/rejected *tool results* do NOT roll back — only exceptions escaping the loop do.

`StopReason` = `end_turn | max_steps | max_tool_calls | budget | error`.

---

## 2. Tool system — `packages/agent/src/registry.ts` (~31k lines) + `executor.ts`

### Shape
- All tools in one `const TOOLS: RegisteredTool[]` (~`registry.ts:10664`), indexed into `const REGISTRY = new Map(...)` (~`registry.ts:32076`).
- `RegisteredTool` = `ToolDef` + `handler`. `ToolHandler = (args, host) => Promise<ToolResult> | ToolResult`. **There is no `ToolContext` type** — handlers just receive `(args, host)`.

### Accessors (re-exported from `index.ts`)
`getTool`, `listTools`, `toolDefs`, `toAnthropicTools(names?)`, `toOpenAITools(names?)`, `toMcpTools()`, `toCapabilityDoc(names?)`, `selectedTools(names?)`.

### Factories (reduce boilerplate)
- `actionTool(spec)` (~`registry.ts:1946`): builds an `Action` and calls `host.applyAction()`. Default `readOnly:false`.
- `readTool(...)` (~`registry.ts:1975`): `readOnly:true`, pure read of `host.getProject()`.
- `jobTool(...)` (~`registry.ts:10595`): `expensive:true`, delegates to `host.runJob(kind, args)`.
- `overlayRemoveTool(...)` (~`registry.ts:10620`): `destructive:true`.
- Motion/creation tools are mostly full inline object literals.

### Domains (`ToolDomain` in `types.ts:3-24`)
read, project, media, track, clip, transform, effect, color, speed, audio, text, subtitle, graphics, motion, transition, keyframe, marker, ai, export, multicam, raw.

Approx distribution (motion-dominant): **motion ≈190**, clip 11, track 10, multicam 8, audio 7, project 7, graphics 6, speed 6, export 5, subtitle 5, effect 5, read 5, transform 3, media 3, marker 3, transition 3, keyframe 3, raw 2, text 2, color 1. No single `COUNT` constant exists; ~277 declared literals, ~285 effective (helper-generated).

### Example tool definitions
```ts
// action-backed (registry.ts ~15529)
actionTool({ name: "set_clip_speed", domain: "speed", actionType: "clip/setSpeed",
  title: "Set speed", description: "Set clip playback speed (recomputes duration).",
  inputSchema: obj({ clipId: str, speed: num }, ["clipId", "speed"]) })

// full inline object, returns an image (registry.ts ~23743)
{ name: "render_motion_frame", domain: "motion", title: "Render motion frame",
  description: "Render a Motion Creator composition to a still image ... Expensive — requires confirmation.",
  inputSchema: obj({ compositionId: str, timeSeconds: num, scale: num, quality: str }, ["compositionId"]),
  readOnly: false, destructive: false, expensive: true,
  handler: async (args, host) => { host.requireOpenProject(); /* ... */ } }
```
JSON-Schema shorthands `str/num/bool/obj(props, required)` are defined ~`registry.ts:410`.

### Executor — `executor.ts`
`executeTool(name, args, host)` (~`executor.ts:34-53`): lookup (→ `UNKNOWN_TOOL` if missing), run `resolveRefs` (~`executor.ts:11-32`) which **silently rewrites agent-friendly `clipIndex`/`atSec`(+`trackIndex`) → canonical `clipId`** via `resolveClipId`, then `await tool.handler(resolved, host)` in try/catch that converts throws into a `TOOL_ERROR` result.

### Tool routing — `tool-router.ts`
`selectToolsForPrompt(prompt, {maxTools, priorToolNames})` (~`tool-router.ts:66`) trims the registry to a provider-safe subset (`DEFAULT_AGENT_TOOL_LIMIT = 120`). `ALWAYS_AVAILABLE` pins core read/project/motion tools; `MOTION_TERMS`/`CREATION_TERMS` regexes gate the huge motion surface behind keyword intent; `relevance()` scores by word overlap. **Routing only limits schemas sent per turn; the full registry stays executable.**

---

## 3. BYOK LLM transport — `packages/agent/src/llm.ts` + `apps/web/src/services/agent/llm-transport.ts`

### Provider adapters (`llm.ts`, pure, transport-injected)
- Interface `LLMClient.complete(input)` (~`llm.ts:88`); injected transport `LLMSend = (body) => Promise<unknown>` (~`llm.ts:96`).
- **Anthropic:** `buildAnthropicBody` (~`llm.ts:181`) → `{model, max_tokens, system?, messages, tools}`; `parseAnthropicResponse` (~`llm.ts:221`) extracts text + `tool_use`; `AnthropicClient` (~`llm.ts:274`).
- **OpenAI-compatible:** `buildOpenAIBody` (~`llm.ts:284`), assistant `tool_calls` with `function.arguments` JSON-stringified, tool results as `{role:"tool",tool_call_id,content}`, uses `max_completion_tokens`; `parseOpenAIResponse` (~`llm.ts:334`) reads `choices[0].message.tool_calls` (legacy `function_call` fallback); `OpenAIClient` (~`llm.ts:410`).
- `parseToolInput` (~`llm.ts:44`) tolerates double-encoded JSON args.
- `makeClientFromSend(opts)` (~`llm.ts:435`) picks client by provider; honors `omitMaxTokens`.
- **Retries:** `withRetry(send, opts)` (~`llm.ts:203`) — exponential backoff + full jitter on 429/5xx, honors `Retry-After`, abortable. `LLMHttpError` carries status.
- **No streaming** — every completion is one non-streaming request; `text_delta` carries the full text.

### Web BYOK wiring (`llm-transport.ts`)
- `makeBYOKClient(opts)` (~`llm-transport.ts:70`) builds `send` via `makeSend`, wraps with `withRetry`, then `makeClientFromSend`.
- `makeSend` POSTs through `apiFetch(provider, path, apiKey, {...})` from `../api-proxy`:
  - built-ins → same-origin **Cloudflare Pages proxy** (`apps/web/functions/api/proxy/[[catchall]].ts`)
  - custom endpoints → direct browser request
  - desktop → native keychain-backed request
- Paths: OpenAI-compatible → `/chat/completions`; Anthropic-compatible → `/messages`.
- Maps settings provider names `"openai-compatible"`/`"anthropic-compatible"` → agent `"openai"`/`"anthropic"`; sets `omitMaxTokens` for OpenAI-compatible when unset.
- Also reused outside chat by `apps/web/src/motion/components/GenerateShaderBox.tsx:82`.

### Provider/model config — `apps/web/src/stores/settings-store.ts`
- `LlmProvider = "openai-compatible" | "anthropic-compatible"`.
- State: `defaultLlmProvider` (nullable), `llmBaseUrl`, `llmModel`, `agentAutoConfirm`, `agentDryRun`, `mcpAutoAllowTrustedLocal`, `configuredServices`.
- Persisted as `openfield-settings` (version 7, with migrations). API-key *values* are NOT here — only which services are configured.
- `apps/web/src/services/agent/models.ts`: `LLM_MODELS` is **intentionally empty** — the app never invents a model; the user types their own model id. `resolveModel` falls back to blank only.
- `SERVICE_REGISTRY` also lists ElevenLabs, Kie.ai, Freepik (aggregators/TTS) — separate from the LLM agent.

---

## 4. Web wiring — `apps/web/src/stores/chat-store.ts` + `ChatPanel.tsx` + `host-singleton.ts`

The Zustand **chat-store** is the hub. `send(text)` (~`chat-store.ts:145`):
1. Validate open project, provider, model; normalize baseUrl.
2. **Load API key** (~`chat-store.ts:186-207`): if key needed and not desktop → require `isSessionUnlocked()` then `getSecret(provider)`.
3. Append user + placeholder assistant messages; create `AbortController`; bump monotonic `activeSeq` (stale-turn guard).
4. Build `onEvent` (~`chat-store.ts:225-283`): maps `AgentEvent`s onto the assistant `ChatMessage` (text, running/done/error/rejected `ToolCallView` cards, error).
5. Build host/client/tools: `getLiveEditorHost()`, `makeBYOKClient(...)`, `selectToolsForPrompt(routingContext, {maxTools:120, priorToolNames})` (context = last 5 user msgs), then `toAnthropicTools`/`toOpenAITools`.
6. `runExclusive(() => runTurn({ host, llm, tools, system: buildSystemPrompt(host, selectedToolNames), messages: conversation, dryRun, confirmGate, onEvent, turnLabel:"AI edit" }))` (~`chat-store.ts:317-334`). `confirmGate` = auto-approve (`agentAutoConfirm`) OR a Promise that parks the turn (`status:"awaiting_confirm"`, `pendingConfirm`) until `resolveConfirm(decision)`.
7. On completion (guarded by `activeSeq`): write final text, `stopNotice` per `stoppedReason`, updated conversation, `lastTurnCommitted`, `lastTurnUndoSize`, token usage. `undoLastTurn` (~`chat-store.ts:423`) reverts the whole turn via one project-store `undo()`.

### Applying tool calls — `live-host.ts` (`LiveEditorHost`, ~`live-host.ts:147`)
Delegates to the Zustand **project-store**:
- `getProject()` → `useProjectStore.getState().project`
- `applyAction()` → `project-store.executeAction()` (bumps `appliedInTxn`)
- `beginTransaction` → `beginHistoryGroup(label)` + reset counter
- `commitTransaction` → `endHistoryGroup()`
- `rollbackTransaction` → `endHistoryGroup()` then one `undo()` if any actions applied
- Engine-aware overlay methods (`createTextOverlay`, etc.) exist because raw actions only mutate serialized arrays without reaching the Title/Graphics engines.

### `host-singleton.ts`
One shared `LiveEditorHost` (`getLiveEditorHost`) + `runExclusive` (promise-chained mutex) so a chat turn and an external MCP tool call never interleave undo transactions on the same store. **Do not create a second host.**

`ChatPanel.tsx` (`apps/web/src/components/editor/chat/ChatPanel.tsx`) is the React view over the store (messages, tool-call cards, confirm prompt, input).

---

## 5. Key vault / security — `apps/web/src/services/secure-storage.ts`

- Web Crypto + IndexedDB (`openfield-secure` DB; `secrets` + `meta` stores).
- **KDF:** master password → PBKDF2 (**100k iterations, SHA-256**) → AES-GCM-256 key, held **in memory only**.
- **Encryption:** AES-GCM, **unique 12-byte IV per secret**; 16-byte salt in `meta`.
- **`openreel-verify-v1` token** (~`secure-storage.ts:207`): on setup, this known plaintext is encrypted and stored. `unlockSession` re-derives the key and decrypts it; mismatch → wrong password. **Validates the password without storing it. Do NOT rename this string — it breaks unlock/decrypt of migrated keys.**
- **Hardening:** max 5 unlock attempts with exponential backoff; 30-min inactivity auto-lock; `beforeunload` locks + closes DB; `onSessionLock` clears caches (settings-store subscribes).
- **Desktop:** `window.openreel.platform === "desktop"` → native `DesktopKeychain` bypasses the browser vault; session always unlocked.
- **API:** `saveSecret`, `getSecret`, `hasSecret` (never exposes value), `deleteSecret`, `listSecrets` (metadata only), `resetSecureStorage`. Chat-store reads keys via `getSecret(provider)`.

---

## 6. Types & contracts

### `packages/agent/src/types.ts`
- `ToolDef` (~26-35): `{name, domain, title, description, inputSchema, readOnly, destructive, expensive}`.
- `ToolCall` (~37-41): `{id, name, args}`.
- `ToolResult` (~50-58): `{ok, summary, data?, error?:{code,message}, image?:{dataUrl,mimeType?}}`.
- `AgentEvent` (~66-72): `text_delta | tool_call | tool_result | awaiting_confirmation | error | turn_complete`.
- `ConfirmDecision` (~74): `"approve" | "reject" | "approve_for_turn"`.

### `packages/agent/src/llm.ts`
- `LoopMessage` (~76-79): `{role:"user",content}` | `{role:"assistant",content,toolUses}` | `{role:"tool",results}` — the transcript threaded through `runTurn`.
- `LLMToolUse`, `LLMResponse`, `LLMUsage`, `LoopToolResult`/`LoopToolResultBlock` (text+image).

### `packages/agent/src/host.ts`
`EditingHost` (~200) — the seam every tool executes through: `getProject()`, `applyAction(action)`, `beginTransaction/commitTransaction/rollbackTransaction`, `runJob(kind,params)`, `capabilities()`, `requireOpenProject()`, optional `multicam`, plus optional lifecycle/media/motion-export/rigging/overlay methods (headless hosts leave optionals undefined; tools feature-detect + fail clearly). Implemented by `HeadlessHost` (tests) and `LiveEditorHost` (web). Domain model types come from `@openfield/core` (see big import block at top of `registry.ts`).

### System prompt — `packages/agent/src/system-prompt.ts`
`buildSystemPrompt(host, selectedToolNames)` concatenates: base persona ("You are OpenReel's video-editing agent"), general guidelines (times in seconds, read-before-write, prefer specific tool over `execute_action`, destructive tools need confirmation, Markdown responses, no chain-of-thought), a large **Motion Creator** section, a **UI-reconstruction** section, then `Current editor state: <serialized JSON>` and finally `toCapabilityDoc(selectedToolNames)`. The serialized state comes from `serialize.ts:serializeEditorState`.

---

## 7. Tests (validate changes here)

Core loop/executor/LLM:
- `loop.test.ts` (commit, dry-run, events, transactions), `loop-budget.test.ts` (budget stop), `loop-toolcap.test.ts` (tool cap), `executor.test.ts` (lookup, resolveRefs, TOOL_ERROR), `llm.test.ts` (body builders/parsers), `retry.test.ts` (backoff/Retry-After/abort), `serialize-paging.test.ts`, `tool-router.test.ts`, `observability.test.ts`, `gen-docs.test.ts`, `headless-host.test.ts`, `registry-lifecycle.test.ts`.

Registry domain coverage (`registry.*.test.ts`): baseline `registry.test.ts` + multicam, export, render-queue, effect-keyframe, effect-reorder-ripple, expression, layer-ops, mask-path, paths-kf, roving, scene3d-edit, shaders, ai-shader, paper-shaders, text-shader, text-expr, video-shader-effect, shape-contents, comp-level, parity-widening. Creation/3D: `creation-product-motion.test.ts`, `motion-scene3d-lighting.test.ts`.

Web-side (`apps/web/src/services/agent/*.test.ts`): `live-host.test.ts` (host↔store undo), `llm-transport.test.ts` (BYOK send), `model-discovery.test.ts`, `models.test.ts`, `mcp-listener.test.ts` + `.integration.test.ts`, `secure-storage.desktop.test.ts`.

**Guidance:** loop/budget/cap → `loop*.test.ts`; new/changed tools → matching `registry.*.test.ts`; provider/transport → `llm.test.ts` + `llm-transport.test.ts`; host/undo → `live-host.test.ts`; vault → `secure-storage.desktop.test.ts`. Everything runs under Vitest via `HeadlessHost` + `MockLLMClient` — the loop is fully testable without a browser or real LLM.

Run: `pnpm --filter @openfield/agent test:run` and `pnpm --filter @openfield/web test:run` (or `vitest run` inside each package).

---

## 8. Gotchas for a change-making agent

1. **Rollback is exception-only** — failed/rejected tool *results* are committed; only a thrown error rolls back (`loop.ts:263`).
2. **Budget is a soft ceiling** checked between steps — can overshoot by one completion.
3. **No streaming** — `text_delta` carries full completion text.
4. **One shared LiveEditorHost + `runExclusive` mutex** — chat and MCP share undo history; never create a second host.
5. **Tool routing caps schemas at 120/turn**; registry (~285) stays authoritative and executable.
6. **Motion/creation ≈190 of ~285 tools** and dominates the system prompt — highest-risk area to modify.
7. **`resolveRefs` silently rewrites `clipIndex`/`atSec` → `clipId`** before the handler runs.
8. **`registry.ts` is ~31k lines / one array** — edits should be surgical; grep for the tool `name` string to locate.
9. **"OpenReel" naming is intentionally retained** in crypto token, desktop IPC, and prompts. Don't rename as part of feature work.
10. **BYOK model catalog is empty by design** — never hardcode a provider/model.

---

## 9. Key files (ranked)

1. `packages/agent/src/loop.ts` — transactional turn loop (the heart).
2. `packages/agent/src/registry.ts` — the ~285-tool registry + factories + provider formatters.
3. `packages/agent/src/llm.ts` — provider adapters, tool-call formatting, retry, message shapes.
4. `apps/web/src/stores/chat-store.ts` — web orchestration hub.
5. `apps/web/src/services/agent/live-host.ts` + `host-singleton.ts` — EditingHost impl + mutex.
6. `apps/web/src/services/secure-storage.ts` — encrypted BYOK key vault.
7. `packages/agent/src/host.ts` + `types.ts` — contracts.
8. `packages/agent/src/system-prompt.ts` + `serialize.ts` — prompt + state serialization.
9. `apps/web/src/stores/settings-store.ts` + `services/agent/models.ts` — BYOK provider/model config.
10. `apps/web/src/services/agent/executor`/`tool-router` (engine `executor.ts`, `tool-router.ts`) — dispatch + schema selection.
