
const rowsEl = document.getElementById("engineRows");
const statusEl = document.getElementById("status");

const ALL_BTN_DEFAULT_ICON = "全";

document.getElementById("verDisplay").textContent = "v" + chrome.runtime.getManifest().version;

const GITHUB_REPO = "https://github.com/GVHBOX/image-search-assistant";
document.getElementById("githubLink").href = GITHUB_REPO;

function applyLang() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = I18N.t(el.dataset.i18n);
  });
  document.title = I18N.t("extName");
  document.getElementById("langToggle").textContent = I18N.getLang() === "zh" ? "EN" : I18N.t("langSelf");
  document.getElementById("presetName").placeholder = I18N.t("presetNamePh");
  renderPresetSelect();
  renderHistory();
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  document.getElementById("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
}

(async () => {
  const { lang, theme } = await chrome.storage.sync.get({ lang: "zh", theme: "light" });
  I18N.setLang(lang === "en" ? "en" : "zh");
  applyLang();
  applyTheme(theme === "dark" ? "dark" : "light");
})();

document.getElementById("langToggle").addEventListener("click", async () => {
  const next = I18N.getLang() === "zh" ? "en" : "zh";
  I18N.setLang(next);
  await chrome.storage.sync.set({ lang: next });
  applyLang();
});

document.getElementById("themeToggle").addEventListener("click", async () => {
  const dark = !document.body.classList.contains("dark");
  applyTheme(dark ? "dark" : "light");
  await chrome.storage.sync.set({ theme: dark ? "dark" : "light" });
});

document.getElementById("enableSearchAll").addEventListener("change", (e) => {
  document.getElementById("allBtnCustomRow").style.display = e.target.checked ? "block" : "none";
});

function syncShotAllUi() {
  const on = document.getElementById("enableShotAll").checked;
  const sel = document.getElementById("uploadEngine");
  sel.disabled = on;
  sel.style.opacity = on ? "0.45" : "1";
  document.getElementById("shotAllHintRow").style.display = on ? "flex" : "none";
  if (on) document.getElementById("shotAllHint").textContent = I18N.t("shotAllHint");
}
document.getElementById("enableShotAll").addEventListener("change", syncShotAllUi);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function engineRowHtml(e, index, total) {
  const icon = e.icon || (e.name || "")[0] || "";
  const color = /^#[0-9a-f]{6}$/i.test(e.color || "") ? e.color : "#455A64";
  return `<div class="engine-grid engine-row">
    <span class="e-num">${index + 1}</span>
    <input type="checkbox" class="e-on"${e.enabled !== false ? " checked" : ""}>
    <span class="e-icon-wrap">
      <input type="text" class="e-icon" maxlength="2" value="${escapeHtml(icon)}" placeholder="G" title="${escapeHtml(I18N.t("charIconPh"))}">
      <input type="text" class="e-icon-url" value="${escapeHtml(e.iconImg || "")}" placeholder="${escapeHtml(I18N.t("iconUrlPh"))}" title="${escapeHtml(I18N.t("iconUrlTitle"))}">
      <img class="e-icon-img" alt=""${e.iconImg ? ` src="${escapeHtml(e.iconImg)}" style="display:inline-block;"` : ""} title="${escapeHtml(I18N.t("iconPreviewTitle"))}">
      <button type="button" class="e-icon-upload" title="${escapeHtml(I18N.t("iconUploadTitle"))}">📁</button>
      <input type="file" class="e-icon-file" accept="image/*" style="display:none;">
    </span>
    <input type="text" class="e-name" maxlength="24" value="${escapeHtml(e.name || "")}" placeholder="${escapeHtml(I18N.t("namePh"))}">
    <div class="e-color-chip e-color" data-color="${escapeHtml(color)}" style="background: ${escapeHtml(color)};" title="${escapeHtml(I18N.t("color"))}"></div>
    <input type="text" class="e-url" value="${escapeHtml(e.url || "")}" placeholder="${escapeHtml(I18N.t("urlPh"))}">
    <button type="button" class="e-move" data-dir="up" title="${escapeHtml(I18N.t("moveUp"))}"${index === 0 ? " disabled" : ""}>↑</button>
    <button type="button" class="e-move" data-dir="down" title="${escapeHtml(I18N.t("moveDown"))}"${index === total - 1 ? " disabled" : ""}>↓</button>
    <button type="button" class="e-del" title="${I18N.t("del")}">×</button>
  </div>`;
}

function getEnginesFromUI() {
  return Array.from(rowsEl.querySelectorAll(".engine-row"))
    .map((row) => ({
      enabled: row.querySelector(".e-on").checked,
      icon: row.querySelector(".e-icon").value.trim(),
      iconImg: (row.querySelector(".e-icon-url").value.trim() ||
                 row.querySelector(".e-icon-img").getAttribute("src") || ""),
      name: row.querySelector(".e-name").value.trim(),
      color: row.querySelector(".e-color").dataset.color,
      url: row.querySelector(".e-url").value.trim(),
    }))
    .filter((e) => e.name && e.url);
}

