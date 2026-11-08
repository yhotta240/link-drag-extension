import assert from "node:assert/strict";
import { test } from "vitest";
import { DEFAULT_SETTINGS, DIRECTIONS, normalizeSettings, type Settings } from "../src/settings.ts";
import {
  createMenuLayout,
  getMenuDirection,
  normalizeLinkUrl,
  MENU_ICON_SIZE,
  MENU_ICON_SCALE,
  MENU_ICON_GLOW,
  MENU_VIEWPORT_MARGIN,
} from "../src/utils/drag.ts";

const cardinalDirections: Settings["directions"] = {
  ...DEFAULT_SETTINGS.directions,
  "up-right": "none",
  "down-right": "none",
  "down-left": "none",
  "up-left": "none",
};

test("初期値と欠けた同期設定を補完し，方向の設定を共有しない", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  const settings = normalizeSettings({ directions: { up: "none" }, enabled: false });
  assert.equal(settings.enabled, false);
  assert.equal(settings.directions.up, "none");
  assert.equal(settings.directions.left, "copy-url");
  assert.equal(settings.directions["up-right"], "current-tab");
  settings.directions.down = "none";
  assert.equal(DEFAULT_SETTINGS.directions.down, "foreground-tab");
});

test("不正な設定を初期値へ戻し，有効な値と重複アクションを保持する", () => {
  for (const menuRadius of [0, -1, 79, NaN, Infinity, 80.5, "150"]) {
    assert.equal(normalizeSettings({ menuRadius }).menuRadius, 150);
  }
  const settings = normalizeSettings({
    enabled: "false",
    showIndicator: false,
    menuRadius: 180,
    directions: { up: "none", down: "none", left: "__proto__", right: "invalid" },
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.showIndicator, false);
  assert.equal(settings.menuRadius, 180);
  assert.deepEqual(settings.directions, {
    ...DEFAULT_SETTINGS.directions,
    up: "none",
    down: "none",
    left: "copy-url",
    right: "new-window",
  });
});

test("初期状態で開始位置を中心に8方向の操作を選択できる", () => {
  const layout = createMenuLayout(500, 400, 150, 1000, 800);
  assert.equal(layout.x, 500);
  assert.equal(layout.y, 400);
  assert.equal(layout.radius, 150);
  assert.equal(layout.scale, 1);
  assert.equal(Object.keys(layout.targets).length, 8);
  const offset = 150 / Math.sqrt(2);
  for (const [direction, x, y] of [
    ["up", 500, 250],
    ["up-right", 500 + offset, 400 - offset],
    ["right", 650, 400],
    ["down-right", 500 + offset, 400 + offset],
    ["down", 500, 550],
    ["down-left", 500 - offset, 400 + offset],
    ["left", 350, 400],
    ["up-left", 500 - offset, 400 - offset],
    [null, 500, 400],
    [null, 650, 250],
  ] as const) {
    assert.equal(getMenuDirection(layout, x, y), direction);
  }
});

test("通常・狭い領域の4方向・8方向を，中心固定の1段に収めて選択できる", () => {
  for (const [width, height, directions, checkEdges] of [
    [1000, 800, cardinalDirections, true],
    [1000, 800, DEFAULT_SETTINGS.directions, true],
    [400, 300, DEFAULT_SETTINGS.directions, true],
    [300, 200, cardinalDirections, false],
    [300, 200, DEFAULT_SETTINGS.directions, false],
  ] as const) {
    const positions = [[width / 2, height / 2]];
    if (checkEdges)
      positions.push(
        [2, height / 2],
        [width - 2, height / 2],
        [width / 2, 2],
        [width / 2, height - 2],
        [2, 2],
        [width - 2, 2],
        [2, height - 2],
        [width - 2, height - 2],
      );
    if (width === 1000) positions.push([500, 185.3]);
    const enabled = DIRECTIONS.filter((direction) => directions[direction] !== "none");
    for (const [x, y] of positions) {
      const layout = createMenuLayout(x, y, 150, width, height, directions);
      assert.equal(layout.x, x);
      assert.equal(layout.y, y);
      assert.equal(Object.keys(layout.targets).length, enabled.length);
      assert.ok(layout.scale >= 0.75 && layout.scale <= 1);
      if (width === 1000) assert.equal(layout.scale, 1);
      if (width === 300) assert.ok(layout.radius < 150);
      if (width === 400 && x === 2 && y === 2) assert.ok(layout.scale < 1);
      const extent = (MENU_ICON_SIZE / 2 + MENU_ICON_GLOW) * MENU_ICON_SCALE * layout.scale;
      const centers = enabled.map((direction) => {
        const target = layout.targets[direction];
        assert.ok(target);
        assert.equal(target.width, 64 * layout.scale);
        assert.equal(target.height, 64 * layout.scale);
        const px = target.x + target.width / 2,
          py = target.y + target.height / 2;
        assert.ok(px - extent >= MENU_VIEWPORT_MARGIN - 1e-6);
        assert.ok(py - extent >= MENU_VIEWPORT_MARGIN - 1e-6);
        assert.ok(px + extent <= width - MENU_VIEWPORT_MARGIN + 1e-6);
        assert.ok(py + extent <= height - MENU_VIEWPORT_MARGIN + 1e-6);
        assert.ok(Math.abs(Math.hypot(px - x, py - y) - layout.radius) < 1e-6);
        assert.equal(getMenuDirection(layout, px, py), direction);
        return { x: px, y: py };
      });
      for (let i = 1; i < centers.length; i++) {
        const previousAngle = Math.atan2(centers[i - 1].x - x, y - centers[i - 1].y);
        const angle = Math.atan2(centers[i].x - x, y - centers[i].y);
        const clockwiseStep = (angle - previousAngle + Math.PI * 2) % (Math.PI * 2);
        assert.ok(clockwiseStep > 0 && clockwiseStep < Math.PI);
      }
      for (let i = 0; i < centers.length; i++) {
        for (const other of centers.slice(i + 1)) {
          assert.ok(
            Math.hypot(centers[i].x - other.x, centers[i].y - other.y) >=
              MENU_ICON_SIZE * MENU_ICON_SCALE * layout.scale,
          );
        }
      }
    }
  }
});

test("判定範囲が重なっても近いアイコンを選ぶ", () => {
  const layout = createMenuLayout(2, 2, 150, 1000, 800);
  const first = layout.targets.up,
    second = layout.targets["up-right"];
  assert.ok(first && second);
  const x = (first.x + 32) * 0.49 + (second.x + 32) * 0.51;
  const y = (first.y + 32) * 0.49 + (second.y + 32) * 0.51;
  assert.equal(getMenuDirection(layout, x, y), "up-right");
});

test("未割り当てだけを除き，同じ操作も設定された方向に残す", () => {
  const layout = createMenuLayout(500, 400, 150, 1000, 800, {
    ...cardinalDirections,
    up: "foreground-tab",
    down: "foreground-tab",
    left: "copy-url",
    right: "none",
  });
  assert.deepEqual(Object.keys(layout.targets), ["up", "down", "left"]);
  assert.equal(getMenuDirection(layout, 500, 250), "up");
  assert.equal(getMenuDirection(layout, 500, 550), "down");
  assert.equal(getMenuDirection(layout, 350, 400), "left");
  assert.equal(getMenuDirection(layout, 650, 400), null);
});

test("有効な方向が収まれば，端でも通常の配置を保つ", () => {
  const layout = createMenuLayout(40, 400, 150, 1000, 800, {
    ...cardinalDirections,
    up: "background-tab",
    right: "new-window",
    down: "none",
    left: "none",
  });
  assert.equal(layout.radius, 150);
  assert.deepEqual(Object.keys(layout.targets), ["up", "right"]);
  assert.equal(getMenuDirection(layout, 40, 250), "up");
  assert.equal(getMenuDirection(layout, 190, 400), "right");
});

test("操作が未割り当てならメニューを作らない", () => {
  assert.deepEqual(
    createMenuLayout(500, 400, 150, 1000, 800, {
      ...cardinalDirections,
      up: "none",
      down: "none",
      left: "none",
      right: "none",
    }).targets,
    {},
  );
});

test("相対URL・HTTP(S)を正規化し，実行可能なスキームを限定する", () => {
  assert.equal(
    normalizeLinkUrl("../target?q=1#x", "https://example.com/a/b"),
    "https://example.com/target?q=1#x",
  );
  assert.equal(normalizeLinkUrl("http://example.com"), "http://example.com/");
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///x",
    "chrome://settings",
    "mailto:a@b",
    "invalid",
  ]) {
    assert.equal(normalizeLinkUrl(url), null);
  }
});
