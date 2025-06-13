document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await browser.runtime.sendMessage({
      type: "log",
      payload: "Popup loaded at " + new Date().toISOString()
    });

    console.log("Response from background:", response);
  } catch (err) {
    console.error("Failed to send message:", err);
  }
});
