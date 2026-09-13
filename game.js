/* ============================================================================
   CRYSTAL SHERIFF: CRYSTAL CLICKER
   An idle clicker set in the Crystal Sheriff: Tower Defender universe.
   Plain HTML + CSS + JS (Canvas 2D + Web Audio). No build step, no libraries.
   © 2026 Green Pencil Creative.
   ============================================================================ */
'use strict';

// ============================================================================
// 1. HELPERS (shared DNA with Tower Defender)
// ============================================================================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

const COLORS = {
  cyan: '#19e6ff', magenta: '#ff2bd6', yellow: '#ffd21f', pink: '#ff5fb8',
  blue: '#3b8bff', purple: '#a052ff', red: '#ff3355', green: '#4dff88',
  black: '#15151f', white: '#ffffff', orange: '#ff9a1f', outline: '#07070d',
};

/* Adaptive quality: if a device can't hold ~25fps, drop to a lighter scene once. */
const PERF = { low: false, acc: 0, n: 0 };

/* Every manual click is always worth at least this fraction of your per-second income,
   so /click visibly climbs as the game grows even before you buy click upgrades. */
const CLICK_BASE_SHARE = 0.08;

const _rgbCache = new Map();
function hexToRgb(hex) {
  let c = _rgbCache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  if (c.some(v => Number.isNaN(v))) c = [255, 255, 255];
  _rgbCache.set(hex, c);
  return c;
}
const _shadeCache = new Map();
function shade(hex, amt) {
  const k = hex + amt;
  let v = _shadeCache.get(k);
  if (v) return v;
  const [r, g, b] = hexToRgb(hex);
  const f = c => clamp(Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt)), 0, 255);
  v = `rgb(${f(r)},${f(g)},${f(b)})`;
  _shadeCache.set(k, v);
  return v;
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

const FONT = '"Press Start 2P","Silkscreen","Arial Black",Impact,sans-serif';
const font = size => `${Math.max(8, Math.round(size * 0.8))}px ${FONT}`;

/** Big-number formatter: commas below 1M, then K/M/B/T/... suffixes, then 10^x powers. */
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
/** Full names for the NEW NUMBER celebrations — the whole point is learning these. */
const NUM_WORDS = ['', 'thousand', 'MILLION', 'BILLION', 'TRILLION', 'QUADRILLION', 'QUINTILLION',
  'SEXTILLION', 'SEPTILLION', 'OCTILLION', 'NONILLION', 'DECILLION', 'UNDECILLION', 'DUODECILLION',
  'TREDECILLION', 'QUATTUORDECILLION', 'QUINDECILLION', 'SEXDECILLION', 'SEPTENDECILLION',
  'OCTODECILLION', 'NOVEMDECILLION', 'VIGINTILLION'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  n = Math.floor(n);
  if (n < 0) return '-' + fmt(-n);
  if (n < 1e6) return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIX.length) return n.toExponential(2).replace('e+', ' ×10^');   // pure powers of ten
  const v = n / Math.pow(10, tier * 3);
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + SUFFIX[tier];
}
function fmtRate(n) {   // rates can be fractional below 100
  if (n > 0 && n < 100) return (Math.round(n * 10) / 10).toString();
  return fmt(n);
}
function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

// ============================================================================
// 2. DRAWING (chunky cel-shaded cubes — same look as Tower Defender)
// ============================================================================
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

