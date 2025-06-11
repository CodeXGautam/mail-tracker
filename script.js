document.addEventListener("click", function (e) {
  if (e.target.innerText === "Send") {
    const composeBox = document.querySelector('[aria-label="Message Body"]');
    if (composeBox) {
      const trackingId = `pixel${Math.random()}`; // Generate dynamically
      const trackingPixel = `<img src="http://localhost:4000/track/${trackingId}" width="1" height="1" />`;
      const url = `http://localhost:4000/track/${trackingId}`
      console.log(url)
      composeBox.innerHTML += trackingPixel;
    }
  }
});
