import type { ActionResult } from "../background/actions";
import { normalizeSettings, type Settings } from "../settings";
import {
  createMenuLayout,
  getMenuDirection,
  type MenuLayout,
  normalizeLinkUrl,
} from "../utils/drag";
import { getSettings, SETTINGS_KEY } from "../utils/storage";
import { copyUrl } from "./clipboard";
import { DragIndicator } from "./indicator";

interface DragSession {
  url: string;
  x: number;
  y: number;
  layout: MenuLayout;
}

const indicator = new DragIndicator();
let settings: Settings | null = null;
let session: DragSession | null = null;
let mouseStart: { x: number; y: number; link: Element | null } | null = null;
let settingsRevision = 0;
let acceptedTarget: EventTarget | null = null;

function cancel(): void {
  session = null;
  mouseStart = null;
  acceptedTarget = null;
  indicator.hide();
}

function pathElements(event: Event): Element[] {
  return event.composedPath().filter((node): node is Element => node instanceof Element);
}

function findLink(event: Event): HTMLAnchorElement | null {
  for (const element of pathElements(event)) {
    const link = element.closest("a[href]");
    if (link instanceof HTMLAnchorElement) return link;
  }
  return null;
}

function isEditable(event: Event): boolean {
  return pathElements(event).some(
    (element) =>
      element.matches("input, textarea, select, [role='textbox']") ||
      (element instanceof HTMLElement && element.isContentEditable) ||
      element.ownerDocument.designMode === "on",
  );
}

window.addEventListener(
  "mousedown",
  (event) => {
    mouseStart =
      event.isTrusted && event.button === 0 && !isEditable(event)
        ? { x: event.clientX, y: event.clientY, link: findLink(event) }
        : null;
  },
  true,
);

window.addEventListener("mouseup", () => {
  mouseStart = null;
});

window.addEventListener("dragstart", (event) => {
  session = null;
  acceptedTarget = null;
  indicator.hide();
  if (!event.isTrusted || event.defaultPrevented || !settings?.enabled || !mouseStart) return;
  if (isEditable(event)) return;
  const link = findLink(event);
  if (!link || link !== mouseStart.link) return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.containsNode(link, true)) return;
  // 独自のドラッグ領域から始まった場合はサイト側へ委ねる．
  if (
    pathElements(event).some((element) => element !== link && element.matches('[draggable="true"]'))
  ) {
    return;
  }
  const url = normalizeLinkUrl(link.getAttribute("href") ?? "", link.baseURI);
  if (!url) return;
  const layout = createMenuLayout(
    mouseStart.x,
    mouseStart.y,
    settings.menuRadius,
    innerWidth,
    innerHeight,
    settings.directions,
  );
  if (Object.keys(layout.targets).length === 0) return;
  session = {
    url,
    x: mouseStart.x,
    y: mouseStart.y,
    layout,
  };
  if (settings.showIndicator) indicator.show(session.layout, settings.directions);
});

function directionAt(event: DragEvent) {
  if (!session || !settings?.enabled || isEditable(event)) return null;
  if (
    event.clientX < 0 ||
    event.clientY < 0 ||
    event.clientX >= innerWidth ||
    event.clientY >= innerHeight
  ) {
    return null;
  }
  return getMenuDirection(session.layout, event.clientX, event.clientY);
}

window.addEventListener("dragover", (event) => {
  acceptedTarget = null;
  if (!event.isTrusted || event.defaultPrevented) {
    indicator.highlight(null);
    return;
  }
  const direction = directionAt(event);
  if (!direction || !settings) {
    indicator.highlight(null);
    return;
  }
  // 有効なジェスチャーだけをドロップ可能にし，標準操作を必要な範囲で抑止する．
  event.preventDefault();
  acceptedTarget = event.target;
  if (event.dataTransfer) event.dataTransfer.dropEffect = "link";
  indicator.highlight(direction);
});

window.addEventListener(
  "drop",
  (event) => {
    if (!event.isTrusted) return;
    const direction =
      event.defaultPrevented || acceptedTarget !== event.target ? null : directionAt(event);
    const drag = session;
    const action = direction && settings ? settings.directions[direction] : null;
    // async処理の前に消費し，dragendや重複dropで再実行しない．
    cancel();
    if (!direction || !drag || !action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void (async () => {
      try {
        if (action === "none") return;
        if (action === "copy-url") {
          await copyUrl(drag.url);
          indicator.notify("URLをコピーしました", event.clientX, event.clientY);
        } else {
          const result: ActionResult = await chrome.runtime.sendMessage({
            type: "link-drag:execute",
            direction,
            url: drag.url,
          });
          if (!result?.ok) throw new Error(result?.error ?? "リンク操作に失敗しました");
        }
      } catch (error) {
        console.error("リンク操作に失敗しました", error);
        indicator.notify("リンク操作に失敗しました", event.clientX, event.clientY);
      }
    })();
  },
  true,
);

window.addEventListener(
  "dragend",
  () => {
    // drop後のコピー完了メッセージは残し，ドラッグ中の表示だけを片付ける．
    if (session) cancel();
    mouseStart = null;
  },
  true,
);
window.addEventListener("dragleave", (event) => {
  if (!event.relatedTarget) {
    acceptedTarget = null;
    indicator.highlight(null);
  }
});
window.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") cancel();
  },
  true,
);
window.addEventListener("blur", cancel);
window.addEventListener("pagehide", cancel);
window.addEventListener("resize", cancel);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancel();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes[SETTINGS_KEY]) return;
  settingsRevision++;
  settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
  if (!settings.enabled) cancel();
  if (session) {
    session.layout = createMenuLayout(
      session.x,
      session.y,
      settings.menuRadius,
      innerWidth,
      innerHeight,
      settings.directions,
    );
    acceptedTarget = null;
    if (Object.keys(session.layout.targets).length === 0) {
      cancel();
      return;
    }
    if (settings.showIndicator) indicator.show(session.layout, settings.directions);
  }
  if (!settings.showIndicator) indicator.hide();
});

void (async () => {
  const revision = settingsRevision;
  try {
    const loaded = await getSettings();
    if (settingsRevision === revision) settings = loaded;
  } catch (error) {
    // 設定を取得できないときは標準操作を維持する．
    console.error("Link Dragの設定を読み込めませんでした", error);
  }
})();