const _glowCache = new Map();
function glowSprite(color) {
  let c = _glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.25, rgba(color, 0.85));
  grad.addColorStop(0.6, rgba(color, 0.25)); grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  _glowCache.set(color, c);
  return c;
}
function drawGlow(ctx, x, y, r, color, alpha = 1) {
  if (PERF.low && r < 60) return;   // small glows are pure fill-rate cost on weak phones
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function hash2(i, j) { let n = (i * 374761393 + j * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
function pixelTexture(ctx, x, y, w, h, cell, alpha, seed = 0) {
  const nx = Math.ceil(w / cell), ny = Math.ceil(h / cell);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const r = hash2(i + seed * 17, j + seed * 31);
    if (r < 0.22) { ctx.fillStyle = `rgba(255,255,255,${(alpha * (r < 0.08 ? 1.7 : 1)).toFixed(3)})`; ctx.fillRect(x + i * cell, y + j * cell, cell, cell); }
    else if (r > 0.84) { ctx.fillStyle = `rgba(0,0,0,${(alpha * 1.4).toFixed(3)})`; ctx.fillRect(x + i * cell, y + j * cell, cell, cell); }
  }
}

/** Chunky cel-shaded cube: top + right faces, pixel texture, thick outline. */
function drawCube(ctx, x, y, s, col, o = {}) {
  const d = o.depth !== undefined ? o.depth : s * 0.22, h = s / 2;
  const lw = o.lw || Math.max(2.5, s * 0.085);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = lw; ctx.strokeStyle = o.outline || COLORS.outline;
  ctx.fillStyle = shade(col, 0.42);
  ctx.beginPath(); ctx.moveTo(-h, -h); ctx.lineTo(-h + d, -h - d); ctx.lineTo(h + d, -h - d); ctx.lineTo(h, -h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, 0.6);
  ctx.beginPath(); ctx.moveTo(-h + d * 0.35, -h - d * 0.35); ctx.lineTo(-h + d, -h - d); ctx.lineTo(h + d, -h - d); ctx.lineTo(h + d * 0.6, -h - d * 0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-h, -h); ctx.lineTo(-h + d, -h - d); ctx.lineTo(h + d, -h - d); ctx.lineTo(h, -h); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = shade(col, -0.45);
  ctx.beginPath(); ctx.moveTo(h, -h); ctx.lineTo(h + d, -h - d); ctx.lineTo(h + d, h - d); ctx.lineTo(h, h); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.fillRect(-h, -h, s, s);
  ctx.save(); ctx.beginPath(); ctx.rect(-h, -h, s, s); ctx.clip();
  ctx.fillStyle = shade(col, -0.28);
  ctx.beginPath(); ctx.moveTo(-h, h); ctx.lineTo(h, h); ctx.lineTo(h, h - s * 0.26); ctx.lineTo(-h, h - s * 0.14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, 0.22); ctx.fillRect(-h, -h, s, s * 0.09); ctx.fillRect(-h, -h, s * 0.09, s);
  if (o.pixels !== false) pixelTexture(ctx, -h, -h, s, s, Math.max(3, s / 7), 0.07, o.seed || 0);
  if (o.flash) { ctx.fillStyle = `rgba(255,255,255,${o.flash})`; ctx.fillRect(-h, -h, s, s); }
  ctx.restore();
  ctx.beginPath(); ctx.rect(-h, -h, s, s); ctx.stroke();
  ctx.restore();
}

function blinkAt(t, off) { const p = (t + off) % 3.7; return p < 0.14 ? 1 - Math.abs(p / 0.14 - 0.5) * 2 : 0; }

/** Expressive face. mood: happy|grin|determined|wow|hacker */
function drawFace(ctx, x, y, s, o = {}) {
  const mood = o.mood || 'happy', t = performance.now() / 1000;
  const blink = o.blink !== undefined ? o.blink : blinkAt(t, o.blinkOff || 0);
  const ex = s * 0.21, ey = -s * 0.1, eW = s * 0.2, eH = s * 0.22 * (1 - blink * 0.85);
  const ink = '#0a0a12';
  ctx.save(); ctx.translate(x, y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (mood === 'hacker') {
    const p = s * 0.065, col = o.eyeCol || '#4dff88';
    drawGlow(ctx, -ex, ey, s * 0.32, col, 0.5); drawGlow(ctx, ex, ey, s * 0.32, col, 0.5);
    const open = 1 - blink;
    for (const sx of [-1, 1]) {
      const cx = sx * ex;
      ctx.fillStyle = col;
      ctx.fillRect(cx - p * 1.5, ey, p * 3, p);
      if (open > 0.3) { ctx.fillRect(cx - p * 1.5, ey - p, p * 3, p); ctx.fillRect(cx + (sx > 0 ? -p * 1.5 : 0), ey - p * 2, p * 1.5, p); }
      ctx.fillStyle = shade(col, 0.65); ctx.fillRect(cx + (sx > 0 ? -p * 1.2 : p * 0.2), ey + p * 0.2, p, p * 0.6);
    }
    const mw = s * 0.38, mh = s * 0.09, my = s * 0.19;
    ctx.fillStyle = '#04150a'; ctx.fillRect(-mw / 2, my, mw, mh * 1.9);
    ctx.fillStyle = col; const n = Math.max(3, Math.round(mw / (p * 1.3)));
    for (let i = 0; i < n; i++) ctx.fillRect(-mw / 2 + i * (mw / n) + 1, my + (i % 2 ? mh * 0.8 : 0), mw / n - 2, mh);
    ctx.restore(); return;
  }
  const brows = (angle, lift = 0) => {
    ctx.fillStyle = ink;
    for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * ex, ey - eH / 2 - s * 0.1 - lift); ctx.rotate(sx * angle); ctx.fillRect(-eW * 0.7, -s * 0.045, eW * 1.4, s * 0.09); ctx.restore(); }
  };
  const eyeCol = o.eyeCol || '#fff';
  for (const sx of [-1, 1]) {
    const cx = sx * ex, cy = ey;
    if (mood === 'grin') {
      ctx.strokeStyle = ink; ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.arc(cx, cy + eW * 0.25, eW * 0.55, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); continue;
    }
    const hh = Math.max(1.5, eH);
    ctx.fillStyle = eyeCol; ctx.fillRect(cx - eW / 2, cy - hh / 2, eW, hh);
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.2, s * 0.03); ctx.strokeRect(cx - eW / 2, cy - hh / 2, eW, hh);
    if (eH > s * 0.06) {
      const ps = eW * 0.5, ph = Math.min(eH * 0.8, ps), px = cx - ps / 2 + (o.lookX || 0) * eW * 0.22, py = cy - ph / 2;
      ctx.fillStyle = ink; ctx.fillRect(px, py, ps, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(px + ps * 0.55, py + ph * 0.12, ps * 0.3, ph * 0.3);
    }
  }
  if (mood === 'determined') brows(0.35);
  if (mood === 'wow') brows(0, s * 0.08);
  if (mood === 'happy') { ctx.strokeStyle = ink; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.arc(0, s * 0.12, s * 0.17, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  else if (mood === 'grin') {
    const mw = s * 0.48, mh = s * 0.26, my = s * 0.14;
    ctx.fillStyle = '#5a0f1e'; ctx.strokeStyle = ink; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(-mw / 2, my); ctx.lineTo(mw / 2, my); ctx.quadraticCurveTo(mw / 2, my + mh * 1.35, 0, my + mh); ctx.quadraticCurveTo(-mw / 2, my + mh * 1.35, -mw / 2, my); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-mw / 2 + s * 0.03, my + s * 0.015, mw - s * 0.06, mh * 0.3);
    ctx.fillStyle = '#ff5a7a'; ctx.beginPath(); ctx.ellipse(0, my + mh * 0.78, mw * 0.24, mh * 0.2, 0, 0, TAU); ctx.fill();
  }
  else if (mood === 'determined') {
    const mw = s * 0.34, mh = s * 0.2, my = s * 0.14;
    ctx.fillStyle = '#5a0f1e'; ctx.strokeStyle = ink; ctx.lineWidth = s * 0.05;
    roundRectPath(ctx, -mw / 2, my, mw, mh, s * 0.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-mw / 2 + s * 0.03, my + s * 0.02, mw - s * 0.06, mh * 0.34);
  }
  else if (mood === 'wow') { ctx.fillStyle = '#5a0f1e'; ctx.strokeStyle = ink; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.ellipse(0, s * 0.24, s * 0.12, s * 0.14, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

function drawSheriffStar(ctx, x, y, r, col = '#f2b632') {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) { const rr = i % 2 === 0 ? r : r * 0.55, a = -Math.PI / 2 + i * Math.PI / 6; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.lineJoin = 'round'; ctx.strokeStyle = COLORS.outline; ctx.stroke();
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, r * 0.16, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fillStyle = shade(col, -0.35); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawCowboyHat(ctx, x, y, s) {
  const w = s * 1.7, hy = y - s / 2 - s * 0.02, brown = '#7b4423', dark = '#4a2612', light = '#9a5a30';
  ctx.save(); ctx.translate(x, hy); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2.5, s * 0.08); ctx.strokeStyle = COLORS.outline;
  ctx.fillStyle = brown;
  ctx.beginPath(); ctx.moveTo(-w / 2, -s * 0.16);
  ctx.quadraticCurveTo(-w / 2 + w * 0.05, s * 0.16, -w * 0.22, s * 0.12); ctx.lineTo(w * 0.22, s * 0.12);
  ctx.quadraticCurveTo(w / 2 - w * 0.05, s * 0.16, w / 2, -s * 0.16);
  ctx.quadraticCurveTo(w * 0.36, s * 0.02, 0, 0); ctx.quadraticCurveTo(-w * 0.36, s * 0.02, -w / 2, -s * 0.16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(-w * 0.44, -s * 0.12); ctx.quadraticCurveTo(0, -s * 0.06, w * 0.44, -s * 0.12); ctx.quadraticCurveTo(0, 0, -w * 0.44, -s * 0.12); ctx.fill();
  ctx.fillStyle = brown;
  ctx.beginPath(); ctx.moveTo(-w * 0.27, s * 0.02); ctx.lineTo(-w * 0.25, -s * 0.5);
  ctx.quadraticCurveTo(-w * 0.14, -s * 0.72, -w * 0.02, -s * 0.5); ctx.quadraticCurveTo(w * 0.02, -s * 0.44, w * 0.06, -s * 0.52);
  ctx.quadraticCurveTo(w * 0.16, -s * 0.72, w * 0.25, -s * 0.5); ctx.lineTo(w * 0.27, s * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(-w * 0.2, -s * 0.46); ctx.quadraticCurveTo(-w * 0.14, -s * 0.62, -w * 0.05, -s * 0.5); ctx.lineTo(-w * 0.1, -s * 0.2); ctx.lineTo(-w * 0.2, -s * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark; ctx.fillRect(-w * 0.27, -s * 0.16, w * 0.54, s * 0.14); ctx.strokeRect(-w * 0.27, -s * 0.16, w * 0.54, s * 0.14);
  drawSheriffStar(ctx, 0, -s * 0.09, s * 0.12, '#ffd21f');
  ctx.restore();
}

function drawHood(ctx, s, col = '#17251c', binaryCol = '#4dff88') {
  const h = s / 2, d = s * 0.22;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, s * 0.08); ctx.strokeStyle = '#05080a';
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-h * 1.12, h * 0.55); ctx.quadraticCurveTo(-h * 1.4, -h * 1.05, -h * 0.08, -h * 1.52); ctx.lineTo(h * 0.12, -h * 1.5); ctx.quadraticCurveTo(h * 1.6 + d, -h * 1.05, h * 1.12 + d * 0.6, h * 0.55 - d * 0.6);
  ctx.lineTo(h * 1.05, h * 0.75); ctx.quadraticCurveTo(h * 0.9, -h * 0.85, 0, -h * 0.82); ctx.quadraticCurveTo(-h * 0.9, -h * 0.85, -h * 0.9, h * 0.75); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = s * 0.05;
  ctx.beginPath(); ctx.moveTo(-h * 0.9, h * 0.6); ctx.quadraticCurveTo(-h * 0.9, -h * 0.85, 0, -h * 0.82); ctx.quadraticCurveTo(h * 0.9, -h * 0.85, h * 0.9, h * 0.6); ctx.stroke();
  ctx.fillStyle = rgba(binaryCol, 0.75); ctx.font = font(s * 0.13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(-h * 1.02, -h * 0.1); ctx.rotate(-1.35); ctx.fillText('0101', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(h * 1.05 + d * 0.3, -h * 0.35); ctx.rotate(1.3); ctx.fillText('1010', 0, 0); ctx.restore();
  ctx.restore();
}

function drawCrystal(ctx, x, y, w, h, col, rot = 0, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1.5, w * 0.12); ctx.lineJoin = 'round'; ctx.strokeStyle = COLORS.outline;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, 0); ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = shade(col, 0.55);
  ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(-w / 2, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, -0.35);
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(0, h / 2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function chunkyText(ctx, text, x, y, size, col, o = {}) {
  ctx.save();
  ctx.font = font(size); ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.baseline || 'middle';
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = size * 0.6; }
  ctx.lineJoin = 'round';
  ctx.lineWidth = o.lw || Math.max(3, size * 0.22);
  ctx.strokeStyle = o.outline || '#000';
  ctx.strokeText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function nameTag(ctx, text, x, y, color, size = 10) {
  ctx.save(); ctx.font = font(size);
  const w = ctx.measureText(text).width + size * 1.4, h = size * 1.7;
  ctx.fillStyle = 'rgba(8,8,20,0.9)'; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  ctx.restore();
}

// ============================================================================
// 3. DATA — the posse, the ridiculous upgrades, the achievements
// ============================================================================
const BUILDINGS = [
  { id: 'noob',     name: 'Noob With A Spoon',          cost: 15,      cps: 0.1,   col: '#9aa7b8',
    flavor: 'Digs the arena floor with a plastic spoon. Wave 1 energy. Believes in himself.' },
  { id: 'autoclick', name: 'Auto-Clicker 3000',         cost: 60,      clickRate: 0.4, col: '#7fd4ff',
    flavor: 'A tiny robot finger that clicks the crystal for you. It never sleeps. It never asks why. Each one clicks with YOUR click power.' },
  { id: 'hacker',   name: 'Reformed Hacker',            cost: 100,     cps: 1,     col: '#4dff88',
    flavor: 'Sentenced to 10,000 hours of community mining. The hoodie stays on. The L stays too.' },
  { id: 'holle',    name: "hollebunbun's Carrot Drill", cost: 1100,    cps: 10,     col: '#ff9ad5',
    flavor: 'A bunny, a carrot, 4000 RPM. Purple bolts optional, ear protection mandatory.' },
  { id: 'superted', name: "superted9's Turret",         cost: 12000,   cps: 70,    col: '#9a5f2e',
    flavor: 'It levels up every wave, so now it shoots the floor until crystals surrender. They always surrender.' },
  { id: 'clickfarm', name: 'Click Farm',                cost: 45000,   clickRate: 10, col: '#4dff88',
    flavor: 'A barn with 200 phones in tiny hats, all tapping the crystal remotely. The rooster taps too. 10 clicks/sec of YOUR click power.' },
  { id: 'kaieke',   name: "kaieke20's Disco Raid",      cost: 130000,  cps: 420,   col: '#3b8bff',
    flavor: 'Pink strobe bolts make crystals grow 200% faster. Source: kaieke20, officer of the law.' },
  { id: 'shotgun',  name: 'Shard Shotgun Geyser',       cost: 1.4e6,   cps: 2600,  col: '#19e6ff',
    flavor: 'Point at ground. Pump twice. Enjoy the crystal weather. Hats are mandatory in this area.' },
  { id: 'laser',    name: 'Crystal Laser Drill',        cost: 20e6,    cps: 12000,  col: '#ff2bd6',
    flavor: 'A continuous beam that slows everything in a line — including your electricity bill.' },
  { id: 'spam',     name: 'Spam Packet Recycler',       cost: 330e6,   cps: 90000, col: '#2ec4b6',
    flavor: 'Turns hacker spam into crystals. Please stop asking how. Legal has asked you to stop asking how.' },
  { id: 'cursorfab', name: 'Cursor Factory',            cost: 700e6,   clickRate: 100, col: '#ffd21f',
    flavor: 'Mass-produces white pointing gloves that click the crystal until it pays up. 100 clicks/sec of YOUR click power, per factory.' },
  { id: 'virus',    name: 'Virus Splitter Farm',        cost: 5.1e9,   cps: 700000, col: '#4dff88',
    flavor: 'Every virus splits into two viruses. Every profit splits into two profits. That is just math.' },
  { id: 'elite',    name: 'Elite Protection Racket',    cost: 75e9,    cps: 5e6, col: '#ffd21f',
    flavor: 'Gold-trimmed hackers guard your crystals behind regenerating hex shields. Very legal, very cool.' },
  { id: 'firewall', name: 'FIREWALL Furnace',           cost: 1e12,    cps: 40e6,  col: '#ff3355',
    flavor: 'The wave-10 boss bakes artisan crystals now. Slow, red, very tough. Career change of the year.' },
  { id: 'glitch',   name: 'GLITCH Duplicator',          cost: 14e12,   cps: 300e6,  col: '#19e6ff',
    flavor: 'Duplicates crystals, teleports, and occasionally swaps places with your wallet. Perfectly legal. Probably.' },
  { id: 'trojan',   name: 'TROJAN Gift Shop',           cost: 170e12,  cps: 2.2e9, col: '#a052ff',
    flavor: 'SURPRISE! Every gift box has crystals inside. Do NOT open the other gifts. Seriously. Do not.' },
  { id: 'botnet',   name: 'BOTNET Mining Rig',          cost: 2.1e15,  cps: 16e9, col: '#3b8bff',
    flavor: 'One million hacked toasters mining in parallel. They only ever say WE. WE MINE.' },
  { id: 'tower',    name: 'The 99999m Tower',           cost: 26e15,   cps: 120e9,  col: '#7df9ff',
    flavor: 'The tower mines itself. It was the crystals all along. Wait — what were we defending?' },
  { id: 'moon',     name: 'Crystal Moon Drill',         cost: 400e15,  cps: 1e12, col: '#d8dee8',
    flavor: 'Turns out the moon was one big crystal the whole time. Drill politely. Wave at it every night.' },
  { id: 'nebula',   name: 'Shard Nebula Harvester',     cost: 6.5e18,  cps: 10e12, col: '#a052ff',
    flavor: 'Scoops whole nebulas like ice cream. A SEPTILLION sprinkles per scoop, give or take.' },
  { id: 'cubeverse', name: 'The Cube-Verse Portal',     cost: 100e21,  cps: 150e15, col: '#ff2bd6',
    flavor: 'Imports crystals from universes where everything is already cubes. (That is all of them.)' },
];
const BLD = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

/* Five hand-crafted ×2 tiers per posse member. Unlock at 5/15/35/75/150 owned. */
const TIER_NEED = [5, 15, 35, 75, 150];
const TIER_COST = [25, 450, 8000, 150000, 3e6];   // × building base cost — frequent doublings keep numbers exploding
const BLD_UPGRADES = {
  noob: [
    ['Titanium Sporks', 'Spoon technology has peaked. The noobs weep with joy.'],
    ['Noob Motivation Seminar', 'The seminar is just the L dance performed for six hours. Attendance doubles output.'],
    ['Two Spoons Technique', 'Revolutionary. One spoon per hand. Nobody had thought of it. NOBODY.'],
    ['Spoon University', 'A four-year degree in applied spoon theory. Student loans payable in crystals.'],
    ['The Legendary Ladle', 'Prophecy spoke of a bigger spoon. The prophecy was true. It was true all along.'],
  ],
  hacker: [
    ['Ergonomic Hoodies', 'Lumbar support for lumbar crimes. Reformed backs mine twice as hard.'],
    ['ACCESS GRANTED Keycards', 'They held the green card and cried for a week. Output doubled.'],
    ['Mechanical Keyboards For Mining', 'The clacking intimidates the crystals straight out of the ground.'],
    ['Dark Mode Pickaxes', 'Easier on the eyes. Much, much harder on the crystals.'],
    ['Rehacktilitation Complete', 'They hack the planet now. Turns out the planet is full of crystals.'],
  ],
  holle: [
    ['Carrot 2.0', 'Now with a second carrot. The drill industry is shaking.'],
    ['Lucky Bunny Feet (Still Attached)', 'All four, still on the bunny, as nature intended. Luck doubled.'],
    ['Binky-Powered Drilling', 'The happy jumps now count as mining strokes. Every jump, a payday.'],
    ['4000 More RPM', 'The drill is now audible from the moon. The moon has filed a noise complaint.'],
    ['The Mega Carrot', 'Grown in secret. Feared by all. Reportedly delicious.'],
  ],
  superted: [
    ['Turret Level Up', 'DING! superted9 refuses to explain where the experience points come from.'],
    ['The Right To Bear Arms, Twice', 'Two bear arms. On a teddy. Holding a turret. Nothing about this is okay, and yet it works.'],
    ['Picnic Break Overclock', 'Turns out turrets shoot twice as fast after sandwiches. Who knew.'],
    ['Premium Stuffing', 'Aerospace-grade fluff. The turret purrs now. Turrets should not purr.'],
    ['superted99999', 'He changed his username. His power level followed immediately.'],
  ],
  kaieke: [
    ['Bigger Disco Ball', 'Regulation states the disco ball must be visible from space. It now is.'],
    ['Pinker Bolts', 'Scientists confirm: pinker = stronger. The paper was peer-reviewed by kaieke20.'],
    ['Siren Lights (Pink)', 'WEE-WOO, but fabulous. Crystals are turning themselves in.'],
    ['Backup Dancers', 'Twelve police cubes in perfect formation. The raid is now a residency.'],
    ['Disco Never Dies', 'It was never alive. It simply cannot be stopped.'],
  ],
  shotgun: [
    ['Wide Spread MK.II', 'The spread is now wider than the arena. Neighbouring arenas report crystal rain.'],
    ['Fast Pump Forever', 'Pump speed no longer limited by physics. Physics has filed a complaint.'],
    ['Eight Barrels', 'The gun is now mostly barrels. The barrels are mostly gun.'],
    ['Crystal Buckshot', 'Shooting crystals at the ground makes more crystals. Do NOT tell the economists.'],
    ['The Geyser Becomes Weather', 'Local forecast: shards, heavy at times, glorious by evening.'],
  ],
  laser: [
    ['Wide Beam', 'The beam is now also a wall. Walls are lasers now. Keep up.'],
    ['Chain Beam Overdrive', 'The beam bounces to a second crystal, then a third, then directly to profit.'],
    ['A Second Laser (For The Other Hand)', 'Safety training sold separately. Nobody bought it.'],
    ['Prism Split', 'One beam in, seven rainbows of productivity out.'],
    ['The Laser Learns To Love', 'It mines gently now. Yields doubled. Nobody can explain it.'],
  ],
  spam: [
    ['Bigger Satellite Dish', 'It now receives spam from other galaxies. They also say you have won a prize.'],
    ['Broken Unsubscribe Button', 'Nobody can unsubscribe, ever. Volume doubles quarterly.'],
    ['Forward To Ten Friends', 'The one chain letter in history that actually pays out.'],
    ['Heartfelt AI Spam', 'The packets write themselves now, and honestly? They are beautiful.'],
    ['Galactic Filter Bypass', 'Even the aliens cannot unsubscribe. Especially the aliens.'],
  ],
  virus: [
    ['Spikier Spikes', 'The spikes have spikes. HR has stopped visiting the farm.'],
    ['Quadruple Splitting', 'Viruses now split into two viruses that each split into two profits.'],
    ['Vitamin Injections', 'Healthy viruses split more. Yes, the farm hired a nutritionist.'],
    ['Free-Range Viruses', 'Cage-free, grass-fed, self-replicating. Farmers market approved.'],
    ['The Great Mitosis', 'One virus became one billion overnight. It sent a lovely postcard.'],
  ],
  elite: [
    ['Shinier Gold Trim', 'The trim is now 24-karat. The elites refuse to touch dirt without gloves.'],
    ['Hexier Hex Shields', 'The hexagons have been upgraded to sexier, hexier hexagons.'],
    ['Protection Insurance Insurance', 'Insures the protection racket against rival protection rackets.'],
    ['Velvet Ropes', 'The crystals feel exclusive now. Exclusive crystals grow twice as fast.'],
    ['Diamond Trim', 'Gold was a phase. This is forever.'],
  ],
  firewall: [
    ['Extra Firewood', "It's a firewall. It runs on firewood. Do not think about it too hard."],
    ['Artisan Sourdough Crystals', 'FIREWALL started a bakery side hustle. The crystals are gluten-free.'],
    ['Wood-Fired Everything', 'The pizza oven was, in hindsight, inevitable.'],
    ['FIREWALL Merch Stand', 'Extremely hot merchandise. Literally too hot to hold.'],
    ['Eternal Flame Licence', 'City hall approved it. City hall is slightly singed.'],
  ],
  glitch: [
    ['Duplicate The Duplicator', 'There are two now. Or four. Counting them changes the answer.'],
    ['Teleport Profits Directly', 'GLITCH swaps places with your bank balance. Somehow this is good for you.'],
    ['Undo The Expenses', 'CTRL+Z on every bill. The accountants fainted with joy.'],
    ['Copy-Paste The Good Days', 'Every Friday is now four Fridays.'],
    ['GLITCH.EXE Has Stopped Making Sense', 'Production doubled anyway. Do not reboot it. DO NOT.'],
  ],
  trojan: [
    ['Bigger Gift Boxes', 'Big enough to fit a horse. Please do not put a horse in them again.'],
    ['Free Shipping', 'TROJAN delivers anywhere, instantly, no questions. Especially no questions.'],
    ['Gift Receipts', 'The surprises are returnable now. Strangely, none are ever returned.'],
    ['Subscription Boxes', 'A mystery every month. The mystery is always crystals. Phew.'],
    ['The Gift That Keeps On Gifting', 'Recursive wrapping paper. The unboxing video never ends.'],
  ],
  botnet: [
    ['Hack More Toasters', 'Every toaster on Earth now mines crystals and burns toast in solidarity.'],
    ['Assimilate The Fridges', 'WE ARE FRIDGE. WE KEEP THE CRYSTALS CRISP.'],
    ['Recruit The Smart Bulbs', 'WE ARE LIGHT. WE MINE SILENTLY AT 3AM.'],
    ['The Washing Machines Join', 'WE SPIN. THE CRYSTALS TUMBLE FORTH.'],
    ['Every Device, Everywhere', 'Your calculator has been mining this whole time. You are welcome.'],
  ],
  tower: [
    ['Another 1000 Meters', 'The tower grows. The tower hungers. The tower files planning permission.'],
    ['The Tower Learns To Dig', 'Turns out the tower goes down as well as up. Nobody ever checked.'],
    ['Tower Gym Membership', 'The tower does squats at dawn. Squats produce crystals. Science.'],
    ['A Second, Secret Tower', 'It was hiding behind the first tower the entire time.'],
    ['The Tower Dreams Of Crystals', 'And whatever the tower dreams becomes real.'],
  ],
  autoclick: [
    ['Faster Fingers', 'Firmware update. The robot fingers now drum impatiently between clicks.'],
    ['Double-Click License', 'Legally allowed to double-click. The paperwork took years.'],
    ['Tiny Robot Gloves', 'Grip improved 200%. Style improved 4,000%.'],
    ['Finger Motivation Posters', '"HANG IN THERE" but the cat is a cursor.'],
    ['The Million Finger March', 'All the fingers, clicking as one. The sound is felt in space.'],
  ],
  clickfarm: [
    ['Free-Range Phones', 'Happier phones tap harder. The barn got a skylight.'],
    ['A Second Rooster', 'Twice the morning taps. The roosters are rivals now. Production soars.'],
    ['Tap Dancing Lessons', 'The phones learned choreography. Every dance move is also a click.'],
    ['5G In The Barn', 'The G stands for GIGACLICK. All five of them.'],
    ['The Legendary Thumb', 'A mythical thumb visits the farm every dawn and taps each phone once.'],
  ],
  cursorfab: [
    ['Pointier Cursors', 'Sharper points click deeper. Deeper clicks find more crystals.'],
    ['Glove Polish', 'Shiny gloves intimidate the crystal into cooperating.'],
    ['Night Shift Cursors', 'They click while you sleep. They dream of clicking. It is all very efficient.'],
    ['Cursor University', 'Degrees in Advanced Pointing. Minor in Hovering.'],
    ['The First Cursor', 'Recovered from a museum. It still works. It is FURIOUS with energy.'],
  ],
  moon: [
    ['Longer Drill', 'It reaches the moon\'s chewy crystal centre.'],
    ['Moon Cheese Byproduct', 'Selling the cheese funds twice the drilling. The cheese is crystal-flavoured.'],
    ['Second Moon (Inflatable)', 'Nobody can tell the difference and it drills just as well.'],
    ['Full Moon Overtime', 'Every full moon, the drill howls and doubles its output.'],
    ['The Moon Joins The Posse', 'It always wanted to. Nobody had asked.'],
  ],
  nebula: [
    ['Bigger Scoop', 'Two nebulas per scoop. The universe pretends not to notice.'],
    ['Waffle Cone Storage', 'Crystals stay fresher in a cone. This is space law.'],
    ['Sprinkle Magnetism', 'The sprinkles were crystals all along. EVERYTHING is crystals all along.'],
    ['Galaxy-Sized Freezer', 'No more melted nebulas. Yields double, permanently chilly.'],
    ['The Infinite Sundae', 'It never ends. It never ends. IT NEVER ENDS.'],
  ],
  cubeverse: [
    ['Wider Portal', 'Two universes at once can fit through. They queue politely.'],
    ['Import Tax Exemption', 'The Cube-Verse signed a treaty. With itself. Both copies.'],
    ['Portal Loyalty Card', 'Every tenth universe delivers free.'],
    ['Recursive Portals', 'A portal inside a portal inside a — production doubled, please stop looking at it.'],
    ['ALL The Universes', 'Every cube in every cosmos now mines for the sheriff. YEEHAW × infinity.'],
  ],
};

function buildUpgrades() {
  const ups = [];
  // per-building tiers (5 each: 15 buildings × 5 = 75 upgrades)
  for (const b of BUILDINGS) {
    BLD_UPGRADES[b.id].forEach(([name, flavor], i) => {
      const need = TIER_NEED[i];
      ups.push({
        id: b.id + (i + 1), name, flavor, cost: b.cost * TIER_COST[i],
        type: 'bld', bld: b.id, mult: 2, unlock: s => s.bld[b.id] >= need, icon: b.id,
      });
    });
  }
  // click power (×2 each — a long, steep ladder)
  const clicks = [
    ['Padded Glove', 100, 'Clicking the mega crystal no longer hurts. Morale and click power double.'],
    ['Golden Spoon', 1200, 'Borrowed noob technology, but gold. The noobs want it back.'],
    ['Tin Star Knuckles', 15e3, 'Punch the law directly INTO the crystal.'],
    ['Crystal Pickaxe', 180e3, 'Mining a crystal with a crystal. The economy is fine. Everything is fine.'],
    ['Twelve-Gallon Hat', 2.2e6, 'Two extra gallons of pure authority. The crystal respects the hat.'],
    ['Spidey Reflexes', 26e6, 'spideybidey4 finally reads his own username. Everything changes.'],
    ['L-Dance Warm-Up', 320e6, 'Perform the forbidden L dance before every click. The crystal is intimidated.'],
    ['ACCESS GRANTED Stamp', 4e9, 'Skip the paperwork. The crystal simply gives up its contents.'],
    ['Quantum Trigger Finger', 50e9, 'Your clicks now also happen in universes where you clicked harder.'],
    ["The Sheriff's Sheriff", 600e9, 'You deputise your own clicking hand. It gets a tiny hat.'],
    ['Click Singularity', 7.4e12, 'Each click briefly becomes the only event in the universe.'],
    ['Both Hands, Deputy', 90e12, 'The academy said it could not be done. The academy was wrong.'],
    ['The Click Heard Round The Frontier', 1.1e15, 'Echoes for days. Each echo also mines.'],
    ['Finger Of Legend', 13e18, 'The 99999m tower flinches, respectfully, every time.'],
    ['Cosmic Pointer', 150e18, 'Your finger is visible from the moon drill. The moon drill points back.'],
    ['The Finger That Moves Worlds', 1.8e21, 'Planets politely roll out of the way.'],
    ['Click Of Infinity', 22e24, 'One click. Every crystal, everywhere, briefly says "ow".'],
  ];
  clicks.forEach(([name, cost, flavor], i) => ups.push({
    id: 'click' + i, name, flavor, cost, type: 'click', mult: 2,
    unlock: s => s.lifetimeRun >= cost / 5, icon: 'click',
  }));
  // crit clicks: chance for a ×10 YEEHAW click
  ups.push({ id: 'crit1', name: 'Deadeye Badge', flavor: 'Sometimes a click lands PERFECTLY. 3% chance of a ×10 YEEHAW crit.', cost: 250e3, type: 'crit', pct: 0.03, unlock: s => s.clicks >= 400, icon: 'click' });
  ups.push({ id: 'crit2', name: 'Hollow-Point Clicks', flavor: 'Banned in three counties. Crit chance +3%.', cost: 250e6, type: 'crit', pct: 0.03, unlock: s => s.crits >= 25, icon: 'click' });
  ups.push({ id: 'crit3', name: 'YEEHAW Protocol', flavor: 'The yeehaw is now mandatory and automated. Crit chance +4%.', cost: 250e9, type: 'crit', pct: 0.04, unlock: s => s.crits >= 250, icon: 'click' });
  // synergy: clicks gain % of CPS
  ups.push({ id: 'syn1', name: 'Deputy Fist Bump', flavor: 'The posse fist-bumps every click. Clicks gain +1% of your /sec.', cost: 50e3, type: 'syn', pct: 0.01, unlock: s => totalBuildings(s) >= 15, icon: 'syn' });
  ups.push({ id: 'syn2', name: 'Posse Power', flavor: 'The posse now high-fives in formation. Clicks gain another +4% of your /sec.', cost: 60e6, type: 'syn', pct: 0.04, unlock: s => totalBuildings(s) >= 60, icon: 'syn' });
  ups.push({ id: 'syn3', name: 'One Big Weird Family', flavor: 'Group hug (bosses included, FIREWALL is warm). Clicks gain another +5% of your /sec.', cost: 70e9, type: 'syn', pct: 0.05, unlock: s => totalBuildings(s) >= 150, icon: 'syn' });
  ups.push({ id: 'syn4', name: 'The Whole Frontier Claps', flavor: 'Every cube claps on every click. Clicks gain another +10% of your /sec.', cost: 80e12, type: 'syn', pct: 0.10, unlock: s => totalBuildings(s) >= 300, icon: 'syn' });
  // global ×2
  const globals = [
    ['Crystal Coffee', 8e6, 'The whole posse switches to triple-shot crystal espresso. EVERYTHING is ×2 and slightly vibrating.'],
    ['The L Dance (Extended Cut)', 9e9, 'Six more verses were discovered. Production doubles out of respect.'],
    ['Municipal Crystal Subsidy', 10e12, 'The mayor is a cube. The budget is crystals. The subsidy is everything ×2.'],
    ['99999 Energy Drink', 11e15, 'Legally distinct from other energy drinks. Side effects include double production and glowing.'],
    ['Crystal Broadcast', 12e18, 'The tower broadcasts mining tips at dawn. Attendance is mandatory. Results are spectacular.'],
    ['The Cube Awakens', 13e21, 'It was cubes all along. Everything ×2, forever, in every direction.'],
    ['Tower FM Megamix', 14e24, 'All bangers, no ads. Crystals grow to the beat. Everything ×2.'],
    ['The Second Cube Awakens', 15e27, 'There was a SECOND cube?! Everything ×2 again. Nobody is even surprised anymore.'],
  ];
  globals.forEach(([name, cost, flavor], i) => ups.push({
    id: 'glob' + i, name, flavor, cost, type: 'global', mult: 2,
    unlock: s => s.lifetimeRun >= cost / 10, icon: 'glob',
  }));
  // specials
  ups.push({ id: 'horseshoe', name: 'Lucky Horseshoe Magnet', flavor: 'Golden spam packets are drawn to the horseshoe. 25% more of them find you.', cost: 77.7e6, type: 'goldFreq', unlock: s => s.goldenClicks >= 7, icon: 'gold' });
  ups.push({ id: 'horseshoe2', name: 'Solid Gold Horseshoe', flavor: 'It is mostly ornamental. The spam packets do not know that. Another +25%.', cost: 777e9, type: 'goldFreq', unlock: s => s.goldenClicks >= 30, icon: 'gold' });
  ups.push({ id: 'wanted', name: 'WANTED Posters', flavor: 'Posters everywhere. Hacker bounties pay double. The hackers signed a few posters.', cost: 5e6, type: 'bounty2', unlock: s => s.bounties >= 5, icon: 'bounty' });
  ups.push({ id: 'wanted2', name: 'DEAD OR ALIVE OR CLICKED', flavor: 'The third option proved wildly popular. Bounties pay double again.', cost: 5e12, type: 'bounty2', unlock: s => s.bounties >= 30, icon: 'bounty' });
  ups.push({ id: 'insurance', name: 'Crystal Insurance', flavor: 'While you are away, the posse is contractually obliged to try harder. Offline earnings: 90% for up to 14 hours.', cost: 2e9, type: 'offline', unlock: s => s.lifetimeTotal >= 100e6, icon: 'glob' });
  ups.push({ id: 'amnesty', name: 'Boss Amnesty Program', flavor: 'FIREWALL, GLITCH, TROJAN and BOTNET are pardoned and unionise. Boss buildings ×2.', cost: 2e13, type: 'bosses', unlock: s => s.bld.firewall >= 1 && s.bld.glitch >= 1 && s.bld.trojan >= 1 && s.bld.botnet >= 1, icon: 'firewall' });
  // auto-clicker army boosters (all clickRate buildings ×2)
  ups.push({ id: 'robo1', name: 'Robo-Finger Caffeine Drip', flavor: 'Tiny espressos for tiny fingers. All auto-clickers, click farms and cursor factories ×2.', cost: 2e6, type: 'autox2', unlock: s => s.bld.autoclick + s.bld.clickfarm + s.bld.cursorfab >= 10, icon: 'autoclick' });
  ups.push({ id: 'robo2', name: 'Overclocked Overclickers', flavor: 'The clicks now arrive slightly before you buy the upgrade. All auto-click buildings ×2 again.', cost: 3e12, type: 'autox2', unlock: s => s.bld.autoclick + s.bld.clickfarm + s.bld.cursorfab >= 60, icon: 'autoclick' });
  return ups.sort((a, b) => a.cost - b.cost);
}

const SKINS = [
  { id: 'sheriff',  name: 'spideybidey4',  need: 0,     needStars: 0, desc: 'The yellow sheriff cube himself.' },
  { id: 'kaieke',   name: 'kaieke20',      need: 1e6,   needStars: 0, desc: 'Police cube, pink bolts. Unlocked at 1M crystals (all time).' },
  { id: 'superted', name: 'superted9',     need: 100e6, needStars: 0, desc: 'Teddy bear with a turret. Unlocked at 100M crystals (all time).' },
  { id: 'holle',    name: 'hollebunbun',   need: 10e9,  needStars: 0, desc: 'Bunny of the law. Unlocked at 10B crystals (all time).' },
  { id: 'hacker',   name: 'reformed hacker', need: 1e12, needStars: 0, desc: 'He mines for us now. Unlocked at 1T crystals (all time).' },
  { id: 'golden',   name: 'GOLDEN SHERIFF', need: 0,    needStars: 1, desc: 'Raise the tower once to shine forever.' },
];

const ACHIEVEMENTS = [
  { id: 'c1',   ico: '👆', name: 'Deputised',            desc: 'Click the mega crystal.',                    test: s => s.clicks >= 1 },
  { id: 'c2',   ico: '🔫', name: 'Trigger Finger',       desc: 'Click 100 times.',                           test: s => s.clicks >= 100 },
  { id: 'c3',   ico: '🖱️', name: 'Carpal Sheriff',       desc: 'Click 1,000 times.',                         test: s => s.clicks >= 1000 },
  { id: 'c4',   ico: '⚡', name: 'The Clicking',          desc: 'Click 10,000 times. See a doctor. A cube doctor.', test: s => s.clicks >= 10000 },
  { id: 'm1',   ico: '💎', name: 'Shiny',                desc: 'Mine 1,000 crystals (all time).',            test: s => s.lifetimeTotal >= 1e3 },
  { id: 'm2',   ico: '💰', name: 'Crystal Baron',        desc: 'Mine 1 million crystals (all time).',        test: s => s.lifetimeTotal >= 1e6 },
  { id: 'm3',   ico: '🏦', name: 'Crystal Cartel (Legal)', desc: 'Mine 1 billion crystals (all time).',      test: s => s.lifetimeTotal >= 1e9 },
  { id: 'm4',   ico: '👑', name: 'Trillionaire Sheriff', desc: 'Mine 1 trillion crystals (all time).',       test: s => s.lifetimeTotal >= 1e12 },
  { id: 'm5',   ico: '🌌', name: 'Economy? Broken.',     desc: 'Mine 1 quadrillion crystals (all time).',    test: s => s.lifetimeTotal >= 1e15 },
  { id: 'r1',   ico: '🐢', name: 'Ticking Over',         desc: 'Reach 10 crystals per second.',              test: (s, g) => g.cps >= 10 },
  { id: 'r2',   ico: '🚂', name: 'Crystal Express',      desc: 'Reach 1,000 crystals per second.',           test: (s, g) => g.cps >= 1000 },
  { id: 'r3',   ico: '🚀', name: 'To The Tower',         desc: 'Reach 1 million crystals per second.',       test: (s, g) => g.cps >= 1e6 },
  { id: 'r4',   ico: '🛸', name: 'Post-Scarcity Cube',   desc: 'Reach 1 billion crystals per second.',       test: (s, g) => g.cps >= 1e9 },
  { id: 'b1',   ico: '🥄', name: 'Spoon Squad',          desc: 'Hire your first Noob With A Spoon.',         test: s => s.bld.noob >= 1 },
  { id: 'b2',   ico: '🥄', name: 'Spoon Army',           desc: 'Command 50 Noobs With Spoons.',              test: s => s.bld.noob >= 50 },
  { id: 'b3',   ico: '🤠', name: 'Full Posse',           desc: 'Own at least one of every building.',        test: s => BUILDINGS.every(b => s.bld[b.id] >= 1) },
  { id: 'b4',   ico: '🏘️', name: 'Boomtown',             desc: 'Own 100 buildings in total.',                test: s => totalBuildings(s) >= 100 },
  { id: 'b5',   ico: '🗼', name: 'It Mines Itself',      desc: 'Buy The 99999m Tower.',                      test: s => s.bld.tower >= 1 },
  { id: 'g1',   ico: '📨', name: "You've Got Mail",      desc: 'Catch a golden spam packet.',                test: s => s.goldenClicks >= 1 },
  { id: 'g2',   ico: '📬', name: 'Spam Folder Hero',     desc: 'Catch 25 golden spam packets.',              test: s => s.goldenClicks >= 25 },
  { id: 'h1',   ico: '🚨', name: 'WANTED: Clicked',      desc: 'Collar a bounty hacker.',                    test: s => s.bounties >= 1 },
  { id: 'h2',   ico: '⭐', name: 'Bounty Sheriff',       desc: 'Collar 25 bounty hackers.',                  test: s => s.bounties >= 25 },
  { id: 'p1',   ico: '🗼', name: 'Tower Raiser',         desc: 'Earn your first Sheriff Star.',              test: s => s.stars >= 1 },
  { id: 'p2',   ico: '🌃', name: 'Skyline Sheriff',      desc: 'Earn 10 Sheriff Stars.',                     test: s => s.stars >= 10 },
  { id: 'p3',   ico: '🏔️', name: '99999M CLUB',          desc: 'Earn 99 Sheriff Stars. The legend is real.', test: s => s.stars >= 99 },
  { id: 's1',   ico: '👗', name: 'Fashion Week',         desc: 'Unlock every skin.',                         test: s => SKINS.every(k => skinUnlocked(k, s)) },
  { id: 't1',   ico: '⏰', name: 'Overtime',             desc: 'Play for one hour (all time).',              test: s => s.playTime >= 3600 },
  { id: 't2',   ico: '🛌', name: 'The Crystals Never Sleep', desc: 'Collect offline earnings.',              test: s => s.offlineCollected >= 1 },
  { id: 'x1',   ico: '🤠', name: 'YEEHAW',               desc: 'Land a critical click.',                     test: s => s.crits >= 1 },
  { id: 'x2',   ico: '🎯', name: 'Deadeye Deputy',       desc: 'Land 500 critical clicks.',                  test: s => s.crits >= 500 },
  { id: 'c5',   ico: '🌪️', name: 'Ascended Finger',      desc: 'Click 100,000 times. The finger has transcended.', test: s => s.clicks >= 100000 },
  { id: 'm6',   ico: '🫠', name: 'Numbers Stopped Meaning Things', desc: 'Mine 1 quintillion crystals (all time).', test: s => s.lifetimeTotal >= 1e18 },
  { id: 'r5',   ico: '🕳️', name: 'Crystal Singularity',  desc: 'Reach 1 trillion crystals per second.',      test: (s, g) => g.cps >= 1e12 },
  { id: 'b6',   ico: '🌆', name: 'Metropolis, But Cubes', desc: 'Own 300 buildings in total.',               test: s => totalBuildings(s) >= 300 },
  { id: 'u1',   ico: '🛒', name: 'Fully Loaded',         desc: 'Own 50 upgrades.',                           test: s => Object.keys(s.ups).length >= 50 },
  { id: 'u2',   ico: '🧺', name: 'Shelf Cleared',        desc: 'Own 100 upgrades.',                          test: s => Object.keys(s.ups).length >= 100 },
  { id: 'g3',   ico: '💌', name: 'Chosen By The Mail',   desc: 'Catch 77 golden spam packets.',              test: s => s.goldenClicks >= 77 },
  { id: 'h3',   ico: '🚁', name: 'The Law Always Clicks Twice', desc: 'Collar 100 bounty hackers.',          test: s => s.bounties >= 100 },
  { id: 'p4',   ico: '✨', name: 'Constellation Sheriff', desc: 'Earn 25 Sheriff Stars.',                    test: s => s.stars >= 25 },
  { id: 't3',   ico: '🌙', name: 'Deputy Of The Month',  desc: 'Play for 24 hours (all time).',              test: s => s.playTime >= 86400 },
  { id: 'a1',   ico: '🤖', name: 'Look Ma, No Hands',    desc: 'Buy your first Auto-Clicker 3000.',          test: s => s.bld.autoclick >= 1 },
  { id: 'a2',   ico: '🐔', name: 'Old MacDonald Had A Click Farm', desc: 'Buy a Click Farm. E-I-E-I-CLICK.', test: s => s.bld.clickfarm >= 1 },
  { id: 'a3',   ico: '🏭', name: 'Means Of Clickduction', desc: 'Own 100 auto-clicking buildings.',          test: s => s.bld.autoclick + s.bld.clickfarm + s.bld.cursorfab >= 100 },
  { id: 'a4',   ico: '🦾', name: 'Robot Union',          desc: 'Robot fingers produce 1 million crystals per second.', test: (s, g) => (g.autoCps || 0) >= 1e6 },
  { id: 'k1',   ico: '🌙', name: 'Moon Landing',         desc: 'Buy the Crystal Moon Drill.',                test: s => s.bld.moon >= 1 },
  { id: 'k2',   ico: '🌀', name: 'Portal Authority',     desc: 'Open the Cube-Verse Portal.',                test: s => s.bld.cubeverse >= 1 },
  { id: 'w1',   ico: '6️⃣', name: 'QUINTILLION!',         desc: 'Say hi to 10^18 — a 1 with 18 zeros.',       test: s => s.lifetimeTotal >= 1e18 },
  { id: 'w2',   ico: '7️⃣', name: 'SEXTILLION!',          desc: '10^21. More crystals than grains of sand on Earth.', test: s => s.lifetimeTotal >= 1e21 },
  { id: 'w3',   ico: '8️⃣', name: 'SEPTILLION!',          desc: '10^24. About as many stars as the universe has.', test: s => s.lifetimeTotal >= 1e24 },
  { id: 'w4',   ico: '9️⃣', name: 'NONILLION?!',          desc: '10^30. The calculator app just quit.',       test: s => s.lifetimeTotal >= 1e30 },
  { id: 'w5',   ico: '🔟', name: 'DECILLION. THE BIG ONE.', desc: '10^33. Teacher will not believe you.',    test: s => s.lifetimeTotal >= 1e33 },
];

function totalBuildings(s) { return BUILDINGS.reduce((n, b) => n + s.bld[b.id], 0); }
function skinUnlocked(k, s) { return s.lifetimeTotal >= k.need && s.stars >= k.needStars; }

/* FRONTIER NEWS — the ticker. cond() gates state-aware quips; text can be a fn. */
const NEWS = [
  { t: 'FRONTIER NEWS: local sheriff clicks crystal. Crystal reportedly "fine with it".' },
  { t: 'BREAKING: tower slightly taller than yesterday. Experts baffled, thrilled.' },
  { t: 'WEATHER: 100% chance of neon. Bring a hat.' },
  { t: 'The hackers would like everyone to know they are "doing crime, but politely".' },
  { t: 'Crystal prices hit record high. Also record low. Cube economists shrug in unison.' },
  { t: 'Reminder from city hall: the L dance is legal again on weekends.' },
  { t: 'A golden spam packet was seen heading this way. Probably nothing. Definitely click it.' },
  { t: 'PSA: do not open TROJAN\'s other gifts. This has been a PSA.' },
  { t: 'Sponsored: 99999 Energy Drink. It is a number AND a beverage.' },
  { t: 'Rumour: the mega crystal purrs when nobody is watching.' },
  { t: 'ACCESS DENIED remains the most printed word on the frontier for the 9th year running.' },
  { t: 'Interview with the tower cancelled again. The tower "does not do press".' },
  { t: 'Lost: one plastic spoon, sentimental value. Reward: crystals.' },
  { t: 'Science corner: clicking things makes them yours. More research needed.' },
  { t: 'kaieke20 denies the disco raid is "just vibes". Presents 40-slide deck of vibes.' },
  { t: 'superted9\'s turret wins "Most Improved" for the 12th wave running.' },
  { t: 'hollebunbun refuses to comment on the carrot. The carrot also declined.' },
  { t: 'spideybidey4 named Sheriff of the Month by a committee of spideybidey4.' },
  { t: 'Tip: crystals mined while you sleep count double in your dreams. (In your dreams.)' },
  { t: 'The arena rail has been polished. Hackers report being "shoved with style".' },
  { cond: s => s.bld.noob >= 10, t: s => `The ${fmt(s.bld.noob)} noobs have formed a union. Their only demand: bigger spoons.` },
  { cond: s => s.bld.noob >= 100, t: 'Spoon shortage declared. Noobs remain optimistic, spoonful.' },
  { cond: s => s.bld.hacker >= 10, t: s => `${fmt(s.bld.hacker)} reformed hackers now mine for the law. Parole officer "very proud".` },
  { cond: s => s.bld.holle >= 10, t: 'Carrot drill decibel levels "no longer measurable in this dimension".' },
  { cond: s => s.bld.superted >= 10, t: 'Local turrets demand picnic breaks. Management folds instantly.' },
  { cond: s => s.bld.kaieke >= 10, t: 'Disco raid enters week two. Neighbours have joined rather than complained.' },
  { cond: s => s.bld.virus >= 10, t: 'Virus farm passes health inspection. Inspector now two inspectors.' },
  { cond: s => s.bld.firewall >= 1, t: 'FIREWALL\'s bakery gets a glowing review: "the bread is literally glowing".' },
  { cond: s => s.bld.glitch >= 1, t: 'GLITCH swapped places with the moon for 4 seconds on Tuesday. The moon says it was fun.' },
  { cond: s => s.bld.botnet >= 1, t: 'YOUR TOASTER SAYS: WE ARE FINE. EVERYTHING IS FINE. BUY MORE BREAD.' },
  { cond: s => s.bld.tower >= 1, t: 'The tower now mines itself. Philosophers ask: who defends the defender? The tower: "me".' },
  { cond: s => s.stars >= 1, t: s => `The badge now holds ${s.stars} star${s.stars > 1 ? 's' : ''}. It hums quietly at night.` },
  { cond: s => s.crits >= 1, t: 'Witnesses describe the sound as "yeehaw, but load-bearing".' },
  { cond: s => s.bounties >= 5, t: 'Bounty hackers now click THEMSELVES to save everyone time.' },
  { cond: s => s.goldenClicks >= 5, t: 'Postal service confirms: the golden packets are not a glitch. Please stop asking.' },
  { cond: s => s.lifetimeTotal >= 1e9, t: 'Billionaire sheriff still clicks own crystal, insists it "keeps him humble".' },
  { cond: s => s.lifetimeTotal >= 1e12, t: 'Economists replace the word "trillion" with "one sheriff" for convenience.' },
  { cond: s => s.lifetimeTotal >= 1e15, t: 'The number counter filed for overtime.' },
  { cond: (s, g) => g.cps >= 1e6, t: 'Crystal-per-second rate now exceeds legal posted limits. Sheriff refuses to fine himself.' },
  { cond: s => totalBuildings(s) >= 100, t: 'The posse is now technically a town. The town is technically a posse.' },
  { cond: s => s.bld.autoclick >= 1, t: 'The robot fingers have unionised. Their demand: one (1) tiny glove each. Granted.' },
  { cond: s => s.bld.autoclick >= 25, t: 'Robot finger count now exceeds regular finger count frontier-wide.' },
  { cond: s => s.bld.clickfarm >= 1, t: 'Click Farm rooster wins "Employee of the Month". Taps trophy repeatedly.' },
  { cond: s => s.bld.cursorfab >= 1, t: 'Cursor Factory recalls 4,000 gloves for pointing "too dramatically".' },
  { cond: s => s.bld.moon >= 1, t: 'The moon reports the drilling "tickles". Requests more.' },
  { cond: s => s.bld.cubeverse >= 1, t: 'Portal customs seize one (1) suspicious sphere. Frontier remains 100% cubes.' },
  { cond: s => s.numberTier >= 3, t: s => 'Local kid recites all numbers up to ' + (NUM_WORDS[s.numberTier] || 'infinity') + '. Crowd goes wild.' },
  { cond: s => s.numberTier >= 5, t: 'Math teachers demand the sheriff slow down. Sheriff clicks faster.' },
  { cond: s => s.numberTier >= 8, t: s => 'BREAKING: numbers keep going. Scientists checked twice. 10^' + s.numberTier * 3 + ' confirmed real.' },
];
function pickNews(g) {
  const ok = NEWS.filter(n => !n.cond || n.cond(g.s, g));
  const n = pick(ok);
  return typeof n.t === 'function' ? n.t(g.s, g) : n.t;
}

// ============================================================================
// 4. AUDIO — synth blips + the Tower Defender sound pack
// ============================================================================
class AudioMan {
  constructor() {
    this.ctx = null;
    this.sound = true; this.music = true;
    this.musicEl = null; this.musicIdx = (Math.random() * 3) | 0;
    this.tracks = [
      'assets/audio/hitslab-retro-arcade-game-music-396890.mp3',
      'assets/audio/alex-morgan-video-game-pixel-chiptune-music-583271.mp3',
      'assets/audio/viacheslavstarostin-game-gaming-video-game-music-471936.mp3',
    ];
    this.samples = {
      buy:     'assets/sfx/existentialtaco-confirm-tap-394001.mp3',
      golden:  'assets/sfx/floraphonic-arcade-ui-14-229514.mp3',
      upgrade: 'assets/sfx/floraphonic-arcade-ui-17-229515.mp3',
      ach:     'assets/sfx/floraphonic-arcade-ui-6-229503.mp3',
      prestige:'assets/sfx/puyopuyomegafan1234-winner-game-sound-404167.mp3',
      denied:  'assets/sfx/freesound_community-beep3-98810.mp3',
    };
    this.els = {};
    this.unlocked = false;
  }
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.startMusic();
  }
  startMusic() {
    if (!this.music || !this.unlocked || this.musicEl) return;
    const el = new Audio(this.tracks[this.musicIdx % this.tracks.length]);
    el.volume = 0.32;
    el.addEventListener('ended', () => { this.musicEl = null; this.musicIdx++; this.startMusic(); });
    el.play().catch(() => { this.musicEl = null; });
    this.musicEl = el;
  }
  stopMusic() { if (this.musicEl) { this.musicEl.pause(); this.musicEl = null; } }
  toggleMusic() { this.music = !this.music; this.music ? this.startMusic() : this.stopMusic(); return this.music; }
  sample(name, vol = 0.5) {
    if (!this.sound || !this.unlocked) return;
    let el = this.els[name];
    if (!el) { el = this.els[name] = new Audio(this.samples[name]); }
    const n = el.cloneNode();
    n.volume = vol;
    n.play().catch(() => {});
  }
  blip(freq, dur = 0.07, type = 'square', vol = 0.12, slide = 0) {
    if (!this.sound || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  click(power) { this.blip(520 + rand(-40, 40) + Math.min(500, power * 2), 0.05, 'square', 0.09, 250); }
  crit() { this.blip(880, 0.12, 'square', 0.12, 400); }
}

// ============================================================================
// 5. GAME STATE
// ============================================================================
const SAVE_KEY = 'cs_crystal_clicker_v1';

function freshState() {
  return {
    crystals: 0,
    lifetimeRun: 0,     // this run (resets on prestige)
    lifetimeTotal: 0,   // all time (drives stars + skins)
    clicks: 0,
    clickCrystals: 0,
    crits: 0,
    goldenClicks: 0,
    bounties: 0,
    stars: 0,
    resets: 0,
    playTime: 0,
    numberTier: 1,   // highest named number reached (1 = thousand); MILLION is the first celebration

    offlineCollected: 0,
    bld: Object.fromEntries(BUILDINGS.map(b => [b.id, 0])),
    ups: {},            // upgrade id -> true
    ach: {},            // achievement id -> true
    skin: 'sheriff',
    sound: true,
    musicOn: true,
    buyAmt: 1,
    lastSeen: Date.now(),
  };
}

class Game {
  constructor() {
    this.s = freshState();
    this.UPGRADES = buildUpgrades();
    this.UPG = Object.fromEntries(this.UPGRADES.map(u => [u.id, u]));
    this.audio = new AudioMan();
    this.cps = 0; this.cpc = 1;
    this.buffs = { frenzy: 0, fever: 0, deadeye: 0 };  // seconds remaining
    this.packet = null; this.packetTimer = rand(20, 45);
    this.bandit = null; this.banditTimer = rand(20, 50);
    this.parts = []; this.floats = [];
    this.clickPulse = 0; this.swing = 0; this.autoSwing = 0;
    this.shopDirty = true; this.saveTimer = 0; this.achTimer = 0;
    this.load();
    this.recalc();
  }

  // ---------- economy ----------
  bldMult(id) {
    let m = 1;
    for (const u of this.UPGRADES) {
      if (!this.s.ups[u.id]) continue;
      if (u.type === 'bld' && u.bld === id) m *= u.mult;
      if (u.type === 'bosses' && ['firewall', 'glitch', 'trojan', 'botnet'].includes(id)) m *= 2;
    }
    return m;
  }
  globalMult() {
    let m = 1;
    for (const u of this.UPGRADES) if (this.s.ups[u.id] && u.type === 'global') m *= u.mult;
    // +10% per star for the first 100; beyond that each extra star counts as sqrt (keeps the endgame huge, not infinite)
    const st = this.s.stars;
    const effStars = st <= 100 ? st : 100 + Math.sqrt(st - 100) * 10;
    m *= 1 + 0.10 * effStars;
    m *= 1 + 0.02 * Object.keys(this.s.ach).length;
    return m;
  }
  recalc() {
    const s = this.s;
    const gm = this.globalMult();
    let cps = 0, rate = 0;
    for (const b of BUILDINGS) {
      if (b.cps) cps += b.cps * s.bld[b.id] * this.bldMult(b.id);
      if (b.clickRate) rate += b.clickRate * s.bld[b.id] * this.bldMult(b.id);
    }
    if (s.ups.robo1) rate *= 2;
    if (s.ups.robo2) rate *= 2;
    cps *= gm;
    this.baseCps = cps;   // building production (no buffs, no auto-clicks)
    let ladder = 1;
    for (const u of this.UPGRADES) if (s.ups[u.id] && u.type === 'click') ladder *= u.mult;
    let pct = CLICK_BASE_SHARE;   // every click is always worth this share of your /sec, so /click grows as you do
    for (const u of this.UPGRADES) if (s.ups[u.id] && u.type === 'syn') pct += u.pct;
    const fever = this.buffs.fever > 0 ? 15 : 1;
    // manual clicks get the ×2 ladder PLUS a share of production; robots use only the raw ladder (a synergy loop would explode)
    this.clickShare = this.baseCps * pct;
    this.cpc = (ladder * gm + this.clickShare) * fever;   // baseCps already carries gm — don't apply it twice
    this.autoRate = rate;                       // robot clicks per second
    this.autoCps = rate * ladder * gm * fever;  // robots click with your raw click power (no CPS synergy)
    this.cps = (cps + this.autoCps) * (this.buffs.frenzy > 0 ? 7 : 1);
  }
  bldPrice(b, n = 1) {
    const owned = this.s.bld[b.id];
    // geometric sum: base * 1.15^owned * (1.15^n - 1) / 0.15
    return Math.ceil(b.cost * Math.pow(1.12, owned) * (Math.pow(1.12, n) - 1) / 0.12);
  }
  maxBuyable(b) {
    const owned = this.s.bld[b.id];
    const unit = b.cost * Math.pow(1.12, owned);
    return Math.max(0, Math.floor(Math.log(1 + this.s.crystals * 0.12 / unit) / Math.log(1.12)));
  }
  buyCount(b) {   // how many the current buy-amount setting means for this building
    return this.s.buyAmt === 'max' ? Math.max(1, this.maxBuyable(b)) : this.s.buyAmt;
  }
  earn(n) {
    const CAP = 1e303;   // the counter's physical limit — keeps the math finite
    this.s.crystals = Math.min(CAP, this.s.crystals + n);
    this.s.lifetimeRun = Math.min(CAP, this.s.lifetimeRun + n);
    this.s.lifetimeTotal = Math.min(CAP, this.s.lifetimeTotal + n);
  }
  spend(n) {
    if (this.s.crystals < n) return false;
    this.s.crystals -= n;
    return true;
  }
  buyBuilding(id) {
    const b = BLD[id], n = this.buyCount(b);
    const price = this.bldPrice(b, n);
    if (!this.spend(price)) return;
    this.s.bld[id] += n;
    this.audio.sample('buy', 0.45);
    this.recalc(); this.shopDirty = true;
  }
  buyUpgrade(id) {
    const u = this.UPG[id];
    if (!u || this.s.ups[id] || !this.spend(u.cost)) return;
    this.s.ups[id] = true;
    this.audio.sample('upgrade', 0.5);
    this.toast('⬆️', 'UPGRADE!', u.name);
    this.recalc(); this.shopDirty = true;
  }

  // ---------- clicking ----------
  critChance() {
    if (this.buffs.deadeye > 0) return 1;
    let c = 0;
    for (const u of this.UPGRADES) if (this.s.ups[u.id] && u.type === 'crit') c += u.pct;
    return c;
  }
  mine(px, py) {
    let gain = this.cpc;
    const crit = Math.random() < this.critChance();
    if (crit) { gain *= 10; this.s.crits++; }
    this.earn(gain);
    this.s.clicks++;
    this.s.clickCrystals += gain;
    this.clickPulse = 1; this.swing = 1;
    if (crit) {
      this.audio.crit();
      this.addFloat(px + rand(-10, 10), py - 44, 'YEEHAW! ×10', COLORS.yellow, 14);
      this.addFloat(px + rand(-14, 14), py - 20, '+' + fmt(Math.max(1, gain)), COLORS.yellow, 13);
      this.burst(px, py, 22, [COLORS.yellow, COLORS.orange, '#fff']);
    } else {
      this.audio.click(Math.log10(1 + gain) * 60);
      this.addFloat(px + rand(-14, 14), py - 20, '+' + fmt(Math.max(1, gain)), this.buffs.fever > 0 ? COLORS.yellow : COLORS.cyan);
      this.burst(px, py, 5 + Math.min(8, Math.log10(1 + gain) | 0), [COLORS.cyan, COLORS.magenta, '#fff']);
    }
  }

  // ---------- events ----------
  spawnPacket() {
    const W = view.w, H = view.h;
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.packet = {
      x: dir > 0 ? -50 : W + 50, y: rand(H * 0.15, H * 0.45),
      vx: dir * rand(70, 110) * (W / 900), wob: rand(TAU), t: 0,
    };
  }
  packetCaught() {
    const s = this.s;
    s.goldenClicks++;
    this.audio.sample('golden', 0.55);
    const prod = this.baseCps + this.autoCps;
    const roll = Math.random();
    if (roll < 0.35) {
      this.buffs.frenzy = 25;
      this.toast('📨', 'CRYSTAL FRENZY!', 'Production ×7 for 25 seconds!');
    } else if (roll < 0.60) {
      this.buffs.fever = 13;
      this.toast('📨', 'CLICK FEVER!', 'Clicks ×15 for 13 seconds!');
    } else if (roll < 0.72 && this.critChance() > 0) {
      this.buffs.deadeye = 9;
      this.toast('📨', 'DEADEYE!', 'Every click crits for 9 seconds. YEEHAW.');
    } else if (roll < 0.80 && prod > 0) {
      const gain = Math.min(Math.max(s.crystals, 100) * 0.5, prod * 1800) + 99;
      this.earn(gain);
      this.toast('📨', 'TOWER BONANZA!', 'The tower sneezed. +' + fmt(gain) + ' crystals!');
      this.addFloat(this.packet.x, this.packet.y, '+' + fmt(gain), COLORS.magenta, 14);
    } else {
      const gain = Math.max(88, Math.min(s.crystals * 0.15, prod * 600)) + 13;
      this.earn(gain);
      this.toast('📨', 'LUCKY DROP!', '+' + fmt(gain) + ' crystals!');
      this.addFloat(this.packet.x, this.packet.y, '+' + fmt(gain), COLORS.yellow);
    }
    this.burst(this.packet.x, this.packet.y, 24, [COLORS.yellow, COLORS.orange, '#fff']);
    this.packet = null;
    this.packetTimer = rand(40, 100) * this.goldFreqMult();
    this.recalc();
  }
  goldFreqMult() {
    let m = DEBUG.fast ? 0.05 : 1;
    if (this.s.ups.horseshoe) m *= 0.75;
    if (this.s.ups.horseshoe2) m *= 0.75;
    return m;
  }
  spawnBandit() {
    const W = view.w;
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.bandit = {
      x: dir > 0 ? -40 : W + 40, dir,
      speed: rand(55, 85) * (W / 900), t: 0, denied: 0,
    };
  }
  banditCaught() {
    const s = this.s;
    s.bounties++;
    const gain = (Math.max(30, (this.baseCps + this.autoCps) * 30) + 25) * (s.ups.wanted ? 2 : 1) * (s.ups.wanted2 ? 2 : 1);
    this.earn(gain);
    this.audio.sample('denied', 0.5);
    this.audio.crit();
    this.bandit.denied = 1.1;
    this.addFloat(this.bandit.x, view.floorY - 90, 'ACCESS DENIED', COLORS.red, 13);
    this.addFloat(this.bandit.x, view.floorY - 60, '+' + fmt(gain), COLORS.green, 12);
    this.burst(this.bandit.x, view.floorY - 40, 18, [COLORS.green, COLORS.red, '#fff']);
  }

  // ---------- prestige ----------
  potentialStars() { return Math.floor(Math.cbrt(this.s.lifetimeTotal / 5e9)); }
  claimableStars() { return Math.max(0, this.potentialStars() - this.s.stars); }
  nextStarAt() { const n = this.s.stars + this.claimableStars() + 1; return 5e9 * n * n * n; }
  towerHeight() {
    return Math.min(99999, Math.floor(1000 + 1000 * Math.log10(1 + this.s.lifetimeRun / 100) + 1000 * this.s.stars));
  }
  prestige() {
    const claim = this.claimableStars();
    if (claim <= 0) return;
    const s = this.s;
    const keep = {
      lifetimeTotal: s.lifetimeTotal, clicks: s.clicks, clickCrystals: s.clickCrystals,
      crits: s.crits, goldenClicks: s.goldenClicks, bounties: s.bounties, playTime: s.playTime,
      numberTier: s.numberTier,
      ach: s.ach, skin: s.skin, sound: s.sound, musicOn: s.musicOn, buyAmt: s.buyAmt,
      offlineCollected: s.offlineCollected,
      stars: s.stars + claim, resets: s.resets + 1,
    };
    this.s = Object.assign(freshState(), keep);
    this.buffs.frenzy = this.buffs.fever = 0;
    this.packet = null; this.bandit = null;
    this.audio.sample('prestige', 0.55);
    this.toast('⭐', '+' + claim + ' SHERIFF STAR' + (claim > 1 ? 'S' : '') + '!', 'The tower rises. Production +' + (claim * 10) + '% forever.');
    this.recalc(); this.shopDirty = true;
    this.save();
  }

  // ---------- fx ----------
  addFloat(x, y, text, color, size = 12) {
    this.floats.push({ x, y, text, color, size, life: 1.1, vy: -55 });
    if (this.floats.length > 40) this.floats.shift();
  }
  burst(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), sp = rand(60, 240);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rand(0.4, 0.9), max: 1, size: rand(3, 7), color: pick(colors), rot: rand(TAU), rv: rand(-6, 6) });
    }
    if (this.parts.length > 220) this.parts.splice(0, this.parts.length - 220);
  }
  toast(ico, t1, t2) {
    const cap = window.innerWidth < 860 ? 2 : 5;   // don't bury the arena on phones
    while (dom.toasts.children.length >= cap) dom.toasts.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="ico">${ico}</div><div><div class="t1"></div><div class="t2"></div></div>`;
    el.querySelector('.t1').textContent = t1;
    el.querySelector('.t2').textContent = t2;
    dom.toasts.appendChild(el);
    setTimeout(() => el.classList.add('bye'), 3800);
    setTimeout(() => el.remove(), 4300);
  }

  // ---------- NEW NUMBER celebrations (10^x affinity!) ----------
  checkNumberTier() {
    const s = this.s;
    if (s.lifetimeTotal < 1e6) return;
    const tier = Math.floor(Math.log10(s.lifetimeTotal) / 3);
    if (tier <= s.numberTier) return;
    s.numberTier = tier;
    const word = NUM_WORDS[tier] || ('10^' + tier * 3);
    const zeros = tier * 3;
    this.audio.sample('prestige', 0.5);
    this.toast('🔢', 'NEW NUMBER: ' + word + '!', `That's a 1 with ${zeros} zeros — 10^${zeros}!`);
    this.celebrate = { text: word + '!', sub: '= 10^' + zeros, t: 3 };
    this.burst(view.crystalX, view.crystalY - view.crystalR, 40, [COLORS.yellow, COLORS.cyan, COLORS.magenta, '#fff']);
  }

  // ---------- achievements ----------
  checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (this.s.ach[a.id]) continue;
      let ok = false;
      try { ok = a.test(this.s, this); } catch (e) { ok = false; }
      if (ok) {
        this.s.ach[a.id] = true;
        this.audio.sample('ach', 0.45);
        this.toast(a.ico, 'ACHIEVEMENT: ' + a.name, a.desc);
        this.recalc(); this.shopDirty = true;
      }
    }
  }

  // ---------- save / load ----------
  save() {
    this.s.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { /* private mode */ }
  }
  load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* private mode */ }
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      const s = freshState();
      for (const k of Object.keys(s)) if (d[k] !== undefined) s[k] = d[k];
      s.bld = Object.assign(Object.fromEntries(BUILDINGS.map(b => [b.id, 0])), d.bld || {});
      this.s = s;
      this.audio.sound = s.sound; this.audio.music = s.musicOn;
      // offline earnings
      const away = (Date.now() - (s.lastSeen || Date.now())) / 1000;
      if (away > 60) {
        this.recalc();
        const rate = s.ups.insurance ? 0.9 : 0.6;
        const cap = s.ups.insurance ? 14 * 3600 : 10 * 3600;
        const gain = (this.baseCps + this.autoCps) * Math.min(away, cap) * rate;
        if (gain >= 1) {
          this.earn(gain);
          s.offlineCollected++;
          this.pendingWelcome = { away, gain };
        }
      }
    } catch (e) { console.warn('Bad save, starting fresh.', e); }
  }
  wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    this.s = freshState();
    this.buffs.frenzy = this.buffs.fever = 0;
    this.packet = null; this.bandit = null;
    this.recalc(); this.shopDirty = true;
  }

  // ---------- tick ----------
  tick(dt) {
    const s = this.s;
    s.playTime += dt;
    let dirtyBuff = false;
    for (const k of ['frenzy', 'fever', 'deadeye']) {
      if (this.buffs[k] > 0) {
        this.buffs[k] -= dt;
        if (this.buffs[k] <= 0) { this.buffs[k] = 0; dirtyBuff = true; }
      }
    }
    if (dirtyBuff) this.recalc();
    if (this.cps > 0) this.earn(this.cps * dt);

    // events
    if (!this.packet) {
      this.packetTimer -= dt;
      if (this.packetTimer <= 0) this.spawnPacket();
    } else {
      const p = this.packet;
      p.t += dt; p.x += p.vx * dt; p.y += Math.sin(p.t * 3 + p.wob) * 26 * dt;
      if (p.x < -80 || p.x > view.w + 80) { this.packet = null; this.packetTimer = rand(35, 90) * this.goldFreqMult(); }
    }
    if (!this.bandit) {
      this.banditTimer -= dt;
      if (this.banditTimer <= 0) this.spawnBandit();
    } else {
      const b = this.bandit;
      if (b.denied > 0) {
        b.denied -= dt;
        if (b.denied <= 0) { this.bandit = null; this.banditTimer = rand(30, 80) * (DEBUG.fast ? 0.05 : 1); }
      } else {
        b.t += dt; b.x += b.dir * b.speed * dt;
        if (b.x < -60 || b.x > view.w + 60) { this.bandit = null; this.banditTimer = rand(30, 80) * (DEBUG.fast ? 0.05 : 1); }
      }
    }

    // a visible stream of income numbers pouring off the crystal
    this.incomeT = (this.incomeT || 0) - dt;
    if (this.cps > 0 && this.incomeT <= 0) {
      this.incomeT = 1.1;
      const gain = this.cps * 1.1;
      if (gain >= 0.5) {   // never show a useless "+0"
        this.addFloat(view.crystalX + rand(-0.7, 0.7) * view.crystalR, view.crystalY - view.crystalR * 2.1,
          '+' + fmtRate(gain), this.buffs.frenzy > 0 ? COLORS.magenta : COLORS.green, 11);
      }
    }

    // fx decay
    this.clickPulse = Math.max(0, this.clickPulse - dt * 4);
    this.swing = Math.max(0, this.swing - dt * 5);
    this.autoSwing += dt;
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.rot += p.rv * dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y += f.vy * dt; }
    this.floats = this.floats.filter(f => f.life > 0);

    if (this.celebrate) { this.celebrate.t -= dt; if (this.celebrate.t <= 0) this.celebrate = null; }
    this.achTimer -= dt;
    if (this.achTimer <= 0) { this.achTimer = 1; this.checkAchievements(); this.checkNumberTier(); }
    this.saveTimer += dt;
    if (this.saveTimer >= 15) { this.saveTimer = 0; this.save(); }
  }
}