function renderEngines(engines) {
  rowsEl.innerHTML = engines.map((e, i) => engineRowHtml(e, i, engines.length)).join("");
}

function moveRow(index, dir) {
  const list = getEnginesFromUI();
  const target = index + dir;
  if (target < 0 || target >= list.length) return;
  const tmp = list[index];
  list[index] = list[target];
  list[target] = tmp;
  renderEngines(list);
}

let statusTimer = null;
function showStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "var(--red, #e53935)" : "";
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.textContent = "";
    statusEl.style.color = "";
  }, isError ? 8000 : 2500);
}

let dirty = false;

function markDirty() {
  dirty = true;
}

function clearDirty() {
  dirty = false;
}

document.body.addEventListener("input", markDirty, true);
document.body.addEventListener("change", markDirty, true);

window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

async function renderLogView() {
  const on = document.getElementById("debugLogOn").checked;
  const row = document.getElementById("debugLogRow");
  if (!on) {
    row.style.display = "none";
    return;
  }
  row.style.display = "flex";
  const { ysxLog = [] } = await chrome.storage.local.get({ ysxLog: [] });
  const view = document.getElementById("logView");
  if (!ysxLog.length) {
    view.textContent = I18N.t("logEmpty");
    return;
  }
  const pad = (n) => String(n).padStart(2, "0");
  view.textContent = ysxLog
    .map((e) => {
      const d = new Date(e.t);
      const t = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      return `[${t}] ${e.step} | ${e.detail}`;
    })
    .join("\n");
}

document.getElementById("copyLog").addEventListener("click", async () => {
  const { ysxLog = [] } = await chrome.storage.local.get({ ysxLog: [] });
  const text = JSON.stringify(ysxLog, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    showStatus(I18N.t("logCopied"));
  } catch (e) {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("logView"));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    showStatus(I18N.t("logSelected"));
  }
});

document.getElementById("debugLogOn").addEventListener("change", () => {
  renderLogView();
});

const PRESET_COLORS = [
  "#FC3F1D", "#4285F4", "#2932E1", "#008373", "#C9A227", "#5C6BC0", "#EE2B7B", "#FB6022",
  "#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3", "#00BCD4", "#009688",
  "#4CAF50", "#8BC34A", "#FF9800", "#FF5722", "#795548", "#607D8B", "#1f1f1f", "#ffffff",
];

let paletteEl = null;

function closePalette() {
  if (paletteEl) paletteEl.remove();
  paletteEl = null;
}

function openPalette(anchor, current, onPick) {
  closePalette();
  paletteEl = document.createElement("div");
  paletteEl.id = "palette";

  const grid = document.createElement("div");
  grid.className = "p-grid";
  for (const c of PRESET_COLORS) {
    const sw = document.createElement("div");
    sw.className = "p-swatch";
    sw.style.background = c;
    sw.title = c;
    sw.addEventListener("click", () => {
      markDirty();
      onPick(c);
      closePalette();
    });
    grid.appendChild(sw);
  }
  paletteEl.appendChild(grid);

  const custom = document.createElement("div");
  custom.className = "p-custom";
  custom.innerHTML = `<span>${I18N.t("customColor")}</span><input type="color" value="${/^#[0-9a-f]{6}$/i.test(current) ? current : "#4285f4"}">`;
  custom.querySelector("input").addEventListener("input", (e) => {
    markDirty();
    onPick(e.target.value);
  });
  paletteEl.appendChild(custom);

  document.body.appendChild(paletteEl);

  const r = anchor.getBoundingClientRect();
  paletteEl.style.visibility = "hidden";
  paletteEl.style.display = "block";
  const pw = paletteEl.offsetWidth;
  const ph = paletteEl.offsetHeight;
  let x = r.left;
  let y = r.bottom + 6;
  if (x + pw > window.innerWidth - 8) x = window.innerWidth - pw - 8;
  if (y + ph > window.innerHeight - 8) y = r.top - ph - 6;
  paletteEl.style.left = Math.max(8, x) + "px";
  paletteEl.style.top = Math.max(8, y) + "px";
  paletteEl.style.visibility = "visible";
}

document.addEventListener("mousedown", (e) => {
  if (paletteEl && !paletteEl.contains(e.target) && !e.target.closest(".e-color-chip")) {
    closePalette();
  }
});

function bindPaletteToChip(chip) {
  chip.addEventListener("click", () => {
    openPalette(chip, chip.dataset.color, (c) => {
      chip.dataset.color = c;
      chip.style.background = c;
    });
  });
}

function clampDelay(v, max) {
  v = Math.round(Number(v) || 0);
  if (!isFinite(v) || v < 0) v = 0;
  return Math.min(max, v);
}

