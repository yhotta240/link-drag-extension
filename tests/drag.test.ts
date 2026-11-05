import assert from "node:assert/strict";
import { test } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings.ts";
import { createMenuLayout, getMenuDirection, normalizeLinkUrl } from "../src/utils/drag.ts";

test("初期値と欠けた同期設定を補完し，方向の設定を共有しない", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  const settings = normalizeSettings({ directions: { up: "none" }, enabled: false });
  assert.equal(settings.enabled, false);
  assert.equal(settings.directions.up, "none");
  assert.equal(settings.directions.left, "copy-url");
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
    up: "none",
    down: "none",
    left: "copy-url",
    right: "new-window",
  });
});

for (const [x, y, direction] of [
  [500, 250, "up"],
  [500, 550, "down"],
  [350, 400, "left"],
  [650, 400, "right"],
  [500, 400, null],
  [500, 350, null],
  [650, 250, null],
  [500, 100, null],
] as const) {
  test(`操作の上でのみ選択 (${x}, ${y}) → ${direction}`, () => {
    const layout = createMenuLayout(500, 400, 150, 1000, 800);
    assert.equal(getMenuDirection(layout, x, y), direction);
  });
}

test("ドラッグ開始位置から150pxの4か所に操作を配置", () => {
  const layout = createMenuLayout(500, 400, 150, 1000, 800);
  assert.equal(layout.x, 500);
  assert.equal(layout.y, 400);
  for (const target of Object.values(layout.targets)) {
    assert.equal(
      Math.hypot(target.x + target.width / 2 - 500, target.y + target.height / 2 - 400),
      150,
    );
  }
});

test("画面端・小さなフレームでは全操作を表示範囲へ収める", () => {
  for (const [width, height] of [
    [1000, 800],
    [300, 200],
  ]) {
    const layout = createMenuLayout(2, 2, 150, width, height);
    for (const target of Object.values(layout.targets)) {
      assert.ok(target.x >= 8 - 1e-8 && target.y >= 8 - 1e-8);
      assert.ok(target.x + target.width <= width - 8 + 1e-8);
      assert.ok(target.y + target.height <= height - 8 + 1e-8);
    }
  }
});

test("上下のみ割り当てた場合は左右の判定領域を作らない", () => {
  const layout = createMenuLayout(500, 400, 150, 1000, 800, {
    ...DEFAULT_SETTINGS.directions,
    left: "none",
    right: "none",
  });
  assert.deepEqual(Object.keys(layout.targets), ["up", "down"]);
  assert.equal(getMenuDirection(layout, 350, 400), null);
  assert.equal(getMenuDirection(layout, 650, 400), null);
  assert.equal(getMenuDirection(layout, 500, 250), "up");
  assert.equal(getMenuDirection(layout, 500, 550), "down");
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
