// Text helper. Every on-screen string goes through drawText: it strokes a dark outline
// first, so text reads on any background. The font and fill style are set on ctx by the caller.
function drawText(ctx, text, x, y) {
  const size = parseInt((ctx.font.match(/(\d+)px/) || [0, "10"])[1], 10);
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, size / 4);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}