document.getElementById("addEngine").addEventListener("click", () => {
  const list = getEnginesFromUI();
  const used = new Set(list.map((e) => (e.color || "").toUpperCase()));
  const color =
    PRESET_COLORS.slice(0, 8).find((c) => !used.has(c.toUpperCase())) ||
    PRESET_COLORS[list.length % PRESET_COLORS.length];
  renderEngines([...list, { name: I18N.t("newEngine"), url: "https://example.com/search?url={%s}", enabled: true, icon: "新", color }]);
  const rows = rowsEl.querySelectorAll(".engine-row");
  const last = rows[rows.length - 1];
  last.querySelector(".e-name").focus();
  last.querySelector(".e-name").select();
});

let presets = []; // { id, name, engines }
let applyArmed = false; // 「恢复默认」两段式确认状态
let applyArmTimer = null;

async function loadPresets() {
  try {
    ({ ysxPresets: presets } = await chrome.storage.local.get({ ysxPresets: [] }));
  } catch (e) {
    presets = [];
  }
  renderPresetSelect();
}

function renderPresetSelect() {
  const sel = document.getElementById("presetSelect");
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "__default__";
  def.textContent = I18N.t("presetDefault");
  sel.appendChild(def);
  for (const p of presets) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
}

async function savePresetsToStorage() {
  await chrome.storage.local.set({ ysxPresets: presets });
}

async function applyEngineList(list, sourceLabel) {
  if (dirty && !applyArmed) {
    applyArmed = true;
    showStatus(I18N.t("presetApplyConfirm") + " — " + I18N.t("presetConfirmSave"));
    clearTimeout(applyArmTimer);
    applyArmTimer = setTimeout(() => { applyArmed = false; }, 4000);
    return;
  }
  applyArmed = false;
  clearTimeout(applyArmTimer);
  const stored = await extractIconsToLib(list.map((e) => ({ ...e })));
  await pruneIconLib(stored);
  const hydrated = await hydrateIcons(stored);
  renderEngines(hydrated);
  markDirty();
  showStatus(sourceLabel);
}

document.getElementById("resetEngines").addEventListener("click", () => {
  applyEngineList(DEFAULT_ENGINES.map((e) => ({ ...e })), I18N.t("resetDone"));
});

document.getElementById("presetSave").addEventListener("click", async () => {
  const name = document.getElementById("presetName").value.trim() ||
    "Preset " + (presets.length + 1);
  const engines = getEnginesFromUI();
  if (!engines.length) {
    showStatus(I18N.t("atLeastOneEngine"), true);
    return;
  }
  const existing = presets.find((p) => p.name === name);
  const entry = { id: existing ? existing.id : "p" + Date.now(), name, engines };
  if (existing) {
    presets = presets.map((p) => (p.id === existing.id ? entry : p));
  } else {
    presets.push(entry);
  }
  await savePresetsToStorage();
  renderPresetSelect();
  document.getElementById("presetSelect").value = entry.id;
  showStatus(I18N.t("presetSaved") + name + (existing ? I18N.t("presetOverwritten") : ""));
});

document.getElementById("presetDelete").addEventListener("click", async () => {
  const id = document.getElementById("presetSelect").value;
  if (id === "__default__") return; // 内置默认预设不可删
  const target = presets.find((p) => p.id === id);
  if (!target) {
    showStatus(I18N.t("presetNoneSelected"));
    return;
  }
  if (!applyArmed) {
    applyArmed = true;
    showStatus(I18N.t("presetDeleted") + target.name + " — " + I18N.t("presetConfirmSave"));
    clearTimeout(applyArmTimer);
    applyArmTimer = setTimeout(() => { applyArmed = false; }, 4000);
    return;
  }
  applyArmed = false;
  clearTimeout(applyArmTimer);
  presets = presets.filter((p) => p.id !== id);
  await savePresetsToStorage();
  renderPresetSelect();
  showStatus(I18N.t("presetDeleted") + target.name);
});

document.getElementById("presetSelect").addEventListener("change", async (e) => {
  const id = e.target.value;
  if (id === "__default__") {
    await applyEngineList(DEFAULT_ENGINES.map((x) => ({ ...x })), I18N.t("presetApplied"));
    return;
  }
  const p = presets.find((x) => x.id === id);
  if (p) await applyEngineList(p.engines.map((x) => ({ ...x })), I18N.t("presetApplied"));
});

rowsEl.addEventListener("click", (e) => {
  const upBtn = e.target.closest(".e-icon-upload");
  if (upBtn) {
    const fileInput = upBtn.parentElement.querySelector(".e-icon-file");
    if (fileInput) fileInput.click();
    return;
  }
  const btn = e.target.closest(".e-move");
  if (btn) {
    const row = btn.closest(".engine-row");
    const rows = Array.from(rowsEl.querySelectorAll(".engine-row"));
    moveRow(rows.indexOf(row), btn.dataset.dir === "up" ? -1 : 1);
    return;
  }
  const chip = e.target.closest(".e-color");
  if (chip) {
    openPalette(chip, chip.dataset.color, (c) => {
      chip.dataset.color = c;
      chip.style.background = c;
    });
    return;
  }
  if (e.target.classList.contains("e-del")) {
    const row = e.target.closest(".engine-row");
    if (row) row.remove();
  }
});