// ============================================================================
// 6. ICONS — little canvas portraits for shop rows, upgrades and skins
// ============================================================================
const _iconCache = new Map();
function iconCanvas(kind, px = 64) {
  const key = kind + '@' + px;
  let c = _iconCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = px;
  drawIcon(c.getContext('2d'), kind, px);
  _iconCache.set(key, c);
  return c;
}
function drawIcon(ctx, kind, px) {
  const cx = px / 2, cy = px * 0.56, s = px * 0.5;
  ctx.clearRect(0, 0, px, px);
  const cube = (col, face, o = {}) => { drawCube(ctx, cx, cy, s, col, Object.assign({ seed: kind.length }, o)); if (face) drawFace(ctx, cx, cy, s, { mood: face, blink: 0, eyeCol: o.eyeCol }); };
  switch (kind) {
    case 'noob': {
      cube('#9aa7b8', 'wow');
      // spoon
      ctx.save(); ctx.translate(cx + s * 0.62, cy + s * 0.15); ctx.rotate(-0.5);
      ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5; ctx.fillStyle = '#d8dee8';
      ctx.fillRect(-2, -2, 4, s * 0.7); ctx.strokeRect(-2, -2, 4, s * 0.7);
      ctx.beginPath(); ctx.ellipse(0, -s * 0.14, s * 0.14, s * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore(); break;
    }
    case 'hacker': case 'bounty': {
      cube('#1d2a22', null); drawHoodAt(ctx, cx, cy, s); drawFace(ctx, cx, cy, s, { mood: 'hacker', blink: 0 });
      if (kind === 'bounty') { chunkyText(ctx, 'WANTED', cx, px * 0.12, px * 0.11, COLORS.yellow); }
      break;
    }
    case 'holle': {
      cube('#ff9ad5', 'happy');
      ctx.fillStyle = '#ff9ad5'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(cx + sx * s * 0.28, cy - s * 0.85, s * 0.13, s * 0.42, sx * 0.15, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd3ec'; ctx.beginPath(); ctx.ellipse(cx + sx * s * 0.28, cy - s * 0.82, s * 0.06, s * 0.3, sx * 0.15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff9ad5';
      }
      // carrot
      ctx.save(); ctx.translate(cx + s * 0.6, cy + s * 0.2); ctx.rotate(0.6);
      ctx.fillStyle = COLORS.orange; ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.12, s * 0.25); ctx.lineTo(-s * 0.12, s * 0.25); ctx.closePath(); ctx.fill(); ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = COLORS.green; ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.14);
      ctx.restore(); break;
    }
    case 'superted': {
      cube('#9a5f2e', 'grin');
      ctx.fillStyle = '#9a5f2e'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * s * 0.4, cy - s * 0.58, s * 0.17, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c78a52'; ctx.beginPath(); ctx.arc(cx + sx * s * 0.4, cy - s * 0.58, s * 0.08, 0, TAU); ctx.fill(); ctx.fillStyle = '#9a5f2e'; }
      // turret barrel
      ctx.fillStyle = '#3a3a48'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2;
      ctx.fillRect(cx + s * 0.45, cy - s * 0.1, s * 0.5, s * 0.16); ctx.strokeRect(cx + s * 0.45, cy - s * 0.1, s * 0.5, s * 0.16);
      break;
    }
    case 'kaieke': {
      cube('#3b8bff', 'determined');
      // police cap
      ctx.fillStyle = '#20335a'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy - s * 0.5); ctx.quadraticCurveTo(cx, cy - s * 0.95, cx + s * 0.55, cy - s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(cx - s * 0.6, cy - s * 0.55, s * 1.2, s * 0.12); ctx.strokeRect(cx - s * 0.6, cy - s * 0.55, s * 1.2, s * 0.12);
      drawSheriffStar(ctx, cx, cy - s * 0.68, s * 0.1, COLORS.yellow);
      break;
    }
    case 'shotgun': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.5);
      ctx.fillStyle = '#7b4423'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5;
      ctx.fillRect(-s * 0.7, -s * 0.12, s * 0.5, s * 0.26); ctx.strokeRect(-s * 0.7, -s * 0.12, s * 0.5, s * 0.26);
      ctx.fillStyle = '#5c6070';
      ctx.fillRect(-s * 0.25, -s * 0.14, s * 1.0, s * 0.13); ctx.strokeRect(-s * 0.25, -s * 0.14, s * 1.0, s * 0.13);
      ctx.fillRect(-s * 0.25, s * 0.03, s * 0.9, s * 0.11); ctx.strokeRect(-s * 0.25, s * 0.03, s * 0.9, s * 0.11);
      ctx.restore();
      for (let i = 0; i < 4; i++) drawCrystal(ctx, cx + s * (0.35 + i * 0.14), cy - s * (0.5 + (i % 2) * 0.2), s * 0.12, s * 0.22, i % 2 ? COLORS.cyan : COLORS.magenta, rand(-0.6, 0.6));
      break;
    }
    case 'laser': {
      drawGlow(ctx, cx, cy, s * 0.9, COLORS.magenta, 0.5);
      ctx.fillStyle = '#2a2a36'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5;
      roundRectPath(ctx, cx - s * 0.35, cy - s * 0.6, s * 0.7, s * 0.5, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.magenta; ctx.fillRect(cx - s * 0.09, cy - s * 0.12, s * 0.18, s * 0.95);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - s * 0.03, cy - s * 0.12, s * 0.06, s * 0.95);
      drawCrystal(ctx, cx, cy + s * 0.85, s * 0.3, s * 0.4, COLORS.cyan);
      break;
    }
    case 'spam': {
      cube('#2ec4b6', 'hacker', { eyeCol: '#bfffe8' });
      ctx.strokeStyle = '#d8dee8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx + s * 0.62, cy - s * 0.55, s * 0.3, -2.4, 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s * 0.62, cy - s * 0.55); ctx.lineTo(cx + s * 0.82, cy - s * 0.85); ctx.stroke();
      ctx.fillStyle = COLORS.yellow; ctx.beginPath(); ctx.arc(cx + s * 0.85, cy - s * 0.88, s * 0.07, 0, TAU); ctx.fill();
      break;
    }
    case 'virus': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.4);
      ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5; ctx.fillStyle = COLORS.green;
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.save(); ctx.rotate(a); ctx.fillRect(-2.5, -s * 0.75, 5, s * 0.3); ctx.strokeRect(-2.5, -s * 0.75, 5, s * 0.3); ctx.restore(); }
      ctx.restore();
      drawCube(ctx, cx, cy, s * 0.85, '#1f8f4d', { rot: 0.4, seed: 5 });
      drawFace(ctx, cx, cy, s * 0.85, { mood: 'hacker', blink: 0, eyeCol: '#baffd4' });
      break;
    }
    case 'elite': {
      cube('#2a2a36', 'hacker', { eyeCol: COLORS.yellow, rim: COLORS.yellow });
      ctx.strokeStyle = rgba(COLORS.yellow, 0.9); ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i * TAU / 6; const px2 = cx + Math.cos(a) * s * 0.95, py2 = cy + Math.sin(a) * s * 0.95; i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2); }
      ctx.closePath(); ctx.stroke();
      break;
    }
    case 'firewall': {
      drawGlow(ctx, cx, cy, s, COLORS.red, 0.4);
      cube('#8a1626', null, { rim: rgba(COLORS.red, 0.5) });
      // flames
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.5); ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 1.1, cx, cy - s * 0.75);
      ctx.quadraticCurveTo(cx + s * 0.15, cy - s * 1.2, cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx + s * 0.4, cy - s * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = COLORS.yellow;
      ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy - s * 0.5); ctx.quadraticCurveTo(cx, cy - s * 0.85, cx + s * 0.18, cy - s * 0.5); ctx.closePath(); ctx.fill();
      drawFace(ctx, cx, cy, s, { mood: 'hacker', blink: 0, eyeCol: '#ffb15c' });
      break;
    }
    case 'glitch': {
      drawCube(ctx, cx - s * 0.12, cy - s * 0.1, s, '#0d4a5e', { seed: 9, outline: COLORS.cyan });
      drawCube(ctx, cx + s * 0.12, cy + s * 0.06, s, '#4a0d3f', { seed: 9, outline: COLORS.magenta });
      drawFace(ctx, cx + s * 0.12, cy + s * 0.06, s, { mood: 'hacker', blink: 0, eyeCol: COLORS.cyan });
      break;
    }
    case 'trojan': {
      // gift box
      ctx.fillStyle = COLORS.purple; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.fillRect(cx - s * 0.55, cy - s * 0.35, s * 1.1, s * 0.85); ctx.strokeRect(cx - s * 0.55, cy - s * 0.35, s * 1.1, s * 0.85);
      ctx.fillStyle = shade(COLORS.purple, 0.35);
      ctx.fillRect(cx - s * 0.62, cy - s * 0.55, s * 1.24, s * 0.24); ctx.strokeRect(cx - s * 0.62, cy - s * 0.55, s * 1.24, s * 0.24);
      ctx.fillStyle = COLORS.green;
      ctx.fillRect(cx - s * 0.09, cy - s * 0.55, s * 0.18, s * 1.05);
      ctx.beginPath(); ctx.arc(cx - s * 0.16, cy - s * 0.68, s * 0.13, 0, TAU); ctx.arc(cx + s * 0.16, cy - s * 0.68, s * 0.13, 0, TAU); ctx.fill(); ctx.stroke();
      drawFace(ctx, cx, cy + s * 0.08, s * 0.8, { mood: 'hacker', blink: 0, eyeCol: '#d4baff' });
      break;
    }
    case 'botnet': {
      cube('#20335a', 'hacker', { eyeCol: '#7fd4ff' });
      ctx.fillStyle = '#7fd4ff'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(cx + i * s * 0.45, cy - s * 0.85, s * 0.11, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * s * 0.45, cy - s * 0.74); ctx.lineTo(cx + i * s * 0.2, cy - s * 0.5); ctx.stroke(); }
      break;
    }
    case 'tower': {
      ctx.fillStyle = '#0e1a2a'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5;
      ctx.fillRect(cx - s * 0.28, cy - s * 0.9, s * 0.56, s * 1.7); ctx.strokeRect(cx - s * 0.28, cy - s * 0.9, s * 0.56, s * 1.7);
      ctx.strokeStyle = rgba(COLORS.cyan, 0.6); ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) ctx.strokeRect(cx - s * 0.18, cy - s * 0.75 + i * s * 0.4, s * 0.36, s * 0.24);
      drawCrystal(ctx, cx, cy - s * 1.1, s * 0.34, s * 0.55, COLORS.cyan);
      drawGlow(ctx, cx, cy - s * 1.1, s * 0.5, COLORS.cyan, 0.6);
      break;
    }
    case 'autoclick': {
      drawCube(ctx, cx - s * 0.15, cy + s * 0.1, s * 0.8, '#4a5e78', { seed: 11 });
      drawFace(ctx, cx - s * 0.15, cy + s * 0.1, s * 0.8, { mood: 'happy', blink: 0, eyeCol: '#7fd4ff' });
      drawCursorArrow(ctx, cx + s * 0.4, cy - s * 0.55, s * 0.75);
      drawGlow(ctx, cx + s * 0.42, cy - s * 0.5, s * 0.3, COLORS.cyan, 0.5);
      break;
    }
    case 'clickfarm': {
      // barn
      ctx.fillStyle = '#a03030'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.fillRect(cx - s * 0.65, cy - s * 0.25, s * 1.3, s * 0.75); ctx.strokeRect(cx - s * 0.65, cy - s * 0.25, s * 1.3, s * 0.75);
      ctx.fillStyle = '#c04040';
      ctx.beginPath(); ctx.moveTo(cx - s * 0.75, cy - s * 0.25); ctx.lineTo(cx, cy - s * 0.75); ctx.lineTo(cx + s * 0.75, cy - s * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
      // phones inside
      ctx.fillStyle = '#0a2a1a';
      for (let i = 0; i < 3; i++) { ctx.fillRect(cx - s * 0.5 + i * s * 0.38, cy - s * 0.1, s * 0.24, s * 0.42); }
      ctx.fillStyle = COLORS.green;
      for (let i = 0; i < 3; i++) { ctx.fillRect(cx - s * 0.47 + i * s * 0.38, cy - s * 0.05, s * 0.18, s * 0.28); }
      drawCursorArrow(ctx, cx + s * 0.55, cy - s * 0.85, s * 0.45);
      break;
    }
    case 'cursorfab': {
      ctx.fillStyle = '#3a3a48'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.fillRect(cx - s * 0.65, cy - s * 0.15, s * 1.3, s * 0.65); ctx.strokeRect(cx - s * 0.65, cy - s * 0.15, s * 1.3, s * 0.65);
      ctx.fillRect(cx - s * 0.5, cy - s * 0.55, s * 0.2, s * 0.4); ctx.strokeRect(cx - s * 0.5, cy - s * 0.55, s * 0.2, s * 0.4);
      ctx.fillStyle = '#5c6070';
      ctx.beginPath(); ctx.arc(cx - s * 0.4, cy - s * 0.68, s * 0.12, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - s * 0.22, cy - s * 0.82, s * 0.09, 0, TAU); ctx.fill();
      ctx.fillStyle = COLORS.yellow; ctx.fillRect(cx - s * 0.55, cy + s * 0.08, s * 1.1, s * 0.12);
      drawCursorArrow(ctx, cx + s * 0.15, cy - s * 0.7, s * 0.5);
      drawCursorArrow(ctx, cx + s * 0.5, cy - s * 0.45, s * 0.38);
      break;
    }
    case 'moon': {
      drawGlow(ctx, cx, cy - s * 0.1, s * 0.95, '#d8dee8', 0.4);
      ctx.fillStyle = '#c8ced8'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.1, s * 0.62, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9aa4b4';
      ctx.beginPath(); ctx.arc(cx - s * 0.2, cy - s * 0.28, s * 0.13, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s * 0.22, cy, s * 0.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - s * 0.05, cy + s * 0.18, s * 0.07, 0, TAU); ctx.fill();
      // drill
      ctx.save(); ctx.translate(cx + s * 0.42, cy - s * 0.62); ctx.rotate(0.7);
      ctx.fillStyle = '#7b4423'; ctx.fillRect(-s * 0.06, -s * 0.45, s * 0.12, s * 0.5); ctx.strokeRect(-s * 0.06, -s * 0.45, s * 0.12, s * 0.5);
      drawCrystal(ctx, 0, s * 0.15, s * 0.22, s * 0.3, COLORS.cyan);
      ctx.restore();
      break;
    }
    case 'nebula': {
      drawGlow(ctx, cx, cy, s * 1.1, COLORS.purple, 0.6);
      drawGlow(ctx, cx - s * 0.3, cy - s * 0.2, s * 0.6, COLORS.magenta, 0.5);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + 0.5, r = s * (0.25 + (i % 3) * 0.14);
        drawCrystal(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, s * 0.14, s * 0.24, i % 2 ? COLORS.purple : COLORS.magenta, a);
      }
      drawCrystal(ctx, cx, cy, s * 0.26, s * 0.44, '#ffffff');
      break;
    }
    case 'cubeverse': {
      ctx.strokeStyle = COLORS.magenta; ctx.lineWidth = s * 0.14; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.42, s * 0.68, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba(COLORS.cyan, 0.8); ctx.lineWidth = s * 0.05;
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.56, s * 0.82, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#12041a'; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.34, s * 0.6, 0, 0, TAU); ctx.fill();
      drawCube(ctx, cx - s * 0.1, cy - s * 0.18, s * 0.26, COLORS.yellow, { seed: 12 });
      drawCube(ctx, cx + s * 0.12, cy + s * 0.14, s * 0.2, COLORS.cyan, { seed: 13, rot: 0.4 });
      drawGlow(ctx, cx, cy, s * 0.5, COLORS.magenta, 0.4);
      break;
    }
    case 'click': { drawSheriffStar(ctx, cx, cy - s * 0.1, s * 0.75, COLORS.yellow); break; }
    case 'syn': {
      drawCube(ctx, cx - s * 0.3, cy + s * 0.1, s * 0.65, COLORS.yellow, { seed: 2 });
      drawCube(ctx, cx + s * 0.34, cy - s * 0.15, s * 0.65, '#3b8bff', { seed: 3 });
      break;
    }
    case 'glob': { drawCrystal(ctx, cx, cy, s * 0.75, s * 1.25, COLORS.magenta); drawGlow(ctx, cx, cy, s * 0.8, COLORS.magenta, 0.5); break; }
    case 'gold': {
      drawGlow(ctx, cx, cy, s, COLORS.yellow, 0.55);
      drawEnvelope(ctx, cx, cy, s * 1.15);
      break;
    }
    default: { drawCrystal(ctx, cx, cy, s * 0.7, s * 1.2, COLORS.cyan); }
  }
}
function drawHoodAt(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); drawHood(ctx, s); ctx.restore(); }
/** Classic white pointer cursor, tip at (x, y). */
function drawCursorArrow(ctx, x, y, s, col = '#ffffff') {
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.strokeStyle = COLORS.outline;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, s); ctx.lineTo(s * 0.26, s * 0.78);
  ctx.lineTo(s * 0.42, s * 1.1); ctx.lineTo(s * 0.58, s * 1.02);
  ctx.lineTo(s * 0.42, s * 0.7); ctx.lineTo(s * 0.72, s * 0.7);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawEnvelope(ctx, x, y, w) {
  const h = w * 0.68;
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = Math.max(2, w * 0.06);
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = shade(COLORS.yellow, -0.15);
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, h * 0.12); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COLORS.red;
  ctx.save(); ctx.translate(0, h * 0.22); ctx.rotate(-0.12);
  ctx.font = font(h * 0.32); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$$$', 0, 0);
  ctx.restore();
  ctx.restore();
}

