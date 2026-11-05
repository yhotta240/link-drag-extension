/** HTTPページやClipboard APIが制限されたページでもコピーできるようにする． */
export async function copyUrl(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    return;
  } catch {
    // clipboardWrite権限による同期コピーへフォールバックする．
  }
  const active = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange())
    : [];
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-9999px;top:0;";
  const root = host.attachShadow({ mode: "closed" });
  const textarea = document.createElement("textarea");
  textarea.value = url;
  root.append(textarea);
  const onCopy = (event: ClipboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.clipboardData?.setData("text/plain", url);
  };
  try {
    document.documentElement.append(host);
    textarea.focus({ preventScroll: true });
    textarea.select();
    window.addEventListener("copy", onCopy, true);
    if (!document.execCommand("copy")) throw new Error("URLをコピーできませんでした");
  } finally {
    window.removeEventListener("copy", onCopy, true);
    host.remove();
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
  }
}
