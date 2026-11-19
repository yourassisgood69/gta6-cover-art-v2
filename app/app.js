// Vice Coast Cover Studio — a GTA-style multi-panel cover maker.
// Everything here is drawn on canvas from the user's photos and the
// built-in sample photos. No network requests, no outside assets.

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const ctx = stage.getContext("2d");

// ---------------------------------------------------------------- library

// Fictional sample subjects, shipped with the app. face marks where the
// subject's face sits in the photo (fractions of the image), so crops can
// keep the face inside its panel.
const SAMPLES = [
  { id: "woman-car", file: "samples/woman-car.jpg", label: "Coast drive", face: { x: 0.5, y: 0.34 } },
  { id: "man-rooftop", file: "samples/man-rooftop.jpg", label: "Rooftop", face: { x: 0.5, y: 0.3 } },
  { id: "friends-neon", file: "samples/friends-neon.jpg", label: "Neon friends", face: { x: 0.5, y: 0.38 } },
  { id: "man-pier", file: "samples/man-pier.jpg", label: "Pier dusk", face: { x: 0.5, y: 0.3 } },
];

const library = SAMPLES.map((s) => ({ ...s, img: null, loaded: false, uploaded: false }));

function loadLibrary() {
  for (const item of library) {
    const img = new Image();
    img.onload = () => { item.loaded = true; render(); maybeReady(); };
    img.onerror = () => { item.loaded = false; render(); maybeReady(); };
    img.src = item.file;
    item.img = img;
  }
}

// ---------------------------------------------------------------- choices

const LAYOUTS = [
  { id: "cover9", label: "Cover grid", panels: 9 },
  { id: "hero3", label: "Hero + three", panels: 4 },
  { id: "grid4", label: "Four panels", panels: 4 },
  { id: "fullbleed", label: "Full bleed", panels: 1 },
  { id: "tilted", label: "Tilted snaps", panels: 3 },
  { id: "triptych", label: "Triptych", panels: 3 },
  { id: "story", label: "Story", panels: 2 },
];

const GRADES = [
  { id: "sunset", label: "Sunset", top: "#ff9a3d", bottom: "#c22e6e", wash: "#ff5a2a", washAlpha: 0.16 },
  { id: "neon", label: "Neon Night", top: "#2de2ff", bottom: "#7a2bff", wash: "#2b6cff", washAlpha: 0.18 },
  { id: "vicepink", label: "Vice Pink", top: "#ff7ad9", bottom: "#ff2e88", wash: "#ff2e88", washAlpha: 0.2 },
  { id: "tealnoir", label: "Teal Noir", top: "#1fb6a6", bottom: "#0b2b3a", wash: "#0f766e", washAlpha: 0.2 },
  { id: "golden", label: "Golden Hour", top: "#ffd76a", bottom: "#ff8a3d", wash: "#ffb020", washAlpha: 0.18 },
  { id: "mono", label: "Mono Noir", top: "#9aa0a6", bottom: "#111318", wash: "#888888", washAlpha: 0.1, mono: true },
];

const LETTERINGS = [
  { id: "gradient", label: "Gradient" },
  { id: "outline", label: "Outline" },
  { id: "shadow", label: "Shadow" },
];

const EXPORT_SIZES = [
  { w: 1080, h: 1080, label: "1080 × 1080" },
  { w: 1080, h: 1350, label: "1080 × 1350" },
  { w: 1920, h: 1080, label: "1920 × 1080" },
  { w: 1080, h: 1920, label: "1080 × 1920" },
];

const SURPRISE_TITLES = [
  "Neon Shore", "Night Shift", "Golden Hour", "Palm Avenue",
  "Sunset Heist", "Vice Coast", "Midnight Run", "Salt Air",
];

// ---------------------------------------------------------------- state

function freshPanels() {
  const panels = [];
  for (let i = 0; i < 9; i++) {
    panels.push({ photo: i % library.length, zoom: 1, dx: 0, dy: 0, flip: false });
  }
  return panels;
}

function defaultState() {
  return {
    layout: "cover9",
    grade: "sunset",
    title: "Neon Shore",
    subtitle: "A Vice Coast story",
    badge: "VICE COAST",
    letter: "gradient",
    grain: true,
    vignette: true,
    halftone: true,
    frame: true,
    selected: 0,
    panels: freshPanels(),
  };
}

let state = defaultState();
let undoStack = [];
let redoStack = [];

