importScripts("i18n.js");
importScripts("defaults.js");

let LANG = "zh";
async function loadLang() {
  try {
    const { lang } = await chrome.storage.sync.get({ lang: "zh" });
    LANG = lang === "en" ? "en" : "zh";
    I18N.setLang(LANG);
  } catch (e) { /* keep default */ }
}
loadLang();

async function migrateIconsToLib() {
  try {
    const { engines } = await chrome.storage.sync.get({ engines: null });
    if (!Array.isArray(engines)) return;
    if (!engines.some((e) => e && typeof e.iconImg === "string" && e.iconImg.startsWith("data:"))) return;
    const stored = await extractIconsToLib(engines);
    await pruneIconLib(stored);
    if (Array.isArray(stored) && stored.length === engines.length) {
      await chrome.storage.sync.set({ engines: stored });
      await debugLog("migrate", "icons moved to local lib: " + stored.filter((e) => e.iconKey).length);
    }
  } catch (e) {
    console.error("ysx icon migration failed (kept legacy data):", e);
  }
}
migrateIconsToLib();

const FALLBACK_YANDEX_TEMPLATE = "https://yandex.ru/images/search?rpt=imageview&url={%s}";

const UPLOAD_URL =
  "https://yandex.ru/images-apphost/image-download?cbird=111&images_avatars_size=preview&images_avatars_namespace=images-cbir";

const GOOGLE_UPLOAD_URL = "https://www.google.com/searchbyimage/upload";

function applyTemplate(template, url) {
  return String(template).replace(/\{%s+\}/g, encodeURIComponent(url));
}

async function getEngines() {
  const { engines } = await chrome.storage.sync.get({ engines: DEFAULT_ENGINES });
  return (Array.isArray(engines) ? engines : [])
    .filter((e) => e && e.name && e.url)
    .map((e) => ({ name: String(e.name), url: String(e.url), enabled: e.enabled !== false }));
}

async function getSettings() {
  const s = await chrome.storage.sync.get({
    screenshotMenu: true,
    barAlign: "center",
    hoverEnabled: true,
    hoverDelay: 0,
    hideDelay: 300,
    ysxBtnSize: 28,
    openMode: "foreground",
    enableSearchAll: true,
    historyEnabled: true,
    historyKeep: 30, // 天，0 = 永久
    uploadEngine: "yandex",
    enableShotAll: false, // 「全」：截图同时用 Yandex + Google 识图
    shotFormat: "jpeg",     // jpeg | png
    shotQuality: 92,
    selectMode: "instant",  // instant | confirm
    saveShot: false,
    saveShotDir: DEFAULT_SAVE_DIR,
    copyShot: false,
    statusBubble: true,
    selColor: "#ffcc00",
    debugLogOn: false,
  });
  if (!["yandex", "google"].includes(s.uploadEngine)) s.uploadEngine = "yandex";
  return s;
}

async function getYandexTemplate() {
  const engines = await getEngines();
  const y = engines.find((e) => /yandex/i.test(e.name) && e.enabled);
  return (y && y.url) || FALLBACK_YANDEX_TEMPLATE;
}

let logEnabled = null; // 模块级缓存，避免每次写日志都读 storage

async function isLogEnabled() {
  if (logEnabled === null) {
    try {
      const s = await chrome.storage.sync.get({ debugLogOn: false });
      logEnabled = s.debugLogOn === true;
    } catch (e) {
      logEnabled = false;
    }
  }
  return logEnabled;
}

async function debugLog(step, detail) {
  try {
    if (!(await isLogEnabled())) return;
    const { ysxLog = [] } = await chrome.storage.local.get({ ysxLog: [] });
    ysxLog.push({ t: Date.now(), step, detail: String(detail || "").slice(0, 200) });
    await chrome.storage.local.set({ ysxLog: ysxLog.slice(-30) });
  } catch (e) { /* ignore */
  }
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: title || I18N.t("extName"),
      message: message || "",
    });
  } catch (e) {
  }
}