// ============================================================================
// 7. SCENE (canvas)
// ============================================================================
const view = { w: 900, h: 600, dpr: 1, floorY: 420, crystalX: 450, crystalY: 400, crystalR: 110 };

function resizeCanvas() {
  const r = dom.stage.getBoundingClientRect();
  view.dpr = PERF.low ? 1 : Math.min(2, window.devicePixelRatio || 1);
  view.w = Math.max(200, r.width); view.h = Math.max(200, r.height);
  dom.scene.width = Math.round(view.w * view.dpr);
  dom.scene.height = Math.round(view.h * view.dpr);
  view.narrow = view.w < 560;
  view.floorY = view.h * (view.narrow ? 0.7 : 0.72);
  view.crystalX = view.w * (view.narrow ? 0.56 : 0.52);
  view.crystalY = view.floorY - 10;
  view.crystalR = clamp(Math.min(view.w, view.h) * 0.19, 54, 150);
}

function drawScene(ctx, g, t) {
  const W = view.w, H = view.h, s = g.s;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  // sky (tinted by the biggest number you've reached)
  const tier = crystalTier(g);
  const tierCol = CRYSTAL_TIERS[tier % CRYSTAL_TIERS.length];
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#08081a'); sky.addColorStop(0.55, '#0d0d24'); sky.addColorStop(1, '#141433');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  if (tier > 0) { ctx.fillStyle = rgba(tierCol, Math.min(0.07, 0.015 * tier)); ctx.fillRect(0, 0, W, H); }
  // drifting binary — denser as the numbers grow
  ctx.font = font(9); ctx.textAlign = 'center';
  const bins = PERF.low ? 8 : (view.narrow ? 10 : 14) + Math.min(26, tier * 3);
  for (let i = 0; i < bins; i++) {
    const bx = (hash2(i, 7) * W + t * (6 + i)) % (W + 40) - 20;
    const by = hash2(i, 13) * view.floorY * 0.85;
    ctx.fillStyle = rgba(i % 3 ? COLORS.cyan : COLORS.magenta, 0.05 + 0.05 * (i % 4));
    ctx.fillText(i % 2 ? '0101' : '1010', bx, by);
  }
  // the tower (background, height grows with progress)
  drawTower(ctx, g, W * 0.14, t);
  // floor
  const horizon = view.floorY - 40;
  ctx.fillStyle = '#0a0a1c'; ctx.fillRect(0, horizon, W, H - horizon);
  ctx.strokeStyle = rgba(COLORS.magenta, 0.16); ctx.lineWidth = 1;
  for (let i = 0; i <= 14; i++) {
    const x = (i / 14) * W;
    ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(W / 2 + (x - W / 2) * 0.22, horizon); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const yy = horizon + (H - horizon) * Math.pow((i + ((t * 0.4) % 1)) / 6, 1.7);
    ctx.strokeStyle = rgba(COLORS.cyan, 0.12 + 0.03 * i);
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
  }
  ctx.strokeStyle = rgba(COLORS.cyan, 0.5); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(W, horizon); ctx.stroke();

  // posse mini stations
  drawStations(ctx, g, t);
  // mega crystal
  drawMegaCrystal(ctx, g, t);
  // hero
  drawHero(ctx, g, t);
  // bandit
  if (g.bandit) drawBandit(ctx, g.bandit, t);
  // golden packet
  if (g.packet) {
    const p = g.packet;
    drawGlow(ctx, p.x, p.y, 46 + Math.sin(t * 6) * 6, COLORS.yellow, 0.6);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.t * 4 + p.wob) * 0.18);
    drawEnvelope(ctx, 0, 0, 56);
    ctx.restore();
    for (let i = 0; i < 2; i++) {
      const a = t * 4 + i * Math.PI;
      drawCrystal(ctx, p.x + Math.cos(a) * 42, p.y + Math.sin(a) * 24, 7, 12, COLORS.yellow, a);
    }
    chunkyText(ctx, 'CLICK!', p.x, p.y - 44 + Math.sin(t * 5) * 3, 10, COLORS.yellow, { glow: COLORS.yellow });
  }
  // particles
  for (const p of g.parts) {
    ctx.save(); ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }
  // floating texts
  for (const f of g.floats) {
    chunkyText(ctx, f.text, f.x, f.y, f.size, f.color, { alpha: clamp(f.life, 0, 1) });
  }
  // NEW NUMBER celebration
  if (g.celebrate) {
    const c = g.celebrate, k = c.t / 3;
    const a = clamp(k < 0.85 ? 1 : (1 - k) / 0.15, 0, 1) * clamp(c.t * 3, 0, 1);
    const size = clamp(W * 0.055, 22, 52) * (1 + 0.06 * Math.sin(t * 8));
    chunkyText(ctx, 'NEW NUMBER!', W / 2, H * 0.24 - (1 - k) * 12, size * 0.42, '#ffffff', { alpha: a, glow: COLORS.cyan });
    chunkyText(ctx, c.text, W / 2, H * 0.32 - (1 - k) * 12, size, COLORS.yellow, { alpha: a, glow: COLORS.yellow });
    chunkyText(ctx, c.sub, W / 2, H * 0.40 - (1 - k) * 12, size * 0.5, COLORS.cyan, { alpha: a, glow: COLORS.cyan });
  }
  // hint
  if (s.clicks < 5) {
    chunkyText(ctx, 'CLICK THE MEGA CRYSTAL!', view.crystalX, view.crystalY - view.crystalR - 46 + Math.sin(t * 3) * 5, 12, COLORS.yellow, { glow: COLORS.yellow });
  }
}

