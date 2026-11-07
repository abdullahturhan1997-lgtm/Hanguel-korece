/* ==========================================================
   FETİH — Kuşbakışı savaş sahnesi (parşömen / mürekkep çizimi)
   - Her figür tam olarak 1 askerdir (sayılar gerçek).
   - Savaş öncesi konuşlanma: repertuardan birlik seç, sahaya yerleştir.
   - Kan yok; silaha göre kafa kopması, ikiye / üçe bölünme.
   - Oklar isabet ettiği yerde saplı kalır.
   ========================================================== */
'use strict';

const BH = 1100, FS = 0.56, GRAV = 620, MAXF = 320;
const INK = '#2b2018';
const GROUPS = ['cmd', 'inf', 'archer', 'spear', 'cav', 'siege'];
const GROUP_NAME = { cmd: 'Komutan', inf: 'Piyade', archer: 'Okçu', spear: 'Mızraklı', cav: 'Atlı', siege: 'Kuşatma' };
const ORDER_NAME = { advance: 'İleri!', attack: 'Saldırın!', defend: 'Mevzi tutun!', wait: 'Bekleyin!', retreat: 'Ricat!', move: 'Oraya!' };
const FORMS = ['hat', 'kare', 'kama'];
const FORM_NAME = { hat: 'Hat düzeni', kare: 'Kare düzen', kama: 'Kama düzeni' };
const grpOf = f => f.machine ? 'siege' : f.type === 'cmd' ? 'cmd' : f.type === 'elephant' ? 'cav' : f.type === 'cleric' ? null : f.type;
const HAT_ALIAS = { sarik: 'akSarik', kalpak: 'siyahKalpak', sarikH: 'hintSarik', tolga: 'sorguc', hasir: 'uzakDogu', tuy: 'maya', kurk: 'kazak' };

