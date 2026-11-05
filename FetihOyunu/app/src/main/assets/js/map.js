/* ==========================================================
   FETİH — Dünya haritası (sevimli, yumuşak gölgeli çizim)
   ========================================================== */
'use strict';

const MapView = {
  cv: null, ctx: null, dpr: 1, W: 0, H: 0,
  cam: { x: 1200, y: 520, z: 1 },
  base: null, pol: null, fog: null, fogT: 0,
  landPath: null, waterPath: null, landPolys: [], waterPolys: [],
  CELL: 6, gw: 0, gh: 0, mask: null,
  selected: null, // {type:'army'|'sett'|'caravan', id}
  onTap: null, t: 0,
  pointers: new Map(), pinch: null, drag: null,

  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.buildGeometry();
    this.buildBase();
    this.bindInput();
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth * this.dpr; this.H = this.cv.clientHeight * this.dpr;
    this.cv.width = this.W; this.cv.height = this.H;
    this.clampCam();
  },
  minZ() { return Math.max(this.W / MAP_W, this.H / MAP_H); },
  clampCam() {
    const c = this.cam;
    c.z = clamp(c.z, this.minZ(), 5 * this.dpr);
    const hw = this.W / c.z / 2, hh = this.H / c.z / 2;
    c.x = clamp(c.x, hw, MAP_W - hw); c.y = clamp(c.y, hh, MAP_H - hh);
  },
  toScreen(x, y) { const c = this.cam; return [(x - c.x) * c.z + this.W / 2, (y - c.y) * c.z + this.H / 2]; },
  toWorld(sx, sy) { const c = this.cam; return [(sx - this.W / 2) / c.z + c.x, (sy - this.H / 2) / c.z + c.y]; },
  focus(x, y, z) { this.cam.x = x; this.cam.y = y; if (z) this.cam.z = z * this.dpr; this.clampCam(); },

  /* ---------- Geometri ---------- */
  buildGeometry() {
    const proj = poly => poly.map(([lo, la]) => Proj.p(lo, la));
    this.landPolys = LANDS.map(proj);
    this.waterPolys = WATERS.map(proj);
    this.landPath = new Path2D();
    for (const p of this.landPolys) { const q = new Path2D(); smoothTo(q, p); this.landPath.addPath(q); }
    this.waterPath = new Path2D();
    for (const p of this.waterPolys) { const q = new Path2D(); smoothTo(q, p); this.waterPath.addPath(q); }
    // Kara maskesi
    this.gw = Math.ceil(MAP_W / this.CELL); this.gh = Math.ceil(MAP_H / this.CELL);
    const c = document.createElement('canvas'); c.width = this.gw; c.height = this.gh;
    const x = c.getContext('2d');
    x.scale(1 / this.CELL, 1 / this.CELL);
    x.fillStyle = '#fff'; x.fill(this.landPath);
    x.fillStyle = '#000'; x.fill(this.waterPath);
    const d = x.getImageData(0, 0, this.gw, this.gh).data;
    this.mask = new Uint8Array(this.gw * this.gh);
    for (let i = 0; i < this.mask.length; i++) this.mask[i] = d[i * 4] > 128 ? 1 : 0;
  },
  isLand(x, y) {
    const gx = Math.floor(x / this.CELL), gy = Math.floor(y / this.CELL);
    if (gx < 0 || gy < 0 || gx >= this.gw || gy >= this.gh) return false;
    return this.mask[gy * this.gw + gx] === 1;
  },

  /* ---------- Taban katman: okyanus, kıtalar, dağlar ---------- */
  buildBase() {
    const c = document.createElement('canvas'); c.width = MAP_W; c.height = MAP_H;
    const x = c.getContext('2d');
    // Okyanus
    const og = x.createLinearGradient(0, 0, 0, MAP_H);
    og.addColorStop(0, '#8fd3ee'); og.addColorStop(0.5, '#6fc0e4'); og.addColorStop(1, '#5aaed8');
    x.fillStyle = og; x.fillRect(0, 0, MAP_W, MAP_H);
    // Dalgacıklar
    x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2; x.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const wx = Math.random() * MAP_W, wy = Math.random() * MAP_H;
      if (this.isLand(wx, wy)) continue;
      x.beginPath(); x.arc(wx, wy, 6, Math.PI * 1.1, Math.PI * 1.9); x.arc(wx + 10, wy, 6, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    }
    // Sığ su parlaması
    x.lineJoin = 'round';
    x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = 26; x.stroke(this.landPath);
    x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 12; x.stroke(this.landPath);
    // Gölge
    x.save(); x.translate(5, 8); x.fillStyle = 'rgba(25,60,95,0.35)'; x.fill(this.landPath); x.restore();
    // Kara
    const lg = x.createLinearGradient(0, 0, 0, MAP_H);
    lg.addColorStop(0, '#d9ecc2'); lg.addColorStop(0.18, '#b7de88'); lg.addColorStop(0.5, '#a6d46e'); lg.addColorStop(1, '#9ccf68');
    x.fillStyle = lg; x.fill(this.landPath);
    x.save(); x.clip(this.landPath);
    // Çöller
    for (const [lo, la, r] of DESERTS) {
      const [dx, dy] = Proj.p(lo, la); const [ex] = Proj.p(lo + r, la); const rr = Math.abs(ex - dx);
      const g = x.createRadialGradient(dx, dy, 0, dx, dy, rr);
      g.addColorStop(0, 'rgba(244,215,140,0.95)'); g.addColorStop(0.6, 'rgba(240,210,135,0.7)'); g.addColorStop(1, 'rgba(240,210,135,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(dx, dy, rr, rr * 0.7, 0, 0, Math.PI * 2); x.fill();
    }
    // Kar (kuzey)
    const [, snowY] = Proj.p(0, 64);
    const sg = x.createLinearGradient(0, 0, 0, snowY);
    sg.addColorStop(0, 'rgba(255,255,255,0.95)'); sg.addColorStop(0.7, 'rgba(255,255,255,0.4)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = sg; x.fillRect(0, 0, MAP_W, snowY);
    // Ormanlar (sevimli ağaçlar)
    for (const [lo, la, r] of FORESTS) {
      const [fx, fy] = Proj.p(lo, la); const [ex] = Proj.p(lo + r, la); const rr = Math.abs(ex - fx);
      for (let i = 0; i < rr / 3; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * rr;
        const tx = fx + Math.cos(a) * d, ty = fy + Math.sin(a) * d * 0.6;
        if (!this.isLand(tx, ty)) continue;
        tree(x, tx, ty, rand(4, 6.5));
      }
    }
    // İç kenar ışık / gölge — yastık gibi kabarık görünüm
    x.lineWidth = 9;
    x.save(); x.translate(4, 4); x.strokeStyle = 'rgba(255,255,255,0.45)'; x.stroke(this.landPath); x.restore();
    x.save(); x.translate(-5, -5); x.strokeStyle = 'rgba(60,110,40,0.35)'; x.stroke(this.landPath); x.restore();
    x.restore();
    // İç denizler
    x.save(); x.clip(this.waterPath);
    x.fillStyle = '#72c3e6'; x.fill(this.waterPath);
    x.lineWidth = 10; x.strokeStyle = 'rgba(255,255,255,0.3)'; x.stroke(this.waterPath);
    x.save(); x.translate(4, 5); x.lineWidth = 8; x.strokeStyle = 'rgba(25,60,95,0.3)'; x.stroke(this.waterPath); x.restore();
    x.restore();
    // Dağlar
    for (const [lo, la, s] of MOUNTAINS) {
      const [mx, my] = Proj.p(lo, la);
      mountain(x, mx, my, 16 * s); mountain(x, mx + 14 * s, my + 5 * s, 11 * s); mountain(x, mx - 12 * s, my + 6 * s, 10 * s);
    }
    // Kıyı çizgisi (koyu, yuvarlak)
    x.lineWidth = 2.6; x.strokeStyle = '#4b3a28'; x.stroke(this.landPath); x.stroke(this.waterPath);
    this.base = c;
  },

  /* ---------- Siyasi katman: bölgeler ve sınırlar (madde 4) ---------- */
  buildPolitical() {
    const S = Game.S; if (!S) return;
    const gw = this.gw, gh = this.gh, C = this.CELL;
    const owners = [], idx = {};
    const own = new Int16Array(gw * gh).fill(-1);
    const live = S.setts.filter(s => !s.ruined && s.owner);
    for (const s of live) if (idx[s.owner] == null) { idx[s.owner] = owners.length; owners.push(s.owner); }
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx; if (!this.mask[i]) continue;
      const wx = gx * C + C / 2, wy = gy * C + C / 2;
      let best = -1, bv = 1;
      for (const s of live) {
        const R = s.big ? 175 : (s.owner === P ? 135 : 85);
        const v = Math.hypot(wx - s.x, wy - s.y) / R;
        if (v < bv) { bv = v; best = idx[s.owner]; }
      }
      own[i] = best;
    }
    this.owners = owners; this.own = own;
    // Renkli küçük resim
    const t = document.createElement('canvas'); t.width = gw; t.height = gh;
    const tx = t.getContext('2d'); const img = tx.createImageData(gw, gh);
    const rgb = owners.map(o => {
      const h = Game.ownerColor(o).replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), o === NEUTRAL ? 70 : 120];
    });
    for (let i = 0; i < own.length; i++) {
      const o = own[i]; if (o < 0) continue;
      const c = rgb[o]; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = c[3];
    }
    tx.putImageData(img, 0, 0);
    const c = document.createElement('canvas'); c.width = MAP_W; c.height = MAP_H;
    const x = c.getContext('2d');
    x.save(); x.clip(this.landPath);
    x.imageSmoothingEnabled = true; x.drawImage(t, 0, 0, MAP_W, MAP_H);
    // Sınır çizgileri
    const segs = {}; // owner çifti -> path
    const pAll = new Path2D(), pMine = new Path2D();
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx, o = own[i];
      if (!this.mask[i]) continue;
      if (gx + 1 < gw && this.mask[i + 1] && own[i + 1] !== o && (o >= 0 || own[i + 1] >= 0)) {
        const p = (owners[o] === P || owners[own[i + 1]] === P) ? pMine : pAll;
        p.moveTo((gx + 1) * C, gy * C); p.lineTo((gx + 1) * C, (gy + 1) * C);
      }
      if (gy + 1 < gh && this.mask[i + gw] && own[i + gw] !== o && (o >= 0 || own[i + gw] >= 0)) {
        const p = (owners[o] === P || owners[own[i + gw]] === P) ? pMine : pAll;
        p.moveTo(gx * C, (gy + 1) * C); p.lineTo((gx + 1) * C, (gy + 1) * C);
      }
    }
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 3.4; x.stroke(pAll);
    x.strokeStyle = 'rgba(70,45,30,0.55)'; x.lineWidth = 1.3; x.setLineDash([4, 3]); x.stroke(pAll); x.setLineDash([]);
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 5; x.stroke(pMine);
    x.strokeStyle = S.player.color; x.lineWidth = 2.4; x.stroke(pMine);
    x.restore();
    // Yollar
    x.lineCap = 'round';
    for (const [a, b] of S.roads) {
      const A = Game.sett(a), B = Game.sett(b); if (!A || !B) continue;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const sea = !this.isLand(mx, my);
      x.strokeStyle = sea ? 'rgba(255,255,255,0.65)' : 'rgba(120,85,50,0.6)';
      x.lineWidth = sea ? 1.6 : 2.2;
      x.setLineDash(sea ? [2, 6] : [5, 5]);
      x.beginPath(); x.moveTo(A.x, A.y); x.quadraticCurveTo(mx + (A.y - B.y) * 0.08, my + (B.x - A.x) * 0.08, B.x, B.y); x.stroke();
    }
    x.setLineDash([]);
    this.pol = c;
    Game.mapDirty = false;
  },

  ownerAt(x, y) {
    if (!this.own) return null;
    const gx = Math.floor(x / this.CELL), gy = Math.floor(y / this.CELL);
    const o = this.own[gy * this.gw + gx];
    return o >= 0 ? this.owners[o] : null;
  },

  /* ---------- Sis (madde 30): kimin hareket ettiği belli mesafeden görülür ---------- */
  buildFog() {
    const fw = 240, fh = 130;
    if (!this.fog) { this.fog = document.createElement('canvas'); this.fog.width = fw; this.fog.height = fh; }
    const x = this.fog.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, fw, fh);
    x.fillStyle = 'rgba(30,40,70,0.30)'; x.fillRect(0, 0, fw, fh);
    x.globalCompositeOperation = 'destination-out';
    const sx = fw / MAP_W, sy = fh / MAP_H;
    for (const [vx, vy, r] of Game.visionSources()) {
      const g = x.createRadialGradient(vx * sx, vy * sy, 0, vx * sx, vy * sy, r * sx);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.75, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(vx * sx, vy * sy, r * sx, 0, Math.PI * 2); x.fill();
    }
    x.globalCompositeOperation = 'source-over';
  },

  /* ---------- Çizim ---------- */
  draw(dt) {
    const S = Game.S; if (!S) return;
    this.t += dt;
    if (Game.mapDirty || !this.pol) this.buildPolitical();
    this.fogT -= dt; if (this.fogT <= 0) { this.buildFog(); this.fogT = 0.25; }
    const x = this.ctx, c = this.cam, W = this.W, H = this.H;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#5aaed8'; x.fillRect(0, 0, W, H);
    x.setTransform(c.z, 0, 0, c.z, W / 2 - c.x * c.z, H / 2 - c.y * c.z);
    x.imageSmoothingEnabled = true;
    x.drawImage(this.base, 0, 0);
    x.drawImage(this.pol, 0, 0);
    x.drawImage(this.fog, 0, 0, MAP_W, MAP_H);
    x.setTransform(1, 0, 0, 1, 0, 0);

    const vis = Game.visionSources();
    const k = this.dpr * clamp(Math.sqrt(c.z / this.dpr), 0.75, 1.5);
    // Seçili ordunun hedef çizgisi
    const sel = this.selected;
    if (sel && sel.type === 'army') {
      const a = Game.army(sel.id);
      if (a && a.tx != null) {
        const [ax, ay] = this.toScreen(a.x, a.y), [bx, by] = this.toScreen(a.tx, a.ty);
        x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3 * this.dpr; x.setLineDash([8 * this.dpr, 6 * this.dpr]);
        x.lineDashOffset = -this.t * 30;
        x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#fff'; x.beginPath(); x.arc(bx, by, 5 * this.dpr, 0, 7); x.fill();
      }
    }
    // Yerleşimler
    const zoomLabel = c.z / this.dpr;
    for (const s of S.setts) {
      const [sx, sy] = this.toScreen(s.x, s.y);
      if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
      drawSettlement(x, s, sx, sy, k * (s.big ? 1.25 : 0.85));
      if (s.big || zoomLabel > 1.15 || s.owner === P) this.label(x, s, sx, sy + (s.big ? 22 : 14) * k, k);
      if (sel && sel.type === 'sett' && sel.id === s.id) ring(x, sx, sy, 24 * k, this.t);
    }
    // Kervanlar
    for (const cv of S.caravans) {
      if (cv.owner !== P && !Game.visible(cv.x, cv.y, vis)) continue;
      const [sx, sy] = this.toScreen(cv.x, cv.y);
      emojiIcon(x, '🐪', sx, sy, 16 * k, Game.ownerColor(cv.owner));
      if (sel && sel.type === 'caravan' && sel.id === cv.id) ring(x, sx, sy, 16 * k, this.t);
    }
    // Ulaklar
    for (const m of S.messengers) {
      if (m.from !== P && m.to !== P && !Game.visible(m.x, m.y, vis)) continue;
      const [sx, sy] = this.toScreen(m.x, m.y);
      emojiIcon(x, '🏇', sx, sy, 14 * k, Game.ownerColor(m.from));
    }
    // Ordular
    for (const a of S.armies) {
      const mine = a.owner === P;
      if (!mine && !Game.visible(a.x, a.y, vis)) continue;
      const [sx, sy] = this.toScreen(a.x, a.y);
      drawArmyIcon(x, a, sx, sy, k, this.t);
      if (sel && sel.type === 'army' && sel.id === a.id) ring(x, sx, sy - 6 * k, 20 * k, this.t);
    }
  },

  label(x, s, sx, sy, k) {
    const fs = Math.round((s.big ? 12 : 10) * k);
    x.font = `bold ${fs}px system-ui, sans-serif`;
    let name = s.name + (s.ruined ? ' (harabe)' : '');
    if (Game.S.player.capital === s.id) name = '👑 ' + name;
    const w = x.measureText(name).width + 14 * k, h = fs + 7 * k;
    rrect(x, sx - w / 2, sy - h / 2, w, h, h / 2);
    x.fillStyle = 'rgba(255,250,238,0.92)'; x.fill();
    x.lineWidth = 1.4 * k; x.strokeStyle = s.ruined ? '#777' : Game.ownerColor(s.owner || NEUTRAL); x.stroke();
    x.fillStyle = '#3b2a1c'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(name, sx, sy + 0.5);
  },

  /* ---------- Dokunmatik kontrol: sürükle, iki parmak yakınlaştır, dokun ---------- */
  bindInput() {
    const cv = this.cv;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr]; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const p = pos(e); this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) this.drag = { sx: p[0], sy: p[1], cx: this.cam.x, cy: this.cam.y, t: performance.now(), moved: false };
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.cam.z, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, wc: this.toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
        this.drag = null;
      }
    });
    cv.addEventListener('pointermove', e => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = pos(e); this.pointers.set(e.pointerId, p);
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.cam.z = this.pinch.z * d / Math.max(10, this.pinch.d);
        this.clampCam();
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this.cam.x = this.pinch.wc[0] - (mx - this.W / 2) / this.cam.z;
        this.cam.y = this.pinch.wc[1] - (my - this.H / 2) / this.cam.z;
        this.clampCam();
      } else if (this.drag) {
        const dx = p[0] - this.drag.sx, dy = p[1] - this.drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 10 * this.dpr) this.drag.moved = true;
        if (this.drag.moved) { this.cam.x = this.drag.cx - dx / this.cam.z; this.cam.y = this.drag.cy - dy / this.cam.z; this.clampCam(); }
      }
    });
    const up = e => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = pos(e);
      this.pointers.delete(e.pointerId);
      if (this.drag && !this.drag.moved && performance.now() - this.drag.t < 500) this.tap(p[0], p[1]);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) this.drag = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this.drag = null; this.pinch = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const p = pos(e), wc = this.toWorld(p[0], p[1]);
      this.cam.z *= e.deltaY < 0 ? 1.15 : 1 / 1.15; this.clampCam();
      this.cam.x = wc[0] - (p[0] - this.W / 2) / this.cam.z; this.cam.y = wc[1] - (p[1] - this.H / 2) / this.cam.z; this.clampCam();
    }, { passive: false });
  },

  tap(sx, sy) {
    const S = Game.S; if (!S) return;
    const [wx, wy] = this.toWorld(sx, sy);
    const R = 26 * this.dpr, vis = Game.visionSources();
    let hit = null, hd = R;
    for (const a of S.armies) {
      if (a.owner !== P && !Game.visible(a.x, a.y, vis)) continue;
      const [ax, ay] = this.toScreen(a.x, a.y); const d = Math.hypot(ax - sx, ay - 6 * this.dpr - sy);
      if (d < hd) { hd = d; hit = { type: 'army', id: a.id }; }
    }
    for (const c of S.caravans) {
      if (c.owner !== P && !Game.visible(c.x, c.y, vis)) continue;
      const [ax, ay] = this.toScreen(c.x, c.y); const d = Math.hypot(ax - sx, ay - sy);
      if (d < hd) { hd = d; hit = { type: 'caravan', id: c.id }; }
    }
    if (!hit) {
      hd = R * 1.2;
      for (const s of S.setts) {
        const [ax, ay] = this.toScreen(s.x, s.y); const d = Math.hypot(ax - sx, ay - sy);
        if (d < hd) { hd = d; hit = { type: 'sett', id: s.id }; }
      }
    }
    if (this.onTap) this.onTap(hit, wx, wy);
  }
};