function compressIcon(dataUrl, size) {
  return new Promise((resolve, reject) => {
    size = size || 48;
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        const min = Math.min(img.width, img.height) || 1;
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(c.toDataURL("image/png"));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("decode fail"));
    img.src = dataUrl;
  });
}

rowsEl.addEventListener("change", (e) => {
  const fileInput = e.target.closest(".e-icon-file");
  if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
  const file = fileInput.files[0];
  if (!/^image\//.test(file.type)) return;
  const reader = new FileReader();
  reader.onload = () => {
    const wrap = fileInput.parentElement;
    const img = wrap.querySelector(".e-icon-img");
    const urlInput = wrap.querySelector(".e-icon-url");
    compressIcon(reader.result).then((small) => {
      img.src = small;
      img.style.display = "inline-block";
      urlInput.value = "";
      markDirty();
    }).catch(() => {
      img.src = reader.result;
      img.style.display = "inline-block";
      urlInput.value = "";
      markDirty();
    });
  };
  reader.readAsDataURL(file);
  fileInput.value = "";
});

rowsEl.addEventListener("dblclick", (e) => {
  const urlInput = e.target.closest(".e-url");
  if (!urlInput) return;
  urlInput.classList.add("expanded");
  urlInput.focus();
});
rowsEl.addEventListener("focusout", (e) => {
  if (e.target.classList && e.target.classList.contains("e-url")) {
    e.target.classList.remove("expanded");
  }
});
rowsEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && e.target.classList && e.target.classList.contains("e-url")) {
    e.target.classList.remove("expanded");
    e.target.blur();
  }
});

rowsEl.addEventListener("input", (e) => {
  const urlInput = e.target.closest(".e-icon-url");
  if (!urlInput) return;
  const img = urlInput.parentElement.querySelector(".e-icon-img");
  const v = urlInput.value.trim();
  if (/^(https?:|data:)/i.test(v)) {
    img.src = v;
    img.style.display = "inline-block";
  } else {
    img.style.display = "none";
  }
  markDirty();
});

document.getElementById("btnSize").addEventListener("input", (e) => {
  document.getElementById("sizeVal").textContent = e.target.value + " px";
  renderBarPreview();
});
document.getElementById("shotQuality").addEventListener("input", (e) => {
  document.getElementById("qualityVal").textContent = e.target.value;
});
function syncQualityEnabled() {
  const isPng = document.getElementById("shotFormat").value === "png";
  const q = document.getElementById("shotQuality");
  q.disabled = isPng;
  q.style.opacity = isPng ? "0.4" : "1";
  document.getElementById("qualityVal").style.opacity = isPng ? "0.4" : "1";
}
document.getElementById("shotFormat").addEventListener("change", syncQualityEnabled);

function syncConfirmPulseUi() {
  const isConfirm = document.getElementById("selectMode").value === "confirm";
  const cb = document.getElementById("confirmPulse");
  cb.disabled = !isConfirm;
  document.getElementById("confirmPulseRow").style.opacity = isConfirm ? "1" : "0.45";
}
document.getElementById("selectMode").addEventListener("change", syncConfirmPulseUi);

const blRowsEl = document.getElementById("blRows");
const wlRowsEl = document.getElementById("wlRows");

const COMMON_SITES = ["google.com", "yandex.ru", "bing.com", "baidu.com", "saucenao.com", "ascii2d.net"];

function wlRowHtml(domain) {
  return `<div class="engine-grid bl-grid bl-row">
    <input type="text" class="wl-domain" value="${escapeHtml(domain || "")}" placeholder="example.com">
    <button type="button" class="e-move" style="display:none;">↑</button>
    <button type="button" class="e-move" style="display:none;">↓</button>
    <button type="button" class="bl-del" title="${I18N.t("del")}">×</button>
  </div>`;
}

function renderWhitelist(domains) {
  wlRowsEl.innerHTML = domains.map(wlRowHtml).join("");
}