function snapshot() { return JSON.stringify(state); }
function restore(text) { state = JSON.parse(text); syncControls(); render(); }
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateUndoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  updateUndoButtons();
}
function updateUndoButtons() {
  $("undoBtn").disabled = !undoStack.length;
  $("redoBtn").disabled = !redoStack.length;
}

// ---------------------------------------------------------------- geometry

// Every layout is described in fractions of the cover, so the same drawing
// works at preview size and at every export size.
function layoutGeometry(layoutId) {
  switch (layoutId) {
    case "cover9": {
      const panels = [{ x: 0, y: 0, w: 1, h: 0.5, rot: 0 }];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          panels.push({ x: c * 0.25, y: 0.5 + r * 0.25, w: 0.25, h: 0.25, rot: 0 });
        }
      }
      return { panels, band: { x: 0, y: 0.84, w: 1, h: 0.16 } };
    }
    case "hero3": {
      const panels = [{ x: 0, y: 0, w: 0.6, h: 1, rot: 0 }];
      for (let i = 0; i < 3; i++) panels.push({ x: 0.6, y: i / 3, w: 0.4, h: 1 / 3, rot: 0 });
      return { panels, band: { x: 0, y: 0.84, w: 1, h: 0.16 } };
    }
    case "grid4": {
      const panels = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        panels.push({ x: c * 0.5, y: r * 0.5, w: 0.5, h: 0.5, rot: 0 });
      }
      return { panels, band: { x: 0, y: 0.82, w: 1, h: 0.18 } };
    }
    case "fullbleed":
      return { panels: [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }], band: { x: 0, y: 0.76, w: 1, h: 0.24 } };
    case "tilted":
      return {
        panels: [
          { x: 0.05, y: 0.08, w: 0.4, h: 0.66, rot: -0.1 },
          { x: 0.31, y: 0.14, w: 0.4, h: 0.66, rot: 0.03 },
          { x: 0.57, y: 0.08, w: 0.4, h: 0.66, rot: 0.09 },
        ],
        band: { x: 0, y: 0.82, w: 1, h: 0.18 },
      };
    case "triptych": {
      const panels = [];
      for (let i = 0; i < 3; i++) panels.push({ x: i / 3, y: 0, w: 1 / 3, h: 1, rot: 0 });
      return { panels, band: { x: 0, y: 0.82, w: 1, h: 0.18 } };
    }
    default: // story
      return {
        panels: [
          { x: 0, y: 0, w: 1, h: 0.44, rot: 0 },
          { x: 0, y: 0.44, w: 1, h: 0.34, rot: 0 },
        ],
        band: { x: 0, y: 0.78, w: 1, h: 0.22 },
      };
  }
}

function panelCount() {
  return LAYOUTS.find((l) => l.id === state.layout).panels;
}

function grade() {
  return GRADES.find((g) => g.id === state.grade);
}

// ---------------------------------------------------------------- drawing

let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const tile = document.createElement("canvas");
  tile.width = 160; tile.height = 160;
  const tctx = tile.getContext("2d");
  const data = tctx.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 28;
  }
  tctx.putImageData(data, 0, 0);
  noiseTile = tile;
  return tile;
}

// Draw one photo inside one panel. The crop starts face-centred and the pan
// is clamped so the photo always covers the whole panel (no white strip)
// and the face stays fully inside the panel.
function drawPanel(c, img, face, panel, rect) {
  const px = rect.x, py = rect.y, pw = rect.w, ph = rect.h;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(pw / iw, ph / ih) * panel.zoom;
  const dw = iw * scale, dh = ih * scale;
  // Face-centred base offset (no pan).
  const baseX = px + pw / 2 - face.x * dw;
  const baseY = py + ph / 2 - face.y * dh;
  // Coverage range for the offset, plus the face-inside range.
  let loX = px + pw - dw, hiX = px;
  let loY = py + ph - dh, hiY = py;
  const margin = 6;
  const faceLoX = px + margin - face.x * dw, faceHiX = px + pw - margin - face.x * dw;
  const faceLoY = py + margin - face.y * dh, faceHiY = py + ph - margin - face.y * dh;
  loX = Math.max(loX, faceLoX); hiX = Math.min(hiX, faceHiX);
  loY = Math.max(loY, faceLoY); hiY = Math.min(hiY, faceHiY);
  if (loX > hiX) { loX = px + pw - dw; hiX = px; }
  if (loY > hiY) { loY = py + ph - dh; hiY = py; }
  let ox = baseX + panel.dx * pw;
  let oy = baseY + panel.dy * ph;
  ox = Math.min(Math.max(ox, loX), hiX);
  oy = Math.min(Math.max(oy, loY), hiY);
  // Write the clamped pan back so dragging can never park on a white strip.
  panel.dx = (ox - baseX) / pw;
  panel.dy = (oy - baseY) / ph;

  c.save();
  c.beginPath();
  c.rect(px, py, pw, ph);
  c.clip();
  if (panel.flip) {
    c.translate(px + pw, py);
    c.scale(-1, 1);
    c.drawImage(img, ox - px, oy - py, dw, dh);
  } else {
    c.drawImage(img, ox, oy, dw, dh);
  }
  c.restore();
}

