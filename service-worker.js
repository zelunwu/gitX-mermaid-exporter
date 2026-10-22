"use strict";

importScripts("lib/filename.js");

const API = globalThis.GitHubMermaidExporter;
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
    const response = await chrome.tabs.sendMessage(tab.id, { type: "gme:export-all" });
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
  if (!delta.id || !pendingDownloads.has(delta.id)) return;
  if (delta.state?.current === "complete") {
    pendingDownloads.delete(delta.id);
    return;
  }
  if (delta.error?.current || delta.state?.current === "interrupted") {
    const target = pendingDownloads.get(delta.id);
    pendingDownloads.delete(delta.id);
    if (target?.tabId != null) {
      chrome.tabs.sendMessage(
        target.tabId,
        { type: "gme:download-failed", error: delta.error?.current || "Download interrupted" },
        target.frameId != null ? { frameId: target.frameId } : undefined
      ).catch(() => undefined);
    }
  }
});

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
  if (tabId == null) return;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#cf222e" });
  await chrome.action.setBadgeText({ tabId, text: "ERR" });
  await chrome.action.setTitle({ tabId, title: `GitHub Mermaid Exporter: ${message}` });
  setTimeout(() => clearActionState(tabId), 5000);
}

async function showActionSuccess(tabId, count) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#1a7f37" });
  await chrome.action.setBadgeText({ tabId, text: String(count || "✓") });
  await chrome.action.setTitle({ tabId, title: `Started ${count} Mermaid SVG download(s)` });
  setTimeout(() => clearActionState(tabId), 3000);
}

function clearActionState(tabId) {
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => undefined);
  chrome.action.setTitle({ tabId, title: "Export all Mermaid diagrams as SVG" }).catch(() => undefined);
}
