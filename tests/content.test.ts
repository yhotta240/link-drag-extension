import { afterEach, beforeEach, expect, type Mock, test, vi } from "vitest";
import type { ActionResult } from "../src/background/actions.ts";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "../src/settings.ts";
import type { MenuLayout } from "../src/utils/drag.ts";
import type { Direction, DragAction } from "../src/settings.ts";

const mocks = vi.hoisted(() => ({
  show: vi.fn<(layout: MenuLayout, directions: Record<Direction, DragAction>) => void>(),
  highlight: vi.fn<(direction: Direction | null) => void>(),
  hide: vi.fn<() => void>(),
  notify: vi.fn<(text: string, x: number, y: number) => void>(),
  copyUrl: vi.fn<(url: string) => Promise<void>>(),
  getSettings: vi.fn<() => Promise<Settings>>(),
}));
vi.mock("../src/content/indicator.ts", () => ({
  DragIndicator: class {
    show = mocks.show;
    highlight = mocks.highlight;
    hide = mocks.hide;
    notify = mocks.notify;
  },
}));
vi.mock("../src/content/clipboard.ts", () => ({ copyUrl: mocks.copyUrl }));
vi.mock("../src/utils/storage.ts", () => ({
  getSettings: mocks.getSettings,
  SETTINGS_KEY: "settings",
}));

class Element {
  isContentEditable = false;
  ownerDocument = { designMode: "off" };
  draggable = false;
  constructor(
    public tag = "div",
    public anchor: Anchor | null = null,
  ) {}
  closest() {
    return this.anchor;
  }
  matches(selector: string) {
    return selector === '[draggable="true"]'
      ? this.draggable === true
      : ["input", "textarea", "select"].includes(this.tag);
  }
}
class Anchor extends Element {
  baseURI = "https://example.com/page";
  constructor(public href = "/target") {
    super("a");
    this.anchor = this;
  }
  getAttribute() {
    return this.href;
  }
}

interface TestEvent {
  isTrusted: boolean;
  defaultPrevented: boolean;
  button: number;
  clientX: number;
  clientY: number;
  dataTransfer: { dropEffect?: string };
  target: Element;
  key?: string;
  relatedTarget?: Element | null;
  composedPath(): Element[];
  preventDefault(): void;
  stopImmediatePropagation: Mock<() => void>;
}
type EventHandler = (event: TestEvent) => void;

let handlers: Map<string, EventHandler[]>;
let changed: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
let anchor: Anchor;
let child: Element;
let body: Element;
let sendMessage: Mock<(message: unknown) => Promise<ActionResult>>;
let selection: { isCollapsed: boolean; containsNode(node: Element, partial: boolean): boolean };

function fire(type: string, overrides: Partial<TestEvent> = {}): TestEvent {
  const target = overrides.target ?? body;
  const event: TestEvent = {
    isTrusted: true,
    defaultPrevented: false,
    button: 0,
    clientX: 500,
    clientY: 400,
    dataTransfer: {},
    target,
    composedPath: () => (target === child && child.anchor ? [child, anchor, body] : [target, body]),
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopImmediatePropagation: vi.fn<() => void>(),
    ...overrides,
  };
  for (const handler of handlers.get(type) ?? []) handler(event);
  return event;
}

function start() {
  fire("mousedown", { target: child });
  fire("dragstart", { target: child });
}

function drop(x = 500, y = 250) {
  fire("dragover", { clientX: x, clientY: y });
  return fire("drop", { clientX: x, clientY: y });
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  handlers = new Map();
  anchor = new Anchor();
  child = new Element("span", anchor);
  body = new Element();
  selection = { isCollapsed: true, containsNode: () => false };
  const add = (type: string, handler: EventHandler) => {
    handlers.set(type, [...(handlers.get(type) ?? []), handler]);
  };
  sendMessage = vi
    .fn<(message: unknown) => Promise<ActionResult>>()
    .mockResolvedValue({ ok: true });
  vi.stubGlobal("Element", Element);
  vi.stubGlobal("HTMLElement", Element);
  vi.stubGlobal("HTMLAnchorElement", Anchor);
  vi.stubGlobal("innerWidth", 1000);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("window", { addEventListener: add, getSelection: () => selection });
  vi.stubGlobal("document", { addEventListener: add, hidden: false });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage },
    storage: {
      onChanged: {
        addListener: (handler: typeof changed) => {
          changed = handler;
        },
      },
    },
  });
  mocks.getSettings.mockResolvedValue(normalizeSettings(DEFAULT_SETTINGS));
  mocks.copyUrl.mockResolvedValue(undefined);
  await import("../src/content/index.ts");
});

afterEach(() => vi.unstubAllGlobals());

test("子要素から開始し，相対URLを正規化してドロップ時だけ1回実行", () => {
  start();
  fire("dragover", { clientY: 250 });
  expect(sendMessage).not.toHaveBeenCalled();
  const event = fire("drop", { clientY: 250 });
  expect(event.defaultPrevented).toBe(true);
  expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
    type: "link-drag:execute",
    direction: "up",
    url: "https://example.com/target",
  });
  fire("drop", { clientY: 250 });
  fire("dragend");
  expect(sendMessage).toHaveBeenCalledTimes(1);
});