function drawTower(ctx, g, x, t) {
  const hMeters = g.towerHeight();
  const frac = clamp(Math.log10(1 + hMeters - 999) / 5, 0.12, 1);
  const base = view.floorY - 34;
  const hPix = (view.h * 0.62) * frac + 60;
  const top = base - hPix, w = clamp(view.w * 0.045, 24, 46);
  ctx.save();
  drawGlow(ctx, x, top, w * 1.6, COLORS.cyan, 0.35 + 0.08 * Math.sin(t * 3));
  ctx.fillStyle = '#0e1a2a'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.fillRect(x - w / 2, top, w, hPix); ctx.strokeRect(x - w / 2, top, w, hPix);
  ctx.strokeStyle = rgba(COLORS.cyan, 0.5); ctx.lineWidth = 1.5;
  const rows = Math.max(2, Math.floor(hPix / (w * 0.9)));
  for (let i = 0; i < rows; i++) {
    const wy = top + 8 + i * (hPix - 16) / rows;
    ctx.strokeRect(x - w * 0.3, wy, w * 0.6, (hPix - 16) / rows * 0.55);
  }
  drawCrystal(ctx, x, top - 14, w * 0.55, w * 0.95, COLORS.cyan, Math.sin(t * 1.4) * 0.08);
  drawGlow(ctx, x, top - 14, 12, '#ffffff', 0.8);
  // one sheriff star pinned to the tower per prestige (up to 8)
  const nStars = Math.min(8, g.s.stars);
  for (let i = 0; i < nStars; i++) {
    drawSheriffStar(ctx, x + (i % 2 ? w * 0.75 : -w * 0.75), top + 26 + i * Math.max(18, hPix / 9), w * 0.28, COLORS.yellow);
  }
  chunkyText(ctx, hMeters + 'm', x, top - w * 1.15, clamp(view.w * 0.014, 9, 13), hMeters >= 99999 ? COLORS.yellow : COLORS.cyan, { glow: COLORS.cyan });
  ctx.restore();
}

