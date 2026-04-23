export interface DesktopHandIndicatorLayout {
  mode: "single" | "row" | "fan";
  minWidth: number;
}

export function getDesktopHandIndicatorLayout(indicatorCount?: number): DesktopHandIndicatorLayout;
