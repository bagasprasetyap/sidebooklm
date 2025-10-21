const sidePanelApi = chrome.sidePanel;

chrome.runtime.onInstalled.addListener(async () => {
  if (!sidePanelApi) {
    console.warn("Side panel API is not available in this version of Chrome.");
    return;
  }
  try {
    await sidePanelApi.setOptions({
      path: "sidepanel/index.html",
      enabled: true
    });
  } catch (error) {
    console.error("Failed to configure side panel on install", error);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!sidePanelApi) {
    console.warn("Side panel API is not available in this version of Chrome.");
    return;
  }
  try {
    await sidePanelApi.open({ windowId: tab.windowId });
  } catch (error) {
    console.error("Failed to open side panel", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "broadcast") {
    chrome.runtime.sendMessage({
      type: "broadcast",
      payload: message.payload,
      source: sender?.id
    });
  }
  // Keep the message channel open if sendResponse is async.
  return true;
});
