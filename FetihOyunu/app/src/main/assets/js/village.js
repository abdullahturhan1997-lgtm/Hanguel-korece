/* ==========================================================
   FETİH — Canlı köy görünümü
   - Normal hali: halk (erkek, kadın, yaşlı, çocuk) dolaşır,
     askerler kulelerde ve kapıda konuşlu.
   - Saldırı altında: düşman çite yüklenir, halk ortaya toplanır.
   - Saldırı sonrası: kırık çit, yanık izleri, düşenler, oklar.
   - Nüfus arttıkça çit genişler, çadırlar eve dönüşür.
   ========================================================== */
'use strict';

const VW = 1700, VH = 1050;
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const Village = {
  active: false, cv: null, ctx: null, W: 0, H: 0, dpr: 1, cam: { x: VW / 2, y: VH / 2, z: 1 },
  sid: null, agents: [], enemies: [], fx: [], arrows: [], bodies: [], t: 0, buildSel: null,

  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    window.addEventListener('resize', () => { if (this.active) { this.resize(); this.clampCam(); } });
    const pts = new Map(); let drag = null, pinch = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr]; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); const p = pos(e); pts.set(e.pointerId, p);
      if (pts.size === 1) drag = { sx: p[0], sy: p[1], cx: this.cam.x, cy: this.cam.y, t: performance.now(), moved: false };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.cam.z, wc: this.toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; drag = null; }
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const p = pos(e); pts.set(e.pointerId, p);
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        this.cam.z = pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(10, pinch.d); this.clampCam();
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this.cam.x = pinch.wc[0] - (mx - this.W / 2) / this.cam.z; this.cam.y = pinch.wc[1] - (my - this.H / 2) / this.cam.z; this.clampCam();
      } else if (drag) {
        const dx = p[0] - drag.sx, dy = p[1] - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 12 * this.dpr) drag.moved = true;
        if (drag.moved) { this.cam.x = drag.cx - dx / this.cam.z; this.cam.y = drag.cy - dy / this.cam.z; this.clampCam(); }
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return; const p = pos(e); pts.delete(e.pointerId);
      if (drag && !drag.moved && performance.now() - drag.t < 500) this.tap(...this.toWorld(p[0], p[1]));
      if (pts.size < 2) pinch = null; if (!pts.size) drag = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e), wc = this.toWorld(p[0], p[1]); this.cam.z *= e.deltaY < 0 ? 1.15 : 1 / 1.15; this.clampCam(); this.cam.x = wc[0] - (p[0] - this.W / 2) / this.cam.z; this.cam.y = wc[1] - (p[1] - this.H / 2) / this.cam.z; this.clampCam(); }, { passive: false });
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth * this.dpr; this.H = this.cv.clientHeight * this.dpr;
    this.cv.width = this.W; this.cv.height = this.H;
  },
  minZ() { return Math.max(this.W / VW, this.H / VH); },
  clampCam() { const c = this.cam; c.z = clamp(c.z, this.minZ(), this.H / 300); const hw = this.W / c.z / 2, hh = this.H / c.z / 2; c.x = clamp(c.x, hw, VW - hw); c.y = clamp(c.y, hh, VH - hh); },
  toWorld(sx, sy) { const c = this.cam; return [(sx - this.W / 2) / c.z + c.x, (sy - this.H / 2) / c.z + c.y]; },
  sett() { return Game.sett(this.sid); },

  /* ================== AÇ / KAPAT ================== */
  open(id) {
    const s = Game.sett(id);
    if (!s || s.owner !== P) return;
    this.sid = id; this.active = true; this.buildSel = null;
    document.getElementById('village').classList.add('show');
    document.getElementById('village-ui').classList.add('show');
    document.getElementById('hud').classList.add('hide');
    UI.hideCard();
    this.resize();
    this.layout(true);
    this.cam.z = this.minZ() * 1.3; this.cam.x = VW / 2; this.cam.y = VH / 2 + 20; this.clampCam();
    this.hud(); this.showPalette(null);
    SFX.click();
  },
  close() {
    this.active = false;
    document.getElementById('village').classList.remove('show');
    document.getElementById('village-ui').classList.remove('show');
    document.getElementById('hud').classList.remove('hide');
    UI.promptOpen = false;
  },

  /* ================== YERLEŞİM ================== */
  state() {
    const s = this.sett(), S = Game.S;
    if (Game.pending.some(c => c.context && c.context.type === 'defense' && c.context.settId === s.id) || s.attack) return 'attack';
    const near = S.armies.find(a => a.owner !== P && a.targetType === 'sett' && a.targetId === s.id && dist(a.x, a.y, s.x, s.y) < 160);
    if (near) return 'approach';
    if (s.after && S.day - s.after.day < 25) return 'after';
    return 'normal';
  },
  layout(reset) {
    const s = this.sett(); if (!s) return;
    const pop = Game.totalPop(s);
    const nb = s.grid.filter(b => b && b !== 'saray').length;
    const rx = clamp(250 + Math.sqrt(pop) * 15 + nb * 5, 300, 690), ry = rx * 0.6;
    const cx = VW / 2, cy = VH / 2 + 10;
    const key = [pop > 90, nb, Math.round(rx / 20), s.grid.join(',')].join('|');
    if (!reset && key === this._key) return;
    this._key = key;
    this.L = { cx, cy, rx, ry, era: pop >= 90 ? 'house' : 'tent' };
    const rnd = seeded(hashStr(s.id));
    // Binalar: şehir dizaynındaki ızgara konumları çit içinde yerleşir
    this.blds = [];
    this.slots = [];
    s.grid.forEach((b, i) => {
      const gx = i % GRID_W, gy = Math.floor(i / GRID_W);
      const u = (gx - 4.5) / 5.2, v = (gy - 3) / 3.3;
      if (u * u + v * v > 1.02) return;
      const x = cx + u * rx * 0.84, y = cy + v * ry * 0.8;
      this.slots.push({ i, x, y, b });
      if (b) this.blds.push({ b, x, y, i });
    });
    // Sabit unsurlar: ateş, kuyu, ahır, odun yığını, sandıklar — binalardan uzak yerlere
    const free = (px, py, r) => !this.blds.some(o => Math.hypot(o.x - px, (o.y - py) * 1.4) < r);
    const spot = (px, py, r) => {
      for (let k = 0; k < 60; k++) { const a = k * 2.4, d = k * 6; const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d * 0.6; if (free(x, y, r) && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.8) return [x, y]; }
      return [px, py];
    };
    this.props = [];
    const add = (type, px, py, r) => { const [x, y] = spot(px, py, r); this.props.push({ type, x, y }); this.blds.push({ b: '_' + type, x, y }); };
    add('fire', cx + rx * 0.05, cy + ry * 0.12, 70);
    add('well', cx - rx * 0.28, cy + ry * 0.05, 55);
    add('logs', cx + rx * 0.3, cy + ry * 0.12, 55);
    if (pop > 30) add('pen', cx - rx * 0.5, cy + ry * 0.25, 85);
    if (pop > 50) add('crates', cx - rx * 0.45, cy - ry * 0.1, 60);
    this.blds = this.blds.filter(o => !o.b.startsWith('_'));
    // Kuleler ve kapı
    const kule = s.grid.filter(b => b === 'kule').length, sur = s.grid.filter(b => b === 'sur').length;
    this.gateA = Math.PI * 0.18;
    const nT = Math.min(12, 4 + kule * 2 + Math.floor(pop / 70));
    this.towers = [];
    for (let i = 0; i < nT; i++) {
      let a = this.gateA + 0.35 + (Math.PI * 2 - 0.7) * (i + 0.5) / nT;
      this.towers.push({ a, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    this.stone = sur >= 2;
    // Kazıklar
    this.stakes = [];
    const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const n = Math.round(per / 9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const da = Math.atan2(Math.sin(a - this.gateA), Math.cos(a - this.gateA));
      if (Math.abs(da) < 0.07) continue; // kapı aralığı
      this.stakes.push({ a, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, h: 16 + rnd() * 3, gate: Math.abs(da) < 0.12 });
    }
    // Çevre: ağaçlar, nehir, iskele
    this.trees = [];
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, d = 1.12 + rnd() * 0.6;
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d * 1.05;
      if (x < 20 || x > VW - 20 || y < 20 || y > VH - 20) continue;
      if (x < 420 && y > VH - 260) continue;
      this.trees.push({ x, y, s: 10 + rnd() * 9, pine: rnd() < 0.4 });
    }
    this.buildGround();
    if (reset || !this.agents.length) this.spawnPeople();
  },
  buildGround() {
    const c = document.createElement('canvas'); c.width = VW; c.height = VH;
    const x = c.getContext('2d'), L = this.L, rnd = seeded(hashStr(this.sid) + 7);
    const g = x.createRadialGradient(VW / 2, VH / 2, 100, VW / 2, VH / 2, VW * 0.7);
    g.addColorStop(0, '#eedcb2'); g.addColorStop(1, '#d6bd88');
    x.fillStyle = g; x.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,30' : '255,250,235'},${0.03 + rnd() * 0.06})`; x.fillRect(rnd() * VW, rnd() * VH, 1 + rnd() * 2, 1 + rnd() * 2); }
    x.strokeStyle = 'rgba(43,32,24,0.35)'; x.lineWidth = 0.9; x.lineCap = 'round';
    for (let i = 0; i < 700; i++) { const px = rnd() * VW, py = rnd() * VH; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 2, py - 5); x.moveTo(px, py); x.lineTo(px + 2, py - 6); x.stroke(); }
    // Köy içi çiğnenmiş toprak
    x.fillStyle = 'rgba(205,180,130,0.55)'; x.beginPath(); x.ellipse(L.cx, L.cy, L.rx * 0.95, L.ry * 0.95, 0, 0, 7); x.fill();
    // Yollar: kapıdan dışarı ve meydana
    const gx = L.cx + Math.cos(this.gateA) * L.rx, gy = L.cy + Math.sin(this.gateA) * L.ry;
    x.strokeStyle = 'rgba(43,32,24,0.4)'; x.lineWidth = 1.2;
    for (const off of [-10, 10]) { x.beginPath(); x.moveTo(L.cx + off, L.cy + off * 0.3); x.quadraticCurveTo((L.cx + gx) / 2 + off, (L.cy + gy) / 2 + 20, gx + off, gy + off * 0.3); x.lineTo(VW - 30 + off, VH * 0.82 + off); x.stroke(); }
    // Nehir ve iskele (sol alt)
    x.fillStyle = 'rgba(150,180,190,0.75)';
    x.beginPath(); x.moveTo(0, VH - 300); x.quadraticCurveTo(220, VH - 230, 330, VH - 120); x.quadraticCurveTo(380, VH - 50, 420, VH); x.lineTo(0, VH); x.closePath(); x.fill();
    x.strokeStyle = '#2b2018'; x.lineWidth = 1.8;
    x.beginPath(); x.moveTo(0, VH - 300); x.quadraticCurveTo(220, VH - 230, 330, VH - 120); x.quadraticCurveTo(380, VH - 50, 420, VH); x.stroke();
    x.lineWidth = 0.8; x.strokeStyle = 'rgba(43,32,24,0.4)';
    for (let i = 0; i < 25; i++) { const px = rnd() * 300, py = VH - 200 + rnd() * 190; if (py < VH - 300 + px * 0.5) continue; x.beginPath(); x.moveTo(px - 6, py); x.quadraticCurveTo(px, py - 3, px + 6, py); x.stroke(); }
    // İskele
    x.save(); x.translate(250, VH - 175); x.rotate(-0.5);
    x.fillStyle = '#c9a877'; x.strokeStyle = '#2b2018'; x.lineWidth = 1.3; x.fillRect(-60, -12, 80, 24); x.strokeRect(-60, -12, 80, 24);
    for (let i = -56; i < 20; i += 7) { x.beginPath(); x.moveTo(i, -12); x.lineTo(i, 12); x.stroke(); }
    x.restore();
    // Kayık
    x.save(); x.translate(140, VH - 90); x.rotate(0.3);
    x.fillStyle = '#b08a5a'; x.strokeStyle = '#2b2018'; x.lineWidth = 1.4;
    x.beginPath(); x.moveTo(-40, 0); x.quadraticCurveTo(0, 22, 40, 0); x.lineTo(30, -6); x.lineTo(-30, -6); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-28, -3); x.lineTo(28, -3); x.stroke();
    x.restore();
    // Kenar karartması
    const vg = x.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VW * 0.65);
    vg.addColorStop(0, 'rgba(90,60,30,0)'); vg.addColorStop(1, 'rgba(90,60,30,0.3)');
    x.fillStyle = vg; x.fillRect(0, 0, VW, VH);
    this.ground = c;
  },

  /* ================== HALK ================== */
  pois() {
    const L = this.L, p = [];
    for (const b of this.blds) p.push([b.x + rand(-20, 20), b.y + rand(10, 22)]);
    for (const o of this.props) p.push([o.x + rand(-30, 30), o.y + rand(14, 30)]);
    p.push([L.cx + rand(-L.rx * 0.6, L.rx * 0.6), L.cy + rand(-L.ry * 0.5, L.ry * 0.5)]);
    return p;
  },
  spawnPeople() {
    const s = this.sett(), L = this.L;
    this.agents = []; this.enemies = []; this.fx = []; this.arrows = [];
    const mk = (kind) => {
      const a = rand(0, 7), d = Math.sqrt(Math.random()) * 0.75;
      return { kind, x: L.cx + Math.cos(a) * L.rx * d, y: L.cy + Math.sin(a) * L.ry * d, tx: null, ty: null, wait: rand(0, 3), ph: rand(0, 6), dir: 1, sp: kind === 'child' ? rand(30, 55) : kind === 'elder' ? rand(10, 16) : rand(18, 28), carry: Math.random() < 0.25, id: uid(), hp: 1, alive: true };
    };
    const n = k => Math.round(s.pop[k]);
    for (let i = 0; i < n('m'); i++) this.agents.push(mk('man'));
    for (let i = 0; i < n('w'); i++) this.agents.push(mk('woman'));
    for (let i = 0; i < n('e'); i++) this.agents.push(mk('elder'));
    for (let i = 0; i < n('c'); i++) this.agents.push(mk('child'));
    for (let i = 0; i < Math.min(40, n('s')); i++) this.agents.push(mk('slave'));
    // Askerler: kulelerde, kapıda ve çit boyunca devriyede
    const g = Math.min(60, Game.count(s.garrison));
    const gateX = L.cx + Math.cos(this.gateA) * L.rx, gateY = L.cy + Math.sin(this.gateA) * L.ry;
    for (let i = 0; i < g; i++) {
      const sol = mk('soldier');
      if (i < this.towers.length) { const t = this.towers[i]; sol.post = 'tower'; sol.x = t.x; sol.y = t.y; sol.hx = t.x; sol.hy = t.y; }
      else if (i < this.towers.length + 3) { sol.post = 'gate'; sol.x = sol.hx = gateX - 25 - (i % 3) * 12; sol.y = sol.hy = gateY - 8 + (i % 3) * 9; }
      else { sol.post = 'patrol'; sol.pa = rand(0, 7); sol.sp = 16; }
      this.agents.push(sol);
    }
    this.popKey = Math.round(Game.totalPop(s)) + ':' + g;
  },
  syncPeople() {
    const s = this.sett();
    const key = Math.round(Game.totalPop(s)) + ':' + Math.min(60, Game.count(s.garrison));
    if (key !== this.popKey) this.spawnPeople();
  },

  /* ================== GÜNCELLEME ================== */
  update(dt) {
    if (!this.active) return;
    const s = this.sett();
    if (!s || s.owner !== P) { this.close(); toast('Bu yerleşim artık senin değil.', 'bad'); return; }
    this.t += dt;
    this.layout(false);
    this.syncPeople();
    const st = this.state(), L = this.L;
    if (st !== this._st) { this._st = st; this.enterState(st); }
    const gateX = L.cx + Math.cos(this.gateA) * L.rx, gateY = L.cy + Math.sin(this.gateA) * L.ry;
    for (const a of this.agents) {
      if (!a.alive) continue;
      if (a.kind === 'soldier') { this.updSoldier(a, dt, st); continue; }
      // Saldırıda halk meydanda toplanır
      if (st === 'attack' || st === 'approach') {
        if (a.kind === 'man' && st === 'attack' && a.id % 2) { this.fightOrFlee(a, dt); continue; }
        const hx = L.cx - L.rx * 0.15 + ((a.id % 13) - 6) * 9, hy = L.cy - L.ry * 0.15 + ((a.id % 7) - 3) * 8;
        this.walk(a, hx, hy, a.sp * 2.2, dt);
        continue;
      }
      if (a.wait > 0) { a.wait -= dt; continue; }
      if (a.tx == null) {
        if (a.kind === 'child' && Math.random() < 0.5) { const o = this.agents[(a.id * 7) % this.agents.length]; a.tx = o.x + rand(-30, 30); a.ty = o.y + rand(-20, 20); }
        else { const p = pick(this.pois()); a.tx = p[0]; a.ty = p[1]; }
        const k = ((a.tx - L.cx) / (L.rx * 0.9)) ** 2 + ((a.ty - L.cy) / (L.ry * 0.9)) ** 2;
        if (k > 1) { a.tx = L.cx + (a.tx - L.cx) / Math.sqrt(k); a.ty = L.cy + (a.ty - L.cy) / Math.sqrt(k); }
      }
      if (this.walk(a, a.tx, a.ty, a.sp, dt)) { a.tx = null; a.wait = a.kind === 'elder' ? rand(4, 10) : rand(1, 6); }
    }
    if (st === 'attack') this.updAttack(dt, gateX, gateY);
    else if (st === 'approach') for (const e of this.enemies) this.walk(e, e.hx, e.hy, 25, dt);
    // Kulelerden ok
    if (st === 'attack' || st === 'approach') {
      this.arrowT = (this.arrowT || 0) - dt;
      const live = this.enemies.filter(e => e.alive);
      if (this.arrowT <= 0 && live.length) {
        this.arrowT = 0.5;
        const t = pick(this.towers), e = pick(live);
        if (t && dist(t.x, t.y, e.x, e.y) < 520) this.arrows.push({ x: t.x, y: t.y - 30, sx: t.x, sy: t.y - 30, tx: e.x, ty: e.y, t: 0, T: 0.7, tgt: e });
      }
    }
    for (const r of this.arrows) {
      r.t += dt; const k = Math.min(1, r.t / r.T);
      r.x = lerp(r.sx, r.tx, k); r.y = lerp(r.sy, r.ty, k) - Math.sin(k * Math.PI) * 40;
      if (k >= 1 && !r.done) { r.done = true; if (r.tgt && r.tgt.alive && Math.random() < 0.25) this.fell(r.tgt, true); }
    }
    this.arrows = this.arrows.filter(r => r.t < r.T + 0.05);
    for (const f of this.fx) f.life -= dt;
    this.fx = this.fx.filter(f => f.life > 0);
    this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.hudT = 0.5; this.hud(); }
  },
  walk(a, tx, ty, sp, dt) {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    if (d < 3) return true;
    const st = Math.min(d, sp * dt);
    a.x += dx / d * st; a.y += dy / d * st; a.ph += st * 0.15; if (Math.abs(dx) > 0.5) a.dir = Math.sign(dx);
    return false;
  },
  updSoldier(a, dt, st) {
    const L = this.L;
    if (a.post === 'tower' || a.post === 'gate') { this.walk(a, a.hx, a.hy, 30, dt); if (st === 'attack') { a.atk = (a.atk || 0) - dt; if (a.atk <= 0) a.atk = rand(0.6, 1.4); } return; }
    if (st === 'attack') return this.fightOrFlee(a, dt);
    a.pa += dt * a.sp / L.rx * (a.id % 2 ? 1 : -1);
    const tx = L.cx + Math.cos(a.pa) * L.rx * 0.9, ty = L.cy + Math.sin(a.pa) * L.ry * 0.9;
    this.walk(a, tx, ty, 30, dt);
  },
  fightOrFlee(a, dt) {
    let best = null, bd = 1e9;
    for (const e of this.enemies) if (e.alive && e.inside) { const d = dist(a.x, a.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    if (!best) { const b = this.breach(a); return this.walk(a, b[0] - Math.cos(b[2]) * 40, b[1] - Math.sin(b[2]) * 26, 40, dt); }
    if (bd > 14) return this.walk(a, best.x, best.y, 45, dt);
    a.atk = (a.atk || 0) - dt; a.dir = Math.sign(best.x - a.x) || 1;
    if (a.atk <= 0) { a.atk = rand(0.7, 1.3); a.swing = 0.3; SFX.clash(); if (Math.random() < 0.3) this.fell(best); }
  },
  breach(a) {
    const L = this.L, br = this.breaches[(a.id || 0) % this.breaches.length];
    return [L.cx + Math.cos(br) * L.rx, L.cy + Math.sin(br) * L.ry, br];
  },
  enterState(st) {
    const s = this.sett(), L = this.L;
    this.enemies = []; this.bodies = []; this.arrows = [];
    const rnd = seeded(((s.after && s.after.seed) || hashStr(s.id)) + 3);
    this.breaches = [this.gateA, this.gateA - 0.9 - rnd() * 0.5, this.gateA + 1.2 + rnd() * 0.6];
    if (st === 'attack' || st === 'approach') {
      const att = s.attack || {};
      let n = att.n;
      if (!n) { const a = Game.S.armies.find(a => a.owner !== P && a.targetType === 'sett' && a.targetId === s.id); n = a ? Game.count(a.units) : 20; }
      const owner = att.owner || (Game.S.armies.find(a => a.owner !== P && a.targetId === s.id) || {}).owner;
      const nn = Game.S.nations[owner];
      let hat = nn ? CULTURE_HAT[nn.culture] : 'eskiya';
      if (hat === Game.S.player.headgear) hat = 'sivri';
      for (let i = 0; i < Math.min(80, n); i++) {
        const br = this.breaches[i % 3] + rand(-0.15, 0.15), d = st === 'approach' ? rand(1.35, 1.7) : rand(1.06, 1.3);
        const x = L.cx + Math.cos(br) * L.rx * d, y = L.cy + Math.sin(br) * L.ry * d;
        this.enemies.push({ kind: 'enemy', x, y, hx: L.cx + Math.cos(br) * L.rx * 1.25, hy: L.cy + Math.sin(br) * L.ry * 1.25, br, hat, ph: rand(0, 6), dir: -1, alive: true, id: uid(), inside: false, wait: rand(0, 4) });
      }
      this.broken = st === 'attack' ? this.breaches.map(b => [b - 0.08, b + 0.08]) : [];
      this.enemyColor = this.contrast(nn ? nn.color : '#3d3d3d');
    } else if (st === 'after') {
      const af = s.after;
      const age = Game.S.day - af.day;
      this.broken = age < 18 ? this.breaches.map(b => [b - 0.1, b + 0.1]) : [];
      const nK = age < 10 ? Math.min(45, af.kills || 0) : 0, nL = age < 10 ? Math.min(20, af.losses || 0) : 0;
      for (let i = 0; i < nK; i++) { const br = this.breaches[i % 3] + (rnd() - 0.5) * 0.5, d = 0.85 + rnd() * 0.5; this.bodies.push({ x: L.cx + Math.cos(br) * L.rx * d, y: L.cy + Math.sin(br) * L.ry * d, enemy: true, rot: (rnd() < 0.5 ? 1 : -1) * Math.PI / 2, arrows: Math.floor(rnd() * 3) }); }
      for (let i = 0; i < nL; i++) { const br = this.breaches[i % 3] + (rnd() - 0.5) * 0.4, d = 0.7 + rnd() * 0.3; this.bodies.push({ x: L.cx + Math.cos(br) * L.rx * d, y: L.cy + Math.sin(br) * L.ry * d, enemy: false, rot: (rnd() < 0.5 ? 1 : -1) * Math.PI / 2, arrows: Math.floor(rnd() * 2) }); }
      this.groundArrows = age < 14 ? Array.from({ length: 70 }, () => { const br = this.breaches[Math.floor(rnd() * 3)] + (rnd() - 0.5) * 0.7, d = 0.8 + rnd() * 0.7; return [L.cx + Math.cos(br) * L.rx * d, L.cy + Math.sin(br) * L.ry * d, rnd() * 6]; }) : [];
      this.burn = age < 8 ? this.breaches.map(b => [L.cx + Math.cos(b) * L.rx * 0.93, L.cy + Math.sin(b) * L.ry * 0.93]) : [];
      this.afterAge = age;
      this.enemyColor = this.contrast((Game.S.nations[af.owner] || {}).color || '#3d3d3d');
      this.afterHat = Game.S.nations[af.owner] ? CULTURE_HAT[Game.S.nations[af.owner].culture] : 'eskiya';
      if (this.afterHat === Game.S.player.headgear) this.afterHat = 'sivri';
    } else { this.broken = []; this.burn = []; this.groundArrows = []; }
  },
  updAttack(dt, gx, gy) {
    const L = this.L;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.wait > 0) { e.wait -= dt; continue; }
      if (!e.inside) {
        const bx = L.cx + Math.cos(e.br) * L.rx * 0.97, by = L.cy + Math.sin(e.br) * L.ry * 0.97;
        if (this.walk(e, bx, by, 30, dt)) e.inside = true;
        continue;
      }
      let best = null, bd = 1e9;
      for (const a of this.agents) if (a.alive && (a.kind === 'soldier' && a.post === 'patrol' || (a.kind === 'man' && a.id % 2))) { const d = dist(a.x, a.y, e.x, e.y); if (d < bd) { bd = d; best = a; } }
      if (!best) { this.walk(e, L.cx, L.cy, 30, dt); continue; }
      if (bd > 14) { this.walk(e, best.x, best.y, 32, dt); continue; }
      e.atk = (e.atk || 0) - dt; e.dir = Math.sign(best.x - e.x) || 1;
      if (e.atk <= 0) { e.atk = rand(0.8, 1.5); e.swing = 0.3; if (Math.random() < 0.18) this.fell(best); }
    }
    for (const a of [...this.agents, ...this.enemies]) if (a.swing > 0) a.swing -= dt;
    // Çit yanıyor
    this.fireT = (this.fireT || 0) - dt;
    if (this.fireT <= 0) { this.fireT = 0.15; const br = pick(this.breaches); this.fx.push({ kind: 'flame', x: L.cx + Math.cos(br) * L.rx + rand(-15, 15), y: L.cy + Math.sin(br) * L.ry + rand(-6, 6), life: rand(0.5, 1.2), r: rand(3, 7) }); }
  },
  contrast(c) {
    const rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const a = rgb(Game.S.player.color), b = rgb(c);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 150 ? c : '#4a4f55';
  },
  fell(a, arrow) {
    a.alive = false;
    this.bodies.push({ x: a.x, y: a.y, enemy: a.kind === 'enemy', rot: (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2, arrows: arrow ? 1 : 0, kind: a.kind, hat: a.hat });
  },

  /* ================== ÇİZİM ================== */
  draw() {
    if (!this.active || !this.L) return;
    const x = this.ctx, c = this.cam, L = this.L, st = this._st;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#d6bd88'; x.fillRect(0, 0, this.W, this.H);
    x.setTransform(c.z, 0, 0, c.z, this.W / 2 - c.x * c.z, this.H / 2 - c.y * c.z);
    x.drawImage(this.ground, 0, 0);
    x.lineCap = 'round'; x.lineJoin = 'round';
    // Yanık izleri, yerdeki oklar
    for (const [bx, by] of this.burn || []) { x.fillStyle = 'rgba(40,30,20,0.35)'; x.beginPath(); x.ellipse(bx, by, 40, 16, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(30,20,10,0.5)'; x.lineWidth = 1; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(bx + rand(-30, 30), by + rand(-10, 10)); x.lineTo(bx + rand(-30, 30), by + rand(-10, 10)); x.stroke(); } }
    x.strokeStyle = INK; x.lineWidth = 1.1;
    for (const [ax, ay, ang] of this.groundArrows || []) { x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + Math.cos(ang) * 10, ay + Math.sin(ang) * 4 - 4); x.stroke(); }
    // Tarlalar zemine çizilir
    for (const b of this.blds) if (b.b === 'tarla') this.drawField(x, b.x, b.y);
    // Derinliğe göre tüm nesneler
    const list = [];
    const broken = a => (this.broken || []).some(([a0, a1]) => { const d = Math.atan2(Math.sin(a - (a0 + a1) / 2), Math.cos(a - (a0 + a1) / 2)); return Math.abs(d) < (a1 - a0) / 2; });
    for (const s of this.stakes) list.push({ y: s.y, d: () => this.drawStake(x, s, broken(s.a)) });
    for (const t of this.towers) list.push({ y: t.y + 1, d: () => this.drawTower(x, t.x, t.y) });
    for (const t of this.trees) list.push({ y: t.y, d: () => t.pine ? Battle.pine(x, t.x, t.y, t.s) : Battle.tree(x, t.x, t.y, t.s * 0.8) });
    for (const b of this.blds) if (b.b !== 'tarla') list.push({ y: b.y, d: () => this.drawBld(x, b) });
    for (const o of this.props) list.push({ y: o.y, d: () => this.drawProp(x, o) });
    for (const b of this.bodies) list.push({ y: b.y - 5, d: () => this.drawBody(x, b) });
    for (const a of this.agents) if (a.alive) list.push({ y: a.y, d: () => this.drawPerson(x, a) });
    for (const e of this.enemies) if (e.alive) list.push({ y: e.y, d: () => this.drawPerson(x, e) });
    const gx = L.cx + Math.cos(this.gateA) * L.rx, gy = L.cy + Math.sin(this.gateA) * L.ry;
    list.push({ y: gy + 2, d: () => this.drawGate(x, gx, gy) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.d();
    // Oklar, alevler, duman
    x.strokeStyle = INK; x.lineWidth = 1.2;
    for (const r of this.arrows) { const a = Math.atan2(r.ty - r.sy, r.tx - r.sx); x.beginPath(); x.moveTo(r.x, r.y); x.lineTo(r.x - Math.cos(a) * 10, r.y - Math.sin(a) * 10); x.stroke(); }
    for (const f of this.fx) { const a = clamp(f.life, 0, 1); x.fillStyle = `rgba(255,${130 + 90 * a | 0},40,${a})`; x.beginPath(); x.arc(f.x, f.y - (1 - a) * 20, f.r * a + 1, 0, 7); x.fill(); }
    if ((st === 'after' && this.afterAge < 6) || st === 'attack') for (const [bx, by] of (this.burn && this.burn.length ? this.burn : (this.breaches || []).map(b => [L.cx + Math.cos(b) * L.rx, L.cy + Math.sin(b) * L.ry]))) this.smoke(x, bx, by - 10);
    // Seçili bina için boş yerler
    if (this.buildSel) for (const sl of this.slots) {
      const occupied = !!this.sett().grid[sl.i];
      if (this.buildSel === 'yik' ? !occupied || this.sett().grid[sl.i] === 'saray' : occupied) continue;
      x.strokeStyle = this.buildSel === 'yik' ? 'rgba(160,30,20,0.8)' : 'rgba(43,32,24,0.6)'; x.lineWidth = 1.5; x.setLineDash([5, 4]);
      x.beginPath(); x.ellipse(sl.x, sl.y, 22, 11, 0, 0, 7); x.stroke(); x.setLineDash([]);
    }
  },
  smoke(x, sx, sy) {
    for (let i = 0; i < 6; i++) { const k = ((this.t * 0.4 + i / 6) % 1); x.fillStyle = `rgba(110,100,90,${0.35 * (1 - k)})`; x.beginPath(); x.arc(sx + Math.sin(k * 6 + i) * 6 + k * 20, sy - k * 110, 6 + k * 16, 0, 7); x.fill(); }
  },
  drawStake(x, s, broken) {
    x.strokeStyle = INK; x.lineWidth = 1;
    if (broken) {
      x.fillStyle = '#9b7a52'; x.save(); x.translate(s.x, s.y); x.rotate(s.a + 1.2); x.fillRect(-2, -s.h * 0.8, 4, s.h * 0.8); x.strokeRect(-2, -s.h * 0.8, 4, s.h * 0.8); x.restore();
      return;
    }
    const h = s.h * (this.stone ? 1.15 : 1);
    x.fillStyle = this.stone ? '#d8ccb0' : '#b38d60';
    x.beginPath(); x.moveTo(s.x - 2.6, s.y); x.lineTo(s.x - 2.6, s.y - h); x.lineTo(s.x, s.y - h - 4); x.lineTo(s.x + 2.6, s.y - h); x.lineTo(s.x + 2.6, s.y); x.closePath(); x.fill(); x.stroke();
    if (!this.stone) { x.strokeStyle = 'rgba(43,32,24,0.5)'; x.beginPath(); x.moveTo(s.x - 4, s.y - h * 0.35); x.lineTo(s.x + 4, s.y - h * 0.35); x.stroke(); }
  },
  drawTower(x, tx, ty) {
    x.strokeStyle = INK; x.lineWidth = 1.5; x.fillStyle = '#b38d60';
    x.beginPath(); x.moveTo(tx - 11, ty); x.lineTo(tx - 8, ty - 46); x.moveTo(tx + 11, ty); x.lineTo(tx + 8, ty - 46); x.moveTo(tx - 10, ty - 8); x.lineTo(tx + 9, ty - 30); x.moveTo(tx + 10, ty - 8); x.lineTo(tx - 9, ty - 30); x.stroke();
    x.lineWidth = 1; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(tx + 12, ty - i * 9); x.lineTo(tx + 17, ty - i * 9 - 3); x.stroke(); }
    x.beginPath(); x.moveTo(tx + 12, ty); x.lineTo(tx + 14, ty - 44); x.moveTo(tx + 16, ty); x.lineTo(tx + 18, ty - 44); x.stroke();
    x.lineWidth = 1.4; x.fillRect(tx - 13, ty - 56, 26, 10); x.strokeRect(tx - 13, ty - 56, 26, 10);
    x.fillStyle = '#9b7a52'; x.beginPath(); x.moveTo(tx - 16, ty - 66); x.lineTo(tx, ty - 78); x.lineTo(tx + 16, ty - 66); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(tx - 12, ty - 66); x.lineTo(tx - 12, ty - 56); x.moveTo(tx + 12, ty - 66); x.lineTo(tx + 12, ty - 56); x.stroke();
  },
  drawGate(x, gx, gy) {
    const open = this._st !== 'attack';
    x.strokeStyle = INK; x.lineWidth = 1.4; x.fillStyle = '#a07a4e';
    for (const s of [-1, 1]) {
      x.save(); x.translate(gx + s * 14, gy); if (open) x.rotate(s * 0.7);
      x.fillRect(-1, -22, s * 14, 22); x.strokeRect(-1, -22, s * 14, 22);
      x.beginPath(); x.moveTo(0, -18); x.lineTo(s * 14, -4); x.stroke();
      x.restore();
    }
    x.beginPath(); x.moveTo(gx + 26, gy); x.lineTo(gx + 26, gy - 62); x.stroke();
    x.fillStyle = Game.S.player.color; x.beginPath(); x.moveTo(gx + 26, gy - 62); x.quadraticCurveTo(gx + 38, gy - 66 + Math.sin(this.t * 4) * 3, gx + 50, gy - 60); x.lineTo(gx + 50, gy - 44); x.quadraticCurveTo(gx + 38, gy - 48, gx + 26, gy - 44); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 11px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(Battle.emblem(), gx + 38, gy - 53);
  },
  drawTent(x, tx, ty, w, h, big) {
    x.strokeStyle = INK; x.lineWidth = 1.4;
    x.fillStyle = 'rgba(43,32,24,0.18)'; x.beginPath(); x.ellipse(tx + 4, ty + 2, w * 0.6, w * 0.16, 0, 0, 7); x.fill();
    x.fillStyle = '#efe5cf';
    x.beginPath(); x.moveTo(tx - w / 2, ty); x.lineTo(tx - w * 0.25, ty - h); x.lineTo(tx + w * 0.3, ty - h * 1.02); x.lineTo(tx + w / 2, ty - 2); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#ddd0b4'; x.beginPath(); x.moveTo(tx + w * 0.3, ty - h * 1.02); x.lineTo(tx + w / 2, ty - 2); x.lineTo(tx + w * 0.6, ty - h * 0.3); x.closePath(); x.fill(); x.stroke();
    x.lineWidth = 0.7; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(tx - w / 2 + i * w / 5, ty); x.lineTo(tx - w * 0.25 + i * w * 0.11, ty - h); x.stroke(); }
    x.lineWidth = 1.2; x.fillStyle = '#5a4430'; x.beginPath(); x.moveTo(tx - 4, ty); x.lineTo(tx, ty - h * 0.55); x.lineTo(tx + 4, ty); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(tx - w * 0.25, ty - h); x.lineTo(tx - w * 0.25, ty - h - 5); x.moveTo(tx + w * 0.3, ty - h); x.lineTo(tx + w * 0.3, ty - h - 5); x.stroke();
    if (big) { x.beginPath(); x.moveTo(tx, ty - h); x.lineTo(tx, ty - h - 22); x.stroke(); x.fillStyle = Game.S.player.color; x.beginPath(); x.moveTo(tx, ty - h - 22); x.lineTo(tx + 14, ty - h - 18); x.lineTo(tx, ty - h - 14); x.closePath(); x.fill(); x.stroke(); }
  },
  drawField(x, fx, fy) {
    x.save(); x.translate(fx, fy);
    x.strokeStyle = INK; x.lineWidth = 1.2; x.fillStyle = '#d9c48c';
    x.beginPath(); x.moveTo(-40, -14); x.lineTo(32, -20); x.lineTo(44, 14); x.lineTo(-30, 20); x.closePath(); x.fill(); x.stroke();
    x.strokeStyle = '#4f6b3a'; x.lineWidth = 1;
    for (let r = -10; r <= 12; r += 6) for (let c = -32; c <= 34; c += 7) { const px = c + r * 0.3, py = r - c * 0.08; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 2, py - 5); x.moveTo(px, py); x.lineTo(px + 2, py - 5); x.stroke(); }
    x.strokeStyle = INK; x.lineWidth = 1; x.beginPath();
    for (const [a, b] of [[[-44, -16], [36, -22]], [[36, -22], [48, 16]]]) { x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); }
    x.stroke();
    x.restore();
  },
  drawBld(x, b) {
    const era = this.L.era, rel = Game.S.player.religion;
    const dmg = this._st === 'after' && this.afterAge < 10 && (b.i || 0) % 5 === 0;
    if (b.b === 'saray') { if (era === 'tent') this.drawTent(x, b.x, b.y, 80, 52, true); else Town.draw(x, 'saray', b.x, b.y + 4, 2.1, 0, rel); return; }
    if (b.b === 'ev') { if (era === 'tent') { if (dmg) this.collapsed(x, b.x, b.y); else this.drawTent(x, b.x, b.y, 60, 38); } else Town.draw(x, 'ev', b.x, b.y + 4, 1.7, 0, rel); return; }
    if (b.b === 'konak') { if (era === 'tent') this.drawTent(x, b.x, b.y, 72, 46); else Town.draw(x, 'konak', b.x, b.y + 4, 1.6, 0, rel); return; }
    Town.draw(x, b.b, b.x, b.y + 4, 1.7, 0, rel, b.i);
  },
  collapsed(x, tx, ty) {
    x.strokeStyle = INK; x.lineWidth = 1.3; x.fillStyle = '#d8ccb2';
    x.beginPath(); x.moveTo(tx - 24, ty); x.lineTo(tx - 6, ty - 9); x.lineTo(tx + 12, ty - 4); x.lineTo(tx + 24, ty); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(tx - 10, ty - 6); x.lineTo(tx + 16, ty - 18); x.stroke();
  },
  drawProp(x, o) {
    const { type } = o, ox = o.x, oy = o.y;
    x.strokeStyle = INK; x.lineWidth = 1.4;
    if (type === 'fire') {
      x.fillStyle = '#8b6a46';
      for (let i = 0; i < 5; i++) { x.save(); x.translate(ox, oy); x.rotate(i * 1.25); x.fillRect(-14, -2.5, 28, 5); x.strokeRect(-14, -2.5, 28, 5); x.restore(); }
      const lit = this._st !== 'after' || this.afterAge > 3;
      if (lit) { for (let i = 0; i < 4; i++) { const f = Math.sin(this.t * 9 + i * 2) * 3; x.fillStyle = i % 2 ? '#ffb347' : '#ff7b1c'; x.beginPath(); x.moveTo(ox - 9 + i * 5, oy - 2); x.quadraticCurveTo(ox - 6 + i * 4 + f, oy - 18 - i * 3, ox - 3 + i * 4, oy - 26 - (i % 2) * 6 + f); x.quadraticCurveTo(ox + i * 3, oy - 10, ox + 2 + i * 3, oy - 2); x.closePath(); x.fill(); } this.smoke(x, ox, oy - 28); }
      x.fillStyle = '#9b7a52'; x.fillRect(ox - 34, oy + 18, 26, 6); x.strokeRect(ox - 34, oy + 18, 26, 6);
    } else if (type === 'well') {
      x.fillStyle = '#d8ccb0'; x.beginPath(); x.ellipse(ox, oy, 18, 8, 0, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.rect(ox - 18, oy - 12, 36, 12); x.fill(); x.stroke();
      x.lineWidth = 0.7; for (let i = -14; i < 18; i += 7) { x.beginPath(); x.moveTo(ox + i, oy - 12); x.lineTo(ox + i, oy); x.stroke(); }
      x.lineWidth = 1.6; x.beginPath(); x.moveTo(ox - 16, oy - 10); x.lineTo(ox - 10, oy - 48); x.moveTo(ox + 16, oy - 10); x.lineTo(ox + 10, oy - 48); x.moveTo(ox - 13, oy - 46); x.lineTo(ox + 13, oy - 46); x.stroke();
      x.lineWidth = 1; x.beginPath(); x.moveTo(ox, oy - 46); x.lineTo(ox, oy - 26); x.stroke(); x.fillStyle = '#9b7a52'; x.fillRect(ox - 4, oy - 26, 8, 7); x.strokeRect(ox - 4, oy - 26, 8, 7);
    } else if (type === 'logs') {
      x.fillStyle = '#b38d60';
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { const lx = ox - 20 + i * 12 + r * 6, ly = oy - r * 9; x.beginPath(); x.ellipse(lx, ly, 6, 5, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.arc(lx, ly, 2, 0, 7); x.stroke(); }
    } else if (type === 'pen') {
      x.lineWidth = 1.2; x.beginPath();
      for (const [a, b] of [[[-50, -20], [50, -26]], [[50, -26], [56, 18]], [[56, 18], [-44, 24]], [[-44, 24], [-50, -20]]]) { x.moveTo(a[0] + ox, a[1] + oy); x.lineTo(b[0] + ox, b[1] + oy); x.moveTo(a[0] + ox, a[1] + oy - 6); x.lineTo(b[0] + ox, b[1] + oy - 6); }
      x.stroke();
      for (const [hx, hy, d] of [[-18, -2, 1], [16, 6, -1]]) this.horse(x, ox + hx, oy + hy, d);
    } else if (type === 'crates') {
      x.fillStyle = '#c9a877';
      for (const [cx2, cy2] of [[-14, 0], [2, 2], [-6, -10], [16, -4]]) { x.fillRect(ox + cx2 - 7, oy + cy2 - 7, 14, 12); x.strokeRect(ox + cx2 - 7, oy + cy2 - 7, 14, 12); x.beginPath(); x.moveTo(ox + cx2 - 7, oy + cy2 - 7); x.lineTo(ox + cx2 + 7, oy + cy2 + 5); x.stroke(); }
    }
  },
  horse(x, hx, hy, d) {
    x.save(); x.translate(hx, hy); x.scale(d * 0.9, 0.9);
    x.strokeStyle = INK; x.lineWidth = 1.6; x.fillStyle = '#8f7457';
    for (const lx of [-9, -5, 7, 11]) { x.beginPath(); x.moveTo(lx, -10); x.lineTo(lx, 0); x.stroke(); }
    x.beginPath(); x.ellipse(1, -14, 13, 6, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(11, -17); x.lineTo(17, -27); x.lineTo(22, -24); x.lineTo(16, -15); x.closePath(); x.fill(); x.stroke();
    x.restore();
  },
  drawPerson(x, a) {
    const kind = a.kind, walk = Math.sin(a.ph);
    const k = kind === 'child' ? 0.42 : 0.6;
    let onTower = a.post === 'tower';
    x.save(); x.translate(a.x, a.y - (onTower ? 56 : 0)); x.scale(k * (a.dir || 1), k);
    x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = 2.6;
    if (!onTower) { x.fillStyle = 'rgba(43,32,24,0.18)'; x.beginPath(); x.ellipse(0, 0, 9, 3, 0, 0, 7); x.fill(); }
    const lean = kind === 'elder' ? 4 : 0;
    const swing = a.swing > 0 ? 1 : 0;
    if (kind === 'woman') {
      x.fillStyle = '#8b3a36'; x.beginPath(); x.moveTo(-1, -36); x.lineTo(-9, 0); x.lineTo(9, 0); x.lineTo(2, -36); x.closePath(); x.fill(); x.lineWidth = 1.4; x.stroke(); x.lineWidth = 2.4;
      x.beginPath(); x.moveTo(1, -32); x.lineTo(8, -22); x.moveTo(1, -32); x.lineTo(-6, -22); x.stroke();
      if (a.carry) { x.fillStyle = '#c9a877'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(9, -20, 5, 4, 0, 0, 7); x.fill(); x.stroke(); x.lineWidth = 2.4; }
      x.fillStyle = '#f6ecd4'; x.lineWidth = 1.8; x.beginPath(); x.arc(2, -43, 6, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#e8dcc2'; x.beginPath(); x.moveTo(-5, -38); x.quadraticCurveTo(-6, -51, 2, -51); x.quadraticCurveTo(9, -51, 8, -42); x.lineTo(7, -36); x.lineTo(-6, -33); x.closePath(); x.fill(); x.stroke();
    } else {
      // bacaklar
      x.beginPath(); x.moveTo(lean, -20); x.lineTo(walk * 6, 0); x.moveTo(lean, -20); x.lineTo(-walk * 6, 0); x.stroke();
      x.beginPath(); x.moveTo(lean, -20); x.lineTo(lean * 1.8, -38); x.stroke();
      const col = kind === 'enemy' ? this.enemyColor || '#555' : kind === 'slave' ? '#8a8a8a' : Game.S.player.color;
      x.strokeStyle = col; x.lineWidth = 3.2; x.beginPath(); x.moveTo(lean + 0.3, -23); x.lineTo(lean * 1.8 + 0.6, -35); x.stroke();
      x.strokeStyle = INK; x.lineWidth = 2.4;
      const sh = lean * 1.8;
      if (kind === 'soldier' || kind === 'enemy') {
        const ang = swing ? -1.6 : -0.9;
        x.beginPath(); x.moveTo(sh + 1, -34); x.lineTo(sh + 9, -26); x.stroke();
        x.save(); x.translate(sh + 9, -26); x.rotate(ang); x.lineWidth = 1.8; x.beginPath(); x.moveTo(-14, 0); x.lineTo(28, 0); x.stroke(); x.fillStyle = INK; x.beginPath(); x.moveTo(28, -2.5); x.lineTo(35, 0); x.lineTo(28, 2.5); x.closePath(); x.fill(); x.restore();
        if (kind === 'enemy') { x.fillStyle = '#d9cdb2'; x.lineWidth = 1.3; x.beginPath(); x.arc(sh - 6, -26, 7, 0, 7); x.fill(); x.stroke(); }
      } else if (kind === 'elder') {
        x.beginPath(); x.moveTo(sh + 1, -34); x.lineTo(sh + 10, -24); x.stroke();
        x.strokeStyle = '#5a3d22'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(sh + 10, -26); x.lineTo(sh + 13, 0); x.stroke(); x.strokeStyle = INK; x.lineWidth = 2.4;
      } else {
        x.beginPath(); x.moveTo(sh + 1, -34); x.lineTo(sh + 8 + walk * 2, -24); x.moveTo(sh + 1, -34); x.lineTo(sh - 6 - walk * 2, -24); x.stroke();
        if (a.carry && kind === 'man') { x.fillStyle = '#b38d60'; x.lineWidth = 1.2; x.fillRect(sh - 4, -50, 14, 6); x.strokeRect(sh - 4, -50, 14, 6); x.lineWidth = 2.4; }
      }
      const hy = -44;
      x.fillStyle = '#f6ecd4'; x.lineWidth = 1.8; x.beginPath(); x.arc(sh + 2, hy, 6.5, 0, 7); x.fill(); x.stroke();
      x.fillStyle = INK; x.beginPath(); x.arc(sh + 4.6, hy - 0.5, 1, 0, 7); x.fill();
      if (kind === 'elder') { x.fillStyle = '#f4f0e6'; x.beginPath(); x.moveTo(sh - 2, hy + 2); x.quadraticCurveTo(sh + 2, hy + 14, sh + 7, hy + 2); x.fill(); x.lineWidth = 1; x.stroke(); }
      else if (kind === 'man' && a.id % 3 === 0) { x.fillStyle = INK; x.beginPath(); x.arc(sh + 2.5, hy + 3, 4, 0.1, Math.PI - 0.1); x.fill(); }
      const hat = kind === 'enemy' ? (a.hat || 'eskiya') : kind === 'slave' ? 'yok' : kind === 'child' ? (a.id % 2 ? Game.S.player.headgear : 'yok') : Game.S.player.headgear;
      if (hat && hat !== 'yok') Hats.draw(x, HAT_ALIAS[hat] || hat, sh + 2, hy, col);
    }
    x.restore();
  },
  drawBody(x, b) {
    x.save(); x.translate(b.x, b.y); x.rotate(b.rot); x.scale(0.58, 0.58);
    x.strokeStyle = INK; x.lineWidth = 2.4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, -20); x.lineTo(5, 0); x.moveTo(0, -20); x.lineTo(-5, 0); x.moveTo(0, -20); x.lineTo(1, -38); x.moveTo(1, -35); x.lineTo(10, -28); x.moveTo(1, -35); x.lineTo(-6, -26); x.stroke();
    x.strokeStyle = b.enemy ? (this.enemyColor || '#555') : Game.S.player.color; x.lineWidth = 3.2; x.beginPath(); x.moveTo(0.3, -23); x.lineTo(0.9, -35); x.stroke();
    x.fillStyle = '#f6ecd4'; x.strokeStyle = INK; x.lineWidth = 1.8; x.beginPath(); x.arc(2, -45, 6.5, 0, 7); x.fill(); x.stroke();
    x.lineWidth = 1.1; x.beginPath(); x.moveTo(3, -47); x.lineTo(6, -44); x.moveTo(6, -47); x.lineTo(3, -44); x.stroke();
    const hat = b.enemy ? (b.hat || this.afterHat || 'eskiya') : Game.S.player.headgear;
    if (hat && hat !== 'yok') Hats.draw(x, HAT_ALIAS[hat] || hat, 2, -45, '#555');
    for (let i = 0; i < (b.arrows || 0); i++) Battle.stuckArrow(x, 0.6, -30 + i * 6, { tx: 1, a: 0.4 + i * 0.2 });
    x.restore();
  },

  /* ================== ETKİLEŞİM ================== */
  tap(wx, wy) {
    if (!this.buildSel) return;
    const s = this.sett();
    let best = null, bd = 40;
    for (const sl of this.slots) { const d = Math.hypot(sl.x - wx, (sl.y - wy) * 1.5); if (d < bd) { bd = d; best = sl; } }
    if (!best) return;
    UI.curCity = s.id; UI.buildSel = this.buildSel;
    UI.tile(best.i, true);
    this.layout(true);
  },
  showPalette(cat) {
    const el = document.getElementById('vbuild');
    const cats = { tent: ['ev', 'konak'], prod: ['demirci', 'pazar', 'kervan'], farm: ['tarla'], store: ['hazine'], def: ['kule', 'sur', 'kisla', 'mabet'] };
    if (!cat || this.cat === cat) { this.cat = null; this.buildSel = null; el.classList.remove('show'); return; }
    this.cat = cat; this.buildSel = null;
    const era = this.L && this.L.era === 'tent';
    el.innerHTML = cats[cat].map(k => {
      const B = BUILDINGS[k], name = k === 'ev' && era ? 'Çadır' : k === 'konak' && era ? 'Büyük Çadır' : k === 'mabet' ? RELIGIONS[Game.S.player.religion].temple : B.name;
      return `<button data-k="${k}"><canvas width="60" height="50" data-b="${k}"></canvas><b>${name}</b><small>💰${B.cost}</small></button>`;
    }).join('') + `<button data-k="yik"><span style="font-size:24px">🔨</span><b>Yık</b><small>%50 iade</small></button>`;
    el.classList.add('show');
    el.querySelectorAll('canvas[data-b]').forEach(c => Town.draw(c.getContext('2d'), c.dataset.b, 30, 44, 1.1, 0, Game.S.player.religion));
    el.querySelectorAll('button').forEach(b => b.onclick = () => {
      this.buildSel = this.buildSel === b.dataset.k ? null : b.dataset.k;
      el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.k === this.buildSel));
      if (this.buildSel) toast(this.buildSel === 'yik' ? 'Yıkılacak binaya dokun.' : 'Kesikli yuvarlaklardan birine dokun.');
    });
  },
  hud() {
    const s = this.sett(); if (!s) return;
    const S = Game.S, p = s.pop, st = this._st || this.state();
    document.getElementById('vtl').innerHTML = `<i class="flag" style="--c:${S.player.color}">${Battle.emblem()}</i>
      <span>💰<b>${fmt(S.player.gold)}</b></span><span>👨<b>${fmt(p.m)}</b></span><span>👩<b>${fmt(p.w)}</b></span><span>👴<b>${fmt(p.e)}</b></span><span>🧒<b>${fmt(p.c)}</b></span>${p.s > 0.5 ? `<span>⛓<b>${fmt(p.s)}</b></span>` : ''}<span>⚔<b>${fmt(Game.count(s.garrison))}</b></span><span>🏠<b>${fmt(Game.totalPop(s))}/${fmt(Game.capacity(s))}</b></span>`;
    document.getElementById('vtr').innerHTML = `<b>${esc(s.name)}</b> · Gün ${S.day} <button class="spd ${S.speed === 0 ? 'on' : ''}" onclick="UI.setSpeed(0);Village.hud()">⏸</button><button class="spd ${S.speed === 1 ? 'on' : ''}" onclick="UI.setSpeed(1);Village.hud()">▶</button><button class="spd ${S.speed === 3 ? 'on' : ''}" onclick="UI.setSpeed(3);Village.hud()">⏩</button><button class="spd" onclick="Village.close()">✕</button>`;
    const ban = document.getElementById('vbanner');
    if (st === 'attack') ban.innerHTML = `⚔️ Köy saldırı altında! <button onclick="Village.fight()">🕹️ Savaşı Yönet</button>`;
    else if (st === 'approach') ban.innerHTML = '⚠️ Düşman ordusu köye yaklaşıyor! Askerler mevzide.';
    else if (st === 'after') ban.innerHTML = `🕯️ Köy ${this.afterAge} gün önce saldırıya uğradı (${s.after.won ? 'savunma başarılı' : 'ağır kayıp'}). Halk yaraları sarıyor.`;
    else ban.innerHTML = '';
    ban.style.display = ban.innerHTML ? '' : 'none';
  },
  fight() {
    const cfg = Game.pending[0];
    if (!cfg) return;
    this.close();
    UI.battlePrompt(cfg);
  }
};