async function bumpStat(type, engineName) {
  try {
    const { ysxStats = {} } = await chrome.storage.local.get({ ysxStats: {} });
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const day = ysxStats[key] || { total: 0, shots: 0, images: 0, engines: {} };
    day.total += 1;
    if (type === "shot") day.shots += 1;
    else day.images += 1;
    const en = String(engineName || "?").slice(0, 30);
    day.engines[en] = (day.engines[en] || 0) + 1;
    ysxStats[key] = day;
    const keys = Object.keys(ysxStats).sort();
    while (keys.length > 90) delete ysxStats[keys.shift()];
    await chrome.storage.local.set({ ysxStats });
  } catch (e) { /* ignore */ }
}

let _histChain = Promise.resolve();

function addHistory(type, engineName, targetUrl, imgSrc) {
  _histChain = _histChain
    .then(() => doAddHistory(type, engineName, targetUrl, imgSrc))
    .catch(() => {});
  return _histChain;
}

async function doAddHistory(type, engineName, targetUrl, imgSrc) {
  try {
    const { historyKeep = 30, historyEnabled = true } = await chrome.storage.sync.get({
      historyKeep: 30,
      historyEnabled: true,
    });
    if (historyEnabled === false) return; // 用户关闭了历史记录
    const { ysxHistory = [] } = await chrome.storage.local.get({ ysxHistory: [] });
    const now = Date.now();
    ysxHistory.unshift({
      t: now,
      type,
      engine: String(engineName || "").slice(0, 30),
      url: String(targetUrl || "").slice(0, 500),
      img: String(imgSrc || "").slice(0, 300),
    });
    let list = ysxHistory.slice(0, 200);
    const keep = Number(historyKeep) || 0;
    if (keep > 0) {
      const cutoff = now - keep * 86400000;
      list = list.filter((x) => x.t >= cutoff);
    }
    await chrome.storage.local.set({ ysxHistory: list });
  } catch (e) { /* ignore */
  }
}

async function openTab(url, openMode) {
  if (openMode === "current") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (tab && tab.id != null) {
      await chrome.tabs.update(tab.id, { url });
      return;
    }
  }
  await chrome.tabs.create({ url, active: openMode !== "background" });
}

function createMenu(props) {
  return new Promise((resolve) => {
    chrome.contextMenus.create(props, () => {
      void chrome.runtime.lastError; // 名称/id 冲突等错误静默跳过
      resolve();
    });
  });
}

async function rebuildMenus() {
  await chrome.contextMenus.removeAll();
  const settings = await getSettings();

  if (settings.screenshotMenu !== false) {
    await createMenu({
      id: "ysx-menu-select",
      title: I18N.t("menuSelect"),
      contexts: ["page", "image", "video", "frame"],
    });
    await createMenu({
      id: "ysx-menu-full",
      title: I18N.t("menuFull"),
      contexts: ["page", "image", "video", "frame"],
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  rebuildMenus();
  updateGoogleHeadersRule();
});
chrome.runtime.onStartup.addListener(() => {
  rebuildMenus();
  updateGoogleHeadersRule();
});

async function updateGoogleHeadersRule() {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [20260830],
      addRules: [
        {
          id: 20260830,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "Origin", operation: "remove" },
              { header: "Referer", operation: "set", value: "https://www.google.com/" },
            ],
          },
          condition: {
            urlFilter: "||google.com/searchbyimage",
            resourceTypes: ["xmlhttprequest"],
          },
        },
      ],
    });
  } catch (e) {
    console.error("ysx DNR rule failed:", e);
  }
}
chrome.storage.onChanged.addListener((changes, area) => {
  try {
    if (area !== "sync") return;
    if (changes.debugLogOn) logEnabled = changes.debugLogOn.newValue === true;
    if (changes.lang) {
      loadLang().then(() => rebuildMenus());
    }
    if (changes.engines || changes.screenshotMenu) rebuildMenus();
  } catch (e) {
    console.error("ysx onChanged error:", e);
  }
});

function sendStatus(tabId, text, tone) {
  if (tabId == null) return;
  try {
    const resp = chrome.tabs.sendMessage(tabId, { type: "ysx-status", text, tone: tone || "busy" });
    if (resp && resp.catch) resp.catch(() => {});
  } catch (e) { /* content script 不存在时静默 */ }
}

