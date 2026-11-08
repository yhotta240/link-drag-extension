import {
  ACTION_LABELS,
  DEFAULT_SETTINGS,
  DIRECTIONS,
  ICON_SIZE_MAX,
  ICON_SIZE_MIN,
  isDragAction,
  isIconSize,
  normalizeSettings,
  type Settings,
} from "../../settings";
import { getSettings, SETTINGS_KEY, setSettings } from "../../utils/storage";

export async function setupSettings(): Promise<void> {
  const enabled = document.getElementById("enabled") as HTMLInputElement;
  const fields = document.getElementById("settings-fields") as HTMLFieldSetElement;
  const showIndicator = document.getElementById("show-indicator") as HTMLInputElement;
  const distance = document.getElementById("menu-radius") as HTMLInputElement;
  const iconSize = document.getElementById("icon-size") as HTMLInputElement;
  const iconSizeHelp = document.getElementById("icon-size-help") as HTMLElement;
  iconSize.min = String(ICON_SIZE_MIN);
  iconSize.max = String(ICON_SIZE_MAX);
  iconSizeHelp.textContent = `${ICON_SIZE_MIN}〜${ICON_SIZE_MAX}pxで調整できます．`;
  const reset = document.getElementById("reset-settings") as HTMLButtonElement;
  const status = document.getElementById("settings-status") as HTMLElement;
  const selects = DIRECTIONS.map(
    (direction) => document.getElementById(`direction-${direction}`) as HTMLSelectElement,
  );
  let settings = normalizeSettings(DEFAULT_SETTINGS);
  let saving = false;

  for (const select of selects) {
    for (const [value, label] of Object.entries(ACTION_LABELS)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
  }

  function setBusy(busy: boolean): void {
    fields.disabled = busy;
    enabled.disabled = busy;
  }

  function render(): void {
    enabled.checked = settings.enabled;
    enabled.setAttribute("aria-checked", String(settings.enabled));
    showIndicator.checked = settings.showIndicator;
    distance.value = String(settings.menuRadius);
    distance.setCustomValidity("");
    iconSize.value = String(settings.iconSize);
    iconSize.setCustomValidity("");
    selects.forEach((select, index) => {
      select.value = settings.directions[DIRECTIONS[index]];
    });
  }

  async function save(next: Settings, message = "設定を保存しました"): Promise<void> {
    if (saving) return;
    saving = true;
    setBusy(true);
    status.textContent = "保存中…";
    try {
      await setSettings(next);
      settings = normalizeSettings(next);
      status.textContent = message;
      status.classList.remove("text-danger");
    } catch (error) {
      console.error("設定を保存できませんでした", error);
      status.textContent = "設定を保存できませんでした．もう一度お試しください．";
      status.classList.add("text-danger");
    } finally {
      render();
      saving = false;
      setBusy(false);
    }
  }

  enabled.addEventListener("change", () => {
    void save({ ...settings, enabled: enabled.checked });
  });
  showIndicator.addEventListener("change", () => {
    void save({ ...settings, showIndicator: showIndicator.checked });
  });
  distance.addEventListener("input", () => distance.setCustomValidity(""));
  distance.addEventListener("change", () => {
    const value = distance.valueAsNumber;
    if (!Number.isSafeInteger(value) || value < 80) {
      distance.setCustomValidity("80以上の整数を入力してください");
      distance.reportValidity();
      return;
    }
    void save({ ...settings, menuRadius: value });
  });
  iconSize.addEventListener("input", () => iconSize.setCustomValidity(""));
  iconSize.addEventListener("change", () => {
    const value = iconSize.valueAsNumber;
    if (!isIconSize(value)) {
      iconSize.setCustomValidity(`${ICON_SIZE_MIN}〜${ICON_SIZE_MAX}の整数を入力してください`);
      iconSize.reportValidity();
      return;
    }
    void save({ ...settings, iconSize: value });
  });
  selects.forEach((select, index) => {
    select.addEventListener("change", () => {
      if (!isDragAction(select.value)) return;
      void save({
        ...settings,
        directions: { ...settings.directions, [DIRECTIONS[index]]: select.value },
      });
    });
  });
  reset.addEventListener("click", () => {
    void save(normalizeSettings(DEFAULT_SETTINGS), "設定を初期値に戻しました");
  });

  setBusy(true);
  try {
    settings = await getSettings();
    render();
    setBusy(false);
  } catch (error) {
    console.error("設定を読み込めませんでした", error);
    status.textContent = "設定を読み込めませんでした．ポップアップを開き直してください．";
    status.classList.add("text-danger");
    return;
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (saving || area !== "sync" || !changes[SETTINGS_KEY]) return;
    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    render();
  });
}
