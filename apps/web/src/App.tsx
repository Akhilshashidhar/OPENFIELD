import { useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { ToastContainer } from "./components/Toast";
import { ScriptViewDialog } from "./components/editor/ScriptViewDialog";
import { SearchModal } from "./components/editor/SearchModal";
import { MobileBlocker } from "./components/MobileBlocker";
import { WelcomeScreen } from "./components/welcome";
import { Dashboard } from "./components/dashboard/Dashboard";
import { AuthScreen } from "./components/auth/AuthScreen";
import { LandingPage } from "./components/landing/LandingPage";
import { useAuthStore } from "./stores/auth-store";
import { RecoveryDialog } from "./components/welcome/RecoveryDialog";
import { SharePage } from "./pages/SharePage";
import { useUIStore } from "./stores/ui-store";
import { useProjectStore } from "./stores/project-store";
import { useRouter } from "./hooks/use-router";
import { useProjectRecovery } from "./hooks/useProjectRecovery";
import { trackEvent } from "./hooks/useAnalytics";
import { useKieAIPoller } from "./hooks/useKieAIPoller";
import { SOCIAL_MEDIA_PRESETS, type SocialMediaCategory } from "@openfield/core";
import { ToolcraftText as Text } from "@openfield/ui";

const EditorInterface = lazy(() =>
  import("./components/editor/EditorInterface").then((m) => ({
    default: m.EditorInterface,
  }))
);
const MotionCreatorApp = lazy(() =>
  import("./motion/MotionCreatorApp").then((module) => ({
    default: module.MotionCreatorApp,
  }))
);

const LoadingSpinner: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-screen w-screen bg-background flex flex-col items-center justify-center">
    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
    <Text type="supporting" color="secondary" className="text-sm text-text-secondary">{message}</Text>
  </div>
);

const PRESET_DIMENSIONS: Record<string, SocialMediaCategory> = {
  "1080x1920": "tiktok",
  "1920x1080": "youtube-video",
  "1080x1080": "instagram-post",
  "720x1280": "instagram-stories",
  "1280x720": "youtube-video",
};