async function startCapture(tabId, source) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    notify(I18N.t("extName"), I18N.t("cannotGetTab"));
    return;
  }
  if (tab.url && !/^https?:/.test(tab.url)) {
    notify(I18N.t("extName"), I18N.t("httpOnly"));
    return;
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tabId, { type: "ysx-capture-request", source });
  } catch (e) {
  }
  if (response && response.status === "capturing") return;

  await captureAndSearch(tabId, null);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "ysx-warmup") {
    sendResponse({ ok: true });
    return;
  }
  if (msg && msg.type === "ysx-open-engine") {
    if (msg.template && msg.imgSrc && /^https?:/i.test(msg.imgSrc)) {
      getSettings().then((settings) => {
        const url = applyTemplate(msg.template, msg.imgSrc);
        debugLog("open-engine", msg.template.slice(0, 60) + " <- " + msg.imgSrc.slice(0, 60));
        addHistory("image", msg.engineName || "", url, msg.imgSrc);
        bumpStat("image", msg.engineName || "");
        openTab(url, settings.openMode);
        sendResponse({ ok: true });
      });
      return true;
    }
  }
  if (msg && msg.type === "ysx-capture-result") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId == null) return;
    captureAndSearch(tabId, msg.rect)
      .then(() => sendResponse({ ok: true }))
      .catch(() => {});
    return true;
  }
  if (msg && msg.type === "ysx-search-upload") {
    if (msg.dataUrl) {
      searchByUpload(msg.dataUrl)
        .then(() => sendResponse({ ok: true }))
        .catch(() => {});
      return true;
    }
  }
  if (msg && msg.type === "ysx-open-all") {
    if (Array.isArray(msg.templates) && msg.imgSrc && /^https?:/i.test(msg.imgSrc)) {
      getSettings().then((settings) => {
        const names = Array.isArray(msg.names) ? msg.names : [];
        msg.templates.forEach((t, i) => {
          const url = applyTemplate(t, msg.imgSrc);
          addHistory("image", names[i] || "", url, msg.imgSrc);
          bumpStat("image", names[i] || "");
          openTab(url, i === 0 ? settings.openMode : "background");
        });
        sendResponse({ ok: true });
      });
      return true;
    }
  }
});

async function captureAndSearch(tabId, rect) {
  try {
    const settings = await getSettings();
    await debugLog(
      "capture",
      "v" + chrome.runtime.getManifest().version +
      " engine=" + settings.uploadEngine + " format=" + settings.shotFormat
    );
    sendStatus(tabId, I18N.t("capturing"), "busy");
    const tab = await chrome.tabs.get(tabId);
    const format = settings.shotFormat === "png" ? "png" : "jpeg";
    const quality = Math.min(100, Math.max(10, Number(settings.shotQuality) || 92));
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format,
      quality: format === "jpeg" ? quality : undefined,
    });
    let blob;
    if (rect) {
      blob = await cropFromDataUrl(dataUrl, rect, format, quality);
    } else {
      blob = await (await fetch(dataUrl)).blob();
    }

    if (settings.saveShot) {
      try {
        await saveShotToDownloads(blob, format);
      } catch (e) {
        console.error("ysx saveShot failed:", e);
        await debugLog("capture", "saveShot failed: " + (e && e.message ? e.message : String(e)));
        sendStatus(tabId, I18N.t("saveShotFailed"), "error");
      }
    }

    if (settings.copyShot) {
      try {
        sendStatus(tabId, I18N.t("copying"), "busy");
        const small = await downscaleBlob(blob, 1600);
        const pngBlob = await toPngBlob(small);
        const pngDataUrl = await blobToDataUrl(pngBlob);
        await copyViaOffscreen(pngDataUrl);
      } catch (e) {
        await debugLog("capture", "copyShot failed: " + (e && e.message ? e.message : String(e)));
      }
    }

    const uploadBlob = await downscaleBlob(blob, 2000);
    await uploadAndOpen(uploadBlob, settings, tabId);
  } catch (e) {
    console.error("ysx capture error:", e);
    const msg = e && e.message ? e.message : String(e);
    await debugLog("capture", "ERROR: " + msg);
    sendStatus(tabId, I18N.t("failed") + msg, "error");
    notify(I18N.t("extName"), I18N.t("captureUploadFailed") + msg);
  }
}

