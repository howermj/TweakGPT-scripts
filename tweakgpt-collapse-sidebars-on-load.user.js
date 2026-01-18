// Filename: tweakgpt-collapse-sidebars-on-load.user.js
// ==UserScript==
// @name         TweakGPT – Collapse Sidebars on Load
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.0
// @description  Auto-collapses the “GPTs”, “Projects”, and “Your chats” sidebar sections on ChatGPT load. Uses DOM observers; no UI changes. Stops after initial collapse so it won’t fight user navigation.
// @author       howermj + Eve (GPT-5.2 Thinking)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-collapse-sidebars-on-load.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-collapse-sidebars-on-load.user.js
// ==/UserScript==

(() => {
  "use strict";

  // ---- Config ----
  const SECTION_TITLES = ["GPTs", "Projects", "Your chats"];
  const DEBUG = false;

  // Only auto-collapse during this short window after initial load.
  const ARM_MS = 4500;
  const RETRY_EVERY_MS = 250;

  // If the user interacts with the sidebar sections in this tab, do not auto-collapse on later route changes.
  const SESSION_INTERACT_KEY = "tweakgpt:collapse_sections:user_interacted";

  const log = (...a) => { if (DEBUG) console.log("[cgpt-collapse]", ...a); };

  const norm = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  // ---- State ----
  let armedUntil = Date.now() + ARM_MS;
  let retryTimer = null;
  let mo = null;

  const collapsedOnce = new Set(); // per cycle

  const withinArmingWindow = () => Date.now() < armedUntil;

  const hasSessionUserInteracted = () => {
    try { return sessionStorage.getItem(SESSION_INTERACT_KEY) === "1"; }
    catch { return false; }
  };

  const markSessionUserInteracted = () => {
    try { sessionStorage.setItem(SESSION_INTERACT_KEY, "1"); }
    catch { /* ignore */ }
  };

  // Try to identify "sidebar-ish" containers to avoid matching main content.
  const findSidebarRoots = () => {
    const roots = new Set();
    const needles = ["new chat", "search chats", "your chats", "projects", "gpts"];

    const candidates = Array.from(document.querySelectorAll("aside, nav, header, div"))
      .filter((el) => el && el.offsetParent !== null);

    for (const el of candidates) {
      const t = norm(el.textContent);
      let hits = 0;
      for (const n of needles) if (t.includes(n)) hits++;
      if (hits >= 2) roots.add(el);
    }

    if (!roots.size) roots.add(document.body);
    return Array.from(roots);
  };

  // Precise match: section disclosure buttons are:
  // button[aria-expanded] containing h2.__menu-label with the section title.
  const findSectionButtons = (root, title) => {
    const want = norm(title);
    const btns = [];

    const headings = root.querySelectorAll(
      "button[aria-expanded] > h2.__menu-label, button[aria-expanded] > h3.__menu-label"
    );

    for (const h of headings) {
      const txt = norm(h.textContent);
      if (txt === want || txt.startsWith(want + " ") || txt.includes(want)) {
        const b = h.closest("button[aria-expanded]");
        if (b) btns.push(b);
      }
    }

    return Array.from(new Set(btns));
  };

  const collapseIfOpen = (btn) => {
    if (!btn) return false;

    const ae = btn.getAttribute("aria-expanded");
    if (ae === "true") {
      log("collapse:", btn);
      btn.click();
      return true;
    }
    return false;
  };

  const runOnce = () => {
    if (!withinArmingWindow()) return false;

    const roots = findSidebarRoots();
    let didSomething = false;

    for (const root of roots) {
      for (const title of SECTION_TITLES) {
        const key = norm(title);
        if (collapsedOnce.has(key)) continue;

        const buttons = findSectionButtons(root, title);
        for (const b of buttons) {
          const changed = collapseIfOpen(b);
          if (changed) {
            collapsedOnce.add(key);
            didSomething = true;
          }
        }
      }
    }

    // If everything is handled (either collapsed or not found), stop watching so we don't fight the user.
    const allHandled = SECTION_TITLES.every((t) => collapsedOnce.has(norm(t)));
    if (allHandled) {
      stopRetryLoop();
      disconnectObserver();
    }

    return didSomething;
  };

  // ---- User interaction guard ----
  // If user clicks any of these section header buttons, mark session-interacted and stop automation.
  const installUserClickGuard = () => {
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (!target) return;

        const btn = target.closest && target.closest("button[aria-expanded]");
        if (!btn) return;

        const h = btn.querySelector("h2.__menu-label, h3.__menu-label");
        if (!h) return;

        const label = norm(h.textContent);
        const matches = SECTION_TITLES.some((t) => {
          const want = norm(t);
          return label === want || label.startsWith(want + " ") || label.includes(want);
        });

        if (matches) {
          markSessionUserInteracted();
          stopRetryLoop();
          disconnectObserver();
        }
      },
      true
    );
  };

  // ---- SPA navigation ----
  const hookHistory = () => {
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;

    const fire = () => window.dispatchEvent(new Event("cgpt:route"));

    history.pushState = function (...args) {
      const r = _pushState.apply(this, args);
      fire();
      return r;
    };

    history.replaceState = function (...args) {
      const r = _replaceState.apply(this, args);
      fire();
      return r;
    };

    window.addEventListener("popstate", fire);
  };

  const startRetryLoop = () => {
    stopRetryLoop();
    retryTimer = setInterval(() => {
      runOnce();
      if (!withinArmingWindow()) stopRetryLoop();
    }, RETRY_EVERY_MS);
  };

  const stopRetryLoop = () => {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  };

  const observeDom = () => {
    disconnectObserver();

    mo = new MutationObserver(() => {
      if (!withinArmingWindow()) return;

      if (observeDom._t) cancelAnimationFrame(observeDom._t);
      observeDom._t = requestAnimationFrame(() => runOnce());
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  const disconnectObserver = () => {
    if (mo) {
      mo.disconnect();
      mo = null;
    }
  };

  const bootCycle = ({ isRouteChange } = { isRouteChange: false }) => {
    // Initial load: always start collapsed.
    // Route changes: only do it if the user has NOT interacted this tab.
    if (isRouteChange && hasSessionUserInteracted()) {
      log("route change: user has interacted; skipping auto-collapse");
      stopRetryLoop();
      disconnectObserver();
      return;
    }

    armedUntil = Date.now() + ARM_MS;
    collapsedOnce.clear();

    observeDom();
    runOnce();
    startRetryLoop();
  };

  // ---- Boot ----
  hookHistory();
  installUserClickGuard();

  bootCycle({ isRouteChange: false });

  window.addEventListener("cgpt:route", () => {
    bootCycle({ isRouteChange: true });
  });
})();