/** The mega crystal levels up visually with every named number reached. */
const CRYSTAL_TIERS = [COLORS.cyan, '#4dff88', '#ffd21f', '#ff9a1f', '#ff5fb8', '#ff2bd6', '#a052ff', '#ff3355', '#7df9ff', '#ffffff'];
function crystalTier(g) { return clamp((g.s.numberTier | 0) - 1, 0, 30); }

function drawMegaCrystal(ctx, g, t) {
  const tier = crystalTier(g);
  const R = view.crystalR * (1 + Math.min(0.42, tier * 0.045));
  const pulse = 1 + Math.sin(t * 2.2) * 0.02 + g.clickPulse * 0.09;
  const x = view.crystalX, y = view.crystalY - R * 0.95;
  const tierCol = CRYSTAL_TIERS[tier % CRYSTAL_TIERS.length];
  drawGlow(ctx, x, view.crystalY, R * 2.4, g.buffs.fever > 0 ? COLORS.yellow : tierCol, 0.4 + g.clickPulse * 0.3);
  // pedestal
  ctx.fillStyle = '#0e1a2a'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(x, view.crystalY + 8, R * 0.95, R * 0.26, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(tierCol, 0.5); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(x, view.crystalY + 4, R * 0.8, R * 0.2, 0, 0, TAU); ctx.stroke();
  ctx.save();
  ctx.translate(x, y); ctx.scale(pulse, 1 + (pulse - 1) * 1.6);
  const col = g.buffs.fever > 0 ? COLORS.yellow : (g.buffs.frenzy > 0 ? COLORS.magenta : tierCol);
  drawCrystal(ctx, 0, 0, R * 1.15, R * 1.9, col, Math.sin(t * 0.9) * 0.03);
  // inner shine
  ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3.5);
  drawCrystal(ctx, -R * 0.14, -R * 0.2, R * 0.3, R * 0.6, '#ffffff', -0.2, 0.6);
  ctx.restore();
  // orbiting shards: one more per named number
  const shards = 4 + Math.min(8, tier);
  for (let i = 0; i < shards; i++) {
    const a = t * 1.2 + i * TAU / shards;
    drawCrystal(ctx, x + Math.cos(a) * R * 1.35, y + Math.sin(a) * R * 0.5, 10, 18, i % 2 ? COLORS.magenta : tierCol, a);
  }
  // robot fingers: the auto-clicker army bonks the crystal
  if (g.autoRate > 0) {
    const n = clamp(1 + Math.floor(Math.log10(g.autoRate + 1)), 1, 6);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.85 + i * (Math.PI * 0.7) / Math.max(1, n - 1 || 1);
      const bonk = Math.max(0, Math.sin(t * (3 + i * 0.7) + i * 2.1));
      const cxr = x + Math.cos(a) * (R * 1.5 - bonk * R * 0.25);
      const cyr = y + Math.sin(a) * (R * 1.1 - bonk * R * 0.2);
      ctx.save(); ctx.translate(cxr, cyr); ctx.rotate(a + Math.PI / 2 + 0.5);
      drawCursorArrow(ctx, 0, 0, clamp(R * 0.22, 14, 26));
      ctx.restore();
      if (bonk > 0.96) drawGlow(ctx, x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.7, 12, '#ffffff', 0.8);
    }
  }
}

