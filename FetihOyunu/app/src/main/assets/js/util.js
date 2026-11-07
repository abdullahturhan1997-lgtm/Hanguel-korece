/* ==========================================================
   FETİH — Yardımcılar: projeksiyon, matematik, ses, konuşma
   ========================================================== */
'use strict';

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = n => {
  n = Math.floor(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'B';
  return n.toLocaleString('tr-TR');
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let _uid = 1;
const uid = () => (Date.now() % 1e7) * 100 + (_uid++ % 100);

/* ---------- Projeksiyon: Anadolu/Avrupa/Orta Doğu büyütülmüş mini dünya ---------- */
const Proj = (() => {
  const LON0 = -170, LON1 = 190, LAT0 = 80, LAT1 = -58, STEP = 0.25;
  function table(from, to, center, sigma, amp) {
    const n = Math.round(Math.abs(to - from) / STEP);
    const cum = new Float32Array(n + 1);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const v = from + (to - from) * (i + 0.5) / n;
      acc += 1 + amp * Math.exp(-(((v - center) / sigma) ** 2));
      cum[i + 1] = acc;
    }
    for (let i = 0; i <= n; i++) cum[i] /= acc;
    return { cum, n, from, to };
  }
  const TX = table(LON0, LON1, 28, 30, 2.4);
  const TY = table(LAT0, LAT1, 40, 16, 1.5);
  function look(t, v) {
    const f = clamp((v - t.from) / (t.to - t.from), 0, 1) * t.n;
    const i = Math.min(t.n - 1, Math.floor(f));
    return lerp(t.cum[i], t.cum[i + 1], f - i);
  }
  return {
    p(lon, lat) { return [look(TX, lon) * MAP_W, look(TY, lat) * MAP_H]; }
  };
})();

/* Yuvarlak, sevimli kıyı şeritleri için yumuşatılmış yol */
function smoothPath(ctx, pts, closed = true) {
  const n = pts.length;
  if (n < 3) return;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const m = mid(p, q);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  if (closed) ctx.closePath();
}

/* Yuvarlatılmış dikdörtgen */
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amt) {
  // amt: -1..1 koyulaştır/açıklaştır
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function hexA(hex, a) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${a})`;
}

/* ---------- Ses efektleri (WebAudio, dosyasız) ---------- */
const SFX = (() => {
  let ac = null, on = true, last = {};
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function noise(dur, freq, vol, type = 'bandpass') {
    const a = ctx(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
  }
  function tone(f0, f1, dur, vol, type = 'sine') {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(); o.type = type;
    const g = a.createGain();
    o.frequency.setValueAtTime(f0, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  function throttle(k, ms) { const t = performance.now(); if (last[k] && t - last[k] < ms) return false; last[k] = t; return true; }
  return {
    set enabled(v) { on = v; }, get enabled() { return on; },
    unlock() { ctx(); },
    clash() { if (on && throttle('clash', 70)) { noise(0.12, 3200, 0.25, 'highpass'); tone(1800, 900, 0.08, 0.05, 'square'); } },
    arrow() { if (on && throttle('arrow', 90)) noise(0.18, 1800, 0.12); },
    hit() { if (on && throttle('hit', 60)) noise(0.08, 600, 0.3, 'lowpass'); },
    boom() { if (on && throttle('boom', 150)) { noise(0.6, 180, 0.7, 'lowpass'); tone(90, 30, 0.5, 0.4); } },
    crumble() { if (on && throttle('crumble', 300)) noise(1.0, 300, 0.6, 'lowpass'); },
    horn() { if (on && throttle('horn', 800)) { tone(220, 230, 0.9, 0.15, 'sawtooth'); setTimeout(() => tone(294, 300, 0.7, 0.13, 'sawtooth'), 350); } },
    coin() { if (on && throttle('coin', 80)) { tone(1200, 1800, 0.12, 0.12, 'triangle'); setTimeout(() => tone(1600, 2400, 0.12, 0.1, 'triangle'), 90); } },
    click() { if (on && throttle('click', 40)) tone(700, 500, 0.05, 0.06, 'square'); },
    drum() { if (on && throttle('drum', 200)) tone(120, 50, 0.25, 0.4); }
  };
})();

/* ---------- Konuşma: nidalar, "Ricat! Ricat!" (madde 32, 35, 37) ---------- */
const Voice = (() => {
  let on = true;
  function speak(text, opt = {}) {
    if (!on) return;
    try {
      if (window.FetihAndroid && window.FetihAndroid.speak) {
        window.FetihAndroid.speak(text, opt.pitch || 1, opt.rate || 1);
        return;
      }
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'tr-TR';
      u.rate = opt.rate || 1.05;
      u.pitch = opt.pitch || 0.8;
      u.volume = 1;
      const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('tr'));
      if (v) u.voice = v;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* ses yoksa sessiz devam */ }
  }
  return { speak, set enabled(v) { on = v; }, get enabled() { return on; } };
})();

/* ---------- Bildirim (toast) ---------- */
function toast(msg, kind = '') {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3800);
  while (box.children.length > 4) box.firstChild.remove();
}
