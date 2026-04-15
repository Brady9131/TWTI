/**
 * 简体 / 繁体切换（OpenCC，localStorage 持久化）
 */
(function () {
  const STORAGE_KEY = "twti_script";
  const MODE_HANS = "hans";
  const MODE_HANT = "hant";

  const ATTRS = ["aria-label", "title", "alt", "placeholder"];

  let s2t = null;
  let t2s = null;
  let loadingPromise = null;

  function loadOpenCC() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise(function (resolve, reject) {
      if (window.OpenCC && window.OpenCC.Converter) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js";
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("opencc load failed"));
      };
      document.head.appendChild(s);
    }).then(function () {
      const Converter = window.OpenCC.Converter;
      s2t = Converter({ from: "cn", to: "tw" });
      t2s = Converter({ from: "tw", to: "cn" });
    });
    return loadingPromise;
  }

  function walkTextNodes(root, conv) {
    const tree = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.tagName === "SCRIPT" || p.tagName === "STYLE" || p.tagName === "NOSCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        if (p.closest && p.closest("[data-no-convert]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = tree.nextNode())) {
      const v = n.nodeValue;
      if (v && /\S/.test(v)) n.nodeValue = conv(v);
    }
  }

  function walkAttrNodes(root, conv) {
    function walk(el) {
      if (!el || el.nodeType !== 1) return;
      if (el.closest("[data-no-convert]")) return;
      ATTRS.forEach(function (a) {
        const v = el.getAttribute(a);
        if (v && /\S/.test(v)) el.setAttribute(a, conv(v));
      });
      Array.prototype.forEach.call(el.children, walk);
    }
    walk(root);
  }

  function convertSubtree(root, conv) {
    if (!root || !conv) return;
    walkTextNodes(root, conv);
    walkAttrNodes(root, conv);
  }

  function getMode() {
    return localStorage.getItem(STORAGE_KEY) === MODE_HANT ? MODE_HANT : MODE_HANS;
  }

  function setMode(mode) {
    if (mode === MODE_HANT) localStorage.setItem(STORAGE_KEY, MODE_HANT);
    else localStorage.removeItem(STORAGE_KEY);
  }

  function syncButtons() {
    const hans = document.getElementById("btn-locale-hans");
    const hant = document.getElementById("btn-locale-hant");
    const mode = getMode();
    if (hans) hans.classList.toggle("is-active", mode === MODE_HANS);
    if (hant) hant.classList.toggle("is-active", mode === MODE_HANT);
  }

  function applyFullPage(conv) {
    const main = document.querySelector("main.app");
    const foot = document.querySelector("footer.foot");
    if (main) convertSubtree(main, conv);
    if (foot) convertSubtree(foot, conv);
  }

  function onClickHans() {
    if (getMode() === MODE_HANS) return;
    setMode(MODE_HANS);
    syncButtons();
    loadOpenCC()
      .then(function () {
        applyFullPage(t2s);
        document.documentElement.lang = "zh-Hans";
      })
      .catch(function () {});
  }

  function onClickHant() {
    if (getMode() === MODE_HANT) return;
    setMode(MODE_HANT);
    syncButtons();
    loadOpenCC()
      .then(function () {
        applyFullPage(s2t);
        document.documentElement.lang = "zh-Hant";
      })
      .catch(function () {});
  }

  function wireButtons() {
    const hans = document.getElementById("btn-locale-hans");
    const hant = document.getElementById("btn-locale-hant");
    if (hans) hans.addEventListener("click", onClickHans);
    if (hant) hant.addEventListener("click", onClickHant);
  }

  function ensureConvertersThen(fn) {
    loadOpenCC()
      .then(fn)
      .catch(function () {});
  }

  /** app.js：切屏或题目更新后转换对应区块（繁体模式下） */
  window.TWTI_onScreenShown = function (screenId) {
    if (getMode() !== MODE_HANT) return;
    const el = document.getElementById(screenId);
    if (!el) return;
    ensureConvertersThen(function () {
      convertSubtree(el, s2t);
    });
  };

  function boot() {
    wireButtons();
    syncButtons();
    if (getMode() === MODE_HANT) {
      document.documentElement.lang = "zh-Hant";
      ensureConvertersThen(function () {
        applyFullPage(s2t);
      });
    } else {
      document.documentElement.lang = "zh-Hans";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
