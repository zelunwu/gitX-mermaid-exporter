/*
 * Copyright (c) 2026 Zelun Wu
 * SPDX-License-Identifier: MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

"use strict";

importScripts("lib/filename.js");

const API = globalThis.GitXMermaidExporter;
const pendingDownloads = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "gme:download" || typeof message.dataUrl !== "string") {
    return false;
  }

  startDownload(message, sender).then(sendResponse);
  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("https://github.com/")) {
    await showActionError(tab.id, "Open a github.com Markdown page first");
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "gme:open-picker" });
    if (!response?.ok) {
      await showActionError(tab.id, response?.error || "No Mermaid diagrams found");
      return;
    }
    await showActionSuccess(tab.id, response.count);
  } catch (error) {
    await showActionError(tab.id, error?.message || String(error));
  }
});

chrome.downloads.onChanged.addListener((delta) => {
  handleDownloadChanged(delta).catch(() => undefined);
});

async function handleDownloadChanged(delta) {
  if (!delta.id) return;
  if (delta.state?.current === "complete") {
    pendingDownloads.delete(delta.id);
    return;
  }
  if (delta.error?.current || delta.state?.current === "interrupted") {
    const target = pendingDownloads.get(delta.id);
    if (!target) {
      const [item] = await chrome.downloads.search({ id: delta.id });
      if (item?.byExtensionId !== chrome.runtime.id) return;
    }
    pendingDownloads.delete(delta.id);
    const error = delta.error?.current || "Download interrupted";
    if (target?.tabId != null) {
      chrome.tabs.sendMessage(target.tabId, { type: "gme:download-failed", error }).catch(() => undefined);
    }
    // onChanged wakes a restarted MV3 worker. A global badge still exposes the failure if
    // the in-memory sender map was lost or SPA navigation removed the original frame.
    showActionError(target?.tabId, error).catch(() => undefined);
  }
}

async function startDownload(message, sender) {
  try {
    const filename = API.filename.sanitizeDownloadPath(message.filename, message.format);
    const downloadId = await chrome.downloads.download({
      url: message.dataUrl,
      filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
    pendingDownloads.set(downloadId, {
      tabId: sender.tab?.id,
      frameId: sender.frameId
    });
    return { ok: true, downloadId };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function showActionError(tabId, message) {
  const target = tabId == null ? {} : { tabId };
  await chrome.action.setBadgeBackgroundColor({ ...target, color: "#cf222e" });
  await chrome.action.setBadgeText({ ...target, text: "ERR" });
  await chrome.action.setTitle({ ...target, title: `gitX Mermaid Exporter: ${message}` });
  setTimeout(() => clearActionState(tabId), 5000);
}

async function showActionSuccess(tabId, count) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#1a7f37" });
  await chrome.action.setBadgeText({ tabId, text: String(count || "✓") });
  await chrome.action.setTitle({ tabId, title: `Choose from ${count} Mermaid diagram(s)` });
  setTimeout(() => clearActionState(tabId), 3000);
}

function clearActionState(tabId) {
  const target = tabId == null ? {} : { tabId };
  chrome.action.setBadgeText({ ...target, text: "" }).catch(() => undefined);
  chrome.action.setTitle({ ...target, title: "Choose Mermaid diagrams to export" }).catch(() => undefined);
}