const Battle = {
  active: false, cv: null, ctx: null, W: 0, H: 0, dpr: 1,
  cam: { x: 0, y: 0, z: 1 },
  depAmount: 0,

  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    window.addEventListener('resize', () => { if (this.active) { this.resize(); this.clampCam(); } });
    this.bindControls();
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth * this.dpr; this.H = this.cv.clientHeight * this.dpr;
    this.cv.width = this.W; this.cv.height = this.H;
  },
  minZ() { return Math.max(this.W / this.BW, this.H / BH); },
  clampCam() {
    const c = this.cam;
    c.z = clamp(c.z, this.minZ(), this.H / 260);
    const hw = this.W / c.z / 2, hh = this.H / c.z / 2;
    c.x = clamp(c.x, hw, this.BW - hw); c.y = clamp(c.y, hh, BH - hh);
  },
  toWorld(sx, sy) { const c = this.cam; return [(sx - this.W / 2) / c.z + c.x, (sy - this.H / 2) / c.z + c.y]; },
  toScreen(x, y) { const c = this.cam; return [(x - c.x) * c.z + this.W / 2, (y - c.y) * c.z + this.H / 2]; },

  /* ================== KURULUM ================== */
  start(cfg, onEnd) {
    this.cfg = cfg; this.onEnd = onEnd;
    this.active = true; this.over = false; this.result = null;
    this.resize();
    const S = Game.S;
    this.gore = S.player.settings.gore;
    this.t = 0; this.figs = []; this.proj = []; this.parts = []; this.decals = []; this.corpses = []; this.bubbles = []; this.texts = [];
    this.blocks = []; this.blockId = 1;
    this.kills = 0; this.ballsUsed = 0; this.capture = 0; this.retreatT = -1; this.cryT = [0, 0]; this.cryCd = 0; this.retarget = 0; this.slotT = 0;
    this.myBalls = null; this.marker = null; this._hk = null; this.R = 1;
    this.siege = cfg.kind === 'siege';
    this.BW = this.siege ? 2400 : 2100;
    this.teamSide = cfg.playerSide === 'att' ? ['att', 'def'] : ['def', 'att'];
    this.attTeam = this.teamSide[0] === 'att' ? 0 : 1;
    this.defTeam = 1 - this.attTeam;
    const D = cfg.defense || { walls: [], towers: 0, special: 'none' };
    this.special = this.siege ? D.special : 'none';
    this.river = null;
    if (!this.siege && Math.random() < 0.75) {
      const nb = Math.random() < 0.5 ? 2 : 3;
      this.river = { cx: this.BW / 2 + rand(-60, 60), ph: rand(0, 6), bridges: nb === 2 ? [BH * 0.3, BH * 0.72] : [BH * 0.18, BH * 0.5, BH * 0.82] };
    }
    this.walls = [];
    if (this.siege) D.walls.forEach((hp, i) => this.walls.push({ x: 1520 + i * 120, hp, maxhp: hp, bridged: false, wood: D.wood, crack: [] }));
    this.keepX = this.BW - 230; this.keepY = BH / 2;
    this.towers = [];
    if (this.siege && this.walls.length) {
      const per = Math.ceil(D.towers / this.walls.length);
      for (let i = 0; i < D.towers; i++) {
        const wi = i % this.walls.length, k = Math.floor(i / this.walls.length);
        this.towers.push({ x: this.walls[wi].x, y: BH * (k + 1) / (per + 1) + (wi % 2) * 40, z: 70, cd: rand(0.5, 2), wall: wi, alive: true });
      }
    }
    this.specialT = 2;
    this.gOrd = [{}, {}];
    this.initCenters();
    this.initial = {};
    this.spawnSide(this.teamOf('att'), cfg.att, 'att');
    this.spawnSide(this.teamOf('def'), cfg.def, 'def');
    if (!S.player.wounded) this.player = this.spawnCommander(0, true);
    else { this.player = null; toast('🩹 Komutan yaralı: savaşı uzaktan yönetiyorsun.', 'bad'); }
    this.enemyCmd = S.nations[this.ownerOfTeam(1)] ? this.spawnCommander(1, false) : null;
    // Düşman ve (pusuda) herkes hazır dizilir; oyuncu konuşlanmayı kendisi yapar
    this.autoDeploy(1);
    const ambushMe = cfg.ambush && cfg.playerSide === 'att';
    for (const g of GROUPS) {
      this.gOrd[0][g] = ambushMe ? 'attack' : (g === 'cmd' ? 'wait' : 'defend');
      this.gOrd[1][g] = this.siege && this.teamSide[1] === 'def' ? 'defend' : 'wait';
    }
    if (this.siege && this.teamSide[1] === 'def' && ['sortie', 'horsearch', 'elephants'].includes(this.special)) this.gOrd[1].cav = 'attack';
    this.sel = new Set(GROUPS);
    this.cry = S.player.customCry || S.player.cry;
    this.buildTerrain();
    if (cfg.ambush) {
      this.autoDeploy(0);
      const amb = cfg.playerSide === 'att' ? 1 : 0;
      for (const f of this.figs) if (f.team === amb) f.stun = 2.5;
      this.phase = 'battle';
      this.say(this.player || this.figs.find(f => f.team === 0), 'Pusu! Saldırın!', 2);
    } else {
      // Konuşlanma aşaması: askerler repertuarda (yedekte) bekler
      for (const f of this.figs) if (f.team === 0 && !f.isCmd && f.type !== 'cleric') { f.escaped = true; f.reserve = true; f.blk = null; }
      this.phase = 'deploy';
      const z = this.deployZone();
      this.makeBlock(0, 'cmd', clamp(this.defC[0].cmd.x, z.x0, z.x1), this.defC[0].cmd.y, this.figs.filter(f => f.team === 0 && f.isCmd));
      this.selectGroup('inf', false, true);
    }
    this.refreshSlots(true);
    const z = this.deployZone();
    this.cam.z = this.H / 700; this.cam.x = (z.x0 + z.x1) / 2 + this.fdir(0) * 200; this.cam.y = BH / 2;
    this.clampCam();
    document.getElementById('battle-ui').classList.toggle('deploying', this.phase === 'deploy');
    this.buildGroupBar();
    this.updateHud(true);
    if (this.phase === 'deploy') toast('⚑ Konuşlanma: alttan birlik seç, kendi bölgende sahaya dokun.');
    SFX.horn();
  },
  teamOf(side) { return this.teamSide[0] === side ? 0 : 1; },
  fdir(team) { return this.teamSide[team] === 'att' ? 1 : -1; },
  sideOf(f) { return this.teamSide[f.team]; },
  ownerOfTeam(t) { return this.teamSide[t] === 'att' ? this.cfg.att.owner : this.cfg.def.owner; },
  colorOf(owner) {
    const c = Game.ownerColor(owner);
    if (owner === P || !this.cfg || owner !== this.ownerOfTeam(1)) return c;
    const rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const a = rgb(Game.S.player.color), b = rgb(c);
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 150) return c;
    const alts = ['#5b6670', '#2f5d9e', '#2e8b57', '#6a4c93', '#3d3d3d'];
    return alts.map(x => [x, Math.hypot(...rgb(x).map((v, i) => v - a[i]))]).sort((p, q) => q[1] - p[1])[0][0];
  },
  enemyColor() { return this.colorOf(this.ownerOfTeam(1)); },
  teamColor(t) { return t === 0 ? Game.S.player.color : this.enemyColor(); },

  deployZone() {
    if (this.siege && this.teamSide[0] === 'def') return { x0: this.walls[0].x - 10, x1: this.BW - 60 };
    if (this.teamSide[0] === 'att') return { x0: 70, x1: this.siege ? this.walls[0].x - 420 : this.BW * 0.36 };
    return { x0: this.BW * 0.64, x1: this.BW - 70 };
  },

  initCenters() {
    const mid = BH / 2;
    const left = { spear: [640, mid], inf: [560, mid], archer: [450, mid], cav: [520, mid - 330], siege: [250, mid], cmd: [420, mid] };
    this.defC = [{}, {}];
    const ambush = this.cfg.ambush;
    for (const t of [0, 1]) {
      const att = this.teamSide[t] === 'att';
      for (const g of GROUPS) {
        let [x, y] = left[g];
        if (!att) {
          if (this.siege) {
            const inner = this.walls[this.walls.length - 1].x;
            const inside = { spear: [inner + 90, mid], inf: [inner + 150, mid], archer: [this.walls[0].x + 6, mid], cav: [this.keepX - 140, mid], siege: [this.keepX - 60, mid + 200], cmd: [inner + 210, mid] };
            [x, y] = inside[g];
            if (g === 'cav' && ['sortie', 'horsearch', 'elephants'].includes(this.special)) [x, y] = [this.walls[0].x - 160, mid];
          } else x = this.BW - x;
        }
        const ambushed = ambush && ((this.cfg.playerSide === 'att' && t === 1) || (this.cfg.playerSide === 'def' && t === 0));
        if (ambushed) x = this.BW / 2 + (att ? -120 : 120);
        if (ambush && this.cfg.playerSide === 'att' && t === 0) x += 300;
        this.defC[t][g] = { x, y };
      }
    }
  },

  spawnSide(team, side, role) {
    const isAtt = role === 'att', owner = side.owner, color = this.colorOf(owner);
    const armor = owner === P ? Game.S.player.armor : null;
    const n = Game.S.nations[owner];
    const hatId = owner === P ? Game.S.player.headgear : (n ? CULTURE_HAT[n.culture] : (owner === 'B' ? 'eskiya' : 'koyluKepi'));
    let placed = 0;
    const add = (units, col, ally) => {
      for (const k of UNIT_KEYS) {
        const cnt = units[k] || 0; if (cnt <= 0) continue;
        const key = team + ':' + k + (ally ? ':' + ally : '');
        this.initial[key] = (this.initial[key] || 0) + cnt;
        const allyN = ally && Game.S.nations[ally];
        const hid = ally ? (allyN ? CULTURE_HAT[allyN.culture] : 'yok') : hatId;
        for (let i = 0; i < cnt; i++) {
          const f = this.makeFig(team, k, isAtt, col, armor && !ally ? armor[k] : 0, hid, ally, i);
          // Sahaya en fazla MAXF asker sığar; fazlası yedekte bekler (ölmez, sayılır)
          if (placed >= MAXF) { f.escaped = true; f.reserve = true; f.overflow = true; }
          placed++;
          this.figs.push(f);
        }
      }
    };
    add(side.units, color, null);
    for (const al of side.allies || []) add(al.units, this.colorOf(al.owner), al.owner);
    const sg = side.siege || {};
    for (const k of ['catapult', 'cannon', 'tower']) {
      const cnt = Math.min(4, sg[k] || 0);
      for (let i = 0; i < cnt; i++) this.figs.push(this.makeMachine(team, k, isAtt, color, i));
      if (cnt) this.initial[team + ':' + k] = cnt;
    }
    if (team === 0 && isAtt) this.myBalls = sg.balls || 0;
    if (owner === P) this.figs.push(this.makeCleric(team, isAtt));
    else if (n && Math.random() < 0.7) this.figs.push(this.makeCleric(team, isAtt, n.religion));
    if (!isAtt && this.siege && this.special === 'elephants') for (let i = 0; i < 3; i++) this.figs.push(this.makeFig(team, 'elephant', false, color, 0, 'yok', null, i));
  },

  makeFig(team, type, isAtt, color, armorTier, hatId, ally, i) {
    const U = type === 'elephant' ? { hp: 650, dmg: 38, range: 38, cd: 1.6, speed: 42 } : UNITS[type];
    const H = HEADGEARS[hatId] || HEADGEARS.yok;
    const am = ARMOR_TIERS[armorTier || 0].mult * (1 + (H.hp || 0));
    const f = {
      id: uid(), team, type, color, ally, alive: true,
      hp: U.hp * am, maxhp: U.hp * am, dmg: U.dmg * (1 + (H.dmg || 0)), range: U.range, cd: U.cd, cdT: rand(0, U.cd),
      speed: U.speed * 1.5 * (1 + (H.spd || 0)) * rand(0.82, 1.15), dir: isAtt ? 1 : -1, ph: rand(0, 6), atkT: 0, stun: 0,
      armorTier: armorTier || 0, hat: HEADGEARS[hatId] ? hatId : 'yok', x: 0, y: 0, lagT: 0, stuck: [],
      off: rand(-14, 14)
    };
    if (team === 0 && Game.S.player.religion === 'tengri' && type === 'cav') f.speed *= 1.15;
    if (team === 0 && Game.S.player.religion === 'pagan' && type === 'inf') f.dmg *= 1.1;
    if (!isAtt && this.siege && this.special === 'samurai' && (type === 'inf' || type === 'spear')) f.dmg *= 1.4;
    if (!isAtt && this.siege && this.special === 'shieldwall' && (type === 'inf' || type === 'spear')) f.dmgTaken = 0.6;
    if (!isAtt && this.siege && (type === 'elephant' || (type === 'cav' && (this.special === 'sortie' || this.special === 'horsearch')))) f.sortie = true;
    return f;
  },
  makeMachine(team, type, isAtt, color, i) {
    const hp = { catapult: 320, cannon: 380, tower: 1100 }[type];
    return { id: uid(), team, type, machine: true, color, alive: true, hp, maxhp: hp, x: 0, y: 0, dir: isAtt ? 1 : -1, cdT: rand(1, 3), cd: type === 'cannon' ? 4.5 : 5.5, speed: type === 'tower' ? 30 : 18, dmg: 0, range: type === 'cannon' ? 1300 : 1050, atkT: 0, ph: 0, stun: 0, stuck: [] };
  },
  makeCleric(team, isAtt, rel) {
    rel = rel || Game.S.player.religion;
    const R = RELIGIONS[rel] || RELIGIONS.islam;
    const mb = team === 0 ? 1 + Game.bonus(Game.sett(Game.S.player.capital) || {}, 'morale') : 1;
    const c = this.defC[team].archer;
    return {
      id: uid(), team, type: 'cleric', cleric: R.cleric, robe: R.robe, color: this.teamColor(team),
      alive: true, hp: 90, maxhp: 90, x: c.x - this.fdir(team) * 60, y: c.y + 40, dir: isAtt ? 1 : -1, stuck: [],
      heal: 7 * mb * (rel === 'hristiyan' ? 1.25 : 1), speed: 75, dmg: 0, range: 0, cd: 1, cdT: 0, ph: 0, atkT: 0, stun: 0
    };
  },
  spawnCommander(team, isPlayer) {
    const S = Game.S, o = S.player.outfit;
    let hp = 650, dmg = 48, reach = 30;
    if (isPlayer) {
      for (const cat of ['helmet', 'armor', 'shield']) { const it = OUTFIT[cat].find(x => x.id === o[cat]); if (it && it.hp) hp += it.hp; }
      const w = OUTFIT.weapon.find(x => x.id === o.weapon); if (w) { dmg += w.dmg || 0; reach += w.reach || 0; }
    }
    const c = this.defC[team].cmd;
    const f = {
      id: uid(), team, type: 'cmd', isCmd: true, isPlayer, alive: true, color: this.teamColor(team),
      hp, maxhp: hp, dmg, range: reach, cd: 0.55, cdT: 0, speed: 140, dir: this.fdir(team), ph: 0, atkT: 0, stun: 0, stuck: [], off: 0, lagT: 0,
      x: c.x, y: c.y, outfit: isPlayer ? o : null, hat: isPlayer ? null : (CULTURE_HAT[(S.nations[this.ownerOfTeam(team)] || {}).culture] || 'yok')
    };
    this.figs.push(f);
    return f;
  },

  /* ---------- Bölükler (blok) ve formasyon yuvaları ---------- */
  makeBlock(team, g, x, y, figs) {
    const b = { id: this.blockId++, team, g, x, y, form: g === 'cav' ? 'kama' : 'hat' };
    this.blocks.push(b);
    for (const f of figs) f.blk = b;
    return b;
  },
  autoDeploy(team) {
    for (const g of GROUPS) {
      const figs = this.figs.filter(f => f.team === team && grpOf(f) === g && !f.overflow && !f.blk);
      if (!figs.length) continue;
      for (const f of figs) { f.escaped = false; f.reserve = false; }
      const c = this.defC[team][g];
      this.makeBlock(team, g, c.x, c.y, figs);
      // Savunan okçular surlara çıkar
      if (g === 'archer' && this.siege && this.teamSide[team] === 'def') figs.forEach((f, i) => { f.onWall = i % this.walls.length; });
    }
    for (const f of this.figs) if (f.team === team && f.type === 'cleric' && !f.blk) { f.escaped = false; }
    this.refreshSlots(true);
  },
  refreshSlots(place) {
    for (const b of this.blocks) {
      const figs = this.figs.filter(f => f.blk === b && f.alive && !f.escaped).sort((p, q) => p.id - q.id);
      const n = figs.length; if (!n) continue;
      const t = b.team, g = b.g, fd = this.fdir(t), form = b.form;
      const sp = g === 'cav' ? 22 : g === 'siege' ? 90 : g === 'cmd' ? 0 : 16;
      const cols = form === 'kare' ? Math.ceil(Math.sqrt(n)) : Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 6))));
      const ambushed = place && this.cfg.ambush && ((this.cfg.playerSide === 'att' && t === 1) || (this.cfg.playerSide === 'def' && t === 0));
      figs.forEach((f, i) => {
        let fw, lat;
        if (form === 'kama') { const r = Math.floor((Math.sqrt(4 * i + 1) - 1) / 2), k = i - r * (r + 1); fw = -r * sp * 0.9; lat = (k - r) * sp * 0.75; }
        else { const r = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - r * cols); fw = -r * sp; lat = (col - (inRow - 1) / 2) * sp; }
        if (f.onWall != null && this.walls[f.onWall] && this.walls[f.onWall].hp > 0) {
          if (f.wy == null) f.wy = clamp(BH * (i + 0.5) / n + rand(-5, 5), 40, BH - 40);
          f.sx = this.walls[f.onWall].x + 4; f.sy = f.wy;
        } else if (g === 'siege') { f.sx = clamp(b.x, 20, this.BW - 20); f.sy = clamp(b.y + (i - (n - 1) / 2) * sp, 30, BH - 30); }
        else { f.sx = clamp(b.x + fw * fd, 20, this.BW - 20); f.sy = clamp(b.y + lat, 30, BH - 30); }
        if (place) {
          if (ambushed && !f.machine) { f.x = b.x + rand(-250, 250); f.y = rand(120, BH - 120); }
          else { f.x = f.sx + (f.machine ? 0 : rand(-2, 2)); f.y = f.sy + (f.machine ? 0 : rand(-2, 2)); }
        }
      });
    }
  },
  blocksOf(t, g) { return this.blocks.filter(b => b.team === t && b.g === g && this.figs.some(f => f.blk === b && f.alive && !f.escaped)); },

  /* ================== KONUŞLANMA ================== */
  reserveOf(g) { return this.figs.filter(f => f.team === 0 && f.reserve && !f.overflow && f.alive && grpOf(f) === g); },
  deployedCount() { return this.figs.filter(f => f.team === 0 && !f.escaped && !f.machine && !f.isCmd && f.type !== 'cleric').length; },
  deployAt(wx, wy) {
    const z = this.deployZone();
    const x = clamp(wx, z.x0, z.x1), y = clamp(wy, 50, BH - 50);
    if (wx < z.x0 - 30 || wx > z.x1 + 30) { toast('Sadece kendi konuşlanma bölgene yerleştirebilirsin.', 'bad'); return; }
    const gs = this.selected(true);
    let any = false;
    for (const g of gs) {
      const res = this.reserveOf(g);
      if (res.length) {
        let n = this.depAmount > 0 ? Math.min(this.depAmount, res.length) : res.length;
        if (g !== 'siege') n = Math.min(n, MAXF - this.deployedCount());
        if (n <= 0) { toast(`Sahaya en fazla ${MAXF} asker sığar.`, 'bad'); continue; }
        const figs = res.slice(0, n);
        for (const f of figs) { f.escaped = false; f.reserve = false; }
        const off = gs.length > 1 ? { x: (this.defC[0][g].x - this.defC[0].inf.x), y: this.defC[0][g].y - this.defC[0].inf.y } : { x: 0, y: 0 };
        const b = this.makeBlock(0, g, clamp(x + off.x, z.x0, z.x1), clamp(y + off.y, 50, BH - 50), figs);
        if (g === 'archer' && this.siege && this.teamSide[0] === 'def') {
          const w = this.walls.reduce((p, q) => Math.abs(q.x - b.x) < Math.abs(p.x - b.x) ? q : p);
          if (Math.abs(w.x - b.x) < 70) figs.forEach(f => { f.onWall = this.walls.indexOf(w); });
        }
        any = true;
      } else {
        // Yedeği kalmamış bölükleri yeni yere taşı
        for (const b of this.blocksOf(0, g)) { b.x = x; b.y = y; any = true; }
      }
    }
    if (any) { this.refreshSlots(true); this.marker = { x, y, t: 1 }; SFX.drum(); this.buildGroupBar(); this.updateHud(true); }
    else toast('Bu birliğin yedeği kalmadı.', 'bad');
  },
  deployAction(a) {
    if (a === 'amount') return;
    if (a === 'auto') { this.autoDeploy(0); this.buildGroupBar(); this.updateHud(true); return; }
    if (a === 'undo') {
      const b = [...this.blocks].reverse().find(b => b.team === 0 && b.g !== 'cmd');
      if (!b) return;
      for (const f of this.figs) if (f.blk === b) { f.blk = null; f.escaped = true; f.reserve = true; f.onWall = null; f.wy = null; }
      this.blocks.splice(this.blocks.indexOf(b), 1);
      this.buildGroupBar(); this.updateHud(true);
      return;
    }
    if (a === 'start') {
      if (this.deployedCount() === 0 && !this.figs.some(f => f.team === 0 && f.machine && !f.escaped)) this.autoDeploy(0);
      const left = this.figs.filter(f => f.team === 0 && f.reserve && f.alive && !f.machine).length;
      if (left) toast(`🏕️ ${left} asker yedekte kaldı; savaşa katılmayacak.`);
      this.phase = 'battle';
      document.getElementById('battle-ui').classList.remove('deploying');
      this.sel = new Set(GROUPS);
      this.buildGroupBar();
      this.refreshSlots();
      SFX.horn();
      this.say(this.player || this.figs.find(f => f.team === 0 && !f.escaped), 'Hazır olun!', 1.5);
    }
  },

  /* ================== KONTROLLER ================== */
  bindControls() {
    const cv = this.cv, pts = new Map();
    let drag = null, pinch = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr]; };
    cv.addEventListener('pointerdown', e => {
      if (!this.active) return;
      cv.setPointerCapture(e.pointerId);
      const p = pos(e); pts.set(e.pointerId, p);
      if (pts.size === 1) drag = { sx: p[0], sy: p[1], cx: this.cam.x, cy: this.cam.y, t: performance.now(), moved: false };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.cam.z, wc: this.toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; drag = null; }
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const p = pos(e); pts.set(e.pointerId, p);
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
      if (!pts.has(e.pointerId)) return;
      const p = pos(e); pts.delete(e.pointerId);
      if (drag && !drag.moved && performance.now() - drag.t < 500) {
        const [wx, wy] = this.toWorld(p[0], p[1]);
        if (this.phase === 'deploy') this.deployAt(wx, wy); else this.tapField(wx, wy);
      }
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) drag = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
    cv.addEventListener('wheel', e => {
      if (!this.active) return;
      e.preventDefault();
      const p = pos(e), wc = this.toWorld(p[0], p[1]);
      this.cam.z *= e.deltaY < 0 ? 1.15 : 1 / 1.15; this.clampCam();
      this.cam.x = wc[0] - (p[0] - this.W / 2) / this.cam.z; this.cam.y = wc[1] - (p[1] - this.H / 2) / this.cam.z; this.clampCam();
    }, { passive: false });
    const mm = document.getElementById('mm');
    mm.addEventListener('pointerdown', e => {
      const r = mm.getBoundingClientRect();
      this.cam.x = (e.clientX - r.left) / r.width * this.BW; this.cam.y = (e.clientY - r.top) / r.height * BH; this.clampCam();
    });
    document.querySelectorAll('#bcmds [data-c]').forEach(b => b.addEventListener('click', () => this.command(b.dataset.c)));
    document.querySelectorAll('#bdeploy [data-d]').forEach(b => b.addEventListener('click', () => this.deployAction(b.dataset.d)));
    document.querySelectorAll('#bdeploy [data-n]').forEach(b => b.addEventListener('click', () => {
      this.depAmount = +b.dataset.n;
      document.querySelectorAll('#bdeploy [data-n]').forEach(x => x.classList.toggle('on', x === b));
    }));
    window.addEventListener('keydown', e => {
      if (!this.active) return;
      const k = e.key.toLowerCase();
      const gk = { '0': 'cmd', '1': 'inf', '2': 'archer', '3': 'spear', '4': 'cav', '5': 'siege' }[k];
      if (gk) this.selectGroup(gk, e.shiftKey);
      if (k === 'a') this.selectGroup('all');
      if (this.phase === 'deploy') { if (k === 'enter') this.deployAction('start'); return; }
      const ck = { q: 'advance', w: 'attack', e: 'defend', r: 'wait', t: 'retreat', y: 'form', n: 'cry' }[k];
      if (ck) this.command(ck);
    });
  },

  buildGroupBar() {
    const bar = document.getElementById('bgroups');
    const dep = this.phase === 'deploy';
    let h = '';
    for (const g of GROUPS) {
      const all = this.figs.filter(f => f.team === 0 && f.alive && grpOf(f) === g && !f.overflow).length;
      if (!all) continue;
      const res = dep ? this.reserveOf(g).length : 0;
      h += `<button data-g="${g}" class="${this.sel.has(g) ? 'on' : ''}"><canvas width="56" height="56" data-icon="${g}"></canvas><b>${g === 'cmd' ? '👑' : GROUPS.indexOf(g)}</b><small data-cnt="${g}">${dep && g !== 'cmd' ? res + '/' + all : ''}</small></button>`;
    }
    h += `<button data-g="all" class="${this.sel.size >= GROUPS.length ? 'on' : ''}"><span class="all">✱</span><b>Tümü</b></button>`;
    bar.innerHTML = h;
    bar.querySelectorAll('button').forEach(b => b.addEventListener('click', e => this.selectGroup(b.dataset.g, e.shiftKey)));
    bar.querySelectorAll('canvas[data-icon]').forEach(c => this.drawIcon(c, c.dataset.icon, 0));
  },
  selectGroup(g, add, quiet) {
    if (g === 'all') this.sel = new Set(GROUPS);
    else if (add) { if (this.sel.has(g) && this.sel.size > 1) this.sel.delete(g); else this.sel.add(g); }
    else this.sel = new Set([g]);
    document.querySelectorAll('#bgroups button').forEach(b => b.classList.toggle('on', b.dataset.g === 'all' ? this.sel.size >= GROUPS.length : this.sel.has(b.dataset.g)));
    if (quiet) return;
    SFX.click();
    if (g !== 'all' && !add && this.phase !== 'deploy') { const c = this.groupCenter(0, g); if (c) { this.cam.x = c[0]; this.cam.y = c[1]; this.clampCam(); } }
  },
  groupCenter(t, g) {
    const l = this.figs.filter(f => f.team === t && f.alive && !f.escaped && grpOf(f) === g);
    if (!l.length) return null;
    return [l.reduce((s, f) => s + f.x, 0) / l.length, l.reduce((s, f) => s + f.y, 0) / l.length];
  },
  selected(includeReserve) { return [...this.sel].filter(g => this.figs.some(f => f.team === 0 && f.alive && grpOf(f) === g && !f.overflow && (includeReserve || !f.escaped))); },

  tapField(wx, wy) {
    if (this.over || this.retreatT >= 0) return;
    const gs = this.selected();
    const bl = this.blocks.filter(b => b.team === 0 && gs.includes(b.g) && this.figs.some(f => f.blk === b && f.alive && !f.escaped));
    if (!bl.length) return;
    // Bloklar aradaki düzeni koruyarak dokunulan yere yürür
    for (const b of bl) { const c = this.blockCenter(b); if (c) { b.x = c[0]; b.y = c[1]; } }
    const cx = bl.reduce((s, b) => s + b.x, 0) / bl.length, cy = bl.reduce((s, b) => s + b.y, 0) / bl.length;
    for (const b of bl) { b.x = clamp(wx + (b.x - cx), 30, this.BW - 30); b.y = clamp(wy + (b.y - cy), 40, BH - 40); }
    for (const g of gs) this.gOrd[0][g] = 'move';
    this.marker = { x: wx, y: wy, t: 1.2 };
    this.refreshSlots();
    SFX.click();
  },
  blockCenter(b) {
    const l = this.figs.filter(f => f.blk === b && f.alive && !f.escaped);
    if (!l.length) return null;
    return [l.reduce((s, f) => s + f.x, 0) / l.length, l.reduce((s, f) => s + f.y, 0) / l.length];
  },

  command(c) {
    if (this.over || this.phase === 'deploy') return;
    if (c === 'cry') return this.warCry(0);
    const gs = this.selected();
    if (!gs.length) return;
    const bl = this.blocks.filter(b => b.team === 0 && gs.includes(b.g));
    if (c === 'form') {
      const nx = FORMS[(FORMS.indexOf((bl[0] || {}).form || 'hat') + 1) % FORMS.length];
      for (const b of bl) { b.form = nx; const cc = this.blockCenter(b); if (cc) { b.x = cc[0]; b.y = cc[1]; } }
      for (const g of gs) if (this.gOrd[0][g] === 'attack') this.gOrd[0][g] = 'defend';
      this.refreshSlots();
      toast('⁂ ' + FORM_NAME[nx]);
      this.flash('form');
      return;
    }
    if (this.retreatT >= 0) return;
    if (c === 'retreat' && gs.length >= this.groupsAlive(0)) return this.retreat();
    for (const g of gs) this.setOrder(0, g, c);
    if (c !== 'attack') for (const b of bl) { const cc = this.blockCenter(b); if (cc) { b.x = cc[0]; b.y = cc[1]; } }
    this.refreshSlots();
    this.say(this.bearer(0, gs[0]) || this.player, ORDER_NAME[c], 1.6);
    if (c === 'retreat') Voice.speak('Ricat!', { pitch: 0.6 });
    if (c === 'attack' || c === 'advance') SFX.horn();
    this.flash(c);
  },
  setOrder(t, g, o) {
    const prev = this.gOrd[t][g];
    this.gOrd[t][g] = o;
    // Hücumda herkes aynı anda fırlamaz: kimi önde, kimi arkada kalır
    if ((o === 'attack' || o === 'advance') && prev !== o) for (const f of this.figs) if (f.team === t && grpOf(f) === g) f.lagT = rand(0, 2.2);
  },
  flash(c) {
    document.querySelectorAll('#bcmds [data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === c));
    clearTimeout(this._fl); this._fl = setTimeout(() => document.querySelectorAll('#bcmds [data-c]').forEach(b => b.classList.remove('on')), 900);
  },
  groupsAlive(t) { return GROUPS.filter(g => this.figs.some(f => f.team === t && f.alive && !f.escaped && grpOf(f) === g)).length; },
  bearer(t, g) {
    if (g === 'cmd' || g === 'siege') return null;
    let b = null;
    for (const f of this.figs) if (f.team === t && f.alive && !f.escaped && grpOf(f) === g && (!b || f.id < b.id)) b = f;
    return b;
  },

  warCry(team) {
    if (team === 0) {
      if (this.cryCd > 0 || this.over) return;
      this.cryCd = 18;
      Voice.speak(this.cry, { pitch: 0.7, rate: 1 });
      const mine = this.figs.filter(f => f.team === 0 && f.alive && !f.escaped && !f.machine);
      for (let i = 0; i < Math.min(14, mine.length); i++) this.say(pick(mine), this.cry, 2.2);
      if (this.player) this.say(this.player, this.cry, 2.5);
      this.cryT[0] = 8 * (Game.S.player.religion === 'islam' ? 1.2 : 1);
      SFX.drum(); setTimeout(() => SFX.drum(), 250); setTimeout(() => SFX.drum(), 500);
    } else {
      this.cryT[1] = 7;
      const n = Game.S.nations[this.ownerOfTeam(1)];
      const txt = n ? pick(RELIGIONS[n.religion].cries) : 'Aaaaa!';
      const en = this.figs.filter(f => f.team === 1 && f.alive && !f.escaped && !f.machine);
      for (let i = 0; i < Math.min(8, en.length); i++) this.say(pick(en), txt, 2);
    }
  },
  retreat() {
    if (this.retreatT >= 0 || this.over) return;
    this.retreatT = 0;
    for (const g of GROUPS) this.gOrd[0][g] = 'retreat';
    Voice.speak('Ricat! Ricat!', { pitch: 0.6, rate: 1.1 });
    this.say(this.player || this.figs.find(f => f.team === 0 && f.alive && !f.escaped), 'RİCAT! RİCAT!', 3.5);
    const mine = this.figs.filter(f => f.team === 0 && f.alive && !f.escaped && !f.machine);
    for (let i = 0; i < Math.min(6, mine.length); i++) this.say(pick(mine), 'Ricat!', 2);
    SFX.horn();
    this.flash('retreat');
  },
  say(f, text, life) {
    if (!f) return;
    this.bubbles = this.bubbles.filter(b => b.f !== f);
    this.bubbles.push({ f, text, life, max: life });
    if (this.bubbles.length > 18) this.bubbles.shift();
  },

  /* ================== GÜNCELLEME ================== */
  update(dt) {
    if (!this.active) return;
    dt = Math.min(dt, 0.05);
    if (this.marker) { this.marker.t -= dt; if (this.marker.t <= 0) this.marker = null; }
    if (this.over || this.phase === 'deploy') { this.updateFx(dt); this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0 && !this.over) { this.updateHud(); this.hudT = 0.3; } return; }
    this.t += dt;
    if (this.cryCd > 0) this.cryCd -= dt;
    for (let i = 0; i < 2; i++) if (this.cryT[i] > 0) this.cryT[i] -= dt;
    this.aiOrders(dt);
    for (const b of this.blocks) if (this.gOrd[b.team][b.g] === 'advance') this.advanceBlock(b, dt);
    this.slotT -= dt; if (this.slotT <= 0) { this.slotT = 0.5; this.refreshSlots(); }
    const alive = this.figs.filter(f => f.alive && !f.escaped);
    const byTeam = [alive.filter(f => f.team === 0), alive.filter(f => f.team === 1)];
    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.retarget = 0.3;
      for (const t of [0, 1]) {
        const eng = new Map(), en = byTeam[1 - t];
        for (const f of byTeam[t]) f.target = this.pickTarget(f, en, eng);
      }
    }
    for (const f of alive) f.engN = 0;
    for (const f of alive) {
      if (f.target && (!f.target.alive || f.target.escaped)) f.target = null;
      this.updateFig(f, dt);
    }
    this.separate(alive); this.separate(alive);
    for (const f of alive) { f.y = clamp(f.y, 20, BH - 15); f.x = clamp(f.x, -80, this.BW + 80); this.wallClamp(f); }
    this.updateTowers(dt, byTeam);
    this.updateSpecial(dt, byTeam);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.checkEnd(byTeam, dt);
    this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.updateHud(); this.hudT = 0.25; }
  },

  // Izgara ile ayrışma: askerler iç içe girmez, yayılır
  separate(alive) {
    const C = 16, grid = new Map();
    for (const f of alive) { if (f.machine) continue; const k = ((f.x / C) | 0) * 1000 + ((f.y / C) | 0); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(f); }
    const R = 15;
    for (const a of alive) {
      if (a.machine) continue;
      const gx = (a.x / C) | 0, gy = (a.y / C) | 0;
      for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) {
        const l = grid.get((gx + ix) * 1000 + gy + iy); if (!l) continue;
        for (const b of l) {
          if (b.id <= a.id) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.01;
          if (d < R) { const push = (R - d) * (a.team === b.team ? 0.35 : 0.5); a.x -= dx / d * push; b.x += dx / d * push; a.y -= dy / d * push; b.y += dy / d * push; }
        }
      }
    }
  },

  aiOrders(dt) {
    if (this.siege && this.teamSide[1] === 'def') return;
    if (this.t < 2.5) return;
    const en = this.figs.filter(f => f.team === 0 && f.alive && !f.escaped && !f.machine);
    const me = this.figs.filter(f => f.team === 1 && f.alive && !f.escaped && !f.machine);
    if (!en.length || !me.length) return;
    const ex = en.reduce((s, f) => s + f.x, 0) / en.length, mx = me.reduce((s, f) => s + f.x, 0) / me.length;
    const close = Math.abs(ex - mx) < 420 || this.siege;
    for (const g of GROUPS) {
      if (g === 'siege') this.setOrder(1, g, 'defend');
      else if (g === 'archer') this.setOrder(1, g, 'defend');
      else this.setOrder(1, g, close ? 'attack' : 'advance');
    }
    if (this.t > 4 && this.cryT[1] <= 0 && Math.random() < dt * 0.04) this.warCry(1);
  },
  advanceBlock(b, dt) {
    const fd = this.fdir(b.team);
    let nd = 1e9, ny = b.y;
    for (const e of this.figs) { if (e.team === b.team || !e.alive || e.escaped) continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < nd) { nd = d; ny = e.y; } }
    if (nd < (b.g === 'archer' ? 520 : 140)) return;
    const w = this.siege && this.teamSide[b.team] === 'att' ? this.walls.find(w => w.hp > 0 && !w.bridged) : null;
    if (w && b.x > w.x - (b.g === 'archer' ? 380 : 40)) return;
    b.x = clamp(b.x + fd * 42 * dt, 30, this.BW - 30);
    b.y += clamp(ny - b.y, -1, 1) * 8 * dt;
  },
  pickTarget(f, enemies, eng) {
    if (f.machine || f.type === 'cleric') return null;
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (e.escaped) continue;
      if (e.onWall != null && f.range < 60 && this.walls[e.onWall] && this.walls[e.onWall].hp > 0) continue;
      // Yan yana olan düşmanı tercih et, aynı hedefe yığılma
      const d = Math.abs(e.x - f.x) + Math.abs(e.y - f.y) * 1.8 + (eng.get(e.id) || 0) * (f.type === 'archer' ? 6 : 38);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) eng.set(best.id, (eng.get(best.id) || 0) + 1);
    return best;
  },
  blockingWall(f) {
    if (!this.walls.length) return null;
    if (this.sideOf(f) === 'att') { for (const w of this.walls) if (w.hp > 0 && !w.bridged && w.x > f.x - 4) return w; return null; }
    let r = null; for (const w of this.walls) if (w.hp > 0 && w.x < f.x) r = w; return r;
  },
  wallClamp(f) {
    if (f.machine || !this.walls.length) return;
    if (f.onWall != null) {
      const w = this.walls[f.onWall];
      if (w && w.hp > 0) { f.x = clamp(f.x, w.x - 6, w.x + 10); return; }
      f.onWall = null; this.damage(f, 25, null, 'blunt');
      return;
    }
    const w = this.blockingWall(f);
    if (!w) return;
    if (this.sideOf(f) === 'att') { if (f.x > w.x - 18) f.x = w.x - 18; }
    else if (!f.sortie && !f.isCmd) { if (f.x < w.x + 18) f.x = w.x + 18; }
  },
  riverX(y) { const r = this.river; return r.cx + Math.sin(y * 0.0042 + r.ph) * 70 + Math.sin(y * 0.013 + r.ph * 2) * 22; },
  inRiver(x, y) {
    if (!this.river || Math.abs(x - this.riverX(y)) > 26) return false;
    for (const b of this.river.bridges) if (Math.abs(y - b) < 24) return false;
    return true;
  },
  weaponOf(f) {
    if (f.isCmd && f.outfit) return { balta: 'axe', gurz: 'blunt', mizrak: 'spear' }[f.outfit.weapon] || 'sword';
    return { inf: 'sword', cav: 'sword', spear: 'spear', archer: 'blunt', elephant: 'blunt', cmd: 'sword' }[f.type] || 'sword';
  },

  updateFig(f, dt) {
    if (f.stun > 0) { f.stun -= dt; return; }
    if (f.atkT > 0) f.atkT -= dt;
    f.cdT -= dt;
    const boost = this.cryT[f.team] > 0 ? 1.3 : 1;
    let sp = f.speed * boost;
    if (this.siege && this.sideOf(f) === 'att' && this.walls.length) {
      const w0 = this.walls[0];
      if ((this.special === 'moat' || this.special === 'canal') && f.x > w0.x - 120 && f.x < w0.x - 14) sp *= 0.45;
      if ((this.special === 'cold' || this.special === 'heat') && !f.machine) { sp *= 0.82; this.damage(f, 0.5 * dt, null, 'none'); if (!f.alive) return; }
    }
    if (this.inRiver(f.x, f.y)) { sp *= 0.4; if (Math.random() < dt * 3) this.parts.push({ x: f.x + rand(-5, 5), y: f.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.5, max: 0.5, kind: 'splash', r: 2 }); }
    if (f.machine) return this.updateMachine(f, dt);
    if (f.type === 'cleric') return this.updateCleric(f, dt);
    const ord = this.gOrd[f.team][grpOf(f)];
    if (ord === 'retreat') {
      this.walk(f, f.x + (this.sideOf(f) === 'att' ? -200 : 200), f.y, sp * 1.15, dt);
      if (f.x < -30 || f.x > this.BW + 30) f.escaped = true;
      return;
    }
    const t = f.target, ranged = f.type === 'archer';
    const d = t ? Math.hypot(t.x - f.x, t.y - f.y) : 1e9;
    if (t) {
      if (ranged && d < 22) {
        if (f.cdT <= 0) { f.cdT = 1.1; f.atkT = 0.25; f.dir = Math.sign(t.x - f.x) || f.dir; this.damage(t, 5 * boost, f, 'blunt'); }
        return;
      }
      const reach = ranged ? f.range : f.range + (t.machine ? 18 : 0);
      if (d <= reach) {
        if (!ranged) t.engN = (t.engN || 0) + 1;
        f.dir = Math.sign(t.x - f.x) || f.dir;
        if (f.cdT <= 0) { f.cdT = f.cd * rand(0.85, 1.15); if (ranged) this.shootArrow(f, t, f.dmg * boost); else this.melee(f, t, boost); }
        // Okçular durduğu yerden atar; sadece "oraya" emrinde yürümeye devam eder
        if (!(ranged && ord === 'move')) return;
      }
    }
    // Hücum gecikmesi: kimi önde kimi arkada
    if ((ord === 'attack' || ord === 'advance') && f.lagT > 0) { f.lagT -= dt; return; }
    let goal = [f.sx != null ? f.sx : f.x, f.sy != null ? f.sy : f.y];
    const approach = () => {
      const s = Math.sign(t.x - f.x) || 1;
      // Düşmanın etrafı doluysa ikinci safta bekle; herkes aynı noktaya yığılmasın
      if ((t.engN || 0) >= 3 && d > f.range + 6) return [t.x - s * (f.range + 26 + Math.abs(f.off)), t.y + f.off * 2];
      return [t.x - s * (f.range * 0.6), t.y + f.off];
    };
    if (ord === 'attack' && !ranged) { if (t) goal = approach(); }
    else if (ord === 'attack' && ranged && t) goal = d > f.range ? [t.x, t.y] : [f.x, f.y];
    else if (ord === 'advance' && t && d < 150 && !ranged) goal = approach();
    else if (ord === 'defend' && t && !ranged && Math.hypot(t.x - goal[0], t.y - goal[1]) < 170) goal = approach();
    if (f.isPlayer && ord === 'wait' && t && d < f.range + 25) goal = [t.x, t.y];
    if (this.siege && this.sideOf(f) === 'att' && ord === 'attack' && !ranged && (!t || d > 400)) goal = [this.keepX, this.keepY + f.off * 4];
    if (this.sideOf(f) === 'att' && !ranged && (ord === 'attack' || ord === 'advance' || ord === 'move')) {
      const w = this.blockingWall(f);
      if (w && goal[0] > w.x && f.x >= w.x - 24) {
        f.dir = 1;
        if (f.cdT <= 0) { f.cdT = f.cd; f.atkT = 0.3; this.hitWall(w, f.dmg * (w.wood ? 0.3 : 0.12) * boost, f.x + 8, f.y); }
        return;
      }
    }
    this.walk(f, goal[0], goal[1], sp, dt);
  },
  walk(f, gx, gy, sp, dt) {
    const dx = gx - f.x, dy = gy - f.y, d = Math.hypot(dx, dy);
    if (d < 2.5) return;
    const st = Math.min(d, sp * dt);
    f.x += dx / d * st; f.y += dy / d * st;
    if (Math.abs(dx) > 1) f.dir = Math.sign(dx);
    f.ph += st * 0.12;
  },
  updateCleric(f, dt) {
    const mine = this.figs.filter(x => x.team === f.team && x.alive && !x.escaped && !x.machine && x !== f);
    if (!mine.length) return;
    if (this.retreatT >= 0 && f.team === 0) { this.walk(f, f.x + (this.sideOf(f) === 'att' ? -200 : 200), f.y, f.speed, dt); if (f.x < -30 || f.x > this.BW + 30) f.escaped = true; return; }
    let cx = 0, cy = 0; for (const m of mine) { cx += m.x; cy += m.y; } cx /= mine.length; cy /= mine.length;
    const gx = cx - this.fdir(f.team) * 70, w = this.blockingWall(f);
    if (!(w && this.sideOf(f) === 'att' && gx > w.x)) this.walk(f, gx, cy, f.speed, dt);
    f.healing = false;
    for (const m of mine) if (m.hp < m.maxhp && Math.abs(m.x - f.x) < 110 && Math.abs(m.y - f.y) < 110) { m.hp = Math.min(m.maxhp, m.hp + f.heal * dt); f.healing = true; }
  },
  updateMachine(f, dt) {
    const ord = this.gOrd[f.team].siege;
    if (f.type === 'tower') {
      const w = this.walls.find(w => w.hp > 0 && !w.bridged);
      if (!w || this.sideOf(f) !== 'att') return;
      if (f.x < w.x - 40) { f.x += f.speed * dt; f.ph += dt; }
      else { w.bridged = true; f.docked = true; this.texts.push({ x: w.x, y: f.y - 60, text: 'Kule yanaştı! Surlara!', life: 2.5, col: '#fff3c4' }); }
      return;
    }
    if (ord === 'retreat') { f.x += (this.sideOf(f) === 'att' ? -1 : 1) * f.speed * dt; if (f.x < -30 || f.x > this.BW + 30) f.escaped = true; return; }
    if (ord === 'move' && f.sx != null) { const d = Math.hypot(f.sx - f.x, f.sy - f.y); if (d > 4) { f.x += (f.sx - f.x) / d * f.speed * dt; f.y += (f.sy - f.y) / d * f.speed * dt; f.ph += dt; return; } }
    f.cdT -= dt;
    if (f.atkT > 0) f.atkT -= dt;
    if (f.cdT > 0) return;
    if (f.type === 'cannon' && f.team === 0 && this.sideOf(f) === 'att' && this.myBalls <= 0) {
      if (!f.warned) { f.warned = true; this.texts.push({ x: f.x, y: f.y - 40, text: 'Gülle bitti!', life: 2, col: '#ffdd57' }); }
      return;
    }
    const w = this.sideOf(f) === 'att' ? this.walls.find(w => w.hp > 0) : null;
    let tx, ty, wall = null;
    if (w && Math.abs(w.x - f.x) < f.range) { tx = w.x - 6; ty = clamp(f.y + rand(-80, 80), 30, BH - 30); wall = w; }
    else {
      const en = this.figs.filter(e => e.team !== f.team && e.alive && !e.escaped && Math.hypot(e.x - f.x, e.y - f.y) < f.range);
      if (!en.length) return;
      const e = pick(en); tx = e.x; ty = e.y;
    }
    f.cdT = f.cd * rand(0.9, 1.15); f.atkT = 0.6;
    f.dir = Math.sign(tx - f.x) || f.dir;
    if (f.type === 'cannon') { this.ballsUsed++; if (f.team === 0 && this.myBalls != null) this.myBalls--; SFX.boom(); this.puff(f.x + f.dir * 20, f.y, '#d8d0c0', 10); }
    else SFX.arrow();
    const kind = f.type === 'cannon' ? 'ball' : 'rock';
    this.launch(f.x + f.dir * 14, f.y, f.type === 'cannon' ? 12 : 30, tx, ty, kind, f.team, kind === 'ball' ? 60 : 45, wall, kind === 'ball' ? 0.9 : 1.8);
  },
  melee(f, t, boost) {
    f.atkT = 0.3;
    let dmg = f.dmg * boost * rand(0.85, 1.15);
    if (f.type === 'spear' && (t.type === 'cav' || t.type === 'elephant')) dmg *= 2.5;
    if (f.type === 'cav') dmg *= 1.25;
    const wk = this.weaponOf(f);
    if (f.type === 'elephant' || f.isCmd) for (const e of this.figs) if (e.alive && !e.escaped && e.team !== f.team && e !== t && Math.hypot(e.x - t.x, e.y - t.y) < (f.isCmd ? 18 : 30)) this.damage(e, dmg * 0.5, f, wk);
    if (t.machine) dmg *= 1.5;
    this.damage(t, dmg, f, wk);
    SFX.clash();
  },
  shootArrow(f, t, dmg) {
    f.atkT = 0.35;
    const d = Math.hypot(t.x - f.x, t.y - f.y), spread = 5 + d * 0.025;
    this.launch(f.x + f.dir * 5, f.y, f.onWall != null ? 45 : 16, t.x + rand(-spread, spread), t.y + rand(-spread, spread), 'arrow', f.team, dmg, null, null);
    SFX.arrow();
  },
  launch(x, y, z, tx, ty, kind, team, dmg, wall, T) {
    T = T || clamp(Math.hypot(tx - x, ty - y) / 430, 0.3, 1.9);
    const tz = kind === 'arrow' ? 10 : 4;
    this.proj.push({ x, y, z, vx: (tx - x) / T, vy: (ty - y) / T, vz: (tz - z + 0.5 * GRAV * T * T) / T, t: 0, T, kind, team, dmg, wall });
    if (this.proj.length > 500) this.proj.shift();
  },
  updateProjectiles(dt) {
    for (const p of this.proj) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= GRAV * dt;
      if (p.kind === 'fire' && Math.random() < 0.6) this.parts.push({ x: p.x, y: p.y, z: p.z, vx: rand(-20, 20), vy: 0, vz: rand(10, 40), life: 0.5, max: 0.5, kind: 'flame', r: rand(2, 4) });
      if (p.t < p.T) continue;
      p.dead = true;
      if (p.wall && p.wall.hp > 0) { this.hitWall(p.wall, p.kind === 'ball' ? 260 : 120, p.wall.x - 8, p.y); SFX.crumble(); continue; }
      if (p.kind === 'arrow') {
        let hit = null, hd = 12;
        for (const f of this.figs) {
          if (!f.alive || f.team === p.team || f.escaped) continue;
          const d = Math.hypot(f.x - p.x, f.y - p.y);
          if (d < hd + (f.machine ? 16 : 0)) { hd = d; hit = f; }
        }
        if (hit) {
          let dmg = p.dmg;
          if (hit.onWall != null && this.walls[hit.onWall] && this.walls[hit.onWall].hp > 0) dmg *= 0.5;
          if (hit.machine) dmg *= 0.35;
          // Ok isabet ettiği yerde saplı kalır (başta ya da gövdede)
          if (!hit.machine && hit.stuck.length < 6) {
            const head = Math.random() < 0.28;
            hit.stuck.push({ h: head, o: rand(-1, 1), tx: -(Math.sign(p.vx) || 1) * (hit.dir || 1), a: rand(0.15, 0.7) });
            if (head) dmg *= 1.6;
          }
          this.damage(hit, dmg, null, 'arrow'); SFX.hit();
        } else if (this.decals.length < 700) this.decals.push({ kind: 'arrow', x: p.x, y: p.y, a: Math.atan2(p.vy, p.vx) });
      } else {
        const R = p.kind === 'ball' ? 30 : p.kind === 'fire' ? 50 : 34;
        for (const f of this.figs) {
          if (!f.alive || f.team === p.team || f.escaped) continue;
          const d = Math.hypot(f.x - p.x, f.y - p.y);
          if (d < R) this.damage(f, p.dmg * (1 - d / R * 0.5) * (f.machine ? 2 : 1), { x: p.x, y: p.y }, p.kind);
        }
        this.puff(p.x, p.y, p.kind === 'fire' ? '#ff9a2e' : '#b8a387', p.kind === 'fire' ? 16 : 10);
        if (p.kind === 'fire') for (let i = 0; i < 10; i++) this.parts.push({ x: p.x + rand(-28, 28), y: p.y + rand(-28, 28), z: 0, vx: 0, vy: 0, vz: rand(20, 60), life: rand(1, 2), max: 2, kind: 'flame', r: rand(3, 6) });
        SFX.boom();
        if (this.decals.length < 700) this.decals.push({ kind: 'crater', x: p.x, y: p.y, r: p.kind === 'ball' ? 9 : 7 });
      }
    }
    this.proj = this.proj.filter(p => !p.dead);
  },
  updateTowers(dt, byTeam) {
    if (!this.towers.length) return;
    const atk = byTeam[this.attTeam], cross = this.special === 'crossbow';
    for (const tw of this.towers) {
      if (!tw.alive) continue;
      if (tw.wall >= 0 && this.walls[tw.wall].hp <= 0) { tw.alive = false; this.puff(tw.x, tw.y, '#aaa', 20); continue; }
      tw.cd -= dt;
      if (tw.cd > 0) continue;
      const tgts = atk.filter(f => f.x < tw.x && Math.hypot(tw.x - f.x, tw.y - f.y) < 620 && !f.escaped);
      if (!tgts.length) continue;
      const t = pick(tgts);
      tw.cd = (cross ? 0.9 : 1.6) * rand(0.8, 1.2);
      if (this.special === 'canal' && Math.random() < 0.18) { this.launch(tw.x, tw.y, tw.z, t.x, t.y, 'ball', this.defTeam, 55, null, 0.9); SFX.boom(); }
      else this.launch(tw.x, tw.y, tw.z, t.x, t.y, 'arrow', this.defTeam, cross ? 26 : 15);
    }
  },
  updateSpecial(dt, byTeam) {
    if (!this.siege || !this.walls.length) return;
    this.specialT -= dt;
    if (this.specialT > 0) return;
    const atk = byTeam[this.attTeam].filter(f => !f.escaped);
    const w0 = this.walls.find(w => w.hp > 0);
    if (!w0) return;
    if (this.special === 'rocks') {
      this.specialT = rand(2, 3);
      const near = atk.filter(f => f.x > w0.x - 170 && f.x < w0.x);
      if (near.length) { const t = pick(near); this.launch(w0.x, t.y, 60, t.x, t.y, 'rock', this.defTeam, 60, null, 0.8); this.texts.push({ x: w0.x, y: t.y - 30, text: 'Kaya!', life: 1, col: '#fff3c4' }); }
    } else if (this.special === 'greekfire') {
      this.specialT = rand(3, 4.5);
      const near = atk.filter(f => f.x > w0.x - 460 && f.x < w0.x);
      if (near.length) { const t = pick(near); this.launch(w0.x, t.y, 60, t.x, t.y, 'fire', this.defTeam, 42, null, 1.1); this.texts.push({ x: w0.x, y: t.y - 30, text: 'Rum ateşi!', life: 1.2, col: '#ffb14a' }); }
    } else this.specialT = 5;
  },

  /* ================== HASAR VE ÖLÜM (kansız) ================== */
  hitWall(w, dmg, x, y) {
    if (w.hp <= 0) return;
    w.hp -= dmg;
    for (let i = 0; i < 4; i++) this.parts.push({ x, y: y + rand(-10, 10), z: rand(5, 25), vx: rand(-80, 20), vy: rand(-30, 30), vz: rand(40, 140), life: 1.2, max: 1.2, kind: 'debris', r: rand(2, 4), col: w.wood ? '#8b5e3c' : '#9e9482' });
    if (Math.random() < 0.3) w.crack.push([rand(-8, 8), rand(30, BH - 30)]);
    if (w.hp <= 0) {
      w.hp = 0;
      SFX.crumble(); SFX.boom();
      this.texts.push({ x: w.x, y: this.cam.y - 80, text: 'SUR YIKILDI!', life: 3, col: '#ffdd57' });
      for (let i = 0; i < 60; i++) this.parts.push({ x: w.x + rand(-20, 20), y: rand(20, BH - 20), z: rand(0, 40), vx: rand(-120, 120), vy: rand(-30, 30), vz: rand(50, 200), life: 2, max: 2, kind: 'debris', r: rand(3, 7), col: w.wood ? '#8b5e3c' : '#9e9482' });
      for (let y = 60; y < BH; y += 160) this.puff(w.x, y, '#cbbfa8', 8);
      for (const tw of this.towers) if (this.walls[tw.wall] === w) tw.alive = false;
    }
  },
  damage(f, dmg, src, wk) {
    if (!f.alive || f.escaped) return;
    if (f.dmgTaken) dmg *= f.dmgTaken;
    if (f.isCmd && !f.isPlayer) dmg *= 0.6;
    f.hp -= dmg;
    if (f.hp <= 0) this.kill(f, src, wk);
  },
  kill(f, src, wk) {
    f.alive = false; f.hp = 0;
    if (f.team !== 0 && !f.machine) this.kills++;
    if (f.isPlayer) { this.say(f, 'Ahh... yaralandım!', 3); Voice.speak('Yaralandım!', { pitch: 0.6 }); }
    if (f.machine) { this.puff(f.x, f.y, '#8b6a4a', 26); SFX.crumble(); this.corpses.push({ part: 'wreck', x: f.x, y: f.y, z: 0, vz: 0, type: f.type, rot: rand(-0.3, 0.3) }); return; }
    const dir = src ? Math.sign(f.x - src.x) || 1 : (Math.random() < 0.5 ? 1 : -1);
    const base = { color: f.color, hat: f.hat, type: f.type, cmd: f.isCmd ? f : null, robe: f.robe, dir: f.dir, stuck: f.stuck };
    const piece = (part, z, vx, vy, vz, vr) => this.corpses.push(Object.assign({ part, x: f.x, y: f.y, z, vx, vy, vz, rot: 0, vr }, base));
    // Silaha göre parçalanma: kafa kopması, ikiye ya da üçe bölünme (kan yok)
    let cut = 'whole';
    const r = Math.random();
    if (this.gore && f.type !== 'elephant') {
      if (f.type === 'cav') cut = (wk === 'sword' || wk === 'axe') && r < 0.4 ? 'decap' : 'whole';
      else if (wk === 'sword') cut = r < 0.33 ? 'decap' : r < 0.66 ? 'split2' : 'whole';
      else if (wk === 'axe') cut = r < 0.45 ? 'decap' : r < 0.75 ? 'split2' : 'split3';
      else if (wk === 'ball' || wk === 'rock') cut = r < 0.55 ? 'split3' : r < 0.8 ? 'split2' : 'decap';
      else if (wk === 'blunt') cut = r < 0.2 ? 'decap' : 'whole';
    }
    if (cut === 'decap') {
      piece('headless', 0, dir * rand(10, 35), 0, rand(20, 50), 0);
      this.corpses[this.corpses.length - 1].target = dir * Math.PI / 2;
      piece('head', 24, dir * rand(70, 170), rand(-50, 50), rand(150, 260), dir * rand(6, 14));
    } else if (cut === 'split2') {
      piece('upper', 14, dir * rand(50, 140), rand(-40, 40), rand(100, 220), dir * rand(4, 10));
      piece('lower', 0, dir * rand(10, 30), 0, rand(20, 50), dir * rand(1, 3));
    } else if (cut === 'split3') {
      piece('head', 26, dir * rand(90, 200), rand(-60, 60), rand(180, 300), dir * rand(8, 16));
      piece('torso', 14, dir * rand(60, 150), rand(-50, 50), rand(110, 220), dir * rand(4, 10));
      piece('lower', 0, dir * rand(15, 45), rand(-10, 10), rand(30, 70), dir * rand(1, 4));
    } else {
      piece('whole', 0, dir * rand(10, 40), 0, rand(30, 70), 0);
      this.corpses[this.corpses.length - 1].target = dir * Math.PI / 2 * rand(0.85, 1.05);
      if (wk === 'fire') this.corpses[this.corpses.length - 1].burnt = true;
    }
    if (cut !== 'whole') { this.puff(f.x, f.y - 10, '#d8ccb0', 3); }
    if (this.corpses.length > 420) this.corpses.splice(0, this.corpses.length - 420);
  },
  puff(x, y, col, n) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rand(-10, 10), y: y + rand(-10, 10), z: rand(0, 15), vx: rand(-30, 30), vy: rand(-30, 30), vz: rand(10, 50), life: rand(0.6, 1.4), max: 1.4, kind: 'smoke', r: rand(5, 11), col });
  },
  updateFx(dt) {
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'smoke' || p.kind === 'flame' || p.kind === 'splash') { p.z += p.vz * dt; p.vx *= 0.96; continue; }
      p.z += p.vz * dt; p.vz -= GRAV * dt;
      if (p.z <= 0) { p.z = 0; p.vx = 0; p.vy = 0; p.vz = 0; }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const c of this.corpses) {
      if (c.z > 0 || c.vz > 0) {
        c.x += (c.vx || 0) * dt; c.y += (c.vy || 0) * dt; c.z += c.vz * dt; c.vz -= GRAV * dt; c.rot += (c.vr || 0) * dt;
        if (c.z <= 0) {
          c.z = 0; c.vz = 0; c.vy = 0;
          if (c.part === 'head') { c.vx *= 0.5; if (Math.abs(c.vx) > 8) { c.vz = Math.abs(c.vx) * 0.6; } else { c.vx = 0; c.vr = 0; } }
          else { c.vx = 0; c.vr = 0; if (c.part === 'upper' || c.part === 'torso') c.rot = (c.dir > 0 ? 1 : -1) * Math.PI / 2 * 0.95; }
        }
      } else if (c.target != null && Math.abs(c.rot - c.target) > 0.05) c.rot += (c.target - c.rot) * Math.min(1, dt * 8);
    }
    for (const b of this.bubbles) b.life -= dt;
    this.bubbles = this.bubbles.filter(b => b.life > 0 && b.f);
    for (const t of this.texts) { t.life -= dt; t.y -= dt * 14; }
    this.texts = this.texts.filter(t => t.life > 0);
  },

  /* ================== BİTİŞ ================== */
  checkEnd(byTeam, dt) {
    const fighting = team => byTeam[team].filter(f => !f.machine && f.type !== 'cleric' && !f.escaped).length;
    const mine = fighting(0), theirs = fighting(1);
    if (this.player && !this.player.alive) return this.finish(false, true);
    if (this.retreatT >= 0) {
      this.retreatT += dt;
      if (this.retreatT > 4 || mine === 0) return this.finish(false, false, true);
      return;
    }
    const attAlive = this.attTeam === 0 ? mine : theirs, defAlive = this.defTeam === 0 ? mine : theirs;
    if (attAlive === 0) return this.finish(this.defTeam === 0);
    if (defAlive === 0) return this.finish(this.attTeam === 0);
    if (this.siege) {
      const attIn = byTeam[this.attTeam].some(f => !f.machine && Math.hypot(f.x - this.keepX, f.y - this.keepY) < 90);
      const defNear = byTeam[this.defTeam].some(f => !f.machine && f.type !== 'cleric' && Math.hypot(f.x - this.keepX, f.y - this.keepY) < 180 && f.onWall == null);
      if (attIn && !defNear) { this.capture += dt; if (this.capture >= 5) return this.finish(this.attTeam === 0); }
      else this.capture = Math.max(0, this.capture - dt * 0.5);
    }
    if (this.t > (this.siege ? 360 : 300)) {
      if (this.siege) return this.finish(this.defTeam === 0);
      const pw = team => byTeam[team].reduce((s, f) => s + f.hp, 0);
      return this.finish(pw(0) > pw(1));
    }
  },
  finish(playerWon, wounded, retreated) {
    if (this.over) return;
    this.over = true;
    const cfg = this.cfg;
    // Her figür bir askerdir: kalan sayı = hayatta kalan figür sayısı
    const remainOf = (team, side) => {
      const units = {}, siege = {};
      for (const k of UNIT_KEYS) {
        const alive = this.figs.filter(f => f.team === team && f.type === k && !f.ally && (f.alive || f.escaped)).length;
        units[k] = Math.min(side.units[k] || 0, alive);
      }
      for (const k of ['catapult', 'tower', 'cannon']) siege[k] = Math.max(0, (side.siege && side.siege[k] || 0) - this.figs.filter(f => f.team === team && f.type === k && !f.alive).length);
      return { units, siege };
    };
    const aliveAlly = this.figs.filter(f => f.team === 0 && f.ally && (f.alive || f.escaped)).length;
    const initAlly = this.figs.filter(f => f.team === 0 && f.ally).length;
    const winner = playerWon ? cfg.playerSide : (cfg.playerSide === 'att' ? 'def' : 'att');
    this.result = {
      winner, attRemain: remainOf(this.teamOf('att'), cfg.att), defRemain: remainOf(this.teamOf('def'), cfg.def),
      playerWounded: !!wounded, retreated: !!retreated, kills: this.kills,
      ballsUsed: this.ballsUsed, allyRatio: initAlly ? aliveAlly / initAlly : null
    };
    const myLoss = this.figs.filter(f => f.team === 0 && !f.alive && !f.machine && !f.isCmd).length;
    const res = this.result, onEnd = this.onEnd;
    setTimeout(() => {
      if (playerWon) { SFX.horn(); Voice.speak(Game.S.player.religion === 'islam' ? 'Zafer bizimdir! Elhamdülillah!' : 'Zafer bizimdir!', { pitch: 0.8 }); }
      UI.battleOver(playerWon, wounded, retreated, res.kills, myLoss, () => {
        this.active = false; this.result = null;
        onEnd(res);
      });
    }, wounded ? 1600 : 900);
  },

  /* ================== ARAYÜZ ================== */
  updateHud(first) {
    const count = (t, g) => this.figs.filter(f => f.team === t && f.alive && !f.escaped && (g === 'siege' ? f.machine : f.type === g)).length;
    const cell = (t, g) => { const n = count(t, g); return n ? `<span><canvas width="40" height="40" data-hi="${t}:${g}"></canvas><b>${fmt(n)}</b></span>` : ''; };
    const side = t => `<i class="flag" style="--c:${this.teamColor(t)}">${t === 0 ? this.emblem() : '⚔'}</i><div class="cnts">${['inf', 'archer', 'spear', 'cav', 'siege'].map(g => cell(t, g)).join('')}</div>`;
    const el = document.getElementById('bh');
    const key = ['inf', 'archer', 'spear', 'cav', 'siege'].map(g => count(0, g) + ',' + count(1, g)).join('|');
    if (first || key !== this._hk) {
      this._hk = key;
      el.querySelector('.l').innerHTML = side(0);
      el.querySelector('.r').innerHTML = side(1);
      el.querySelectorAll('canvas[data-hi]').forEach(c => { const [t, g] = c.dataset.hi.split(':'); this.drawIcon(c, g, +t); });
      document.querySelectorAll('#bgroups [data-cnt]').forEach(s => {
        const g = s.dataset.cnt;
        if (g === 'cmd') { s.textContent = ''; return; }
        if (this.phase === 'deploy') { const all = this.figs.filter(f => f.team === 0 && f.alive && grpOf(f) === g && !f.overflow).length; s.textContent = this.reserveOf(g).length + '/' + all; }
        else s.textContent = fmt(count(0, g));
      });
    }
    const left = Math.max(0, Math.ceil((this.siege ? 360 : 300) - this.t));
    el.querySelector('.m').innerHTML = (this.phase === 'deploy' ? `<b>Konuşlanma</b><small>Sahada ${this.deployedCount()}/${MAXF}</small>` : `<b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>`) + `<small>${esc(this.cfg.title)}</small>
      ${this.walls.length ? '<div class="walls">🧱 ' + this.walls.map(w => `<span class="wb"><i style="width:${Math.max(0, w.hp / w.maxhp * 100)}%"></i></span>`).join('') + '</div>' : ''}
      ${this.siege && this.capture > 0 ? `<div class="cap">🚩 Sancak alınıyor %${Math.round(this.capture / 5 * 100)}</div>` : ''}
      ${this.myBalls != null && this.figs.some(f => f.type === 'cannon' && f.team === 0) ? `<div class="sm">⚫ Gülle: ${this.myBalls}</div>` : ''}
      ${this.player ? `<div class="sm">👑 <span class="hpb"><i style="width:${Math.max(0, this.player.hp / this.player.maxhp * 100)}%"></i></span></div>` : ''}`;
    const cb = document.querySelector('#bcmds [data-c="cry"]');
    if (cb) { cb.classList.toggle('cool', this.cryCd > 0); cb.dataset.cd = this.cryCd > 0 ? Math.ceil(this.cryCd) : ''; }
    const r = document.getElementById('b-ratio');
    const ov = this.figs.filter(f => f.overflow && f.team === 0).length;
    if (r) r.textContent = ov ? `${ov} asker sahaya sığmadı, yedekte` : '';
  },
  emblem() { return { islam: '☪', hristiyan: '✝', tengri: '☉', budizm: '☸', hindu: '✺', yahudi: '✡', pagan: 'ᛟ' }[Game.S.player.religion] || '★'; },
  drawIcon(cv, g, team) {
    const x = cv.getContext('2d'), s = cv.width / 56;
    x.clearRect(0, 0, cv.width, cv.height);
    x.save(); x.scale(s, s); x.translate(28, 50);
    const hat = team ? (CULTURE_HAT[(Game.S.nations[this.ownerOfTeam(1)] || {}).culture] || 'yok') : Game.S.player.headgear;
    const f = { id: 1, type: g === 'siege' ? 'catapult' : g, machine: g === 'siege', team, dir: 1, ph: 0.7, atkT: 0, color: this.teamColor(team), hat, armorTier: 0, isCmd: g === 'cmd', outfit: g === 'cmd' ? Game.S.player.outfit : null, stuck: [] };
    if (g === 'siege') { x.scale(0.9, 0.9); this.drawMachineShape(x, f); }
    else { const k = g === 'cav' ? 0.62 : 0.8; x.scale(k, k); this.drawBody(x, f); }
    x.restore();
  },

  /* ================== ARAZİ (parşömen) ================== */
  buildTerrain() {
    const W = this.BW, Hh = BH;
    const c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(W / 2, Hh / 2, 100, W / 2, Hh / 2, W * 0.7);
    g.addColorStop(0, '#efdfb8'); g.addColorStop(1, '#d9c08d');
    x.fillStyle = g; x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,60,30' : '255,250,235'},${rand(0.03, 0.09)})`; x.fillRect(rand(0, W), rand(0, Hh), rand(1, 3), rand(1, 3)); }
    x.strokeStyle = 'rgba(80,110,140,0.13)'; x.lineWidth = 1.2;
    for (let y = 34; y < Hh; y += 30) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    x.strokeStyle = 'rgba(190,60,50,0.25)'; x.beginPath(); x.moveTo(46, 0); x.lineTo(46, Hh); x.stroke();
    x.lineCap = 'round'; x.lineJoin = 'round';
    const sk = (lw, a) => { x.strokeStyle = `rgba(43,32,24,${a})`; x.lineWidth = lw; };
    for (const ry of [rand(0.25, 0.35) * Hh, rand(0.68, 0.78) * Hh]) {
      sk(1.1, 0.5);
      for (const off of [-9, 9]) { x.beginPath(); for (let px = 0; px <= W; px += 30) { const py = ry + Math.sin(px * 0.003 + ry) * 40 + off; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
    }
    for (let i = 0; i < 9; i++) this.hill(x, rand(250, W - 250), rand(120, Hh - 120), rand(70, 150));
    if (this.river) {
      const pts = []; for (let y = -20; y <= Hh + 20; y += 12) pts.push([this.riverX(y), y]);
      x.fillStyle = 'rgba(150,180,190,0.55)';
      x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px - 26, py) : x.moveTo(px - 26, py)); for (let i = pts.length - 1; i >= 0; i--) x.lineTo(pts[i][0] + 26, pts[i][1]); x.closePath(); x.fill();
      sk(1.8, 0.85);
      for (const s of [-26, 26]) { x.beginPath(); pts.forEach(([px, py], i) => { const jx = px + s + Math.sin(py * 0.08) * 1.5; i ? x.lineTo(jx, py) : x.moveTo(jx, py); }); x.stroke(); }
      sk(0.8, 0.35);
      for (let y = 10; y < Hh; y += 22) { const rx = this.riverX(y) + rand(-12, 12); x.beginPath(); x.moveTo(rx - 6, y); x.quadraticCurveTo(rx, y - 3, rx + 6, y); x.stroke(); }
      for (let y = 0; y < Hh; y += 18) if (Math.random() < 0.5) this.rock(x, this.riverX(y) + (Math.random() < 0.5 ? -32 : 32) + rand(-6, 6), y, rand(3, 6));
      for (const by of this.river.bridges) this.bridge(x, this.riverX(by), by);
    }
    const nearRiver = (px, py, m) => this.river && Math.abs(px - this.riverX(py)) < m;
    const inCastle = (px, m) => this.siege && px > this.walls[0].x - m;
    for (let i = 0; i < 260; i++) {
      const top = Math.random() < 0.5, px = rand(0, W), py = top ? rand(14, 110) : rand(Hh - 100, Hh - 6);
      if (nearRiver(px, py, 50) || inCastle(px, 60)) continue;
      this.pine(x, px, py, rand(10, 18));
    }
    for (let i = 0; i < 40; i++) { const px = rand(150, W - 150), py = rand(150, Hh - 150); if (nearRiver(px, py, 70) || inCastle(px, 80)) continue; this.tree(x, px, py, rand(8, 12)); }
    for (let i = 0; i < 30; i++) { const px = rand(100, W - 100), py = rand(80, Hh - 80); if (inCastle(px, 60)) continue; this.rock(x, px, py, rand(4, 9)); }
    sk(0.9, 0.45);
    for (let i = 0; i < 500; i++) { const px = rand(0, W), py = rand(0, Hh); if (inCastle(px, 0)) continue; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 2, py - 5); x.moveTo(px, py); x.lineTo(px + 2, py - 6); x.stroke(); }
    if (!this.siege) this.village(x, W / 2 + rand(-250, 250) + (this.river ? 160 : 0), Math.random() < 0.5 ? 150 : Hh - 170);
    if (Math.random() < 0.6) this.pond(x, rand(200, 380), Hh - rand(140, 200));
    this.camp(x, 0, this.teamColor(this.attTeam), true);
    if (!this.siege) this.camp(x, W, this.teamColor(this.defTeam), false);
    else this.town(x);
    this.terr = c;
    const m = document.getElementById('mm');
    m.width = 200; m.height = Math.round(200 * Hh / W);
    this.mmBase = document.createElement('canvas'); this.mmBase.width = m.width; this.mmBase.height = m.height;
    this.mmBase.getContext('2d').drawImage(c, 0, 0, m.width, m.height);
  },
  hill(x, hx, hy, r) {
    x.strokeStyle = 'rgba(43,32,24,0.75)'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(hx - r, hy); x.bezierCurveTo(hx - r * 0.6, hy - r * 0.55, hx + r * 0.4, hy - r * 0.6, hx + r, hy); x.stroke();
    x.lineWidth = 0.8; x.strokeStyle = 'rgba(43,32,24,0.4)';
    for (let i = 0; i < r / 6; i++) { const t = rand(0.45, 0.95), px = hx - r + 2 * r * t, py = hy - Math.sin(t * Math.PI) * r * 0.42; x.beginPath(); x.moveTo(px, py + 3); x.lineTo(px + 4, py + 12); x.stroke(); }
  },
  pine(x, px, py, s) {
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.ellipse(px + 3, py + 1, s * 0.4, s * 0.12, 0, 0, 7); x.fill();
    x.strokeStyle = INK; x.lineWidth = 1; x.fillStyle = '#9aa58a';
    x.beginPath(); x.moveTo(px, py - s * 1.6); x.lineTo(px - s * 0.42, py - s * 0.2); x.lineTo(px + s * 0.42, py - s * 0.2); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); for (let i = 1; i < 5; i++) { const yy = py - s * 1.6 + i * s * 0.3; x.moveTo(px - i * 0.09 * s, yy); x.lineTo(px - i * 0.11 * s - 3, yy + 3); x.moveTo(px + i * 0.09 * s, yy); x.lineTo(px + i * 0.11 * s + 3, yy + 3); } x.stroke();
    x.beginPath(); x.moveTo(px, py - s * 0.2); x.lineTo(px, py); x.stroke();
  },
  tree(x, px, py, s) {
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.ellipse(px + 3, py + 1, s * 0.7, s * 0.2, 0, 0, 7); x.fill();
    x.strokeStyle = INK; x.lineWidth = 1.1; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - s * 0.8); x.stroke();
    x.fillStyle = '#b5b28c';
    for (const [ox, oy, r] of [[0, -1.3, 0.62], [-0.45, -0.95, 0.48], [0.45, -0.95, 0.48]]) { x.beginPath(); x.arc(px + ox * s, py + oy * s, r * s, 0, 7); x.fill(); x.stroke(); }
  },
  rock(x, px, py, s) {
    x.fillStyle = '#d4c49e'; x.strokeStyle = INK; x.lineWidth = 1;
    x.beginPath(); x.moveTo(px - s, py); x.lineTo(px - s * 0.6, py - s * 0.8); x.lineTo(px + s * 0.4, py - s * 0.9); x.lineTo(px + s, py); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(px + s * 0.1, py - s * 0.85); x.lineTo(px + s * 0.3, py); x.stroke();
  },
  bridge(x, bx, by) {
    x.fillStyle = '#c9a877'; x.strokeStyle = INK; x.lineWidth = 1.4;
    x.beginPath(); x.rect(bx - 40, by - 20, 80, 40); x.fill(); x.stroke();
    x.lineWidth = 0.9; for (let i = -36; i < 40; i += 7) { x.beginPath(); x.moveTo(bx + i, by - 20); x.lineTo(bx + i, by + 20); x.stroke(); }
    x.lineWidth = 2; x.beginPath(); x.moveTo(bx - 42, by - 22); x.lineTo(bx + 42, by - 22); x.moveTo(bx - 42, by + 22); x.lineTo(bx + 42, by + 22); x.stroke();
    for (const s of [-42, -14, 14, 42]) for (const yy of [-22, 22]) { x.beginPath(); x.moveTo(bx + s, by + yy); x.lineTo(bx + s, by + yy - 5); x.stroke(); }
  },
  house(x, hx, hy, w, h, church) {
    x.strokeStyle = INK; x.lineWidth = 1.2;
    x.fillStyle = '#efe2c4'; x.fillRect(hx - w / 2, hy - h, w, h); x.strokeRect(hx - w / 2, hy - h, w, h);
    x.fillStyle = '#b8a07a'; x.beginPath(); x.moveTo(hx - w / 2 - 3, hy - h); x.lineTo(hx - w / 2 + 4, hy - h - h * 0.7); x.lineTo(hx + w / 2 + 4, hy - h - h * 0.7); x.lineTo(hx + w / 2 + 3, hy - h); x.closePath(); x.fill(); x.stroke();
    x.lineWidth = 0.6; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(hx - w / 2 + 2 + i * w / 4, hy - h - 1); x.lineTo(hx - w / 2 + 6 + i * w / 4, hy - h - h * 0.65); x.stroke(); }
    x.lineWidth = 1; x.strokeRect(hx - 2, hy - h * 0.5, 4, h * 0.5);
    if (church) { x.fillStyle = '#efe2c4'; x.fillRect(hx + w / 2 - 8, hy - h - 18, 8, 18); x.strokeRect(hx + w / 2 - 8, hy - h - 18, 8, 18); x.beginPath(); x.moveTo(hx + w / 2 - 10, hy - h - 18); x.lineTo(hx + w / 2 - 4, hy - h - 28); x.lineTo(hx + w / 2 + 2, hy - h - 18); x.closePath(); x.stroke(); }
  },
  village(x, vx, vy) {
    x.strokeStyle = 'rgba(43,32,24,0.6)'; x.lineWidth = 0.8;
    for (const [fx, fy, w, h] of [[vx + 70, vy - 30, 90, 60], [vx - 160, vy + 10, 80, 50]]) {
      x.save(); x.translate(fx, fy); x.rotate(-0.08); x.strokeRect(0, 0, w, h);
      for (let i = 4; i < w; i += 5) { x.beginPath(); x.moveTo(i, 2); x.lineTo(i, h - 2); x.stroke(); }
      x.restore();
    }
    this.house(x, vx - 40, vy, 30, 18, true); this.house(x, vx, vy + 26, 24, 15); this.house(x, vx - 80, vy + 30, 22, 14); this.house(x, vx + 30, vy - 10, 22, 14);
    const mx = vx + 30, my = vy + 60;
    x.strokeStyle = INK; x.lineWidth = 1.2; x.fillStyle = '#efe2c4';
    x.beginPath(); x.moveTo(mx - 7, my); x.lineTo(mx - 4, my - 24); x.lineTo(mx + 4, my - 24); x.lineTo(mx + 7, my); x.closePath(); x.fill(); x.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.5; x.beginPath(); x.moveTo(mx, my - 24); x.lineTo(mx + Math.cos(a) * 20, my - 24 + Math.sin(a) * 20); x.stroke(); x.strokeRect(mx + Math.cos(a) * 12 - 2, my - 24 + Math.sin(a) * 12 - 2, 4, 4); }
    x.lineWidth = 1; x.beginPath(); x.moveTo(vx - 120, vy + 50); x.lineTo(vx + 90, vy + 70); x.stroke();
    for (let i = 0; i <= 10; i++) { const px = lerp(vx - 120, vx + 90, i / 10), py = lerp(vy + 50, vy + 70, i / 10); x.beginPath(); x.moveTo(px, py - 6); x.lineTo(px, py + 2); x.stroke(); }
  },
  pond(x, px, py) {
    x.fillStyle = 'rgba(150,180,190,0.55)'; x.strokeStyle = INK; x.lineWidth = 1.4;
    x.beginPath(); x.ellipse(px, py, 80, 40, 0.1, 0, 7); x.fill(); x.stroke();
    x.lineWidth = 0.7; for (let i = 0; i < 6; i++) { const rx = px + rand(-50, 50), ry = py + rand(-20, 20); x.beginPath(); x.moveTo(rx - 6, ry); x.lineTo(rx + 6, ry); x.stroke(); }
    for (let i = 0; i < 10; i++) { const a = rand(0, 7), rx = px + Math.cos(a) * 84, ry = py + Math.sin(a) * 44; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 1, ry - 8); x.moveTo(rx, ry); x.lineTo(rx + 2, ry - 7); x.stroke(); }
  },
  camp(x, edge, color, leftSide) {
    const dir = leftSide ? 1 : -1, px = edge + dir * 120;
    x.strokeStyle = INK; x.lineWidth = 1.2; x.fillStyle = '#c9a877';
    for (let y = 150; y < BH - 150; y += 9) { if (Math.abs(y - BH / 2) < 50) continue; x.beginPath(); x.moveTo(px - 2, y + 6); x.lineTo(px - 2, y - 6); x.lineTo(px, y - 9); x.lineTo(px + 2, y - 6); x.lineTo(px + 2, y + 6); x.closePath(); x.fill(); x.stroke(); }
    for (const ty of [150, BH / 2 - 60, BH / 2 + 80, BH - 150]) this.watchtower(x, px + dir * 6, ty);
    for (let i = 0; i < 9; i++) this.tent(x, edge + dir * rand(30, 95), rand(200, BH - 200));
    for (let i = 0; i < 8; i++) { const tx = edge + dir * rand(25, 100), ty = rand(180, BH - 180); x.fillStyle = '#c9a877'; x.fillRect(tx - 4, ty - 4, 8, 7); x.strokeRect(tx - 4, ty - 4, 8, 7); }
    const fx = edge + dir * 60, fy = BH / 2 - 150;
    x.lineWidth = 2; x.beginPath(); x.moveTo(fx, fy + 70); x.lineTo(fx, fy - 10); x.stroke();
    x.fillStyle = color; x.beginPath(); x.rect(fx, fy - 10, 34 * dir, 46); x.fill(); x.lineWidth = 1.4; x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 22px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText((leftSide ? this.attTeam : this.defTeam) === 0 ? this.emblem() : '⚔', fx + 17 * dir, fy + 13);
  },
  watchtower(x, tx, ty) {
    x.strokeStyle = INK; x.lineWidth = 1.3;
    x.beginPath(); x.moveTo(tx - 9, ty + 12); x.lineTo(tx - 6, ty - 22); x.moveTo(tx + 9, ty + 12); x.lineTo(tx + 6, ty - 22); x.moveTo(tx - 8, ty + 4); x.lineTo(tx + 8, ty - 10); x.moveTo(tx + 8, ty + 4); x.lineTo(tx - 8, ty - 10); x.stroke();
    x.fillStyle = '#c9a877'; x.fillRect(tx - 9, ty - 30, 18, 9); x.strokeRect(tx - 9, ty - 30, 18, 9);
    x.beginPath(); x.moveTo(tx - 11, ty - 30); x.lineTo(tx, ty - 40); x.lineTo(tx + 11, ty - 30); x.closePath(); x.fillStyle = '#b8a07a'; x.fill(); x.stroke();
  },
  tent(x, tx, ty) {
    x.strokeStyle = INK; x.lineWidth = 1.2; x.fillStyle = '#efe2c4';
    x.beginPath(); x.moveTo(tx - 12, ty); x.lineTo(tx, ty - 16); x.lineTo(tx + 12, ty); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(tx, ty - 16); x.lineTo(tx - 3, ty); x.stroke();
  },
  town(x) {
    const inner = this.walls[this.walls.length - 1].x;
    if (this.cfg.defense && this.cfg.defense.key === 'koy') {
      // Köy savunması: çit içinde çadırlar, ateş, kuyu
      for (let i = 0; i < 14; i++) {
        const tx = rand(inner + 80, this.BW - 60), ty = rand(80, BH - 60);
        if (Math.hypot(tx - this.keepX, ty - this.keepY) < 160) continue;
        Village.drawTent(x, tx, ty, rand(34, 46), rand(22, 30));
      }
      Village.drawProp(x, { type: 'well', x: inner + 200, y: BH * 0.3 });
      Village.drawProp(x, { type: 'logs', x: inner + 260, y: BH * 0.72 });
      return;
    }
    for (let i = 0; i < 30; i++) {
      const hx = rand(inner + 60, this.BW - 40), hy = rand(60, BH - 40);
      if (Math.hypot(hx - this.keepX, hy - this.keepY) < 150) continue;
      this.house(x, hx, hy, rand(18, 28), rand(12, 17), Math.random() < 0.1);
    }
  },

  /* ================== ÇİZİM ================== */
  draw() {
    if (!this.active) return;
    const x = this.ctx, c = this.cam, W = this.W, H = this.H;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#cdb78a'; x.fillRect(0, 0, W, H);
    x.setTransform(c.z, 0, 0, c.z, W / 2 - c.x * c.z, H / 2 - c.y * c.z);
    x.drawImage(this.terr, 0, 0);
    const vx0 = c.x - W / c.z / 2 - 60, vx1 = c.x + W / c.z / 2 + 60, vy0 = c.y - H / c.z / 2 - 80, vy1 = c.y + H / c.z / 2 + 80;
    const inView = (px, py) => px > vx0 && px < vx1 && py > vy0 && py < vy1;
    for (const d of this.decals) {
      if (!inView(d.x, d.y)) continue;
      if (d.kind === 'pool') { x.fillStyle = 'rgba(150,15,15,0.7)'; x.beginPath(); x.ellipse(d.x, d.y, d.r * d.grow + 0.1, d.r * 0.55 * d.grow + 0.1, 0, 0, 7); x.fill(); }
      else if (d.kind === 'drop') { x.fillStyle = 'rgba(165,20,20,0.75)'; x.beginPath(); x.arc(d.x, d.y, d.r, 0, 7); x.fill(); }
      else if (d.kind === 'arrow') { x.strokeStyle = INK; x.lineWidth = 1; x.beginPath(); x.moveTo(d.x, d.y); x.lineTo(d.x - Math.cos(d.a) * 8, d.y - Math.sin(d.a) * 8 - 3); x.stroke(); }
      else if (d.kind === 'crater') { x.strokeStyle = 'rgba(43,32,24,0.6)'; x.lineWidth = 1; x.fillStyle = 'rgba(90,70,45,0.25)'; x.beginPath(); x.ellipse(d.x, d.y, d.r * 1.4, d.r * 0.8, 0, 0, 7); x.fill(); x.stroke(); }
    }
    if (this.siege) this.drawCastle(x);
    if (this.marker) {
      const m = this.marker; x.strokeStyle = `rgba(160,30,20,${m.t})`; x.lineWidth = 2;
      x.beginPath(); x.arc(m.x, m.y, 14 + (1.2 - m.t) * 12, 0, 7); x.stroke();
      x.beginPath(); x.moveTo(m.x - 6, m.y - 6); x.lineTo(m.x + 6, m.y + 6); x.moveTo(m.x + 6, m.y - 6); x.lineTo(m.x - 6, m.y + 6); x.stroke();
    }
    if (this.phase === 'deploy') {
      const z = this.deployZone();
      x.fillStyle = 'rgba(192,40,30,0.07)'; x.fillRect(z.x0, 30, z.x1 - z.x0, BH - 60);
      x.strokeStyle = 'rgba(160,30,20,0.6)'; x.lineWidth = 2; x.setLineDash([10, 8]); x.strokeRect(z.x0, 30, z.x1 - z.x0, BH - 60); x.setLineDash([]);
      x.fillStyle = 'rgba(120,25,15,0.7)'; x.font = 'bold 22px Georgia, serif'; x.textAlign = 'center'; x.fillText('Konuşlanma Bölgesi', (z.x0 + z.x1) / 2, 60);
    }
    for (const b of this.blocks) {
      if (b.team !== 0 || !this.sel.has(b.g)) continue;
      const ord = this.gOrd[0][b.g], cc = this.blockCenter(b);
      if (!cc || (ord !== 'move' && ord !== 'advance')) continue;
      const gc = b;
      if (Math.hypot(gc.x - cc[0], gc.y - cc[1]) < 30) continue;
      x.strokeStyle = 'rgba(43,32,24,0.55)'; x.lineWidth = 1.6; x.setLineDash([7, 6]);
      x.beginPath(); x.moveTo(cc[0], cc[1]); x.lineTo(gc.x, gc.y); x.stroke(); x.setLineDash([]);
      const a = Math.atan2(gc.y - cc[1], gc.x - cc[0]);
      x.beginPath(); x.moveTo(gc.x, gc.y); x.lineTo(gc.x - Math.cos(a - 0.4) * 12, gc.y - Math.sin(a - 0.4) * 12); x.moveTo(gc.x, gc.y); x.lineTo(gc.x - Math.cos(a + 0.4) * 12, gc.y - Math.sin(a + 0.4) * 12); x.stroke();
    }
    for (const k of this.corpses) if (inView(k.x, k.y)) this.drawCorpse(x, k);
    const bearers = new Set();
    for (const t of [0, 1]) for (const g of GROUPS) { const b = this.bearer(t, g); if (b) bearers.add(b); }
    const list = this.figs.filter(f => f.alive && !f.escaped && inView(f.x, f.y)).sort((a, b) => a.y - b.y);
    for (const f of list) this.drawFig(x, f, bearers.has(f));
    for (const p of this.proj) this.drawProj(x, p);
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1), py = p.y - p.z * 0.6;
      if (p.kind === 'blood') { x.fillStyle = `rgba(175,15,15,${0.9 * a + 0.1})`; x.beginPath(); x.arc(p.x, py, p.r, 0, 7); x.fill(); }
      else if (p.kind === 'smoke') { x.fillStyle = hexA(p.col, 0.45 * a); x.beginPath(); x.arc(p.x, py, p.r * (2 - a), 0, 7); x.fill(); }
      else if (p.kind === 'flame') { x.fillStyle = `rgba(255,${120 + 100 * a | 0},40,${a})`; x.beginPath(); x.arc(p.x, py, p.r * a + 1, 0, 7); x.fill(); }
      else if (p.kind === 'splash') { x.strokeStyle = `rgba(255,255,255,${a})`; x.lineWidth = 1; x.beginPath(); x.arc(p.x, p.y, 3 + (1 - a) * 6, 0, 7); x.stroke(); }
      else { x.fillStyle = p.col; x.fillRect(p.x - p.r / 2, py - p.r / 2, p.r, p.r); }
    }
    // Ekran ölçeğinde yazılar
    x.setTransform(1, 0, 0, 1, 0, 0);
    const k = this.dpr;
    for (const b of this.bubbles) {
      const f = b.f, [sx, sy] = this.toScreen(f.x, f.y - (f.type === 'cav' ? 52 : 38));
      if (sx < -100 || sx > W + 100 || sy < -50 || sy > H + 50) continue;
      x.globalAlpha = clamp(b.life / 0.3, 0, 1);
      x.font = `bold ${(f.isPlayer ? 14 : 11) * k}px Georgia, serif`;
      const w = x.measureText(b.text).width + 12 * k;
      rrect(x, sx - w / 2, sy - 22 * k, w, 18 * k, 8 * k);
      x.fillStyle = '#fbf3df'; x.fill(); x.strokeStyle = INK; x.lineWidth = 1.3 * k; x.stroke();
      x.beginPath(); x.moveTo(sx - 4 * k, sy - 4 * k); x.lineTo(sx, sy + 3 * k); x.lineTo(sx + 4 * k, sy - 4 * k); x.fill();
      x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.text, sx, sy - 13 * k);
      x.globalAlpha = 1;
    }
    for (const t of this.texts) {
      const [sx, sy] = this.toScreen(t.x, t.y);
      x.globalAlpha = clamp(t.life, 0, 1);
      x.font = `bold ${20 * k}px Georgia, serif`; x.textAlign = 'center';
      x.lineWidth = 4 * k; x.strokeStyle = INK; x.strokeText(t.text, sx, sy);
      x.fillStyle = t.col; x.fillText(t.text, sx, sy);
      x.globalAlpha = 1;
    }
    const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(60,40,20,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.35)');
    x.fillStyle = vg; x.fillRect(0, 0, W, H);
    if (this.cryT[0] > 0) { x.strokeStyle = `rgba(200,40,30,${0.25 + 0.15 * Math.sin(this.t * 10)})`; x.lineWidth = 10 * k; x.strokeRect(0, 0, W, H); }
    this.mmT = (this.mmT || 0) - 1; if (this.mmT <= 0) { this.mmT = 6; this.drawMinimap(); }
  },
  drawMinimap() {
    const m = document.getElementById('mm'); if (!m || !this.mmBase) return;
    const x = m.getContext('2d'), sx = m.width / this.BW, sy = m.height / BH;
    x.drawImage(this.mmBase, 0, 0);
    for (const w of this.walls) { x.fillStyle = w.hp > 0 ? '#6b5a44' : 'rgba(107,90,68,0.3)'; x.fillRect(w.x * sx - 1.5, 0, 3, m.height); }
    const ec = this.enemyColor();
    for (const f of this.figs) {
      if (!f.alive || f.escaped) continue;
      x.fillStyle = f.team === 0 ? Game.S.player.color : ec;
      const s = f.isCmd ? 4 : f.machine ? 3 : 2;
      x.fillRect(f.x * sx - s / 2, f.y * sy - s / 2, s, s);
    }
    const c = this.cam, vw = this.W / c.z, vh = this.H / c.z;
    x.strokeStyle = INK; x.lineWidth = 1.5; x.strokeRect((c.x - vw / 2) * sx, (c.y - vh / 2) * sy, vw * sx, vh * sy);
  },
  drawCastle(x) {
    const kx = this.keepX, ky = this.keepY, defCol = this.teamColor(this.defTeam);
    x.lineJoin = 'round';
    if ((this.special === 'moat' || this.special === 'canal') && this.walls.length) {
      const w0 = this.walls[0].x;
      x.fillStyle = 'rgba(150,180,190,0.65)'; x.fillRect(w0 - 120, 0, 100, BH);
      x.strokeStyle = INK; x.lineWidth = 1.4; x.beginPath(); x.moveTo(w0 - 120, 0); x.lineTo(w0 - 120, BH); x.moveTo(w0 - 20, 0); x.lineTo(w0 - 20, BH); x.stroke();
      x.lineWidth = 0.7; for (let y = 10; y < BH; y += 26) { x.beginPath(); x.moveTo(w0 - 80, y); x.quadraticCurveTo(w0 - 70, y - 3, w0 - 60, y); x.stroke(); }
    }
    const topY = this.cam.y - this.H / this.cam.z / 2 + 30;
    for (const w of this.walls) {
      if (w.hp <= 0) {
        x.fillStyle = w.wood ? '#a07850' : '#bdb19a'; x.strokeStyle = INK; x.lineWidth = 1;
        for (let y = 8; y < BH; y += 14) { x.beginPath(); x.arc(w.x + ((y * 13) % 18) - 9, y, 5 + (y % 3), 0, 7); x.fill(); x.stroke(); }
        continue;
      }
      const hw = 13;
      x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(w.x - hw + 5, 0, hw * 2, BH);
      x.fillStyle = w.wood ? '#b58a5c' : '#ddd0b2'; x.fillRect(w.x - hw, 0, hw * 2, BH);
      x.strokeStyle = INK; x.lineWidth = 1.6; x.strokeRect(w.x - hw, -2, hw * 2, BH + 4);
      x.lineWidth = 0.7; x.strokeStyle = 'rgba(43,32,24,0.55)';
      if (w.wood) for (let y = 0; y < BH; y += 8) { x.beginPath(); x.moveTo(w.x - hw, y); x.lineTo(w.x + hw, y); x.stroke(); }
      else for (let y = 0; y < BH; y += 12) { x.beginPath(); x.moveTo(w.x - hw, y); x.lineTo(w.x + hw, y); x.stroke(); const o = (y / 12) % 2 ? -4 : 5; x.beginPath(); x.moveTo(w.x + o, y); x.lineTo(w.x + o, y + 12); x.stroke(); }
      x.fillStyle = w.wood ? '#b58a5c' : '#ddd0b2'; x.strokeStyle = INK; x.lineWidth = 1;
      for (let y = 4; y < BH; y += 14) { x.fillRect(w.x - hw - 5, y, 5, 8); x.strokeRect(w.x - hw - 5, y, 5, 8); }
      x.fillStyle = '#7a5434'; x.fillRect(w.x - hw, BH / 2 - 22, hw * 2, 44); x.strokeRect(w.x - hw, BH / 2 - 22, hw * 2, 44);
      x.strokeStyle = INK; x.lineWidth = 1.2;
      for (const [cx, cy] of w.crack) { x.beginPath(); x.moveTo(w.x + cx, cy); x.lineTo(w.x + cx + 5, cy + 8); x.lineTo(w.x + cx - 3, cy + 15); x.stroke(); }
      const pct = w.hp / w.maxhp;
      x.fillStyle = 'rgba(43,32,24,0.6)'; x.fillRect(w.x - 26, topY, 52, 6);
      x.fillStyle = pct > 0.5 ? '#7a9b4a' : pct > 0.25 ? '#d0a032' : '#b8382c'; x.fillRect(w.x - 26, topY, 52 * pct, 6);
    }
    for (const tw of this.towers) {
      if (!tw.alive) continue;
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.beginPath(); x.arc(tw.x + 5, tw.y + 5, 20, 0, 7); x.fill();
      x.fillStyle = '#e4d8bc'; x.strokeStyle = INK; x.lineWidth = 1.6; x.beginPath(); x.arc(tw.x, tw.y, 20, 0, 7); x.fill(); x.stroke();
      x.lineWidth = 1; for (let a = 0; a < 6.2; a += 0.7) { x.beginPath(); x.moveTo(tw.x + Math.cos(a) * 16, tw.y + Math.sin(a) * 16); x.lineTo(tw.x + Math.cos(a) * 20, tw.y + Math.sin(a) * 20); x.stroke(); }
      x.fillStyle = defCol; x.beginPath(); x.arc(tw.x, tw.y, 10, 0, 7); x.fill(); x.stroke();
    }
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(kx - 63, ky - 63, 140, 140);
    x.fillStyle = '#e4d8bc'; x.strokeStyle = INK; x.lineWidth = 2; x.fillRect(kx - 70, ky - 70, 140, 140); x.strokeRect(kx - 70, ky - 70, 140, 140);
    x.lineWidth = 0.8; for (let i = -70; i < 70; i += 14) { x.beginPath(); x.moveTo(kx - 70, ky + i); x.lineTo(kx + 70, ky + i); x.stroke(); }
    for (const [ox, oy] of [[-70, -70], [70, -70], [-70, 70], [70, 70]]) { x.fillStyle = '#e4d8bc'; x.lineWidth = 1.6; x.beginPath(); x.arc(kx + ox, ky + oy, 18, 0, 7); x.fill(); x.stroke(); x.fillStyle = defCol; x.beginPath(); x.arc(kx + ox, ky + oy, 9, 0, 7); x.fill(); x.stroke(); }
    const capCol = this.capture > 0 ? this.teamColor(this.attTeam) : defCol;
    x.lineWidth = 2.4; x.beginPath(); x.moveTo(kx, ky + 10); x.lineTo(kx, ky - 60); x.stroke();
    const wv = Math.sin(this.t * 4) * 4;
    x.fillStyle = capCol; x.lineWidth = 1.4; x.beginPath(); x.moveTo(kx, ky - 60); x.quadraticCurveTo(kx + 22, ky - 64 + wv, kx + 44, ky - 56); x.lineTo(kx + 44, ky - 30); x.quadraticCurveTo(kx + 22, ky - 36 + wv, kx, ky - 32); x.closePath(); x.fill(); x.stroke();
  },
  drawProj(x, p) {
    const py = p.y - p.z * 0.6;
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.beginPath(); x.ellipse(p.x, p.y, p.kind === 'arrow' ? 3 : 6, p.kind === 'arrow' ? 1 : 2.5, 0, 0, 7); x.fill();
    if (p.kind === 'arrow') {
      const a = Math.atan2(p.vy - p.vz * 0.6, p.vx);
      x.strokeStyle = INK; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(p.x, py); x.lineTo(p.x - Math.cos(a) * 11, py - Math.sin(a) * 11); x.stroke();
      x.beginPath(); x.moveTo(p.x - Math.cos(a) * 11, py - Math.sin(a) * 11); x.lineTo(p.x - Math.cos(a - 0.4) * 14, py - Math.sin(a - 0.4) * 14); x.stroke();
    } else if (p.kind === 'fire') { x.fillStyle = '#ff7b1c'; x.beginPath(); x.arc(p.x, py, 6, 0, 7); x.fill(); }
    else {
      x.fillStyle = p.kind === 'ball' ? '#2d2d2d' : '#9a8b70'; x.beginPath(); x.arc(p.x, py, p.kind === 'ball' ? 5 : 7, 0, 7); x.fill();
      x.strokeStyle = INK; x.lineWidth = 1.2; x.stroke();
    }
  },

  /* Mürekkep çöp adam */
  drawFig(x, f, bearer) {
    x.save();
    x.translate(f.x, f.y);
    if (!f.machine) { x.fillStyle = 'rgba(43,32,24,0.18)'; x.beginPath(); x.ellipse(0, 0, f.type === 'cav' ? 13 : f.type === 'elephant' ? 18 : 6, 2.4, 0, 0, 7); x.fill(); }
    x.scale(FS, FS);
    if (f.machine) { this.drawMachineShape(x, f); x.restore(); if (f.hp < f.maxhp) this.hpBar(x, f, f.x, f.y - (f.type === 'tower' ? 72 : 22)); return; }
    if (f.onWall != null && this.walls[f.onWall] && this.walls[f.onWall].hp > 0) x.translate(0, -6);
    if (bearer) this.drawFlag(x, f);
    this.drawBody(x, f);
    x.restore();
    if (f.hp < f.maxhp && f.hp > 0) this.hpBar(x, f, f.x, f.y - (f.type === 'cav' ? 46 : 34));
    if (f.isPlayer) { x.fillStyle = '#c0281e'; x.strokeStyle = INK; x.lineWidth = 1; x.beginPath(); x.moveTo(f.x - 4, f.y - 44); x.lineTo(f.x + 4, f.y - 44); x.lineTo(f.x, f.y - 38); x.closePath(); x.fill(); x.stroke(); }
    if (f.type === 'cleric' && f.healing) { x.fillStyle = 'rgba(60,140,60,0.8)'; x.font = 'bold 9px serif'; x.textAlign = 'center'; x.fillText('+', f.x + Math.sin(this.t * 5) * 5, f.y - 38 - (this.t * 12 % 8)); }
    if (f.stun > 0) { x.font = '9px sans-serif'; x.textAlign = 'center'; x.fillText('💫', f.x, f.y - 38); }
  },
  drawFlag(x, f) {
    const wv = Math.sin(this.t * 5 + f.id) * 3;
    x.save();
    x.strokeStyle = INK; x.lineWidth = 2;
    x.beginPath(); x.moveTo(-7, -20); x.lineTo(-7, -84); x.stroke();
    x.fillStyle = f.color; x.lineWidth = 1.3;
    x.beginPath(); x.moveTo(-7, -84); x.quadraticCurveTo(6, -88 + wv, 20, -82); x.lineTo(20, -64); x.quadraticCurveTo(6, -68 + wv, -7, -64); x.closePath(); x.fill(); x.stroke();
    if (f.team === 0) { x.fillStyle = '#fff'; x.font = 'bold 13px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(this.emblem(), 6, -74); }
    x.restore();
  },
  hpBar(x, f, cx, cy) {
    if (this.cam.z < 0.9 * this.dpr && !f.isCmd) return;
    const pct = clamp(f.hp / f.maxhp, 0, 1), w = f.isCmd ? 20 : 12;
    x.fillStyle = 'rgba(43,32,24,0.5)'; x.fillRect(cx - w / 2, cy, w, 2.4);
    x.fillStyle = f.team === 0 ? '#5f8f3a' : '#b8382c'; x.fillRect(cx - w / 2, cy, w * pct, 2.4);
  },
  // Saplanmış ok: (px,py) noktasından geldiği yöne doğru kuyruk
  stuckArrow(x, px, py, s) {
    const ang = s.a, dx = s.tx * Math.cos(ang), dy = -Math.sin(ang);
    x.strokeStyle = INK; x.lineWidth = 1.3;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + dx * 13, py + dy * 13); x.stroke();
    const ex = px + dx * 13, ey = py + dy * 13;
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex + dx * 3 - dy * 3, ey + dy * 3 + dx * 3); x.moveTo(ex, ey); x.lineTo(ex + dx * 3 + dy * 3, ey + dy * 3 - dx * 3); x.stroke();
  },
  drawArrows(x, f, neckY, headY, which) {
    if (!f.stuck || !f.stuck.length) return;
    for (const s of f.stuck) {
      if (s.h && which !== 'body') this.stuckArrow(x, 2 + s.o * 3, headY - 1 + s.o * 2, s);
      if (!s.h && which !== 'head') this.stuckArrow(x, 0.6, neckY + 6 + (s.o + 1) * 5, s);
    }
  },
  drawBody(x, f) {
    const swing = f.atkT > 0 ? Math.sin((0.3 - f.atkT) / 0.3 * Math.PI) : 0;
    const walk = Math.sin(f.ph || 0);
    x.save(); x.scale(f.dir || 1, 1);
    x.lineCap = 'round'; x.lineJoin = 'round';
    let hipY = -20;
    if (f.type === 'cav') { this.drawHorse(x, f); hipY = -34; }
    if (f.type === 'elephant') { this.drawElephant(x, f); x.restore(); return; }
    const cmd = f.isCmd;
    if (cmd) x.scale(1.15, 1.15);
    if (cmd) {
      const cape = f.outfit ? f.outfit.cape : f.color;
      if (cape && cape !== 'none') { x.fillStyle = cape; x.strokeStyle = INK; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-1, hipY - 17); x.quadraticCurveTo(-12 - walk * 2, hipY - 4, -13, hipY + 8); x.lineTo(-4, hipY + 4); x.closePath(); x.fill(); x.stroke(); }
    }
    x.strokeStyle = INK; x.lineWidth = 2.6;
    if (f.type === 'cleric') { x.fillStyle = f.robe; x.beginPath(); x.moveTo(-2, hipY - 16); x.lineTo(-9, 0); x.lineTo(9, 0); x.lineTo(2, hipY - 16); x.closePath(); x.fill(); x.lineWidth = 1.5; x.stroke(); x.lineWidth = 2.6; }
    else if (f.type !== 'cav') { x.beginPath(); x.moveTo(0, hipY); x.lineTo(walk * 7, 0); x.moveTo(0, hipY); x.lineTo(-walk * 7, 0); x.stroke(); }
    else { x.beginPath(); x.moveTo(0, hipY); x.lineTo(5, hipY + 10); x.stroke(); }
    const neckY = hipY - 18;
    this.drawTorso(x, f, hipY, neckY, swing, walk);
    const headY = neckY - 7;
    this.drawHead(x, f, 2, headY);
    this.drawArrows(x, f, neckY, headY);
    x.restore();
  },
  drawTorso(x, f, hipY, neckY, swing, walk) {
    const cmd = f.isCmd;
    x.strokeStyle = INK; x.lineWidth = 2.6;
    x.beginPath(); x.moveTo(0, hipY); x.lineTo(1, neckY); x.stroke();
    x.strokeStyle = cmd && f.outfit ? f.outfit.body : f.color; x.lineWidth = 3.4;
    x.beginPath(); x.moveTo(0.3, hipY - 3); x.lineTo(0.9, neckY + 3); x.stroke();
    const tier = cmd && f.outfit ? ({ yok: 0, deri: 1, kaftan: 1, zincir: 2, plaka: 3 }[f.outfit.armor] || 0) : (f.armorTier || 0);
    if (tier > 0) { x.fillStyle = tier === 1 ? '#8b5e3c' : tier === 2 ? '#a7adb4' : '#d6dde3'; rrect(x, -3, neckY + 2, 8, 11, 2.5); x.fill(); x.strokeStyle = INK; x.lineWidth = 1; x.stroke(); }
    x.strokeStyle = INK; x.lineWidth = 2.4;
    const armA = -0.6 + swing * 2.2;
    const hx = 1 + Math.cos(armA) * 13, hy = neckY + 3 + Math.sin(armA) * 13 + 6;
    x.beginPath(); x.moveTo(1, neckY + 3); x.lineTo(hx, hy); x.stroke();
    x.beginPath(); x.moveTo(1, neckY + 3); x.lineTo(-6, neckY + 13 - walk * 2); x.stroke();
    this.drawWeapon(x, f, hx, hy, armA, swing);
    const sh = cmd && f.outfit ? f.outfit.shield : (f.type === 'spear' || (f.type === 'inf' && f.id % 2) ? 'yuvarlak' : 'yok');
    if (sh !== 'yok' && f.type !== 'archer' && f.type !== 'cleric') {
      x.fillStyle = '#efe2c4'; x.strokeStyle = INK; x.lineWidth = 1.3;
      if (sh === 'kalkan') { rrect(x, -12, neckY + 2, 8, 16, 3); x.fill(); x.stroke(); }
      else { x.beginPath(); x.arc(-7, neckY + 12, 6, 0, 7); x.fill(); x.stroke(); x.fillStyle = f.color; x.beginPath(); x.arc(-7, neckY + 12, 2.2, 0, 7); x.fill(); }
    }
  },
  drawHead(x, f, hx, headY, dead) {
    const cmd = f.isCmd || (f.cmd && true);
    const outfit = f.outfit || (f.cmd && f.cmd.outfit);
    x.fillStyle = f.burnt ? '#555' : '#f6ecd4'; x.strokeStyle = INK; x.lineWidth = 1.8;
    x.beginPath(); x.arc(hx, headY, 6.5, 0, 7); x.fill(); x.stroke();
    if (dead) { x.lineWidth = 1.1; x.beginPath(); x.moveTo(hx + 1, headY - 2); x.lineTo(hx + 4, headY + 1); x.moveTo(hx + 4, headY - 2); x.lineTo(hx + 1, headY + 1); x.stroke(); }
    else { x.fillStyle = INK; x.beginPath(); x.arc(hx + 2.6, headY - 0.5, 1, 0, 7); x.fill(); }
    const beard = cmd && outfit ? outfit.beard : ((f.id || 0) % 3 === 0 ? 'kisa' : 'yok');
    if (beard === 'kisa') { x.fillStyle = INK; x.beginPath(); x.arc(hx + 0.5, headY + 3, 4, 0.1, Math.PI - 0.1); x.fill(); }
    else if (beard === 'uzun') { x.fillStyle = INK; x.beginPath(); x.moveTo(hx - 4, headY + 2); x.quadraticCurveTo(hx, headY + 14, hx + 5, headY + 2); x.fill(); }
    else if (beard === 'biyik') { x.lineWidth = 1.6; x.beginPath(); x.moveTo(hx - 1, headY + 2.5); x.quadraticCurveTo(hx + 3, headY + 1.5, hx + 7, headY + 4.5); x.stroke(); }
    let hat = cmd && outfit ? outfit.helmet : f.type === 'cleric' ? 'cleric' : f.hat;
    hat = HAT_ALIAS[hat] || hat;
    this.drawHelmet(x, hat, hx, headY, f.color, f.isCmd ? f : (f.cmd || f));
  },
  drawHelmet(x, hat, hx, hy, col, f) {
    if (hat === 'tac') {
      x.fillStyle = '#e8b923'; x.strokeStyle = INK; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(hx - 6, hy - 5); x.lineTo(hx - 6, hy - 12); x.lineTo(hx - 3, hy - 8); x.lineTo(hx, hy - 13); x.lineTo(hx + 3, hy - 8); x.lineTo(hx + 6, hy - 12); x.lineTo(hx + 6, hy - 5); x.closePath(); x.fill(); x.stroke();
      return;
    }
    if (hat === 'cleric') { x.fillStyle = f && f.robe ? f.robe : '#fff'; x.strokeStyle = INK; x.lineWidth = 1.2; x.beginPath(); x.ellipse(hx, hy - 6, 7.5, 5, 0, 0, 7); x.fill(); x.stroke(); return; }
    if (HEADGEARS[hat] && hat !== 'yok') { Hats.draw(x, hat, hx, hy, col); return; }
    if (!f || !f.isCmd) { x.fillStyle = col; x.beginPath(); x.arc(hx, hy - 2, 6.6, Math.PI * 1.05, -0.05); x.fill(); }
  },
  drawWeapon(x, f, hx, hy, armA, swing) {
    let w = f.type === 'spear' ? 'mizrak' : f.type === 'archer' ? 'yay' : f.type === 'cleric' ? 'asa' : 'kilic';
    if (f.isCmd && f.outfit) w = f.outfit.weapon;
    x.save(); x.translate(hx, hy);
    if (w === 'yay') {
      x.rotate(-0.1); x.strokeStyle = '#5a3d22'; x.lineWidth = 2;
      x.beginPath(); x.arc(0, 0, 11, -1.3, 1.3); x.stroke();
      x.strokeStyle = INK; x.lineWidth = 0.7; x.beginPath(); x.moveTo(Math.cos(-1.3) * 11, Math.sin(-1.3) * 11); x.lineTo(swing > 0 ? -6 : 0, 0); x.lineTo(Math.cos(1.3) * 11, Math.sin(1.3) * 11); x.stroke();
    } else if (w === 'mizrak') {
      x.rotate(armA * 0.4 - 0.9); x.strokeStyle = INK; x.lineWidth = 1.8;
      x.beginPath(); x.moveTo(-14, 0); x.lineTo(30, 0); x.stroke();
      x.fillStyle = INK; x.beginPath(); x.moveTo(30, -2.5); x.lineTo(37, 0); x.lineTo(30, 2.5); x.closePath(); x.fill();
    } else if (w === 'asa') {
      x.strokeStyle = '#5a3d22'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 14); x.lineTo(0, -22); x.stroke();
    } else {
      x.rotate(armA - 1.2);
      const len = w === 'katana' ? 22 : w === 'pala' ? 17 : 15;
      x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(-3, 0); x.lineTo(3, 0); x.stroke();
      if (w === 'balta') { x.beginPath(); x.moveTo(0, 2); x.lineTo(0, -18); x.stroke(); x.fillStyle = '#c9c9c9'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, -18); x.quadraticCurveTo(10, -16, 8, -8); x.lineTo(0, -11); x.closePath(); x.fill(); x.stroke(); }
      else if (w === 'gurz') { x.beginPath(); x.moveTo(0, 2); x.lineTo(0, -15); x.stroke(); x.fillStyle = '#8a8f96'; x.lineWidth = 1; x.beginPath(); x.arc(0, -18, 4.5, 0, 7); x.fill(); x.stroke(); }
      else { x.lineWidth = 1.8; x.beginPath(); x.moveTo(0, -1); if (w === 'pala') x.quadraticCurveTo(5, -len * 0.6, 1, -len); else x.lineTo(0, -len); x.stroke(); }
      if (swing > 0.3) { x.strokeStyle = 'rgba(43,32,24,0.4)'; x.lineWidth = 1.2; x.beginPath(); x.arc(0, 0, len, -2.2, -0.6); x.stroke(); }
    }
    x.restore();
  },
  drawHorse(x, f) {
    x.strokeStyle = INK; x.lineWidth = 2;
    for (const [lx, ph] of [[-11, 0], [-6, 2], [9, 1], [14, 3]]) { const s = Math.sin(f.ph + ph) * 5; x.beginPath(); x.moveTo(lx, -16); x.lineTo(lx + s, 0); x.stroke(); }
    x.fillStyle = '#c8b28c'; x.lineWidth = 1.6;
    x.beginPath(); x.ellipse(1, -21, 17, 7, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(14, -24); x.lineTo(21, -36); x.lineTo(28, -33); x.lineTo(23, -24); x.closePath(); x.fill(); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.moveTo(-16, -22); x.quadraticCurveTo(-22, -18, -20, -10); x.stroke();
    x.fillStyle = f.color; x.fillRect(-6, -28, 12, 4);
  },
  drawElephant(x, f) {
    x.strokeStyle = INK; x.lineWidth = 2; x.fillStyle = '#bdb6a8';
    for (const lx of [-14, -4, 8, 16]) { x.fillRect(lx - 4, -16, 8, 16); x.strokeRect(lx - 4, -16, 8, 16); }
    x.beginPath(); x.ellipse(0, -30, 26, 17, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.arc(24, -36, 12, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(32, -32); x.quadraticCurveTo(40, -18, 34, -6); x.stroke();
    x.fillStyle = f.color; rrect(x, -12, -55, 20, 9, 3); x.fill(); x.stroke();
  },
  drawMachineShape(x, f) {
    x.save(); x.scale(f.dir || 1, 1);
    x.strokeStyle = INK; x.lineWidth = 1.6; x.lineJoin = 'round';
    if (f.type === 'catapult') {
      x.fillStyle = '#c9a877'; x.fillRect(-22, -10, 44, 7); x.strokeRect(-22, -10, 44, 7);
      for (const wx of [-15, 15]) { x.fillStyle = '#efe2c4'; x.beginPath(); x.arc(wx, -3, 5, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(wx - 5, -3); x.lineTo(wx + 5, -3); x.moveTo(wx, -8); x.lineTo(wx, 2); x.stroke(); }
      x.beginPath(); x.moveTo(-6, -10); x.lineTo(0, -28); x.lineTo(6, -10); x.stroke();
      const a = f.atkT > 0 ? -0.3 + (0.6 - f.atkT) * 2 : -0.9;
      x.save(); x.translate(0, -26); x.rotate(a); x.lineWidth = 3; x.beginPath(); x.moveTo(-26, 0); x.lineTo(12, 0); x.stroke();
      if (f.atkT <= 0) { x.fillStyle = '#9a8b70'; x.lineWidth = 1.2; x.beginPath(); x.arc(-26, -4, 5, 0, 7); x.fill(); x.stroke(); }
      x.restore();
    } else if (f.type === 'cannon') {
      x.fillStyle = '#efe2c4'; x.beginPath(); x.arc(-8, -7, 8, 0, 7); x.fill(); x.stroke();
      const rec = f.atkT > 0 ? -f.atkT * 7 : 0;
      x.fillStyle = '#5b5f63'; rrect(x, -15 + rec, -19, 34, 10, 4); x.fill(); x.stroke();
    } else if (f.type === 'tower') {
      x.fillStyle = '#c9a877'; x.fillRect(-16, -110, 32, 102); x.strokeRect(-16, -110, 32, 102);
      x.lineWidth = 0.8; for (let yy = -100; yy < -10; yy += 14) { x.beginPath(); x.moveTo(-16, yy); x.lineTo(16, yy + 14); x.stroke(); }
      x.lineWidth = 1.6; x.fillStyle = f.color; x.beginPath(); x.moveTo(-19, -110); x.lineTo(0, -124); x.lineTo(19, -110); x.closePath(); x.fill(); x.stroke();
      for (const wx of [-10, 10]) { x.fillStyle = '#efe2c4'; x.beginPath(); x.arc(wx, -5, 6, 0, 7); x.fill(); x.stroke(); }
    }
    x.restore();
  },
  drawCorpse(x, c) {
    x.save(); x.translate(c.x, c.y - c.z * 0.6);
    if (c.part === 'wreck') {
      x.rotate(c.rot); x.strokeStyle = INK; x.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(-14 + i * 6, -4 + (i % 2) * 6); x.lineTo(-6 + i * 6, 4 - (i % 2) * 5); x.stroke(); }
      x.restore(); return;
    }
    x.rotate(c.rot); x.scale(FS * (c.dir || 1), FS);
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = INK; x.lineWidth = 2.4;
    const p = c.part;
    if ((c.type === 'cav' || c.type === 'elephant') && p !== 'head' && p !== 'upper' && p !== 'torso') {
      x.fillStyle = c.type === 'cav' ? '#c8b28c' : '#bdb6a8'; x.lineWidth = 1.6;
      x.beginPath(); x.ellipse(0, -8, c.type === 'cav' ? 17 : 26, 7, 0, 0, 7); x.fill(); x.stroke();
      x.lineWidth = 2; for (const lx of [-10, -4, 8, 13]) { x.beginPath(); x.moveTo(lx, -3); x.lineTo(lx + 3, 6); x.stroke(); }
      x.lineWidth = 2.4;
    }
    if (p === 'head') {
      this.drawHead(x, c, 0, 0, true);
      this.drawArrows(x, c, 0, 0, 'head');
      x.restore(); return;
    }
    if (p === 'whole' || p === 'headless' || p === 'lower') {
      x.strokeStyle = INK; x.lineWidth = 2.6;
      x.beginPath(); x.moveTo(0, -20); x.lineTo(5, 0); x.moveTo(0, -20); x.lineTo(-5, 0); x.stroke();
      if (p === 'lower') { x.lineWidth = 2.6; x.beginPath(); x.moveTo(0, -20); x.lineTo(0, -24); x.stroke(); x.lineWidth = 1; x.beginPath(); x.moveTo(-3, -25); x.lineTo(-1, -23); x.lineTo(1, -26); x.lineTo(3, -24); x.stroke(); }
    }
    if (p === 'whole' || p === 'headless' || p === 'upper' || p === 'torso') {
      if (p === 'upper' || p === 'torso') x.translate(0, 18);
      this.drawTorso(x, c, -20, -38, 0, 0.3);
      if (p === 'upper' || p === 'torso') { x.strokeStyle = INK; x.lineWidth = 1; x.beginPath(); x.moveTo(-3, -19); x.lineTo(-1, -21); x.lineTo(1, -18); x.lineTo(3, -20); x.stroke(); }
      if (p === 'whole' || p === 'upper') this.drawHead(x, c, 2, -45, true);
      else { x.strokeStyle = INK; x.lineWidth = 2.6; x.beginPath(); x.moveTo(1, -38); x.lineTo(1.4, -41); x.stroke(); x.lineWidth = 1; x.beginPath(); x.moveTo(-1.5, -42); x.lineTo(0.5, -40.5); x.lineTo(2.5, -42.5); x.lineTo(4, -41); x.stroke(); }
      this.drawArrows(x, c, -38, -45, (p === 'headless' || p === 'torso') ? 'body' : undefined);
    }
    x.restore();
  }
};