async function uploadAndOpen(blob, settings, tabId) {
  const engines = settings.enableShotAll
    ? ["yandex", "google"]
    : [settings.uploadEngine];
  let opened = false;
  const errors = [];

  for (const eng of engines) {
    const label = eng === "google" ? "Google Lens" : "Yandex";
    try {
      sendStatus(tabId, (eng === "google" ? I18N.t("uploadingGoogle") : I18N.t("uploadingYandex")), "busy");
      let url;
      if (eng === "google") {
        url = await uploadToGoogle(blob);
        addHistory("shot", "Google Lens", url, "（截图）");
        bumpStat("shot", "Google Lens");
      } else {
        const result = await uploadToYandex(blob);
        url = result.url;
        addHistory("shot", "Yandex", url, "（截图）");
        bumpStat("shot", "Yandex");
      }
      await debugLog("capture", label + " ok: " + url.slice(0, 90));
      sendStatus(tabId, I18N.t("doneOpening"), "ok");
      await openTab(url, opened ? "background" : settings.openMode);
      opened = true;
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      errors.push(label + "：" + msg);
      await debugLog("capture", eng + " failed: " + msg);
      sendStatus(tabId, label + " " + I18N.t("uploadFailedShort") + msg, "error");
    }
  }
  if (!opened) throw new Error(errors.join("；"));
}

async function searchByUpload(dataUrl) {
  try {
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const result = await uploadToYandex(blob);
    const settings = await getSettings();
    await openTab(result.url, settings.openMode);
  } catch (e) {
    console.error("ysx searchByUpload failed:", e);
    debugLog("search-upload", "ERROR: " + (e && e.message ? e.message : String(e)));
    notify(I18N.t("extName"), I18N.t("imageSearchFailed") + (e && e.message ? e.message : String(e)));
  }
}

async function cropFromDataUrl(dataUrl, rect, format, quality) {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  try {
    const vw = rect.viewportWidth || bmp.width;
    const vh = rect.viewportHeight || bmp.height;
    const sx = Math.max(0, Math.round((rect.x / vw) * bmp.width));
    const sy = Math.max(0, Math.round((rect.y / vh) * bmp.height));
    const sw = Math.max(1, Math.min(bmp.width - sx, Math.round((rect.w / vw) * bmp.width)));
    const sh = Math.max(1, Math.min(bmp.height - sy, Math.round((rect.h / vh) * bmp.height)));
    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
    const type = format === "png" ? "image/png" : "image/jpeg";
    const q = format === "png" ? undefined : Math.min(100, Math.max(10, Number(quality) || 92)) / 100;
    return await canvas.convertToBlob({ type, quality: q });
  } finally {
    bmp.close();
  }
}

let googleWarm = null; // { ts, net }
const GOOGLE_WARM_TTL = 5 * 60 * 1000;

async function uploadToGoogle(blob) {
  let net = "unknown";
  if (!googleWarm || Date.now() - googleWarm.ts > GOOGLE_WARM_TTL) {
    try {
      const pre = await fetch("https://www.google.com/generate_204", {
        credentials: "include",
        redirect: "follow",
      });
      net = "HTTP " + pre.status;
    } catch (e) {
      throw new Error(I18N.t("netGoogle"));
    }
    try {
      await fetch("https://www.google.com/", { credentials: "include", redirect: "follow" });
    } catch (e) { /* 预热失败不阻断 */ }
    googleWarm = { ts: Date.now(), net };
  } else {
    net = googleWarm.net;
  }

  const formData = new FormData();
  formData.append("encoded_image", blob, "screenshot.jpg");
  let resp;
  try {
    resp = await fetch(GOOGLE_UPLOAD_URL, {
      method: "POST",
      body: formData,
      credentials: "include",
      redirect: "follow",
    });
  } catch (e) {
    throw new Error(I18N.t("netGoogle"));
  }
  if (!resp.ok) {
    googleWarm = null; // 403 可能因 cookie 失效，下次强制重新预热
    throw new Error(
      I18N.t("connPrefix") + resp.status + I18N.t("connSuffix") + net + I18N.t("persist403")
    );
  }
  const finalUrl = resp.url || "";
  if (!/https:\/\/(www\.)?google\./.test(finalUrl)) {
    throw new Error(I18N.t("badPage"));
  }
  if (/consent\.google|signin/.test(finalUrl)) {
    throw new Error(I18N.t("needLogin"));
  }
  await debugLog("capture", "google ok -> " + finalUrl.slice(0, 80));
  return finalUrl;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function blobToDataUrl(blob) {
  const buf = await blob.arrayBuffer();
  return "data:" + (blob.type || "application/octet-stream") + ";base64," + arrayBufferToBase64(buf);
}

async function toPngBlob(blob) {
  if (blob.type === "image/png") return blob;
  const bmp = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    canvas.getContext("2d").drawImage(bmp, 0, 0);
    return await canvas.convertToBlob({ type: "image/png" });
  } finally {
    bmp.close();
  }
}

