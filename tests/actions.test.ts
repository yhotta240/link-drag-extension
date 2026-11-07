import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import { executeAction } from "../src/background/actions.ts";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "../src/settings.ts";

let data: Record<string, Settings>;
let calls: unknown[][];
const sender: chrome.runtime.MessageSender = {
  id: "test-extension",
  tab: {
    id: 12,
    windowId: 4,
    incognito: false,
    index: 0,
    pinned: false,
    highlighted: true,
    active: true,
    frozen: false,
    selected: true,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
  },
};
const request = { direction: "up", url: "https://example.com/target" };

beforeEach(() => {
  data = { settings: normalizeSettings(DEFAULT_SETTINGS) };
  calls = [];
  vi.stubGlobal("chrome", {
    runtime: { id: "test-extension" },
    storage: {
      sync: {
        get: async () => data,
      },
    },
    tabs: {
      create: async (value: chrome.tabs.CreateProperties) => calls.push(["create", value]),
      update: async (...args: [number, chrome.tabs.UpdateProperties]) =>
        calls.push(["update", ...args]),
    },
    windows: { create: async (value: chrome.windows.CreateData) => calls.push(["window", value]) },
  });
});

afterEach(() => vi.unstubAllGlobals());

for (const [action, expected] of [
  ["background-tab", ["create", { url: request.url, active: false, windowId: 4, openerTabId: 12 }]],
  ["foreground-tab", ["create", { url: request.url, active: true, windowId: 4, openerTabId: 12 }]],
  ["current-tab", ["update", 12, { url: request.url }]],
  ["new-window", ["window", { url: request.url, incognito: false, focused: true }]],
] as const) {
  test(`保存済みの方向設定から ${action} を実行`, async () => {
    data.settings.directions.up = action;
    assert.deepEqual(await executeAction(request, sender), { ok: true });
    assert.deepEqual(calls, [expected]);
  });
}

test("斜め方向も保存済みの割り当てで実行する", async () => {
  assert.deepEqual(await executeAction({ ...request, direction: "up-right" }, sender), {
    ok: true,
  });
  assert.deepEqual(calls, [["update", 12, { url: request.url }]]);
});

test("無効状態と割り当てなしの設定ではタブを操作しない", async () => {
  data.settings.enabled = false;
  await executeAction(request, sender);
  data.settings.enabled = true;
  data.settings.directions.up = "none";
  await executeAction(request, sender);
  data.settings.directions.up = "copy-url";
  await executeAction(request, sender);
  assert.deepEqual(calls, []);
});

test("危険なURL，不正な方向，異なる拡張・タブ不明の送信元を拒否", async () => {
  await assert.rejects(executeAction({ ...request, url: "javascript:alert(1)" }, sender));
  await assert.rejects(executeAction({ ...request, direction: "invalid" }, sender));
  await assert.rejects(executeAction(request, { ...sender, id: "other" }));
  await assert.rejects(executeAction(request, { id: sender.id }));
  assert.deepEqual(calls, []);
});
