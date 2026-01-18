// Filename: tweakgpt-gpt-or-project-name-in-header.user.js
// ==UserScript==
// @name         TweakGPT – Show GPT or Project Name in Header
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.2
// @description  Displays the GPT persona or project name in the top header consistently.
// @author       howermj + Eve (GPT-5.2 Thinking)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-gpt-or-project-name-in-header.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-gpt-or-project-name-in-header.user.js
// ==/UserScript==

(function () {
  'use strict';

  const updateHeaderWithContext = () => {
    const headerTitle = document.querySelector('[data-headlessui-state] h1');
    if (!headerTitle) return;

    // Skip if already appended
    if (headerTitle.textContent.includes('–')) return;

    // Try to find Custom GPT name (e.g., "Alex 3.2 (i5.2)")
    const customGptTag = document.querySelector('button[aria-haspopup="menu"] span');
    const customGptName = customGptTag?.textContent?.trim();

    // Try to find Project name (e.g., "(Eve) Digital Oracle")
    const projectNode = [...document.querySelectorAll('nav a span')]
      .map(span => span.textContent.trim())
      .find(text => text.match(/^\(.*\)\s.+$/)); // matches something like (Eve) Digital Oracle

    // Determine what to show
    const label = customGptName || projectNode;
    if (!label) return;

    headerTitle.textContent = `${headerTitle.textContent.trim()} – ${label}`;
  };

  const setupObserver = () => {
    const observer = new MutationObserver(updateHeaderWithContext);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  setupObserver();
})();
