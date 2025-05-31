// Filename: tweakgpt-remove-view-plans.user.js
// ==UserScript==
// @name         TweakGPT – Remove “View Plans” Block
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.0
// @description  Hides the “View Plans” button and its surrounding UI block from the ChatGPT interface for a cleaner, distraction-free experience.
// @author       howermj + Jane (a GPT-4o coding AI)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-remove-view-plans.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-remove-view-plans.user.js
// ==/UserScript==


(function() {
    'use strict';

    const nukeViewPlans = () => {
        const elements = document.querySelectorAll('div.truncate');
        elements.forEach(el => {
            if (el.textContent.trim() === 'View plans') {
                const topLevelBlock = el.closest('div[data-fill]'); // this is the outermost container
                if (topLevelBlock) {
                    topLevelBlock.remove(); // surgical removal
                    console.log('🔪 "View plans" block removed');
                }
            }
        });
    };

    // Watch for any new elements being added
    const observer = new MutationObserver(() => nukeViewPlans());
    observer.observe(document.body, { childList: true, subtree: true });

    // Run immediately too
    window.addEventListener('load', nukeViewPlans);
})();
