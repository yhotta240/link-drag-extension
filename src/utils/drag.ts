import { DEFAULT_SETTINGS, DIRECTIONS, type Direction, type DragAction } from "../settings";

export const MENU_ICON_SIZE = 44;
export const MENU_ICON_SCALE = 1.16;
export const MENU_ICON_GLOW = 5;
export const MENU_VIEWPORT_MARGIN = 4;
const MENU_ICON_INSET =
  MENU_VIEWPORT_MARGIN + (MENU_ICON_SIZE / 2 + MENU_ICON_GLOW) * MENU_ICON_SCALE;
const MENU_TARGET_SIZE = 64;

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

const FULL_CIRCLE = Math.PI * 2;
const DIRECTION_OFFSETS: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  "up-right": [Math.SQRT1_2, -Math.SQRT1_2],
  right: [1, 0],
  "down-right": [Math.SQRT1_2, Math.SQRT1_2],
  down: [0, 1],
  "down-left": [-Math.SQRT1_2, Math.SQRT1_2],
  left: [-1, 0],
  "up-left": [-Math.SQRT1_2, -Math.SQRT1_2],
};
const ANGLE_STEP = FULL_CIRCLE / 360;
const CIRCLE_POINTS = Array.from({ length: 360 }, (_, index) => ({
  x: Math.sin(index * ANGLE_STEP),
  y: -Math.cos(index * ANGLE_STEP),
}));

interface VisibleArc {
  start: number;
  span: number;
  full: boolean;
}

function createTarget(x: number, y: number): MenuTarget {
  return {
    x: x - MENU_TARGET_SIZE / 2,
    y: y - MENU_TARGET_SIZE / 2,
    width: MENU_TARGET_SIZE,
    height: MENU_TARGET_SIZE,
  };
}

/** 画面内にアイコンを置ける，最も長い連続した円弧を求める． */
function findVisibleArc(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number,
): VisibleArc | null {
  const visible = CIRCLE_POINTS.map((point) => {
    const px = x + point.x * radius;
    const py = y + point.y * radius;
    return (
      px >= MENU_ICON_INSET - 1e-6 &&
      px <= width - MENU_ICON_INSET + 1e-6 &&
      py >= MENU_ICON_INSET - 1e-6 &&
      py <= height - MENU_ICON_INSET + 1e-6
    );
  });
  if (visible.every(Boolean)) return { start: 0, span: FULL_CIRCLE, full: true };
  let best: VisibleArc | null = null;
  for (let index = 0; index < visible.length; index++) {
    if (!visible[index] || visible[(index + 359) % 360]) continue;
    let length = 1;
    while (length < 360 && visible[(index + length) % 360]) length++;
    const arc = { start: index * ANGLE_STEP, span: (length - 1) * ANGLE_STEP, full: false };
    if (!best || arc.span > best.span) best = arc;
  }
  return best;
}

/** 通常は設定の方向に置き，収まらない場合だけ中心を動かさず円弧へ並べる． */
export function createMenuLayout(
  startX: number,
  startY: number,
  requestedRadius: number,
  viewportWidth: number,
  viewportHeight: number,
  directions: Record<Direction, DragAction> = DEFAULT_SETTINGS.directions,
): MenuLayout {
  const slots = DIRECTIONS.filter((direction) => directions[direction] !== "none");
  const layout: MenuLayout = { x: startX, y: startY, radius: requestedRadius, targets: {} };
  if (slots.length === 0) return layout;

  const inset = MENU_ICON_INSET;
  const fitsDirections = slots.every((slot) => {
    const [dx, dy] = DIRECTION_OFFSETS[slot];
    const x = startX + dx * requestedRadius;
    const y = startY + dy * requestedRadius;
    return x >= inset && x <= viewportWidth - inset && y >= inset && y <= viewportHeight - inset;
  });
  if (fitsDirections) {
    for (const slot of slots) {
      const [dx, dy] = DIRECTION_OFFSETS[slot];
      layout.targets[slot] = createTarget(
        startX + dx * requestedRadius,
        startY + dy * requestedRadius,
      );
    }
    return layout;
  }

  const spacing = MENU_ICON_SIZE * MENU_ICON_SCALE + 8;
  const minimumRadius = Math.max(
    40,
    slots.length > 1 ? spacing / (2 * Math.sin(Math.PI / slots.length)) : 40,
  );
  const maximumRadius = Math.max(
    ...[
      [inset, inset],
      [viewportWidth - inset, inset],
      [inset, viewportHeight - inset],
      [viewportWidth - inset, viewportHeight - inset],
    ].map(([x, y]) => Math.hypot(x - startX, y - startY)),
  );
  const preferredRadius = Math.max(minimumRadius, Math.min(requestedRadius, maximumRadius));

  const place = (radius: number): boolean => {
    if (radius < minimumRadius || radius > maximumRadius) return false;
    const arc = findVisibleArc(startX, startY, radius, viewportWidth, viewportHeight);
    if (!arc) return false;
    // ほぼ一周の円弧でも，最初と最後のアイコンが接近しない間隔にする．
    const step =
      slots.length === 1 ? 0 : Math.min(arc.span / (slots.length - 1), FULL_CIRCLE / slots.length);
    if (slots.length > 1 && 2 * radius * Math.sin(step / 2) < spacing - 1e-6) return false;
    layout.radius = radius;
    slots.forEach((slot, index) => {
      const angle = arc.start + (slots.length === 1 && !arc.full ? arc.span / 2 : step * index);
      const centerX = startX + Math.sin(angle) * radius;
      const centerY = startY - Math.cos(angle) * radius;
      layout.targets[slot] = createTarget(centerX, centerY);
    });
    return true;
  };
  // 設定距離を優先し，端や狭い表示領域では全操作が収まる近い半径を探す．
  for (let delta = 0; delta <= maximumRadius + 4; delta += 4) {
    if (place(preferredRadius + delta) || (delta > 0 && place(preferredRadius - delta)))
      return layout;
  }
  place(minimumRadius);
  return layout;
}

/** 丸い判定領域のうち最も近いアイコンを選ぶ．中心付近はキャンセル領域にする． */
export function getMenuDirection(layout: MenuLayout, x: number, y: number): Direction | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x - layout.x, y - layout.y) < 24) {
    return null;
  }
  let selected: Direction | null = null;
  let nearest = Infinity;
  for (const slot of DIRECTIONS) {
    const target = layout.targets[slot];
    if (!target) continue;
    const distance = Math.hypot(x - target.x - target.width / 2, y - target.y - target.height / 2);
    if (distance <= Math.min(target.width, target.height) / 2 && distance < nearest) {
      selected = slot;
      nearest = distance;
    }
  }
  return selected;
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