function getWhitelistFromUI() {
  return Array.from(wlRowsEl.querySelectorAll(".wl-domain"))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

document.getElementById("addWhitelist").addEventListener("click", () => {
  wlRowsEl.insertAdjacentHTML("beforeend", wlRowHtml(""));
  const rows = wlRowsEl.querySelectorAll(".wl-domain");
  rows[rows.length - 1].focus();
});

document.getElementById("addCommonSites").addEventListener("click", () => {
  const cur = new Set(getWhitelistFromUI());
  const missing = COMMON_SITES.filter((s) => !cur.has(s));
  if (missing.length) {
    wlRowsEl.insertAdjacentHTML("beforeend", missing.map(wlRowHtml).join(""));
    markDirty();
  }
});

wlRowsEl.addEventListener("click", (e) => {
  if (e.target.classList.contains("bl-del")) {
    const row = e.target.closest(".bl-row");
    if (row) row.remove();
  }
});

function blRowHtml(domain) {
  return `<div class="engine-grid bl-grid bl-row">
    <input type="text" class="bl-domain" value="${escapeHtml(domain || "")}" placeholder="example.com">
    <button type="button" class="e-move" style="display:none;">↑</button>
    <button type="button" class="e-move" style="display:none;">↓</button>
    <button type="button" class="bl-del" title="${I18N.t("del")}">×</button>
  </div>`;
}

function renderBlacklist(domains) {
  blRowsEl.innerHTML = domains.map(blRowHtml).join("");
}

function getBlacklistFromUI() {
  return Array.from(blRowsEl.querySelectorAll(".bl-domain"))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

document.getElementById("addBlack").addEventListener("click", () => {
  blRowsEl.insertAdjacentHTML("beforeend", blRowHtml(""));
  const rows = blRowsEl.querySelectorAll(".bl-domain");
  rows[rows.length - 1].focus();
});

blRowsEl.addEventListener("click", (e) => {
  if (e.target.classList.contains("bl-del")) {
    const row = e.target.closest(".bl-row");
    if (row) row.remove();
  }
});

document.getElementById("selectDirBtn").addEventListener("click", async () => {
  try {
    if (!window.showDirectoryPicker) {
      showStatus(I18N.t("dirPickerUnsupported"));
      return;
    }
    const handle = await window.showDirectoryPicker();
    if (handle && handle.name) {
      document.getElementById("saveShotDir").value = handle.name;
      markDirty();
      updateSaveDirPreview();
    }
  } catch (e) {
  }
});

document.getElementById("resetDirBtn").addEventListener("click", () => {
  document.getElementById("saveShotDir").value = DEFAULT_SAVE_DIR;
  markDirty();
  updateSaveDirPreview();
});

let downloadRoot = ""; // 检测到的浏览器下载目录绝对路径

async function detectDownloadRoot() {
  try {
    const items = await new Promise((r) =>
      chrome.downloads.search({ limit: 1, orderBy: ["-startTime"] }, (its) => r(its || []))
    );
    if (items.length && items[0].filename) {
      const isWin = navigator.userAgent.includes("Windows");
      let f = items[0].filename;
      if (isWin) f = f.replace(/\//g, "\\");
      const i = f.lastIndexOf(isWin ? "\\" : "/");
      downloadRoot = i >= 0 ? f.slice(0, i + 1) : "";
    }
  } catch (e) { /* 无下载记录时拿不到 */ }
  updateSaveDirPreview();
}

function updateSaveDirPreview() {
  const dirEl = document.getElementById("saveShotDir");
  const row = document.getElementById("saveDirPreviewRow");
  if (!row || row.style.display === "none") return;
  const dir = cleanSaveDir(dirEl.value);
  const root = downloadRoot || "";
  const sep = downloadRoot ? (navigator.userAgent.includes("Windows") ? "\\" : "/") : "";
  document.getElementById("saveDirPreview").textContent =
    (downloadRoot ? "📁 " : "") + root + sep + (dir ? dir + sep : "");
}

document.getElementById("saveShotDir").addEventListener("input", updateSaveDirPreview);

document.getElementById("saveShot").addEventListener("change", (e) => {
  document.getElementById("saveDirRow").style.display = e.target.checked ? "flex" : "none";
  document.getElementById("saveDirPreviewRow").style.display = e.target.checked ? "flex" : "none";
});

function renderBarPreview() {
  const size = Number(document.getElementById("btnSize").value) || 28;
  const pv = document.getElementById("barPreview");
  if (!pv) return;
  pv.innerHTML = "";
  const bar = document.createElement("div");
  bar.className = "pv-bar";
  bar.style.setProperty("--size", size + "px");
  const samples = [
    ["Y", "#FC3F1D"],
    ["G", "#4285F4"],
    ["度", "#2932E1"],
    ["全", "#3a3f45"],
  ];
  for (const [t, c] of samples) {
    const b = document.createElement("div");
    b.className = "pv-btn";
    b.style.background = c;
    b.textContent = t;
    bar.appendChild(b);
  }
  pv.appendChild(bar);
}

(async () => {
  try {
    const cmds = await chrome.commands.getAll();
    const cmd = cmds.find((c) => c.name === "ysx-capture");
    document.getElementById("shortcutDisplay").textContent =
      cmd && cmd.shortcut ? cmd.shortcut : I18N.t("notSet");
  } catch (e) {
    document.getElementById("shortcutDisplay").textContent = I18N.t("notSet");
  }
})();
document.getElementById("openShortcuts").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

document.getElementById("save").addEventListener("click", async () => {
  const engines = getEnginesFromUI();
  if (engines.filter((e) => e.enabled).length === 0) {
    showStatus(I18N.t("atLeastOneEngine"), true);
    return;
  }
  const badRow = engines.findIndex((e) => !/^https?:\/\//i.test(e.url));
  if (badRow >= 0) {
    showStatus(I18N.t("badTemplate") + " — #" + (badRow + 1) + " " + engines[badRow].name, true);
    return;
  }
  try {
    const storedEngines = await extractIconsToLib(engines);
    await pruneIconLib(storedEngines);
    await chrome.storage.sync.set({
    engines: storedEngines,
    screenshotMenu: document.getElementById("screenshotMenu").checked,
    barAlign: document.getElementById("barAlign").value,
    hoverEnabled: document.getElementById("hoverEnabled").checked,
    hoverDelay: clampDelay(document.getElementById("hoverDelay").value, 3000),
    hideDelay: clampDelay(document.getElementById("hideDelay").value, 5000),
    ysxBtnSize: Number(document.getElementById("btnSize").value) || 28,
    openMode: document.getElementById("openMode").value,
    uploadEngine: document.getElementById("uploadEngine").value,
    enableShotAll: document.getElementById("enableShotAll").checked,
    shotFormat: document.getElementById("shotFormat").value,
    shotQuality: Number(document.getElementById("shotQuality").value) || 92,
    selectMode: document.getElementById("selectMode").value,
    confirmPulse: document.getElementById("confirmPulse").checked,
    selColor: document.getElementById("selColorChip").dataset.color,
    saveShot: document.getElementById("saveShot").checked,
    saveShotDir: cleanSaveDir(document.getElementById("saveShotDir").value),
    copyShot: document.getElementById("copyShot").checked,
    statusBubble: document.getElementById("statusBubble").checked,
    debugLogOn: document.getElementById("debugLogOn").checked,
    enableSearchAll: document.getElementById("enableSearchAll").checked,
    infoCard: document.getElementById("infoCard").checked,
    whitelistMode: document.getElementById("whitelistMode").checked,
    whitelist: getWhitelistFromUI().join("\n"),
    allBtnIcon: document.getElementById("allBtnIcon").value.trim() || ALL_BTN_DEFAULT_ICON,
    allBtnColor: document.getElementById("allBtnColorChip").dataset.color,
    historyEnabled: document.getElementById("historyEnabled").checked,
    historyKeep: Number(document.getElementById("historyKeep").value) || 0,
    blacklist: getBlacklistFromUI().join("\n"),
    });
    clearDirty();
    showStatus(I18N.t("saved"));
  } catch (e) {
    const m = (e && e.message) || String(e);
    showStatus(/quota|QUOTA|quotaExceeded/i.test(m)
      ? I18N.t("saveFailQuota")
      : I18N.t("saveFailRetry") + m.slice(0, 80), true);
  }
});

async function renderStats() {
  const { ysxStats = {} } = await chrome.storage.local.get({ ysxStats: {} });
  const block = document.getElementById("statsBlock");
  const days = Object.keys(ysxStats).sort().slice(-7);
  if (!days.length) {
    block.innerHTML = '<h3>' + I18N.t("statsTitle") + '</h3>' +
      '<div class="stat-grid"><div class="stat-card"><h4>' + I18N.t("statsLast7") +
      '</h4><div class="stat-nums" style="color:var(--muted);font-size:12px;">' +
      I18N.t("statsEmpty") + '</div></div></div>';
    return;
  }
  const total7 = days.reduce((s, d) => s + (ysxStats[d].total || 0), 0);
  const shots7 = days.reduce((s, d) => s + (ysxStats[d].shots || 0), 0);
  const images7 = total7 - shots7;
  const engAgg = {};
  for (const d of days) {
    for (const [en, n] of Object.entries(ysxStats[d].engines || {})) {
      engAgg[en] = (engAgg[en] || 0) + n;
    }
  }
  const engList = Object.entries(engAgg).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxEng = engList.length ? engList[0][1] : 1;

  let html = '<h3>' + I18N.t("statsTitle") + '</h3><div class="stat-grid">';
  html += '<div class="stat-card"><h4>' + I18N.t("statsLast7") + '</h4><div class="stat-nums">' +
    '<span>' + I18N.t("statsTotal") + ' <b>' + total7 + '</b></span>' +
    '<span>' + I18N.t("statsShots") + ' <b>' + shots7 + '</b></span>' +
    '<span>' + I18N.t("statsImages") + ' <b>' + images7 + '</b></span>' +
    '</div></div>';
  html += '<div class="stat-card"><h4>' + I18N.t("statsEngines") + '</h4>';
  for (const [en, n] of engList) {
    const pct = Math.round((n / maxEng) * 100);
    html += '<div class="stat-bar-row"><span class="stat-bar-label">' + escapeHtml(en) + '</span>' +
      '<span class="stat-bar-track"><span class="stat-bar-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="stat-bar-val">' + n + '</span></div>';
  }
  html += '</div></div>';
  block.innerHTML = html;
}

async function renderHistory() {
  const { ysxHistory = [] } = await chrome.storage.local.get({ ysxHistory: [] });
  const listEl = document.getElementById("historyList");
  const items = ysxHistory.slice(0, 50);
  if (!items.length) {
    listEl.innerHTML = '<div class="h-empty">' + I18N.t("noRecords") + '</div>';
    return;
  }
  const pad = (n) => String(n).padStart(2, "0");
  listEl.innerHTML = items
    .map((h) => {
      const d = new Date(h.t);
      const time = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const type = h.type === "shot" ? I18N.t("typeShot") : I18N.t("typeImage");
      const eng = escapeHtml(h.engine || "");
      const url = escapeHtml(h.url || "");
      return `<div class="h-item"><span class="h-time">${time}</span><span class="h-type ${h.type === "shot" ? "t-shot" : "t-img"}">${type}</span><span class="h-eng">${eng}</span><a class="h-link" href="${url}" target="_blank" rel="noreferrer noopener">${I18N.t("open")}</a></div>`;
    })
    .join("");
}

document.getElementById("clearHistory").addEventListener("click", async () => {
  await chrome.storage.local.set({ ysxHistory: [] });
  renderHistory();
  showStatus(I18N.t("cleared"));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.ysxLog) renderLogView();
    if (changes.ysxHistory) renderHistory();
    if (changes.ysxStats) renderStats();
  } else if (area === "sync" && changes.debugLogOn) {
    renderLogView();
  }
});

document.getElementById("exportSettings").addEventListener("click", async () => {
  const data = await chrome.storage.sync.get(null);
  if (Array.isArray(data.engines)) {
    data.engines = await hydrateIcons(data.engines);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "yitu-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus(I18N.t("exported"));
});

const IMPORT_CHECKERS = {
  engines: (v) => Array.isArray(v) && v.every((e) => e && typeof e === "object" && typeof e.name === "string" && typeof e.url === "string"),
  screenshotMenu: Boolean, barAlign: (v) => ["left", "center", "right"].includes(v),
  hoverEnabled: Boolean, hoverDelay: isFiniteNumber, hideDelay: isFiniteNumber,
  ysxBtnSize: isFiniteNumber, openMode: (v) => ["foreground", "background", "current"].includes(v),
  uploadEngine: (v) => ["yandex", "google"].includes(v),
  enableShotAll: Boolean, shotFormat: (v) => ["jpeg", "png"].includes(v),
  shotQuality: isFiniteNumber, selectMode: (v) => ["instant", "confirm"].includes(v),
  selColor: isHexColor, saveShot: Boolean, saveShotDir: (v) => typeof v === "string",
  copyShot: Boolean, statusBubble: Boolean, debugLogOn: Boolean,
  enableSearchAll: Boolean, infoCard: Boolean, whitelistMode: Boolean,
  whitelist: (v) => typeof v === "string", blacklist: (v) => typeof v === "string",
  allBtnIcon: (v) => typeof v === "string" && v.length <= 2, allBtnColor: isHexColor,
  historyEnabled: Boolean, historyKeep: (v) => [0, 7, 30, 90].includes(Number(v)),
  lang: (v) => ["zh", "en"].includes(v), theme: (v) => ["light", "dark"].includes(v),
};

function isFiniteNumber(v) { return Number.isFinite(Number(v)); }
function isHexColor(v) { return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v); }

function sanitizeImport(raw) {
  const data = {};
  const dropped = [];
  for (const [key, value] of Object.entries(raw)) {
    const check = IMPORT_CHECKERS[key];
    if (!check) { dropped.push(key); continue; }
    if (check(value)) data[key] = value;
    else dropped.push(key);
  }
  if (data.engines) {
    data.engines = data.engines.map((e) => ({
      ...e,
      name: String(e.name).slice(0, 24),
      url: String(e.url),
      enabled: e.enabled !== false,
    }));
  }
  return { data, dropped };
}

document.getElementById("importSettings").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(I18N.t("invalidSettingsFile"));
    }
    if (!("engines" in raw) || !IMPORT_CHECKERS.engines(raw.engines)) {
      throw new Error(I18N.t("importEngines"));
    }
    const { data, dropped } = sanitizeImport(raw);
    if (Array.isArray(data.engines)) {
      data.engines = await extractIconsToLib(data.engines);
      await pruneIconLib(data.engines);
    }
    await chrome.storage.sync.set(data);
    showStatus(I18N.t("importOk") + (dropped.length ? ` (${I18N.t("importField")}${dropped.slice(0, 3).join(",")})` : ""));
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    showStatus(I18N.t("importFail") + ((err && err.message) || err), true);
  } finally {
    e.target.value = "";
  }
});

