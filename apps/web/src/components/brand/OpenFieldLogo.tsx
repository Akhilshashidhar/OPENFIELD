import type { CSSProperties } from "react";

/**
 * OpenField brand logo — a serif "Openfield" wordmark.
 *
 * The mark and wordmark are the same thing now (a typographic wordmark), so
 * <OpenFieldMark/> and <OpenFieldLogo/> both render the wordmark. The `size`
 * prop drives the font size; `showWordmark` is kept for API compatibility.
 *
 * Color follows the current text color by default (near-black on light
 * surfaces, near-white on dark), so it inverts correctly per theme.
 */

const SERIF_FONT =
  "'Playfair Display', 'DM Serif Display', Georgia, 'Times New Roman', serif";

interface MarkProps {
  /** Font size in px for the wordmark. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** Override the wordmark color (defaults to currentColor / theme text). */
  color?: string;
}

const Wordmark: React.FC<MarkProps> = ({
  size = 22,
  className,
  style,
  title = "Openfield",
  color,
}) => (
  <span
    className={className}
    role="img"
    aria-label={title}
    style={{
      fontFamily: SERIF_FONT,
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1,
      letterSpacing: "-0.01em",
      color: color ?? "currentColor",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    Openfield
  </span>
);

/** Icon-equivalent: renders the wordmark (kept for existing call sites). */
export const OpenFieldMark: React.FC<MarkProps> = (props) => (
  <Wordmark {...props} />
);

interface LogoProps extends MarkProps {
  /** Retained for API compatibility; the logo is a single wordmark. */
  showWordmark?: boolean;
  /** Retained for API compatibility; maps to the wordmark font size. */
  wordmarkSize?: number;
}

export const OpenFieldLogo: React.FC<LogoProps> = ({
  size,
  wordmarkSize,
  showWordmark: _showWordmark,
  className,
  style,
  title,
  color,
}) => (
  <Wordmark
    size={wordmarkSize ?? size ?? 22}
    className={className}
    style={style}
    title={title}
    color={color}
  />
);

export default OpenFieldLogo;
