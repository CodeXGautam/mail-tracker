import browser from "webextension-polyfill";

// background.js (for Firefox with browser namespace)

browser.runtime.onInstalled.addListener(() => {
  console.log("Mail Tracker extension installed.");
});

// Example: Receive message from popup.js
browser.runtime.onMessage.addListener(async (message, sender) => {
  try {
    if (message.type === "log") {
      console.log("Received log from popup:", message.payload);
    }

    // Optional: Return something to the popup
    return Promise.resolve({ status: "received" });

  } catch (error) {
    console.error("Error in background message handler:", error);
  }
});

