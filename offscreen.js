
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "ysx-offscreen-objecturl") return;
  (async () => {
    try {
      const blob = await (await fetch(msg.dataUrl)).blob();
      const url = URL.createObjectURL(blob);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      sendResponse({ ok: true, url });
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "ysx-offscreen-fs-save") return;
  (async () => {
    try {
      const handle = await fsHandleFromDb();
      if (!handle) {
        sendResponse({ ok: false, noHandle: true });
        return;
      }
      const perm = await handle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        sendResponse({ ok: false, needPermission: true });
        return;
      }
      const blob = await (await fetch(msg.dataUrl)).blob();
      const base = String(msg.base || "ysx-shot").replace(/[\\/:*?\"<>|]/g, "");
      const ext = msg.ext === "png" ? "png" : "jpg";
      let name = base + "." + ext;
      for (let i = 1; i < 100; i++) {
        try {
          await handle.getFileHandle(name, { create: false });
          name = base + " (" + i + ")." + ext;
        } catch (e) {
          break;
        }
      }
      const fh = await handle.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      sendResponse({ ok: true, name });
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true;
});

function fsHandleFromDb() {
  return new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open("ysx-fsdb", 1);
    } catch (e) {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("handles")) req.result.createObjectStore("handles");
    };
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      let g;
      try {
        g = db.transaction("handles", "readonly").objectStore("handles").get("saveDir");
      } catch (e) {
        db.close();
        resolve(null);
        return;
      }
      g.onsuccess = () => {
        db.close();
        resolve(g.result || null);
      };
      g.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

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
