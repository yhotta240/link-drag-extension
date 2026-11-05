import { DEFAULT_SETTINGS, DIRECTIONS, type Direction, type DragAction } from "../settings";

export interface MenuTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MenuLayout {
  x: number;
  y: number;
  radius: number;
  targets: Partial<Record<Direction, MenuTarget>>;
}

/** 通常は開始点から半径150px．画面端や小さなフレームでは全項目を内側へ収める． */
export function createMenuLayout(
  startX: number,
  startY: number,
  requestedRadius: number,
  viewportWidth: number,
  viewportHeight: number,
  directions: Record<Direction, DragAction> = DEFAULT_SETTINGS.directions,
): MenuLayout {
  const margin = 8;
  const availableWidth = Math.max(1, viewportWidth - margin * 2);
  const availableHeight = Math.max(1, viewportHeight - margin * 2);
  const width = Math.min(160, availableWidth / 3);
  const height = Math.min(64, availableHeight / 3);
  const radius = Math.min(
    requestedRadius,
    (availableWidth - width) / 2,
    (availableHeight - height) / 2,
  );
  const x = Math.max(
    margin + radius + width / 2,
    Math.min(startX, viewportWidth - margin - radius - width / 2),
  );
  const y = Math.max(
    margin + radius + height / 2,
    Math.min(startY, viewportHeight - margin - radius - height / 2),
  );
  const target = (centerX: number, centerY: number): MenuTarget => ({
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  });
  const positions: Record<Direction, [number, number]> = {
    up: [x, y - radius],
    down: [x, y + radius],
    left: [x - radius, y],
    right: [x + radius, y],
  };
  const targets: MenuLayout["targets"] = {};
  for (const direction of DIRECTIONS) {
    if (directions[direction] !== "none") targets[direction] = target(...positions[direction]);
  }
  return { x, y, radius, targets };
}

/** 方向だけでは選択せず，表示された操作の矩形に入った場合に限り選択する． */
export function getMenuDirection(layout: MenuLayout, x: number, y: number): Direction | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  for (const direction of DIRECTIONS) {
    const target = layout.targets[direction];
    if (!target) continue;
    if (
      x >= target.x &&
      x <= target.x + target.width &&
      y >= target.y &&
      y <= target.y + target.height
    )
      return direction;
  }
  return null;
}

/** リンク操作はHTTP(S)のみとし，javascript:などは実行しない． */
export function normalizeLinkUrl(value: string, base?: string): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
