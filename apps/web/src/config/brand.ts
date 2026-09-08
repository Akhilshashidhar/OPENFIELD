/**
 * OpenField brand configuration — single source of truth for the product name
 * shown across the UI (editor header, dashboard, dialogs, etc.).
 *
 * OpenField is built on the open-source OpenReel Video editor (MIT License,
 * © 2024-2026 Augustus Otu and Contributors). Internal package names
 * (@openreel/*) are intentionally left unchanged — they are implementation
 * details and renaming them provides no user value while risking regressions.
 */
export const BRAND = {
  /** Product display name */
  name: "OpenField",
  /** Short wordmark shown next to the logo */
  wordmark: "OpenField",
  /** Full title used in the browser tab / meta */
  fullTitle: "OpenField — Video Editor",
  tagline: "Turn your ideas into incredible videos",
  /** Attribution — keep visible per MIT license */
  builtOn: "Built on OpenReel Video (MIT) by Augustus Otu & Contributors",
} as const
