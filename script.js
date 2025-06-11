document.addEventListener("click", function (e) {
  if (e.target.innerText === "Send") {
    const composeBox = document.querySelector('[aria-label="Message Body"]');
    if (composeBox) {
      const trackingId = "xyz123"; // Generate dynamically
      const trackingPixel = `<img src="http://localhost:4000/track/${trackingId}" width="1" height="1" />`;
      console.log(trackingPixel)
      composeBox.innerHTML += trackingPixel;
    }
  }
});
