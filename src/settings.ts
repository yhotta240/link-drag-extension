export const ACTION_LABELS = {
  "foreground-tab": "新しいタブで開く（前面）",
  "background-tab": "新しいタブで開く（背面）",
  "new-window": "新しいウィンドウで開く",
  "current-tab": "現在のタブで開く",
  "copy-url": "URLをコピー",
  none: "割り当てなし",
} as const;

export type DragAction = keyof typeof ACTION_LABELS;
export const DIRECTIONS = [
  "up",
  "up-right",
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface Settings {
  enabled: boolean;
  showIndicator: boolean;
  menuRadius: number;
  directions: Record<Direction, DragAction>;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  showIndicator: true,
  menuRadius: 150,
  directions: {
    up: "background-tab",
    "up-right": "current-tab",
    right: "new-window",
    "down-right": "foreground-tab",
    down: "foreground-tab",
    "down-left": "copy-url",
    left: "copy-url",
    "up-left": "background-tab",
  },
};

export function isDragAction(value: unknown): value is DragAction {
  return typeof value === "string" && Object.keys(ACTION_LABELS).includes(value);
}

export function isDirection(value: unknown): value is Direction {
  return DIRECTIONS.some((direction) => direction === value);
}

/** 同期データの欠落や不正値があっても，有効な設定を返す． */
export function normalizeSettings(value: unknown): Settings {
  const data = value && typeof value === "object" ? (value as Partial<Settings>) : {};
  const settings: Settings = {
    enabled: typeof data.enabled === "boolean" ? data.enabled : DEFAULT_SETTINGS.enabled,
    showIndicator:
      typeof data.showIndicator === "boolean" ? data.showIndicator : DEFAULT_SETTINGS.showIndicator,
    menuRadius:
      Number.isSafeInteger(data.menuRadius) && Number(data.menuRadius) >= 80
        ? Number(data.menuRadius)
        : DEFAULT_SETTINGS.menuRadius,
    directions: { ...DEFAULT_SETTINGS.directions },
  };
  for (const direction of DIRECTIONS) {
    const action = data.directions?.[direction];
    if (isDragAction(action)) settings.directions[direction] = action;
  }
  return settings;
}
