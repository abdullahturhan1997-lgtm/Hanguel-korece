/* ==========================================================
   FETİH — Canlı köy görünümü
   - Surları oyuncu elle çizer: Çit → Ahşap Sur → Taş Sur (seviyeli)
   - Kuleler istenen yere konur (surların arasına ya da başka yere)
   - Askerler kendiliğinden kulelere ve ahşap/taş surlara dağılır;
     kalanlar sarayın önündeki içtima alanında, kralın sağında solunda
   - Düşman bu köye saldırır; savaş da bu köyün üstünde geçer
   - Başta çadırlar; nüfus arttıkça evler
   ========================================================== */
'use strict';

const VW = 2400, VH = 1100;          // savaş alanı ile aynı ölçü (BH = 1100)
const WALL_LV = {
  1: { name: 'Çit', cost: 2, hp: 4, men: false, icon: '🚧' },
  2: { name: 'Ahşap Sur', cost: 6, hp: 10, men: true, icon: '🪵' },
  3: { name: 'Taş Sur', cost: 15, hp: 25, men: true, icon: '🧱' }
};
const TOWER_COST = 180, TOWER_MEN = 2;
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function segLen(w) { return Math.hypot(w.x2 - w.x1, w.y2 - w.y1); }
function distToSeg(px, py, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - w.x1) * dx + (py - w.y1) * dy) / L2, 0, 1);
  return Math.hypot(px - (w.x1 + dx * t), py - (w.y1 + dy * t));
}
function segCross(ax, ay, bx, by, w) {
  const d = (bx - ax) * (w.y2 - w.y1) - (by - ay) * (w.x2 - w.x1);
  if (Math.abs(d) < 1e-9) return false;
  const u = ((w.x1 - ax) * (w.y2 - w.y1) - (w.y1 - ay) * (w.x2 - w.x1)) / d;
  const v = ((w.x1 - ax) * (by - ay) - (w.y1 - ay) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

const Village = {
  active: false, cv: null, ctx: null, W: 0, H: 0, dpr: 1, cam: { x: VW / 2, y: VH / 2, z: 1 },
  sid: null, agents: [], enemies: [], bodies: [], t: 0, tool: null, drag: null, cache: {},

  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    window.addEventListener('resize', () => { if (this.active) { this.resize(); this.clampCam(); } });
    const pts = new Map(); let pan = null, pinch = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr]; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); const p = pos(e); pts.set(e.pointerId, p);
      if (pts.size === 1) {
        const w = this.toWorld(p[0], p[1]);
        if (this.tool && this.tool[0] === 'w') { const sp = this.snap(w[0], w[1]); this.drag = { x1: sp[0], y1: sp[1], x2: sp[0], y2: sp[1] }; pan = null; }
        else pan = { sx: p[0], sy: p[1], cx: this.cam.x, cy: this.cam.y, t: performance.now(), moved: false };
      }
      if (pts.size === 2) { this.drag = null; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.cam.z, wc: this.toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; pan = null; }
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const p = pos(e); pts.set(e.pointerId, p);
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        this.cam.z = pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(10, pinch.d); this.clampCam();
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this.cam.x = pinch.wc[0] - (mx - this.W / 2) / this.cam.z; this.cam.y = pinch.wc[1] - (my - this.H / 2) / this.cam.z; this.clampCam();
      } else if (this.drag) {
        const w = this.toWorld(p[0], p[1]), sp = this.snap(w[0], w[1], this.drag);
        this.drag.x2 = sp[0]; this.drag.y2 = sp[1];
      } else if (pan) {
        const dx = p[0] - pan.sx, dy = p[1] - pan.sy;
        if (Math.abs(dx) + Math.abs(dy) > 12 * this.dpr) pan.moved = true;
        if (pan.moved) { this.cam.x = pan.cx - dx / this.cam.z; this.cam.y = pan.cy - dy / this.cam.z; this.clampCam(); }
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return; const p = pos(e); pts.delete(e.pointerId);
      if (this.drag && !pts.size) { const d = this.drag; this.drag = null; this.buildWall(d, +this.tool[1]); }
      else if (pan && !pan.moved && performance.now() - pan.t < 500) this.tap(...this.toWorld(p[0], p[1]));
      if (pts.size < 2) pinch = null; if (!pts.size) pan = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pan = null; pinch = null; this.drag = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e), wc = this.toWorld(p[0], p[1]); this.cam.z *= e.deltaY < 0 ? 1.15 : 1 / 1.15; this.clampCam(); this.cam.x = wc[0] - (p[0] - this.W / 2) / this.cam.z; this.cam.y = wc[1] - (p[1] - this.H / 2) / this.cam.z; this.clampCam(); }, { passive: false });
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth * this.dpr; this.H = this.cv.clientHeight * this.dpr;
    this.cv.width = this.W; this.cv.height = this.H;
  },
  minZ() { return Math.max(this.W / VW, this.H / VH); },
  clampCam() { const c = this.cam; c.z = clamp(c.z, this.minZ(), this.H / 280); const hw = this.W / c.z / 2, hh = this.H / c.z / 2; c.x = clamp(c.x, hw, VW - hw); c.y = clamp(c.y, hh, VH - hh); },
  toWorld(sx, sy) { const c = this.cam; return [(sx - this.W / 2) / c.z + c.x, (sy - this.H / 2) / c.z + c.y]; },
  sett() { return Game.sett(this.sid); },

  open(id) {
    const s = Game.sett(id);
    if (!s || s.owner !== P) return;
    this.ensure(s);
    this.sid = id; this.active = true; this.tool = null; this.drag = null; this._st = null;
    document.getElementById('village').classList.add('show');
    document.getElementById('village-ui').classList.add('show');
    document.getElementById('hud').classList.add('hide');
    UI.hideCard();
    this.resize();
    this.L = this.prepare(s, true);
    this.spawnPeople();
    this.cam.z = this.minZ() * 1.35; this.cam.x = this.L.cx; this.cam.y = this.L.cy; this.clampCam();
    this.hud(); this.showPalette(null);
    SFX.click();
  },
  close() {
    this.active = false; this.tool = null; this.drag = null;
    document.getElementById('village').classList.remove('show');
    document.getElementById('village-ui').classList.remove('show');
    document.getElementById('hud').classList.remove('hide');
    document.getElementById('vbuild').classList.remove('show');
    UI.promptOpen = false;
  },
  ensure(s) { if (!s.vwalls) s.vwalls = []; if (!s.vtowers) s.vtowers = []; },

  /* ================== YERLEŞİM ==================
     Şehir dizaynı ızgarası geniş bir alana yayılır. Sarayın önü içtima alanıdır. */
  prepare(s, force) {
    this.ensure(s);
    const pop = Game.totalPop(s);
    const key = [pop >= 90, s.grid.join(',')].join('|');
    const old = this.cache[s.id];
    if (old && old.key === key && !force) return old;
    const cx = VW / 2, cy = VH / 2 + 10, SPX = 165, SPY = 100;
    const L = { key, cx, cy, era: pop >= 90 ? 'house' : 'tent', blds: [], slots: [], props: [], trees: [] };
    const posOf = (gx, gy) => [cx + (gx - 4) * SPX + (gy % 2) * 18, cy - 40 + (gy - 3) * SPY + (gy >= 4 ? 150 : 0)];
    s.grid.forEach((b, i) => {
      const gx = i % GRID_W, gy = Math.floor(i / GRID_W);
      const [x, y] = posOf(gx, gy);
      L.slots.push({ i, x, y });
      if (b) L.blds.push({ b, x, y, i });
    });
    const pal = posOf(4, 3);
    L.palace = { x: pal[0], y: pal[1] };
    L.parade = { x: cx, y: pal[1] + 110, w: 640, h: 120 };
    const pd = L.parade, rnd = seeded(hashStr(s.id));
    const free = (px, py, r) => !L.blds.some(o => Math.hypot(o.x - px, (o.y - py) * 1.4) < r) && !(Math.abs(px - pd.x) < pd.w / 2 + 30 && Math.abs(py - pd.y) < pd.h / 2 + 30);
    const spot = (px, py, r) => { for (let k = 0; k < 80; k++) { const a = k * 2.4, d = k * 8; const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d * 0.6; if (free(x, y, r)) return [x, y]; } return [px, py]; };
    const add = (type, px, py, r) => { const [x, y] = spot(px, py, r); L.props.push({ type, x, y }); L.blds.push({ b: '_' + type, x, y }); };
    add('fire', cx + 250, cy - 120, 80);
    add('well', cx - 300, cy - 110, 70);
    add('logs', cx + 420, cy + 40, 60);
    if (pop > 30) add('pen', cx - 520, cy + 60, 100);
    if (pop > 50) add('crates', cx + 560, cy - 140, 70);
    L.blds = L.blds.filter(o => !o.b.startsWith('_'));
    for (let i = 0; i < 90; i++) {
      const x = rnd() * VW, y = rnd() * VH;
      if (x > 330 && x < VW - 330 && y > 140 && y < VH - 120) continue;
      if (x < 420 && y > VH - 260) continue;
      L.trees.push({ x, y, s: 10 + rnd() * 9, pine: rnd() < 0.45 });
    }
    L.ground = this.buildGround(L, s);
    this.cache[s.id] = L;
    return L;
  },
  buildGround(L, s) {
    const c = document.createElement('canvas'); c.width = VW; c.height = VH;
    const x = c.getContext('2d'), rnd = seeded(hashStr(s.id) + 7);
    const g = x.createRadialGradient(VW / 2, VH / 2, 100, VW / 2, VH / 2, VW * 0.65);
    g.addColorStop(0, '#eedcb2'); g.addColorStop(1, '#d6bd88');
    x.fillStyle = g; x.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 12000; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,30' : '255,250,235'},${0.03 + rnd() * 0.06})`; x.fillRect(rnd() * VW, rnd() * VH, 1 + rnd() * 2, 1 + rnd() * 2); }
    x.strokeStyle = 'rgba(43,32,24,0.35)'; x.lineWidth = 0.9; x.lineCap = 'round';
    for (let i = 0; i < 900; i++) { const px = rnd() * VW, py = rnd() * VH; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 2, py - 5); x.moveTo(px, py); x.lineTo(px + 2, py - 6); x.stroke(); }
    x.fillStyle = 'rgba(205,180,130,0.5)'; x.beginPath(); x.ellipse(L.cx, L.cy, 860, 430, 0, 0, 7); x.fill();
    const pd = L.parade;
    x.fillStyle = 'rgba(190,165,115,0.55)'; x.strokeStyle = 'rgba(43,32,24,0.45)'; x.lineWidth = 1.4; x.setLineDash([8, 6]);
    x.beginPath(); x.rect(pd.x - pd.w / 2, pd.y - pd.h / 2, pd.w, pd.h); x.fill(); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(43,32,24,0.45)'; x.font = 'italic 16px Georgia, serif'; x.textAlign = 'center'; x.fillText('İçtima Alanı', pd.x, pd.y + pd.h / 2 + 18);
    x.strokeStyle = 'rgba(43,32,24,0.35)'; x.lineWidth = 1.2;
    for (const off of [-10, 10]) { x.beginPath(); x.moveTo(L.cx + off, L.cy); x.quadraticCurveTo(L.cx + 500, L.cy + 300 + off, VW, VH * 0.85 + off); x.stroke(); x.beginPath(); x.moveTo(L.cx, L.cy + off); x.quadraticCurveTo(L.cx - 500, L.cy - 250 + off, 0, VH * 0.25 + off); x.stroke(); }
    x.fillStyle = 'rgba(150,180,190,0.75)';
    x.beginPath(); x.moveTo(0, VH - 300); x.quadraticCurveTo(220, VH - 230, 330, VH - 120); x.quadraticCurveTo(380, VH - 50, 420, VH); x.lineTo(0, VH); x.closePath(); x.fill();
    x.strokeStyle = '#2b2018'; x.lineWidth = 1.8;
    x.beginPath(); x.moveTo(0, VH - 300); x.quadraticCurveTo(220, VH - 230, 330, VH - 120); x.quadraticCurveTo(380, VH - 50, 420, VH); x.stroke();
    x.save(); x.translate(250, VH - 175); x.rotate(-0.5);
    x.fillStyle = '#c9a877'; x.lineWidth = 1.3; x.fillRect(-60, -12, 80, 24); x.strokeRect(-60, -12, 80, 24);
    for (let i = -56; i < 20; i += 7) { x.beginPath(); x.moveTo(i, -12); x.lineTo(i, 12); x.stroke(); }
    x.restore();
    x.save(); x.translate(140, VH - 90); x.rotate(0.3);
    x.fillStyle = '#b08a5a'; x.lineWidth = 1.4;
    x.beginPath(); x.moveTo(-40, 0); x.quadraticCurveTo(0, 22, 40, 0); x.lineTo(30, -6); x.lineTo(-30, -6); x.closePath(); x.fill(); x.stroke();
    x.restore();
    const vg = x.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VW * 0.62);
    vg.addColorStop(0, 'rgba(90,60,30,0)'); vg.addColorStop(1, 'rgba(90,60,30,0.28)');
    x.fillStyle = vg; x.fillRect(0, 0, VW, VH);
    return c;
  },

  /* Savaş için durağan katman: zemin + binalar + ağaçlar (surlar ve kuleler hariç) */
  renderStatic(s) {
    const L = this.prepare(s, true);
    const c = document.createElement('canvas'); c.width = VW; c.height = VH;
    const x = c.getContext('2d');
    x.drawImage(L.ground, 0, 0);
    for (const b of L.blds) if (b.b === 'tarla') this.drawField(x, b.x, b.y);
    const list = [];
    for (const t of L.trees) list.push({ y: t.y, d: () => t.pine ? Battle.pine(x, t.x, t.y, t.s) : Battle.tree(x, t.x, t.y, t.s * 0.8) });
    for (const b of L.blds) if (b.b !== 'tarla') list.push({ y: b.y, d: () => this.drawBld(x, b, L) });
    for (const o of L.props) list.push({ y: o.y, d: () => this.drawProp(x, o, true) });
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
    return { canvas: c, L };
  },

  /* Nöbet yerleri: önce kuleler, sonra ahşap/taş surlar */
  posts(s, segs) {
    segs = segs || s.vwalls;
    const out = [];
    s.vtowers.forEach((t, ti) => { for (let k = 0; k < TOWER_MEN; k++) out.push({ kind: 'tower', ti, x: t.x - 6 + k * 12, y: t.y + 2 }); });
    segs.forEach((w, si) => {
      if (!WALL_LV[w.lvl].men || w.hp <= 0) return;
      const n = Math.floor(segLen(w) / 24);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; out.push({ kind: 'wall', seg: si, x: lerp(w.x1, w.x2, t), y: lerp(w.y1, w.y2, t) }); }
    });
    return out;
  },
  /* İçtima: kral ortada, askerler sağlı sollu nizami saflarda */
  paradeSpots(L, n) {
    const pd = L.parade, out = [], cols = 12, sp = 15;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const col = k % cols, row = Math.floor(k / cols);
      out.push({ x: pd.x + side * (40 + col * sp), y: pd.y - pd.h / 2 + 22 + row * 16 });
    }
    return out;
  },

  /* ================== HALK ================== */
  pois() {
    const L = this.L, p = [];
    for (const b of L.blds) p.push([b.x + rand(-20, 20), b.y + rand(10, 22)]);
    for (const o of L.props) p.push([o.x + rand(-30, 30), o.y + rand(14, 30)]);
    p.push([L.cx + rand(-700, 700), L.cy + rand(-330, 330)]);
    return p;
  },
  spawnPeople() {
    const s = this.sett(), L = this.L;
    this.agents = [];
    const mk = (kind) => {
      const p = pick(this.pois());
      return { kind, x: p[0], y: p[1], tx: null, ty: null, wait: rand(0, 3), ph: rand(0, 6), dir: 1, sp: kind === 'child' ? rand(30, 55) : kind === 'elder' ? rand(10, 16) : rand(18, 28), carry: Math.random() < 0.25, id: uid() };
    };
    const n = k => Math.round(s.pop[k]);
    for (let i = 0; i < n('m'); i++) this.agents.push(mk('man'));
    for (let i = 0; i < n('w'); i++) this.agents.push(mk('woman'));
    for (let i = 0; i < n('e'); i++) this.agents.push(mk('elder'));
    for (let i = 0; i < n('c'); i++) this.agents.push(mk('child'));
    for (let i = 0; i < Math.min(40, n('s')); i++) this.agents.push(mk('slave'));
    // Askerler: kuleler → surlar → içtima
    const g = Math.min(220, Game.count(s.garrison));
    const posts = this.posts(s);
    const parade = this.paradeSpots(L, Math.max(0, g - posts.length));
    for (let i = 0; i < g; i++) {
      const sol = mk('soldier');
      const p = i < posts.length ? posts[i] : parade[i - posts.length];
      sol.post = i < posts.length ? p.kind : 'parade'; sol.seg = p.seg;
      sol.x = sol.hx = p.x; sol.y = sol.hy = p.y;
      this.agents.push(sol);
    }
    if (!Game.S.player.wounded) { const k = mk('king'); k.post = 'parade'; k.x = k.hx = L.parade.x; k.y = k.hy = L.parade.y - L.parade.h / 2 + 30; this.agents.push(k); }
    this.popKey = this.peopleKey();
  },
  peopleKey() { const s = this.sett(); return [Math.round(Game.totalPop(s)), Game.count(s.garrison), s.vwalls.length, s.vtowers.length, s.vwalls.map(w => w.lvl + (w.hp > 0 ? 'a' : 'b')).join('')].join(':'); },

  /* ================== GÜNCELLEME ================== */
  state() {
    const s = this.sett(), S = Game.S;
    if (Game.pending.some(c => c.context && c.context.type === 'defense' && c.context.settId === s.id) || s.attack) return 'attack';
    if (S.armies.find(a => a.owner !== P && a.targetType === 'sett' && a.targetId === s.id && dist(a.x, a.y, s.x, s.y) < 160)) return 'approach';
    if (s.after && S.day - s.after.day < 12) return 'after';
    return 'normal';
  },
  update(dt) {
    if (!this.active) return;
    const s = this.sett();
    if (!s || s.owner !== P) { this.close(); toast('Bu yerleşim artık senin değil.', 'bad'); return; }
    this.t += dt;
    const L2 = this.prepare(s);
    if (L2 !== this.L) { this.L = L2; this.spawnPeople(); }
    if (this.peopleKey() !== this.popKey) this.spawnPeople();
    const st = this.state();
    if (st !== this._st) { this._st = st; this.enterState(st); }
    const L = this.L;
    for (const a of this.agents) {
      if (a.kind === 'soldier' || a.kind === 'king') { this.walk(a, a.hx, a.hy, 40, dt); if (a.post === 'parade') a.dir = a.kind === 'king' ? 1 : (a.hx < L.parade.x ? 1 : -1); continue; }
      if (st === 'attack' || st === 'approach') { this.walk(a, L.palace.x + ((a.id % 13) - 6) * 12, L.palace.y + 40 + ((a.id % 7) - 3) * 9, a.sp * 2.2, dt); continue; }
      if (a.wait > 0) { a.wait -= dt; continue; }
      if (a.tx == null) {
        if (a.kind === 'child' && Math.random() < 0.5) { const o = this.agents[(a.id * 7) % this.agents.length]; a.tx = o.x + rand(-30, 30); a.ty = o.y + rand(-20, 20); }
        else { const p = pick(this.pois()); a.tx = p[0]; a.ty = p[1]; }
      }
      if (this.walk(a, a.tx, a.ty, a.sp, dt)) { a.tx = null; a.wait = a.kind === 'elder' ? rand(4, 10) : rand(1, 6); }
    }
    for (const e of this.enemies) this.walk(e, e.hx, e.hy, 28, dt);
    this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.hudT = 0.5; this.hud(); }
  },
  walk(a, tx, ty, sp, dt) {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    if (d < 3) return true;
    const st = Math.min(d, sp * dt);
    a.x += dx / d * st; a.y += dy / d * st; a.ph += st * 0.15; if (Math.abs(dx) > 0.5) a.dir = Math.sign(dx);
    return false;
  },
  spawnPoint(dir) {
    const cx = VW / 2, cy = VH / 2;
    const d = dir && Math.hypot(dir[0], dir[1]) > 0.01 ? dir : [1, 0.3], n = Math.hypot(d[0], d[1]);
    // Düşman köyün sağ ya da sol kenarından gelir; yönüne göre yukarı/aşağı kayar
    const side = d[0] >= 0 ? 1 : -1;
    return [side > 0 ? VW - 70 : 70, clamp(cy + d[1] / n * 420, 200, VH - 200)];
  },
  enterState(st) {
    const s = this.sett();
    this.enemies = []; this.bodies = []; this.groundArrows = [];
    if (st === 'attack' || st === 'approach') {
      const a = Game.S.armies.find(a => a.owner !== P && a.targetType === 'sett' && a.targetId === s.id);
      const att = s.attack || {};
      const n = att.n || (a ? Game.count(a.units) : 20);
      const owner = att.owner || (a && a.owner);
      const nn = Game.S.nations[owner];
      let hat = nn ? CULTURE_HAT[nn.culture] : 'eskiya';
      if (hat === Game.S.player.headgear) hat = 'sivri';
      const dir = att.dir || (a ? [a.x - s.x, a.y - s.y] : [1, 0.2]);
      const [px, py] = this.spawnPoint(dir);
      const side = px > this.L.cx ? 1 : -1;
      for (let i = 0; i < Math.min(120, n); i++) {
        const ex = px + rand(-100, 100), ey = py + rand(-150, 150);
        this.enemies.push({ kind: 'enemy', x: ex + side * 220, y: ey, hx: clamp(ex, 30, VW - 30), hy: clamp(ey, 30, VH - 30), hat, ph: rand(0, 6), dir: -side, id: uid() });
      }
      this.enemyColor = this.contrast(nn ? nn.color : '#3d3d3d');
    } else if (st === 'after') {
      const af = s.after, rnd = seeded(af.seed || 1);
      const age = Game.S.day - af.day;
      this.afterAge = age;
      const [px, py] = this.spawnPoint(af.dir);
      const nK = age < 8 ? Math.min(60, af.kills || 0) : 0, nL = age < 8 ? Math.min(30, af.losses || 0) : 0;
      for (let i = 0; i < nK + nL; i++) {
        const t = 0.25 + rnd() * 0.6;
        this.bodies.push({ x: lerp(px, this.L.cx, t) + (rnd() - 0.5) * 300, y: lerp(py, this.L.cy, t) + (rnd() - 0.5) * 260, enemy: i < nK, rot: (rnd() < 0.5 ? 1 : -1) * Math.PI / 2, arrows: Math.floor(rnd() * 3) });
      }
      if (age < 10) this.groundArrows = Array.from({ length: 90 }, () => { const t = 0.2 + rnd() * 0.7; return [lerp(px, this.L.cx, t) + (rnd() - 0.5) * 360, lerp(py, this.L.cy, t) + (rnd() - 0.5) * 300, rnd() * 6]; });
      this.enemyColor = this.contrast((Game.S.nations[af.owner] || {}).color || '#3d3d3d');
      this.afterHat = Game.S.nations[af.owner] ? CULTURE_HAT[Game.S.nations[af.owner].culture] : 'eskiya';
      if (this.afterHat === Game.S.player.headgear) this.afterHat = 'sivri';
    }
  },
  contrast(c) {
    const rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const a = rgb(Game.S.player.color), b = rgb(c);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 150 ? c : '#4a4f55';
  },

  /* ================== SUR VE KULE YAPIMI ================== */
  snap(wx, wy, drag) {
    const s = this.sett(); let best = null, bd = 26;
    const tryP = (x, y) => { const d = Math.hypot(x - wx, y - wy); if (d < bd) { bd = d; best = [x, y]; } };
    for (const w of s.vwalls) { tryP(w.x1, w.y1); tryP(w.x2, w.y2); }
    for (const t of s.vtowers) tryP(t.x, t.y);
    if (drag) tryP(drag.x1, drag.y1);
    return best || [clamp(wx, 20, VW - 20), clamp(wy, 20, VH - 20)];
  },
  wallCost(len, lvl) { return Math.ceil(len / 10 * WALL_LV[lvl].cost); },
  buildWall(d, lvl) {
    const s = this.sett(), len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
    if (len < 24) return;
    const parts = Math.ceil(len / 220), cost = this.wallCost(len, lvl);
    if (!Game.spend(cost)) return;
    for (let k = 0; k < parts; k++) {
      const a = k / parts, b = (k + 1) / parts;
      const w = { x1: lerp(d.x1, d.x2, a), y1: lerp(d.y1, d.y2, a), x2: lerp(d.x1, d.x2, b), y2: lerp(d.y1, d.y2, b), lvl };
      w.maxhp = w.hp = Math.round(segLen(w) * WALL_LV[lvl].hp);
      s.vwalls.push(w);
    }
    SFX.drum();
    toast(`${WALL_LV[lvl].icon} ${WALL_LV[lvl].name} yapıldı (${fmt(cost)} altın)`, 'good');
    this.hud(); UI.refreshTop();
  },
  nearestWall(wx, wy) {
    const s = this.sett(); let best = -1, bd = 22;
    s.vwalls.forEach((w, i) => { const d = distToSeg(wx, wy, w); if (d < bd) { bd = d; best = i; } });
    return best;
  },
  tap(wx, wy) {
    const s = this.sett(), tool = this.tool;
    if (!tool) return;
    if (tool === 'tower') {
      const [x, y] = this.snap(wx, wy);
      if (s.vtowers.some(t => Math.hypot(t.x - x, t.y - y) < 30)) { toast('Burada zaten kule var.', 'bad'); return; }
      if (!Game.spend(TOWER_COST)) return;
      s.vtowers.push({ x, y }); SFX.drum(); toast('🗼 Kule dikildi.', 'good');
    } else if (tool === 'up') {
      const i = this.nearestWall(wx, wy); if (i < 0) { toast('Yükseltmek için bir sura dokun.', 'bad'); return; }
      const w = s.vwalls[i];
      if (w.lvl >= 3) { toast('Bu sur zaten taş sur.', 'bad'); return; }
      const len = segLen(w), cost = this.wallCost(len, w.lvl + 1) - this.wallCost(len, w.lvl);
      if (!Game.spend(cost)) return;
      w.lvl++; w.maxhp = Math.round(len * WALL_LV[w.lvl].hp); w.hp = w.maxhp;
      SFX.drum(); toast(`⬆ ${WALL_LV[w.lvl].name} oldu (${fmt(cost)} altın)`, 'good');
    } else if (tool === 'del') {
      const ti = s.vtowers.findIndex(t => Math.hypot(t.x - wx, t.y - wy) < 26);
      if (ti >= 0) { s.vtowers.splice(ti, 1); Game.earn(TOWER_COST / 2, 'tax'); toast('Kule yıkıldı.'); }
      else {
        const i = this.nearestWall(wx, wy);
        if (i >= 0) { const w = s.vwalls[i]; Game.earn(this.wallCost(segLen(w), w.lvl) / 2, 'tax'); s.vwalls.splice(i, 1); toast('Sur kaldırıldı.'); }
        else {
          const sl = this.nearestSlot(wx, wy, true);
          if (sl) { UI.curCity = s.id; UI.buildSel = 'yik'; UI.tile(sl.i, true); this.L = this.prepare(s, true); this.spawnPeople(); }
        }
      }
    } else if (BUILDINGS[tool]) {
      const sl = this.nearestSlot(wx, wy, false);
      if (!sl) { toast('Kesikli yuvarlaklardan birine dokun.', 'bad'); return; }
      UI.curCity = s.id; UI.buildSel = tool; UI.tile(sl.i, true);
      this.L = this.prepare(s, true); this.spawnPeople();
    }
    this.hud(); UI.refreshTop();
  },
  nearestSlot(wx, wy, occupied) {
    const s = this.sett(); let best = null, bd = 50;
    for (const sl of this.L.slots) {
      const has = !!s.grid[sl.i];
      if (occupied ? (!has || s.grid[sl.i] === 'saray') : has) continue;
      const d = Math.hypot(sl.x - wx, (sl.y - wy) * 1.5); if (d < bd) { bd = d; best = sl; }
    }
    return best;
  },

  /* ================== ÇİZİM ================== */
  draw() {
    if (!this.active || !this.L) return;
    const x = this.ctx, c = this.cam, L = this.L, s = this.sett(), st = this._st;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#d6bd88'; x.fillRect(0, 0, this.W, this.H);
    x.setTransform(c.z, 0, 0, c.z, this.W / 2 - c.x * c.z, this.H / 2 - c.y * c.z);
    x.drawImage(L.ground, 0, 0);
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = INK; x.lineWidth = 1.1;
    for (const [ax, ay, ang] of this.groundArrows || []) { x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + Math.cos(ang) * 10, ay + Math.sin(ang) * 4 - 4); x.stroke(); }
    for (const b of L.blds) if (b.b === 'tarla') this.drawField(x, b.x, b.y);
    const list = [];
    for (const t of L.trees) list.push({ y: t.y, d: () => t.pine ? Battle.pine(x, t.x, t.y, t.s) : Battle.tree(x, t.x, t.y, t.s * 0.8) });
    for (const b of L.blds) if (b.b !== 'tarla') list.push({ y: b.y, d: () => this.drawBld(x, b, L) });
    for (const o of L.props) list.push({ y: o.y, d: () => this.drawProp(x, o, st === 'after' && this.afterAge < 3) });
    this.wallItems(x, s.vwalls, list);
    s.vtowers.forEach(t => list.push({ y: t.y + 1, d: () => this.drawTower(x, t.x, t.y, this.towerStone(t, s.vwalls)) }));
    for (const b of this.bodies) list.push({ y: b.y - 5, d: () => this.drawCorpse(x, b) });
    for (const a of this.agents) list.push({ y: a.y + (a.post === 'tower' ? 2 : a.post === 'wall' ? 1 : 0), d: () => this.drawPerson(x, a, s.vwalls) });
    for (const e of this.enemies) list.push({ y: e.y, d: () => this.drawPerson(x, e) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.d();
    if (st === 'after' && this.afterAge < 4) { const [px, py] = this.spawnPoint(s.after.dir); this.smoke(x, lerp(px, L.cx, 0.6), lerp(py, L.cy, 0.6)); }
    if (this.drag) {
      const d = this.drag, lvl = +this.tool[1], len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
      x.globalAlpha = 0.6; this.wallItems(x, [{ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, lvl, hp: 1, maxhp: 1 }], null); x.globalAlpha = 1;
      x.fillStyle = '#2b2018'; x.font = 'bold 16px Georgia, serif'; x.textAlign = 'center';
      x.fillText(`${WALL_LV[lvl].name} · 💰${fmt(this.wallCost(len, lvl))}`, (d.x1 + d.x2) / 2, (d.y1 + d.y2) / 2 - 40);
    }
    if (this.tool && BUILDINGS[this.tool]) for (const sl of L.slots) {
      if (s.grid[sl.i]) continue;
      x.strokeStyle = 'rgba(43,32,24,0.6)'; x.lineWidth = 1.5; x.setLineDash([5, 4]);
      x.beginPath(); x.ellipse(sl.x, sl.y, 26, 13, 0, 0, 7); x.stroke(); x.setLineDash([]);
    }
    if (this.tool === 'up' || this.tool === 'del') for (const w of s.vwalls) {
      x.strokeStyle = this.tool === 'del' ? 'rgba(170,30,20,0.45)' : 'rgba(200,150,30,0.55)'; x.lineWidth = 8;
      x.beginPath(); x.moveTo(w.x1, w.y1); x.lineTo(w.x2, w.y2); x.stroke();
    }
  },
  towerStone(t, walls) { return walls.some(w => w.lvl === 3 && distToSeg(t.x, t.y, w) < 30); },
  smoke(x, sx, sy) {
    for (let i = 0; i < 6; i++) { const k = ((this.t * 0.4 + i / 6) % 1); x.fillStyle = `rgba(110,100,90,${0.35 * (1 - k)})`; x.beginPath(); x.arc(sx + Math.sin(k * 6 + i) * 6 + k * 20, sy - k * 110, 6 + k * 16, 0, 7); x.fill(); }
  },

  /* Surlar küçük parçalar halinde, derinliğe göre çizilir. list verilmezse doğrudan çizer. */
  wallItems(x, walls, list) {
    walls.forEach((w, wi) => {
      const len = segLen(w), n = Math.max(1, Math.round(len / 14));
      const r = w.maxhp ? w.hp / w.maxhp : 1;
      for (let k = 0; k < n; k++) {
        const a = k / n, b = (k + 1) / n;
        const p = { x1: lerp(w.x1, w.x2, a), y1: lerp(w.y1, w.y2, a), x2: lerp(w.x1, w.x2, b), y2: lerp(w.y1, w.y2, b) };
        const h = ((wi * 31 + k * 17) % 97) / 97;
        const broken = w.hp <= 0 || (r < 0.6 && h > r / 0.6);
        const draw = () => this.drawWallPiece(x, p, w.lvl, broken, k);
        if (list) list.push({ y: Math.max(p.y1, p.y2), d: draw }); else draw();
      }
    });
  },
  drawWallPiece(x, p, lvl, broken, k) {
    x.strokeStyle = INK; x.lineJoin = 'round'; x.lineCap = 'round';
    if (broken) {
      x.fillStyle = lvl === 3 ? '#c8bca2' : '#9b7a52'; x.lineWidth = 1;
      const mx = (p.x1 + p.x2) / 2, my = (p.y1 + p.y2) / 2;
      if (lvl === 3) for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(mx - 5 + i * 5, my - (i % 2) * 3, 3 + (i % 2), 0, 7); x.fill(); x.stroke(); }
      else { x.save(); x.translate(mx, my); x.rotate(0.6 + (k % 3)); x.fillRect(-7, -1.5, 14, 3); x.strokeRect(-7, -1.5, 14, 3); x.restore(); }
      return;
    }
    if (lvl === 1) {
      x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(p.x1, p.y1); x.lineTo(p.x1, p.y1 - 11); x.stroke();
      x.lineWidth = 1.1; x.beginPath(); x.moveTo(p.x1, p.y1 - 4); x.lineTo(p.x2, p.y2 - 4); x.moveTo(p.x1, p.y1 - 9); x.lineTo(p.x2, p.y2 - 9); x.stroke();
    } else if (lvl === 2) {
      x.fillStyle = '#b38d60'; x.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const t = i / 2, sx = lerp(p.x1, p.x2, t), sy = lerp(p.y1, p.y2, t), h = 22 + ((k + i) % 3);
        x.beginPath(); x.moveTo(sx - 3, sy); x.lineTo(sx - 3, sy - h); x.lineTo(sx, sy - h - 4); x.lineTo(sx + 3, sy - h); x.lineTo(sx + 3, sy); x.closePath(); x.fill(); x.stroke();
      }
      x.strokeStyle = 'rgba(43,32,24,0.6)'; x.beginPath(); x.moveTo(p.x1, p.y1 - 8); x.lineTo(p.x2, p.y2 - 8); x.stroke();
    } else {
      const H = 28;
      x.lineWidth = 1.2; x.fillStyle = '#d8ccb0';
      x.beginPath(); x.moveTo(p.x1, p.y1); x.lineTo(p.x2, p.y2); x.lineTo(p.x2, p.y2 - H); x.lineTo(p.x1, p.y1 - H); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#e8dfca'; x.beginPath(); x.moveTo(p.x1, p.y1 - H); x.lineTo(p.x2, p.y2 - H); x.lineTo(p.x2, p.y2 - H - 7); x.lineTo(p.x1, p.y1 - H - 7); x.closePath(); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(43,32,24,0.45)'; x.lineWidth = 0.7;
      for (let yy = 7; yy < H; yy += 7) { x.beginPath(); x.moveTo(p.x1, p.y1 - yy); x.lineTo(p.x2, p.y2 - yy); x.stroke(); }
      const mx = (p.x1 + p.x2) / 2 + (k % 2 ? 3 : -3), my = (p.y1 + p.y2) / 2;
      x.beginPath(); x.moveTo(mx, my - 7); x.lineTo(mx, my - 14); x.moveTo(mx, my - 21); x.lineTo(mx, my - H); x.stroke();
      if (k % 2 === 0) { x.strokeStyle = INK; x.lineWidth = 1; x.fillStyle = '#e8dfca'; x.beginPath(); x.rect((p.x1 + p.x2) / 2 - 3, (p.y1 + p.y2) / 2 - H - 13, 6, 6); x.fill(); x.stroke(); }
    }
  },
  drawTower(x, tx, ty, stone) {
    x.strokeStyle = INK; x.lineWidth = 1.5;
    if (stone) {
      x.fillStyle = '#d8ccb0'; x.beginPath(); x.rect(tx - 15, ty - 62, 30, 62); x.fill(); x.stroke();
      x.lineWidth = 0.7; for (let yy = 8; yy < 60; yy += 8) { x.beginPath(); x.moveTo(tx - 15, ty - yy); x.lineTo(tx + 15, ty - yy); x.stroke(); }
      x.lineWidth = 1.3; x.fillStyle = '#e8dfca'; x.fillRect(tx - 18, ty - 70, 36, 8); x.strokeRect(tx - 18, ty - 70, 36, 8);
      for (let i = -18; i < 18; i += 8) { x.fillRect(i + tx, ty - 76, 5, 6); x.strokeRect(i + tx, ty - 76, 5, 6); }
      x.fillStyle = '#2b2018'; x.fillRect(tx - 2, ty - 44, 4, 10);
      return;
    }
    x.fillStyle = '#b38d60';
    x.beginPath(); x.moveTo(tx - 11, ty); x.lineTo(tx - 8, ty - 46); x.moveTo(tx + 11, ty); x.lineTo(tx + 8, ty - 46); x.moveTo(tx - 10, ty - 8); x.lineTo(tx + 9, ty - 30); x.moveTo(tx + 10, ty - 8); x.lineTo(tx - 9, ty - 30); x.stroke();
    x.lineWidth = 1; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(tx + 12, ty - i * 9); x.lineTo(tx + 17, ty - i * 9 - 3); x.stroke(); }
    x.beginPath(); x.moveTo(tx + 12, ty); x.lineTo(tx + 14, ty - 44); x.moveTo(tx + 16, ty); x.lineTo(tx + 18, ty - 44); x.stroke();
    x.lineWidth = 1.4; x.fillRect(tx - 13, ty - 56, 26, 10); x.strokeRect(tx - 13, ty - 56, 26, 10);
    x.fillStyle = '#9b7a52'; x.beginPath(); x.moveTo(tx - 16, ty - 66); x.lineTo(tx, ty - 78); x.lineTo(tx + 16, ty - 66); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(tx - 12, ty - 66); x.lineTo(tx - 12, ty - 56); x.moveTo(tx + 12, ty - 66); x.lineTo(tx + 12, ty - 56); x.stroke();
  },
  postLift(a, walls) {
    if (a.post === 'tower') return 52;
    if (a.post === 'wall' && walls && walls[a.seg]) return walls[a.seg].lvl === 3 ? 34 : 14;
    return 0;
  },
  drawTent(x, tx, ty, w, h, big) {
    x.strokeStyle = INK; x.lineWidth = 1.4;
    x.fillStyle = 'rgba(43,32,24,0.18)'; x.beginPath(); x.ellipse(tx + 4, ty + 2, w * 0.6, w * 0.16, 0, 0, 7); x.fill();
    x.fillStyle = '#efe5cf';
    x.beginPath(); x.moveTo(tx - w / 2, ty); x.lineTo(tx - w * 0.25, ty - h); x.lineTo(tx + w * 0.3, ty - h * 1.02); x.lineTo(tx + w / 2, ty - 2); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#ddd0b4'; x.beginPath(); x.moveTo(tx + w * 0.3, ty - h * 1.02); x.lineTo(tx + w / 2, ty - 2); x.lineTo(tx + w * 0.6, ty - h * 0.3); x.closePath(); x.fill(); x.stroke();
    x.lineWidth = 0.7; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(tx - w / 2 + i * w / 5, ty); x.lineTo(tx - w * 0.25 + i * w * 0.11, ty - h); x.stroke(); }
    x.lineWidth = 1.2; x.fillStyle = '#5a4430'; x.beginPath(); x.moveTo(tx - 4, ty); x.lineTo(tx, ty - h * 0.55); x.lineTo(tx + 4, ty); x.closePath(); x.fill(); x.stroke();
    if (big) { x.beginPath(); x.moveTo(tx, ty - h); x.lineTo(tx, ty - h - 22); x.stroke(); x.fillStyle = Game.S.player.color; x.beginPath(); x.moveTo(tx, ty - h - 22); x.lineTo(tx + 14, ty - h - 18); x.lineTo(tx, ty - h - 14); x.closePath(); x.fill(); x.stroke(); }
  },
  drawField(x, fx, fy) {
    x.save(); x.translate(fx, fy);
    x.strokeStyle = INK; x.lineWidth = 1.2; x.fillStyle = '#d9c48c';
    x.beginPath(); x.moveTo(-48, -16); x.lineTo(40, -22); x.lineTo(52, 16); x.lineTo(-38, 22); x.closePath(); x.fill(); x.stroke();
    x.strokeStyle = '#4f6b3a'; x.lineWidth = 1;
    for (let r = -10; r <= 14; r += 6) for (let c = -40; c <= 42; c += 7) { const px = c + r * 0.3, py = r - c * 0.08; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 2, py - 5); x.moveTo(px, py); x.lineTo(px + 2, py - 5); x.stroke(); }
    x.restore();
  },
  drawBld(x, b, L) {
    const era = L.era, rel = Game.S.player.religion;
    if (b.b === 'saray') { if (era === 'tent') this.drawTent(x, b.x, b.y, 96, 60, true); else Town.draw(x, 'saray', b.x, b.y + 4, 2.4, 0, rel); return; }
    if (b.b === 'ev') { if (era === 'tent') this.drawTent(x, b.x, b.y, 62, 40); else Town.draw(x, 'ev', b.x, b.y + 4, 1.8, 0, rel); return; }
    if (b.b === 'konak') { if (era === 'tent') this.drawTent(x, b.x, b.y, 76, 48); else Town.draw(x, 'konak', b.x, b.y + 4, 1.7, 0, rel); return; }
    if (b.b === 'sur' || b.b === 'kule') return; // eski ızgara surları: artık surlar elle çiziliyor
    Town.draw(x, b.b, b.x, b.y + 4, 1.8, 0, rel, b.i);
  },
  drawProp(x, o, out) {
    const ox = o.x, oy = o.y;
    x.strokeStyle = INK; x.lineWidth = 1.4;
    if (o.type === 'fire') {
      x.fillStyle = '#8b6a46';
      for (let i = 0; i < 5; i++) { x.save(); x.translate(ox, oy); x.rotate(i * 1.25); x.fillRect(-14, -2.5, 28, 5); x.strokeRect(-14, -2.5, 28, 5); x.restore(); }
      if (!out) { for (let i = 0; i < 4; i++) { const f = Math.sin(this.t * 9 + i * 2) * 3; x.fillStyle = i % 2 ? '#ffb347' : '#ff7b1c'; x.beginPath(); x.moveTo(ox - 9 + i * 5, oy - 2); x.quadraticCurveTo(ox - 6 + i * 4 + f, oy - 18 - i * 3, ox - 3 + i * 4, oy - 26 - (i % 2) * 6 + f); x.quadraticCurveTo(ox + i * 3, oy - 10, ox + 2 + i * 3, oy - 2); x.closePath(); x.fill(); } this.smoke(x, ox, oy - 28); }
    } else if (o.type === 'well') {
      x.fillStyle = '#d8ccb0'; x.beginPath(); x.ellipse(ox, oy, 18, 8, 0, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.rect(ox - 18, oy - 12, 36, 12); x.fill(); x.stroke();
      x.lineWidth = 1.6; x.beginPath(); x.moveTo(ox - 16, oy - 10); x.lineTo(ox - 10, oy - 48); x.moveTo(ox + 16, oy - 10); x.lineTo(ox + 10, oy - 48); x.moveTo(ox - 13, oy - 46); x.lineTo(ox + 13, oy - 46); x.stroke();
      x.lineWidth = 1; x.beginPath(); x.moveTo(ox, oy - 46); x.lineTo(ox, oy - 26); x.stroke(); x.fillStyle = '#9b7a52'; x.fillRect(ox - 4, oy - 26, 8, 7); x.strokeRect(ox - 4, oy - 26, 8, 7);
    } else if (o.type === 'logs') {
      x.fillStyle = '#b38d60';
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { const lx = ox - 20 + i * 12 + r * 6, ly = oy - r * 9; x.beginPath(); x.ellipse(lx, ly, 6, 5, 0, 0, 7); x.fill(); x.stroke(); }
    } else if (o.type === 'pen') {
      x.lineWidth = 1.2; x.beginPath();
      for (const [a, b] of [[[-55, -22], [55, -28]], [[55, -28], [61, 20]], [[61, 20], [-48, 26]], [[-48, 26], [-55, -22]]]) { x.moveTo(a[0] + ox, a[1] + oy); x.lineTo(b[0] + ox, b[1] + oy); x.moveTo(a[0] + ox, a[1] + oy - 6); x.lineTo(b[0] + ox, b[1] + oy - 6); }
      x.stroke();
      for (const [hx, hy, d] of [[-20, -2, 1], [18, 6, -1]]) this.horse(x, ox + hx, oy + hy, d);
    } else if (o.type === 'crates') {
      x.fillStyle = '#c9a877';
      for (const [a, b] of [[-14, 0], [2, 2], [-6, -10], [16, -4]]) { x.fillRect(ox + a - 7, oy + b - 7, 14, 12); x.strokeRect(ox + a - 7, oy + b - 7, 14, 12); }
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
  drawPerson(x, a, walls) {
    const kind = a.kind, walk = Math.sin(a.ph);
    const lift = this.postLift(a, walls);
    if (kind === 'king') {
      const f = { id: 1, type: 'cmd', isCmd: true, dir: a.dir || 1, ph: 0, atkT: 0, color: Game.S.player.color, outfit: Game.S.player.outfit, stuck: [] };
      x.save(); x.translate(a.x, a.y); x.fillStyle = 'rgba(43,32,24,0.18)'; x.beginPath(); x.ellipse(0, 0, 8, 3, 0, 0, 7); x.fill(); x.scale(0.68, 0.68); Battle.drawBody(x, f); x.restore();
      return;
    }
    const k = kind === 'child' ? 0.42 : 0.6;
    x.save(); x.translate(a.x, a.y - lift); x.scale(k * (a.dir || 1), k);
    x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = 2.6;
    if (!lift) { x.fillStyle = 'rgba(43,32,24,0.18)'; x.beginPath(); x.ellipse(0, 0, 9, 3, 0, 0, 7); x.fill(); }
    const lean = kind === 'elder' ? 4 : 0;
    if (kind === 'woman') {
      x.fillStyle = '#8b3a36'; x.beginPath(); x.moveTo(-1, -36); x.lineTo(-9, 0); x.lineTo(9, 0); x.lineTo(2, -36); x.closePath(); x.fill(); x.lineWidth = 1.4; x.stroke(); x.lineWidth = 2.4;
      x.beginPath(); x.moveTo(1, -32); x.lineTo(8, -22); x.moveTo(1, -32); x.lineTo(-6, -22); x.stroke();
      if (a.carry) { x.fillStyle = '#c9a877'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(9, -20, 5, 4, 0, 0, 7); x.fill(); x.stroke(); x.lineWidth = 2.4; }
      x.fillStyle = '#f6ecd4'; x.lineWidth = 1.8; x.beginPath(); x.arc(2, -43, 6, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#e8dcc2'; x.beginPath(); x.moveTo(-5, -38); x.quadraticCurveTo(-6, -51, 2, -51); x.quadraticCurveTo(9, -51, 8, -42); x.lineTo(7, -36); x.lineTo(-6, -33); x.closePath(); x.fill(); x.stroke();
    } else {
      x.beginPath(); x.moveTo(lean, -20); x.lineTo(walk * 6, 0); x.moveTo(lean, -20); x.lineTo(-walk * 6, 0); x.stroke();
      x.beginPath(); x.moveTo(lean, -20); x.lineTo(lean * 1.8, -38); x.stroke();
      const col = kind === 'enemy' ? this.enemyColor || '#555' : kind === 'slave' ? '#8a8a8a' : Game.S.player.color;
      x.strokeStyle = col; x.lineWidth = 3.2; x.beginPath(); x.moveTo(lean + 0.3, -23); x.lineTo(lean * 1.8 + 0.6, -35); x.stroke();
      x.strokeStyle = INK; x.lineWidth = 2.4;
      const sh = lean * 1.8;
      if (kind === 'soldier' || kind === 'enemy') {
        x.beginPath(); x.moveTo(sh + 1, -34); x.lineTo(sh + 9, -26); x.stroke();
        x.save(); x.translate(sh + 9, -26); x.rotate(kind === 'soldier' && a.post === 'parade' ? -1.5 : -0.9); x.lineWidth = 1.8; x.beginPath(); x.moveTo(-14, 0); x.lineTo(28, 0); x.stroke(); x.fillStyle = INK; x.beginPath(); x.moveTo(28, -2.5); x.lineTo(35, 0); x.lineTo(28, 2.5); x.closePath(); x.fill(); x.restore();
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
  drawCorpse(x, b) {
    x.save(); x.translate(b.x, b.y); x.rotate(b.rot); x.scale(0.58, 0.58);
    x.strokeStyle = INK; x.lineWidth = 2.4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, -20); x.lineTo(5, 0); x.moveTo(0, -20); x.lineTo(-5, 0); x.moveTo(0, -20); x.lineTo(1, -38); x.moveTo(1, -35); x.lineTo(10, -28); x.moveTo(1, -35); x.lineTo(-6, -26); x.stroke();
    x.strokeStyle = b.enemy ? (this.enemyColor || '#555') : Game.S.player.color; x.lineWidth = 3.2; x.beginPath(); x.moveTo(0.3, -23); x.lineTo(0.9, -35); x.stroke();
    x.fillStyle = '#f6ecd4'; x.strokeStyle = INK; x.lineWidth = 1.8; x.beginPath(); x.arc(2, -45, 6.5, 0, 7); x.fill(); x.stroke();
    x.lineWidth = 1.1; x.beginPath(); x.moveTo(3, -47); x.lineTo(6, -44); x.moveTo(6, -47); x.lineTo(3, -44); x.stroke();
    const hat = b.enemy ? (this.afterHat || 'eskiya') : Game.S.player.headgear;
    if (hat && hat !== 'yok') Hats.draw(x, HAT_ALIAS[hat] || hat, 2, -45, '#555');
    for (let i = 0; i < (b.arrows || 0); i++) Battle.stuckArrow(x, 0.6, -30 + i * 6, { tx: 1, a: 0.4 + i * 0.2 });
    x.restore();
  },

  /* ================== ARAYÜZ ================== */
  showPalette(cat) {
    const el = document.getElementById('vbuild');
    const cats = { tent: ['ev', 'konak'], prod: ['demirci', 'pazar', 'kervan', 'kisla', 'mabet'], farm: ['tarla'], store: ['hazine'], def: ['w1', 'w2', 'w3', 'tower', 'up'] };
    if (!cat || this.cat === cat) { this.cat = null; this.tool = null; el.classList.remove('show'); this.hint(''); return; }
    this.cat = cat; this.tool = null;
    const era = this.L && this.L.era === 'tent';
    const item = k => {
      if (k[0] === 'w') { const lv = WALL_LV[+k[1]]; return `<button data-k="${k}"><span class="vi">${lv.icon}</span><b>${lv.name}</b><small>💰${lv.cost}/10 adım${lv.men ? ' · asker durur' : ''}</small></button>`; }
      if (k === 'tower') return `<button data-k="tower"><span class="vi">🗼</span><b>Kule</b><small>💰${TOWER_COST} · ${TOWER_MEN} asker</small></button>`;
      if (k === 'up') return `<button data-k="up"><span class="vi">⬆</span><b>Yükselt</b><small>Çit→Ahşap→Taş</small></button>`;
      const B = BUILDINGS[k], name = k === 'ev' && era ? 'Çadır' : k === 'konak' && era ? 'Büyük Çadır' : k === 'mabet' ? RELIGIONS[Game.S.player.religion].temple : B.name;
      return `<button data-k="${k}"><canvas width="60" height="50" data-b="${k}"></canvas><b>${name}</b><small>💰${B.cost}</small></button>`;
    };
    el.innerHTML = cats[cat].map(item).join('') + `<button data-k="del"><span class="vi">🔨</span><b>Yık</b><small>%50 iade</small></button>`;
    el.classList.add('show');
    el.querySelectorAll('canvas[data-b]').forEach(c => Town.draw(c.getContext('2d'), c.dataset.b, 30, 44, 1.1, 0, Game.S.player.religion));
    el.querySelectorAll('button').forEach(b => b.onclick = () => {
      this.tool = this.tool === b.dataset.k ? null : b.dataset.k;
      el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.k === this.tool));
      const t = this.tool;
      this.hint(!t ? '' : t[0] === 'w' ? '✍ Surun başlayacağı yere bas, bitmesini istediğin yere sürükle. (Kaydırmak için iki parmak)' : t === 'tower' ? '🗼 Kuleyi koymak istediğin yere dokun (sur uçlarına yapışır).' : t === 'up' ? '⬆ Yükseltmek istediğin sura dokun.' : t === 'del' ? '🔨 Yıkılacak sura, kuleye ya da binaya dokun.' : 'Kesikli yuvarlaklardan birine dokun.');
    });
  },
  hint(t) { const h = document.getElementById('vhint'); if (h) { h.textContent = t; h.style.display = t ? '' : 'none'; } },
  hud() {
    const s = this.sett(); if (!s) return;
    const S = Game.S, p = s.pop, st = this._st || this.state();
    const g = Game.count(s.garrison), posts = this.posts(s).length;
    document.getElementById('vtl').innerHTML = `<i class="flag" style="--c:${S.player.color}">${Battle.emblem()}</i>
      <span>💰<b>${fmt(S.player.gold)}</b></span><span>👨<b>${fmt(p.m)}</b></span><span>👩<b>${fmt(p.w)}</b></span><span>👴<b>${fmt(p.e)}</b></span><span>🧒<b>${fmt(p.c)}</b></span>${p.s > 0.5 ? `<span>⛓<b>${fmt(p.s)}</b></span>` : ''}<span>⚔<b>${fmt(g)}</b></span><span>🛡<b>${Math.min(g, posts)}/${posts}</b></span><span>🏠<b>${fmt(Game.totalPop(s))}/${fmt(Game.capacity(s))}</b></span>`;
    document.getElementById('vtr').innerHTML = `<b>${esc(s.name)}</b> · Gün ${S.day} <button class="spd ${S.speed === 0 ? 'on' : ''}" onclick="UI.setSpeed(0);Village.hud()">⏸</button><button class="spd ${S.speed === 1 ? 'on' : ''}" onclick="UI.setSpeed(1);Village.hud()">▶</button><button class="spd ${S.speed === 3 ? 'on' : ''}" onclick="UI.setSpeed(3);Village.hud()">⏩</button><button class="spd" onclick="Village.close()">✕</button>`;
    const ban = document.getElementById('vbanner');
    if (st === 'attack') ban.innerHTML = `⚔️ Köy saldırı altında! <button onclick="Village.fight()">🕹️ Savaşı Yönet</button>`;
    else if (st === 'approach') ban.innerHTML = '⚠️ Düşman ordusu köye yaklaşıyor! Askerler nöbet yerlerinde.';
    else if (st === 'after') ban.innerHTML = `🕯️ Köy ${this.afterAge} gün önce saldırıya uğradı (${s.after.won ? 'savunma başarılı' : 'ağır kayıp'}). Surlar onarılıyor.`;
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
