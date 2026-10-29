// Entry point. Loads every image, then opens the title screen.
const IMG = {};

function loadImages(urls) {
  const jobs = Object.entries(urls).map(
    ([key, src]) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          IMG[key] = img;
          resolve();
        };
        img.onerror = () => reject(new Error("failed to load " + key));
        img.src = src;
      })
  );
  return Promise.all(jobs);
}

loadImages(ASSET_URLS)
  .then(() => Engine.start(new TitleScene()))
  .catch((err) => {
    document.body.textContent = err.message;
    console.error(err);
  });
