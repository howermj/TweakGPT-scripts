// Filename: tweakgpt-toggle-custom-gpts.user.js
// ==UserScript==
// @name         TweakGPT – Toggle Custom GPTs
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.0
// @description  Adds a toggle button below the “Sora” item to show or hide the Custom GPT list in the ChatGPT sidebar. State persists via localStorage.
// @author       howermj + Jane (a GPT-4o coding AI)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-toggle-custom-gpts.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-toggle-custom-gpts.user.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'customGPTToggleState'; // 'visible' or 'hidden'

    const observer = new MutationObserver(() => {
        const nav = document.querySelector('nav');
        if (!nav || document.getElementById('gpt-toggle-btn')) return;

        const soraEntry = Array.from(nav.querySelectorAll('div[role="button"], a'))
            .find(el => el.textContent.trim().toLowerCase() === 'sora');
        if (!soraEntry) return;

        const gptLabel = Array.from(nav.querySelectorAll('div'))
            .find(el => el.textContent.trim() === 'GPTs');
        if (!gptLabel) return;

        const gptLabelBlock = gptLabel.closest('div[role="button"]') || gptLabel.closest('a') || gptLabel;
        const gptList = [];

        let current = gptLabelBlock?.nextElementSibling;
        while (current) {
            const text = current.textContent.trim().toLowerCase();
            if (text.includes("explore") || text.includes("projects") || text.includes("conversations")) break;
            gptList.push(current);
            current = current.nextElementSibling;
        }

        if (gptList.length === 0) return;

        // Restore previous visibility state
        let visible = localStorage.getItem(STORAGE_KEY) !== 'hidden';

        // Create the toggle button
        const button = document.createElement('button');
        button.id = 'gpt-toggle-btn';
        button.style.cssText = `
            background-color: #444;
            color: white;
            border: none;
            border-radius: 6px;
            margin: 8px 12px;
            padding: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            width: calc(100% - 24px);
        `;

        const applyVisibility = () => {
            gptList.forEach(el => {
                el.style.display = visible ? '' : 'none';
            });
            gptLabelBlock.style.display = visible ? '' : 'none';
            button.textContent = visible ? '▶ Hide Custom GPTs' : '▼ Show Custom GPTs';
            localStorage.setItem(STORAGE_KEY, visible ? 'visible' : 'hidden');
        };

        button.onclick = () => {
            visible = !visible;
            applyVisibility();
        };

        soraEntry.parentElement.insertBefore(button, soraEntry.nextSibling);
        applyVisibility(); // Apply saved state
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
