# OpenField

**A free, browser-based video editor — with an AI layer on top.**

Professional video editing in your browser. No uploads, no installs, no watermarks.
An AI-first editing experience is layered on top of a rock-solid manual editor.

![License](https://img.shields.io/badge/License-MIT-green)

---

## Credits & Attribution

OpenField is built on top of **[OpenReel Video](https://github.com/Augani/openreel-video)**,
an open-source browser video editor.

- **OpenReel Video** — MIT License, © 2024-2026 **Augustus Otu and Contributors**
- The original MIT license is preserved in [`LICENSE`](LICENSE).

OpenField adds its own branding, dashboard, UX refinements, and (in progress) an
agentic AI video-editing layer on top of the OpenReel editor core.

Internal package names (`@openreel/*`) are intentionally retained from upstream —
they are implementation details, and keeping them makes it easy to pull upstream
improvements.

---

## Development

Requires Node 18+ and pnpm.

```sh
pnpm install
pnpm --filter @openreel/core build:wasm   # build audio WASM modules (fft/wav/beat)
pnpm --filter @openreel/web dev            # http://localhost:5173
```

## Architecture

- `apps/web` — the editor + dashboard (React, TypeScript, WebCodecs, WebGPU)
- `apps/desktop` — desktop shell
- `packages/*` — core engine, UI kit, and the AI agent packages

## License

[MIT](LICENSE) — same terms as upstream OpenReel Video.