function App() {
  const { activeModal, closeModal, skipWelcomeScreen } = useUIStore();
  const { openModal: openSearchModal } = useUIStore();
  const createNewProject = useProjectStore((state) => state.createNewProject);
  const { showDialog, availableSaves, recover, dismiss, clearAll } = useProjectRecovery();

  const { route, params, navigate, parsedDimensions, fps } = useRouter();
  const initializeAuth = useAuthStore((s) => s.initialize);
  const authConfigured = useAuthStore((s) => s.configured);
  const authLoading = useAuthStore((s) => s.loading);
  const hasSession = useAuthStore((s) => Boolean(s.session));
  const hasHandledInitialRoute = useRef(false);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  // Analytics: record a page view whenever the route changes.
  useEffect(() => {
    trackEvent("page_view", { route });
  }, [route]);
  const isMotionHost =
    typeof window !== "undefined" &&
    window.location.hostname.startsWith("motion.");
  const isMotionSurface = isMotionHost || route === "motion";

  useKieAIPoller();

  useEffect(() => {
    if (hasHandledInitialRoute.current) return;

    if (isMotionSurface) {
      hasHandledInitialRoute.current = true;
    } else if (route === "welcome") {
      // OpenField: the home route shows the Dashboard (no format picker).
      // New Project / template actions on the dashboard create a project and
      // route to the editor. Nothing to auto-create here.
      hasHandledInitialRoute.current = true;
    } else if (route === "new") {
      hasHandledInitialRoute.current = true;

      let projectName = "New Project";
      let width = 1920;
      let height = 1080;
      let frameRate = fps;

      if (params.preset) {
        const presetKey = params.preset as SocialMediaCategory;
        const preset = SOCIAL_MEDIA_PRESETS[presetKey];
        if (preset) {
          width = preset.width;
          height = preset.height;
          frameRate = preset.frameRate || fps;
          projectName = `New ${presetKey.charAt(0).toUpperCase() + presetKey.slice(1).replace(/-/g, " ")} Project`;
        }
      } else if (parsedDimensions) {
        width = parsedDimensions.width;
        height = parsedDimensions.height;

        const dimensionKey = `${width}x${height}`;
        const matchingPreset = PRESET_DIMENSIONS[dimensionKey];
        if (matchingPreset) {
          const preset = SOCIAL_MEDIA_PRESETS[matchingPreset];
          frameRate = preset.frameRate || fps;
        }

        const aspectRatio = width / height;
        if (aspectRatio < 1) {
          projectName = "New Vertical Video";
        } else if (aspectRatio > 1) {
          projectName = "New Horizontal Video";
        } else {
          projectName = "New Square Video";
        }
      }

      createNewProject(projectName, { width, height, frameRate });
      navigate("editor");
    } else if (route === "editor" && skipWelcomeScreen) {
      hasHandledInitialRoute.current = true;
    } else if (["welcome", "auth", "templates", "recent"].includes(route)) {
      hasHandledInitialRoute.current = true;
    }
  }, [
    route,
    isMotionSurface,
    params,
    parsedDimensions,
    fps,
    createNewProject,
    navigate,
    skipWelcomeScreen,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && route !== "editor") {
        navigate("editor");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearchModal("search");
      }
    },
    [route, navigate, openSearchModal],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // OpenField: the home ("welcome") route shows the Dashboard. The explicit
  // templates/recent routes still use the WelcomeScreen (template gallery /
  // recent list). Everything else is the editor.
  const showAuth = route === "auth";
  // While the backend is configured we must wait for the initial session
  // lookup to finish before deciding landing-vs-dashboard. Otherwise a
  // just-logged-in user (esp. after an OAuth redirect back to #/welcome) would
  // briefly have no session loaded yet and get bounced to the landing page.
  const authResolving = authConfigured && authLoading;
  // On the home route: logged-out visitors (when a backend is configured) see
  // the marketing Landing page; everyone else sees the Dashboard.
  const showAuthLoading = route === "welcome" && authResolving;
  const showLanding =
    route === "welcome" && authConfigured && !authLoading && !hasSession;
  const showDashboard =
    route === "welcome" && !showLanding && !showAuthLoading;
  const showWelcome =
    ["templates", "recent"].includes(route) && !skipWelcomeScreen;
  const initialTab =
    route === "templates"
      ? "templates"
      : route === "recent"
        ? "recent"
        : undefined;
  const isSharePage = route === "share" && params.shareId;

  return (
    <div className="h-screen w-screen bg-background text-text-primary overflow-hidden">
      <MobileBlocker />
      {isMotionSurface ? (
        <Suspense fallback={<LoadingSpinner message="Loading Motion Creator..." />}>
          <MotionCreatorApp />
        </Suspense>
      ) : isSharePage ? (
        <SharePage shareId={params.shareId!} />
      ) : showAuth ? (
        <AuthScreen initialMode={params.mode === "signup" ? "signup" : "signin"} />
      ) : showAuthLoading ? (
        <LoadingSpinner message="Signing you in…" />
      ) : showLanding ? (
        <LandingPage />
      ) : showDashboard ? (
        <Dashboard />
      ) : showWelcome ? (
        <WelcomeScreen initialTab={initialTab} />
      ) : (
        <Suspense fallback={<LoadingSpinner message="Loading editor..." />}>
          <EditorInterface />
        </Suspense>
      )}
      <ToastContainer />
      <ScriptViewDialog
        isOpen={activeModal === "scriptView"}
        onClose={closeModal}
      />
      <SearchModal isOpen={activeModal === "search"} onClose={closeModal} />
      {showDialog && availableSaves.length > 0 && (
        <RecoveryDialog
          saves={availableSaves}
          onRecover={async (saveId) => {
            const success = await recover(saveId);
            if (success) navigate("editor");
          }}
          onDismiss={dismiss}
          onClearAll={clearAll}
        />
      )}
    </div>
  );
}

export default App;
