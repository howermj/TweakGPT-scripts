// Filename: tweakgpt-file-upload-warning.user.js
// ==UserScript==
// @name         TweakGPT – File Upload Warning Banner
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.0
// @description  Displays a persistent banner reminding users not to upload sensitive files that could be used for training.
// @author       howermj + Jane (a GPT-4o coding AI)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-file-upload-warning.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-file-upload-warning.user.js
// ==/UserScript==

(function() {
    'use strict';

    const bannerText = "⚠️ WARNING: File uploads to ChatGPT Plus may be retained and used for training by OpenAI. DO NOT upload sensitive or confidential data.";

    const style = document.createElement('style');
    style.innerHTML = `
        #chatgpt-upload-warning {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background-color: #ff4d4f;
            color: white;
            text-align: center;
            padding: 12px;
            font-weight: bold;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }
        body {
            padding-top: 50px !important;
        }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'chatgpt-upload-warning';
    banner.textContent = bannerText;
    document.body.prepend(banner);
})();
