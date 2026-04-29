import { tokens } from "./tokens";

export const tailwindTheme = {
  screens: {
    xs: "375px",
  },
  colors: {
    felt: tokens.colors.web.felt,
    wood: tokens.colors.web.wood,
    gold: tokens.colors.web.gold,
    chip: tokens.colors.web.chip,
    mobile: tokens.colors.web.mobile,
    pokington: {
      background: tokens.colors.background,
      surface: tokens.colors.surface,
      "surface-muted": tokens.colors.surfaceMuted,
      "surface-subtle": tokens.colors.surfaceSubtle,
      border: tokens.colors.border,
      text: tokens.colors.text,
      muted: tokens.colors.muted,
      accent: tokens.colors.accent,
      danger: tokens.colors.danger,
      felt: tokens.colors.felt,
    },
  },
  spacing: Object.fromEntries(
    Object.entries(tokens.spacing).map(([key, value]) => [key, `${value}px`]),
  ),
  borderRadius: Object.fromEntries(
    Object.entries(tokens.radii).map(([key, value]) => [key, `${value}px`]),
  ),
} as const;
