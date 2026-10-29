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

// A copy of an image with a color laid over its opaque pixels.
function tint(img, rgba) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = rgba;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "source-over";
  return c;
}

// Canvas text must not draw in a fallback font first, so wait for the game font.
function waitForFonts() {
  try {
    return Promise.all([
      document.fonts.load("10px GameFont"),
      document.fonts.load("bold 10px GameFont"),
    ]).catch(() => {});
  } catch (e) {
    return Promise.resolve();
  }
}

loadImages(ASSET_URLS)
  .then(() => waitForFonts())
  .then(() => {
    Engine.start(new TitleScene());
  })
  .catch((err) => {
    document.body.textContent = err.message;
    console.error(err);
  });
