/* ==========================================================
   FETİH — Savaş sahnesi (madde 17, 18, 21, 32, 34, 35, 37, 38)
   Oyuncu çöp adam komutanı joystick ile yönetir,
   ordusuna Hücum / Mevzi / Bana Uy / Ricat emri verir.
   ========================================================== */
'use strict';

const VH = 540, GY0 = 360, GY1 = 505, GRAV = 620;

const Battle = {
  active: false, cv: null, ctx: null, W: 0, H: 0, dpr: 1, sc: 1,
  input: { jx: 0, jy: 0, attack: false },

  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    window.addEventListener('resize', () => { if (this.active) this.resize(); });
    this.bindControls();
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth * this.dpr; this.H = this.cv.clientHeight * this.dpr;
    this.cv.width = this.W; this.cv.height = this.H;
    this.sc = this.H / VH;
  },

  /* ================== KURULUM ================== */
  start(cfg, onEnd) {
    this.cfg = cfg; this.onEnd = onEnd;
    this.active = true; this.over = false; this.result = null;
    this.resize();
    const S = Game.S;
    this.gore = S.player.settings.gore;
    this.t = 0; this.figs = []; this.proj = []; this.parts = []; this.decals = []; this.corpses = []; this.bubbles = []; this.texts = [];
    this.kills = 0; this.ballsUsed = 0; this.capture = 0; this.retreatT = -1; this.cryT = [0, 0]; this.cryCd = 0;
    this.siege = cfg.kind === 'siege';
    this.BW = this.siege ? 2300 : 1900;
    this.teamSide = cfg.playerSide === 'att' ? ['att', 'def'] : ['def', 'att'];
    this.attTeam = this.teamSide[0] === 'att' ? 0 : 1;
    this.defTeam = 1 - this.attTeam;
    this.order = [cfg.ambush && cfg.playerSide === 'att' ? 'charge' : 'hold', 'hold'];
    const D = cfg.defense || { walls: [], towers: 0, special: 'none' };
    this.special = this.siege ? D.special : 'none';
    // Surlar
    this.walls = [];
    if (this.siege) D.walls.forEach((hp, i) => this.walls.push({ x: 1400 + i * 115, hp, maxhp: hp, bridged: false, wood: D.wood, crack: [] }));
    this.keepX = this.BW - 230;
    this.towers = [];
    if (this.siege) {
      for (let i = 0; i < D.towers; i++) {
        const w = this.walls[i % this.walls.length];
        const bound = i < this.walls.length * 2 ? this.walls.indexOf(w) : -1;
        const tx = bound >= 0 ? w.x + (i >= this.walls.length ? 26 : -4) : this.keepX - 60 - i * 40;
        this.towers.push({ x: tx, y: GY0 + 8 + (i % 3) * 6, z: 165, cd: rand(0.5, 2), wall: bound, alive: true });
      }
    }
    this.specialT = 2;
    // Birlikleri yerleştir
    const att = cfg.att, def = cfg.def;
    const sideTot = s => Game.count(s.units) + (s.allies || []).reduce((n, a) => n + Game.count(a.units), 0);
    this.R = Math.max(1, Math.ceil(Math.max(sideTot(att), sideTot(def)) / 75));
    this.initial = {}; // takım+tip -> figür sayısı
    this.spawnSide(this.teamOf('att'), att, 'att');
    this.spawnSide(this.teamOf('def'), def, 'def');
    // Komutanlar
    const p = S.player;
    if (!p.wounded) this.player = this.spawnCommander(0, true);
    else { this.player = null; toast('🩹 Komutan yaralı: savaşı uzaktan yönetiyorsun.', 'bad'); }
    const enemyOwner = this.teamSide[1] === 'att' ? cfg.att.owner : cfg.def.owner;
    if (S.nations[enemyOwner]) this.enemyCmd = this.spawnCommander(1, false);
    this.camX = this.player ? this.player.x - this.viewW() / 2 : (this.teamSide[0] === 'att' ? 0 : this.BW - this.viewW());
    if (cfg.ambush) {
      const amb = cfg.playerSide === 'att' ? 1 : 0;
      for (const f of this.figs) if (f.team === amb) f.stun = 2.5;
      this.say(this.player || this.figs.find(f => f.team === 0), 'Pusu! Saldırın!', 2);
    }
    this.cry = p.customCry || p.cry;
    this.updateHud(true);
    SFX.horn();
  },
  viewW() { return this.W / this.sc; },
  colorOf(owner) {
    // Takımlar kolay ayırt edilsin: düşman rengi oyuncu rengine çok yakınsa değiştir
    const c = Game.ownerColor(owner);
    if (owner === P || !this.cfg) return c;
    const enemyOwner = this.teamSide[1] === 'att' ? this.cfg.att.owner : this.cfg.def.owner;
    if (owner !== enemyOwner) return c;
    const rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const a = rgb(Game.S.player.color), b = rgb(c);
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 150) return c;
    const alts = ['#2f5d9e', '#2e8b57', '#6a4c93', '#3d3d3d', '#d4ac0d'];
    return alts.map(x => [x, Math.hypot(...rgb(x).map((v, i) => v - a[i]))]).sort((p, q) => q[1] - p[1])[0][0];
  },
  enemyColor() { return this.colorOf(this.teamSide[1] === 'att' ? this.cfg.att.owner : this.cfg.def.owner); },
  teamOf(side) { return this.teamSide[0] === side ? 0 : 1; },

  spawnSide(team, side, role) {
    const isAtt = role === 'att';
    const owner = side.owner;
    const color = this.colorOf(owner);
    const armor = owner === P ? Game.S.player.armor : null;
    const hg = owner === P ? HEADGEARS[Game.S.player.headgear] : null;
    const special = this.special;
    const add = (units, col, ally, label) => {
      for (const k of UNIT_KEYS) {
        let n = units[k] || 0; if (n <= 0) continue;
        let figs = Math.max(1, Math.round(n / this.R));
        if (!isAtt && this.siege && k === 'archer' && (special === 'archers')) figs = Math.round(figs * 1.6);
        if (!isAtt && this.siege && k === 'cav' && (special === 'sortie' || special === 'horsearch')) figs = Math.round(figs * 1.4);
        const key = team + ':' + k + (ally ? ':' + ally : '');
        this.initial[key] = (this.initial[key] || 0) + figs;
        for (let i = 0; i < figs; i++) this.figs.push(this.makeFig(team, k, isAtt, col, armor && !ally ? armor[k] : 0, ally ? null : hg, ally, i, figs));
      }
    };
    add(side.units, color, null);
    for (const al of side.allies || []) add(al.units, this.colorOf(al.owner), al.owner, al.label);
    // Kuşatma makineleri
    const sg = side.siege || {};
    for (const k of ['catapult', 'cannon', 'tower']) {
      const n = Math.min(4, sg[k] || 0);
      for (let i = 0; i < n; i++) this.figs.push(this.makeMachine(team, k, isAtt, color, i));
      if (n) this.initial[team + ':' + k] = n;
    }
    this.balls = isAtt ? (sg.balls || 0) : this.balls;
    if (team === 0 && isAtt) this.myBalls = sg.balls || 0;
    // Din adamı (madde 33)
    if (owner === P) this.figs.push(this.makeCleric(team, isAtt));
    else if (Game.S.nations[owner] && Math.random() < 0.7) this.figs.push(this.makeCleric(team, isAtt, Game.S.nations[owner].religion));
    // Savunma özel birlikleri
    if (!isAtt && this.siege && special === 'elephants') for (let i = 0; i < 3; i++) this.figs.push(this.makeFig(team, 'elephant', false, color, 0, null, null, i, 3));
  },

  laneY(i, n) { return GY0 + 14 + ((i * 37) % 100) / 100 * (GY1 - GY0 - 24) + rand(-4, 4); },

  makeFig(team, type, isAtt, color, armorTier, hg, ally, i, n) {
    const U = type === 'elephant' ? { hp: 650, dmg: 38, range: 38, cd: 1.6, speed: 42 } : UNITS[type];
    const am = ARMOR_TIERS[armorTier || 0].mult * (1 + (hg ? hg.hp : 0));
    const f = {
      id: uid(), team, type, color, ally, alive: true,
      hp: U.hp * am, maxhp: U.hp * am, dmg: U.dmg * (1 + (hg ? hg.dmg : 0)), range: U.range, cd: U.cd, cdT: rand(0, U.cd),
      speed: U.speed * 1.55 * (1 + (hg ? hg.spd : 0)) * rand(0.92, 1.08), dir: isAtt ? 1 : -1, ph: rand(0, 6), atkT: 0, stun: 0,
      armorTier: armorTier || 0, hg: hg ? Object.keys(HEADGEARS).find(k => HEADGEARS[k] === hg) : (ally ? null : 'enemy'), slow: 1
    };
    if (Game.S.player.religion === 'tengri' && type === 'cav' && team === 0) f.speed *= 1.15;
    if (Game.S.player.religion === 'pagan' && type === 'inf' && team === 0) f.dmg *= 1.1;
    const row = { inf: 0, spear: 1, archer: 3, cav: 4, elephant: 0 }[type];
    if (isAtt) {
      if (this.cfg.ambush && this.cfg.playerSide === 'def') f.x = rand(500, 1100);
      else f.x = (this.cfg.ambush && team === 0 ? 900 : 620) - row * 70 + rand(-30, 30);
      f.x = Math.max(40, f.x);
    } else if (this.siege) {
      const inner = this.walls.length ? this.walls[this.walls.length - 1].x : 1800;
      if (type === 'archer') {
        const w = this.walls[i % this.walls.length];
        f.x = w.x + rand(4, 14); f.onWall = this.walls.indexOf(w);
      } else if ((type === 'cav' && (this.special === 'sortie' || this.special === 'horsearch')) || type === 'elephant') {
        f.x = this.walls[0].x - rand(60, 200); f.sortie = true;
      } else f.x = rand(inner + 40, this.keepX + 60);
    } else {
      if (this.cfg.ambush && this.cfg.playerSide === 'att') f.x = rand(1100, 1600);
      else f.x = this.BW - 620 + row * 70 + rand(-30, 30);
    }
    f.y = this.laneY(i + row * 7, n);
    if (this.cfg.ambush && ((this.cfg.playerSide === 'att' && team === 1) || (this.cfg.playerSide === 'def' && team === 0))) f.y = rand(GY0 + 10, GY1 - 10);
    f.hx = f.x; f.hy = f.y;
    if (!isAtt && this.siege && (this.special === 'samurai') && (type === 'inf' || type === 'spear')) f.dmg *= 1.4;
    if (!isAtt && this.siege && this.special === 'shieldwall' && (type === 'inf' || type === 'spear')) f.dmgTaken = 0.6;
    return f;
  },
  makeMachine(team, type, isAtt, color, i) {
    const hp = { catapult: 320, cannon: 380, tower: 1100 }[type];
    const x = isAtt ? (type === 'tower' ? 380 + i * 40 : 140 + i * 55) : this.BW - 140 - i * 55;
    return { id: uid(), team, type, machine: true, color, alive: true, hp, maxhp: hp, x, y: GY0 + 30 + i * 28, dir: isAtt ? 1 : -1, cdT: rand(1, 3), cd: type === 'cannon' ? 4.5 : 5.5, speed: type === 'tower' ? 32 : 0, dmg: 0, range: type === 'cannon' ? 1300 : 1000, atkT: 0, ph: 0, stun: 0, slow: 1 };
  },
  makeCleric(team, isAtt, rel) {
    rel = rel || Game.S.player.religion;
    const R = RELIGIONS[rel] || RELIGIONS.islam;
    const mb = team === 0 ? 1 + Game.bonus(Game.sett(Game.S.player.capital) || {}, 'morale') : 1;
    return {
      id: uid(), team, type: 'cleric', cleric: R.cleric, robe: R.robe, color: team === 0 ? Game.S.player.color : this.enemyColor(),
      alive: true, hp: 90, maxhp: 90, x: isAtt ? 260 : this.BW - 260, y: (GY0 + GY1) / 2, dir: isAtt ? 1 : -1,
      heal: 7 * mb * (rel === 'hristiyan' ? 1.25 : 1), speed: 75, dmg: 0, range: 0, cd: 1, cdT: 0, ph: 0, atkT: 0, stun: 0, slow: 1
    };
  },
  spawnCommander(team, isPlayer) {
    const S = Game.S, o = S.player.outfit;
    let hp = 650, dmg = 48, reach = 30;
    if (isPlayer) {
      for (const cat of ['helmet', 'armor', 'shield']) { const it = OUTFIT[cat].find(x => x.id === o[cat]); if (it && it.hp) hp += it.hp; }
      const w = OUTFIT.weapon.find(x => x.id === o.weapon); if (w) { dmg += w.dmg || 0; reach += w.reach || 0; }
    }
    const isAtt = this.teamSide[team] === 'att';
    const f = {
      id: uid(), team, type: 'cmd', isCmd: true, isPlayer, alive: true, color: isPlayer ? S.player.color : (team === 0 ? S.player.color : this.enemyColor()), preview: false,
      hp, maxhp: hp, dmg, range: reach, cd: 0.5, cdT: 0, speed: 150, dir: isAtt ? 1 : -1, ph: 0, atkT: 0, stun: 0, slow: 1,
      x: isAtt ? (this.cfg.ambush && team === 0 ? 860 : 700) : (this.siege ? (this.walls.length ? this.walls[this.walls.length - 1].x + 60 : this.BW - 400) : this.BW - 700),
      y: (GY0 + GY1) / 2, outfit: isPlayer ? o : null
    };
    f.hx = f.x; f.hy = f.y;
    this.figs.push(f);
    return f;
  },

  /* ================== KONTROLLER ================== */
  bindControls() {
    const joy = document.getElementById('joy'), knob = document.getElementById('joy-knob');
    let jid = null, cx = 0, cy = 0;
    const R = 50;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    joy.addEventListener('pointerdown', e => {
      jid = e.pointerId; joy.setPointerCapture(jid);
      const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    const move = e => {
      if (e.pointerId !== jid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      this.input.jx = dx / R; this.input.jy = dy / R; setKnob(dx, dy);
    };
    joy.addEventListener('pointermove', move);
    const end = e => { if (e.pointerId !== jid) return; jid = null; this.input.jx = 0; this.input.jy = 0; setKnob(0, 0); };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    const atk = document.getElementById('b-atk');
    atk.addEventListener('pointerdown', e => { e.preventDefault(); this.input.attack = true; });
    const atkUp = () => { this.input.attack = false; };
    atk.addEventListener('pointerup', atkUp); atk.addEventListener('pointerleave', atkUp); atk.addEventListener('pointercancel', atkUp);
    document.getElementById('b-charge').onclick = () => this.setOrder('charge');
    document.getElementById('b-hold').onclick = () => this.setOrder('hold');
    document.getElementById('b-follow').onclick = () => this.setOrder('follow');
    document.getElementById('b-cry').onclick = () => this.warCry(0);
    document.getElementById('b-retreat').onclick = () => this.retreat();
    // Klavye (masaüstü testleri için)
    const keys = {};
    window.addEventListener('keydown', e => {
      if (!this.active) return;
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ') this.input.attack = true;
      if (e.key === '1') this.setOrder('charge'); if (e.key === '2') this.setOrder('hold'); if (e.key === '3') this.setOrder('follow');
      if (e.key.toLowerCase() === 'n') this.warCry(0); if (e.key.toLowerCase() === 'r') this.retreat();
      upd();
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.key === ' ') this.input.attack = false; upd(); });
    const upd = () => {
      if (jid != null) return;
      this.input.jx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      this.input.jy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    };
    // Komutan yoksa kamerayı sürükle
    let drag = null;
    this.cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, cam: this.camX }; });
    this.cv.addEventListener('pointermove', e => { if (drag && !this.player) this.camX = drag.cam - (e.clientX - drag.x) * this.dpr / this.sc; });
    this.cv.addEventListener('pointerup', () => drag = null);
  },

  setOrder(o) {
    if (this.retreatT >= 0 || this.over) return;
    this.order[0] = o;
    const txt = { charge: 'Hücuuum!', hold: 'Mevzini koru!', follow: 'Bana uyun!' }[o];
    this.say(this.player || this.figs.find(f => f.team === 0 && f.alive), txt, 1.6);
    if (o === 'charge') SFX.horn();
    document.querySelectorAll('#battle-ui .ord').forEach(b => b.classList.toggle('on', b.dataset.o === o));
  },

  warCry(team) {
    // Nida / tekbir (madde 35, 37)
    if (team === 0) {
      if (this.cryCd > 0 || this.over) return;
      this.cryCd = 18;
      const txt = this.cry;
      Voice.speak(txt, { pitch: 0.7, rate: 1 });
      const mine = this.figs.filter(f => f.team === 0 && f.alive && !f.machine);
      for (let i = 0; i < Math.min(12, mine.length); i++) this.say(pick(mine), txt, 2.2);
      if (this.player) this.say(this.player, txt, 2.5);
      const rel = Game.S.player.religion;
      this.cryT[0] = 8 * (rel === 'islam' ? 1.2 : 1);
      SFX.drum(); setTimeout(() => SFX.drum(), 250); setTimeout(() => SFX.drum(), 500);
    } else {
      this.cryT[1] = 7;
      const owner = this.teamSide[1] === 'att' ? this.cfg.att.owner : this.cfg.def.owner;
      const n = Game.S.nations[owner];
      const txt = n ? pick(RELIGIONS[n.religion].cries) : 'Aaaaa!';
      const en = this.figs.filter(f => f.team === 1 && f.alive && !f.machine);
      for (let i = 0; i < Math.min(8, en.length); i++) this.say(pick(en), txt, 2);
    }
  },

  retreat() {
    // "Ricat! Ricat!" (madde 32)
    if (this.retreatT >= 0 || this.over) return;
    this.retreatT = 0; this.order[0] = 'flee';
    Voice.speak('Ricat! Ricat!', { pitch: 0.6, rate: 1.1 });
    const who = this.player || this.figs.find(f => f.team === 0 && f.alive);
    this.say(who, 'RİCAT! RİCAT!', 3.5);
    const mine = this.figs.filter(f => f.team === 0 && f.alive && !f.machine);
    for (let i = 0; i < Math.min(5, mine.length); i++) this.say(pick(mine), 'Ricat!', 2);
    SFX.horn();
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
    if (this.over) { this.updateFx(dt); return; }
    this.t += dt;
    if (this.cryCd > 0) this.cryCd -= dt;
    for (let i = 0; i < 2; i++) if (this.cryT[i] > 0) this.cryT[i] -= dt;
    // Yapay zekâ emirleri
    if (this.t > 2.2 && this.order[1] === 'hold') {
      if (!this.siege || this.teamSide[1] === 'att') this.order[1] = 'charge';
    }
    if (this.t > 4 && this.cryT[1] <= 0 && Math.random() < dt * 0.04) this.warCry(1);
    // Hedef seçimi (seyrek)
    this.retarget -= dt;
    const doRetarget = !(this.retarget > 0);
    if (doRetarget) this.retarget = 0.3;
    const alive = this.figs.filter(f => f.alive && !f.escaped);
    const byTeam = [alive.filter(f => f.team === 0), alive.filter(f => f.team === 1)];
    for (const f of alive) {
      if (doRetarget || !f.target || !f.target.alive) f.target = this.nearestEnemy(f, byTeam[1 - f.team]);
      this.updateFig(f, dt, byTeam);
    }
    // Ayrışma (üst üste binmesinler)
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]; if (a.machine) continue;
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j]; if (b.machine) continue;
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.6;
        if (Math.abs(dx) > 14 || Math.abs(dy) > 14) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < 12) { const push = (12 - d) * 0.25; a.x -= dx / d * push; b.x += dx / d * push; a.y -= dy / d * push * 0.4; b.y += dy / d * push * 0.4; }
      }
    }
    for (const f of alive) { f.y = clamp(f.y, GY0 + 6, GY1 - 4); f.x = clamp(f.x, -80, this.BW + 80); this.wallClamp(f); }
    this.updateTowers(dt, byTeam);
    this.updateSpecial(dt, byTeam);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    // Kamera
    const vw = this.viewW();
    if (this.player && this.player.alive) this.camX = lerp(this.camX, this.player.x - vw * 0.45, Math.min(1, dt * 4));
    this.camX = clamp(this.camX, -60, this.BW - vw + 60);
    this.checkEnd(byTeam, dt);
    this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.updateHud(); this.hudT = 0.2; }
  },

  nearestEnemy(f, enemies) {
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (e.escaped) continue;
      if (e.onWall != null && f.range < 60 && this.walls[e.onWall] && this.walls[e.onWall].hp > 0) continue; // surdaki okçuya yakın dövüşçü ulaşamaz
      const d = Math.abs(e.x - f.x) + Math.abs(e.y - f.y) * 1.5;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  sideOf(f) { return this.teamSide[f.team]; },

  blockingWall(f) {
    // Saldıran için önündeki sağlam sur; savunan için önündeki sur
    if (!this.walls.length) return null;
    if (this.sideOf(f) === 'att') {
      for (const w of this.walls) if (w.hp > 0 && !w.bridged && w.x > f.x - 4) return w;
    } else {
      let r = null;
      for (const w of this.walls) if (w.hp > 0 && w.x < f.x) r = w;
      return r;
    }
    return null;
  },
  wallClamp(f) {
    if (f.machine || !this.walls.length) return;
    if (f.onWall != null) {
      const w = this.walls[f.onWall];
      if (w && w.hp > 0) { f.x = clamp(f.x, w.x + 2, w.x + 16); return; }
      f.onWall = null; this.damage(f, 25, null, false); // sur yıkıldı, okçu düştü
      return;
    }
    const w = this.blockingWall(f);
    if (!w) return;
    if (this.sideOf(f) === 'att') { if (f.x > w.x - 14) f.x = w.x - 14; }
    else if (!f.sortie && !f.isCmd) { if (f.x < w.x + 16) f.x = w.x + 16; }
  },

  updateFig(f, dt, byTeam) {
    if (f.stun > 0) { f.stun -= dt; return; }
    if (f.atkT > 0) f.atkT -= dt;
    f.cdT -= dt;
    const myOrder = this.order[f.team];
    const boost = this.cryT[f.team] > 0 ? 1.3 : 1;
    let sp = f.speed * boost * (f.slow || 1);
    f.slow = 1;
    // Ortam etkileri
    if (this.siege && this.sideOf(f) === 'att' && this.walls.length) {
      const w0 = this.walls[0];
      if ((this.special === 'moat' || this.special === 'canal') && f.x > w0.x - 130 && f.x < w0.x) sp *= 0.45;
      if (this.special === 'cold' || this.special === 'heat') { sp *= 0.82; if (!f.machine) f.hp -= 0.5 * dt; }
    }
    if (f.machine) return this.updateMachine(f, dt, byTeam);
    if (f.type === 'cleric') return this.updateCleric(f, dt, byTeam);
    if (f.isPlayer) return this.updatePlayer(f, dt, byTeam, sp);
    if (myOrder === 'flee' && f.team === 0 || (f.team === 1 && this.order[1] === 'flee')) {
      const dir = this.sideOf(f) === 'att' ? -1 : 1;
      f.dir = dir; f.x += dir * sp * 1.15 * dt; f.ph += dt * sp * 0.12;
      if (f.x < -40 || f.x > this.BW + 40) f.escaped = true;
      return;
    }
    const t = f.target;
    let goal = null;
    if (t) {
      const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy * 1.3);
      const ranged = f.type === 'archer';
      const reach = ranged ? f.range : f.range + (t.machine ? 18 : 0);
      if (ranged && d < 28) { // yakın dövüşte zayıf vuruş
        if (f.cdT <= 0) { f.cdT = 1.1; f.atkT = 0.25; f.dir = Math.sign(dx) || f.dir; this.damage(t, 5 * boost, f, false); }
        return;
      }
      if (d <= reach) {
        f.dir = Math.sign(dx) || f.dir;
        if (f.cdT <= 0) {
          f.cdT = f.cd * rand(0.85, 1.15);
          if (ranged) this.shootArrow(f, t, f.dmg * boost);
          else this.melee(f, t, boost);
        }
        return;
      }
      // Hareket kararı
      if (myOrder === 'charge') goal = [t.x, t.y];
      else if (myOrder === 'follow' && f.team === 0 && this.player && this.player.alive) {
        if (d < 90) goal = [t.x, t.y];
        else goal = [this.player.x + (f.hx - 600) * 0.15 - this.player.dir * 40, this.player.y + (f.hy - (GY0 + GY1) / 2) * 0.6];
      } else { // hold
        const homeD = Math.hypot(t.x - f.hx, t.y - f.hy);
        if (homeD < (this.siege && this.sideOf(f) === 'def' ? 260 : 160) && !ranged) goal = [t.x, t.y];
        else if (Math.hypot(f.x - f.hx, f.y - f.hy) > 8) goal = [f.hx, f.hy];
      }
    } else if (myOrder === 'follow' && f.team === 0 && this.player) goal = [this.player.x - this.player.dir * 40 + (f.hx % 60), this.player.y];
    else if (myOrder === 'charge') goal = [this.sideOf(f) === 'att' ? this.keepX : 0, f.y];
    // Kale ele geçirme: saldıranlar sancağa yürür
    if (this.siege && this.sideOf(f) === 'att' && (!t || Math.abs(t.x - f.x) > 400) && myOrder === 'charge') goal = [this.keepX, (GY0 + GY1) / 2 + (f.hy % 40) - 20];
    // Sur önündeyse ve hedef surun arkasındaysa sura vur
    if (this.sideOf(f) === 'att' && goal && f.type !== 'archer') {
      const w = this.blockingWall(f);
      if (w && goal[0] > w.x && f.x >= w.x - 18) {
        f.dir = 1;
        if (f.cdT <= 0) { f.cdT = f.cd; f.atkT = 0.3; this.hitWall(w, f.dmg * (w.wood ? 0.3 : 0.12) * boost, f.x + 8, f.y - 20); }
        return;
      }
    }
    if (goal) {
      const dx = goal[0] - f.x, dy = goal[1] - f.y, d = Math.hypot(dx, dy);
      if (d > 2) {
        f.x += dx / d * sp * dt; f.y += dy / d * sp * dt * 0.7;
        f.dir = Math.sign(dx) || f.dir; f.ph += dt * sp * 0.12;
      }
    }
  },

  updatePlayer(f, dt, byTeam, sp) {
    const { jx, jy } = this.input;
    const mag = Math.hypot(jx, jy);
    if (this.retreatT >= 0) {
      const dir = this.sideOf(f) === 'att' ? -1 : 1;
      f.dir = dir; f.x += dir * sp * 1.2 * dt; f.ph += dt * sp * 0.12;
      if (f.x < -40 || f.x > this.BW + 40) f.escaped = true;
      return;
    }
    if (mag > 0.15) {
      f.x += jx * sp * dt; f.y += jy * sp * dt * 0.7;
      if (Math.abs(jx) > 0.1) f.dir = Math.sign(jx);
      f.ph += dt * sp * 0.12 * mag;
    }
    // Saldırı: düğmeye basınca geniş savuruş, aksi halde yakındakine otomatik vuruş
    if (f.cdT <= 0) {
      const enemies = byTeam[1 - f.team];
      const inReach = enemies.filter(e => !e.escaped && Math.abs(e.x - f.x) < f.range + (e.machine ? 25 : 8) && Math.abs(e.y - f.y) < 22 && (e.onWall == null || !(this.walls[e.onWall] && this.walls[e.onWall].hp > 0)));
      if (this.input.attack) {
        f.cdT = f.cd; f.atkT = 0.3;
        const front = inReach.filter(e => Math.sign(e.x - f.x) === f.dir || Math.abs(e.x - f.x) < 8);
        for (const e of front.slice(0, 3)) this.damage(e, f.dmg * (this.cryT[0] > 0 ? 1.3 : 1), f, true);
        if (front.length) SFX.clash(); else SFX.click();
        const w = this.blockingWall(f);
        if (!front.length && w && this.sideOf(f) === 'att' && f.x > w.x - 30) this.hitWall(w, f.dmg * 0.8, f.x + 10, f.y - 25);
      } else if (inReach.length && mag < 0.15) {
        const e = inReach.sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0];
        f.dir = Math.sign(e.x - f.x) || f.dir;
        f.cdT = f.cd * 1.3; f.atkT = 0.3;
        this.damage(e, f.dmg * 0.8, f, true); SFX.clash();
      }
    }
  },

  updateCleric(f, dt, byTeam) {
    const mine = byTeam[f.team].filter(x => !x.machine && x !== f);
    if (!mine.length) return;
    let cx = 0, cy = 0; for (const m of mine) { cx += m.x; cy += m.y; } cx /= mine.length; cy /= mine.length;
    const back = this.sideOf(f) === 'att' ? -70 : 70;
    const gx = cx + back, gy = cy;
    const d = Math.hypot(gx - f.x, gy - f.y);
    if (d > 6 && !(this.walls.length && this.sideOf(f) === 'att' && this.blockingWall(f) && gx > this.blockingWall(f).x)) { f.x += (gx - f.x) / d * f.speed * dt; f.y += (gy - f.y) / d * f.speed * dt * 0.6; f.ph += dt * 5; f.dir = Math.sign(gx - f.x) || f.dir; }
    f.healing = false;
    for (const m of mine) if (m.hp < m.maxhp && Math.abs(m.x - f.x) < 100 && Math.abs(m.y - f.y) < 60) { m.hp = Math.min(m.maxhp, m.hp + f.heal * dt); f.healing = true; }
  },

  updateMachine(f, dt, byTeam) {
    if (f.type === 'tower') {
      const w = this.walls.find(w => w.hp > 0 && !w.bridged);
      if (!w || this.sideOf(f) !== 'att') return;
      if (f.x < w.x - 34) { f.x += f.speed * dt; f.ph += dt; }
      else { w.bridged = true; f.docked = true; this.texts.push({ x: w.x, y: GY0 - 150, text: 'Kule yanaştı! Surlara!', life: 2.5, col: '#fff' }); }
      return;
    }
    f.cdT -= dt;
    if (f.atkT > 0) f.atkT -= dt;
    if (f.cdT > 0) return;
    if (f.type === 'cannon' && f.team === 0 && this.sideOf(f) === 'att') {
      if (this.myBalls <= 0) { if (!f.warned) { f.warned = true; this.texts.push({ x: f.x, y: f.y - 70, text: 'Gülle bitti!', life: 2, col: '#ffdd57' }); } return; }
    }
    f.cdT = f.cd * rand(0.9, 1.15); f.atkT = 0.6;
    const isAtt = this.sideOf(f) === 'att';
    const w = isAtt ? this.walls.find(w => w.hp > 0) : null;
    let tx, ty, wall = null;
    if (w && Math.abs(w.x - f.x) < f.range) { tx = w.x - 4; ty = rand(GY0 + 10, GY1 - 10); wall = w; }
    else {
      const en = byTeam[1 - f.team].filter(e => Math.abs(e.x - f.x) < f.range && !e.escaped);
      if (!en.length) return;
      const e = pick(en); tx = e.x; ty = e.y;
    }
    if (f.type === 'cannon') { this.ballsUsed++; if (f.team === 0) this.myBalls--; SFX.boom(); this.puff(f.x + f.dir * 30, f.y - 22, '#ddd', 10); }
    else SFX.arrow();
    const kind = f.type === 'cannon' ? 'ball' : 'rock';
    this.launch(f.x + f.dir * 20, f.y, f.type === 'cannon' ? 25 : 55, tx, ty, kind, f.team, kind === 'ball' ? 60 : 45, wall, kind === 'ball' ? 0.9 : 1.8, kind === 'ball' ? 290 : 160);
  },

  melee(f, t, boost) {
    f.atkT = 0.3;
    let dmg = f.dmg * boost * rand(0.85, 1.15);
    if (f.type === 'spear' && (t.type === 'cav' || t.type === 'elephant')) dmg *= 2.5;
    if (f.type === 'cav' && f.charge !== false) { dmg *= 1.25; }
    if (f.type === 'elephant') { for (const e of this.figs) if (e.alive && e.team !== f.team && Math.abs(e.x - t.x) < 30 && Math.abs(e.y - t.y) < 20 && e !== t) this.damage(e, dmg * 0.5, f, true); }
    if (t.machine) dmg *= 1.5;
    this.damage(t, dmg, f, f.type === 'inf' || f.type === 'cav' || f.type === 'elephant');
    SFX.clash();
  },

  shootArrow(f, t, dmg) {
    f.atkT = 0.35;
    const lead = t.machine ? 0 : rand(-12, 12);
    this.launch(f.x + f.dir * 8, f.y, f.onWall != null ? 120 : 34, t.x + lead, t.y + rand(-5, 5), 'arrow', f.team, dmg, null, null, f.onWall != null ? 0 : undefined);
    SFX.arrow();
  },

  launch(x, y, z, tx, ty, kind, team, dmg, wall, T, extraZ) {
    const d = Math.hypot(tx - x, ty - y);
    T = T || clamp(d / 430, 0.3, 1.5);
    const tz = kind === 'arrow' ? 22 : 10;
    const vz = (tz - z + 0.5 * GRAV * T * T) / T;
    this.proj.push({ x, y, z, vx: (tx - x) / T, vy: (ty - y) / T, vz, t: 0, T, kind, team, dmg, wall, tx, ty });
    if (this.proj.length > 400) this.proj.shift();
  },

  updateProjectiles(dt) {
    for (const p of this.proj) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= GRAV * dt;
      if (p.kind === 'fire' && Math.random() < 0.6) this.parts.push({ x: p.x, y: p.y, z: p.z, vx: rand(-20, 20), vy: 0, vz: rand(10, 40), life: 0.5, max: 0.5, kind: 'flame', r: rand(2, 4) });
      if (p.t >= p.T) {
        p.dead = true;
        if (p.wall && p.wall.hp > 0) {
          this.hitWall(p.wall, p.kind === 'ball' ? 260 : 120, p.wall.x - 10, GY0 - rand(20, 120));
          SFX.crumble();
          continue;
        }
        if (p.kind === 'arrow') {
          let hit = null, hd = 15;
          for (const f of this.figs) {
            if (!f.alive || f.team === p.team || f.escaped) continue;
            const d = Math.hypot(f.x - p.x, (f.y - p.y) * 1.2);
            if (d < hd + (f.machine ? 18 : 0)) { hd = d; hit = f; }
          }
          if (hit) {
            let dmg = p.dmg;
            if (hit.onWall != null && this.walls[hit.onWall] && this.walls[hit.onWall].hp > 0) dmg *= 0.5;
            if (hit.machine) dmg *= 0.35;
            this.damage(hit, dmg, null, false); SFX.hit();
            if (hit.alive && !hit.machine) { hit.arrows = (hit.arrows || 0) + 1; }
          } else if (this.decals.length < 500) this.decals.push({ kind: 'arrow', x: p.x, y: p.y, a: Math.atan2(p.vz * -1, p.vx) });
        } else {
          // Taş, gülle, kaya, ateş: alan hasarı
          const R = p.kind === 'ball' ? 34 : p.kind === 'fire' ? 55 : 38;
          for (const f of this.figs) {
            if (!f.alive || f.team === p.team || f.escaped) continue;
            const d = Math.hypot(f.x - p.x, (f.y - p.y) * 1.4);
            if (d < R) this.damage(f, p.dmg * (1 - d / R * 0.5) * (f.machine ? 2 : 1), null, true, p.kind === 'fire');
          }
          this.puff(p.x, p.y, p.kind === 'fire' ? '#ff9a2e' : '#b8a387', p.kind === 'fire' ? 18 : 12);
          if (p.kind === 'fire') { SFX.boom(); for (let i = 0; i < 10; i++) this.parts.push({ x: p.x + rand(-30, 30), y: p.y + rand(-10, 10), z: 0, vx: 0, vy: 0, vz: rand(20, 60), life: rand(1, 2), max: 2, kind: 'flame', r: rand(3, 6) }); }
          else SFX.boom();
          if (p.kind === 'ball' && this.decals.length < 500) this.decals.push({ kind: 'crater', x: p.x, y: p.y });
        }
      }
    }
    this.proj = this.proj.filter(p => !p.dead);
  },

  updateTowers(dt, byTeam) {
    if (!this.towers.length) return;
    const atk = byTeam[this.attTeam];
    const cross = this.special === 'crossbow';
    for (const tw of this.towers) {
      if (!tw.alive) continue;
      if (tw.wall >= 0 && this.walls[tw.wall].hp <= 0) { tw.alive = false; this.puff(tw.x, GY0 - 100, '#aaa', 20); continue; }
      tw.cd -= dt;
      if (tw.cd > 0) continue;
      const tgts = atk.filter(f => f.x < tw.x && tw.x - f.x < 520 && !f.escaped);
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
      // Afyon Kalesi: surlardan kaya yuvarlanır
      this.specialT = rand(2, 3);
      const near = atk.filter(f => f.x > w0.x - 160 && f.x < w0.x);
      if (near.length) { const t = pick(near); this.launch(w0.x + 4, t.y, 150, t.x, t.y, 'rock', this.defTeam, 60, null, 0.8); this.texts.push({ x: w0.x, y: GY0 - 140, text: 'Kaya!', life: 1, col: '#ffe08a' }); }
    } else if (this.special === 'greekfire') {
      this.specialT = rand(3, 4.5);
      const near = atk.filter(f => f.x > w0.x - 460 && f.x < w0.x);
      if (near.length) { const t = pick(near); this.launch(w0.x + 4, t.y, 140, t.x, t.y, 'fire', this.defTeam, 42, null, 1.1); this.texts.push({ x: w0.x, y: GY0 - 150, text: 'Rum ateşi!', life: 1.2, col: '#ffb14a' }); }
    } else this.specialT = 5;
  },

  /* ================== HASAR, ÖLÜM, KAN ================== */
  hitWall(w, dmg, x, y) {
    if (w.hp <= 0) return;
    w.hp -= dmg;
    for (let i = 0; i < 4; i++) this.parts.push({ x, y: GY0 + rand(0, 30), z: GY0 - y, vx: rand(-80, 30), vy: rand(-10, 10), vz: rand(40, 160), life: 1.2, max: 1.2, kind: 'debris', r: rand(2, 4), col: w.wood ? '#8b5e3c' : '#9e9482' });
    if (Math.random() < 0.25) w.crack.push([rand(-14, 14), rand(-140, -10)]);
    if (w.hp <= 0) {
      w.hp = 0;
      SFX.crumble(); SFX.boom();
      this.texts.push({ x: w.x, y: GY0 - 160, text: 'SUR YIKILDI!', life: 3, col: '#ffdd57' });
      for (let i = 0; i < 40; i++) this.parts.push({ x: w.x + rand(-20, 20), y: rand(GY0, GY1), z: rand(0, 150), vx: rand(-120, 120), vy: rand(-20, 20), vz: rand(50, 250), life: 2, max: 2, kind: 'debris', r: rand(3, 7), col: w.wood ? '#8b5e3c' : '#9e9482' });
      this.puff(w.x, (GY0 + GY1) / 2, '#cbbfa8', 40);
      for (const tw of this.towers) if (this.walls[tw.wall] === w) tw.alive = false;
    }
  },

  damage(f, dmg, src, heavy, fire) {
    if (!f.alive || f.escaped) return;
    if (f.dmgTaken) dmg *= f.dmgTaken;
    if (f.isCmd && !f.isPlayer) dmg *= 0.6;
    f.hp -= dmg;
    if (!f.machine) {
      const n = this.gore ? (heavy ? 6 : 3) : 0;
      for (let i = 0; i < n; i++) this.blood(f.x, f.y, 30, src ? Math.sign(f.x - src.x) : rand(-1, 1));
    }
    if (f.hp <= 0) this.kill(f, src, heavy, fire);
  },

  blood(x, y, z, dir, big) {
    if (this.parts.length > 700) return;
    this.parts.push({ x: x + rand(-3, 3), y, z: z + rand(-6, 6), vx: dir * rand(20, 120) + rand(-30, 30), vy: rand(-15, 15), vz: rand(30, big ? 220 : 140), life: 1.5, max: 1.5, kind: 'blood', r: rand(1.4, big ? 3.6 : 2.6) });
  },

  kill(f, src, heavy, fire) {
    f.alive = false; f.hp = 0;
    if (f.team !== 0 && !f.machine) this.kills++;
    if (f.isPlayer) { this.say(f, 'Ahh... yaralandım!', 3); Voice.speak('Yaralandım!', { pitch: 0.6 }); }
    if (f.machine) { this.puff(f.x, f.y - 20, '#8b6a4a', 30); SFX.crumble(); return; }
    const dir = src ? Math.sign(f.x - src.x) || 1 : rand(-1, 1) > 0 ? 1 : -1;
    // İkiye bölünme (madde 18)
    if (this.gore && heavy && f.type !== 'elephant' && f.type !== 'cav' && Math.random() < 0.55) {
      const base = { color: f.color, hg: f.hg, type: f.type, cmd: f.isCmd ? f : null, life: 999 };
      this.corpses.push(Object.assign({ part: 'upper', x: f.x, y: f.y, z: 26, vx: dir * rand(60, 170), vy: rand(-10, 10), vz: rand(120, 260), rot: 0, vr: dir * rand(4, 10), dir: f.dir, bleed: 1.2 }, base));
      this.corpses.push(Object.assign({ part: 'lower', x: f.x, y: f.y, z: 0, vx: dir * rand(10, 40), vy: 0, vz: rand(20, 60), rot: 0, vr: dir * rand(1, 3), dir: f.dir, bleed: 0.8 }, base));
      for (let i = 0; i < 22; i++) this.blood(f.x, f.y, 26, dir, true);
      this.decals.push({ kind: 'pool', x: f.x, y: f.y, r: rand(10, 18), grow: 0 });
    } else {
      this.corpses.push({ part: 'whole', x: f.x, y: f.y, z: 0, vx: dir * rand(10, 50), vy: 0, vz: rand(30, 80), rot: 0, vr: 0, target: dir * Math.PI / 2, dir: f.dir, color: f.color, hg: f.hg, type: f.type, cmd: f.isCmd ? f : null, burnt: fire, bleed: this.gore ? 0.6 : 0 });
      if (this.gore) { for (let i = 0; i < 10; i++) this.blood(f.x, f.y, 24, dir); this.decals.push({ kind: 'pool', x: f.x + dir * 12, y: f.y, r: rand(6, 12), grow: 0 }); }
    }
    if (this.corpses.length > 260) this.corpses.shift();
  },

  puff(x, y, col, n) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rand(-10, 10), y: y + rand(-5, 5), z: rand(0, 20), vx: rand(-40, 40), vy: rand(-10, 10), vz: rand(10, 60), life: rand(0.6, 1.4), max: 1.4, kind: 'smoke', r: rand(5, 12), col });
  },

  updateFx(dt) {
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'smoke' || p.kind === 'flame') { p.z += p.vz * dt; p.vx *= 0.96; continue; }
      p.z += p.vz * dt; p.vz -= GRAV * dt;
      if (p.z <= 0) {
        p.z = 0; p.vx = 0; p.vy = 0; p.vz = 0;
        if (p.kind === 'blood') { if (this.decals.length < 600 && Math.random() < 0.6) this.decals.push({ kind: 'drop', x: p.x, y: p.y, r: p.r * rand(0.8, 1.4) }); p.life = 0; }
      }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const c of this.corpses) {
      if (c.z > 0 || c.vz > 0) {
        c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.vz -= GRAV * dt; c.rot += c.vr * dt;
        if (c.bleed > 0 && Math.random() < 0.7) this.blood(c.x, c.y, c.z + 10, 0);
        if (c.z <= 0) { c.z = 0; c.vz = 0; c.vx = 0; c.vy = 0; c.vr = 0; if (c.part === 'upper') c.rot = Math.round(c.rot / Math.PI) * Math.PI + (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) * 0.9; }
      } else if (c.part === 'whole' && c.target != null && Math.abs(c.rot - c.target) > 0.05) c.rot += (c.target - c.rot) * Math.min(1, dt * 8);
      if (c.bleed > 0) { c.bleed -= dt; if (this.gore && Math.random() < dt * 8) this.blood(c.x, c.y, 4, rand(-1, 1)); }
    }
    for (const d of this.decals) if (d.kind === 'pool' && d.grow < 1) d.grow = Math.min(1, d.grow + dt * 0.5);
    for (const b of this.bubbles) b.life -= dt;
    this.bubbles = this.bubbles.filter(b => b.life > 0 && b.f);
    for (const t of this.texts) { t.life -= dt; t.y -= dt * 18; }
    this.texts = this.texts.filter(t => t.life > 0);
  },

  /* ================== BİTİŞ ================== */
  checkEnd(byTeam, dt) {
    const fighting = team => byTeam[team].filter(f => !f.machine && f.type !== 'cleric' && !f.escaped).length;
    const mine = fighting(0), theirs = fighting(1);
    if (this.player && !this.player.alive) return this.finish(false, true);
    if (this.retreatT >= 0) {
      this.retreatT += dt;
      if (this.retreatT > 3.5 || mine === 0) return this.finish(false, false, true);
      return;
    }
    const attAlive = this.attTeam === 0 ? mine : theirs;
    const defAlive = this.defTeam === 0 ? mine : theirs;
    if (attAlive === 0) return this.finish(this.defTeam === 0);
    if (defAlive === 0) return this.finish(this.attTeam === 0);
    // Sancak / kale ele geçirme
    if (this.siege) {
      const attIn = byTeam[this.attTeam].some(f => !f.machine && Math.abs(f.x - this.keepX) < 70);
      const defNear = byTeam[this.defTeam].some(f => !f.machine && f.type !== 'cleric' && Math.abs(f.x - this.keepX) < 150 && f.onWall == null);
      if (attIn && !defNear) { this.capture += dt; if (this.capture >= 5) return this.finish(this.attTeam === 0); }
      else this.capture = Math.max(0, this.capture - dt * 0.5);
    }
    const limit = this.siege ? 300 : 240;
    if (this.t > limit) {
      if (this.siege) return this.finish(this.defTeam === 0);
      const pw = team => byTeam[team].reduce((s, f) => s + f.hp, 0);
      return this.finish(pw(0) > pw(1));
    }
  },

  finish(playerWon, wounded, retreated) {
    if (this.over) return;
    this.over = true;
    const cfg = this.cfg;
    const remainOf = (team, side) => {
      const units = {}, siege = {};
      for (const k of UNIT_KEYS) {
        const init = this.initial[team + ':' + k] || 0;
        if (!init) { units[k] = 0; continue; }
        const alive = this.figs.filter(f => f.team === team && f.type === k && !f.ally && (f.alive || f.escaped)).length;
        let r = alive / init;
        if (retreated && team === 0) r = Math.min(1, r * 0.95);
        units[k] = Math.round((side.units[k] || 0) * clamp(r, 0, 1));
      }
      for (const k of ['catapult', 'tower', 'cannon']) siege[k] = Math.max(0, (side.siege && side.siege[k] || 0) - this.figs.filter(f => f.team === team && f.type === k && !f.alive).length);
      return { units, siege };
    };
    const attTeam = this.teamOf('att'), defTeam = this.teamOf('def');
    const aliveAlly = this.figs.filter(f => f.team === 0 && f.ally && (f.alive || f.escaped)).length;
    const initAlly = Object.keys(this.initial).filter(k => k.startsWith('0:') && k.split(':').length === 3).reduce((s, k) => s + this.initial[k], 0);
    const playerSide = cfg.playerSide;
    const winner = playerWon ? playerSide : (playerSide === 'att' ? 'def' : 'att');
    this.result = {
      winner, attRemain: remainOf(attTeam, cfg.att), defRemain: remainOf(defTeam, cfg.def),
      playerWounded: !!wounded, retreated: !!retreated, kills: Math.round(this.kills * this.R),
      ballsUsed: this.ballsUsed, allyRatio: initAlly ? aliveAlly / initAlly : null
    };
    const myLoss = this.figs.filter(f => f.team === 0 && !f.alive && !f.machine && !f.isCmd).length * this.R;
    setTimeout(() => {
      if (playerWon) { SFX.horn(); Voice.speak(Game.S.player.religion === 'islam' ? 'Zafer bizimdir! Elhamdülillah!' : 'Zafer bizimdir!', { pitch: 0.8 }); }
      UI.battleOver(playerWon, wounded, retreated, this.result.kills, myLoss, () => {
        this.active = false;
        const res = this.result; this.result = null;
        this.onEnd(res);
      });
    }, wounded ? 1600 : 900);
  },

  updateHud(first) {
    const fighting = team => this.figs.filter(f => f.team === team && f.alive && !f.machine && f.type !== 'cleric' && !f.escaped).length;
    const el = document.getElementById('bh');
    if (!el) return;
    const m = fighting(0), t = fighting(1);
    const wall = this.walls.length ? this.walls.map(w => `<span class="wb"><i style="width:${Math.max(0, w.hp / w.maxhp * 100)}%"></i></span>`).join('') : '';
    const lim = this.siege ? 300 : 240;
    const left = Math.max(0, Math.ceil(lim - this.t));
    el.innerHTML = `
      <div class="bh-side" style="--c:${Game.S.player.color}">🙂 ${esc(Game.S.player.name)} <b>${fmt(m * this.R)}</b>${this.player ? ` <span class="hpb"><i style="width:${Math.max(0, this.player.hp / this.player.maxhp * 100)}%"></i></span>` : ''}</div>
      <div class="bh-mid"><b>${esc(this.cfg.title)}</b><br>⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}
        ${wall ? '<div class="walls">🧱 ' + wall + '</div>' : ''}
        ${this.siege && this.capture > 0 ? `<div class="cap">🚩 Ele geçiriliyor %${Math.round(this.capture / 5 * 100)}</div>` : ''}
        ${this.myBalls != null && this.figs.some(f => f.type === 'cannon' && f.team === 0) ? `<div>⚫ Gülle: ${this.myBalls}</div>` : ''}
      </div>
      <div class="bh-side en" style="--c:${this.enemyColor()}"><b>${fmt(t * this.R)}</b> ${esc(Game.ownerName(this.teamSide[1] === 'att' ? this.cfg.att.owner : this.cfg.def.owner))}</div>`;
    const cb = document.getElementById('b-cry');
    if (cb) { cb.classList.toggle('cool', this.cryCd > 0); cb.dataset.cd = this.cryCd > 0 ? Math.ceil(this.cryCd) : ''; }
    if (first) document.querySelectorAll('#battle-ui .ord').forEach(b => b.classList.toggle('on', b.dataset.o === this.order[0]));
    const ratio = document.getElementById('b-ratio');
    if (ratio) ratio.textContent = this.R > 1 ? `Her figür ≈ ${this.R} asker` : '';
  },

  /* ================== ÇİZİM ================== */
  draw() {
    if (!this.active) return;
    const x = this.ctx, W = this.W, H = this.H, s = this.sc, vw = this.viewW();
    x.setTransform(1, 0, 0, 1, 0, 0);
    // Gökyüzü
    const sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#8fd0f2'); sky.addColorStop(0.55, '#d8efff'); sky.addColorStop(0.7, '#f7f0d8');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    x.setTransform(s, 0, 0, s, 0, 0);
    // Güneş
    x.fillStyle = 'rgba(255,240,170,0.9)'; x.beginPath(); x.arc(vw * 0.82, 70, 34, 0, 7); x.fill();
    // Bulutlar (paralaks)
    x.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 7; i++) {
      const cx = ((i * 420 - this.camX * 0.15 + this.t * 6) % (vw + 400) + vw + 400) % (vw + 400) - 200, cy = 50 + (i * 47) % 110;
      x.beginPath(); x.arc(cx, cy, 22, 0, 7); x.arc(cx + 24, cy - 10, 26, 0, 7); x.arc(cx + 52, cy, 20, 0, 7); x.fill();
    }
    // Tepeler
    const hills = (par, col, base, amp, f) => {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, VH);
      for (let i = 0; i <= vw + 20; i += 20) { const wx = i + this.camX * par; x.lineTo(i, base - Math.sin(wx * f) * amp - Math.sin(wx * f * 2.7) * amp * 0.4); }
      x.lineTo(vw, VH); x.fill();
    };
    hills(0.2, '#b9dca0', GY0 - 70, 40, 0.004);
    hills(0.45, '#9fcf7f', GY0 - 25, 22, 0.007);
    // Zemin
    x.save(); x.translate(-this.camX, 0);
    const g = x.createLinearGradient(0, GY0 - 10, 0, VH);
    g.addColorStop(0, '#8cc663'); g.addColorStop(1, '#6ea84a');
    x.fillStyle = g; x.fillRect(this.camX - 10, GY0 - 10, vw + 20, VH - GY0 + 10);
    x.strokeStyle = 'rgba(60,110,40,0.45)'; x.lineWidth = 1.5;
    for (let i = Math.floor(this.camX / 40) * 40; i < this.camX + vw + 40; i += 40) {
      const yy = GY0 + ((i * 7919) % 140);
      x.beginPath(); x.moveTo(i, yy); x.lineTo(i - 3, yy - 6); x.moveTo(i, yy); x.lineTo(i + 3, yy - 7); x.stroke();
    }
    // Hendek
    if (this.siege && (this.special === 'moat' || this.special === 'canal') && this.walls.length) {
      const w0 = this.walls[0].x;
      x.fillStyle = 'rgba(80,160,220,0.75)'; x.fillRect(w0 - 130, GY0 - 4, 110, GY1 - GY0 + 8);
      x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 2;
      for (let yy = GY0 + 10; yy < GY1; yy += 22) { x.beginPath(); x.arc(w0 - 75 + Math.sin(this.t * 2 + yy) * 10, yy, 8, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
    }
    // Lekeler (kan, ok, krater)
    for (const d of this.decals) {
      if (d.x < this.camX - 40 || d.x > this.camX + vw + 40) continue;
      if (d.kind === 'pool') { x.fillStyle = 'rgba(140,10,10,0.75)'; x.beginPath(); x.ellipse(d.x, d.y, d.r * d.grow, d.r * 0.35 * d.grow, 0, 0, 7); x.fill(); }
      else if (d.kind === 'drop') { x.fillStyle = 'rgba(160,15,15,0.8)'; x.beginPath(); x.ellipse(d.x, d.y, d.r, d.r * 0.45, 0, 0, 7); x.fill(); }
      else if (d.kind === 'arrow') { x.strokeStyle = '#5a3d22'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(d.x, d.y); x.lineTo(d.x - Math.cos(d.a) * 9, d.y - 7); x.stroke(); }
      else if (d.kind === 'crater') { x.fillStyle = 'rgba(70,55,35,0.5)'; x.beginPath(); x.ellipse(d.x, d.y, 16, 5, 0, 0, 7); x.fill(); }
    }
    // Kale
    if (this.siege) this.drawCastle(x);
    // Cesetler
    for (const c of this.corpses) if (c.x > this.camX - 60 && c.x < this.camX + vw + 60) this.drawCorpse(x, c);
    // Figürler (derinliğe göre)
    const list = this.figs.filter(f => f.alive && !f.escaped && f.x > this.camX - 80 && f.x < this.camX + vw + 80).sort((a, b) => (a.onWall != null ? -1 : 0) - (b.onWall != null ? -1 : 0) || a.y - b.y);
    for (const f of list) this.drawFig(x, f);
    // Mermiler
    for (const p of this.proj) this.drawProj(x, p);
    // Parçacıklar
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'blood') { x.fillStyle = `rgba(175,10,15,${0.9 * a + 0.1})`; x.beginPath(); x.arc(p.x, p.y - p.z, p.r, 0, 7); x.fill(); }
      else if (p.kind === 'smoke') { x.fillStyle = hexA(p.col.length === 7 ? p.col : '#cccccc', 0.5 * a); x.beginPath(); x.arc(p.x, p.y - p.z, p.r * (2 - a), 0, 7); x.fill(); }
      else if (p.kind === 'flame') { x.fillStyle = `rgba(255,${120 + 100 * a | 0},40,${a})`; x.beginPath(); x.arc(p.x, p.y - p.z, p.r * a + 1, 0, 7); x.fill(); }
      else { x.fillStyle = p.col; x.fillRect(p.x - p.r / 2, p.y - p.z - p.r / 2, p.r, p.r); }
    }
    // Konuşma balonları
    for (const b of this.bubbles) {
      const f = b.f; const fx = f.x, fy = f.y - (f.onWall != null ? 120 : 0) - (f.type === 'cav' ? 80 : 66);
      const a = clamp(b.life / 0.3, 0, 1);
      x.globalAlpha = a;
      x.font = `bold ${f.isPlayer ? 15 : 12}px system-ui,sans-serif`;
      const w = x.measureText(b.text).width + 14;
      rrect(x, fx - w / 2, fy - 22, w, 20, 9);
      x.fillStyle = f.team === 0 ? '#fffbea' : '#ffe9e6'; x.fill(); x.strokeStyle = '#3b2a1c'; x.lineWidth = 1.5; x.stroke();
      x.beginPath(); x.moveTo(fx - 4, fy - 2); x.lineTo(fx, fy + 5); x.lineTo(fx + 4, fy - 2); x.fill();
      x.fillStyle = '#3b2a1c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.text, fx, fy - 12);
      x.globalAlpha = 1;
    }
    for (const t of this.texts) {
      x.globalAlpha = clamp(t.life, 0, 1);
      x.font = 'bold 22px system-ui,sans-serif'; x.textAlign = 'center';
      x.lineWidth = 4; x.strokeStyle = '#3b2a1c'; x.strokeText(t.text, t.x, t.y);
      x.fillStyle = t.col; x.fillText(t.text, t.x, t.y);
      x.globalAlpha = 1;
    }
    // Komutan işaretçisi
    if (this.player && this.player.alive) {
      const p = this.player;
      x.fillStyle = '#ffdd57'; x.strokeStyle = '#3b2a1c'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(p.x - 6, p.y - 80); x.lineTo(p.x + 6, p.y - 80); x.lineTo(p.x, p.y - 72); x.closePath(); x.fill(); x.stroke();
    }
    x.restore();
    // Nida etkisi kenar parıltısı
    if (this.cryT[0] > 0) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.strokeStyle = `rgba(255,215,90,${0.25 + 0.15 * Math.sin(this.t * 10)})`; x.lineWidth = 12 * this.dpr; x.strokeRect(0, 0, W, H);
    }
  },

  drawCastle(x) {
    // Arka kale (sancak)
    const kx = this.keepX, defCol = this.defTeam === 0 ? Game.S.player.color : this.enemyColor();
    x.lineJoin = 'round'; x.strokeStyle = '#3b2a1c'; x.lineWidth = 2;
    x.fillStyle = '#e3d3b0'; x.fillRect(kx - 70, GY0 - 170, 140, 175); x.strokeRect(kx - 70, GY0 - 170, 140, 175);
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(kx + 20, GY0 - 170, 50, 175);
    for (let i = kx - 70; i < kx + 70; i += 18) { x.fillStyle = '#e3d3b0'; x.fillRect(i, GY0 - 184, 11, 14); x.strokeRect(i, GY0 - 184, 11, 14); }
    for (const tx of [kx - 85, kx + 85]) {
      x.fillStyle = '#d9c7a1'; x.fillRect(tx - 18, GY0 - 220, 36, 225); x.strokeRect(tx - 18, GY0 - 220, 36, 225);
      x.fillStyle = defCol; x.beginPath(); x.moveTo(tx - 24, GY0 - 220); x.lineTo(tx, GY0 - 262); x.lineTo(tx + 24, GY0 - 220); x.closePath(); x.fill(); x.stroke();
    }
    x.fillStyle = '#6b4a2b'; x.beginPath(); x.arc(kx, GY0 - 30, 26, Math.PI, 0); x.lineTo(kx + 26, GY0 + 5); x.lineTo(kx - 26, GY0 + 5); x.closePath(); x.fill(); x.stroke();
    // Sancak
    const fy = GY0 - 260, wave = Math.sin(this.t * 4) * 4;
    x.beginPath(); x.moveTo(kx, GY0 - 184); x.lineTo(kx, fy); x.stroke();
    const capCol = this.capture > 0 ? (this.attTeam === 0 ? Game.S.player.color : this.enemyColor()) : defCol;
    x.fillStyle = capCol; x.beginPath(); x.moveTo(kx, fy); x.quadraticCurveTo(kx + 25, fy - 6 + wave, kx + 50, fy + 4); x.lineTo(kx, fy + 26); x.closePath(); x.fill(); x.stroke();
    // Surlar
    for (const w of this.walls) {
      const top = GY0 - 150, h = GY1 - top + 6;
      if (w.hp <= 0) {
        x.fillStyle = w.wood ? '#7a5434' : '#a59a86';
        for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(w.x - 24 + (i * 17) % 48, GY1 - 10 - (i * 13) % 40, 9 + (i % 3) * 3, 0, 7); x.fill(); x.stroke(); }
        continue;
      }
      const c1 = w.wood ? '#a97c50' : '#d8c9a8', c2 = w.wood ? '#8b5e3c' : '#bfae8b';
      x.fillStyle = c1; x.fillRect(w.x - 20, top, 40, h);
      x.fillStyle = c2; x.fillRect(w.x + 6, top, 14, h);
      x.strokeRect(w.x - 20, top, 40, h);
      // Taş deseni
      x.strokeStyle = 'rgba(80,60,40,0.35)'; x.lineWidth = 1;
      if (w.wood) for (let i = w.x - 20; i < w.x + 20; i += 8) { x.beginPath(); x.moveTo(i, top); x.lineTo(i, top + h); x.stroke(); }
      else for (let yy = top + 14; yy < top + h; yy += 16) { x.beginPath(); x.moveTo(w.x - 20, yy); x.lineTo(w.x + 20, yy); x.stroke(); const o = (yy / 16) % 2 ? 0 : 10; x.beginPath(); x.moveTo(w.x - 10 + o, yy - 16); x.lineTo(w.x - 10 + o, yy); x.stroke(); }
      x.strokeStyle = '#3b2a1c'; x.lineWidth = 2;
      for (let i = w.x - 20; i < w.x + 20; i += 12) { x.fillStyle = c1; x.fillRect(i, top - 12, 8, 12); x.strokeRect(i, top - 12, 8, 12); }
      // Çatlaklar
      x.strokeStyle = '#4b3a28'; x.lineWidth = 1.5;
      for (const [cx, cy] of w.crack) { x.beginPath(); x.moveTo(w.x + cx, GY1 + cy); x.lineTo(w.x + cx + 6, GY1 + cy + 10); x.lineTo(w.x + cx - 3, GY1 + cy + 18); x.stroke(); }
      if (w.bridged) { x.fillStyle = '#8b5e3c'; x.fillRect(w.x - 36, top - 6, 22, 6); }
      // Can çubuğu
      const pct = w.hp / w.maxhp;
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(w.x - 26, top - 30, 52, 7);
      x.fillStyle = pct > 0.5 ? '#6fd36f' : pct > 0.25 ? '#ffc94a' : '#ff5a5a'; x.fillRect(w.x - 26, top - 30, 52 * pct, 7);
    }
    // Ok kuleleri
    for (const tw of this.towers) {
      if (!tw.alive) continue;
      const top = GY0 - 190;
      x.fillStyle = '#e8d6b0'; x.fillRect(tw.x - 13, top, 26, 40); x.strokeStyle = '#3b2a1c'; x.lineWidth = 2; x.strokeRect(tw.x - 13, top, 26, 40);
      x.fillStyle = defCol; x.beginPath(); x.moveTo(tw.x - 17, top); x.lineTo(tw.x, top - 24); x.lineTo(tw.x + 17, top); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#3b2a1c'; x.fillRect(tw.x - 3, top + 12, 6, 12);
    }
  },

  drawProj(x, p) {
    const px = p.x, py = p.y - p.z;
    if (p.kind === 'arrow') {
      const a = Math.atan2(-p.vz, p.vx);
      x.strokeStyle = '#4b3a28'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px - Math.cos(a) * 14, py - Math.sin(a) * 14); x.stroke();
      x.fillStyle = '#ddd'; x.beginPath(); x.arc(px, py, 1.4, 0, 7); x.fill();
    } else if (p.kind === 'fire') {
      x.fillStyle = '#ff7b1c'; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill();
      x.fillStyle = '#ffd36e'; x.beginPath(); x.arc(px - 2, py - 2, 3, 0, 7); x.fill();
    } else {
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(p.x, p.y, 7, 2.5, 0, 0, 7); x.fill();
      x.fillStyle = p.kind === 'ball' ? '#2d2d2d' : '#8f8169'; x.beginPath(); x.arc(px, py, p.kind === 'ball' ? 6 : 8, 0, 7); x.fill();
      x.strokeStyle = '#3b2a1c'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.arc(px - 2, py - 2, 2, 0, 7); x.fill();
    }
  },

  /* Çöp adam çizimi */
  drawFig(x, f) {
    let { x: fx, y: fy } = f;
    if (f.onWall != null) fy -= 150 - (fy - GY0) * 0.2;
    x.save();
    x.lineCap = 'round'; x.lineJoin = 'round';
    // Gölge
    if (f.onWall == null) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.ellipse(fx, fy, f.machine ? 30 : f.type === 'cav' ? 22 : f.type === 'elephant' ? 32 : 10, 3.5, 0, 0, 7); x.fill(); }
    if (f.machine) { this.drawMachine(x, f, fx, fy); x.restore(); return; }
    const ink = '#2b2018';
    const swing = f.atkT > 0 ? Math.sin((0.3 - f.atkT) / 0.3 * Math.PI) : 0;
    const walk = Math.sin(f.ph);
    x.translate(fx, fy); x.scale(f.dir, 1);
    let hipY = -20;
    if (f.type === 'cav') { this.drawHorse(x, f, walk); hipY = -34; }
    if (f.type === 'elephant') { this.drawElephant(x, f, walk); x.restore(); this.hpBar(x, f, fx, fy - 75); return; }
    const cmd = f.isCmd, sz = cmd ? 1.18 : 1;
    x.scale(sz, sz);
    x.strokeStyle = ink; x.lineWidth = 2.6;
    // Pelerin
    if (cmd && f.outfit && f.outfit.cape !== 'none') {
      x.fillStyle = f.outfit.cape; x.beginPath(); x.moveTo(-1, hipY - 17); x.quadraticCurveTo(-12 - walk * 2, hipY - 4, -13, hipY + 8); x.lineTo(-4, hipY + 4); x.closePath(); x.fill(); x.lineWidth = 1.4; x.stroke(); x.lineWidth = 2.6;
    } else if (cmd) {
      x.fillStyle = f.color; x.beginPath(); x.moveTo(-1, hipY - 17); x.quadraticCurveTo(-12, hipY - 4, -12, hipY + 8); x.lineTo(-4, hipY + 4); x.closePath(); x.fill();
    }
    // Bacaklar
    if (f.type !== 'cav') {
      if (f.type === 'cleric') {
        x.fillStyle = f.robe; x.beginPath(); x.moveTo(-2, hipY - 16); x.lineTo(-9, 0); x.lineTo(9, 0); x.lineTo(2, hipY - 16); x.closePath(); x.fill(); x.stroke();
      } else {
        x.beginPath(); x.moveTo(0, hipY); x.lineTo(walk * 7, 0); x.moveTo(0, hipY); x.lineTo(-walk * 7, 0); x.stroke();
      }
    } else { x.beginPath(); x.moveTo(0, hipY); x.lineTo(5, hipY + 10); x.stroke(); }
    // Gövde (takım renginde tunik)
    const neckY = hipY - 18;
    const body = cmd && f.outfit ? f.outfit.body : null;
    x.strokeStyle = body || f.color; x.lineWidth = cmd ? 5.5 : 4.6;
    x.beginPath(); x.moveTo(0, hipY); x.lineTo(1, neckY); x.stroke();
    // Zırh
    const tier = cmd && f.outfit ? ({ yok: 0, deri: 1, kaftan: 1, zincir: 2, plaka: 3 }[f.outfit.armor] || 0) : f.armorTier;
    if (tier > 0) {
      x.fillStyle = tier === 1 ? '#8b5e3c' : tier === 2 ? '#a7adb4' : '#d6dde3';
      rrect(x, -3.5, neckY + 1, 9, 13, 3); x.fill(); x.strokeStyle = ink; x.lineWidth = 1.2; x.stroke();
      if (tier === 2) { x.strokeStyle = 'rgba(60,60,60,0.5)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-3, neckY + 4 + i * 3.5); x.lineTo(5, neckY + 4 + i * 3.5); x.stroke(); } }
    }
    x.strokeStyle = ink; x.lineWidth = 2.6;
    // Kollar ve silah
    const armA = -0.6 + swing * 2.2;
    const hx = 1 + Math.cos(armA) * 13, hy = neckY + 3 + Math.sin(armA) * 13 + 6;
    x.beginPath(); x.moveTo(1, neckY + 3); x.lineTo(hx, hy); x.stroke();
    x.beginPath(); x.moveTo(1, neckY + 3); x.lineTo(-6, neckY + 13 - walk * 2); x.stroke();
    this.drawWeapon(x, f, hx, hy, armA, swing);
    // Kalkan
    const sh = cmd && f.outfit ? f.outfit.shield : (f.type === 'spear' || (f.type === 'inf' && f.armorTier > 1) ? 'yuvarlak' : 'yok');
    if (sh !== 'yok' && f.type !== 'archer') {
      x.fillStyle = shade(f.color, -0.15); x.strokeStyle = ink; x.lineWidth = 1.5;
      if (sh === 'kalkan') { rrect(x, -12, neckY + 2, 9, 18, 4); x.fill(); x.stroke(); }
      else { x.beginPath(); x.arc(-7, neckY + 12, 6.5, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#ffd36e'; x.beginPath(); x.arc(-7, neckY + 12, 1.8, 0, 7); x.fill(); }
    }
    // Baş
    const headY = neckY - 7;
    x.fillStyle = '#fff6e6'; x.strokeStyle = ink; x.lineWidth = 2;
    x.beginPath(); x.arc(2, headY, 6.5, 0, 7); x.fill(); x.stroke();
    x.fillStyle = ink; x.beginPath(); x.arc(4.6, headY - 1, 1.1, 0, 7); x.fill();
    // Sakal
    const beard = cmd && f.outfit ? f.outfit.beard : (f.id % 3 === 0 ? 'kisa' : 'yok');
    if (beard !== 'yok') {
      x.fillStyle = '#3b2a1c';
      if (beard === 'kisa') { x.beginPath(); x.arc(2.5, headY + 3, 4.2, 0.1, Math.PI - 0.1); x.fill(); }
      else if (beard === 'uzun') { x.beginPath(); x.moveTo(-2, headY + 2); x.quadraticCurveTo(2, headY + 14, 7, headY + 2); x.fill(); }
      else if (beard === 'biyik') { x.lineWidth = 1.8; x.strokeStyle = '#3b2a1c'; x.beginPath(); x.moveTo(1, headY + 2.5); x.quadraticCurveTo(5, headY + 1.5, 9, headY + 4.5); x.stroke(); }
    }
    // Başlık
    const hg = cmd && f.outfit ? f.outfit.helmet : (f.type === 'cleric' ? 'cleric' : f.hg);
    this.drawHelmet(x, hg, 2, headY, f.color, f);
    x.restore();
    if (!f.preview && (f.type !== 'cleric' || f.hp < f.maxhp)) if (f.hp < f.maxhp || cmd) this.hpBar(x, f, fx, fy - (f.type === 'cav' ? 82 : 66) * (cmd ? 1.12 : 1));
    if (f.type === 'cleric' && f.healing) { x.fillStyle = 'rgba(120,255,140,0.6)'; x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.fillText('+', fx + Math.sin(this.t * 5) * 8, fy - 72 - (this.t * 20 % 12)); }
    if (f.arrows && f.arrows < 5) { x.strokeStyle = '#4b3a28'; x.lineWidth = 1.2; for (let i = 0; i < f.arrows; i++) { x.beginPath(); x.moveTo(fx - 2 + i * 2, fy - 30 + i * 3); x.lineTo(fx - 9 + i * 2, fy - 38 + i * 3); x.stroke(); } }
    if (f.stun > 0) { x.font = '14px sans-serif'; x.textAlign = 'center'; x.fillText('💫', fx, fy - 70); }
  },

  hpBar(x, f, cx, cy) {
    const pct = clamp(f.hp / f.maxhp, 0, 1);
    const w = f.isCmd ? 34 : 20;
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(cx - w / 2, cy, w, 4);
    x.fillStyle = f.team === 0 ? '#6fd36f' : '#ff6b5a'; x.fillRect(cx - w / 2, cy, w * pct, 4);
  },

  drawWeapon(x, f, hx, hy, armA, swing) {
    const ink = '#2b2018';
    let w = f.type === 'spear' ? 'mizrak' : f.type === 'archer' ? 'yay' : f.type === 'cav' ? 'kilic' : f.type === 'cleric' ? 'asa' : 'kilic';
    if (f.isCmd && f.outfit) w = f.outfit.weapon;
    x.save(); x.translate(hx, hy);
    if (w === 'yay') {
      x.rotate(-0.1); x.strokeStyle = '#6b4a2b'; x.lineWidth = 2.2;
      x.beginPath(); x.arc(0, 0, 11, -1.3, 1.3); x.stroke();
      x.strokeStyle = '#ddd'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(Math.cos(-1.3) * 11, Math.sin(-1.3) * 11); x.lineTo(swing > 0 ? -6 : 0, 0); x.lineTo(Math.cos(1.3) * 11, Math.sin(1.3) * 11); x.stroke();
    } else if (w === 'mizrak') {
      x.rotate(armA * 0.4 - 0.15); x.strokeStyle = '#6b4a2b'; x.lineWidth = 2.2;
      x.beginPath(); x.moveTo(-14, 0); x.lineTo(26, 0); x.stroke();
      x.fillStyle = '#cfd6dc'; x.strokeStyle = ink; x.lineWidth = 1; x.beginPath(); x.moveTo(26, -3); x.lineTo(34, 0); x.lineTo(26, 3); x.closePath(); x.fill(); x.stroke();
    } else if (w === 'asa') {
      x.strokeStyle = '#8b5e3c'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, 14); x.lineTo(0, -22); x.stroke();
      x.fillStyle = '#ffd36e'; x.beginPath(); x.arc(0, -23, 3, 0, 7); x.fill();
    } else {
      x.rotate(armA - 1.2);
      const len = w === 'katana' ? 22 : w === 'pala' ? 17 : 15;
      x.strokeStyle = ink; x.lineWidth = 2.2; x.beginPath(); x.moveTo(-3, 0); x.lineTo(3, 0); x.stroke();
      if (w === 'balta') {
        x.strokeStyle = '#6b4a2b'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, 2); x.lineTo(0, -18); x.stroke();
        x.fillStyle = '#cfd6dc'; x.strokeStyle = ink; x.lineWidth = 1; x.beginPath(); x.moveTo(0, -18); x.quadraticCurveTo(10, -16, 8, -8); x.lineTo(0, -11); x.closePath(); x.fill(); x.stroke();
      } else if (w === 'gurz') {
        x.strokeStyle = '#6b4a2b'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, 2); x.lineTo(0, -15); x.stroke();
        x.fillStyle = '#8a8f96'; x.strokeStyle = ink; x.lineWidth = 1; x.beginPath(); x.arc(0, -18, 4.5, 0, 7); x.fill(); x.stroke();
      } else {
        x.strokeStyle = '#d9e1e8'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(0, -1);
        if (w === 'pala') x.quadraticCurveTo(4, -len * 0.6, 1, -len); else x.lineTo(0, -len);
        x.stroke(); x.strokeStyle = ink; x.lineWidth = 0.8; x.stroke();
      }
      if (swing > 0.3) { x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, len, -2.2, -0.6); x.stroke(); }
    }
    x.restore();
  },

  drawHelmet(x, hg, hx, hy, col, f) {
    const ink = '#2b2018';
    x.strokeStyle = ink; x.lineWidth = 1.4;
    switch (hg) {
      case 'sivri': x.fillStyle = '#b8c0c8'; x.beginPath(); x.moveTo(hx - 7, hy - 1); x.quadraticCurveTo(hx - 6, hy - 9, hx, hy - 15); x.quadraticCurveTo(hx + 6, hy - 9, hx + 7, hy - 1); x.closePath(); x.fill(); x.stroke(); break;
      case 'sarik': case 'sarikH': x.fillStyle = hg === 'sarikH' ? '#f39c12' : '#fbf6ea'; x.beginPath(); x.ellipse(hx, hy - 6, 8, 5.5, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(hx - 6, hy - 5); x.quadraticCurveTo(hx, hy - 9, hx + 7, hy - 4); x.stroke(); break;
      case 'bork': x.fillStyle = '#fbf6ea'; x.beginPath(); x.moveTo(hx - 6, hy - 3); x.lineTo(hx - 4, hy - 18); x.quadraticCurveTo(hx - 12, hy - 14, hx - 13, hy - 4); x.lineTo(hx + 6, hy - 3); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#d4ac0d'; x.fillRect(hx - 6, hy - 6, 12, 3); break;
      case 'kask': x.fillStyle = '#c9d1d8'; rrect(x, hx - 7, hy - 9, 14, 13, 3); x.fill(); x.stroke(); x.fillStyle = ink; x.fillRect(hx + 1, hy - 3, 6, 1.6); break;
      case 'tac': x.fillStyle = '#ffd34e'; x.beginPath(); x.moveTo(hx - 6, hy - 5); x.lineTo(hx - 6, hy - 12); x.lineTo(hx - 3, hy - 8); x.lineTo(hx, hy - 13); x.lineTo(hx + 3, hy - 8); x.lineTo(hx + 6, hy - 12); x.lineTo(hx + 6, hy - 5); x.closePath(); x.fill(); x.stroke(); break;
      case 'kalpak': x.fillStyle = '#5b4636'; rrect(x, hx - 7, hy - 14, 14, 10, 4); x.fill(); x.stroke(); break;
      case 'kurk': x.fillStyle = '#7a5c44'; rrect(x, hx - 7.5, hy - 12, 15, 8, 4); x.fill(); x.stroke(); break;
      case 'kabuto': x.fillStyle = '#2b2b2b'; x.beginPath(); x.arc(hx, hy - 3, 7.5, Math.PI, 0); x.fill(); x.stroke(); x.strokeStyle = '#ffd34e'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(hx - 5, hy - 9); x.lineTo(hx - 9, hy - 16); x.moveTo(hx + 5, hy - 9); x.lineTo(hx + 9, hy - 16); x.stroke(); break;
      case 'viking': x.fillStyle = '#aab3bb'; x.beginPath(); x.arc(hx, hy - 3, 7, Math.PI, 0); x.fill(); x.stroke(); x.fillStyle = '#fbf6ea'; x.beginPath(); x.moveTo(hx - 7, hy - 5); x.quadraticCurveTo(hx - 12, hy - 9, hx - 10, hy - 15); x.lineTo(hx - 6, hy - 8); x.fill(); x.stroke(); x.beginPath(); x.moveTo(hx + 7, hy - 5); x.quadraticCurveTo(hx + 12, hy - 9, hx + 10, hy - 15); x.lineTo(hx + 6, hy - 8); x.fill(); x.stroke(); break;
      case 'tolga': case 'sorguc': x.fillStyle = '#c0c8cf'; x.beginPath(); x.arc(hx, hy - 3, 7, Math.PI, 0); x.fill(); x.stroke(); x.fillStyle = hg === 'tolga' ? '#c0392b' : '#8e44ad'; x.beginPath(); x.moveTo(hx, hy - 10); x.quadraticCurveTo(hx - 8, hy - 20, hx - 12, hy - 12); x.quadraticCurveTo(hx - 5, hy - 14, hx, hy - 10); x.fill(); break;
      case 'hasir': x.fillStyle = '#e8c87a'; x.beginPath(); x.moveTo(hx - 12, hy - 4); x.lineTo(hx, hy - 13); x.lineTo(hx + 12, hy - 4); x.closePath(); x.fill(); x.stroke(); break;
      case 'tuy': for (let i = -2; i <= 2; i++) { x.fillStyle = ['#16a085', '#e74c3c', '#f1c40f', '#16a085', '#e74c3c'][i + 2]; x.beginPath(); x.ellipse(hx + i * 3, hy - 12, 2, 7, i * 0.25, 0, 7); x.fill(); } x.fillStyle = '#f1c40f'; x.fillRect(hx - 7, hy - 6, 14, 3); break;
      case 'cleric': x.fillStyle = f && f.robe ? f.robe : '#fff'; x.beginPath(); x.ellipse(hx, hy - 6, 7.5, 5, 0, 0, 7); x.fill(); x.stroke(); break;
      case 'enemy': x.fillStyle = shade(col, -0.2); x.beginPath(); x.arc(hx, hy - 2, 7, Math.PI, 0); x.fill(); x.stroke(); break;
      case 'yok': case undefined: case null:
        if (!f || !f.isCmd) { x.fillStyle = col; x.beginPath(); x.arc(hx, hy - 2, 6.8, Math.PI * 1.05, -0.05); x.fill(); }
        break;
    }
  },

  drawHorse(x, f, walk) {
    const ink = '#2b2018';
    x.strokeStyle = ink; x.lineWidth = 2.4;
    for (const [lx, ph] of [[-11, 0], [-6, 2], [9, 1], [14, 3]]) { const s = Math.sin(f.ph + ph) * 5; x.beginPath(); x.moveTo(lx, -16); x.lineTo(lx + s, 0); x.stroke(); }
    x.fillStyle = '#9b6b43'; x.beginPath(); x.ellipse(1, -21, 17, 8, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(14, -24); x.lineTo(21, -36); x.lineTo(28, -33); x.lineTo(23, -24); x.closePath(); x.fill(); x.stroke();
    x.strokeStyle = '#3b2a1c'; x.lineWidth = 3; x.beginPath(); x.moveTo(-16, -22); x.quadraticCurveTo(-22, -18, -20, -10); x.stroke();
    x.fillStyle = f.color; x.fillRect(-6, -29, 12, 4);
  },
  drawElephant(x, f, walk) {
    const ink = '#2b2018';
    x.strokeStyle = ink; x.lineWidth = 2.4; x.fillStyle = '#9aa1a8';
    for (const lx of [-14, -4, 8, 16]) { x.fillRect(lx - 4, -16 + Math.sin(f.ph + lx) * 2, 8, 16); x.strokeRect(lx - 4, -16 + Math.sin(f.ph + lx) * 2, 8, 16); }
    x.beginPath(); x.ellipse(0, -30, 26, 18, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.arc(24, -36, 12, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(32, -32); x.quadraticCurveTo(40, -18, 34, -6); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(30, -28); x.lineTo(40, -26); x.lineTo(31, -24); x.fill();
    x.fillStyle = f.color; rrect(x, -12, -56, 20, 10, 3); x.fill(); x.stroke();
  },
  drawMachine(x, f, fx, fy) {
    const ink = '#2b2018';
    x.translate(fx, fy); x.scale(f.dir, 1);
    x.strokeStyle = ink; x.lineWidth = 2;
    if (f.type === 'catapult') {
      x.fillStyle = '#8b5e3c'; x.fillRect(-26, -12, 52, 8); x.strokeRect(-26, -12, 52, 8);
      for (const wx of [-18, 18]) { x.fillStyle = '#6b4a2b'; x.beginPath(); x.arc(wx, -4, 6, 0, 7); x.fill(); x.stroke(); }
      x.fillStyle = '#9b6b43'; x.beginPath(); x.moveTo(-6, -12); x.lineTo(0, -32); x.lineTo(6, -12); x.fill(); x.stroke();
      const a = f.atkT > 0 ? -0.3 + (0.6 - f.atkT) * 2 : -0.9;
      x.save(); x.translate(0, -30); x.rotate(a); x.strokeStyle = '#6b4a2b'; x.lineWidth = 4; x.beginPath(); x.moveTo(-30, 0); x.lineTo(14, 0); x.stroke();
      if (f.atkT <= 0) { x.fillStyle = '#8f8169'; x.beginPath(); x.arc(-30, -5, 6, 0, 7); x.fill(); x.lineWidth = 1.5; x.strokeStyle = ink; x.stroke(); }
      x.restore();
    } else if (f.type === 'cannon') {
      for (const wx of [-10]) { x.fillStyle = '#6b4a2b'; x.beginPath(); x.arc(wx, -8, 9, 0, 7); x.fill(); x.stroke(); }
      const rec = f.atkT > 0 ? -f.atkT * 8 : 0;
      x.fillStyle = '#4a4f55'; rrect(x, -18 + rec, -22, 40, 12, 5); x.fill(); x.stroke();
      x.fillStyle = '#2d2d2d'; x.beginPath(); x.arc(22 + rec, -16, 4, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(-12 + rec, -20, 28, 2.5);
    } else if (f.type === 'tower') {
      x.fillStyle = '#9b6b43'; x.fillRect(-22, -170, 44, 162); x.strokeRect(-22, -170, 44, 162);
      x.strokeStyle = 'rgba(60,40,20,0.5)'; for (let yy = -160; yy < -10; yy += 18) { x.beginPath(); x.moveTo(-22, yy); x.lineTo(22, yy + 18); x.stroke(); }
      x.strokeStyle = ink; x.fillStyle = f.color; x.beginPath(); x.moveTo(-26, -170); x.lineTo(0, -192); x.lineTo(26, -170); x.closePath(); x.fill(); x.stroke();
      for (const wx of [-14, 14]) { x.fillStyle = '#6b4a2b'; x.beginPath(); x.arc(wx, -6, 8, 0, 7); x.fill(); x.stroke(); }
      if (f.docked) { x.fillStyle = '#8b5e3c'; x.fillRect(22, -150, 22, 6); }
    }
    x.setTransform(this.sc, 0, 0, this.sc, -this.camX * this.sc, 0);
    if (f.hp < f.maxhp) this.hpBar(x, f, fx, fy - (f.type === 'tower' ? 200 : 46));
  },

  drawCorpse(x, c) {
    const ink = '#2b2018';
    x.save(); x.translate(c.x, c.y - c.z); x.rotate(c.rot); x.scale(c.dir || 1, 1);
    x.lineCap = 'round'; x.strokeStyle = ink; x.lineWidth = 2.4;
    const col = c.burnt ? '#333' : c.color;
    if (c.type === 'cav' || c.type === 'elephant') {
      x.fillStyle = c.type === 'cav' ? '#9b6b43' : '#9aa1a8'; x.beginPath(); x.ellipse(0, -8, c.type === 'cav' ? 17 : 26, 8, 0, 0, 7); x.fill(); x.stroke();
    }
    if (c.part === 'lower' || c.part === 'whole') {
      x.beginPath(); x.moveTo(0, -20); x.lineTo(5, 0); x.moveTo(0, -20); x.lineTo(-5, 0); x.stroke();
      if (c.part === 'lower') { x.fillStyle = '#b5121b'; x.beginPath(); x.ellipse(0, -21, 4, 2.4, 0, 0, 7); x.fill(); x.strokeStyle = col; x.lineWidth = 4.6; x.beginPath(); x.moveTo(0, -20); x.lineTo(0, -16); x.stroke(); }
    }
    if (c.part === 'upper' || c.part === 'whole') {
      const off = c.part === 'upper' ? 18 : 0;
      x.translate(0, off);
      x.strokeStyle = col; x.lineWidth = 4.6; x.beginPath(); x.moveTo(0, -20); x.lineTo(1, -38); x.stroke();
      x.strokeStyle = ink; x.lineWidth = 2.4; x.beginPath(); x.moveTo(1, -35); x.lineTo(10, -28); x.moveTo(1, -35); x.lineTo(-6, -26); x.stroke();
      x.fillStyle = c.burnt ? '#555' : '#fff6e6'; x.lineWidth = 2; x.beginPath(); x.arc(2, -45, 6.5, 0, 7); x.fill(); x.stroke();
      x.strokeStyle = ink; x.lineWidth = 1.2; x.beginPath(); x.moveTo(3, -47); x.lineTo(6, -44); x.moveTo(6, -47); x.lineTo(3, -44); x.stroke();
      if (c.part === 'upper') { x.fillStyle = '#b5121b'; x.beginPath(); x.ellipse(0, -20, 4.5, 2.6, 0, 0, 7); x.fill(); }
      if (c.cmd && c.cmd.outfit) this.drawHelmet(x, c.cmd.outfit.helmet, 2, -45, col, c.cmd);
      else this.drawHelmet(x, c.hg, 2, -45, col, null);
    }
    x.restore();
  }
};
