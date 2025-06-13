document.addEventListener("DOMContentLoaded", () => {
  try {
    const observer = new MutationObserver(() => {
      const composeWindows = document.querySelectorAll("div[role='textbox']");
      composeWindows.forEach((win) => {
        if (!win.dataset.tracked) {
          win.dataset.tracked = "true";
          win.addEventListener("blur", () => {
            const pixelURL = `http://localhost:4000/pixel.png?emailId=${Date.now()}`;
            win.innerHTML += `<img src="${pixelURL}" width="1" height="1" style="display:none"/>`;
          });
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (err) {
    console.error("Tracking extension error:", err);
  }
});
