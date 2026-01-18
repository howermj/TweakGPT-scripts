// Filename: tweakgpt-project-name-instead-of-folder-icon.user.js
// ==UserScript==
// @name         TweakGPT – Show Project Name Instead of Folder Icon
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.1
// @description  Replaces the project “folder” icon in the top bar with the actual project name (taken from aria-label), matching header typography.
// @author       howermj + Eve
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const STYLE_ID = "tweakgpt-project-name-style";
  const MARK_ATTR = "data-tweakgpt-project-name";
  const SPAN_CLASS = "tweakgpt-project-name-span";
  const LINK_CLASS = "tweakgpt-project-name-link";

  // Cache reference typography so we don’t recompute on every mutation
  let cachedTypography = null;

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Make the “project button” behave like a label instead of a fixed square icon */
      a.${LINK_CLASS} {
        width: auto !important;              /* overrides w-9 */
        min-width: 2.25rem !important;       /* keep a sane hit target */
        padding-left: 0.6rem !important;
        padding-right: 0.6rem !important;
        gap: 0.4rem !important;
        white-space: nowrap !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      /* Hide the SVG folder icon */
      a.${LINK_CLASS} svg { display: none !important; }

      /* If ChatGPT wraps icon in a div, keep it from occupying space */
      a.${LINK_CLASS} > div { display: none !important; }

      /* The text label (inherit typography unless we overwrite inline) */
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
    `;
    document.head.appendChild(style);
  };

  const getReferenceTypography = () => {
    // Prefer the model switcher button you provided
    const ref =
      document.querySelector('[data-testid="model-switcher-dropdown-button"]') ||
      document.querySelector('button[aria-label^="Model selector"]');

    if (!ref) return null;

    const cs = window.getComputedStyle(ref);

    // Use only typography-related properties (avoid layout/spacing)
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      // We usually want the project label to use the same foreground color as its own button,
      // so we do NOT copy color here. (It inherits the anchor’s existing color.)
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

    // Your example: /g/g-p-<id>-<slug>/project
    const hrefLooksRight = href.includes("/g/g-p-") && href.endsWith("/project");
    const ariaLooksRight = /^Open\s+.+\s+project$/i.test(aria);

    return hrefLooksRight && ariaLooksRight;
  };

  const enhanceLink = (a) => {
    if (a.getAttribute(MARK_ATTR) === "1") return;

    const name = extractProjectNameFromAria(a);
    if (!name) return;

    ensureStyle();

    // Cache typography lazily; refresh if missing (e.g., header not mounted yet)
    if (!cachedTypography) cachedTypography = getReferenceTypography();

    a.setAttribute(MARK_ATTR, "1");
    a.classList.add(LINK_CLASS);

    // Avoid duplicate spans if React reuses nodes oddly
    let span = a.querySelector(`.${SPAN_CLASS}`);
    if (!span) {
      span = document.createElement("span");
      span.className = SPAN_CLASS;
      a.appendChild(span);
    }

    span.textContent = name;

    // Apply the same typography as the model selector breadcrumb
    if (cachedTypography) {
      applyTypography(a, cachedTypography);
      applyTypography(span, cachedTypography);
    }
  };

  const apply = () => {
    // Re-grab typography occasionally in case UI variant changes mid-session
    // (safe + cheap)
    cachedTypography = getReferenceTypography() || cachedTypography;

    const anchors = Array.from(document.querySelectorAll('a[aria-label^="Open "]'));
    for (const a of anchors) {
      if (isProjectHeaderLink(a)) enhanceLink(a);
    }
  };

  // Debounced scheduler for SPA re-renders
  let scheduled = false;
  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
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