function drawPalmSun(c, cx, cy, r) {
  // Sun disc.
  const sun = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  sun.addColorStop(0, "#ffe9a8");
  sun.addColorStop(0.55, "#ffb020");
  sun.addColorStop(1, "#ff5a2a");
  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = sun; c.fill();
  c.lineWidth = Math.max(2, r * 0.08);
  c.strokeStyle = "#ffd76a"; c.stroke();
  // Palm silhouette, drawn from plain curves.
  c.strokeStyle = "#2a0e1e"; c.fillStyle = "#2a0e1e";
  c.lineWidth = Math.max(2, r * 0.09);
  c.beginPath();
  c.moveTo(cx - r * 0.1, cy + r * 0.95);
  c.quadraticCurveTo(cx + r * 0.05, cy + r * 0.1, cx + r * 0.18, cy - r * 0.35);
  c.stroke();
  const fronds = [-2.4, -1.7, -1.0, -0.35, 0.35, 1.0];
  c.lineWidth = Math.max(2, r * 0.07);
  for (const a of fronds) {
    const tx = cx + r * 0.18 + Math.sin(a) * r * 0.85;
    const ty = cy - r * 0.35 - Math.cos(a) * r * 0.45;
    c.beginPath();
    c.moveTo(cx + r * 0.18, cy - r * 0.35);
    c.quadraticCurveTo(cx + r * 0.18 + Math.sin(a) * r * 0.5, cy - r * 0.35 - Math.cos(a) * r * 0.75, tx, ty);
    c.stroke();
  }
  // Sea lines under the palm.
  c.lineWidth = Math.max(1.5, r * 0.05);
  for (let i = 0; i < 3; i++) {
    const yy = cy + r * (0.55 + i * 0.18);
    c.beginPath();
    c.moveTo(cx - r * 0.7, yy);
    c.lineTo(cx + r * 0.7, yy);
    c.stroke();
  }
  c.restore();
}

