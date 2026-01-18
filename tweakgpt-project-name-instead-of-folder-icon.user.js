// Filename: tweakgpt-project-name-instead-of-folder-icon.user.js
// ==UserScript==
// @name         TweakGPT – Show GPT or Project Name in Header
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.3
// @description  Adds project name to breadcrumbs in header, matching CustomGPTs and header typography.
// @author       howermj + Eve (GPT-5.2 Thinking)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-project-name-instead-of-folder-icon.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-project-name-instead-of-folder-icon.user.js
// ==/UserScript==

(() => {
  "use strict";

  const STYLE_ID = "tweakgpt-project-name-style";
  const MARK_ATTR = "data-tweakgpt-project-name";
  const LINK_CLASS = "tweakgpt-project-name-link";
  const SPAN_CLASS = "tweakgpt-project-name-span";
  const INJECT_ID = "tweakgpt-project-name-injected";

  let cachedTypography = null;

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* --- Project-chat header link replacement --- */
      a.${LINK_CLASS} {
        width: auto !important;              /* override w-9 */
        min-width: 2.25rem !important;
        padding-left: 0.6rem !important;
        padding-right: 0.6rem !important;
        gap: 0.4rem !important;
        white-space: nowrap !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      a.${LINK_CLASS} svg { display: none !important; }
      a.${LINK_CLASS} > div { display: none !important; }

      a.${LINK_CLASS} .${SPAN_CLASS} {
        display: inline-block !important;
        max-width: 32ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        font: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        letter-spacing: inherit !important;
        color: inherit !important;
      }

      /* --- Project landing-page injection next to model selector --- */
      #${INJECT_ID} {
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.5rem !important;
        white-space: nowrap !important;
        max-width: 40ch;
      }

      #${INJECT_ID} .${SPAN_CLASS} {
        display: inline-block !important;
        max-width: 32ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        font: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        letter-spacing: inherit !important;
        color: inherit !important;
      }
    `;
    document.head.appendChild(style);
  };

  const getReferenceTypography = () => {
    const ref =
      document.querySelector('[data-testid="model-switcher-dropdown-button"]') ||
      document.querySelector('button[aria-label^="Model selector"]');

    if (!ref) return null;

    const cs = window.getComputedStyle(ref);
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
    };
  };

  const applyTypography = (el, typography) => {
    if (!el || !typography) return;
    el.style.fontFamily = typography.fontFamily;
    el.style.fontSize = typography.fontSize;
    el.style.fontWeight = typography.fontWeight;
    el.style.lineHeight = typography.lineHeight;
    el.style.letterSpacing = typography.letterSpacing;
  };

  const extractProjectNameFromAria = (a) => {
    const raw = (a.getAttribute("aria-label") || "").trim();
    if (!raw) return "";
    // "Open (Eve) Digital Oracle project" -> "(Eve) Digital Oracle"
    return raw.replace(/^Open\s+/i, "").replace(/\s*project$/i, "").trim();
  };

  const isProjectHeaderLink = (a) => {
    if (!a || a.tagName !== "A") return false;
    const href = (a.getAttribute("href") || "").trim();
    const aria = (a.getAttribute("aria-label") || "").trim();
    return href.includes("/g/g-p-") && href.endsWith("/project") && /^Open\s+.+\s+project$/i.test(aria);
  };

  const enhanceProjectHeaderLink = (a) => {
    if (a.getAttribute(MARK_ATTR) === "1") return;

    const name = extractProjectNameFromAria(a);
    if (!name) return;

    ensureStyle();

    if (!cachedTypography) cachedTypography = getReferenceTypography();

    a.setAttribute(MARK_ATTR, "1");
    a.classList.add(LINK_CLASS);

    let span = a.querySelector(`.${SPAN_CLASS}`);
    if (!span) {
      span = document.createElement("span");
      span.className = SPAN_CLASS;
      a.appendChild(span);
    }
    span.textContent = name;

    if (cachedTypography) {
      applyTypography(a, cachedTypography);
      applyTypography(span, cachedTypography);
    }
  };

  // On /project landing pages, the project name is usually in the main page H1.
  const getProjectNameFromPage = () => {
    // Try main h1 first
    const h1 = document.querySelector("main h1") || document.querySelector("h1");
    const t = h1?.textContent?.trim();
    if (t && t.length >= 2) return t;

    // Fallback: sometimes aria-label exists somewhere else (rare)
    const projectAnchor = Array.from(document.querySelectorAll('a[aria-label^="Open "]')).find(isProjectHeaderLink);
    if (projectAnchor) return extractProjectNameFromAria(projectAnchor);

    return "";
  };

  const injectProjectNameNextToModelSwitcher = () => {
    // Only for project landing page
    if (!location.pathname.endsWith("/project")) return;

    const modelBtn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
    if (!modelBtn) return;

    const projectName = getProjectNameFromPage();
    if (!projectName) return;

    ensureStyle();

    cachedTypography = getReferenceTypography() || cachedTypography;

    // If already injected, just update text
    let wrap = document.getElementById(INJECT_ID);
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = INJECT_ID;

      // Insert wrapper right before the model button
      const parent = modelBtn.parentElement;
      if (!parent) return;

      parent.insertBefore(wrap, modelBtn);
      wrap.appendChild(modelBtn);
    }

    let span = wrap.querySelector(`.${SPAN_CLASS}`);
    if (!span) {
      span = document.createElement("span");
      span.className = SPAN_CLASS;
      wrap.insertBefore(span, modelBtn);
    }
    span.textContent = projectName;

    if (cachedTypography) {
      applyTypography(wrap, cachedTypography);
      applyTypography(span, cachedTypography);
      // modelBtn already has the right typography; no need to override
    }
  };

  const applyAll = () => {
    cachedTypography = getReferenceTypography() || cachedTypography;

    // 1) Project chats: replace folder icon link with name
    const anchors = Array.from(document.querySelectorAll('a[aria-label^="Open "]'));
    for (const a of anchors) {
      if (isProjectHeaderLink(a)) enhanceProjectHeaderLink(a);
    }

    // 2) Project landing page: show project name next to model selector
    injectProjectNameNextToModelSwitcher();
  };

  // Debounced scheduler
  let scheduled = false;
  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyAll();
    });
  };

  const hookHistory = () => {
    const { pushState, replaceState } = history;

    history.pushState = function () {
      const r = pushState.apply(this, arguments);
      scheduleApply();
      return r;
    };

    history.replaceState = function () {
      const r = replaceState.apply(this, arguments);
      scheduleApply();
      return r;
    };

    window.addEventListener("popstate", scheduleApply, { passive: true });
  };

  const start = () => {
    hookHistory();

    const mo = new MutationObserver(scheduleApply);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    scheduleApply();
  };

  start();
})();

