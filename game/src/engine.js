// Fixed-timestep loop, letterboxed canvas scaling, and the scene switch.
const Engine = (() => {
  const W = 480;
  const H = 270;
  const STEP = 1 / 60;

  let canvas = null;
  let ctx = null;
  let scene = null;
  let last = 0;
  let acc = 0;

  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.floor(W * scale) + "px";
    canvas.style.height = Math.floor(H * scale) + "px";
    document.body.classList.toggle("portrait", window.innerHeight > window.innerWidth);
  }

  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.25);
    last = t;
    // Portrait pauses the game. The overlay asks the player to rotate.
    const paused = document.body.classList.contains("portrait");
    if (!paused) {
      acc += dt;
      while (acc >= STEP) {
        Input.update();
        scene.update(STEP);
        acc -= STEP;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    scene.draw(ctx);
    requestAnimationFrame(frame);
  }

  function setScene(next) {
    scene = next;
    if (scene.enter) scene.enter();
  }

  function start(firstScene) {
    canvas = document.getElementById("screen");
    ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;
    window.addEventListener("resize", resize);
    resize();
    setScene(firstScene);
    last = performance.now();
    requestAnimationFrame(frame);
  }

  return { W, H, STEP, start, setScene, resize };
})();