function drawRibbon(c, W) {
  // Badge ribbon across the top-right corner, far from the title band.
  // Its centre sits 110 px in from the corner along the diagonal, so the
  // band enters through the top edge and leaves through the right edge.
  const label = (state.badge || "VICE COAST").toUpperCase();
  c.save();
  c.translate(W - 110, 110);
  c.rotate(Math.PI / 4);
  const grad = c.createLinearGradient(-170, 0, 170, 0);
  grad.addColorStop(0, "#ff7a3d");
  grad.addColorStop(1, "#ff2e88");
  c.fillStyle = grad;
  c.fillRect(-170, -17, 340, 34);
  c.fillStyle = "#fff";
  c.font = `${Math.round(W * 0.016)}px Anton, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(label, 0, 1);
  c.restore();
}

function drawTitleBand(c, W, H, band) {
  const bx = band.x * W, by = band.y * H, bw = band.w * W, bh = band.h * H;
  // Dark band so the lettering always reads.
  const shade = c.createLinearGradient(0, by, 0, by + bh);
  shade.addColorStop(0, "rgba(10,4,24,0)");
  shade.addColorStop(0.35, "rgba(10,4,24,0.82)");
  shade.addColorStop(1, "rgba(10,4,24,0.94)");
  c.fillStyle = shade;
  c.fillRect(bx, by, bw, bh);

  if (state.halftone) {
    // Halftone dots, bigger towards the left, fading out to the right.
    c.save();
    c.fillStyle = "rgba(255,194,77,0.20)";
    const step = Math.max(7, bh * 0.14);
    for (let x = bx + step / 2; x < bx + bw; x += step) {
      for (let y = by + step / 2; y < by + bh; y += step) {
        const fade = 1 - (x - bx) / bw;
        const rr = Math.max(0.6, step * 0.22 * fade);
        c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }

  // Palm-sun medallion, inside the title band at its left end, clear of
  // the ribbon (which lives at the top-right corner).
  const r = bh * 0.44;
  const cx = bx + r + Math.max(10, W * 0.012);
  const cy = by + bh / 2;
  drawPalmSun(c, cx, cy, r);

  const textX = cx + r + Math.max(12, W * 0.016);
  let titleSize = Math.round(bh * 0.52);
  const subSize = Math.round(bh * 0.26);
  const title = (state.title || "Neon Shore").toUpperCase();
  const sub = state.subtitle || "";

  // Shrink a long title until it fits the band instead of running off the edge.
  const maxTitleWidth = W - textX - W * 0.02;
  c.save();
  c.font = `${titleSize}px Anton, sans-serif`;
  while (titleSize > 12 && c.measureText(title).width > maxTitleWidth) {
    titleSize -= 2;
    c.font = `${titleSize}px Anton, sans-serif`;
  }
  c.restore();

  c.save();
  c.textAlign = "left";
  c.textBaseline = "middle";
  const titleY = sub ? by + bh * 0.34 : by + bh * 0.52;
  if (state.letter === "outline") {
    c.font = `${titleSize}px Anton, sans-serif`;
    c.lineWidth = Math.max(2, titleSize * 0.09);
    c.strokeStyle = "#ff2e88";
    c.strokeText(title, textX, titleY);
    c.fillStyle = "#fff";
    c.fillText(title, textX, titleY);
  } else if (state.letter === "shadow") {
    c.font = `${titleSize}px Anton, sans-serif`;
    c.fillStyle = "rgba(0,0,0,0.65)";
    c.fillText(title, textX + titleSize * 0.07, titleY + titleSize * 0.07);
    c.fillStyle = "#fff";
    c.fillText(title, textX, titleY);
  } else {
    const g = c.createLinearGradient(0, titleY - titleSize / 2, 0, titleY + titleSize / 2);
    g.addColorStop(0, "#ffe9a8");
    g.addColorStop(0.5, "#ff7a3d");
    g.addColorStop(1, "#ff2e88");
    c.font = `${titleSize}px Anton, sans-serif`;
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = titleSize * 0.08;
    c.shadowOffsetY = titleSize * 0.04;
    c.fillStyle = g;
    c.fillText(title, textX, titleY);
    c.shadowColor = "transparent";
  }
  if (sub) {
    c.font = `${subSize}px Pacifico, cursive`;
    c.fillStyle = "#ffd76a";
    c.fillText(sub, textX, by + bh * 0.78);
  }
  c.restore();
}

function drawCover(c, W, H) {
  const g = grade();
  const geo = layoutGeometry(state.layout);
  const gap = Math.max(2, W * 0.006);

  // Backdrop: deep violet-to-orange dusk.
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#241040");
  bg.addColorStop(0.55, "#4a1030");
  bg.addColorStop(1, "#8a2f0e");
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  // Panels.
  const count = panelCount();
  for (let i = 0; i < count; i++) {
    const p = geo.panels[i];
    const rect = {
      x: p.x * W + gap,
      y: p.y * H + gap,
      w: p.w * W - gap * 2,
      h: p.h * H - gap * 2,
    };
    const item = library[state.panels[i].photo] || library[0];
    c.save();
    if (p.rot) {
      c.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      c.rotate(p.rot);
      c.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    if (state.layout === "tilted") {
      // White snapshot border around each tilted panel.
      c.fillStyle = "#fdf6ec";
      c.fillRect(rect.x - gap * 2, rect.y - gap * 2, rect.w + gap * 4, rect.h + gap * 4);
    }
    if (item && item.img) drawPanel(c, item.img, item.face, state.panels[i], rect);
    else { c.fillStyle = "#3a2f5c"; c.fillRect(rect.x, rect.y, rect.w, rect.h); }
    c.restore();
    // Thin panel edge.
    c.save();
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = Math.max(1, W * 0.0015);
    c.strokeRect(rect.x, rect.y, rect.w, rect.h);
    c.restore();
  }

  // Mono grade: desaturate the photos before the overlays.
  if (g.mono) {
    const snap = document.createElement("canvas");
    snap.width = W; snap.height = H;
    snap.getContext("2d").drawImage(c.canvas, 0, 0);
    c.save();
    c.filter = "grayscale(1) contrast(1.12) brightness(1.05)";
    c.drawImage(snap, 0, 0);
    c.restore();
  }

  // Grade wash over the whole cover.
  const wash = c.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, g.top);
  wash.addColorStop(1, g.bottom);
  c.save();
  c.globalCompositeOperation = "soft-light";
  c.globalAlpha = 0.55;
  c.fillStyle = wash;
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "overlay";
  c.globalAlpha = g.washAlpha;
  c.fillStyle = g.wash;
  c.fillRect(0, 0, W, H);
  c.restore();

  // Legibility gradient along the bottom, then the title band.
  const leg = c.createLinearGradient(0, H * 0.55, 0, H);
  leg.addColorStop(0, "rgba(10,4,24,0)");
  leg.addColorStop(1, "rgba(10,4,24,0.5)");
  c.fillStyle = leg;
  c.fillRect(0, H * 0.55, W, H * 0.45);

  drawTitleBand(c, W, H, geo.band);
  drawRibbon(c, W);

  if (state.vignette) {
    const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.42)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
  }
  if (state.grain) {
    c.save();
    c.globalAlpha = 0.5;
    c.fillStyle = c.createPattern(getNoiseTile(), "repeat");
    c.fillRect(0, 0, W, H);
    c.restore();
  }
  if (state.frame) {
    const fw = Math.max(4, W * 0.012);
    c.strokeStyle = "#fdf6ec";
    c.lineWidth = fw;
    c.strokeRect(fw / 2, fw / 2, W - fw, H - fw);
    c.strokeStyle = "rgba(255,194,77,0.9)";
    c.lineWidth = Math.max(1, W * 0.002);
    c.strokeRect(fw * 1.8, fw * 1.8, W - fw * 3.6, H - fw * 3.6);
  }
}

function render() {
  drawCover(ctx, stage.width, stage.height);
}

// Offscreen render used by export and by the test hook.
function renderToSize(w, h) {
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  drawCover(off.getContext("2d"), w, h);
  return off;
}

// ---------------------------------------------------------------- export

function downloadCanvas(canvas, name) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(false); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve(true);
    }, "image/png");
  });
}

function safeTitle() {
  return (state.title || "cover").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "cover";
}

async function exportSize(size) {
  const canvas = renderToSize(size.w, size.h);
  const ok = await downloadCanvas(canvas, `vice-coast-${safeTitle()}-${size.w}x${size.h}.png`);
  return ok;
}

async function exportAll() {
  const note = $("exportNote");
  note.textContent = "Exporting all four sizes…";
  for (const size of EXPORT_SIZES) {
    await exportSize(size);
    await new Promise((r) => setTimeout(r, 250));
  }
  note.textContent = "Done — four PNGs downloaded (1080×1080, 1080×1350, 1920×1080, 1080×1920).";
}

// ---------------------------------------------------------------- controls

function buildPicker(container, items, currentId, onPick) {
  container.innerHTML = "";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.label;
    btn.dataset.value = item.id;
    btn.setAttribute("aria-pressed", String(item.id === currentId));
    btn.addEventListener("click", () => {
      pushHistory();
      onPick(item.id);
      syncControls();
      render();
    });
    container.appendChild(btn);
  }
}

function syncPickers() {
  buildPicker($("layoutPicker"), LAYOUTS, state.layout, (id) => { state.layout = id; state.selected = 0; });
  buildPicker($("gradePicker"), GRADES, state.grade, (id) => { state.grade = id; });
  buildPicker($("letterPicker"), LETTERINGS, state.letter, (id) => { state.letter = id; });
}

function syncPhotoControls() {
  const sel = $("photoSelect");
  const keep = state.panels[state.selected].photo;
  sel.innerHTML = "";
  library.forEach((item, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = item.label + (item.uploaded ? " (yours)" : "");
    sel.appendChild(opt);
  });
  sel.value = String(keep);
  const row = $("thumbRow");
  row.innerHTML = "";
  library.forEach((item, i) => {
    const img = document.createElement("img");
    img.src = item.uploaded ? item.file : item.file;
    img.alt = item.label;
    img.className = i === keep ? "active" : "";
    img.addEventListener("click", () => {
      pushHistory();
      state.panels[state.selected].photo = i;
      syncPhotoControls();
      render();
    });
    row.appendChild(img);
  });
  const count = panelCount();
  $("panelLabel").textContent = `Panel ${state.selected + 1} of ${count}`;
  $("zoomSlider").value = String(state.panels[state.selected].zoom);
}

function syncControls() {
  syncPickers();
  $("titleInput").value = state.title;
  $("subtitleInput").value = state.subtitle;
  $("badgeInput").value = state.badge;
  $("grainCheck").checked = state.grain;
  $("vignetteCheck").checked = state.vignette;
  $("halftoneCheck").checked = state.halftone;
  $("frameCheck").checked = state.frame;
  syncPhotoControls();
}

function bindControls() {
  $("titleInput").addEventListener("input", (e) => { state.title = e.target.value; render(); });
  $("titleInput").addEventListener("change", () => pushHistory());
  $("subtitleInput").addEventListener("input", (e) => { state.subtitle = e.target.value; render(); });
  $("subtitleInput").addEventListener("change", () => pushHistory());
  $("badgeInput").addEventListener("input", (e) => { state.badge = e.target.value; render(); });
  $("badgeInput").addEventListener("change", () => pushHistory());

  $("photoSelect").addEventListener("change", (e) => {
    pushHistory();
    state.panels[state.selected].photo = Number(e.target.value);
    syncPhotoControls();
    render();
  });
  $("zoomSlider").addEventListener("input", (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    render();
  });
  $("zoomSlider").addEventListener("change", () => pushHistory());
  $("flipBtn").addEventListener("click", () => {
    pushHistory();
    const p = state.panels[state.selected];
    p.flip = !p.flip;
    render();
  });
  $("centerBtn").addEventListener("click", () => {
    pushHistory();
    const p = state.panels[state.selected];
    p.dx = 0; p.dy = 0; p.zoom = 1;
    syncPhotoControls();
    render();
  });
  $("applyAllBtn").addEventListener("click", () => {
    pushHistory();
    const photo = state.panels[state.selected].photo;
    for (const p of state.panels) p.photo = photo;
    render();
  });
  $("prevPanelBtn").addEventListener("click", () => {
    state.selected = (state.selected - 1 + panelCount()) % panelCount();
    syncPhotoControls();
  });
  $("nextPanelBtn").addEventListener("click", () => {
    state.selected = (state.selected + 1) % panelCount();
    syncPhotoControls();
  });

  $("grainCheck").addEventListener("change", (e) => { pushHistory(); state.grain = e.target.checked; render(); });
  $("vignetteCheck").addEventListener("change", (e) => { pushHistory(); state.vignette = e.target.checked; render(); });
  $("halftoneCheck").addEventListener("change", (e) => { pushHistory(); state.halftone = e.target.checked; render(); });
  $("frameCheck").addEventListener("change", (e) => { pushHistory(); state.frame = e.target.checked; render(); });

  $("undoBtn").addEventListener("click", undo);
  $("redoBtn").addEventListener("click", redo);
  $("resetBtn").addEventListener("click", () => {
    pushHistory();
    state = defaultState();
    syncControls();
    render();
  });
  $("surpriseBtn").addEventListener("click", () => {
    pushHistory();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    state.layout = pick(LAYOUTS).id;
    state.grade = pick(GRADES).id;
    state.title = pick(SURPRISE_TITLES);
    const photo = Math.floor(Math.random() * library.length);
    for (const p of state.panels) p.photo = photo;
    state.selected = 0;
    syncControls();
    render();
  });

  $("exportAllBtn").addEventListener("click", exportAll);
  for (const btn of document.querySelectorAll(".export-one")) {
    btn.addEventListener("click", async () => {
      const [w, h] = btn.dataset.size.split("x").map(Number);
      $("exportNote").textContent = `Exporting ${w} × ${h}…`;
      await exportSize({ w, h });
      $("exportNote").textContent = `Saved vice-coast-${safeTitle()}-${w}x${h}.png`;
    });
  }

  $("uploadInput").addEventListener("change", (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    pushHistory();
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        library.push({ id: `upload-${library.length}`, file: url, label: file.name.replace(/\.[^.]+$/, "").slice(0, 18) || "Your photo", face: { x: 0.5, y: 0.38 }, img, loaded: true, uploaded: true });
        state.panels[state.selected].photo = library.length - 1;
        syncPhotoControls();
        render();
      };
      img.src = url;
    }
    e.target.value = "";
  });
}

// ---------------------------------------------------------------- dragging

function panelRectsOnStage() {
  const geo = layoutGeometry(state.layout);
  const rect = stage.getBoundingClientRect();
  const sx = stage.width / rect.width;
  const sy = stage.height / rect.height;
  const out = [];
  for (let i = 0; i < panelCount(); i++) {
    const p = geo.panels[i];
    out.push({ x: p.x * stage.width, y: p.y * stage.height, w: p.w * stage.width, h: p.h * stage.height, sx, sy });
  }
  return out;
}

function bindDrag() {
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (stage.width / rect.width);
    const y = (e.clientY - rect.top) * (stage.height / rect.height);
    const rects = panelRectsOnStage();
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        state.selected = i;
        syncPhotoControls();
        drag = { panel: state.panels[i], startX: e.clientX, startY: e.clientY, moved: false, pw: r.w, ph: r.h, sx: r.sx, sy: r.sy };
        stage.setPointerCapture(e.pointerId);
        break;
      }
    }
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dxCanvas = (e.clientX - drag.startX) * drag.sx;
    const dyCanvas = (e.clientY - drag.startY) * drag.sy;
    if (Math.abs(dxCanvas) + Math.abs(dyCanvas) > 2) drag.moved = true;
    drag.panel.dx += (dxCanvas / drag.pw) * 0.25;
    drag.panel.dy += (dyCanvas / drag.ph) * 0.25;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    render();
  });
  stage.addEventListener("pointerup", () => {
    if (drag && drag.moved) pushHistory();
    drag = null;
  });
}

// ---------------------------------------------------------------- scenes

const SHOTS = {
  cover: { layout: "cover9", grade: "sunset", photo: "woman-car", title: "Neon Shore", subtitle: "A Vice Coast story", size: [1920, 1080] },
  editor: { layout: "hero3", grade: "neon", photo: "friends-neon", title: "Night Shift", subtitle: "Neon streets, golden hour", size: null },
  portrait: { layout: "fullbleed", grade: "golden", photo: "man-pier", title: "Golden Hour", subtitle: "Salt air and sunset", size: [1080, 1350] },
  square: { layout: "grid4", grade: "vicepink", photo: "man-rooftop", title: "Palm Avenue", subtitle: "Vice Coast nights", size: [1080, 1080] },
};

const PHOTO_ALIASES = { pier: "man-pier", boulevard: "friends-neon", car: "woman-car", rooftop: "man-rooftop" };

let readyFlagged = false;
function maybeReady() {
  if (readyFlagged) return;
  const imgsDone = library.slice(0, 4).every((item) => item.loaded);
  if (!imgsDone) return;
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      render();
      requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; readyFlagged = true; }));
    });
  } else {
    render();
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; readyFlagged = true; }));
  }
}
// Never leave a screenshot hanging: flag ready even if an asset stalls.
setTimeout(() => {
  if (!readyFlagged) { render(); window.__shotReady = true; readyFlagged = true; }
}, 10000);

function applyShot() {
  const params = new URLSearchParams(location.search);
  const shot = params.get("shot");
  if (!shot || !SHOTS[shot]) return;
  const scene = SHOTS[shot];
  state.layout = scene.layout;
  state.grade = scene.grade;
  state.title = params.get("caption") || scene.title;
  state.subtitle = scene.subtitle;
  const photoId = PHOTO_ALIASES[params.get("photo")] || scene.photo;
  const idx = library.findIndex((item) => item.id === photoId);
  const photo = idx === -1 ? 0 : idx;
  for (const p of state.panels) p.photo = photo;
  state.selected = 0;
  if (scene.size) {
    document.body.classList.add("showcase");
    stage.width = scene.size[0];
    stage.height = scene.size[1];
  }
  syncControls();
  render();
}

// Test hook for the maker: export a PNG as a data URL without downloading.
window.__viceCoast = {
  state: () => state,
  exportPng: (w, h) => renderToSize(w, h).toDataURL("image/png"),
};

// ---------------------------------------------------------------- boot

loadLibrary();
bindControls();
bindDrag();
applyShot();
syncControls();
updateUndoButtons();
render();
if (document.fonts) {
  Promise.all([
    document.fonts.load('40px Anton'),
    document.fonts.load('24px Pacifico'),
  ]).then(() => { render(); maybeReady(); }).catch(() => maybeReady());
} else {
  maybeReady();
}
