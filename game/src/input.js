// Logical actions fed by keyboard, gamepad, and on-screen touch buttons.
// Scenes ask for actions by name and never read raw keys or buttons.
const Input = (() => {
  // Keyboard uses letter keys and arrows, matching the design doc.
  const KEYS = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    KeyA: "ab1",
    KeyS: "ab2",
    KeyZ: "ab3",
    KeyX: "ab4",
    KeyQ: "discardSelf",
    KeyC: "discardCard",
    Enter: "start",
  };

  // Standard gamepad mapping. Ability order follows the design doc:
  // ab1 is X, ab2 is Y, ab3 is A, ab4 is B.
  const PAD = {
    0: "ab3",
    1: "ab4",
    2: "ab1",
    3: "ab2",
    9: "start",
    12: "up",
    13: "down",
    14: "left",
    15: "right",
  };

  const keyHeld = new Set();
  const touchHeld = new Set();
  // A press that starts and ends between two fixed steps still counts once.
  const latched = new Set();
  let padHeld = new Set();
  let cur = new Set();
  let prev = new Set();
  let edge = new Set();

  window.addEventListener("keydown", (e) => {
    const action = KEYS[e.code];
    if (!action) return;
    e.preventDefault();
    if (!e.repeat) latched.add(action);
    keyHeld.add(action);
  });

  window.addEventListener("keyup", (e) => {
    const action = KEYS[e.code];
    if (action) keyHeld.delete(action);
  });

  // Losing focus must not leave a key stuck down.
  window.addEventListener("blur", () => {
    keyHeld.clear();
    touchHeld.clear();
  });

  function readGamepads() {
    padHeld = new Set();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      pad.buttons.forEach((b, i) => {
        if (PAD[i] && (b.pressed || b.value > 0.5)) padHeld.add(PAD[i]);
      });
      // Left stick works as a bonus on top of the d-pad.
      if (pad.axes[0] < -0.5) padHeld.add("left");
      if (pad.axes[0] > 0.5) padHeld.add("right");
    }
  }

  // Call once per fixed step, before the scene updates.
  function update() {
    readGamepads();
    prev = cur;
    cur = new Set([...keyHeld, ...touchHeld, ...padHeld]);
    edge = new Set([...latched].concat([...cur].filter((a) => !prev.has(a))));
    latched.clear();
  }

  function down(action) {
    return cur.has(action);
  }

  function pressed(action) {
    return edge.has(action);
  }

  function setTouch(action, on) {
    if (on) {
      touchHeld.add(action);
      latched.add(action);
    } else {
      touchHeld.delete(action);
    }
  }

  function bindTouchButtons() {
    const root = document.getElementById("touch");
    const buttons = root.querySelectorAll("button[data-action]");
    const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    if (isTouch) document.body.classList.add("touch");

    for (const btn of buttons) {
      const action = btn.dataset.action;
      const press = (e) => {
        e.preventDefault();
        setTouch(action, true);
        btn.classList.add("held");
      };
      const release = (e) => {
        e.preventDefault();
        setTouch(action, false);
        btn.classList.remove("held");
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointercancel", release);
      btn.addEventListener("pointerleave", release);
    }
  }

  function bindFullscreen() {
    const btn = document.getElementById("fullscreen");
    const note = document.getElementById("fsNote");
    btn.addEventListener("click", () => {
      if (!document.fullscreenEnabled) {
        note.textContent =
          "Full screen is not available in this browser. On iPhone, use Share, then Add to Home Screen.";
        note.hidden = false;
        return;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    });
  }

  bindTouchButtons();
  bindFullscreen();

  return { update, down, pressed, setTouch };
})();
