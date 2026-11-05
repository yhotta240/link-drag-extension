import { logError, logInfo } from "../utils/logger";
import { getSettings, setSettings } from "../utils/storage";
import { executeAction } from "./actions";

chrome.runtime.onInstalled.addListener((details) => {
  void initializeSettings();
  if (details.reason === "install") {
    logInfo("拡張機能がインストールされました", "background");
  } else if (details.reason === "update") {
    logInfo(
      `拡張機能がアップデートされました (v${details.previousVersion ?? "?"} → v${chrome.runtime.getManifest().version})`,
      "background",
    );
  }
});

async function initializeSettings(): Promise<void> {
  try {
    await setSettings(await getSettings());
  } catch (error) {
    console.error("設定の初期化に失敗しました", error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "link-drag:execute") return;
  void (async () => {
    try {
      sendResponse(await executeAction(message, sender));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "リンク操作に失敗しました";
      sendResponse({ ok: false, error: detail });
      try {
        await logError("リンク操作に失敗しました", "background", error);
      } catch (logFailure) {
        console.error("ログ保存に失敗しました", logFailure);
      }
    }
  })();
  return true;
});
