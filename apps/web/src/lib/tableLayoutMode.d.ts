export interface TableLayoutEnvironment {
  width: number;
  height: number;
  hasCoarsePointer: boolean;
  hasNoHover: boolean;
  maxTouchPoints: number;
}

export function shouldUseMobileTableLayout(
  environment: TableLayoutEnvironment,
): boolean;
