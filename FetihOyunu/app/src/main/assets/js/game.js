/* ==========================================================
   FETİH — Oyun durumu ve kuralları
   Ekonomi, nüfus, ordular, fetih, diplomasi, kervan, ulak, YZ
   ========================================================== */
'use strict';

const SAVE_KEY = 'fetih_kayit_v1';
const P = 'P';       // oyuncu
const NEUTRAL = 'N'; // tarafsız köyler
// Askerler savaşta birebir görünür; bu yüzden sayılar sınırlı tutulur
const GARRISON_CAP = 300, ARMY_CAP = 250, VILLAGE_CAP = 200, CITY_CAP = 1500;

const Game = {
  S: null,
  pending: [],      // bekleyen savaş/karar olayları
  timeAcc: 0,
  onChange: null,   // UI yenileme
  mapDirty: true,

  /* ================== KURULUM ================== */
  newGame(opt) {
    const S = {
      ver: 2, day: 0, speed: 1, nextId: 1,
      player: {
        name: opt.realm || 'Benim Beyliğim', ruler: opt.ruler || 'Bey', color: opt.color || '#e84a5f',
        religion: opt.religion || 'islam', culture: opt.culture || 'Türk',
        cry: opt.cry || 'Allah Allah Allah!', customCry: '',
        capital: null, gold: 350, prestige: 0, overlord: null, wounded: 0,
        armor: { inf: 0, spear: 0, archer: 0, cav: 0 },
        headgears: ['yok', CULTURE_HAT[opt.culture] || 'fes'], headgear: CULTURE_HAT[opt.culture] || 'fes',
        outfit: { helmet: 'yok', armor: 'yok', weapon: 'kilic', shield: 'yok', beard: 'kisa', cape: '#c0392b', body: '#222222' },
        owned: { helmet: ['yok'], armor: ['yok'], weapon: ['kilic'], shield: ['yok'], beard: ['yok', 'kisa', 'uzun', 'biyik'] },
        settings: { gore: true, sound: true, voice: true },
        stats: { tax: 0, trade: 0, loot: 0, tribute: 0, upkeep: 0 },
        ledger: []
      },
      nations: {}, setts: [], armies: [], caravans: [], messengers: [], inbox: [], log: [], roads: []
    };
    for (const n of NATIONS) {
      S.nations[n.id] = Object.assign({}, n, {
        gold: 600, alive: true, overlord: null, opinion: randi(40, 60), status: 'peace',
        cooldown: randi(80, 200), msgCd: randi(40, 160)
      });
    }
    for (const c of CITIES) {
      const [x, y] = Proj.p(c.lon, c.lat);
      const pop = Math.round(c.pop / 6);
      const g = Math.round(pop * 0.1);
      S.setts.push({
        id: c.id, name: c.name, x, y, big: true, owner: c.nation, def: c.def, style: c.style,
        pop: { m: pop * 0.3, w: pop * 0.3, e: pop * 0.12, c: pop * 0.28, s: 0 },
        garrison: { inf: Math.round(g * 0.35), spear: Math.round(g * 0.25), archer: Math.round(g * 0.25), cav: Math.round(g * 0.15), catapult: 1, tower: 0, cannon: 0, balls: 0 },
        capBase: Math.min(pop * 1.4, CITY_CAP), grid: null, scale: 1, ruined: false, unrest: 0
      });
    }
    for (const v of VILLAGES) {
      const [x, y] = Proj.p(v[2], v[3]);
      const pop = randi(40, 120);
      const g = randi(4, 12);
      S.setts.push({
        id: v[0], name: v[1], x, y, big: false, owner: NEUTRAL, def: 'koy', style: 'village',
        pop: { m: pop * 0.3, w: pop * 0.3, e: pop * 0.12, c: pop * 0.28, s: 0 },
        garrison: { inf: Math.round(g * 0.5), spear: Math.round(g * 0.3), archer: Math.round(g * 0.2), cav: 0, catapult: 0, tower: 0, cannon: 0, balls: 0 },
        capBase: pop * 1.3, grid: null, scale: 1, ruined: false, unrest: 0
      });
    }
    // Oyuncunun başlangıç köyü: 40 kişilik halk (madde 26)
    const start = S.setts.find(s => s.id === opt.start) || S.setts.find(s => s.id === 'sogut');
    start.owner = P;
    start.name = opt.cityName || start.name;
    start.pop = { m: 12, w: 12, e: 6, c: 10, s: 0 };
    start.garrison = { inf: 0, spear: 0, archer: 0, cav: 0, catapult: 0, tower: 0, cannon: 0, balls: 0 };
    start.grid = Game.makeGrid(40, 1);
    start.scale = 1;
    S.player.capital = start.id;
    this.S = S;
    this.buildRoads();
    this.pending = [];
    this.log(`${S.player.name} kuruldu. 40 kişilik halkınla ${start.name}'te yola çıkıyorsun.`);
    this.mail(null, `Hoş geldin ${esc(S.player.ruler)}! Halkın 40 kişi. Ev yap, vergini topla, asker kuşan ve fethe başla. Haritada bir şehre dokunarak bilgi alabilirsin.`, 'info');
    this.mapDirty = true;
    this.save();
  },

  makeGrid(pop, scale) {
    const grid = new Array(GRID_W * GRID_H).fill(null);
    const center = 3 * GRID_W + 4;
    grid[center] = 'saray';
    let cap = BUILDINGS.saray.cap * scale;
    const order = [];
    for (let r = 0; r < 12; r++) for (let i = 0; i < grid.length; i++) {
      const x = i % GRID_W, y = Math.floor(i / GRID_W);
      const d = Math.max(Math.abs(x - 4), Math.abs(y - 3));
      if (d === r && i !== center) order.push(i);
    }
    let k = 0;
    while (cap < pop && k < order.length) {
      const big = pop - cap > 30 * scale;
      grid[order[k++]] = big ? 'konak' : 'ev';
      cap += (big ? BUILDINGS.konak.cap : BUILDINGS.ev.cap) * scale;
    }
    if (pop > 100 && k < order.length - 4) {
      grid[order[k++]] = 'tarla'; grid[order[k++]] = 'pazar';
      if (scale > 3) { grid[order[k++]] = 'sur'; grid[order[k++]] = 'kule'; }
    }
    return grid;
  },

  buildRoads() {
    const S = this.S, edges = new Set();
    const live = S.setts;
    for (const a of live) {
      const near = live.filter(b => b !== a).map(b => [b, dist(a.x, a.y, b.x, b.y)]).sort((p, q) => p[1] - q[1]).slice(0, 3);
      for (const [b, d] of near) {
        if (d > 420) continue;
        const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
        edges.add(k);
      }
    }
    // Büyük şehirler arası bağlantıyı garanti et
    const bigs = live.filter(s => s.big);
    for (const a of bigs) {
      const b = bigs.filter(x => x !== a).sort((p, q) => dist(a.x, a.y, p.x, p.y) - dist(a.x, a.y, q.x, q.y))[0];
      if (b) edges.add(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id);
    }
    S.roads = [...edges].map(k => k.split('|'));
  },

  /* ================== KAYIT ================== */
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.S)); } catch (e) { /* depolama yok */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const S = JSON.parse(raw);
      if (!S || S.ver !== 2) return false;
      const p = S.player;
      p.headgears = (p.headgears || ['yok']).filter(h => HEADGEARS[h]);
      if (!p.headgears.length) p.headgears = ['yok'];
      if (!HEADGEARS[p.headgear]) p.headgear = p.headgears[p.headgears.length - 1];
      this.S = S; this.pending = []; this.mapDirty = true;
      return true;
    } catch (e) { return false; }
  },
  hasSave() { try { const r = localStorage.getItem(SAVE_KEY); return !!r && JSON.parse(r).ver === 2; } catch (e) { return false; } },
  wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } },

  /* ================== YARDIMCILAR ================== */
  id() { return this.S.nextId++; },
  sett(id) { return this.S.setts.find(s => s.id === id); },
  army(id) { return this.S.armies.find(a => a.id === id); },
  nation(id) { return this.S.nations[id]; },
  ownerName(o) {
    if (o === P) return this.S.player.name;
    if (o === NEUTRAL) return 'Tarafsız';
    if (o === 'B') return 'Haydutlar';
    return this.S.nations[o] ? this.S.nations[o].name : '?';
  },
  ownerColor(o) {
    if (o === P) return this.S.player.color;
    if (o === NEUTRAL) return '#bfb6a3';
    if (o === 'B') return '#3d3d3d';
    return this.S.nations[o] ? this.S.nations[o].color : '#999';
  },
  log(t) { this.S.log.unshift({ day: this.S.day, t }); if (this.S.log.length > 80) this.S.log.pop(); },
  mail(from, text, kind = 'info', action = null) {
    this.S.inbox.unshift({ id: this.id(), day: this.S.day, from, text, kind, action, read: false, done: false });
    if (this.S.inbox.length > 60) this.S.inbox.pop();
    if (this.onMail) this.onMail();
  },
  earn(amount, kind, note) {
    const p = this.S.player;
    p.gold += amount;
    if (p.stats[kind] !== undefined) p.stats[kind] += amount;
    if (note) { p.ledger.unshift({ day: this.S.day, amount: Math.round(amount), note }); if (p.ledger.length > 40) p.ledger.pop(); }
  },
  spend(amount) {
    const p = this.S.player;
    if (p.gold < amount - 0.001) { toast('💰 Hazinede yeterli altın yok!', 'bad'); return false; }
    p.gold -= amount; SFX.coin(); return true;
  },
  totalPop(s) { return s.pop.m + s.pop.w + s.pop.e + s.pop.c + s.pop.s; },
  mySetts() { return this.S.setts.filter(s => s.owner === P && !s.ruined); },
  nationSetts(id) { return this.S.setts.filter(s => s.owner === id && !s.ruined); },
  count(units) { let n = 0; for (const k of UNIT_KEYS) n += units[k] || 0; return n; },
  emptyUnits() { return { inf: 0, spear: 0, archer: 0, cav: 0 }; },
  emptySiege() { return { catapult: 0, tower: 0, cannon: 0, balls: 0 }; },
  buildingCount(s, key) { return s.grid ? s.grid.filter(b => b === key).length : 0; },
  bonus(s, field) {
    if (!s.grid) return 0;
    let v = 0;
    for (const b of s.grid) if (b && BUILDINGS[b][field]) v += BUILDINGS[b][field];
    return v;
  },
  capacity(s) {
    if (!s.grid) return Math.min(s.capBase, s.big ? CITY_CAP : VILLAGE_CAP);
    let c = 0;
    for (const b of s.grid) if (b && BUILDINGS[b].cap) c += BUILDINGS[b].cap;
    return Math.min(c * (s.scale || 1), s.big ? CITY_CAP : VILLAGE_CAP);
  },
  relation(o) {
    if (o === P) return 'self';
    if (o === NEUTRAL) return 'neutral';
    if (o === 'B') return 'war';
    const n = this.S.nations[o];
    return n ? n.status : 'neutral';
  },
  isHostile(o) { const r = this.relation(o); return r === 'war'; },
  unitPower(u, armor) {
    const pw = { inf: 1, spear: 0.95, archer: 0.9, cav: 2.0 };
    let p = 0;
    for (const k of UNIT_KEYS) p += (u[k] || 0) * pw[k] * (armor ? ARMOR_TIERS[armor[k] || 0].mult : 1);
    return p;
  },
  siegePower(s) { return s ? (s.catapult || 0) * 4 + (s.tower || 0) * 3 + Math.min(s.cannon || 0, Math.ceil((s.balls || 0) / 3)) * 8 : 0; },
  nationPower(id) {
    let p = 0;
    for (const s of this.nationSetts(id)) p += this.unitPower(s.garrison);
    for (const a of this.S.armies) if (a.owner === id) p += this.unitPower(a.units);
    return p;
  },
  playerPower() {
    const A = this.S.player.armor;
    let p = 0;
    for (const s of this.mySetts()) p += this.unitPower(s.garrison, A);
    for (const a of this.S.armies) if (a.owner === P && !a.lentFrom) p += this.unitPower(a.units, A);
    return p + 10; // komutanın kendisi
  },
  taxOf(s) {
    const rel = s.owner === P ? this.S.player.religion : (this.S.nations[s.owner] || {}).religion;
    const relB = rel === 'hindu' ? 0.05 : 0;
    const base = (s.pop.m + s.pop.w) * 0.35 + s.pop.e * 0.08 + s.pop.s * 0.45;
    const unrest = 1 - (s.unrest || 0) / 200;
    return base * (1 + this.bonus(s, 'tax') + relB) * unrest;
  },
  upkeep() {
    let n = 0, sg = 0;
    for (const s of this.mySetts()) { n += this.count(s.garrison); sg += (s.garrison.catapult || 0) + (s.garrison.tower || 0) + (s.garrison.cannon || 0); }
    for (const a of this.S.armies) if (a.owner === P && !a.lentFrom) { n += this.count(a.units); sg += (a.siege.catapult || 0) + (a.siege.tower || 0) + (a.siege.cannon || 0); }
    return n * 0.05 + sg * 0.4;
  },
  dailyIncome() {
    let tax = 0;
    for (const s of this.mySetts()) tax += this.taxOf(s);
    let trib = 0;
    for (const id in this.S.nations) {
      const n = this.S.nations[id];
      if (n.alive && n.overlord === P) for (const s of this.nationSetts(id)) trib += this.taxOf(s) * 0.2;
    }
    const out = this.S.player.overlord ? tax * 0.2 : 0;
    return { tax, tribIn: trib, tribOut: out, upkeep: this.upkeep(), net: tax + trib - out - this.upkeep() };
  },
  visionSources() {
    const src = [];
    for (const s of this.S.setts) {
      if (s.ruined) continue;
      if (s.owner === P) src.push([s.x, s.y, (s.big ? 230 : 150) + this.bonus(s, 'vision')]);
      else if (this.relation(s.owner) === 'ally' || (this.S.nations[s.owner] && this.S.nations[s.owner].overlord === P)) src.push([s.x, s.y, 110]);
    }
    for (const a of this.S.armies) if (a.owner === P) src.push([a.x, a.y, 170]);
    for (const c of this.S.caravans) if (c.owner === P) src.push([c.x, c.y, 110]);
    return src;
  },
  visible(x, y, src) {
    src = src || this.visionSources();
    for (const [sx, sy, r] of src) if ((x - sx) ** 2 + (y - sy) ** 2 < r * r) return true;
    return false;
  },

  /* ================== ZAMAN ================== */
  update(realDt) {
    const S = this.S;
    if (!S || this.pending.length || this.hold || S.speed === 0) return;
    const dd = realDt * S.speed; // gün
    this.timeAcc += dd;
    this.moveAll(dd);
    while (this.timeAcc >= 1) { this.timeAcc -= 1; this.dayTick(); if (this.pending.length) break; }
  },

  dayTick() {
    const S = this.S, p = S.player;
    S.day++;
    // Nüfus (madde 10, 25)
    for (const s of S.setts) {
      if (s.ruined) continue;
      const tot = this.totalPop(s), cap = this.capacity(s);
      const relig = s.owner === P ? p.religion : (S.nations[s.owner] || {}).religion;
      const room = tot < cap ? Math.min(1, (cap - tot) / Math.max(5, cap * 0.08)) : 0;
      const growth = 1 + this.bonus(s, 'growth') + (relig === 'budizm' ? 0.1 : 0);
      const births = Math.min(s.pop.m, s.pop.w) * 0.006 * growth * room;
      const mature = s.pop.c * 0.006;
      const age = (s.pop.m + s.pop.w) * 0.0008;
      const deaths = s.pop.e * 0.008;
      s.pop.c += births - mature;
      s.pop.m += mature / 2 - age / 2;
      s.pop.w += mature / 2 - age / 2;
      s.pop.e += age - deaths;
      s.pop.s *= 0.9995;
      if (tot > cap * 1.15) { const k = 0.996; s.pop.m *= k; s.pop.w *= k; s.pop.c *= k; s.pop.e *= k; }
      if (!s.grid) s.capBase = Math.min(s.capBase * 1.0002, s.big ? CITY_CAP : VILLAGE_CAP);
      if (s.unrest > 0) s.unrest = Math.max(0, s.unrest - 0.3);
      // Vergi
      const tax = this.taxOf(s);
      if (s.owner === P) {
        if (p.overlord) {
          const ov = S.nations[p.overlord];
          this.earn(tax * 0.8, 'tax'); p.stats.tribute -= tax * 0.2;
          if (ov) ov.gold += tax * 0.2;
        } else this.earn(tax, 'tax');
      } else if (S.nations[s.owner]) {
        const n = S.nations[s.owner];
        if (n.overlord === P) { n.gold += tax * 0.6; this.earn(tax * 0.2, 'tribute'); }
        else n.gold += tax * 0.8;
      }
    }
    const up = this.upkeep();
    p.gold -= up; p.stats.upkeep += up;
    if (p.gold < -50) this.desert();
    if (p.wounded > 0) { p.wounded--; if (p.wounded === 0) toast('🩹 Komutan iyileşti, yeniden savaşa hazır!', 'good'); }

    this.aiTick();
    if (S.day % 10 === 0) this.save();
    if (this.onChange) this.onChange();
  },

  desert() {
    // Maaş ödenmezse askerler kaçar
    for (const s of this.mySetts()) for (const k of UNIT_KEYS) s.garrison[k] = Math.floor(s.garrison[k] * 0.9);
    for (const a of this.S.armies) if (a.owner === P && !a.lentFrom) for (const k of UNIT_KEYS) a.units[k] = Math.floor(a.units[k] * 0.9);
    this.S.player.gold = Math.max(this.S.player.gold, -50);
    toast('⚠️ Hazine boş! Maaş alamayan askerler kaçıyor.', 'bad');
  },

  /* ================== HAREKET VE KARŞILAŞMALAR ================== */
  armySpeed(a) {
    let sp = 32;
    if (a.units.cav > 0 && this.count(a.units) === a.units.cav) sp = 50;
    if ((a.siege.catapult || 0) + (a.siege.tower || 0) + (a.siege.cannon || 0) > 0) sp = 22;
    if (a.owner === P && this.S.player.religion === 'tengri') sp *= 1.1;
    return sp;
  },

  moveAll(dd) {
    const S = this.S;
    // Ordular
    for (const a of [...S.armies]) {
      if (!S.armies.includes(a)) continue;
      if (a.targetType === 'army') {
        const t = this.army(a.targetId);
        if (!t) { a.targetType = null; a.mode = 'idle'; }
        else { a.tx = t.x; a.ty = t.y; }
      }
      if (a.tx != null) {
        const d = dist(a.x, a.y, a.tx, a.ty), step = this.armySpeed(a) * dd;
        if (d <= step) { a.x = a.tx; a.y = a.ty; a.tx = null; a.ty = null; this.arrive(a); }
        else { a.x += (a.tx - a.x) / d * step; a.y += (a.ty - a.y) / d * step; }
      }
      if (!S.armies.includes(a)) continue;
      this.checkEncounters(a);
      if (this.pending.length) return;
    }
    // Kervanlar
    for (const c of [...S.caravans]) {
      const next = this.sett(c.path[c.i + 1]);
      if (!next) { S.caravans.splice(S.caravans.indexOf(c), 1); continue; }
      const d = dist(c.x, c.y, next.x, next.y), step = 24 * dd;
      if (d <= step) {
        c.x = next.x; c.y = next.y; c.i++;
        if (c.i >= c.path.length - 1) { this.caravanArrive(c); continue; }
      } else { c.x += (next.x - c.x) / d * step; c.y += (next.y - c.y) / d * step; }
      c.danger = (c.danger || 0) + dd;
      if (c.owner === P && c.danger >= 1) { c.danger = 0; this.caravanRisk(c); if (this.pending.length) return; }
    }
    // Ulaklar
    for (const m of [...S.messengers]) {
      const d = dist(m.x, m.y, m.tx, m.ty), step = 75 * dd;
      if (d <= step) { S.messengers.splice(S.messengers.indexOf(m), 1); this.messengerArrive(m); }
      else { m.x += (m.tx - m.x) / d * step; m.y += (m.ty - m.y) / d * step; }
    }
  },

  arrive(a) {
    if (a.targetType === 'sett') {
      const s = this.sett(a.targetId);
      if (!s || s.ruined) { a.mode = 'idle'; a.targetType = null; return; }
      if (a.owner === P) {
        if (s.owner === P) { a.mode = 'idle'; a.targetType = null; if (a.mode === 'return') this.disband(a.id, true); toast(`🏕️ Ordu ${s.name}'e ulaştı.`); return; }
        if (this.relation(s.owner) === 'ally') { a.mode = 'idle'; a.targetType = null; toast(`🤝 Ordu müttefik şehir ${s.name}'e ulaştı.`); return; }
        if (a.order === 'plunder') { this.plunder(a, s); a.targetType = null; return; }
        this.requestSiege(a, s);
        a.targetType = null;
      } else {
        // Yapay zekâ ordusu hedefe ulaştı
        if (s.owner === a.owner) { this.mergeIntoGarrison(a, s); return; }
        if (s.owner === P) { this.requestDefense(a, s); return; }
        this.aiSiege(a, s);
      }
    } else if (a.targetType === null && a.mode === 'move') a.mode = 'idle';
    if (a.mode === 'return' && a.owner === P) {
      const s = this.nearestOwn(a.x, a.y);
      if (s && dist(a.x, a.y, s.x, s.y) < 16) this.disband(a.id, true);
    }
  },

  nearestOwn(x, y, owner = P) {
    let best = null, bd = 1e9;
    for (const s of this.S.setts) if (s.owner === owner && !s.ruined) {
      const d = dist(x, y, s.x, s.y); if (d < bd) { bd = d; best = s; }
    }
    return best;
  },

  checkEncounters(a) {
    const S = this.S;
    if (a.owner === P) {
      // Düşman orduya saldırı
      if (a.targetType === 'army') {
        const t = this.army(a.targetId);
        if (t && dist(a.x, a.y, t.x, t.y) < 14) { this.requestField(a, t, false); a.targetType = null; return; }
      }
      // Pusu (madde 31)
      if (a.mode === 'ambush') {
        for (const e of S.armies) if (e.owner !== P && this.isHostile(e.owner) && dist(a.x, a.y, e.x, e.y) < 48) {
          this.requestField(a, e, true); return;
        }
      }
      // Yol kesme / yağma (madde 27)
      if (a.mode === 'raid') {
        for (const c of [...S.caravans]) if (c.owner !== P && dist(a.x, a.y, c.x, c.y) < 42) { this.raidCaravan(a, c); }
      }
    } else if (a.owner !== P) {
      // Yapay zekâ ordusu oyuncu ordusuyla karşılaşırsa (savaş halindeyse)
      if (this.isHostile(a.owner)) {
        for (const pa of S.armies) if (pa.owner === P && pa.mode !== 'ambush' && dist(a.x, a.y, pa.x, pa.y) < 14) {
          this.requestField(pa, a, false, true); return;
        }
      }
    }
  },

  /* ================== ORDU YÖNETİMİ ================== */
  recruit(s, type, n, merc) {
    const disc = this.bonus(s, 'discount');
    const room = GARRISON_CAP - this.count(s.garrison);
    if (room <= 0) { toast(`⛺ ${s.name} garnizonu dolu (en fazla ${GARRISON_CAP} asker). Ordu çıkar ya da başka şehirde kuşan.`, 'bad'); return false; }
    if (n > room) { n = room; }
    if (!merc && s.pop.m < n) { toast(`👨 ${s.name}'te yeterli erkek nüfus yok. Paralı asker tut!`, 'bad'); return false; }
    const cost = Math.ceil(UNITS[type].cost * (1 - Math.min(0.4, disc)) * n * (merc ? 2 : 1));
    if (!this.spend(cost)) return false;
    if (!merc) s.pop.m -= n;
    s.garrison[type] += n;
    toast(`${UNITS[type].icon} ${n} ${UNITS[type].name} kuşandırıldı (${fmt(cost)} altın)`, 'good');
    return true;
  },
  buySiege(s, type, n) {
    const cost = SIEGE[type].cost * n;
    if (!this.spend(cost)) return false;
    s.garrison[type] = (s.garrison[type] || 0) + n * (SIEGE[type].pack || 1);
    toast(`${SIEGE[type].icon} ${SIEGE[type].name} alındı`, 'good');
    return true;
  },
  armorCost(type) {
    const t = this.S.player.armor[type] + 1;
    if (t >= ARMOR_TIERS.length) return null;
    let disc = 0;
    for (const s of this.mySetts()) disc = Math.max(disc, this.bonus(s, 'armorDisc'));
    return Math.ceil(ARMOR_TIERS[t].cost * (1 - disc));
  },
  buyArmor(type) {
    const c = this.armorCost(type);
    if (c == null) return false;
    if (!this.spend(c)) return false;
    this.S.player.armor[type]++;
    toast(`🛡️ Tüm ${UNITS[type].name} birlikleri ${ARMOR_TIERS[this.S.player.armor[type]].name} zırh giydi!`, 'good');
    return true;
  },
  researchHeadgear(id) {
    const p = this.S.player;
    if (p.headgears.includes(id)) { p.headgear = id; return true; }
    if (!this.spend(HEADGEARS[id].cost)) return false;
    p.headgears.push(id); p.headgear = id;
    toast(`🎓 ${HEADGEARS[id].name} araştırıldı ve askerlere giydirildi.`, 'good');
    return true;
  },

  formArmy(s, units, siege, name) {
    const total = this.count(units);
    if (total <= 0) { toast('Orduya en az bir asker seç.', 'bad'); return null; }
    let left = ARMY_CAP;
    for (const k of UNIT_KEYS) { units[k] = Math.min(units[k] || 0, s.garrison[k], left); left -= units[k]; s.garrison[k] -= units[k]; }
    if (total > ARMY_CAP) toast(`Bir ordu en fazla ${ARMY_CAP} asker olabilir; fazlası garnizonda kaldı.`);
    for (const k in siege) { siege[k] = Math.min(siege[k] || 0, s.garrison[k] || 0); s.garrison[k] -= siege[k]; }
    const a = {
      id: this.id(), owner: P, name: name || `${s.name} Ordusu`, x: s.x + rand(-6, 6), y: s.y + 10,
      tx: null, ty: null, targetType: null, targetId: null, units, siege, mode: 'idle', home: s.id
    };
    this.S.armies.push(a);
    return a;
  },
  disband(armyId, auto) {
    const a = this.army(armyId); if (!a) return;
    if (a.lentFrom) { this.returnLent(a.id); return; }
    const s = this.nearestOwn(a.x, a.y);
    if (!s || dist(a.x, a.y, s.x, s.y) > 20) { if (!auto) toast('Ordu dağıtmak için kendi şehrinde olmalı.', 'bad'); return; }
    for (const k of UNIT_KEYS) s.garrison[k] += a.units[k] || 0;
    for (const k in a.siege) s.garrison[k] = (s.garrison[k] || 0) + (a.siege[k] || 0);
    this.S.armies.splice(this.S.armies.indexOf(a), 1);
    toast(`🏰 ${a.name} ${s.name} garnizonuna katıldı.`);
  },
  mergeIntoGarrison(a, s) {
    for (const k of UNIT_KEYS) s.garrison[k] += a.units[k] || 0;
    this.S.armies.splice(this.S.armies.indexOf(a), 1);
  },
  order(armyId, o) {
    const a = this.army(armyId); if (!a) return;
    a.order = null;
    if (o.type === 'point') { a.tx = o.x; a.ty = o.y; a.targetType = null; a.mode = 'move'; }
    else if (o.type === 'sett') { const s = this.sett(o.id); a.tx = s.x; a.ty = s.y; a.targetType = 'sett'; a.targetId = s.id; a.mode = 'move'; a.order = o.plunder ? 'plunder' : null; }
    else if (o.type === 'army') { const t = this.army(o.id); a.tx = t.x; a.ty = t.y; a.targetType = 'army'; a.targetId = t.id; a.mode = 'move'; }
    else if (o.type === 'mode') { a.mode = o.mode; a.tx = null; a.ty = null; a.targetType = null; }
    else if (o.type === 'home') {
      const s = this.nearestOwn(a.x, a.y); if (!s) return;
      a.tx = s.x; a.ty = s.y; a.targetType = 'sett'; a.targetId = s.id; a.mode = 'move';
    }
  },

  /* ================== SAVAŞ İSTEKLERİ ================== */
  wallsOf(s) {
    const D = DEFENSES[s.def] || DEFENSES.koy;
    const mult = (1 + this.bonus(s, 'wall')) * (s.big ? 1 : 1);
    return {
      key: s.def, name: D.name, desc: D.desc, special: D.special || 'none', wood: !!D.wood,
      walls: D.walls.map(h => Math.round(h * mult)),
      towers: D.towers + this.buildingCount(s, 'kule')
    };
  },
  playerSideExtras() {
    // Hami (madde 39) ve vasalların birlikleri savaşa katılır
    const S = this.S, extra = [];
    if (S.player.overlord) {
      const n = S.nations[S.player.overlord];
      if (n && n.alive) {
        const tot = this.emptyUnits();
        for (const s of this.nationSetts(n.id)) for (const k of UNIT_KEYS) tot[k] += s.garrison[k];
        const u = {}; for (const k of UNIT_KEYS) u[k] = Math.min(Math.round(tot[k] * 0.12), 25);
        if (this.count(u) > 0) extra.push({ owner: n.id, units: u, label: `${n.name} (Hami)` });
      }
    }
    for (const id in S.nations) {
      const n = S.nations[id];
      if (n.alive && n.overlord === P) {
        const tot = this.emptyUnits();
        for (const s of this.nationSetts(n.id)) for (const k of UNIT_KEYS) tot[k] += s.garrison[k];
        const u = {}; for (const k of UNIT_KEYS) u[k] = Math.min(Math.round(tot[k] * 0.1), 20);
        if (this.count(u) > 0) extra.push({ owner: n.id, units: u, label: `${n.name} (Vasal)` });
      }
    }
    return extra;
  },
  nearbyPlayerArmies(a, r = 70) {
    return this.S.armies.filter(b => b.owner === P && b !== a && dist(a.x, a.y, b.x, b.y) < r);
  },
  sideFromArmies(armies) {
    const units = this.emptyUnits(), siege = this.emptySiege(), allies = [];
    for (const a of armies) {
      if (a.lentFrom) { allies.push({ owner: a.lentFrom, units: Object.assign({}, a.units), label: `${this.ownerName(a.lentFrom)} (Emrinde)`, armyId: a.id }); continue; }
      for (const k of UNIT_KEYS) units[k] += a.units[k] || 0;
      for (const k in siege) siege[k] += a.siege[k] || 0;
    }
    return { units, siege, allies, armies: armies.map(a => a.id) };
  },

  requestSiege(a, s) {
    const armies = [a, ...this.nearbyPlayerArmies(a)];
    const side = this.sideFromArmies(armies);
    side.allies.push(...this.playerSideExtras());
    side.owner = P;
    if (s.owner !== NEUTRAL && this.relation(s.owner) !== 'war') this.declareWar(s.owner, true);
    this.pending.push({
      kind: 'siege', title: `${s.name} Kuşatması`, playerSide: 'att',
      att: side,
      def: { owner: s.owner, units: Object.assign({}, s.garrison), siege: this.emptySiege(), allies: [], settId: s.id },
      defense: this.wallsOf(s), context: { type: 'siege', settId: s.id }
    });
  },
  requestDefense(enemy, s) {
    s.attack = { owner: enemy.owner, n: this.count(enemy.units), day: this.S.day };
    if (s.owner === P) toast(`⚔️ ${s.name} saldırı altında! Köye girip bakabilirsin.`, 'bad');
    const nearby = this.S.armies.filter(b => b.owner === P && dist(b.x, b.y, s.x, s.y) < 60);
    const side = this.sideFromArmies(nearby);
    for (const k of UNIT_KEYS) side.units[k] += s.garrison[k];
    side.allies.push(...this.playerSideExtras());
    side.owner = P; side.settId = s.id; side.useGarrison = true;
    this.pending.push({
      kind: 'siege', title: `${s.name} Savunması`, playerSide: 'def',
      att: { owner: enemy.owner, units: Object.assign({}, enemy.units), siege: Object.assign(this.emptySiege(), enemy.siege), allies: [], armies: [enemy.id] },
      def: side, defense: this.wallsOf(s), context: { type: 'defense', settId: s.id, enemyArmy: enemy.id }
    });
  },
  requestField(pa, enemy, ambush, enemyAttacks) {
    const armies = [pa, ...this.nearbyPlayerArmies(pa)];
    const side = this.sideFromArmies(armies);
    side.allies.push(...this.playerSideExtras());
    side.owner = P;
    if (!this.isHostile(enemy.owner) && enemy.owner !== 'B') this.declareWar(enemy.owner, true);
    const e = { owner: enemy.owner, units: Object.assign({}, enemy.units), siege: Object.assign(this.emptySiege(), enemy.siege), allies: [], armies: [enemy.id] };
    this.pending.push({
      kind: 'field', title: ambush ? 'Pusu Baskını!' : 'Meydan Muharebesi', playerSide: enemyAttacks ? 'def' : 'att',
      att: enemyAttacks ? e : side, def: enemyAttacks ? side : e, ambush,
      context: { type: 'field', enemyArmy: enemy.id }
    });
  },

  /* ================== SAVAŞ SONUCU ================== */
  applyResult(cfg, res) {
    const S = this.S;
    const mine = cfg.playerSide === 'att' ? cfg.att : cfg.def;
    const theirs = cfg.playerSide === 'att' ? cfg.def : cfg.att;
    const myRemain = cfg.playerSide === 'att' ? res.attRemain : res.defRemain;
    const thRemain = cfg.playerSide === 'att' ? res.defRemain : res.attRemain;
    const won = (res.winner === cfg.playerSide);
    // Kendi kayıplarımızı ordulara/garnizona dağıt
    const ratio = {};
    for (const k of UNIT_KEYS) ratio[k] = mine.units[k] > 0 ? clamp(myRemain.units[k] / mine.units[k], 0, 1) : 1;
    const sRatio = {};
    for (const k of ['catapult', 'tower', 'cannon']) sRatio[k] = mine.siege && mine.siege[k] > 0 ? clamp((myRemain.siege[k] || 0) / mine.siege[k], 0, 1) : 1;
    for (const id of (mine.armies || [])) {
      const a = this.army(id); if (!a) continue;
      for (const k of UNIT_KEYS) a.units[k] = Math.round(a.units[k] * ratio[k]);
      for (const k in sRatio) a.siege[k] = Math.round((a.siege[k] || 0) * sRatio[k]);
      a.siege.balls = Math.max(0, (a.siege.balls || 0) - (res.ballsUsed || 0));
    }
    // Emrimizdeki müttefik birlikleri
    for (const al of (mine.allies || [])) if (al.armyId) {
      const a = this.army(al.armyId); if (!a) continue;
      const r = res.allyRatio != null ? res.allyRatio : (won ? 0.8 : 0.4);
      for (const k of UNIT_KEYS) a.units[k] = Math.round(a.units[k] * r);
    }
    if (mine.useGarrison) {
      const s = this.sett(mine.settId);
      for (const k of UNIT_KEYS) s.garrison[k] = Math.round(s.garrison[k] * ratio[k]);
    }
    // Rakibin kayıpları
    if (theirs.settId && cfg.kind === 'siege' && cfg.playerSide === 'att') {
      const s = this.sett(theirs.settId);
      for (const k of UNIT_KEYS) s.garrison[k] = Math.round(thRemain.units[k] || 0);
    }
    for (const id of (theirs.armies || [])) {
      const a = this.army(id); if (!a) continue;
      for (const k of UNIT_KEYS) a.units[k] = Math.round(thRemain.units[k] * ((a.units[k] || 0) / Math.max(1, theirs.units[k])));
      for (const k of ['catapult', 'tower', 'cannon']) a.siege[k] = Math.round(thRemain.siege ? (thRemain.siege[k] || 0) : 0);
      if (this.count(a.units) <= 0) S.armies.splice(S.armies.indexOf(a), 1);
      else if (won) { a.tx = null; a.targetType = null; const home = this.nearestOwn(a.x, a.y, a.owner); if (home) { a.tx = home.x; a.ty = home.y; a.targetType = 'sett'; a.targetId = home.id; } }
    }
    // Boş orduları temizle
    for (const a of [...S.armies]) if (this.count(a.units) <= 0 && !(a.siege.catapult || a.siege.tower || a.siege.cannon)) S.armies.splice(S.armies.indexOf(a), 1);

    // Komutan yaralandı (madde 21)
    if (res.playerWounded) {
      S.player.wounded = 25;
      this.log('Komutan ağır yaralandı ve şehrine götürüldü.');
    }
    const kills = res.kills || 0;
    if (won) S.player.prestige += Math.round(5 + kills / 5);

    const ctx = cfg.context || {};
    if (!won) {
      // Ordu geri çekilir
      for (const id of (mine.armies || [])) {
        const a = this.army(id); if (!a) continue;
        const home = this.nearestOwn(a.x, a.y);
        if (home) { a.tx = home.x; a.ty = home.y; a.targetType = 'sett'; a.targetId = home.id; a.mode = 'move'; }
      }
    }

    if (ctx.type === 'siege' && won) {
      const s = this.sett(ctx.settId);
      // Kalan saldıran birlikler şehirde kalır
      return { conquest: s.id };
    }
    if (ctx.type === 'defense') {
      const s = this.sett(ctx.settId);
      const killed = this.count(cfg.att.units) - this.count(res.attRemain.units);
      const lost = this.count(mine.units) - this.count(myRemain.units);
      s.attack = null;
      s.after = { day: S.day, seed: randi(1, 1e6), kills: Math.max(0, killed), losses: Math.max(0, lost), owner: cfg.att.owner, won };
      // Saldırıda halktan da kayıp olur
      if (!won) for (const k of ['m', 'w', 'e', 'c']) s.pop[k] *= 0.9; else s.pop.m = Math.max(0, s.pop.m - lost * 0.1);
      if (!won) {
        const enemy = this.army(ctx.enemyArmy);
        const owner = cfg.att.owner;
        if (owner === 'B') { this.loseGoldToBandits(s); }
        else {
          const n = S.nations[owner];
          const choice = n && n.aggr > 0.7 && Math.random() < 0.3 ? 'enslave' : 'annex';
          this.conquer(s.id, owner, choice, true);
          if (enemy) { for (const k of UNIT_KEYS) s.garrison[k] = enemy.units[k]; S.armies.splice(S.armies.indexOf(enemy), 1); }
          this.mail(owner, `${s.name} şehrin artık bizimdir! ${choice === 'enslave' ? 'Halkın köle edildi.' : 'Halkın tebamıza katıldı.'}`, 'war');
        }
      } else {
        this.log(`${s.name} savunması başarıyla yapıldı!`);
      }
    }
    if (ctx.type === 'caravan') {
      const c = S.caravans.find(c => c.id === ctx.caravanId);
      if (c) {
        if (won) { for (const k of UNIT_KEYS) c.guards[k] = Math.round(c.guards[k] * ratio[k]); toast('🐪 Kervan korundu, yola devam ediyor!', 'good'); }
        else { S.caravans.splice(S.caravans.indexOf(c), 1); toast('🐪 Kervan yağmalandı! Mallar kaybedildi.', 'bad'); this.log('Kervanımız yağmalandı.'); }
      }
    }
    if (ctx.type === 'duel') {
      const n = S.nations[ctx.nation];
      if (won) {
        const ransom = Math.round(Math.max(100, n.gold * 0.15));
        n.gold -= ransom; this.earn(ransom, 'loot', `${n.name} meydan savaşı fidyesi`);
        S.player.prestige += 25; n.opinion = clamp(n.opinion + 5, 0, 100);
        this.mail(n.id, `Meydan savaşını kazandın. Söz verildiği gibi ${fmt(ransom)} altın fidye gönderiyoruz. Yiğitliğine saygı duyuyoruz.`, 'info');
      } else {
        const fine = Math.round(Math.max(50, S.player.gold * 0.15));
        S.player.gold -= fine; n.gold += fine; S.player.prestige = Math.max(0, S.player.prestige - 10);
        this.mail(n.id, `Meydanı biz kazandık! Fidye olarak ${fmt(fine)} altın hazinenden alındı.`, 'war');
      }
      // Düello birlikleri garnizona döner
      const cap = this.sett(S.player.capital) || this.mySetts()[0];
      if (cap && ctx.fromGarrison) for (const k of UNIT_KEYS) cap.garrison[k] = Math.round(cap.garrison[k] * ratio[k]);
    }
    if (ctx.type === 'field' && won && ctx.enemyArmy) {
      const loot = Math.round(kills * 3 + 20);
      this.earn(loot, 'loot', 'Savaş ganimeti');
    }
    this.mapDirty = true;
    return {};
  },

  /* ================== FETİH (madde 7, 8, 9) ================== */
  conquer(settId, newOwner, choice, silent) {
    const S = this.S, s = this.sett(settId);
    const old = s.owner;
    const oldN = S.nations[old];
    const tot = this.totalPop(s);
    let loot = tot * 0.6 + (oldN ? oldN.gold / Math.max(1, this.nationSetts(old).length) * 0.5 : 0);
    const mult = { annex: 1, enslave: 1.4, massacre: 2.0, raze: 2.6 }[choice];
    loot *= mult;
    if (newOwner === P) {
      let hb = 0; for (const x of this.mySetts()) hb = Math.max(hb, this.bonus(x, 'loot'));
      loot *= 1 + hb;
    }
    if (oldN) oldN.gold = Math.max(0, oldN.gold - loot * 0.3);
    const opinionHit = { annex: 0, enslave: -8, massacre: -18, raze: -25 }[choice];
    if (newOwner === P) {
      for (const id in S.nations) S.nations[id].opinion = clamp(S.nations[id].opinion + opinionHit, 0, 100);
      if (oldN) oldN.opinion = clamp(oldN.opinion - 30, 0, 100);
    }
    s.garrison = { inf: 0, spear: 0, archer: 0, cav: 0, catapult: 0, tower: 0, cannon: 0, balls: 0 };
    const txt = { annex: 'halkını tebaya kattı', enslave: 'halkını köleleştirdi', massacre: 'halkını kılıçtan geçirdi', raze: 'şehri yerle bir etti' }[choice];
    if (choice === 'raze') {
      s.ruined = true; s.owner = null; s.pop = { m: 0, w: 0, e: 0, c: 0, s: 0 }; s.grid = null;
    } else {
      s.owner = newOwner;
      if (choice === 'enslave') {
        s.pop.s += (s.pop.m + s.pop.w) * 0.7; s.pop.m *= 0.3; s.pop.w *= 0.3; s.unrest = 60;
      } else if (choice === 'massacre') {
        for (const k in s.pop) s.pop[k] *= 0.06; s.unrest = 20;
      } else s.unrest = 30;
      if (newOwner === P && !s.grid) {
        s.scale = Math.max(1, Math.ceil(tot / 350));
        s.grid = this.makeGrid(Math.max(this.totalPop(s), tot * 0.6) / s.scale, 1);
      }
      if (newOwner !== P) s.grid = null;
      if (newOwner !== P && s.capBase < tot) s.capBase = tot * 1.2;
    }
    if (newOwner === P) {
      this.earn(loot, 'loot', `${s.name} fethi ganimeti`);
      this.log(`${s.name} fethedildi; ${S.player.ruler} ${txt}. Ganimet: ${fmt(loot)} altın.`);
      SFX.horn();
    } else if (S.nations[newOwner]) {
      S.nations[newOwner].gold += loot;
      if (!silent) this.log(`${S.nations[newOwner].name}, ${s.name}'i aldı ve ${txt}.`);
    }
    if (oldN && this.nationSetts(old).length === 0) {
      oldN.alive = false;
      this.log(`${oldN.name} tarih sahnesinden silindi!`);
      toast(`📜 ${oldN.name} yıkıldı!`, 'good');
      for (const a of [...S.armies]) if (a.owner === old) S.armies.splice(S.armies.indexOf(a), 1);
      for (const a of S.armies) if (a.lentFrom === old) a.lentFrom = null;
    }
    if (old === P && this.mySetts().length === 0) this.gameOver = true;
    if (old === P && S.player.capital === s.id) {
      const nx = this.mySetts()[0]; if (nx) S.player.capital = nx.id;
    }
    this.mapDirty = true;
    this.save();
  },

  plunder(a, s) {
    // Yağma: şehri almadan ganimet topla (madde 27)
    if (s.owner !== NEUTRAL && this.relation(s.owner) !== 'war') this.declareWar(s.owner, true);
    const mine = this.unitPower(a.units, this.S.player.armor);
    const sally = this.unitPower(s.garrison) * 0.35;
    if (mine * rand(0.8, 1.2) > sally) {
      const loot = Math.round(this.totalPop(s) * 0.25 + 30);
      this.earn(loot, 'loot', `${s.name} yağması`);
      for (const k in s.pop) s.pop[k] *= 0.95;
      for (const k of UNIT_KEYS) s.garrison[k] = Math.round(s.garrison[k] * 0.85);
      const lossR = clamp(sally / Math.max(1, mine) * 0.3, 0, 0.5);
      for (const k of UNIT_KEYS) a.units[k] = Math.round(a.units[k] * (1 - lossR));
      toast(`🔥 ${s.name} yağmalandı! +${fmt(loot)} altın`, 'good');
      this.log(`${s.name} yağmalandı (+${fmt(loot)} altın).`);
    } else {
      for (const k of UNIT_KEYS) a.units[k] = Math.round(a.units[k] * 0.6);
      toast(`🛡️ ${s.name} garnizonu yağmacıları püskürttü!`, 'bad');
    }
    if (S_nat(s.owner)) S_nat(s.owner).opinion = clamp(S_nat(s.owner).opinion - 15, 0, 100);
    a.mode = 'idle';
    this.order(a.id, { type: 'home' });
  },

  raidCaravan(a, c) {
    const S = this.S;
    const mine = this.unitPower(a.units, S.player.armor);
    const g = this.unitPower(c.guards);
    if (c.owner && S.nations[c.owner] && S.nations[c.owner].status !== 'war') {
      S.nations[c.owner].opinion = clamp(S.nations[c.owner].opinion - 20, 0, 100);
      if (S.nations[c.owner].opinion < 25) this.declareWar(c.owner, false, true);
    }
    if (mine * rand(0.8, 1.3) > g) {
      this.earn(c.goods, 'loot', `${this.ownerName(c.owner)} kervanı yağması`);
      const lossR = clamp(g / Math.max(1, mine) * 0.25, 0, 0.4);
      for (const k of UNIT_KEYS) a.units[k] = Math.round(a.units[k] * (1 - lossR));
      toast(`🐪 Kervan basıldı! +${fmt(c.goods)} altın`, 'good');
      this.log(`${this.ownerName(c.owner)} kervanı yolda kesildi (+${fmt(c.goods)}).`);
    } else {
      for (const k of UNIT_KEYS) a.units[k] = Math.round(a.units[k] * 0.7);
      toast('🐪 Kervan muhafızları baskını püskürttü!', 'bad');
    }
    S.caravans.splice(S.caravans.indexOf(c), 1);
  },

  loseGoldToBandits(s) {
    const lost = Math.round(this.S.player.gold * 0.2);
    this.S.player.gold -= lost;
    toast(`🏴 Haydutlar ${s.name}'i yağmaladı: -${fmt(lost)} altın`, 'bad');
  },

  /* ================== YZ KUŞATMASI ================== */
  aiSiege(a, s) {
    const S = this.S;
    const D = this.wallsOf(s);
    const defP = this.unitPower(s.garrison) * (1 + D.walls.reduce((x, y) => x + y, 0) / 3000 + D.towers * 0.05);
    const attP = this.unitPower(a.units) + this.siegePower(a.siege);
    if (attP * rand(0.8, 1.2) > defP) {
      const lossR = clamp(defP / attP * 0.6, 0.05, 0.9);
      for (const k of UNIT_KEYS) a.units[k] = Math.round(a.units[k] * (1 - lossR));
      const oldName = this.ownerName(s.owner);
      this.conquer(s.id, a.owner, Math.random() < 0.85 ? 'annex' : 'enslave');
      for (const k of UNIT_KEYS) s.garrison[k] = a.units[k];
      S.armies.splice(S.armies.indexOf(a), 1);
      if (this.visible(s.x, s.y)) toast(`⚔️ ${this.ownerName(s.owner)}, ${oldName}'dan ${s.name}'i aldı.`);
    } else {
      const lossR = clamp(attP / Math.max(1, defP) * 0.4, 0.05, 0.6);
      for (const k of UNIT_KEYS) s.garrison[k] = Math.round(s.garrison[k] * (1 - lossR));
      S.armies.splice(S.armies.indexOf(a), 1);
    }
  },

  /* ================== OTOMATİK SAVAŞ (komutanlara bırak) ================== */
  autoResolve(cfg) {
    const A = this.S.player.armor;
    const sideP = (side, isPlayer) => {
      let p = this.unitPower(side.units, isPlayer ? A : null);
      for (const al of side.allies || []) p += this.unitPower(al.units);
      return p;
    };
    let ap = sideP(cfg.att, cfg.playerSide === 'att') + this.siegePower(cfg.att.siege);
    let dp = sideP(cfg.def, cfg.playerSide === 'def');
    if (cfg.kind === 'siege') {
      const w = cfg.defense.walls.reduce((x, y) => x + y, 0);
      dp *= 1 + Math.max(0, w / 3000 - this.siegePower(cfg.att.siege) / 40) + cfg.defense.towers * 0.05;
    }
    if (cfg.ambush) { if (cfg.playerSide === 'att') ap *= 1.4; else dp *= 1.4; }
    const ar = ap * rand(0.85, 1.15), dr = dp * rand(0.85, 1.15);
    const winner = ar > dr ? 'att' : 'def';
    const wl = winner === 'att' ? clamp(dr / ar * 0.55, 0.03, 0.85) : clamp(ar / dr * 0.55, 0.03, 0.85);
    const ll = rand(0.7, 0.95);
    const scale = (u, r) => { const o = {}; for (const k of UNIT_KEYS) o[k] = Math.round((u[k] || 0) * (1 - r)); return o; };
    const sc = s => ({ catapult: s.catapult || 0, tower: s.tower || 0, cannon: s.cannon || 0 });
    return {
      winner,
      attRemain: { units: scale(cfg.att.units, winner === 'att' ? wl : ll), siege: sc(cfg.att.siege || {}) },
      defRemain: { units: scale(cfg.def.units, winner === 'def' ? wl : ll), siege: sc(cfg.def.siege || {}) },
      playerWounded: false, kills: Math.round((winner === cfg.playerSide ? ll : wl) * this.count(cfg.playerSide === 'att' ? cfg.def.units : cfg.att.units)),
      ballsUsed: Math.min(cfg.att.siege ? cfg.att.siege.balls || 0 : 0, 10), allyRatio: winner === cfg.playerSide ? 1 - wl : 1 - ll
    };
  },

  /* ================== KERVANLAR (madde 28, 29) ================== */
  path(fromId, toId) {
    const S = this.S, adj = {};
    for (const [a, b] of S.roads) {
      const sa = this.sett(a), sb = this.sett(b);
      if (!sa || !sb) continue;
      const d = dist(sa.x, sa.y, sb.x, sb.y);
      (adj[a] = adj[a] || []).push([b, d]); (adj[b] = adj[b] || []).push([a, d]);
    }
    const D = { [fromId]: 0 }, prev = {}, done = new Set();
    while (true) {
      let u = null, bd = 1e18;
      for (const k in D) if (!done.has(k) && D[k] < bd) { bd = D[k]; u = k; }
      if (u == null) break;
      if (u === toId) break;
      done.add(u);
      for (const [v, w] of adj[u] || []) {
        const nd = D[u] + w;
        if (D[v] == null || nd < D[v]) { D[v] = nd; prev[v] = u; }
      }
    }
    if (D[toId] == null) return null;
    const out = [toId];
    while (out[0] !== fromId) out.unshift(prev[out[0]]);
    return { path: out, len: D[toId] };
  },
  createCaravan(from, dest, goods, guards) {
    const S = this.S;
    if (!dest.big) { toast('Kervanlar sadece büyük şehirlere satış yapabilir.', 'bad'); return false; }
    if (this.relation(dest.owner) === 'war') { toast('Savaşta olduğun bir şehirle ticaret yapılamaz.', 'bad'); return false; }
    const r = this.path(from.id, dest.id);
    if (!r) { toast('Bu şehre giden yol bulunamadı.', 'bad'); return false; }
    for (const k of UNIT_KEYS) if ((guards[k] || 0) > from.garrison[k]) { toast('Garnizonda o kadar muhafız yok.', 'bad'); return false; }
    if (!this.spend(goods)) return false;
    for (const k of UNIT_KEYS) from.garrison[k] -= guards[k] || 0;
    S.caravans.push({ id: this.id(), owner: P, path: r.path, i: 0, x: from.x, y: from.y, goods, guards: Object.assign(this.emptyUnits(), guards), home: from.id, dest: dest.id, len: r.len });
    toast(`🐪 Kervan ${dest.name} yolunda! (${fmt(goods)} altınlık mal)`, 'good');
    return true;
  },
  caravanArrive(c) {
    const S = this.S;
    S.caravans.splice(S.caravans.indexOf(c), 1);
    const dest = this.sett(c.dest);
    if (c.owner === P) {
      const home = this.sett(c.home);
      const tb = (home ? this.bonus(home, 'trade') : 0) + (S.player.religion === 'yahudi' ? 0.15 : 0);
      const profit = Math.round(c.goods * (1.3 + c.len / 1400) * (1 + tb));
      this.earn(profit, 'trade', `${dest ? dest.name : ''} ticareti`);
      const back = home && home.owner === P ? home : this.sett(S.player.capital);
      if (back) for (const k of UNIT_KEYS) back.garrison[k] += c.guards[k] || 0;
      if (dest && S.nations[dest.owner]) { S.nations[dest.owner].gold += c.goods * 0.15; S.nations[dest.owner].opinion = clamp(S.nations[dest.owner].opinion + 3, 0, 100); }
      toast(`💰 Kervan ${dest ? dest.name : ''}'da mallarını sattı: +${fmt(profit)} altın`, 'good');
      SFX.coin();
    } else if (S.nations[c.owner]) S.nations[c.owner].gold += c.goods * 0.35;
  },
  caravanRisk(c) {
    const S = this.S;
    // Savaştaki düşman ordular yakındaysa saldırır
    for (const e of S.armies) if (e.owner !== P && this.isHostile(e.owner) && dist(e.x, e.y, c.x, c.y) < 40) {
      this.caravanBattle(c, e.owner, Object.assign({}, e.units)); return;
    }
    if (Math.random() < 0.012) {
      const n = Math.max(4, Math.round(c.goods / 14 * rand(0.6, 1.3)));
      const u = { inf: Math.round(n * 0.4), spear: Math.round(n * 0.2), archer: Math.round(n * 0.2), cav: Math.round(n * 0.2) };
      this.caravanBattle(c, 'B', u);
    }
  },
  caravanBattle(c, owner, units) {
    this.pending.push({
      kind: 'field', title: `Kervan Baskını — ${this.ownerName(owner)}`, playerSide: 'def',
      att: { owner, units, siege: this.emptySiege(), allies: [], armies: [] },
      def: { owner: P, units: Object.assign({}, c.guards), siege: this.emptySiege(), allies: [], armies: [] },
      context: { type: 'caravan', caravanId: c.id }
    });
  },

  /* ================== ULAK (madde 36) ================== */
  capitalOf(owner) {
    if (owner === P) return this.sett(this.S.player.capital) || this.mySetts()[0];
    const l = this.nationSetts(owner);
    return l.sort((a, b) => this.totalPop(b) - this.totalPop(a))[0];
  },
  sendMessenger(to, text) {
    const S = this.S;
    const from = this.capitalOf(P), dest = this.capitalOf(to);
    if (!from || !dest) return false;
    if (!this.spend(5)) return false;
    S.messengers.push({ id: this.id(), from: P, to, x: from.x, y: from.y, tx: dest.x, ty: dest.y, text });
    toast(`🏇 Ulak ${this.ownerName(to)} hükümdarına yola çıktı.`);
    return true;
  },
  aiSendMessenger(from, text, kind = 'info', action = null) {
    const src = this.capitalOf(from), dest = this.capitalOf(P);
    if (!src || !dest) return;
    this.S.messengers.push({ id: this.id(), from, to: P, x: src.x, y: src.y, tx: dest.x, ty: dest.y, text, kind, action });
  },
  messengerArrive(m) {
    if (m.to === P) {
      this.mail(m.from, m.text, m.kind || 'info', m.action || null);
      toast(`📜 ${this.ownerName(m.from)} ulağı geldi!`, 'mail');
      SFX.horn();
    } else {
      const n = this.S.nations[m.to];
      if (!n || !n.alive) return;
      const reply = this.aiReply(n, m.text);
      this.aiSendMessenger(n.id, reply.text, reply.kind, reply.action);
    }
  },
  aiReply(n, text) {
    const t = (text || '').toLocaleLowerCase('tr-TR');
    const myP = this.playerPower(), theirP = this.nationPower(n.id) + 1;
    const r = n.ruler;
    const has = (...w) => w.some(x => t.includes(x));
    if (has('aptal', 'korkak', 'alçak', 'hain', 'zavallı', 'ahmak', 'rezil')) {
      n.opinion = clamp(n.opinion - 22, 0, 100);
      if (n.opinion < 25 && n.status !== 'war') { this.declareWar(n.id, false, true); return { text: `${r}: Bu hakaretin bedelini kanla ödeyeceksin! Artık savaştayız!`, kind: 'war' }; }
      return { text: `${r}: Dilini tut! Sabrımız sınırsız değil.`, kind: 'war' };
    }
    if (has('barış', 'sulh', 'ateşkes')) {
      if (n.status === 'war') {
        if (n.opinion > 25 || myP > theirP * 1.3 || Math.random() < 0.25) { this.makePeace(n.id); return { text: `${r}: Barış teklifini kabul ediyoruz. Kılıçlar kınına!`, kind: 'peace' }; }
        return { text: `${r}: Barış mı? Önce bedelini öde ya da kılıcımıza hazırlan!`, kind: 'war' };
      }
      n.opinion = clamp(n.opinion + 4, 0, 100);
      return { text: `${r}: Aramızda zaten barış var. Dostluğumuz sürsün.`, kind: 'info' };
    }
    if (has('ittifak', 'müttefik', 'dost')) {
      if (n.status !== 'war' && (n.opinion > 58 || (n.opinion > 45 && myP > theirP * 0.6))) {
        n.status = 'ally'; n.opinion = clamp(n.opinion + 5, 0, 100);
        return { text: `${r}: İttifak teklifini kabul ediyoruz! Düşmanın düşmanımızdır.`, kind: 'peace' };
      }
      n.opinion = clamp(n.opinion + 2, 0, 100);
      return { text: `${r}: Henüz sana o kadar güvenmiyoruz. Hediyelerin ve dostluğun bizi ikna edebilir.`, kind: 'info' };
    }
    if (has('teslim', 'boyun eğ', 'vasal', 'himayeme', 'itaat')) {
      if (myP > theirP * 2.2 && n.overlord == null) {
        n.overlord = P; n.status = 'peace';
        return { text: `${r}: Gücünü kabul ediyoruz. Himayene giriyor, vergimizi ödeyeceğiz.`, kind: 'peace' };
      }
      n.opinion = clamp(n.opinion - 10, 0, 100);
      return { text: `${r}: Biz kimseye boyun eğmeyiz! Haddini bil.`, kind: 'war' };
    }
    if (has('haraç', 'vergi ver', 'altın ver')) {
      if (myP > theirP * 1.6) {
        const g = Math.round(Math.min(n.gold * 0.3, 400));
        n.gold -= g; this.earn(g, 'tribute', `${n.name} haracı`);
        n.opinion = clamp(n.opinion - 8, 0, 100);
        return { text: `${r}: Savaş istemiyoruz... ${fmt(g)} altın haracı kabul et.`, kind: 'info' };
      }
      n.opinion = clamp(n.opinion - 12, 0, 100);
      return { text: `${r}: Haraç isteyen kılıcını da göstermeli!`, kind: 'war' };
    }
    if (has('ticaret', 'kervan')) {
      n.opinion = clamp(n.opinion + 5, 0, 100);
      return { text: `${r}: Kervanlarınız şehirlerimizde her zaman ağırlanır.`, kind: 'info' };
    }
    if (has('savaş', 'meydan', 'düello')) {
      return { text: `${r}: Meydan savaşı istiyorsan Diplomasi'den resmî davet gönder. Hazırız!`, kind: 'info' };
    }
    if (has('selam', 'merhaba', 'saygı', 'hürmet')) {
      n.opinion = clamp(n.opinion + 3, 0, 100);
      return { text: `${r}: Selamını aldık, ${this.S.player.ruler}. Saygılarımızı sunarız.`, kind: 'info' };
    }
    n.opinion = clamp(n.opinion + 1, 0, 100);
    return { text: `${r}: Mektubunu okuduk. ${pick(['Düşüneceğiz.', 'Allah selamet versin.', 'Ulağın iyi ağırlandı.', 'Sözlerini meclisimizde konuştuk.'])}`, kind: 'info' };
  },

  /* ================== DİPLOMASİ (madde 11, 12, 22, 39) ================== */
  declareWar(id, silent, byThem) {
    const n = this.S.nations[id]; if (!n) return;
    if (n.status === 'war') return;
    n.status = 'war'; n.opinion = clamp(n.opinion - 25, 0, 100);
    if (n.overlord === P) n.overlord = null;
    if (this.S.player.overlord === id) { this.S.player.overlord = null; toast(`${n.name} himayesinden çıktın.`); }
    n.cooldown = Math.min(n.cooldown, randi(15, 45));
    // İhanet edilen ittifaklar diğerlerini de etkiler
    if (!byThem) for (const k in this.S.nations) if (k !== id) this.S.nations[k].opinion = clamp(this.S.nations[k].opinion - 3, 0, 100);
    this.log(byThem ? `${n.name} sana savaş ilan etti!` : `${n.name}'e savaş ilan edildi.`);
    toast(`⚔️ ${n.name} ile savaş başladı!`, 'bad');
    SFX.drum();
    this.mapDirty = true;
  },
  makePeace(id) {
    const n = this.S.nations[id]; if (!n) return;
    n.status = 'peace'; n.opinion = clamp(n.opinion + 10, 0, 100);
    for (const a of [...this.S.armies]) if (a.owner === id) { const h = this.nearestOwn(a.x, a.y, id); if (h) { a.tx = h.x; a.ty = h.y; a.targetType = 'sett'; a.targetId = h.id; } }
    this.log(`${n.name} ile barış yapıldı.`);
    toast(`🕊️ ${n.name} ile barış!`, 'good');
    this.mapDirty = true;
  },
  proposePeace(id, gift) {
    const n = this.S.nations[id];
    if (gift && !this.spend(gift)) return;
    const chance = (n.opinion + gift / 8) / 100 + (this.playerPower() > this.nationPower(id) ? 0.25 : 0);
    if (Math.random() < chance) { n.gold += gift; this.makePeace(id); return true; }
    toast(`${n.ruler} barışı reddetti.`, 'bad'); return false;
  },
  proposeAlliance(id, gift) {
    const n = this.S.nations[id];
    if (n.status === 'war') { toast('Önce barış yapmalısın.', 'bad'); return false; }
    if (gift && !this.spend(gift)) return false;
    n.gold += gift; n.opinion = clamp(n.opinion + gift / 20, 0, 100);
    const ok = n.opinion > 55 || (n.opinion > 40 && Math.random() < 0.3);
    if (ok) { n.status = 'ally'; n.opinion = clamp(n.opinion + 5, 0, 100); toast(`🤝 ${n.name} ile ittifak kuruldu!`, 'good'); this.log(`${n.name} ile ittifak kuruldu.`); this.mapDirty = true; return true; }
    toast(`${n.ruler}: "Henüz hazır değiliz." (Görüş: ${Math.round(n.opinion)})`, 'bad'); return false;
  },
  breakAlliance(id) {
    const n = this.S.nations[id]; n.status = 'peace'; n.opinion = clamp(n.opinion - 20, 0, 100);
    for (const a of [...this.S.armies]) if (a.lentFrom === id) this.returnLent(a.id);
    toast(`${n.name} ile ittifak bozuldu.`); this.mapDirty = true;
  },
  requestTroops(id, want) {
    // Müttefikten asker iste — emrine verilir (madde 12)
    const n = this.S.nations[id];
    if (n.status !== 'ally') { toast('Sadece müttefiklerden asker istenebilir.', 'bad'); return false; }
    if (n.opinion < 35) { toast(`${n.ruler} artık sana asker vermek istemiyor.`, 'bad'); return false; }
    const src = this.nationSetts(id).sort((a, b) => this.count(b.garrison) - this.count(a.garrison))[0];
    if (!src) return false;
    const total = this.count(src.garrison);
    const give = Math.min(want, Math.floor(total * 0.35));
    if (give < 1) { toast('Müttefiğin verecek askeri yok.', 'bad'); return false; }
    const u = {};
    for (const k of UNIT_KEYS) { u[k] = Math.floor(src.garrison[k] * give / total); src.garrison[k] -= u[k]; }
    const a = { id: this.id(), owner: P, lentFrom: id, name: `${n.name} Kuvvetleri`, x: src.x + 8, y: src.y + 8, tx: null, ty: null, targetType: null, units: u, siege: this.emptySiege(), mode: 'idle', home: src.id };
    this.S.armies.push(a);
    n.opinion = clamp(n.opinion - 6, 0, 100);
    toast(`🤝 ${n.name} ${this.count(u)} askerini senin emrine verdi! Haritada ${src.name} yakınında.`, 'good');
    return a;
  },
  returnLent(armyId) {
    const a = this.army(armyId); if (!a || !a.lentFrom) return;
    const n = this.S.nations[a.lentFrom];
    const s = n ? this.capitalOf(n.id) : null;
    if (s) for (const k of UNIT_KEYS) s.garrison[k] += a.units[k] || 0;
    if (n) n.opinion = clamp(n.opinion + 4, 0, 100);
    this.S.armies.splice(this.S.armies.indexOf(a), 1);
    toast(`↩️ ${a.name} müttefiğe geri gönderildi.`);
  },
  giveArmyToAlly(armyId, id) {
    // Kendi askerlerini müttefiğin emrine ver (madde 12)
    const a = this.army(armyId), n = this.S.nations[id];
    if (!a || !n || n.status !== 'ally') return false;
    const dest = this.capitalOf(id);
    for (const k of UNIT_KEYS) dest.garrison[k] += a.units[k] || 0;
    const sz = this.count(a.units);
    this.S.armies.splice(this.S.armies.indexOf(a), 1);
    n.opinion = clamp(n.opinion + Math.min(25, sz / 4), 0, 100);
    toast(`🤝 ${sz} asker ${n.name} komutasına verildi. Görüşleri yükseldi.`, 'good');
    return true;
  },
  seekProtection(id, gift) {
    // Himayeye gir (madde 39): ikna etmek gerekir
    const S = this.S, n = S.nations[id];
    if (S.player.overlord) { toast('Zaten bir hami altındasın.', 'bad'); return false; }
    if (n.status === 'war') { toast('Savaştığın biriyle bunu konuşamazsın.', 'bad'); return false; }
    if (gift && !this.spend(gift)) return false;
    n.gold += gift;
    const theirs = this.nationPower(id), mine = this.playerPower();
    const chance = clamp((n.opinion - 30) / 60 + gift / 600 + (theirs > mine ? 0.2 : -0.3), 0.02, 0.95);
    if (Math.random() < chance) {
      S.player.overlord = id; n.opinion = clamp(n.opinion + 10, 0, 100);
      if (n.status !== 'ally') n.status = 'peace';
      toast(`🛡️ ${n.name} seni himayesine aldı. Vergi ödeyecek, onlarla birlikte savaşacaksın.`, 'good');
      this.log(`${n.name} himayesine girildi.`);
      return true;
    }
    toast(`${n.ruler} ikna olmadı. (Şans %${Math.round(chance * 100)})`, 'bad');
    return false;
  },
  leaveProtection() {
    const S = this.S, n = S.nations[S.player.overlord];
    if (!n) return;
    S.player.overlord = null; n.opinion = clamp(n.opinion - 20, 0, 100);
    toast(`${n.name} himayesinden çıktın. Artık bağımsızsın!`);
    this.log(`${n.name} himayesinden çıkıldı.`);
  },
  demandVassal(id, gift) {
    const n = this.S.nations[id];
    if (gift && !this.spend(gift)) return false;
    n.gold += gift;
    const mine = this.playerPower(), theirs = this.nationPower(id) + 1;
    const chance = clamp((mine / theirs - 1.5) / 2 + n.opinion / 200 + gift / 800, 0.02, 0.9);
    if (Math.random() < chance) {
      n.overlord = P; if (n.status === 'war') n.status = 'peace';
      toast(`👑 ${n.name} himayene girdi! Vergi ödeyip seninle savaşacaklar.`, 'good');
      this.log(`${n.name} vasalımız oldu.`);
      this.mapDirty = true; return true;
    }
    n.opinion = clamp(n.opinion - 8, 0, 100);
    toast(`${n.ruler} teklifini reddetti. (Şans %${Math.round(chance * 100)})`, 'bad');
    return false;
  },
  releaseVassal(id) {
    const n = this.S.nations[id]; n.overlord = null; n.opinion = clamp(n.opinion + 5, 0, 100);
    toast(`${n.name} himayenden çıkarıldı.`); this.mapDirty = true;
  },
  inviteDuel(id, armyId) {
    // Meydan savaşına davet (madde 22)
    const S = this.S, n = S.nations[id];
    let units, armies = [], fromGarrison = false;
    const a = armyId ? this.army(armyId) : null;
    if (a && a.owner === P) { units = Object.assign({}, a.units); armies = [a.id]; }
    else {
      const cap = this.sett(S.player.capital) || this.mySetts()[0];
      units = {}; for (const k of UNIT_KEYS) units[k] = cap.garrison[k]; fromGarrison = true;
    }
    if (this.count(units) < 1) { toast('Meydana çıkacak askerin yok! Önce asker kuşan.', 'bad'); return false; }
    const myP = this.unitPower(units, S.player.armor);
    const src = this.capitalOf(id);
    const total = this.count(src.garrison) || 1;
    const share = clamp((myP * rand(0.8, 1.4)) / Math.max(1, this.unitPower(src.garrison)), 0.1, 0.8);
    const eu = {}; for (const k of UNIT_KEYS) eu[k] = Math.round(src.garrison[k] * share);
    const accept = this.unitPower(eu) > myP * 0.7 || Math.random() < 0.4;
    if (!accept || this.count(eu) < 1) { n.opinion = clamp(n.opinion - 2, 0, 100); toast(`${n.ruler} meydan davetini reddetti. Prestij kazandın!`, 'good'); S.player.prestige += 3; return false; }
    toast(`⚔️ ${n.ruler} meydan davetini kabul etti!`, 'good');
    this.queueDuel(n, units, eu, armies, fromGarrison, src);
    return true;
  },
  queueDuel(n, units, eu, armies, fromGarrison, src) {
    this.pending.push({
      kind: 'field', title: `Meydan Savaşı — ${n.name}`, playerSide: 'att',
      att: { owner: P, units, siege: this.emptySiege(), allies: [], armies },
      def: { owner: n.id, units: eu, siege: this.emptySiege(), allies: [], armies: [] },
      context: { type: 'duel', nation: n.id, fromGarrison, srcId: src.id }, duel: true
    });
    // Rakip kayıpları sonuçta işlenir
    this.pending[this.pending.length - 1].onDone = (res) => {
      const r = this.count(res.defRemain.units) / Math.max(1, this.count(eu));
      for (const k of UNIT_KEYS) src.garrison[k] = Math.max(0, src.garrison[k] - Math.round(eu[k] * (1 - r)));
    };
  },
  giftGold(id, amount) {
    const n = this.S.nations[id];
    if (!this.spend(amount)) return;
    n.gold += amount; n.opinion = clamp(n.opinion + amount / 15, 0, 100);
    toast(`🎁 ${n.name} hediyeni memnuniyetle kabul etti. (Görüş ${Math.round(n.opinion)})`, 'good');
  },

  inboxAction(msg, accept) {
    const S = this.S;
    if (msg.done) return;
    msg.done = true;
    const a = msg.action; if (!a) return;
    const n = S.nations[msg.from];
    if (!n || !n.alive) return;
    if (a.type === 'alliance') {
      if (accept) { n.status = 'ally'; n.opinion = clamp(n.opinion + 8, 0, 100); toast(`🤝 ${n.name} ile ittifak!`, 'good'); this.mapDirty = true; }
      else n.opinion = clamp(n.opinion - 5, 0, 100);
    } else if (a.type === 'tribute') {
      if (accept) { if (this.spend(a.amount)) { n.gold += a.amount; n.opinion = clamp(n.opinion + 10, 0, 100); toast('Haraç ödendi. Barış korundu.'); } else msg.done = false; }
      else { this.declareWar(n.id, false, true); }
    } else if (a.type === 'duel') {
      if (accept) {
        const cap = this.sett(S.player.capital) || this.mySetts()[0];
        const units = {}; for (const k of UNIT_KEYS) units[k] = cap.garrison[k];
        if (this.count(units) < 1) { toast('Meydana çıkacak askerin yok!', 'bad'); S.player.prestige = Math.max(0, S.player.prestige - 5); return; }
        const src = this.capitalOf(n.id);
        const eu = {}; for (const k of UNIT_KEYS) eu[k] = Math.round(src.garrison[k] * 0.3);
        this.queueDuel(n, units, eu, [], true, src);
      } else { S.player.prestige = Math.max(0, S.player.prestige - 5); n.opinion = clamp(n.opinion - 3, 0, 100); toast('Davet reddedildi. Prestij -5'); }
    } else if (a.type === 'vassalOffer') {
      if (accept) { n.overlord = P; if (n.status === 'war') n.status = 'peace'; toast(`👑 ${n.name} vasalın oldu!`, 'good'); this.mapDirty = true; }
    } else if (a.type === 'protectOffer') {
      if (accept) { S.player.overlord = n.id; n.status = n.status === 'war' ? 'peace' : n.status; toast(`🛡️ ${n.name} himayesine girdin.`); }
    } else if (a.type === 'peace') {
      if (accept) this.makePeace(n.id);
    }
  },

  /* ================== YAPAY ZEKÂ ================== */
  aiTick() {
    const S = this.S;
    const ids = Object.keys(S.nations);
    ids.forEach((id, idx) => {
      const n = S.nations[id];
      if (!n.alive) return;
      // görüşler yavaşça ortalamaya döner
      n.opinion += (50 - n.opinion) * 0.002;
      if (n.cooldown > 0) n.cooldown--;
      if (n.msgCd > 0) n.msgCd--;
      if ((S.day + idx) % 5 !== 0) return;
      const setts = this.nationSetts(id);
      if (!setts.length) return;
      // Asker toplama
      if (n.gold > 60) {
        const s = setts.sort((a, b) => this.count(a.garrison) / Math.max(1, a.pop.m) - this.count(b.garrison) / Math.max(1, b.pop.m))[0];
        const target = Math.min(200, this.totalPop(s) * 0.1);
        if (this.count(s.garrison) < target) {
          const budget = n.gold * 0.5, k = pick(UNIT_KEYS), c = UNITS[k].cost;
          const num = Math.min(Math.floor(budget / c), Math.floor(s.pop.m * 0.05));
          if (num > 0) { s.garrison[k] += num; s.pop.m -= num; n.gold -= num * c; }
        }
      }
      // Oyuncuya saldırı
      if (n.status === 'war' && n.cooldown <= 0 && this.mySetts().length) {
        const enemyArmies = S.armies.filter(a => a.owner === id).length;
        if (enemyArmies < 2) {
          let best = null, bd = 1e9, src = null;
          for (const ms of this.mySetts()) for (const ns of setts) {
            const d = dist(ms.x, ms.y, ns.x, ns.y); if (d < bd) { bd = d; best = ms; src = ns; }
          }
          if (best && src && this.count(src.garrison) > 12) {
            const share = rand(0.45, 0.7), u = {};
            for (const k of UNIT_KEYS) { u[k] = Math.floor(src.garrison[k] * share); src.garrison[k] -= u[k]; }
            const sg = this.emptySiege();
            if (best.big || this.wallsOf(best).walls[0] > 600) { sg.catapult = Math.min(2, src.garrison.catapult || 1); }
            S.armies.push({ id: this.id(), owner: id, name: `${n.name} Ordusu`, x: src.x, y: src.y + 8, tx: best.x, ty: best.y, targetType: 'sett', targetId: best.id, units: u, siege: sg, mode: 'move' });
            if (Math.random() < 0.5) this.aiSendMessenger(id, `${n.ruler}: Ordularımız ${best.name} üzerine yürüyor. Teslim ol ya da yok ol!`, 'war');
          }
          n.cooldown = randi(70, 140);
        }
      }
      // Genişleme: tarafsız köylere saldırı
      if (n.cooldown <= 0 && Math.random() < n.aggr * 0.25 && S.day > 30) {
        let best = null, bd = 520, src = null;
        for (const t of S.setts) {
          if (t.ruined || t.owner !== NEUTRAL) continue;
          for (const ns of setts) { const d = dist(t.x, t.y, ns.x, ns.y); if (d < bd) { bd = d; best = t; src = ns; } }
        }
        if (best && this.count(src.garrison) > 30) {
          const u = {};
          for (const k of UNIT_KEYS) { u[k] = Math.floor(src.garrison[k] * 0.35); src.garrison[k] -= u[k]; }
          S.armies.push({ id: this.id(), owner: id, name: `${n.name} Ordusu`, x: src.x, y: src.y + 8, tx: best.x, ty: best.y, targetType: 'sett', targetId: best.id, units: u, siege: this.emptySiege(), mode: 'move' });
          n.cooldown = randi(90, 200);
        }
      }
      // Savaş ilanı
      if (n.status === 'peace' && n.overlord !== P && S.player.overlord !== id && n.opinion < 18 && Math.random() < n.aggr * 0.3) {
        this.declareWar(id, false, true);
        this.aiSendMessenger(id, `${n.ruler}: Sabrımız tükendi. Bu andan itibaren savaştayız!`, 'war');
      }
      // Barış teklifi
      if (n.status === 'war' && n.opinion > 40 && Math.random() < 0.08) {
        this.aiSendMessenger(id, `${n.ruler}: Bu savaş ikimize de yaramıyor. Barış yapalım mı?`, 'peace', { type: 'peace' });
        n.msgCd = 60;
      }
      // Hami seni istemiyorsa çıkarır (madde 39)
      if (S.player.overlord === id && n.opinion < 22 && Math.random() < 0.3) {
        S.player.overlord = null;
        this.aiSendMessenger(id, `${n.ruler}: Artık seni himayemizde istemiyoruz. Kendi başının çaresine bak!`, 'war');
        this.log(`${n.name} bizi himayesinden çıkardı.`);
      }
      // Vasal isyanı
      if (n.overlord === P && n.opinion < 20 && Math.random() < 0.25) {
        n.overlord = null;
        this.aiSendMessenger(id, `${n.ruler}: Vergini ödemekten bıktık. Himayenden çıkıyoruz!`, 'war');
        this.mapDirty = true;
      }
      // Rastgele mektuplar
      if (n.msgCd <= 0 && Math.random() < 0.25 && S.day > 25) {
        n.msgCd = randi(90, 220);
        const myP = this.playerPower(), theirP = this.nationPower(id);
        const roll = Math.random();
        if (n.status === 'peace' && n.opinion > 60 && roll < 0.3) this.aiSendMessenger(id, `${n.ruler}: Dostluğumuz güçlü. Bir ittifak kurmaya ne dersin?`, 'peace', { type: 'alliance' });
        else if (n.status !== 'ally' && theirP > myP * 2.5 && roll < 0.55 && n.overlord !== P) {
          const amt = Math.round(clamp(S.player.gold * 0.25, 60, 600));
          this.aiSendMessenger(id, `${n.ruler}: Topraklarımıza yakın duruyorsun. Barış istiyorsan ${fmt(amt)} altın haraç gönder!`, 'war', { type: 'tribute', amount: amt });
        }
        else if (roll < 0.75) this.aiSendMessenger(id, `${n.ruler}: Ey ${S.player.ruler}! Yiğitliğini meydanda gösterir misin? Seni meydan savaşına davet ediyorum!`, 'war', { type: 'duel' });
        else if (theirP < myP * 0.35 && n.overlord == null) this.aiSendMessenger(id, `${n.ruler}: Gücüne hayranız. Vergi vermek şartıyla himayene girmek istiyoruz.`, 'peace', { type: 'vassalOffer' });
        else if (theirP > myP * 3 && !S.player.overlord) this.aiSendMessenger(id, `${n.ruler}: Küçük beyliğin bizim himayemizde güvende olur. Vergi karşılığı seni koruyalım mı?`, 'peace', { type: 'protectOffer' });
        else this.aiSendMessenger(id, `${n.ruler}: ${pick(['Kervanların şehrimizde ağırlandı, selamlar.', 'Sınırlarımızda huzur olsun.', 'Komşuluğumuz hayırlı olsun.', 'Ulağımız size bereket dilekleri getirdi.'])}`, 'info');
      }
    });
    // Yapay zekâ kervanları
    if (S.day % 4 === 0) {
      const bigs = S.setts.filter(s => s.big && !s.ruined && s.owner && s.owner !== P && S.nations[s.owner]);
      if (bigs.length > 1 && S.caravans.filter(c => c.owner !== P).length < 10) {
        const a = pick(bigs);
        const b = bigs.filter(x => x !== a).sort((p, q) => dist(a.x, a.y, p.x, p.y) - dist(a.x, a.y, q.x, q.y))[randi(0, 2)] || bigs.find(x => x !== a);
        const r = b && this.path(a.id, b.id);
        if (r) {
          const g = randi(4, 16);
          S.caravans.push({ id: this.id(), owner: a.owner, path: r.path, i: 0, x: a.x, y: a.y, goods: randi(120, 480), guards: { inf: Math.round(g * 0.4), spear: Math.round(g * 0.2), archer: Math.round(g * 0.2), cav: Math.round(g * 0.2) }, home: a.id, dest: b.id, len: r.len });
        }
      }
    }
  }
};

function S_nat(id) { return Game.S.nations[id]; }
