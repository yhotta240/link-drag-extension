import meta from "../../public/manifest.meta.json";

import {
  addLog,
  clearLogs,
  getLogs,
  LOG_STORAGE_KEY,
  type LogEntry,
  type LogLevel,
} from "../utils/logger";
import { setupDocumentTab } from "./components/document";
import { setupInfoTab } from "./components/info";
import { setupMoreMenu } from "./components/menu";
import { PopupPanel } from "./components/panel";
import { setupSettings } from "./components/settings";
import { initShareMenu } from "./components/share";
import { applyTheme, setupThemeMenu } from "./components/theme";
import { setupVersionTab } from "./components/version";
import type { ManifestMetadata, SharePlatform, Theme } from "./types";

export class PopupManager {
  private panel: PopupPanel;
  private manifestData: chrome.runtime.Manifest;
  private manifestMetadata: ManifestMetadata;

  constructor() {
    this.panel = new PopupPanel();
    this.manifestData = chrome.runtime.getManifest();
    this.manifestMetadata = meta || {};

    this.initialize();
  }

  private async initialize(): Promise<void> {
    this.panel.setClearCallback(async () => {
      await clearLogs();
    });
    // storageの読み込みを待たずに、基本UIと操作を先に初期化する。
    this.setupUI();
    this.addEventListeners();
    await setupSettings();

    try {
      const logs = await getLogs();
      if (logs.length > 0) {
        this.panel.loadLogs(logs, this.manifestMetadata.issues_url);
      }
      this.watchStorageLogs();
    } catch (err) {
      console.error("ログ読み込みエラー", err);
      this.watchStorageLogs();
    }
  }

  private watchStorageLogs(): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[LOG_STORAGE_KEY]) {
        const rawEntries = changes[LOG_STORAGE_KEY]?.newValue;
        const entries: LogEntry[] = Array.isArray(rawEntries) ? rawEntries : [];
        this.panel.loadLogs(entries, this.manifestMetadata.issues_url);
      }
    });
  }

  private addEventListeners(): void {
    // テーマ設定のイベントリスナー
    setupThemeMenu(async (value: Theme) => {
      try {
        applyTheme(value);
        await this.showLog(`テーマを ${value} に変更しました`);
      } catch (e) {
        await this.showLog("テーマ設定の保存に失敗しました", "error", e);
      }
    });

    // シェアメニューの初期化
    initShareMenu(async (platform: SharePlatform, success: boolean) => {
      const platformNames: Record<SharePlatform, string> = {
        twitter: "X (Twitter)",
        facebook: "Facebook",
        copy: "クリップボード",
      };
      if (success) {
        if (platform === "copy") {
          await this.showLog("URLをコピーしました");
        } else {
          await this.showLog(`${platformNames[platform]}でシェアしました`);
        }
      } else {
        await this.showLog("シェアに失敗しました", "error");
      }
    });
  }

  private setupUI(): void {
    const short_name = this.manifestData.short_name || this.manifestData.name;
    const title = document.getElementById("title");
    if (title) {
      title.textContent = short_name;
    }
    const titleHeader = document.getElementById("title-header");
    if (titleHeader) {
      titleHeader.textContent = short_name;
    }
    const enabledLabel = document.getElementById("enabled-label");
    if (enabledLabel) {
      enabledLabel.textContent = `${short_name} を有効にする`;
    }

    setupMoreMenu();
    setupInfoTab(this.manifestData, this.manifestMetadata);
    setupDocumentTab();
    setupVersionTab(this.manifestData.version);
  }

  private async showLog(message: string, level: LogLevel = "info", error?: unknown): Promise<void> {
    const detail = error instanceof Error ? error.message : error ? String(error) : undefined;
    try {
      await addLog(message, level, "popup", detail);
    } catch (e) {
      console.error("ログ保存エラー", e);
    }
  }
}
