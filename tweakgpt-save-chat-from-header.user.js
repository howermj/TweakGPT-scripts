// Filename: tweakgpt-save-chat-header.user.js
// ==UserScript==
// @name         TweakGPT – Save Chat (.md) Button in Header
// @namespace    https://github.com/howermj/TweakGPT-scripts
// @version      1.2
// @description  Adds a "Save" button next to Share in the chat header to download the current conversation as Markdown (with code-block preflight render).
// @author       howermj + Eve (GPT-5.2 Thinking)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-save-chat-header.user.js
// @updateURL    https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-save-chat-header.user.js
// ==/UserScript==

(function () {
  "use strict";

  const DEBUG = false;
  const log = (...a) => { if (DEBUG) console.log("[TweakGPT:SaveHeader]", ...a); };

  const SAVE_BTN_ID = "tweakgpt-save-chat-md";
  const TURN_SELECTORS = [
    'article[data-testid="conversation-turn"]',
    '[data-testid="conversation-turn"]',
    '[data-message-author-role]',
  ];

  // ---------- Utilities ----------
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

  const safeFilename = (s) =>
    String(s || "chat")
      .replace(/[\/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "chat";

  const getChatIdFromUrl = () => {
    const m = location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  };

  const getChatTitle = () => {
    const t = (document.title || "").trim();
    const cleaned = t.replace(/\s*[-–—]\s*ChatGPT\s*$/i, "").trim();
    return cleaned || "Chat";
  };

  const downloadTextFile = (filename, text) => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

  // ---------- Extract conversation ----------
  const getConversationTurns = () => {
    let turns = [];
    for (const sel of TURN_SELECTORS) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length) { turns = found; break; }
    }

    // Normalize: if we matched [data-message-author-role], prefer nearest article wrapper
    if (turns.length && turns[0]?.getAttribute && turns[0].hasAttribute("data-message-author-role")) {
      turns = turns.map((n) => n.closest("article") || n);
    }

    return Array.from(new Set(turns)).filter(Boolean);
  };

  const getRoleForTurn = (turn) => {
    const roleEl = turn.querySelector?.("[data-message-author-role]");
    const r = roleEl ? roleEl.getAttribute("data-message-author-role") : "";
    return r ? norm(r) : "assistant";
  };

  const getContentElementForTurn = (turn) => {
    const md = turn.querySelector?.(".markdown");
    if (md) return md;
    const roleEl = turn.querySelector?.("[data-message-author-role]");
    return roleEl || turn;
  };

  // ---------- Preflight: force code blocks to render ----------
  const preflightRenderCodeBlocks = async () => {
    const turns = getConversationTurns();
    if (!turns.length) return;

    const scrollingEl = document.scrollingElement || document.documentElement;
    const originalScrollTop = scrollingEl.scrollTop;

    // Collect <pre> elements inside the conversation turns (in DOM order)
    const pres = [];
    for (const t of turns) {
      for (const pre of Array.from(t.querySelectorAll("pre"))) pres.push(pre);
    }

    if (!pres.length) return;

    // Avoid thrashing on huge chats
    const MAX_PREFLIGHT = 60;
    const list = pres.slice(0, MAX_PREFLIGHT);

    log(`preflight: ${list.length} code blocks`);

    // Scroll each <pre> into view briefly so ChatGPT hydrates/paints it.
    // Then yield a frame and a tiny delay for text nodes to appear.
    for (const pre of list) {
      try {
        pre.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      } catch {
        // behavior: "instant" isn't supported everywhere; fallback
        pre.scrollIntoView({ block: "center", inline: "nearest" });
      }
      await raf();
      await sleep(20);
    }

    // Restore scroll position
    scrollingEl.scrollTop = originalScrollTop;
    await raf();
  };

  // ---------- DOM -> Markdown ----------
  const escapeInlineBackticks = (s) => String(s || "").replace(/`/g, "\\`");

  const getCodeLang = (codeEl) => {
    const cls = (codeEl && codeEl.className) ? String(codeEl.className) : "";
    const m = cls.match(/language-([a-z0-9_+-]+)/i) || cls.match(/lang-([a-z0-9_+-]+)/i);
    return m ? m[1] : "";
  };

  const childrenToMarkdown = (el) => {
    let out = "";
    for (const child of Array.from(el.childNodes || [])) out += nodeToMarkdown(child);
    return out.replace(/\n{3,}/g, "\n\n");
  };

  const nodeToMarkdown = (node) => {
    if (!node) return "";

    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node;
    const tag = (el.tagName || "").toUpperCase();

    if (tag === "PRE") {
      const code = el.querySelector("code") || el;
      const lang = getCodeLang(code);

      // Prefer textContent (more reliable for code blocks), fall back to innerText.
      let body = (code.textContent || code.innerText || "").replace(/\n+$/g, "");
      // If still empty, try the <pre> itself (some layouts don’t put text on <code>)
      if (!body) body = (el.textContent || el.innerText || "").replace(/\n+$/g, "");

      return `\n\`\`\`${lang}\n${body}\n\`\`\`\n`;
    }

    if (tag === "CODE") {
      return `\`${escapeInlineBackticks(el.innerText || el.textContent || "")}\``;
    }

    if (tag === "A") {
      const href = el.getAttribute("href") || "";
      const label = (el.innerText || el.textContent || href || "").trim().replace(/\n+/g, " ");
      return href ? `[${label}](${href})` : label;
    }

    if (/^H[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      const hashes = "#".repeat(Math.max(1, Math.min(6, level)));
      const t = (el.innerText || el.textContent || "").replace(/\n+/g, " ").trim();
      return `\n${hashes} ${t}\n\n`;
    }

    if (tag === "BR") return "\n";

    if (tag === "UL") {
      const items = Array.from(el.querySelectorAll(":scope > li")).map((li) => {
        const item = childrenToMarkdown(li).trim().replace(/\n+/g, "\n");
        const lines = item.split("\n");
        return ["- " + (lines[0] || ""), ...lines.slice(1).map((l) => "  " + l)].join("\n");
      });
      return `\n${items.join("\n")}\n\n`;
    }

    if (tag === "OL") {
      const lis = Array.from(el.querySelectorAll(":scope > li"));
      const items = lis.map((li, i) => {
        const item = childrenToMarkdown(li).trim().replace(/\n+/g, "\n");
        const lines = item.split("\n");
        return [`${i + 1}. ${lines[0] || ""}`, ...lines.slice(1).map((l) => "   " + l)].join("\n");
      });
      return `\n${items.join("\n")}\n\n`;
    }

    if (tag === "BLOCKQUOTE") {
      const inner = childrenToMarkdown(el).trim();
      return `\n${inner.split("\n").map((l) => `> ${l}`).join("\n")}\n\n`;
    }

    if (tag === "P") {
      const inner = childrenToMarkdown(el).trim();
      return inner ? `\n${inner}\n\n` : "";
    }

    return childrenToMarkdown(el);
  };

  const exportCurrentChatToMarkdown = async () => {
    // Preflight to hydrate code blocks before scraping
    await preflightRenderCodeBlocks();

    const title = getChatTitle();
    const chatId = getChatIdFromUrl();
    const now = new Date();

    const turns = getConversationTurns();
    if (!turns.length) {
      alert("Couldn’t find conversation turns on this page. (ChatGPT UI changed?)");
      return;
    }

    const header = [
      `# ${title}`,
      ``,
      `- Exported: ${now.toISOString()}`,
      chatId ? `- Chat ID: ${chatId}` : `- Chat ID: (not found)`,
      `- URL: ${location.href}`,
      ``,
      `---`,
      ``
    ].join("\n");

    let body = "";
    for (const turn of turns) {
      const role = getRoleForTurn(turn);
      const contentEl = getContentElementForTurn(turn);

      const sectionTitle = role === "user" ? "User" : "Assistant";
      let md = childrenToMarkdown(contentEl).trim();

      if (!md) md = (contentEl.innerText || contentEl.textContent || "").trim();
      if (!md) continue;

      body += `## ${sectionTitle}\n\n${md}\n\n---\n\n`;
    }

    const out = (header + body).replace(/\n{3,}/g, "\n\n").trim() + "\n";
    const base = safeFilename(title);
    const suffix = chatId ? `_${chatId.slice(0, 8)}` : "";
    downloadTextFile(`${base}${suffix}.md`, out);
  };

  // ---------- UI injection (next to Share) ----------
  const findHeaderActions = () => document.querySelector("#conversation-header-actions");
  const findShareButton = () => document.querySelector('button[data-testid="share-chat-button"]');

  const makeSaveButton = () => {
    const shareBtn = findShareButton();
    const btn = document.createElement("button");
    btn.id = SAVE_BTN_ID;
    btn.type = "button";
    btn.setAttribute("aria-label", "Save");

    // Reuse Share button classes for perfect style match
    if (shareBtn && shareBtn.className) {
      btn.className = shareBtn.className;
    } else {
      btn.className = "btn relative btn-ghost text-token-text-primary hover:bg-token-surface-hover rounded-lg";
    }

    btn.innerHTML = `
      <div class="flex w-full items-center justify-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="-ms-0.5 icon" viewBox="0 0 24 24">
          <path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM6 8V5h10v3H6Z"/>
        </svg>
        Save
      </div>
    `;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await exportCurrentChatToMarkdown();
    });

    return btn;
  };

  const injectSaveButton = () => {
    if (document.getElementById(SAVE_BTN_ID)) return;

    const actions = findHeaderActions();
    const shareBtn = findShareButton();
    if (!actions || !shareBtn) return;

    const saveBtn = makeSaveButton();
    actions.insertBefore(saveBtn, shareBtn);

    log("Injected Save button in header.");
  };

  const observer = new MutationObserver(() => injectSaveButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  injectSaveButton();

// Hotkey: Ctrl+S / Cmd+S saves chat as .md (prevents browser "Save page" dialog)
document.addEventListener("keydown", (e) => {
  const key = (e.key || "").toLowerCase();
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const saveCombo = (isMac && e.metaKey && key === "s") || (!isMac && e.ctrlKey && key === "s");
  if (!saveCombo) return;

  // Don’t hijack if user is typing in an input/textarea/contenteditable
  const t = e.target;
  const tag = t && t.tagName ? t.tagName.toLowerCase() : "";
  const isTypingTarget =
    tag === "input" ||
    tag === "textarea" ||
    (t && t.isContentEditable);

  if (isTypingTarget) return;

  e.preventDefault();
  e.stopPropagation();
  exportCurrentChatToMarkdown();
}, true);


})();