function drawHero(ctx, g, t) {
  const R = view.crystalR;
  const s = clamp(R * 0.72, 44, 92);
  const x = view.crystalX - R * 1.55, y = view.crystalY - s * 0.55 + Math.sin(t * 2.4) * 3;
  const swing = g.swing > 0 ? Math.sin(g.swing * Math.PI) : (g.baseCps > 0 ? Math.max(0, Math.sin(g.autoSwing * 2.5)) * 0.35 : 0);
  const skin = g.s.skin;
  const bodyCol = { sheriff: COLORS.yellow, kaieke: '#3b8bff', superted: '#9a5f2e', holle: '#ff9ad5', hacker: '#1d2a22', golden: '#ffe66e' }[skin] || COLORS.yellow;
  ctx.save();
  if (skin === 'golden') drawGlow(ctx, x, y, s * 1.5, COLORS.yellow, 0.5);
  // pickaxe (behind on upswing)
  const drawPick = () => {
    ctx.save();
    ctx.translate(x + s * 0.55, y - s * 0.05);
    ctx.rotate(-1.4 + swing * 2.1);
    ctx.lineJoin = 'round'; ctx.strokeStyle = COLORS.outline;
    ctx.fillStyle = '#7b4423'; ctx.lineWidth = 3;
    ctx.fillRect(-s * 0.05, -s * 0.95, s * 0.1, s * 1.0); ctx.strokeRect(-s * 0.05, -s * 0.95, s * 0.1, s * 1.0);
    drawCrystal(ctx, 0, -s * 0.98, s * 0.5, s * 0.28, COLORS.cyan, Math.PI / 2);
    ctx.restore();
  };
  drawPick();
  drawCube(ctx, x, y, s, bodyCol, { seed: 4, sx: 1 + swing * 0.04, sy: 1 - swing * 0.06 });
  if (skin === 'hacker') { ctx.save(); ctx.translate(x, y); drawHood(ctx, s); ctx.restore(); drawFace(ctx, x, y, s, { mood: 'hacker' }); }
  else drawFace(ctx, x, y, s, { mood: g.clickPulse > 0.4 ? 'grin' : 'determined', lookX: 1 });
  if (skin === 'sheriff' || skin === 'golden') { drawCowboyHat(ctx, x, y - s * 0.02, s); drawSheriffStar(ctx, x - s * 0.28, y + s * 0.3, s * 0.14, '#f2b632'); }
  if (skin === 'kaieke') {
    ctx.fillStyle = '#20335a'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * 0.55, y - s * 0.5); ctx.quadraticCurveTo(x, y - s * 0.95, x + s * 0.55, y - s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(x - s * 0.6, y - s * 0.56, s * 1.2, s * 0.12); ctx.strokeRect(x - s * 0.6, y - s * 0.56, s * 1.2, s * 0.12);
    drawSheriffStar(ctx, x, y - s * 0.7, s * 0.11, COLORS.yellow);
  }
  if (skin === 'superted') {
    ctx.fillStyle = '#9a5f2e'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 3;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * s * 0.4, y - s * 0.58, s * 0.17, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c78a52'; ctx.beginPath(); ctx.arc(x + sx * s * 0.4, y - s * 0.58, s * 0.08, 0, TAU); ctx.fill(); ctx.fillStyle = '#9a5f2e'; }
  }
  if (skin === 'holle') {
    ctx.fillStyle = '#ff9ad5'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(x + sx * s * 0.28, y - s * 0.85, s * 0.13, s * 0.42, sx * 0.15, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd3ec'; ctx.beginPath(); ctx.ellipse(x + sx * s * 0.28, y - s * 0.82, s * 0.06, s * 0.3, sx * 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff9ad5';
    }
  }
  const names = { sheriff: 'spideybidey4', kaieke: 'kaieke20', superted: 'superted9', holle: 'hollebunbun', hacker: 'reformed', golden: 'spideybidey4' };
  nameTag(ctx, names[skin] || skin, x, y + s * 0.85, skin === 'golden' ? COLORS.yellow : COLORS.cyan, clamp(s * 0.11, 7, 10));
  ctx.restore();
}

function drawStations(ctx, g, t) {
  const owned = BUILDINGS.filter(b => g.s.bld[b.id] > 0);
  if (!owned.length) return;
  const maxShow = view.narrow ? 5 : 8;    // phones get the 5 most advanced, roomy
  const show = owned.slice(-maxShow);
  const W = view.w;
  const y0 = view.floorY + (view.h - view.floorY) * 0.52;
  const n = show.length;
  const spread = view.narrow ? 0.16 : 0.105;
  for (let i = 0; i < n; i++) {
    const b = show[i];
    const x = W * (0.5 + (i - (n - 1) / 2) * spread);
    const bob = Math.sin(t * 2 + i * 1.3) * 3;
    const ic = iconCanvas(b.id, 64);
    const sz = clamp(W * (view.narrow ? 0.085 : 0.045), 30, 48);
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(ic, x - sz / 2, y0 - sz + bob, sz, sz);
    ctx.restore();
    nameTag(ctx, '×' + fmt(g.s.bld[b.id]), x, y0 + 13, rgba(b.col, 1), 7);
  }
}

function drawBandit(ctx, b, t) {
  const s = clamp(view.w * 0.045, 34, 52);
  const y = view.floorY - s * 0.55 + Math.abs(Math.sin(t * 9)) * -4;
  ctx.save();
  if (b.denied > 0) {
    const k = 1 - b.denied / 1.1;
    ctx.globalAlpha = clamp(b.denied, 0, 1);
    drawCube(ctx, b.x, y - k * 20, s, '#1d2a22', { rot: k * 2.5, sx: 1 - k * 0.4, sy: 1 - k * 0.4, seed: 8 });
    chunkyText(ctx, 'L', b.x, y - s - 10, 16 + k * 8, COLORS.red, { glow: COLORS.red });
  } else {
    drawCube(ctx, b.x, y, s, '#1d2a22', { seed: 8, sx: b.dir > 0 ? 1 : -1 });
    ctx.save(); ctx.translate(b.x, y); ctx.scale(b.dir > 0 ? 1 : -1, 1); drawHood(ctx, s); ctx.restore();
    drawFace(ctx, b.x, y, s, { mood: 'hacker' });
    chunkyText(ctx, 'WANTED', b.x, y - s * 1.15 + Math.sin(t * 5) * 2, 8, COLORS.yellow, { glow: COLORS.yellow });
    nameTag(ctx, 'BOUNTY: CLICK!', b.x, y + s * 0.85, COLORS.red, 7);
  }
  ctx.restore();
}

// ============================================================================
// 8. DOM / SHOP UI
// ============================================================================
const dom = {};
function grabDom() {
  for (const id of ['scene', 'stage', 'buffs', 'skinbar', 'upgrades', 'buildings', 'tooltip', 'toasts',
    'stCrystals', 'stPow', 'stCps', 'stCpc', 'stHeight', 'stStars', 'twHeight', 'twStars', 'twClaim', 'twNext',
    'btnPrestige', 'statlist', 'achgrid', 'achCount', 'modalwrap', 'modal', 'buyamt',
    'btnSound', 'btnMusic', 'btnSave', 'btnWipe'])
    dom[id] = document.getElementById(id);
}

function attachTooltip(el, html) {
  el.addEventListener('mouseenter', () => { dom.tooltip.innerHTML = html(); dom.tooltip.hidden = false; });
  el.addEventListener('mousemove', e => {
    const tw = dom.tooltip.offsetWidth, th = dom.tooltip.offsetHeight;
    dom.tooltip.style.left = clamp(e.clientX - tw - 14, 6, window.innerWidth - tw - 6) + 'px';
    dom.tooltip.style.top = clamp(e.clientY - th / 2, 6, window.innerHeight - th - 6) + 'px';
  });
  el.addEventListener('mouseleave', () => { dom.tooltip.hidden = true; });
}

