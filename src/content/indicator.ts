import { ACTION_LABELS, DIRECTIONS, type Direction, type DragAction } from "../settings";
import {
  MENU_ICON_GLOW,
  MENU_ICON_SCALE,
  MENU_ICON_SIZE,
  MENU_VIEWPORT_MARGIN,
  type MenuLayout,
} from "../utils/drag";

const ACTION_ICON_PATHS: Record<Exclude<DragAction, "none">, readonly string[]> = {
  "foreground-tab": ["M3 7h14v14H3z", "M7 3h14v14h-4", "M6 11h8", "M10 18v-4m-2 2 2-2 2 2"],
  "background-tab": ["M3 7h14v14H3z", "M7 3h14v14h-4", "M6 11h8", "M18 6v5m-2-2 2 2 2-2"],
  "new-window": ["M14 3h7v7", "M21 3 11 13", "M10 3H3v18h18v-7"],
  "current-tab": ["M3 4h18v16H3z", "M3 8h18", "M7 14h9m-3-3 3 3-3 3"],
  "copy-url": ["M9 9h12v12H9z", "M15 9V3H3v12h6"],
};

/** 透明な判定領域の中心にアイコンを置き，ページのポインター操作から分離する． */
export class DragIndicator {
  private host: HTMLDivElement | null = null;
  private targets = new Map<Direction, HTMLDivElement>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private frame = 0;

  private createRoot(): ShadowRoot {
    this.hide();
    this.host = document.createElement("div");
    this.host.style.cssText =
      "all:initial!important;position:fixed!important;inset:0 auto auto 0!important;" +
      "z-index:2147483647!important;pointer-events:none!important;" +
      "display:block!important;width:0!important;height:0!important;";
    const root = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; pointer-events: none !important; }
      div { all: initial; box-sizing: border-box; position: fixed;
        font: 13px/1.4 system-ui, sans-serif; pointer-events: none; color: #f8fafc; }
      .ring { border: 1px dashed #64748b88; border-radius: 50%; }
      .target { display: flex; align-items: center; justify-content: center;
        text-align: center; }
      .icon { position: relative; display: flex; align-items: center; justify-content: center;
        width: ${MENU_ICON_SIZE}px; height: ${MENU_ICON_SIZE}px; border-radius: 50%; background: rgb(24 33 47 / 95%);
        color: #cbd5e1; transition: transform .14s ease, background-color .14s ease,
          box-shadow .14s ease, color .14s ease; }
      .icon svg { display: block; width: 23px; height: 23px; fill: none;
        stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
      .target.selected .icon { transform: scale(${MENU_ICON_SCALE}); background: rgb(37 99 235 / 95%);
        color: #fff; box-shadow: 0 0 0 ${MENU_ICON_GLOW}px rgb(59 130 246 / 16%); }
      span { all: initial; font: inherit; color: inherit; display: block; }
      .label { position: absolute; top: calc(50% + 32px); left: 50%; transform: translateX(-50%);
        width: max-content; max-width: min(160px, calc(100vw - 8px)); padding: 4px 7px; border-radius: 4px;
        background: rgb(24 33 47 / 95%); font-size: 12px; text-align: center;
        opacity: 0; visibility: hidden; transition: opacity .14s ease; }
      .label.above { top: auto; bottom: calc(50% + 32px); }
      .target.selected .label { opacity: 1; visibility: visible; }
      .toast { padding: 7px 11px; border-radius: 5px; background: #18212f;
        border: 1px solid #64748b;
        white-space: nowrap; max-width: calc(100vw - 16px); overflow: hidden;
        text-overflow: ellipsis; }
      @media (prefers-reduced-motion: reduce) {
        .icon, .label { transition: none; }
        .target.selected .icon { transform: none; }
      }
    `;
    root.append(style);
    document.documentElement.append(this.host);
    return root;
  }

  show(layout: MenuLayout, directions: Record<Direction, DragAction>): void {
    if (Object.keys(layout.targets).length === 0) {
      this.hide();
      return;
    }
    const root = this.createRoot();
    const ring = document.createElement("div");
    ring.className = "ring";
    ring.style.cssText =
      `left:${layout.x - layout.radius}px;top:${layout.y - layout.radius}px;` +
      `width:${layout.radius * 2}px;height:${layout.radius * 2}px;`;
    root.append(ring);
    for (const direction of DIRECTIONS) {
      const target = layout.targets[direction];
      const assignedAction = directions[direction];
      if (!target || assignedAction === "none") continue;
      const card = document.createElement("div");
      card.className = "target";
      card.dataset.direction = direction;
      card.style.cssText =
        `left:${target.x}px;top:${target.y}px;` +
        `width:${target.width}px;height:${target.height}px;`;
      const icon = document.createElement("div");
      icon.className = "icon";
      icon.setAttribute("aria-hidden", "true");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("focusable", "false");
      for (const data of ACTION_ICON_PATHS[assignedAction]) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", data);
        svg.append(path);
      }
      icon.append(svg);
      const action = document.createElement("span");
      action.className = "label";
      action.classList.toggle("above", target.y + target.height / 2 + 80 > innerHeight - 8);
      action.textContent = ACTION_LABELS[assignedAction];
      card.append(icon, action);
      root.append(card);
      this.targets.set(direction, card);
      // 操作名は判定領域と別に寄せ，アイコンが端に近くても全文を読めるようにする．
      const bounds = action.getBoundingClientRect();
      const offset = Math.max(
        MENU_VIEWPORT_MARGIN - bounds.left,
        Math.min(0, innerWidth - MENU_VIEWPORT_MARGIN - bounds.right),
      );
      action.style.marginLeft = `${offset}px`;
    }
  }

  highlight(direction: Direction | null): void {
    for (const [key, target] of this.targets) {
      target.classList.toggle("selected", key === direction);
    }
  }

  notify(text: string, x: number, y: number): void {
    const root = this.createRoot();
    const label = document.createElement("div");
    label.className = "toast";
    label.setAttribute("role", "status");
    label.textContent = text;
    root.append(label);
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const rect = label.getBoundingClientRect();
      label.style.left = `${Math.max(8, Math.min(x + 16, innerWidth - rect.width - 8))}px`;
      label.style.top = `${Math.max(8, Math.min(y + 18, innerHeight - rect.height - 8))}px`;
    });
    this.timer = setTimeout(() => this.hide(), 1800);
  }

  hide(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.timer) clearTimeout(this.timer);
    this.frame = 0;
    this.timer = undefined;
    this.host?.remove();
    this.host = null;
    this.targets.clear();
  }
}