test("操作に一度重ねても，中央・斜め・通り過ぎた位置で離すとキャンセル", () => {
  for (const [x, y] of [
    [500, 400],
    [500, 350],
    [650, 250],
    [500, 100],
  ]) {
    start();
    fire("dragover", { clientY: 250 });
    expect(drop(x, y).defaultPrevented).toBe(false);
  }
  expect(sendMessage).not.toHaveBeenCalled();
});

for (const type of ["keydown", "dragend"]) {
  test(`${type}でキャンセルした後には実行しない`, () => {
    start();
    fire("dragover", { clientY: 250 });
    fire(type, { key: "Escape" });
    drop();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(mocks.hide).toHaveBeenCalled();
  });
}

for (const tag of ["input", "editable"]) {
  test(`${tag}へのドロップを標準操作に委ねる`, () => {
    start();
    const target = new Element(tag);
    target.isContentEditable = tag === "editable";
    fire("dragover", { target, clientY: 250 });
    const event = fire("drop", { target, clientY: 250 });
    expect(event.defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
}

test("サイトがdragoverを処理した領域では独自アクションを実行しない", () => {
  start();
  fire("dragover", { clientY: 250, defaultPrevented: true });
  expect(fire("drop", { clientY: 250 }).defaultPrevented).toBe(false);
  expect(sendMessage).not.toHaveBeenCalled();
});

test("同期設定の変更を反映し，無効化すると進行中のドラッグも中止", () => {
  start();
  changed({ settings: { newValue: { ...DEFAULT_SETTINGS, enabled: false } } }, "sync");
  drop();
  expect(sendMessage).not.toHaveBeenCalled();
  changed({ settings: { newValue: { ...DEFAULT_SETTINGS, showIndicator: false } } }, "sync");
  start();
  drop();
  expect(sendMessage).toHaveBeenCalledOnce();
});

test("URLコピーはページ内で実行し，割り当てなしの方向ではドロップを抑止しない", async () => {
  start();
  drop(350, 400);
  expect(mocks.copyUrl).toHaveBeenCalledExactlyOnceWith("https://example.com/target");
  await Promise.resolve();
  expect(mocks.notify).toHaveBeenCalledWith("URLをコピーしました", 350, 400);
  changed(
    {
      settings: {
        newValue: {
          ...DEFAULT_SETTINGS,
          directions: { ...DEFAULT_SETTINGS.directions, up: "none" },
        },
      },
    },
    "sync",
  );
  start();
  const layout = mocks.show.mock.calls[mocks.show.mock.calls.length - 1]?.[0];
  expect(layout?.targets.up).toBeUndefined();
  expect(drop(500, 250).defaultPrevented).toBe(false);
  expect(sendMessage).not.toHaveBeenCalled();
  expect(mocks.highlight).toHaveBeenLastCalledWith(null);
});

test("表示後の位置は変えず，設定変更時は誤実行を避けてキャンセル", () => {
  start();
  expect(mocks.show).toHaveBeenCalledTimes(1);
  fire("dragover", { clientY: 250 });
  fire("dragover", { clientX: 650 });
  expect(mocks.show).toHaveBeenCalledTimes(1);
  changed({ settings: { newValue: { ...DEFAULT_SETTINGS, menuRadius: 180 } } }, "sync");
  expect(mocks.show).toHaveBeenCalledTimes(1);
  expect(fire("drop", { clientX: 650 }).defaultPrevented).toBe(false);
  expect(sendMessage).not.toHaveBeenCalled();
});

test("合成イベント，右ボタン，リンク以外，危険なURLでは実行しない", () => {
  fire("mousedown", { target: child, isTrusted: false });
  fire("dragstart", { target: child, isTrusted: false });
  drop();
  fire("mousedown", { target: child, button: 2 });
  fire("dragstart", { target: child });
  drop();
  child.anchor = null;
  start();
  drop();
  child.anchor = anchor;
  anchor.href = "javascript:alert(1)";
  start();
  drop();
  expect(sendMessage).not.toHaveBeenCalled();
});

test("全方向が割り当てなしの場合はメニューを表示せず，ドラッグを標準操作に委ねる", () => {
  changed(
    {
      settings: {
        newValue: {
          ...DEFAULT_SETTINGS,
          directions: { up: "none", down: "none", left: "none", right: "none" },
        },
      },
    },
    "sync",
  );
  start();
  expect(mocks.show).not.toHaveBeenCalled();
  expect(drop().defaultPrevented).toBe(false);
  expect(sendMessage).not.toHaveBeenCalled();
});

test("リンク上のテキスト選択は対象外とし，別の場所の選択は妨げない", () => {
  selection = { isCollapsed: false, containsNode: () => true };
  start();
  drop();
  expect(sendMessage).not.toHaveBeenCalled();
  selection.containsNode = () => false;
  start();
  drop();
  expect(sendMessage).toHaveBeenCalledOnce();
});