async function downscaleBlob(blob, maxEdge) {
  const bmp = await createImageBitmap(blob);
  try {
    const edge = Math.max(bmp.width, bmp.height);
    if (edge <= maxEdge) return blob;
    const ratio = maxEdge / edge;
    const w = Math.max(1, Math.round(bmp.width * ratio));
    const h = Math.max(1, Math.round(bmp.height * ratio));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    const type = blob.type === "image/png" ? "image/png" : "image/jpeg";
    return await canvas.convertToBlob({ type });
  } finally {
    bmp.close();
  }
}

async function hasOffscreenDoc() {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    return contexts.length > 0;
  } catch (e) {
    return false;
  }
}

async function setupOffscreenDoc() {
  if (await hasOffscreenDoc()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["CLIPBOARD"],
    justification: "将截图写入剪贴板",
  });
}

async function copyViaOffscreen(pngDataUrl) {
  let lastErr = "无响应";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await setupOffscreenDoc();
      if (attempt > 0) await new Promise((r) => setTimeout(r, 250 * attempt));
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "ysx-offscreen-copy", dataUrl: pngDataUrl }, (r2) => {
          void chrome.runtime.lastError;
          resolve(r2 || null);
        });
      });
      if (resp && resp.ok) return;
      lastErr = resp && resp.error ? resp.error : "无响应";
      if (!resp) {
        try {
          await chrome.offscreen.closeDocument();
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      lastErr = String((e && e.message) || e);
      try {
        await chrome.offscreen.closeDocument();
      } catch (e2) { /* ignore */ }
    }
  }
  throw new Error(I18N.t("clipboardFail") + lastErr + ")");
}

async function saveShotToDownloads(blob, format) {
  const { saveShotDir = "" } = await chrome.storage.sync.get({ saveShotDir: "" });
  const dir = cleanSaveDir(saveShotDir);
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp =
    d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
    "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const ext = format === "png" ? "png" : "jpg";
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename: (dir ? dir + "/" : "") + "ysx-" + stamp + "." + ext,
      saveAs: false,
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

async function uploadToYandex(blob) {
  let resp;
  try {
    resp = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        "Content-Type": blob.type || "image/jpeg",
        Referer: "https://yandex.ru/images/",
      },
      body: blob,
      credentials: "omit",
    });
  } catch (e) {
    throw new Error(I18N.t("netFail"));
  }
  if (!resp.ok) {
    throw new Error(I18N.t("yandexUploadFail") + resp.status + ")");
  }
  let data;
  try {
    data = await resp.json();
  } catch (e) {
    throw new Error(I18N.t("yandexAbnormal"));
  }
  const cbirId = data && data.cbir_id;
  const origPath = data && data.sizes && data.sizes.orig && data.sizes.orig.path;
  if (!cbirId || !origPath) {
    throw new Error(I18N.t("yandexBad"));
  }
  const template = await getYandexTemplate();
  const base = applyTemplate(template, origPath);
  const sep = base.includes("?") ? "&" : "?";
  return {
    url: base + sep + "cbir_id=" + encodeURIComponent(cbirId),
    cbirId,
    origPath,
  };
}

chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.id != null) startCapture(tab.id, "menu");
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "ysx-capture") return;
  debugLog("onCommand", "shortcut triggered");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab && tab.id != null) startCapture(tab.id, "menu");
    else notify(I18N.t("extName"), I18N.t("noActiveTab"));
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  (async () => {
    const mid = String(info.menuItemId || "");
    if (mid === "ysx-menu-select" && tab && tab.id != null) {
      await startCapture(tab.id, "menu");
      return;
    }
    if (mid === "ysx-menu-full" && tab && tab.id != null) {
      await captureAndSearch(tab.id, null);
    }
  })();
});
