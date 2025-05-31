// Filename: tweakgpt-toggle-projects-panel.user.js
// ==UserScript==
// @name         TweakGPT – Toggle Projects Panel
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.0
// @description  Adds a button to show or hide the Projects panel, including the “New Project” button. Text dynamically updates between Show/Hide. State persists via localStorage.
// @author       howermj + Jane (a GPT-4o coding AI)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-toggle-projects-panel.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-toggle-projects-panel.user.js
// ==/UserScript==


(function () {
    'use strict';

    const BUTTON_ID = 'project-toggle-btn';
    const STORAGE_KEY = 'chatgpt-projects-collapsed';

    function findElementByText(tag, text) {
        const elements = document.getElementsByTagName(tag);
        for (let el of elements) {
            if (el.textContent.trim() === text) {
                return el;
            }
        }
        return null;
    }

    function toggleProjectsVisibility(button) {
        const container = button?.parentElement;
        if (!container) return;

        let collapseStarted = false;
        let shouldCollapse = button.textContent.startsWith('▼');
        const newLabel = shouldCollapse ? '▶ Show Projects' : '▼ Hide Projects';
        button.textContent = newLabel;
        localStorage.setItem(STORAGE_KEY, shouldCollapse ? 'collapsed' : 'expanded');

        for (const child of Array.from(container.children)) {
            const isToggleButton = child.id === BUTTON_ID;
            const isNewProject = child.textContent.trim() === 'New project';

            if (isToggleButton) continue;
            if (isNewProject) {
                collapseStarted = true;
                child.style.display = shouldCollapse ? 'none' : '';
                continue;
            }

            if (collapseStarted) {
                child.style.display = shouldCollapse ? 'none' : '';
            }
        }
    }

    function insertToggleButton() {
        if (document.getElementById(BUTTON_ID)) return;

        const anchor = findElementByText('div', 'New project');
        if (!anchor || !anchor.parentElement) return;

        const btn = document.createElement('button');
        btn.id = BUTTON_ID;

        const stored = localStorage.getItem(STORAGE_KEY);
        const isCollapsed = stored === 'collapsed';
        btn.textContent = isCollapsed ? '▶ Show Projects' : '▼ Hide Projects';

        btn.style.cssText = `
            background-color: rgb(68, 68, 68);
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

        btn.onclick = () => toggleProjectsVisibility(btn);

        anchor.parentElement.insertBefore(btn, anchor);

        if (isCollapsed) {
            setTimeout(() => toggleProjectsVisibility(btn), 100);
        }
    }

    const observer = new MutationObserver(insertToggleButton);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('load', () => setTimeout(insertToggleButton, 500));
})();
