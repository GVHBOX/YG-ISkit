
self.DEFAULT_ENGINES = [
  { name: "Google Lens", url: "https://lens.google.com/uploadbyurl?url={%s}", enabled: true, icon: "G", color: "#4285F4" },
  { name: "Yandex", url: "https://yandex.ru/images/search?rpt=imageview&url={%s}", enabled: true, icon: "Y", color: "#FC3F1D" },
  { name: "Bing", url: "https://www.bing.com/images/search?q=imgurl:{%s}", enabled: true, icon: "b", color: "#008373" },
  { name: "Baidu", url: "https://graph.baidu.com/details?isfromtusoupc=1&tn=pc&image={%s}", enabled: true, icon: "度", color: "#7B1FA2" },
  { name: "SauceNAO", url: "https://saucenao.com/search.php?url={%s}", enabled: false, icon: "S", color: "#C9A227" },
  { name: "Ascii2D", url: "https://ascii2d.net/search/url/{%s}", enabled: false, icon: "A", color: "#5C6BC0" },
  { name: "TinEye", url: "https://tineye.com/search?url={%s}", enabled: false, icon: "t", color: "#EE2B7B" },
  { name: "Sogou", url: "https://pic.sogou.com/ris?query={%s}", enabled: false, icon: "搜", color: "#FB6022" },
];

self.DEFAULT_SAVE_DIR = "以图搜图截图";

self.cleanSaveDir = function (p) {
  const segs = String(p || "")
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((x) => x.trim())
    .filter((x) => x && x !== "." && x !== ".." && !/^[a-zA-Z]:$/.test(x))
    .map((x) => x.replace(/[\\:*?\"<>|]/g, ""))
    .filter(Boolean);
  return segs[segs.length - 1] || "";
};

self.extractIconsToLib = async function (engines) {
  const lib = await (chrome.storage.local.get({ ysxIconLib: {} })).then((r) => r.ysxIconLib);
  const out = [];
  const usedKeys = new Set();
  for (const e of engines) {
    if (e && typeof e.iconImg === "string" && e.iconImg.startsWith("data:")) {
      const key = "icon:" + String(e.name || "").trim().toLowerCase().slice(0, 50);
      lib[key] = e.iconImg;
      usedKeys.add(key);
      out.push({ ...e, iconKey: key });
      delete out[out.length - 1].iconImg;
    } else {
      out.push(e);
      if (e && typeof e.iconImg === "string" && e.iconImg) usedKeys.add("__url__" + e.iconImg);
    }
  }
  await chrome.storage.local.set({ ysxIconLib: lib });
  return out;
};

self.hydrateIcons = async function (engines) {
  let lib = null;
  const out = [];
  for (const e of engines) {
    if (e && e.iconKey) {
      if (!lib) {
        lib = await (chrome.storage.local.get({ ysxIconLib: {} })).then((r) => r.ysxIconLib);
      }
      const img = lib[e.iconKey];
      out.push(img ? { ...e, iconImg: img } : e);
    } else {
      out.push(e);
    }
  }
  return out;
};

self.pruneIconLib = async function (engines) {
  const { ysxIconLib: lib } = await chrome.storage.local.get({ ysxIconLib: {} });
  const keys = new Set(
    engines.map((e) => e && e.iconKey).filter(Boolean)
  );
  let dirty = false;
  for (const k of Object.keys(lib)) {
    if (!keys.has(k)) { delete lib[k]; dirty = true; }
  }
  if (dirty) await chrome.storage.local.set({ ysxIconLib: lib });
};
