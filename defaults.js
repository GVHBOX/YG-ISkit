
self.DEFAULT_ENGINES = [
  { name: "Yandex", url: "https://yandex.ru/images/search?rpt=imageview&url={%s}", enabled: true, icon: "Y", color: "#FC3F1D" },
  { name: "Google Lens", url: "https://lens.google.com/uploadbyurl?url={%s}", enabled: true, icon: "G", color: "#4285F4" },
  { name: "Bing", url: "https://www.bing.com/images/search?q=imgurl:{%s}", enabled: false, icon: "B", color: "#008373" },
  { name: "Baidu", url: "https://graph.baidu.com/details?isfromtusoupc=1&tn=pc&image={%s}", enabled: false, icon: "B", color: "#7B1FA2" },
  { name: "SauceNAO", url: "https://saucenao.com/search.php?url={%s}", enabled: false, icon: "S", color: "#C9A227" },
  { name: "Ascii2D", url: "https://ascii2d.net/search/url/{%s}", enabled: false, icon: "A", color: "#5C6BC0" },
  { name: "TinEye", url: "https://tineye.com/search?url={%s}", enabled: false, icon: "T", color: "#EE2B7B" },
  { name: "Sogou", url: "https://pic.sogou.com/ris?query={%s}", enabled: false, icon: "S", color: "#FB6022" },
];

self.COMMON_SITES = ["google.com", "yandex.ru", "bing.com", "baidu.com", "saucenao.com", "ascii2d.net"];

self.DEFAULT_WHITELIST = self.COMMON_SITES.slice(0, 2).join("\n");

self.DEFAULT_SETTINGS = {
  screenshotMenu: true,
  barAlign: "center",
  hoverEnabled: true,
  hoverDelay: 300,
  hideDelay: 300,
  ysxBtnSize: 28,
  openMode: "foreground",
  uploadEngine: "yandex",
  enableShotAll: false,
  shotFormat: "jpeg",
  shotQuality: 92,
  selectMode: "instant",
  confirmPulse: true,
  selColor: "#ffcc00",
  saveShot: false,
  copyShot: false,
  statusBubble: true,
  bubbleSize: 12.5,
  debugLogOn: false,
  enableSearchAll: false,
  infoCard: false,
  whitelistMode: true,
  whitelist: self.DEFAULT_WHITELIST,
  allBtnIcon: "∀",
  allBtnColor: "#3a3f45",
  historyEnabled: false,
  historyKeep: 30,
  blacklist: "",
};

self.hashString = function (s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

self.FALLBACK_COLORS = ["#4285F4", "#34A853", "#FBBC05", "#EA4335", "#7B1FA2", "#00838F", "#5D4037", "#455A64"];

self.fallbackColor = function (name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return self.FALLBACK_COLORS[h % self.FALLBACK_COLORS.length];
};

self.iconKeyFor = function (name, img) {
  return "icon:" + String(name || "").trim().toLowerCase().slice(0, 50) + "-" + self.hashString(String(img || ""));
};

self.extractIconsToLib = async function (engines) {
  const lib = await (chrome.storage.local.get({ ysxIconLib: {} })).then((r) => r.ysxIconLib);
  const out = [];
  const usedKeys = new Set();
  for (const e of engines) {
    if (e && typeof e.iconImg === "string" && e.iconImg.startsWith("data:")) {
      const key = self.iconKeyFor(e.name, e.iconImg);
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
