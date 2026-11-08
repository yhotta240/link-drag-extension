import { isDirection } from "../settings";
import { normalizeLinkUrl } from "../utils/drag";
import { getSettings } from "../utils/storage";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function executeAction(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
): Promise<ActionResult> {
  const tab = sender.tab;
  if (sender.id !== chrome.runtime.id || tab?.id === undefined || !isDirection(message.direction)) {
    throw new Error("リンク操作の送信元または方向が不正です");
  }
  const url = typeof message.url === "string" ? normalizeLinkUrl(message.url) : null;
  if (!url) throw new Error("このURLは操作できません");
  const settings = await getSettings();
  if (!settings.enabled) return { ok: true };
  const action = settings.directions[message.direction];
  switch (action) {
    case "foreground-tab":
    case "background-tab":
      await chrome.tabs.create({
        url,
        active: action === "foreground-tab",
        windowId: tab.windowId,
        openerTabId: tab.id,
      });
      break;
    case "new-window":
      await chrome.windows.create({ url, incognito: tab.incognito, focused: true });
      break;
    case "incognito-window":
      await chrome.windows.create({ url, incognito: true, focused: true });
      break;
    case "split-view": {
      if (typeof Reflect.get(chrome.tabs, "createSplit") !== "function") {
        throw new Error("分割ビューはChrome 155以降で利用できます");
      }
      const properties: chrome.tabs.CreateProperties & { splitWithTabId: number } = {
        url,
        active: true,
        windowId: tab.windowId,
        openerTabId: tab.id,
        splitWithTabId: tab.id,
      };
      await chrome.tabs.create(properties);
      break;
    }
    case "current-tab":
      await chrome.tabs.update(tab.id, { url });
      break;
    case "download":
      await chrome.downloads.download({ url });
      break;
    // コピーはドロップ元のドキュメントで行う．
    case "copy-url":
    case "none":
      break;
  }
  return { ok: true };
}
