import React, { useCallback } from "react";
import {
  ToolcraftDropdownMenu as DropdownMenu,
  ToolcraftIconButton as IconButton,
  ToolcraftTooltip as Tooltip,
} from "@openreel/ui";
import { Icon } from "@/icons/Icon";
import {
  House,
  Sun,
  Moon,
  SunMoon,
  Settings,
  Circle,
  Play,
  Sparkles,
  HelpCircle,
  FileCode,
  Command,
} from "@/icons/lucide-compat";
import { useProjectStore } from "../../stores/project-store";
import { useUIStore } from "../../stores/ui-store";
import { useThemeStore } from "../../stores/theme-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useRouter } from "../../hooks/use-router";
import {
  startTour,
  ONBOARDING_KEY,
  startMoGraphTour,
  MOGRAPH_TOUR_KEY,
} from "./tour";

const RailButton: React.FC<{
  label: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
  /** short caption shown under the icon (icon+label rail like the reference) */
  caption?: string;
}> = ({ label, icon, onClick, active = false, caption }) => (
  <Tooltip content={label} placement="end">
    <button
      aria-label={label}
      onClick={onClick}
      className={`group flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors ${
        active
          ? "bg-selected text-accent-strong"
          : "text-fg-3 hover:bg-hover hover:text-fg"
      }`}
    >
      <Icon name={icon} size={18} ariaHidden />
      {caption && (
        <span className="text-[9px] font-medium leading-none">{caption}</span>
      )}
    </button>
  </Tooltip>
);

export const EditorActionRail: React.FC = () => {
  const { undo, redo, createMotionComposition } = useProjectStore();
  const {
    openModal,
    toggleKeyframeEditor,
    keyframeEditorOpen,
    panels,
    togglePanel,
    activeModal,
  } = useUIStore();
  const { mode: themeMode, toggleTheme } = useThemeStore();
  const { openSettings } = useSettingsStore();
  const { navigate } = useRouter();

  const themeLabel =
    themeMode === "auto"
      ? "System"
      : themeMode.charAt(0).toUpperCase() + themeMode.slice(1);
  const nextThemeLabel =
    themeMode === "light" ? "Dark" : themeMode === "dark" ? "System" : "Light";
  const themeIcon =
    themeMode === "light" ? (
      <Sun size={16} aria-hidden />
    ) : themeMode === "dark" ? (
      <Moon size={16} aria-hidden />
    ) : (
      <SunMoon size={16} aria-hidden />
    );
  const themeActionLabel = `Theme: ${themeLabel}. Switch to ${nextThemeLabel}`;

  const handleCreateMotionScene = useCallback(async () => {
    const composition = await createMotionComposition("Motion Scene");
    if (composition) {
      navigate("motion", { compositionId: composition.id });
    }
  }, [createMotionComposition, navigate]);

  return (
    <nav
      data-tour="toolbar"
      aria-label="Editor tools"
      className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-1 px-1.5 py-3"
    >
      <Tooltip content="Back to home" placement="end">
        <IconButton
          label="Back to home"
          icon={<House size={16} aria-hidden />}
          size="sm"
          variant="ghost"
          onClick={() => navigate("welcome")}
        />
      </Tooltip>

      <div className="my-1.5 h-px w-6 bg-border" />

      <RailButton
        label="Search tools, effects, or ask AI"
        caption="Search"
        icon="magnifyingglass"
        onClick={() => openModal("search")}
      />
      <RailButton
        label="Undo"
        caption="Undo"
        icon="arrow.uturn.backward"
        onClick={() => void undo()}
      />
      <RailButton
        label="Redo"
        caption="Redo"
        icon="arrow.uturn.forward"
        onClick={() => void redo()}
      />

      <div className="my-1.5 h-px w-8 bg-border" />

      <RailButton
        label="Create Motion Scene"
        caption="Motion"
        icon="cube"
        onClick={() => void handleCreateMotionScene()}
      />
      <RailButton
        label="Action history"
        caption="History"
        icon="clock"
        onClick={() => openModal("history")}
        active={activeModal === "history"}
      />
      <RailButton
        label="Keyframe editor"
        caption="Keys"
        icon="diamond"
        onClick={toggleKeyframeEditor}
        active={keyframeEditorOpen}
      />
      <RailButton
        label="Audio mixer"
        caption="Audio"
        icon="music.note"
        onClick={() => togglePanel("audioMixer")}
        active={Boolean(panels.audioMixer?.visible)}
      />
      {/* AI Editor chat removed for now — returns as the agentic product layer */}
      <RailButton
        label="Project JSON / Comments"
        caption="Code"
        icon="curlybraces"
        onClick={() => openModal("scriptView")}
      />

      <div className="flex-1" />

      <Tooltip content={themeActionLabel} placement="end">
        <IconButton
          label={themeActionLabel}
          icon={themeIcon}
          size="sm"
          variant="secondary"
          onClick={toggleTheme}
        />
      </Tooltip>

      <DropdownMenu
        placement="end"
        button={{
          label: "More editor actions",
          icon: <Icon name="star" size={16} ariaHidden />,
          size: "sm",
          variant: "ghost",
          isIconOnly: true,
        }}
        hasChevron={false}
        menuWidth={224}
        items={[
          {
            label: "Settings & API keys",
            icon: <Settings size={14} aria-hidden />,
            onClick: () => openSettings(),
          },
          {
            label: "Screen recorder",
            icon: (
              <Circle
                size={14}
                className="fill-current text-status-error"
                aria-hidden
              />
            ),
            onClick: () => openModal("recorder"),
          },
          { type: "divider" },
          {
            label: "Editor tour",
            icon: <Play size={14} aria-hidden />,
            onClick: () => {
              localStorage.removeItem(ONBOARDING_KEY);
              startTour();
            },
          },
          {
            label: "Animation & effects tour",
            icon: <Sparkles size={14} className="text-accent" aria-hidden />,
            onClick: () => {
              localStorage.removeItem(MOGRAPH_TOUR_KEY);
              startMoGraphTour();
            },
          },
          { type: "divider" },
          {
            label: "Help & shortcuts (press ?)",
            icon: <HelpCircle size={14} aria-hidden />,
            isDisabled: true,
          },
          {
            label: "Project JSON",
            icon: <FileCode size={14} aria-hidden />,
            isDisabled: true,
          },
          {
            label: "Cmd+K to search",
            icon: <Command size={14} aria-hidden />,
            isDisabled: true,
          },
        ]}
      />
    </nav>
  );
};
