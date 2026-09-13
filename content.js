
(() => {
  if (window.__ysxInjected) return;
  window.__ysxInjected = true;

  const STATE = { overlay: null, start: null, selecting: false, rect: null, confirming: false };
  let hoverBar = null;        // 引擎图标条
  let barEngines = null;      // 构建当前图标条所用的引擎列表（脏检查用）
  let currentImg = null;
  let currentBgUrl = null;
  let hideTimer = null;
  let showTimer = null;
  let searching = false;
  let searchingTimer = null;
  let warmed = false;
  let hoverEnabled = true;
  let hoverDelay = 0;
  let hideDelay = 300; // 离开图片后图标条延迟消失（ms）
  let barAlign = "center"; // 图标条对齐：left / center / right
  let selectMode = "instant"; // instant | confirm
  let confirmPulse = true; // 确认模式选框呼吸提醒（可在设置中关闭）
  let selColor = "#ffcc00";
  let statusBubbleOn = true;
  let searchAllOn = true; // 「全」按钮开关
  let allBtnIcon = "全";
  let infoCardOn = true; // 图片信息卡片开关
  let infoCard = null; // 图片信息卡片
  let allBtnColor = "#3a3f45";
  let btnSize = 28; // 按钮尺寸（声明提前，避免先赋值后声明的 TDZ 风险）
  let blList = []; // 网站黑名单（域名后缀）
  let wlMode = false; // 白名单模式
  let wlList = [];    // 白名单（域名后缀）

  function clampMs(v, max) {
    v = Math.round(Number(v));
    if (!isFinite(v) || v < 0) v = 0;
    return Math.min(max, v);
  }

  function sendMsg(msg) {
    return new Promise((resolve) => {
      let tries = 0;
      const attempt = () => {
        tries++;
        try {
          chrome.runtime.sendMessage(msg, (resp) => {
            const err = chrome.runtime.lastError;
            const invalid = err && /invalidated|context/i.test(err.message || "");
            if (invalid) {
              showStatusBubble(I18N.t("extUpdated"), "error");
              resolve(null);
              return;
            }
            if ((err || resp === undefined) && tries < 3) {
              setTimeout(attempt, 350);
            } else {
              resolve(resp || null);
            }
          });
        } catch (e) {
          if (String(e).includes("Invalidated") || String(e).includes("invoked")) {
            showStatusBubble(I18N.t("extUpdated"), "error");
            resolve(null);
            return;
          }
          if (tries < 3) setTimeout(attempt, 350);
          else resolve(null);
        }
      };
      attempt();
    });
  }

  function parseBlacklist(s) {
    return String(s || "")
      .split(/[\n,]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x && !x.startsWith("#"));
  }

  function inBlacklist() {
    if (!blList.length) return false;
    const h = location.hostname.toLowerCase();
    return blList.some((p) => h === p || h.endsWith("." + p));
  }

  function inWhitelist() {
    const h = location.hostname.toLowerCase();
    return wlList.some((p) => h === p || h.endsWith("." + p));
  }

  function barAllowedOnSite() {
    if (inBlacklist()) return false;
    if (wlMode && !inWhitelist()) return false;
    return true;
  }

  const FALLBACK_COLORS = ["#4285F4", "#34A853", "#FBBC05", "#EA4335", "#7B1FA2", "#00838F", "#5D4037", "#455A64"];
  function fallbackColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
  }

  async function loadContentSettings() {
    try {
      const s = await chrome.storage.sync.get({
        hoverEnabled: true,
        hoverDelay: 0,
        hideDelay: 300,
        ysxBtnSize: 28,
        barAlign: "center",
        selectMode: "instant",
      confirmPulse: true,
        selColor: "#ffcc00",
        statusBubble: true,
        enableSearchAll: true,
        allBtnIcon: "全",
        allBtnColor: "#3a3f45",
        infoCard: true,
        lang: "zh",
        theme: "light",
        blacklist: "",
        whitelistMode: false,
        whitelist: "",
      });
      I18N.setLang(s.lang === "en" ? "en" : "zh");
      document.documentElement.dataset.ysxTheme = s.theme === "dark" ? "dark" : "light";
      hoverEnabled = s.hoverEnabled !== false;
      hoverDelay = clampMs(s.hoverDelay, 3000);
      hideDelay = clampMs(s.hideDelay, 5000);
      btnSize = Math.min(64, Math.max(20, Number(s.ysxBtnSize) || 28));
      barAlign = ["left", "center", "right"].includes(s.barAlign) ? s.barAlign : "center";
      selectMode = s.selectMode === "confirm" ? "confirm" : "instant";
      confirmPulse = s.confirmPulse !== false;
      selColor = /^#[0-9a-f]{6}$/i.test(s.selColor) ? s.selColor : "#ffcc00";
      statusBubbleOn = s.statusBubble !== false;
      searchAllOn = s.enableSearchAll !== false;
      allBtnIcon = String(s.allBtnIcon || "全");
      allBtnColor = /^#[0-9a-f]{6}$/i.test(s.allBtnColor) ? s.allBtnColor : "#3a3f45";
      infoCardOn = s.infoCard !== false;
      blList = parseBlacklist(s.blacklist);
      wlMode = s.whitelistMode === true;
      wlList = parseBlacklist(s.whitelist);
    } catch (e) { /* keep defaults */ }
    barEngines = null; // 设置变化后重建图标条
    if (!hoverEnabled || !barAllowedOnSite()) hideHoverBar();
  }

  loadContentSettings();

  chrome.storage.onChanged.addListener((changes, area) => {
    try {
      if (area !== "sync") return;
      let rebuild = false;
      if (changes.hoverEnabled) {
        hoverEnabled = changes.hoverEnabled.newValue !== false;
        if (!hoverEnabled) hideHoverBar();
      }
      if (changes.blacklist) {
        blList = parseBlacklist(changes.blacklist.newValue);
        if (inBlacklist()) hideHoverBar();
      }
      if (changes.whitelist) {
        wlList = parseBlacklist(changes.whitelist.newValue);
        if (wlMode && !inWhitelist()) hideHoverBar();
      }
      if (changes.whitelistMode) {
        wlMode = changes.whitelistMode.newValue === true;
        if (wlMode && !inWhitelist()) hideHoverBar();
      }
      if (changes.lang) {
        I18N.setLang(changes.lang.newValue === "en" ? "en" : "zh");
      }
      if (changes.confirmPulse) {
        confirmPulse = changes.confirmPulse.newValue !== false;
        if (!confirmPulse && STATE.selecting) {
          const sel = document.getElementById("ysx-sel");
          if (sel) sel.classList.remove("ysx-confirming");
        }
      }
      if (changes.theme) {
        document.documentElement.dataset.ysxTheme =
          changes.theme.newValue === "dark" ? "dark" : "light";
      }
      if (changes.hoverDelay) {
        hoverDelay = clampMs(changes.hoverDelay.newValue, 3000);
      }
      if (changes.hideDelay) {
        hideDelay = clampMs(changes.hideDelay.newValue, 5000);
      }
      if (changes.barAlign) {
        barAlign = ["left", "center", "right"].includes(changes.barAlign.newValue)
          ? changes.barAlign.newValue : "center";
      }
      if (changes.enableSearchAll) {
        searchAllOn = changes.enableSearchAll.newValue !== false;
        barEngines = null; // 重建图标条以增删「全」按钮
      }
      if (changes.infoCard) infoCardOn = changes.infoCard.newValue !== false;
      if (changes.allBtnIcon || changes.allBtnColor) {
        allBtnIcon = changes.allBtnIcon
          ? String(changes.allBtnIcon.newValue || "全")
          : allBtnIcon;
        allBtnColor =
          changes.allBtnColor && /^#[0-9a-f]{6}$/i.test(changes.allBtnColor.newValue)
            ? changes.allBtnColor.newValue
            : allBtnColor;
        barEngines = null;
      }
      if (changes.ysxBtnSize) {
        btnSize = Math.min(64, Math.max(20, Number(changes.ysxBtnSize.newValue) || 28));
        rebuild = true;
      }
      if (changes.engines || changes.enableSearchAll) rebuild = true;
      if (rebuild) {
        barEngines = null;
        if (hoverBar && hoverBar.style.display !== "none") {
          const curSrc =
            (currentImg && (currentImg.currentSrc || currentImg.src)) ||
            currentBgUrl || "";
          if (curSrc) {
            hoverBar.dataset.src = "";
            buildBarButtons(curSrc);
          }
        } else if (hoverBar) {
          hoverBar.dataset.src = "";
        }
      }
    } catch (e) {
      console.error("ysx onChanged error:", e);
    }
  });

  function applyBtnSize() {
    if (!hoverBar) return;
    hoverBar.style.setProperty("--ysx-size", btnSize + "px");
  }

  function warmupSW() {
    if (warmed) return;
    warmed = true;
    try {
      sendMsg({ type: "ysx-warmup" });
    } catch (e) { /* ignore */ }
  }

  function pageZoomFactor() {
    let z = 1;
    try {
      if (window.outerWidth > 0 && window.innerWidth > 0) {
        z = window.outerWidth / window.innerWidth;
      }
    } catch (e) { z = 1; }
    if (!isFinite(z) || z <= 0) z = 1;
    return Math.min(3, Math.max(0.6, z));
  }

  function applyZoomCompensation() {
    if (!hoverBar) return;
    hoverBar.style.transform = "scale(" + (1 / pageZoomFactor()).toFixed(3) + ")";
  }

  function ensureBar() {
    if (!hoverBar) {
      hoverBar = document.createElement("div");
      hoverBar.id = "ysx-hover-bar";
      document.documentElement.appendChild(hoverBar);
    }
    if (!infoCard) {
      infoCard = document.createElement("div");
      infoCard.id = "ysx-info-card";
      document.documentElement.appendChild(infoCard);
    }
    applyBtnSize();
    return hoverBar;
  }

  function updateInfoCard(img) {
    if (!infoCard || !img || !infoCardOn) {
      if (infoCard) infoCard.style.display = "none";
      return;
    }
    let info = "";
    if (img.naturalWidth && img.naturalHeight) {
      info += img.naturalWidth + "×" + img.naturalHeight;
    }
    try {
      const host = new URL(img.currentSrc || img.src || "").hostname;
      if (host) info += (info ? " · " : "") + host;
    } catch (e) { /* ignore */ }
    infoCard.textContent = info || "";
    const bar = document.getElementById("ysx-hover-bar");
    if (!bar || bar.style.display === "none") return;
    const br = bar.getBoundingClientRect();
    infoCard.style.display = "block";
    const w = infoCard.offsetWidth;
    let x = br.left + br.width / 2 - w / 2;
    x = Math.min(Math.max(4, x), window.innerWidth - w - 4);
    infoCard.style.left = x + "px";
    infoCard.style.top = br.bottom + 4 + "px";
  }

  function buildBarButtons(src) {
    const bar = ensureBar();
    bar.innerHTML = "";

    if (/^(data:|blob:)/i.test(src)) {
      const up = document.createElement("div");
      up.className = "ysx-eng-btn";
      up.textContent = "↑";
      up.style.background = "#FC3F1D";
      up.title = I18N.t("uploadYandex");
      up.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        uploadLocalImage(src);
      });
      bar.appendChild(up);
      return;
    }

    let engines = barEngines;
    if (!engines) {
      engines = DEFAULT_ENGINES.filter((e) => e.enabled !== false);
      chrome.storage.sync.get({ engines: DEFAULT_ENGINES }, async ({ engines: stored }) => {
        const list = (Array.isArray(stored) ? stored : DEFAULT_ENGINES)
          .filter((e) => e && e.name && e.url && e.enabled !== false);
        const full = await hydrateIcons(list);
        barEngines = full.map((e) => ({
          ...e,
          icon: e.icon || (e.name || "?")[0],
          color: e.color || fallbackColor(e.name || "?"),
        }));
        if (currentImg || currentBgUrl) {
          const src2 = (currentImg && (currentImg.currentSrc || currentImg.src)) || currentBgUrl || "";
          if (src2) buildBarButtons(src2);
        }
      });
    }

    for (const e of engines) {
      const b = document.createElement("div");
      b.className = "ysx-eng-btn";
      if (e.iconImg) {
        const img = document.createElement("img");
        img.className = "ysx-eng-img";
        img.src = e.iconImg;
        img.alt = "";
        b.appendChild(img);
        b.style.background = "transparent";
      } else {
        b.textContent = e.icon || (e.name || "?")[0];
      }
      b.style.background = e.iconImg ? "transparent" : (e.color || fallbackColor(e.name || "?"));
      b.title = I18N.t("searchWith").replaceAll("X", e.name);
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (currentImg) flashImage(currentImg);
        try {
          sendMsg({
            type: "ysx-open-engine",
            template: e.url,
            engineName: e.name,
            imgSrc: src,
          });
        } catch (err) { /* ignore */ }
        hideHoverBar();
      });
      bar.appendChild(b);
    }

    if (searchAllOn && engines.length > 1 && /^https?:/i.test(src)) {
      const all = document.createElement("div");
      all.className = "ysx-eng-btn ysx-eng-all";
      all.textContent = allBtnIcon;
      all.style.background = allBtnColor;
      all.title = I18N.t("searchWithAll");
      all.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (currentImg) flashImage(currentImg);
        try {
          sendMsg({
            type: "ysx-open-all",
            templates: engines.map((x) => x.url),
            names: engines.map((x) => x.name),
            imgSrc: src,
          });
        } catch (err) { /* ignore */ }
        hideHoverBar();
      });
      bar.appendChild(all);
    }
  }

  function uploadLocalImage(src) {
    if (searching) return;
    searching = true;
    if (hoverBar) hoverBar.classList.add("ysx-loading");
    if (searchingTimer) clearTimeout(searchingTimer);
    searchingTimer = setTimeout(() => {
      searching = false;
      if (hoverBar) hoverBar.classList.remove("ysx-loading");
    }, 8000);

    const send = (dataUrl) => {
      searching = false;
      if (hoverBar) hoverBar.classList.remove("ysx-loading");
      try {
        sendMsg({ type: "ysx-search-upload", dataUrl });
      } catch (e) { /* ignore */ }
      hideHoverBar();
    };

    if (/^data:/i.test(src)) {
      send(src);
      return;
    }
    fetch(src)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = () => reject(new Error("read fail"));
            fr.readAsDataURL(blob);
          })
      )
      .then(send)
      .catch(() => {
        searching = false;
        if (hoverBar) hoverBar.classList.remove("ysx-loading");
      });
  }

  function showHoverBar(img, bgUrl) {
    if (STATE.selecting) return;
    currentImg = img;
    currentBgUrl = bgUrl || null;
    if (searching) return;

    const src = (img.currentSrc || img.src || bgUrl || "").trim();
    if (!src) return;

    const bar = ensureBar();
    const sig = src.slice(0, 120);
    if (!barEngines || bar.dataset.src !== sig) {
      bar.dataset.src = sig;
      buildBarButtons(src);
    }

    const r = img.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    applyBtnSize();
    const bw = bar.offsetWidth || 100;
    const bh = bar.offsetHeight || 30;
    let x;
    if (barAlign === "left") x = r.left;
    else if (barAlign === "right") x = r.right - bw;
    else x = r.left + r.width / 2 - bw / 2;
    let y = r.top - bh - 6;
    if (y < 4) y = Math.min(r.top + 4, vh - bh - 4);
    x = Math.min(Math.max(4, x), vw - bw - 4);
    bar.style.left = x + "px";
    bar.style.top = y + "px";
    applyZoomCompensation();
    bar.style.display = "flex";
    warmupSW();
    updateInfoCard(img);
    if (hideTimer) clearTimeout(hideTimer);
  }

  function hideHoverBar() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (searching) return; // 上传反馈期间不隐藏
    if (hideTimer) clearTimeout(hideTimer);
    if (hoverBar) hoverBar.style.display = "none";
    if (infoCard) infoCard.style.display = "none";
    currentImg = null;
    currentBgUrl = null;
  }

  function extractBgUrl(el) {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (!bg || bg === "none") return null;
    const m = bg.match(/url\((['"]?)(.*?)\1\)/);
    if (!m) return null;
    const url = m[2];
    return /^https?:/.test(url) ? url : null;
  }

  function findImgFromTarget(target) {
    let el = target;
    while (el && el !== document.documentElement) {
      if (el.tagName === "IMG") {
        const src = el.currentSrc || el.src;
        if (src) return { img: el, bgUrl: null };
      }
      if (el.tagName === "PICTURE") {
        const img = el.querySelector("img");
        if (img) {
          const src = img.currentSrc || img.src;
          if (src) return { img, bgUrl: null };
        }
      }
      const bgUrl = extractBgUrl(el);
      if (bgUrl) return { img: el, bgUrl };
      el = el.parentElement;
    }
    return null;
  }

  function flashImage(img) {
    if (img && img.classList) {
      img.classList.add("ysx-flash");
      setTimeout(() => img.classList.remove("ysx-flash"), 400);
    }
  }

  function startSelection() {
    if (STATE.selecting) return;
    hideHoverBar();

    const overlay = document.createElement("div");
    overlay.id = "ysx-overlay";
    const dim = document.createElement("div");
    dim.id = "ysx-dim";
    const sel = document.createElement("div");
    sel.id = "ysx-sel";
    sel.style.borderColor = selColor; // 自定义选框颜色

    overlay.appendChild(dim);
    overlay.appendChild(sel);

    const hint = document.createElement("div");
    hint.id = "ysx-hint";
    hint.textContent = I18N.t("dragHint");
    overlay.appendChild(hint);

    const sizeLabel = document.createElement("div");
    sizeLabel.id = "ysx-size-label";
    overlay.appendChild(sizeLabel);

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
    overlay.addEventListener("contextmenu", cancel);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", cancel);

    document.documentElement.appendChild(overlay);

    STATE.overlay = overlay;
    STATE.selecting = true;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    warmupSW(); // 拖拽开始就唤醒后台，松开时上传免去冷启动
    if (STATE.confirming) {
      STATE.confirming = false;
      const sel = document.getElementById("ysx-sel");
      if (sel) sel.classList.remove("ysx-confirming");
      const hint = document.getElementById("ysx-hint");
      if (hint) hint.textContent = I18N.t("dragHint");
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    STATE.start = { x: Math.min(Math.max(0, e.clientX), vw), y: Math.min(Math.max(0, e.clientY), vh) };
    const sel = document.getElementById("ysx-sel");
    sel.style.display = "block";
    sel.style.left = STATE.start.x + "px";
    sel.style.top = STATE.start.y + "px";
    sel.style.width = "0px";
    sel.style.height = "0px";
  }

  function onMouseMove(e) {
    if (!STATE.start) return;
    e.preventDefault();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = Math.min(Math.max(0, e.clientX), vw);
    const cy = Math.min(Math.max(0, e.clientY), vh);
    const x = Math.min(STATE.start.x, cx);
    const y = Math.min(STATE.start.y, cy);
    const w = Math.abs(cx - STATE.start.x);
    const h = Math.abs(cy - STATE.start.y);
    STATE.rect = { x, y, w, h };
    const sel = document.getElementById("ysx-sel");
    sel.style.left = x + "px";
    sel.style.top = y + "px";
    sel.style.width = w + "px";
    sel.style.height = h + "px";
    const lbl = document.getElementById("ysx-size-label");
    if (lbl) {
      lbl.style.display = "block";
      lbl.textContent = w + " × " + h;
      let lx = x + w - lbl.offsetWidth;
      let ly = y - 28;
      if (ly < 2) ly = y + h + 8;
      lx = Math.min(Math.max(2, lx), vw - lbl.offsetWidth - 2);
      lbl.style.left = lx + "px";
      lbl.style.top = ly + "px";
    }
  }

  function onMouseUp(e) {
    if (!STATE.start) return;
    e.preventDefault();
    const lbl = document.getElementById("ysx-size-label");
    if (lbl) lbl.style.display = "none";
    if (STATE.rect && STATE.rect.w >= 3 && STATE.rect.h >= 3) {
      if (selectMode === "confirm") {
        STATE.confirming = true;
        const sel = document.getElementById("ysx-sel");
        if (sel && confirmPulse) sel.classList.add("ysx-confirming");
        const hint = document.getElementById("ysx-hint");
        if (hint) hint.textContent = I18N.t("confirmHint");
      } else {
        finishSelection(STATE.rect);
      }
    } else {
      cancel();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      cancel();
      return;
    }
    if (e.key === "Enter" && STATE.confirming && STATE.rect) {
      e.preventDefault();
      const rect = STATE.rect;
      STATE.confirming = false;
      finishSelection(rect);
    }
  }

  function finishSelection(rect) {
    const sel = document.getElementById("ysx-sel");
    if (sel) sel.style.outline = "2px solid #fff";
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    cleanup();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        sendMsg({
          type: "ysx-capture-result",
          rect: { ...rect, viewportWidth: vw, viewportHeight: vh },
        });
      })
    );
  }

  function cancel() {
    cleanup();
  }

  function cleanup() {
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("resize", cancel);
    if (STATE.overlay && STATE.overlay.parentNode) {
      STATE.overlay.parentNode.removeChild(STATE.overlay);
    }
    STATE.overlay = null;
    STATE.start = null;
    STATE.selecting = false;
    STATE.rect = null;
    STATE.confirming = false;
  }

  document.addEventListener(
    "mouseover",
    (e) => {
      if (STATE.selecting) return;
      if (hoverBar && (e.target === hoverBar || hoverBar.contains(e.target))) {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        return;
      }
      if (!hoverEnabled || !barAllowedOnSite()) {
        hideHoverBar();
        return;
      }
      const found = findImgFromTarget(e.target);
      if (found) {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        if (showTimer) clearTimeout(showTimer);
        const img = found.img;
        const bgUrl = found.bgUrl;
        if (hoverDelay > 0) {
          showTimer = setTimeout(() => {
            showTimer = null;
            showHoverBar(img, bgUrl);
          }, hoverDelay);
        } else {
          showHoverBar(img, bgUrl);
        }
      } else {
        if (showTimer) {
          clearTimeout(showTimer);
          showTimer = null;
        }
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          hideTimer = null;
          hideHoverBar();
        }, hideDelay);
      }
    },
    true
  );

  let ctxMenu = null;

  function closeCtxMenu() {
    if (ctxMenu && ctxMenu.parentNode) ctxMenu.parentNode.removeChild(ctxMenu);
    ctxMenu = null;
  }

  document.addEventListener("contextmenu", (e) => {
    if (!hoverBar || hoverBar.style.display === "none") {
      closeCtxMenu();
      return;
    }
    if (e.target === hoverBar || hoverBar.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      closeCtxMenu();
      ctxMenu = document.createElement("div");
      ctxMenu.id = "ysx-ctx-menu";
      const item = document.createElement("div");
      item.className = "ysx-ctx-item";
      item.textContent = I18N.t("hideHere");
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeCtxMenu();
        hideSiteBar();
      });
      ctxMenu.appendChild(item);
      document.documentElement.appendChild(ctxMenu);
      const x = e.clientX, y = e.clientY;
      ctxMenu.style.left = Math.min(x, window.innerWidth - 130) + "px";
      ctxMenu.style.top = Math.min(y, window.innerHeight - 40) + "px";
    } else {
      closeCtxMenu();
    }
  });

  function hideSiteBar() {
    const h = location.hostname.toLowerCase();
    if (!h || inBlacklist()) return;
    const list = blList.concat([h]);
    chrome.storage.sync.set({ blacklist: list.join("\n") }, () => {
      blList = list;
      hideHoverBar();
      showStatusBubble(I18N.t("siteHidden") + " " + h, "ok");
    });
  }

  document.addEventListener("mousedown", (e) => {
    if (ctxMenu && !ctxMenu.contains(e.target)) closeCtxMenu();
  }, true);

  window.addEventListener("scroll", hideHoverBar, true);
  window.addEventListener("resize", hideHoverBar);

  let statusBubble = null;
  let statusHideTimer = null;
  const lastMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  document.addEventListener(
    "mousemove",
    (e) => {
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
    },
    { passive: true }
  );

  function showStatusBubble(text, tone) {
    if (!statusBubbleOn) return;
    if (!statusBubble) {
      statusBubble = document.createElement("div");
      statusBubble.id = "ysx-status-bubble";
      document.documentElement.appendChild(statusBubble);
    }
    statusBubble.textContent = text;
    statusBubble.dataset.tone = tone || "busy";
    statusBubble.classList.add("ysx-show");
    const bw = statusBubble.offsetWidth || 120;
    const bh = statusBubble.offsetHeight || 30;
    let x = lastMouse.x + 16;
    let y = lastMouse.y + 20;
    if (x + bw > window.innerWidth - 4) x = lastMouse.x - bw - 14;
    if (y + bh > window.innerHeight - 4) y = lastMouse.y - bh - 12;
    statusBubble.style.left = Math.max(4, x) + "px";
    statusBubble.style.top = Math.max(4, y) + "px";
    if (statusHideTimer) clearTimeout(statusHideTimer);
    if (tone === "ok" || tone === "error") {
      statusHideTimer = setTimeout(() => {
        if (statusBubble) statusBubble.classList.remove("ysx-show");
      }, 2600);
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "ysx-capture-request") {
      startSelection();
      sendResponse({ status: "capturing" });
      return true;
    }
    if (msg.type === "ysx-status") {
      showStatusBubble(String(msg.text || ""), msg.tone);
      sendResponse({ ok: true });
      return;
    }
  });
})();