/* ---------- Çizim yardımcıları ---------- */
function smoothTo(p, pts) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const q = pts[i], m = mid(q, pts[(i + 1) % n]); p.quadraticCurveTo(q[0], q[1], m[0], m[1]); }
  p.closePath();
}
function tree(x, tx, ty, r) {
  x.fillStyle = 'rgba(40,70,30,0.25)'; x.beginPath(); x.ellipse(tx + 1.5, ty + r * 0.9, r * 0.9, r * 0.35, 0, 0, 7); x.fill();
  x.fillStyle = '#6b4a2b'; x.fillRect(tx - 0.8, ty, 1.6, r * 0.8);
  x.fillStyle = '#4e9a3c'; x.beginPath(); x.arc(tx, ty - r * 0.2, r, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); x.arc(tx - r * 0.35, ty - r * 0.55, r * 0.42, 0, 7); x.fill();
  x.strokeStyle = 'rgba(40,60,25,0.6)'; x.lineWidth = 0.8; x.beginPath(); x.arc(tx, ty - r * 0.2, r, 0, 7); x.stroke();
}
function mountain(x, mx, my, s) {
  x.lineJoin = 'round';
  x.fillStyle = 'rgba(60,50,30,0.25)'; x.beginPath(); x.ellipse(mx + 3, my + 2, s * 0.9, s * 0.25, 0, 0, 7); x.fill();
  x.beginPath(); x.moveTo(mx - s, my); x.lineTo(mx, my - s * 1.25); x.lineTo(mx + s, my); x.closePath();
  x.fillStyle = '#b39470'; x.fill();
  x.beginPath(); x.moveTo(mx, my - s * 1.25); x.lineTo(mx + s, my); x.lineTo(mx + s * 0.1, my); x.closePath();
  x.fillStyle = '#8c6f50'; x.fill();
  x.beginPath(); x.moveTo(mx - s * 0.38, my - s * 0.78); x.lineTo(mx, my - s * 1.25); x.lineTo(mx + s * 0.38, my - s * 0.78);
  x.quadraticCurveTo(mx + s * 0.15, my - s * 0.62, mx, my - s * 0.8); x.quadraticCurveTo(mx - s * 0.15, my - s * 0.62, mx - s * 0.38, my - s * 0.78);
  x.fillStyle = '#fff'; x.fill();
  x.beginPath(); x.moveTo(mx - s, my); x.lineTo(mx, my - s * 1.25); x.lineTo(mx + s, my);
  x.strokeStyle = '#4b3a28'; x.lineWidth = 1.4; x.stroke();
}
function ring(x, sx, sy, r, t) {
  x.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(t * 6)})`; x.lineWidth = 3;
  x.beginPath(); x.arc(sx, sy, r + Math.sin(t * 6) * 2, 0, 7); x.stroke();
}
function emojiIcon(x, e, sx, sy, s, color) {
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(sx, sy + s * 0.55, s * 0.6, s * 0.2, 0, 0, 7); x.fill();
  x.fillStyle = color; x.beginPath(); x.arc(sx, sy, s * 0.72, 0, 7); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
  x.font = `${Math.round(s)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(e, sx, sy + 1);
}
function drawArmyIcon(x, a, sx, sy, k, t) {
  const col = a.lentFrom ? Game.ownerColor(a.lentFrom) : Game.ownerColor(a.owner);
  const amb = a.mode === 'ambush';
  x.save();
  if (amb) x.globalAlpha = 0.7;
  x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(sx, sy + 9 * k, 13 * k, 4 * k, 0, 0, 7); x.fill();
  // Bayrak direği
  const bob = a.tx != null ? Math.sin(t * 10) * 1.5 * k : 0;
  x.strokeStyle = '#4b3a28'; x.lineWidth = 2 * k;
  x.beginPath(); x.moveTo(sx + 6 * k, sy + 8 * k); x.lineTo(sx + 6 * k, sy - 22 * k + bob); x.stroke();
  x.fillStyle = col; x.beginPath();
  const w = Math.sin(t * 5) * 2 * k;
  x.moveTo(sx + 6 * k, sy - 22 * k + bob); x.quadraticCurveTo(sx + 14 * k, sy - 24 * k + w + bob, sx + 22 * k, sy - 19 * k + bob);
  x.lineTo(sx + 6 * k, sy - 13 * k + bob); x.closePath(); x.fill(); x.strokeStyle = '#3b2a1c'; x.lineWidth = 1.2 * k; x.stroke();
  // Çöp adam asker
  x.strokeStyle = '#2b2018'; x.lineWidth = 2.2 * k; x.lineCap = 'round';
  const step = a.tx != null ? Math.sin(t * 12) * 3 * k : 0;
  x.beginPath();
  x.moveTo(sx - 3 * k, sy - 6 * k); x.lineTo(sx - 3 * k - step, sy + 7 * k);
  x.moveTo(sx - 3 * k, sy - 6 * k); x.lineTo(sx - 3 * k + step, sy + 7 * k);
  x.moveTo(sx - 3 * k, sy - 6 * k); x.lineTo(sx - 3 * k, sy - 15 * k);
  x.moveTo(sx - 3 * k, sy - 13 * k); x.lineTo(sx + 6 * k, sy - 10 * k);
  x.stroke();
  x.fillStyle = col; x.beginPath(); x.arc(sx - 3 * k, sy - 19 * k, 4.2 * k, 0, 7); x.fill(); x.stroke();
  // Sayı
  const n = Game.count(a.units);
  x.font = `bold ${Math.round(10 * k)}px system-ui,sans-serif`;
  const txt = fmt(n) + (amb ? ' 🌿' : a.mode === 'raid' ? ' 🏴' : '');
  const tw = x.measureText(txt).width + 8 * k;
  rrect(x, sx - tw / 2, sy + 10 * k, tw, 13 * k, 6 * k);
  x.fillStyle = col; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5 * k; x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, sx, sy + 17 * k);
  x.restore();
}

