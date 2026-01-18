// Filename: tweakgpt-collapse-gpts-projects.user.js
// ==UserScript==
// @name         TweakGPT – Collapse GPTs + Projects on Load
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.0
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

  // If the user manually toggles a section, we stop auto-collapsing that section
  // until the next route change/reload.
  const userOverride = new Set();

  // If we successfully collapsed a section once this cycle, we don’t need to keep trying.
  const collapsedOnce = new Set();

  const resetCycle = () => {
    armedUntil = Date.now() + ARM_MS;
    userOverride.clear();
    collapsedOnce.clear();
    stopRetryLoop();
    disconnectObserver();
  };

  const withinArmingWindow = () => Date.now() < armedUntil;

  // Try to identify "sidebar-ish" containers to avoid matching main content.
  const findSidebarRoots = () => {
    const roots = new Set();

    // Common landmarks in the left rail across variants.
    const needles = ["new chat", "search chats", "chats", "projects", "gpts"];

    const candidates = Array.from(document.querySelectorAll("aside, nav, header, div"))
      .filter((el) => el && el.offsetParent !== null);

    for (const el of candidates) {
      const t = norm(el.textContent);
      // Heuristic: sidebar containers tend to include at least two landmarks.
      let hits = 0;
      for (const n of needles) if (t.includes(n)) hits++;
      if (hits >= 2) roots.add(el);
    }

    // Fallback: if heuristic fails, just use body (last resort).
    if (!roots.size) roots.add(document.body);

    return Array.from(roots);
  };

  const getLabelFromEl = (el) => {
    if (!el) return "";
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria) return aria;
    return el.textContent || "";
  };

  // Find the clickable toggle for a given section label.
  const findSectionToggles = (root, label) => {
    const want = norm(label);
    const toggles = [];

    const clickable = root.querySelectorAll('button, [role="button"], summary, a');

    for (const el of clickable) {
      const txt = norm(getLabelFromEl(el));

      // e.g. "Projects" or "Projects 12"
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
      log("click collapse (aria-expanded=true):", toggle);
      toggle.click();
      return true;
    }
    if (ae === "false") return false;

    const details = toggle.closest && toggle.closest("details");
    if (details && details.open) {
      log("close details:", details);
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

        // Respect the user: if they’ve manually toggled this section, don’t touch it.
        if (userOverride.has(key)) continue;

        // If we already collapsed it once this cycle, don’t keep poking.
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

    // If we’ve collapsed everything we can (or the user overrode), stop watching.
    const allHandled =
      SECTION_LABELS.every((lbl) => userOverride.has(norm(lbl)) || collapsedOnce.has(norm(lbl)));

    if (allHandled) {
      log("all handled; stopping observers");
      stopRetryLoop();
      disconnectObserver();
    }

    return didSomething;
  };

  // ---- Respect user clicks ----
  // If the user clicks a GPTs/Projects header toggle, we mark that section as manual override.
  const installUserClickGuard = () => {
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (!target) return;

        const btn = target.closest && target.closest("button,[role='button'],summary");
        if (!btn) return;

        const txt = norm(getLabelFromEl(btn));

        for (const lbl of SECTION_LABELS) {
          const k = norm(lbl);
          if (txt === k || txt.startsWith(k + " ") || txt.includes(k)) {
            userOverride.add(k);
            log("user override:", lbl);

            // Once the user has taken control, stop fighting the DOM this cycle.
            stopRetryLoop();
            disconnectObserver();
            return;
          }
        }
      },
      true // capture: catch it early
    );
  };

  // ---- SPA navigation + watchers ----
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

      // Debounce to next frame
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

  const bootCycle = () => {
    // Re-arm and re-enable for this load/route
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
  bootCycle();

  window.addEventListener("cgpt:route", () => {
    log("route change");
    bootCycle();
  });
})();
