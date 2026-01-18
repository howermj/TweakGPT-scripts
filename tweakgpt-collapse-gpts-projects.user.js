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

  // Re-try window: UI mounts progressively; we re-run for a short period.
  const RETRY_MS = 6000;
  const RETRY_EVERY_MS = 250;

  const log = (...a) => { if (DEBUG) console.log("[cgpt-collapse]", ...a); };

  const norm = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

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
    // Prefer aria-label; otherwise visible text.
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria) return aria;
    return el.textContent || "";
  };

  // Find the clickable toggle for a given section label.
  // We prefer elements with aria-expanded (common for disclosure toggles).
  const findSectionToggles = (root, label) => {
    const want = norm(label);

    const toggles = [];

    const clickable = root.querySelectorAll(
      'button, [role="button"], summary, a'
    );

    for (const el of clickable) {
      const txt = norm(getLabelFromEl(el));

      // Many UIs render "Projects" as "Projects" or "Projects 12"
      const startsRight = txt === want || txt.startsWith(want + " ");
      const containsRight = txt.includes(want);

      if (!startsRight && !containsRight) continue;

      // If the element itself isn’t a disclosure, often its closest button is.
      const candidate =
        el.matches("button,[role='button'],summary") ? el : el.closest("button,[role='button'],summary");

      if (!candidate) continue;

      // Strong signal: aria-expanded present.
      const hasAriaExpanded = candidate.hasAttribute && candidate.hasAttribute("aria-expanded");
      // Another possible signal: inside a <details>.
      const inDetails = !!candidate.closest("details");

      if (hasAriaExpanded || inDetails) toggles.push(candidate);
    }

    // De-dupe
    return Array.from(new Set(toggles));
  };

  const collapseIfOpen = (toggle) => {
    if (!toggle) return false;

    // Case 1: aria-expanded toggle
    const ae = toggle.getAttribute && toggle.getAttribute("aria-expanded");
    if (ae === "true") {
      log("click collapse (aria-expanded=true):", toggle);
      toggle.click();
      return true;
    }
    if (ae === "false") return false;

    // Case 2: <details open>
    const details = toggle.closest && toggle.closest("details");
    if (details && details.open) {
      log("close details:", details);
      details.open = false;
      return true;
    }

    // Unknown state: don’t spam clicks.
    return false;
  };

  const runOnce = () => {
    const roots = findSidebarRoots();

    let didSomething = false;

    for (const root of roots) {
      for (const label of SECTION_LABELS) {
        const toggles = findSectionToggles(root, label);

        for (const t of toggles) {
          // Try to avoid collapsing “See more” etc by requiring the label to be close.
          // (Still heuristic; if it misfires, narrow by inspecting in DEBUG mode.)
          const changed = collapseIfOpen(t);
          if (changed) didSomething = true;
        }
      }
    }

    return didSomething;
  };

  // SPA navigation: re-run on URL changes + on DOM mutations.
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
    const start = Date.now();
    const timer = setInterval(() => {
      runOnce();

      if (Date.now() - start > RETRY_MS) clearInterval(timer);
    }, RETRY_EVERY_MS);
  };

  const observeDom = () => {
    const mo = new MutationObserver(() => {
      // Cheap debounce: let the UI settle a beat.
      if (observeDom._t) cancelAnimationFrame(observeDom._t);
      observeDom._t = requestAnimationFrame(() => runOnce());
    });

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  // ---- Boot ----
  hookHistory();
  observeDom();

  // Initial + short retry loop (helps with lazy sidebar mounts)
  runOnce();
  startRetryLoop();

  // Re-run on route changes
  window.addEventListener("cgpt:route", () => {
    log("route change");
    runOnce();
    startRetryLoop();
  });
})();
