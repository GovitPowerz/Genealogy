export function createPanZoom(svg, opts = {}) {
  const minScale = opts.minScale ?? 0.3;
  const maxScale = opts.maxScale ?? 6;
  const pointers = new Map();
  let anim = null;

  function getViewBox() {
    const vb = svg.viewBox.baseVal;
    return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  }

  function setViewBox(vb) {
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  const home = getViewBox();

  function clampedWidth(w) {
    const minW = svg.clientWidth / maxScale;
    const maxW = svg.clientWidth / minScale;
    return Math.min(maxW, Math.max(minW, w));
  }

  function zoomAt(clientX, clientY, factor) {
    const vb = getViewBox();
    const rect = svg.getBoundingClientRect();
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    const newW = clampedWidth(vb.w / factor);
    const newH = newW * (vb.h / vb.w);
    setViewBox({
      x: vb.x + fx * (vb.w - newW),
      y: vb.y + fy * (vb.h - newH),
      w: newW,
      h: newH
    });
  }

  function stopAnim() {
    if (anim !== null) {
      cancelAnimationFrame(anim);
      anim = null;
    }
  }

  function onPointerDown(e) {
    stopAnim();
    // Capture on the original target so click events still reach person nodes.
    e.target.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const dPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
      const dCur = Math.hypot(cur.x - other.x, cur.y - other.y);
      if (dPrev > 0 && dCur > 0) {
        zoomAt((cur.x + other.x) / 2, (cur.y + other.y) / 2, dCur / dPrev);
      }
    } else if (pointers.size === 1) {
      const rect = svg.getBoundingClientRect();
      const vb = getViewBox();
      vb.x -= ((cur.x - prev.x) / rect.width) * vb.w;
      vb.y -= ((cur.y - prev.y) / rect.height) * vb.h;
      setViewBox(vb);
    }
    pointers.set(e.pointerId, cur);
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
  }

  function onWheel(e) {
    e.preventDefault();
    stopAnim();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.002));
  }

  function flyTo(x, y, scale = 1.2) {
    stopAnim();
    const from = getViewBox();
    const w = clampedWidth(svg.clientWidth / scale);
    const h = w * (from.h / from.w);
    const to = { x: x - w / 2, y: y - h / 2, w, h };
    const start = performance.now();
    const duration = 600;
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const k = easeInOutCubic(t);
      setViewBox({
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        w: from.w + (to.w - from.w) * k,
        h: from.h + (to.h - from.h) * k
      });
      anim = t < 1 ? requestAnimationFrame(step) : null;
    }
    anim = requestAnimationFrame(step);
  }

  function reset() {
    stopAnim();
    setViewBox(home);
  }

  function destroy() {
    stopAnim();
    svg.removeEventListener("pointerdown", onPointerDown);
    svg.removeEventListener("pointermove", onPointerMove);
    svg.removeEventListener("pointerup", onPointerUp);
    svg.removeEventListener("pointercancel", onPointerUp);
    svg.removeEventListener("wheel", onWheel);
  }

  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);
  svg.addEventListener("wheel", onWheel, { passive: false });

  return { flyTo, reset, destroy };
}