/* Şehir simgeleri: her tarzın kendine has sevimli çizimi */
function drawSettlement(x, s, sx, sy, k) {
  const col = s.ruined ? '#8a8a8a' : Game.ownerColor(s.owner || NEUTRAL);
  const ink = '#3b2a1c';
  x.save(); x.translate(sx, sy); x.scale(k, k);
  x.lineJoin = 'round'; x.lineCap = 'round'; x.lineWidth = 1.5; x.strokeStyle = ink;
  x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(1, 8, 17, 5, 0, 0, 7); x.fill();
  const wall = (w, h, c = '#efe2c4') => {
    x.fillStyle = c; x.beginPath(); x.rect(-w / 2, -h, w, h); x.fill(); x.stroke();
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(w / 6, -h, w / 3, h);
    for (let i = -w / 2; i < w / 2 - 1; i += 4) { x.fillStyle = c; x.fillRect(i, -h - 3, 2.5, 3); x.strokeRect(i, -h - 3, 2.5, 3); }
  };
  const tower = (tx, h, roof) => {
    x.fillStyle = '#e8d6b0'; x.beginPath(); x.rect(tx - 3.5, -h, 7, h); x.fill(); x.stroke();
    x.fillStyle = roof; x.beginPath(); x.moveTo(tx - 5, -h); x.lineTo(tx, -h - 9); x.lineTo(tx + 5, -h); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(tx - 3.5, -h - 1); x.lineTo(tx, -h - 8); x.lineTo(tx - 0.5, -h - 1); x.fill();
  };
  const gate = () => { x.fillStyle = '#6b4a2b'; x.beginPath(); x.arc(0, -1, 3, Math.PI, 0); x.lineTo(3, 0); x.lineTo(-3, 0); x.closePath(); x.fill(); x.stroke(); };
  if (s.ruined) {
    x.fillStyle = '#a39a8c';
    for (const [rx, ry, r] of [[-7, -2, 4], [0, -4, 5], [7, -2, 3.5], [3, 0, 3]]) { x.beginPath(); x.arc(rx, ry, r, 0, 7); x.fill(); x.stroke(); }
    x.strokeStyle = '#555'; x.beginPath(); x.moveTo(-3, -8); x.lineTo(-3, -16); x.moveTo(4, -9); x.lineTo(5, -14); x.stroke();
  } else switch (s.style) {
    case 'rock': // Afyon Kalesi: kayanın tepesinde
      x.fillStyle = '#9c7a57'; x.beginPath(); x.moveTo(-15, 4); x.quadraticCurveTo(-14, -12, -6, -14); x.lineTo(7, -15); x.quadraticCurveTo(15, -10, 15, 4); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.beginPath(); x.moveTo(-12, 0); x.quadraticCurveTo(-11, -10, -5, -12); x.lineTo(-3, -12); x.quadraticCurveTo(-8, -6, -9, 2); x.fill();
      x.save(); x.translate(0, -14); wall(16, 6); tower(-7, 10, col); tower(7, 10, col); tower(0, 14, col); x.restore();
      break;
    case 'dome':
      wall(26, 10); tower(-12, 16, col); tower(12, 16, col);
      x.fillStyle = col; x.beginPath(); x.arc(0, -11, 7, Math.PI, 0); x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.arc(-2.5, -14, 2.5, 0, 7); x.fill();
      x.strokeStyle = ink; x.beginPath(); x.moveTo(0, -18); x.lineTo(0, -22); x.stroke();
      x.fillStyle = '#f2e6c8'; x.fillRect(16, -22, 3, 22); x.strokeRect(16, -22, 3, 22);
      x.fillStyle = col; x.beginPath(); x.moveTo(15, -22); x.lineTo(17.5, -28); x.lineTo(20, -22); x.closePath(); x.fill(); x.stroke();
      gate(); break;
    case 'pagoda':
      wall(26, 7);
      for (let i = 0; i < 3; i++) {
        const y = -9 - i * 7, w = 20 - i * 5;
        x.fillStyle = '#f3e3c3'; x.fillRect(-w / 2 + 3, y, w - 6, 6); x.strokeRect(-w / 2 + 3, y, w - 6, 6);
        x.fillStyle = col; x.beginPath(); x.moveTo(-w / 2 - 2, y); x.quadraticCurveTo(0, y - 6, w / 2 + 2, y); x.closePath(); x.fill(); x.stroke();
      }
      gate(); break;
    case 'pyramid':
      for (let i = 0; i < 4; i++) {
        const w = 28 - i * 6, h = 5;
        x.fillStyle = i % 2 ? '#d9c08f' : '#cdb07a'; x.fillRect(-w / 2, -h * (i + 1), w, h); x.strokeRect(-w / 2, -h * (i + 1), w, h);
      }
      x.fillStyle = col; x.fillRect(-3, -26, 6, 6); x.strokeRect(-3, -26, 6, 6);
      break;
    case 'onion':
      wall(24, 9, '#e9dfcf'); tower(-11, 14, col); tower(11, 14, col);
      x.fillStyle = col; x.beginPath(); x.moveTo(0, -26); x.quadraticCurveTo(8, -18, 4, -13); x.lineTo(-4, -13); x.quadraticCurveTo(-8, -18, 0, -26); x.fill(); x.stroke();
      x.fillStyle = '#f2e6c8'; x.fillRect(-4, -13, 8, 4); x.strokeRect(-4, -13, 8, 4);
      gate(); break;
    case 'yurt':
      for (const [yx, r] of [[-9, 6], [9, 6], [0, 8]]) {
        x.fillStyle = '#f4ecd8'; x.beginPath(); x.moveTo(yx - r, 0); x.lineTo(yx - r, -r * 0.7); x.quadraticCurveTo(yx, -r * 2, yx + r, -r * 0.7); x.lineTo(yx + r, 0); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = col; x.fillRect(yx - r, -r * 0.7, r * 2, 2.5);
      }
      x.strokeStyle = ink; x.beginPath(); x.moveTo(0, -16); x.lineTo(0, -26); x.stroke();
      x.fillStyle = col; x.beginPath(); x.moveTo(0, -26); x.lineTo(8, -23); x.lineTo(0, -20); x.fill(); x.stroke();
      break;
    case 'mud':
      x.fillStyle = '#c99a5b'; x.beginPath(); x.moveTo(-13, 0); x.lineTo(-11, -14); x.lineTo(11, -14); x.lineTo(13, 0); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#b4874b'; x.beginPath(); x.moveTo(-5, -14); x.lineTo(-4, -24); x.lineTo(4, -24); x.lineTo(5, -14); x.closePath(); x.fill(); x.stroke();
      x.strokeStyle = '#6b4a2b'; for (const sx2 of [-8, -3, 3, 8]) { x.beginPath(); x.moveTo(sx2, -9); x.lineTo(sx2 + 3, -9); x.stroke(); }
      x.fillStyle = col; x.fillRect(-5, -27, 10, 3);
      break;
    case 'wood':
      x.fillStyle = '#a97c50';
      for (let i = -12; i <= 12; i += 4) { x.beginPath(); x.moveTo(i - 2, 0); x.lineTo(i - 2, -8); x.lineTo(i, -11); x.lineTo(i + 2, -8); x.lineTo(i + 2, 0); x.closePath(); x.fill(); x.stroke(); }
      x.fillStyle = '#8b5e3c'; x.fillRect(-7, -18, 14, 8); x.strokeRect(-7, -18, 14, 8);
      x.fillStyle = col; x.beginPath(); x.moveTo(-9, -18); x.lineTo(0, -25); x.lineTo(9, -18); x.closePath(); x.fill(); x.stroke();
      break;
    case 'village':
      for (const [hx, hy, w] of [[-6, 0, 10], [6, 1, 9]]) {
        x.fillStyle = '#f2e3c2'; x.fillRect(hx - w / 2, hy - w * 0.7, w, w * 0.7); x.strokeRect(hx - w / 2, hy - w * 0.7, w, w * 0.7);
        x.fillStyle = col; x.beginPath(); x.moveTo(hx - w / 2 - 2, hy - w * 0.7); x.lineTo(hx, hy - w * 1.3); x.lineTo(hx + w / 2 + 2, hy - w * 0.7); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#6b4a2b'; x.fillRect(hx - 1.2, hy - 3.5, 2.4, 3.5);
      }
      break;
    default: // euro
      wall(26, 11); tower(-12, 18, col); tower(12, 18, col); tower(0, 22, col);
      gate();
  }
  x.restore();
}
