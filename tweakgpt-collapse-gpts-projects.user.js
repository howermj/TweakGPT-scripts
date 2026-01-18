// Filename: tweakgpt-collapse-gpts-projects.user.js
// ==UserScript==
// @name         TweakGPT – Collapse GPTs + Projects on Load
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.1
// @description  Auto-collapses the “GPTs” and “Projects” sidebar sections on ChatGPT load/navigation. Uses DOM observers; no UI changes. State is not persisted (always collapses).
// @author       howermj + Eve (GPT-5.2 Thinking)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-collapse-gpts-projects.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-collapse-gpts-projects.user.js
// ==/UserScript==


(() => {
  "use strict";

  // ---- Config ----
  const SECTION_LABELS = ["GPTs", "Projects"];
  const DEBUG = false;

  // Only auto-collapse during this short window after load/route.
  const ARM_MS = 4500;
  const RETRY_EVERY_MS = 250;

  // If user has interacted with these sections in this tab, don't auto-collapse on later routes.
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

  const userOverride = new Set();    // per-cycle
  const collapsedOnce = new Set();   // per-cycle

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
    const needles = ["new chat", "search chats", "chats", "projects", "gpts"];

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

  const getLabelFromEl = (el) => {
    if (!el) return "";
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria) return aria;
    return el.textContent || "";
  };

  const findSectionToggles = (root, label) => {
    const want = norm(label);
    const toggles = [];

    const clickable = root.querySelectorAll("button, [role='button'], summary, a");

    for (const el of clickable) {
      const txt = norm(getLabelFromEl(el));

      const startsRight = txt === want || txt.startsWith(want + " ");
      const containsRight = txt.includes(want);

      if (!startsRight && !containsRight) continue;

      const candidate =
        el.matches("button,[role='button'],summary")
          ? el
          : el.closest("button,[role='button'],summary");

      if (!candidate) continue;

      const hasAriaExpanded = candidate.hasAttribute && candidate.hasAttribute("aria-expanded");
      const inDetails = !!candidate.closest("details");

      if (hasAriaExpanded || inDetails) toggles.push(candidate);
    }

    return Array.from(new Set(toggles));
  };

  const collapseIfOpen = (toggle) => {
    if (!toggle) return false;

    const ae = toggle.getAttribute && toggle.getAttribute("aria-expanded");
    if (ae === "true") {
      toggle.click();
      return true;
    }
    if (ae === "false") return false;

    const details = toggle.closest && toggle.closest("details");
    if (details && details.open) {
      details.open = false;
      return true;
    }

    return false;
  };

  const runOnce = () => {
    if (!withinArmingWindow()) return false;

    const roots = findSidebarRoots();
    let didSomething = false;

    for (const root of roots) {
      for (const label of SECTION_LABELS) {
        const key = norm(label);

        if (userOverride.has(key)) continue;
        if (collapsedOnce.has(key)) continue;

        const toggles = findSectionToggles(root, label);
        for (const t of toggles) {
          const changed = collapseIfOpen(t);
          if (changed) {
            collapsedOnce.add(key);
            didSomething = true;
          }
        }
      }
    }

    const allHandled =
      SECTION_LABELS.every((lbl) => userOverride.has(norm(lbl)) || collapsedOnce.has(norm(lbl)));

    if (allHandled) {
      stopRetryLoop();
      disconnectObserver();
    }

    return didSomething;
  };

  // ---- Respect user clicks ----
  // Any click on GPTs/Projects header OR an item within them counts as "user interacted".
  const installUserClickGuard = () => {
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (!target) return;

        // If the click is anywhere inside the left rail area, we attempt to classify it.
        // We detect by label presence on the nearest button-ish element; if in doubt, mark interacted.
        const btn = target.closest && target.closest("button,[role='button'],summary,a");
        if (!btn) return;

        const txt = norm(getLabelFromEl(btn));
        for (const lbl of SECTION_LABELS) {
          const k = norm(lbl);
          if (txt === k || txt.startsWith(k + " ") || txt.includes(k)) {
            // Header toggle clicked -> user is taking control.
            markSessionUserInteracted();
            userOverride.add(k);
            stopRetryLoop();
            disconnectObserver();
            return;
          }
        }

        // If user clicked something inside an expanded GPTs/Projects area, navigation is about to happen.
        // Mark session-interacted so we do NOT auto-collapse on the next route event.
        const nearText = norm((target.closest && target.closest("aside,nav"))?.textContent || "");
        if (nearText.includes("gpts") || nearText.includes("projects")) {
          markSessionUserInteracted();
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
    // On later route changes, if the user has interacted in this tab, do NOT auto-collapse.
    if (isRouteChange && hasSessionUserInteracted()) {
      log("route change: user has interacted; skipping auto-collapse");
      stopRetryLoop();
      disconnectObserver();
      return;
    }

    armedUntil = Date.now() + ARM_MS;
    collapsedOnce.clear();
    userOverride.clear();

    observeDom();
    runOnce();
    startRetryLoop();
  };

  // ---- Boot ----
  hookHistory();
  installUserClickGuard();

  // Initial page load should always start collapsed.
  bootCycle({ isRouteChange: false });

  window.addEventListener("cgpt:route", () => {
    bootCycle({ isRouteChange: true });
  });
})();