(async () => {
  const s = await chrome.storage.sync.get({
    engines: DEFAULT_ENGINES,
    screenshotMenu: true,
    barAlign: "center",
    hoverEnabled: true,
    hoverDelay: 0,
    hideDelay: 300,
    ysxBtnSize: 28,
    openMode: "foreground",
    uploadEngine: "yandex",
    enableShotAll: false,
    shotFormat: "jpeg",
    shotQuality: 92,
    selectMode: "instant",
    selColor: "#ffcc00",
    saveShot: false,
    saveShotDir: DEFAULT_SAVE_DIR,
    copyShot: false,
    statusBubble: true,
    debugLogOn: false,
    enableSearchAll: true,
    infoCard: true,
    whitelistMode: false,
    whitelist: COMMON_SITES.slice(0, 4).join("\n"),
    allBtnIcon: ALL_BTN_DEFAULT_ICON,
    allBtnColor: "#3a3f45",
    historyEnabled: true,
    historyKeep: 30,
    blacklist: "",
  });
  const list = (Array.isArray(s.engines) ? s.engines : DEFAULT_ENGINES)
    .filter((e) => e && e.name && e.url);
  const hydrated = await hydrateIcons(list.map((e) => ({ ...e })));
  renderEngines(hydrated);
  document.getElementById("screenshotMenu").checked = s.screenshotMenu !== false;
  document.getElementById("barAlign").value = s.barAlign || "center";
  document.getElementById("hoverEnabled").checked = s.hoverEnabled !== false;
  document.getElementById("hoverDelay").value = clampDelay(s.hoverDelay, 3000);
  document.getElementById("hideDelay").value = clampDelay(s.hideDelay, 5000);
  const size = Math.min(64, Math.max(20, Number(s.ysxBtnSize) || 28));
  document.getElementById("btnSize").value = size;
  document.getElementById("sizeVal").textContent = size + " px";
  document.getElementById("openMode").value = s.openMode || "foreground";
  document.getElementById("uploadEngine").value = s.uploadEngine || "yandex";
  document.getElementById("enableShotAll").checked = s.enableShotAll === true;
  syncShotAllUi();
  document.getElementById("shotFormat").value = s.shotFormat === "png" ? "png" : "jpeg";
  document.getElementById("shotQuality").value = Math.min(100, Math.max(10, Number(s.shotQuality) || 92));
  document.getElementById("qualityVal").textContent = document.getElementById("shotQuality").value;
  document.getElementById("selectMode").value = s.selectMode === "confirm" ? "confirm" : "instant";
  document.getElementById("confirmPulse").checked = s.confirmPulse !== false;
  syncConfirmPulseUi();
  document.getElementById("saveShot").checked = s.saveShot === true;
  document.getElementById("saveShotDir").value = String(s.saveShotDir || DEFAULT_SAVE_DIR);
  document.getElementById("saveDirRow").style.display = s.saveShot === true ? "flex" : "none";
  document.getElementById("saveDirPreviewRow").style.display = s.saveShot === true ? "flex" : "none";
  document.getElementById("copyShot").checked = s.copyShot === true;
  document.getElementById("statusBubble").checked = s.statusBubble !== false;
  document.getElementById("debugLogOn").checked = s.debugLogOn === true;
  renderLogView();
  document.getElementById("enableSearchAll").checked = s.enableSearchAll !== false;
  document.getElementById("infoCard").checked = s.infoCard !== false;
  document.getElementById("whitelistMode").checked = s.whitelistMode === true;
  renderWhitelist(parseBlacklistStr(String(s.whitelist ?? "")));
  document.getElementById("allBtnCustomRow").style.display =
    s.enableSearchAll !== false ? "block" : "none";
  document.getElementById("allBtnIcon").value = String(s.allBtnIcon || ALL_BTN_DEFAULT_ICON);
  const allChip = document.getElementById("allBtnColorChip");
  allChip.dataset.color = /^#[0-9a-f]{6}$/i.test(s.allBtnColor) ? s.allBtnColor : "#3a3f45";
  allChip.style.background = allChip.dataset.color;
  bindPaletteToChip(allChip);
  document.getElementById("historyEnabled").checked = s.historyEnabled !== false;
  document.getElementById("historyKeep").value = String([0, 7, 30, 90].includes(Number(s.historyKeep)) ? Number(s.historyKeep) : 30);
  renderBlacklist(parseBlacklistStr(String(s.blacklist || "")));
  const selChip = document.getElementById("selColorChip");
  selChip.dataset.color = /^#[0-9a-f]{6}$/i.test(s.selColor) ? s.selColor : "#ffcc00";
  selChip.style.background = selChip.dataset.color;
  bindPaletteToChip(selChip);
  syncQualityEnabled();
  loadPresets();
  renderBarPreview();
  renderHistory();
  renderStats();
  detectDownloadRoot();
  updateSaveDirPreview();
})();

function parseBlacklistStr(s) {
  return String(s || "").split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
}