function rebuildShop(g) {
  const s = g.s;
  // upgrades
  dom.upgrades.innerHTML = '';
  const avail = g.UPGRADES.filter(u => !s.ups[u.id] && u.unlock(s));
  if (!avail.length) {
    dom.upgrades.innerHTML = '<div id="noupg">Nothing for sale... yet. Keep mining, deputy.</div>';
  }
  for (const u of avail.slice(0, 12)) {
    const btn = document.createElement('button');
    btn.className = 'upg' + (s.crystals >= u.cost ? ' afford' : '');
    const ic = iconCanvas(u.icon, 64);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    cv.getContext('2d').drawImage(ic, 0, 0);
    btn.appendChild(cv);
    btn.addEventListener('click', () => { g.buyUpgrade(u.id); });
    attachTooltip(btn, () => {
      const eff = u.type === 'bld' ? BLD[u.bld].name + ' output ×' + u.mult
        : u.type === 'autox2' ? 'All auto-click buildings ×2'
        : u.type === 'crit' ? 'Crit chance +' + Math.round(u.pct * 100) + '% (crits are ×10)'
        : u.type === 'click' ? 'Click power ×' + u.mult
        : u.type === 'syn' ? 'Clicks gain +' + Math.round(u.pct * 100) + '% of your /sec'
        : u.type === 'global' ? 'EVERYTHING ×' + u.mult
        : u.type === 'goldFreq' ? 'Golden spam packets +25% frequency'
        : u.type === 'bounty2' ? 'Bounty hackers pay ×2'
        : u.type === 'offline' ? 'Offline earnings: 90% for up to 14h'
        : u.type === 'bosses' ? 'Boss buildings ×2'
        : '';
      return `<h4>${u.name}</h4><div class="info">${eff}</div><div class="flavor">“${u.flavor}”</div><div class="price${s.crystals >= u.cost ? '' : ' no'}">💎 ${fmt(u.cost)}</div>`;
    });
    dom.upgrades.appendChild(btn);
  }
  // buildings
  dom.buildings.innerHTML = '';
  let revealed = 0;
  for (let i = 0; i < BUILDINGS.length; i++) {
    const b = BUILDINGS[i];
    const owned = s.bld[b.id];
    const prevOwned = i === 0 || s.bld[BUILDINGS[i - 1].id] > 0 || owned > 0;
    const seen = owned > 0 || s.lifetimeTotal >= b.cost * 0.5 || prevOwned && s.lifetimeTotal >= b.cost * 0.1;
    if (!seen && revealed >= 1) break;   // show one mystery row past the frontier
    const mystery = !seen;
    if (mystery) revealed++;
    const n = g.buyCount(b);
    const price = g.bldPrice(b, n);
    const row = document.createElement('button');
    row.className = 'bld' + (s.crystals >= price && !mystery ? ' afford' : '') + (owned > 0 ? ' owned-any' : '') + (mystery ? ' mystery' : '');
    row.dataset.bld = b.id;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    cv.getContext('2d').drawImage(iconCanvas(b.id, 64), 0, 0);
    const info = document.createElement('div');
    info.innerHTML = `<div class="nm"></div><div class="cost"></div><div class="each"></div>`;
    info.querySelector('.nm').textContent = mystery ? '???' : b.name;
    info.querySelector('.cost').textContent = '💎 ' + fmt(price) + (n > 1 ? '  (x' + fmt(n) + ')' : '');
    info.querySelector('.each').textContent = mystery ? 'keep mining...'
      : b.clickRate ? fmtRate(b.clickRate * g.bldMult(b.id)) + ' auto-clicks/sec each'
      : fmtRate(b.cps * g.bldMult(b.id) * g.globalMult()) + ' /sec each';
    const cnt = document.createElement('div'); cnt.className = 'n'; cnt.textContent = owned || '';
    row.appendChild(cv); row.appendChild(info); row.appendChild(cnt);
    if (!mystery) {
      row.addEventListener('click', () => g.buyBuilding(b.id));
      attachTooltip(row, () => {
        const nn = g.buyCount(b), pp = g.bldPrice(b, nn);
        const owned2 = s.bld[b.id];
        const prodTxt = !owned2 ? ''
          : b.clickRate ? ' · ' + fmtRate(b.clickRate * owned2 * g.bldMult(b.id)) + ' auto-clicks/sec (' + fmtRate(b.clickRate * owned2 * g.bldMult(b.id) * g.cpc) + ' /sec)'
          : ' · producing ' + fmtRate(b.cps * owned2 * g.bldMult(b.id) * g.globalMult()) + ' /sec';
        return `<h4>${b.name}</h4><div class="flavor">“${b.flavor}”</div>` +
          `<div class="info">Owned: ${owned2}${prodTxt}</div>` +
          `<div class="price${s.crystals >= pp ? '' : ' no'}">💎 ${fmt(pp)} for ${fmt(nn)}</div>`;
      });
    }
    dom.buildings.appendChild(row);
  }
  // skins
  dom.skinbar.innerHTML = '';
  for (const k of SKINS) {
    const unlocked = skinUnlocked(k, s);
    const btn = document.createElement('button');
    btn.className = 'skinbtn' + (s.skin === k.id ? ' on' : '') + (unlocked ? '' : ' locked');
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const kind = k.id === 'sheriff' || k.id === 'golden' ? null : k.id;
    const ictx = cv.getContext('2d');
    if (kind) ictx.drawImage(iconCanvas(kind, 64), 0, 0);
    else {   // sheriff / golden portrait
      drawCube(ictx, 32, 38, 30, k.id === 'golden' ? '#ffe66e' : COLORS.yellow, { seed: 4 });
      drawFace(ictx, 32, 38, 30, { mood: 'determined', blink: 0 });
      drawCowboyHat(ictx, 32, 37, 30);
    }
    btn.appendChild(cv);
    if (unlocked) btn.addEventListener('click', () => { s.skin = k.id; g.shopDirty = true; g.audio.sample('buy', 0.35); });
    attachTooltip(btn, () => `<h4>${k.name}</h4><div class="info">${unlocked ? k.desc : 'LOCKED — ' + k.desc}</div>`);
    dom.skinbar.appendChild(btn);
  }
  // achievements
  dom.achgrid.innerHTML = '';
  let got = 0;
  for (const a of ACHIEVEMENTS) {
    const has = !!s.ach[a.id]; if (has) got++;
    const el = document.createElement('div');
    el.className = 'ach' + (has ? '' : ' locked');
    el.textContent = a.ico;
    attachTooltip(el, () => `<h4>${has ? a.name : '???'}</h4><div class="info">${has ? a.desc : 'Locked. ' + a.desc}</div>`);
    dom.achgrid.appendChild(el);
  }
  dom.achCount.textContent = got + '/' + ACHIEVEMENTS.length;
  // stats
  const rows = [
    ['Crystals in pocket', fmt(s.crystals)],
    ['Mined this run', fmt(s.lifetimeRun)],
    ['Mined all time', fmt(s.lifetimeTotal)],
    ['Crystal clicks', fmt(s.clicks)],
    ['Mined by hand', fmt(s.clickCrystals)],
    ['YEEHAW crits', fmt(s.crits) + (g.critChance() > 0 ? '  (' + Math.round(g.critChance() * 100) + '% chance)' : '')],
    ['Golden packets caught', fmt(s.goldenClicks)],
    ['Bounties collected', fmt(s.bounties)],
    ['Posse size', fmt(totalBuildings(s))],
    ['Upgrades owned', Object.keys(s.ups).length + '/' + g.UPGRADES.length],
    ['Sheriff Stars', fmt(s.stars) + ' ★  (+' + (s.stars * 10) + '%)'],
    ['Biggest number named', (NUM_WORDS[s.numberTier] || '10^' + s.numberTier * 3) + ' (10^' + s.numberTier * 3 + ')'],
    ['Robot clicks per second', fmtRate(g.autoRate || 0)],
    ['Achievement bonus', '+' + Object.keys(s.ach).length * 2 + '%'],
    ['Towers raised', fmt(s.resets)],
    ['Time on duty', fmtTime(s.playTime)],
  ];
  dom.statlist.innerHTML = rows.map(([k, v]) => `<div class="statrow"><span>${k}</span><b>${v}</b></div>`).join('');
}

function updateHud(g) {
  const s = g.s;
  dom.stCrystals.textContent = fmt(s.crystals);
  dom.stPow.textContent = s.crystals >= 1000 ? '= 10^' + Math.floor(Math.log10(s.crystals)) : '';
  dom.stCps.firstElementChild.textContent = fmtRate(g.cps);
  dom.stCpc.firstElementChild.textContent = fmt(Math.max(1, g.cpc));
  dom.stHeight.firstElementChild.textContent = g.towerHeight() + 'm';
  dom.stStars.firstElementChild.textContent = s.stars;
  // buffs
  const buffHtml = [];
  if (g.buffs.frenzy > 0) buffHtml.push(`<div class="buff frenzy">📨 CRYSTAL FRENZY ×7 — ${Math.ceil(g.buffs.frenzy)}s</div>`);
  if (g.buffs.fever > 0) buffHtml.push(`<div class="buff fever">⭐ CLICK FEVER ×15 — ${Math.ceil(g.buffs.fever)}s</div>`);
  if (g.buffs.deadeye > 0) buffHtml.push(`<div class="buff fever">🎯 DEADEYE — every click crits — ${Math.ceil(g.buffs.deadeye)}s</div>`);
  const bh = buffHtml.join('');
  if (dom.buffs._last !== bh) { dom.buffs.innerHTML = bh; dom.buffs._last = bh; }
  // prestige tab
  dom.twHeight.textContent = g.towerHeight() + 'm';
  dom.twStars.textContent = s.stars;
  const claim = g.claimableStars();
  dom.twClaim.textContent = claim;
  dom.twNext.textContent = 'Next star at ' + fmt(g.nextStarAt()) + ' crystals mined (all time). You: ' + fmt(s.lifetimeTotal) + '.';
  dom.btnPrestige.disabled = claim <= 0;
  dom.btnPrestige.textContent = claim > 0 ? `RAISE THE TOWER (+${claim} ★)` : 'RAISE THE TOWER';
  // affordability + max-buy labels without a full rebuild
  const availCosts = g.UPGRADES.filter(u => !s.ups[u.id] && u.unlock(s)).slice(0, 12);
  dom.upgrades.querySelectorAll('.upg').forEach((el, i) => {
    if (availCosts[i]) el.classList.toggle('afford', s.crystals >= availCosts[i].cost);
  });
  const isMax = s.buyAmt === 'max';
  dom.buildings.querySelectorAll('.bld:not(.mystery)').forEach(el => {
    const b = BLD[el.dataset.bld];
    if (!b) return;
    const n = g.buyCount(b), price = g.bldPrice(b, n);
    el.classList.toggle('afford', s.crystals >= price);
    if (isMax) {
      const costEl = el.querySelector('.cost');
      const label = '💎 ' + fmt(price) + (n > 1 ? '  (x' + fmt(n) + ')' : '');
      if (costEl.textContent !== label) costEl.textContent = label;
    }
  });
  // new upgrades or buildings may have crossed their unlock threshold
  let seenCount = 0;
  for (let i = 0; i < BUILDINGS.length; i++) {
    const b = BUILDINGS[i];
    const prevOwned = i === 0 || s.bld[BUILDINGS[i - 1].id] > 0 || s.bld[b.id] > 0;
    if (s.bld[b.id] > 0 || s.lifetimeTotal >= b.cost * 0.5 || prevOwned && s.lifetimeTotal >= b.cost * 0.1) seenCount++;
  }
  const sig = availCosts.map(u => u.id).join(',') + '|' + seenCount;
  if (sig !== g._upgSig) { g._upgSig = sig; g.shopDirty = true; }
}

function showModal(html, buttons) {
  dom.modal.innerHTML = html + '<div class="btnrow"></div>';
  const row = dom.modal.querySelector('.btnrow');
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = b.danger ? 'mainbtn dangerbtn' : (b.main ? 'mainbtn' : 'ghostbtn');
    btn.textContent = b.label;
    btn.addEventListener('click', () => { dom.modalwrap.hidden = true; if (b.fn) b.fn(); });
    row.appendChild(btn);
  }
  dom.modalwrap.hidden = false;
}

// ============================================================================
// 9. BOOT
// ============================================================================
const DEBUG = { fast: false };

function boot() {
  grabDom();
  const params = new URLSearchParams(location.search);
  DEBUG.fast = params.has('fast');

  const g = new Game();
  window.CC = g;   // debug hooks, like window.CS in Tower Defender
  window.CC_DATA = { BUILDINGS, BLD, SKINS, ACHIEVEMENTS, NEWS };
  if (params.has('crystals')) { const n = Number(params.get('crystals')) || 0; g.earn(n); }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));
  if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(dom.stage);

  const ctx = dom.scene.getContext('2d');

  // --- input ---
  const canvasPoint = e => {
    const r = dom.scene.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  dom.scene.addEventListener('pointerdown', e => {
    e.preventDefault();
    g.audio.unlock();
    const p = canvasPoint(e);
    if (g.packet && Math.hypot(p.x - g.packet.x, p.y - g.packet.y) < 52) { g.packetCaught(); return; }
    if (g.bandit && g.bandit.denied <= 0 && Math.hypot(p.x - g.bandit.x, p.y - (view.floorY - 24)) < 55) { g.banditCaught(); return; }
    g.mine(p.x, p.y);
  });
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault(); g.audio.unlock();
      g.mine(view.crystalX + rand(-20, 20), view.crystalY - view.crystalR);
    }
    if (e.key === 'm' || e.key === 'M') dom.btnSound.click();
  });
  document.addEventListener('pointerdown', () => g.audio.unlock(), { once: true });

  // --- tabs ---
  document.querySelectorAll('#tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === btn));
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + btn.dataset.tab));
    });
  });
  // --- buy amount ---
  dom.buyamt.querySelectorAll('button').forEach(btn => {
    const val = btn.dataset.n === 'max' ? 'max' : Number(btn.dataset.n);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      g.s.buyAmt = val;
      dom.buyamt.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      g.shopDirty = true;
    });
    btn.classList.toggle('on', val === g.s.buyAmt);
  });
  // --- news ticker ---
  const tickerText = document.getElementById('tickerText');
  let newsT = 6;
  const rotateNews = () => {
    tickerText.classList.add('fade');
    setTimeout(() => { tickerText.textContent = pickNews(g); tickerText.classList.remove('fade'); }, 400);
  };
  // --- top buttons ---
  const syncTop = () => {
    dom.btnSound.textContent = g.s.sound ? '🔊' : '🔇';
    dom.btnSound.classList.toggle('off', !g.s.sound);
    dom.btnMusic.classList.toggle('off', !g.s.musicOn);
  };
  dom.btnSound.addEventListener('click', () => { g.s.sound = g.audio.sound = !g.s.sound; syncTop(); });
  dom.btnMusic.addEventListener('click', () => { g.audio.unlock(); g.s.musicOn = g.audio.toggleMusic(); syncTop(); });
  dom.btnSave.addEventListener('click', () => { g.save(); g.toast('💾', 'SAVED', 'Your crystals are safe, deputy.'); });
  dom.btnWipe.addEventListener('click', () => {
    showModal('<h3>WIPE SAVE?</h3><p>This deletes <b>everything</b>: crystals, posse, stars, achievements. The hackers win. Are you sure?</p>',
      [{ label: 'KEEP PLAYING' }, { label: 'WIPE IT ALL', danger: true, fn: () => { g.wipe(); g.toast('🗑️', 'FRESH START', 'The frontier is quiet again.'); } }]);
  });
  syncTop();
  // --- prestige ---
  dom.btnPrestige.addEventListener('click', () => {
    const claim = g.claimableStars();
    if (claim <= 0) return;
    showModal(`<h3>RAISE THE TOWER?</h3><p>Melt this run down into <b>+${claim} Sheriff Star${claim > 1 ? 's' : ''}</b> (+${claim * 5}% production, forever).</p><p>Crystals, posse and upgrades reset. Stars, skins and achievements stay.</p>`,
      [{ label: 'NOT YET' }, { label: 'RAISE IT', main: true, fn: () => g.prestige() }]);
  });
  // --- save on exit ---
  window.addEventListener('beforeunload', () => g.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) g.save(); });

  // --- welcome back ---
  if (g.pendingWelcome) {
    const { away, gain } = g.pendingWelcome;
    showModal(`<h3>WELCOME BACK, DEPUTY</h3><p>You were gone for <b>${fmtTime(away)}</b>.</p><p>The posse kept mining and produced</p><p style="font-size:14px;color:var(--cyan)">💎 ${fmt(gain)}</p>`,
      [{ label: 'BACK TO WORK', main: true }]);
  }

  // --- main loop ---
  let last = performance.now(), hudT = 0;
  function frame(now) {
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // adaptive quality: if sustained frame time is poor, switch to the light scene once
    if (!PERF.low && dt < 0.09) {
      PERF.acc += dt; PERF.n++;
      if (PERF.n >= 120) {
        if (PERF.acc / PERF.n > 0.04) { PERF.low = true; resizeCanvas(); }
        PERF.acc = 0; PERF.n = 0;
      }
    }
    g.tick(dt);
    if (g.shopDirty) { g.shopDirty = false; rebuildShop(g); }
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.15; updateHud(g); }
    newsT -= dt;
    if (newsT <= 0) { newsT = rand(11, 16); rotateNews(); }
    drawScene(ctx, g, now / 1000);
    requestAnimationFrame(frame);
  }
  rebuildShop(g);
  updateHud(g);
  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', boot);
