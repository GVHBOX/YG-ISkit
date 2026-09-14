
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "ysx-offscreen-copy") return;
  (async () => {
    const detail = [];
    let ok = false;

    try {
      const blob = await (await fetch(msg.dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      ok = true;
      detail.push("clipboard.write=ok");
    } catch (e) {
      detail.push("clipboard.write: " + String((e && e.message) || e).slice(0, 100));
    }

    if (!ok) {
      try {
        ok = await legacyCopy(msg.dataUrl);
        detail.push("execCommand=" + ok);
      } catch (e) {
        detail.push("execCommand: " + String((e && e.message) || e).slice(0, 100));
      }
    }

    sendResponse({ ok, error: ok ? null : detail.join("; ") });
  })();
  return true;
});

function legacyCopy(pngDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const div = document.createElement("div");
        div.contentEditable = "true";
        div.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        const clone = document.createElement("img");
        clone.src = img.src;
        div.appendChild(clone);
        document.body.appendChild(div);

        const range = document.createRange();
        range.selectNode(div);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const ok = document.execCommand("copy");
        sel.removeAllRanges();
        div.remove();
        resolve(ok === true);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = pngDataUrl;
  });
}
