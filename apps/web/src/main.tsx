// IMPORTANT: this side-effect import runs the synchronous localStorage
// migration (OpenReel → OpenField keys) BEFORE any persist store is imported.
import "./services/storage-migration-boot";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "./index.css";
import { AstryxProvider } from "./components/astryx/AstryxProvider";
import { registerServiceWorker } from "./services/service-worker";
import { runStorageMigration } from "./services/storage-migration";
import { initCustomFonts } from "./components/editor/inspector/font-options";
import { setEncoderBackendFactory } from "@openfield/core";
import { NativeFFmpegBackend } from "./services/native-ffmpeg-backend";

const DesktopApp = React.lazy(() =>
  import("./desktop/DesktopApp").then((module) => ({
    default: module.DesktopApp,
  })),
);

const isDesktop =
  typeof window !== "undefined" && window.openreel?.platform === "desktop";

if (isDesktop) {
  setEncoderBackendFactory(
    () =>
      new NativeFFmpegBackend(
        () =>
          (window as { __openreelExportPath?: string }).__openreelExportPath ??
          "",
      ),
  );
}

registerServiceWorker().then((registration) => {
  if (registration) {
  }
});

void initCustomFonts();

const root = document.getElementById("root")!;

async function renderApplication(): Promise<void> {
  // Migrate any legacy OpenReel-era IndexedDB databases to the OpenField
  // namespace before the editor reads them (idempotent, non-destructive-first).
  await runStorageMigration();

  const application: React.ReactNode = isDesktop ? (
        <React.Suspense fallback={<div className="h-screen w-screen bg-bg" />}>
          <DesktopApp />
        </React.Suspense>
      ) : (
        <App />
      );

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AstryxProvider>{application}</AstryxProvider>
    </React.StrictMode>,
  );
}

void renderApplication();
