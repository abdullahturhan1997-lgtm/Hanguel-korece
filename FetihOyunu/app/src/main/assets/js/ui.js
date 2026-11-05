/* ==========================================================
   FETİH — Arayüz: paneller, kartlar, menüler
   ========================================================== */
'use strict';

const $ = s => document.querySelector(s);
const UI = {
  cityTab: 'build', buildSel: 'ev', promptOpen: false, cardHit: null, step: 5,

  init() {
    MapView.onTap = (hit, wx, wy) => this.onMapTap(hit, wx, wy);
    Game.onChange = () => this.refreshTop();
    Game.onMail = () => this.refreshTop();
    $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal' && !this.lockModal) this.close(); });
    document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
  },

  /* ================== ÜST ÇUBUK ================== */
  refreshTop() {
    const S = Game.S; if (!S) return;
    const inc = Game.dailyIncome();
    let pop = 0; for (const s of Game.mySetts()) pop += Game.totalPop(s);
    const unread = S.inbox.filter(m => !m.read).length;
    $('#t-gold').innerHTML = `💰 <b>${fmt(S.player.gold)}</b> <small class="${inc.net >= 0 ? 'up' : 'down'}">${inc.net >= 0 ? '+' : ''}${inc.net.toFixed(1)}/gün</small>`;
    $('#t-pop').innerHTML = `👪 <b>${fmt(pop)}</b>`;
    $('#t-day').innerHTML = `📅 ${S.day}. gün`;
    $('#t-pres').innerHTML = `⭐ ${fmt(S.player.prestige)}${S.player.wounded ? ` · 🩹${S.player.wounded}g` : ''}${S.player.overlord ? ` · 🛡️${esc(Game.nation(S.player.overlord).name)}` : ''}`;
    document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +b.dataset.s === S.speed));
    const mb = $('#b-mail .badge'); mb.textContent = unread || ''; mb.style.display = unread ? '' : 'none';
    if (this.cardHit) this.showCard(this.cardHit, true);
    if (this.live && $('#modal').classList.contains('show')) this.live();
  },
  setSpeed(s) { Game.S.speed = s; this.refreshTop(); SFX.click(); },

  /* ================== MODAL ================== */
  open(title, html, wide) {
    const m = $('#modal');
    m.querySelector('.sheet').classList.toggle('wide', !!wide);
    m.querySelector('.sheet-title').innerHTML = title;
    m.querySelector('.sheet-body').innerHTML = html;
    m.classList.add('show');
    this.live = null;
    SFX.click();
  },
  body(html) { $('#modal .sheet-body').innerHTML = html; },
  close() { $('#modal').classList.remove('show'); this.live = null; this.lockModal = false; },
  isOpen() { return $('#modal').classList.contains('show'); },

  /* ================== HARİTA DOKUNMA ================== */
  onMapTap(hit, wx, wy) {
    const sel = MapView.selected;
    const selArmy = sel && sel.type === 'army' ? Game.army(sel.id) : null;
    if (!hit) {
      if (selArmy && selArmy.owner === P) {
        Game.order(selArmy.id, { type: 'point', x: wx, y: wy });
        toast('🚶 Ordu yola çıktı.');
        this.showCard({ type: 'army', id: selArmy.id }, true);
      } else { MapView.selected = null; this.hideCard(); }
      return;
    }
    if (hit.type === 'army') {
      const a = Game.army(hit.id);
      if (a.owner === P) { MapView.selected = hit; this.showCard(hit); return; }
      if (selArmy && selArmy.owner === P) { this.cardHit = hit; this.showCard(hit); return; }
    }
    if (hit.type === 'sett' && !selArmy) MapView.selected = hit;
    this.showCard(hit);
  },

  hideCard() { $('#card').classList.remove('show'); this.cardHit = null; },

  showCard(hit, refresh) {
    const S = Game.S, el = $('#card');
    this.cardHit = hit;
    const sel = MapView.selected;
    const selArmy = sel && sel.type === 'army' ? Game.army(sel.id) : null;
    let h = '';
    if (hit.type === 'sett') {
      const s = Game.sett(hit.id);
      const own = s.owner === P;
      const vis = own || Game.visible(s.x, s.y);
      const D = Game.wallsOf(s);
      const n = Game.nation(s.owner);
      h += `<div class="c-head" style="--c:${s.ruined ? '#888' : Game.ownerColor(s.owner || NEUTRAL)}"><b>${esc(s.name)}</b>${s.big ? ' <span class="tag">Merkezî Şehir</span>' : ' <span class="tag">Köy</span>'}<br><small>${s.ruined ? 'Yıkılmış harabe' : esc(Game.ownerName(s.owner))}${n ? ' · ' + this.statusTag(n) : ''}</small></div>`;
      if (!s.ruined) {
        h += `<div class="c-row">👪 ${vis ? fmt(Game.totalPop(s)) : '?'} · ⚔️ ${vis ? fmt(Game.count(s.garrison)) : '?'} asker</div>`;
        h += `<div class="c-row def">🏰 <b>${esc(D.name)}</b><br><small>${esc(D.desc)} · Sur: ${D.walls.map(fmt).join(' / ')} · Kule: ${D.towers}</small></div>`;
      }
      h += '<div class="c-acts">';
      if (own) h += `<button onclick="UI.city('${s.id}')">🏗️ Yönet</button>`;
      if (selArmy && selArmy.owner === P && !s.ruined) {
        if (own || Game.relation(s.owner) === 'ally') h += `<button onclick="UI.go('${s.id}')">🚶 Buraya git</button>`;
        else {
          h += `<button class="red" onclick="UI.go('${s.id}')">⚔️ Kuşat</button>`;
          h += `<button onclick="UI.go('${s.id}', true)">🔥 Yağmala</button>`;
        }
      }
      if (!own && n && n.alive) h += `<button onclick="UI.nation('${n.id}')">🤝 Diplomasi</button><button onclick="UI.compose('${n.id}')">🏇 Ulak</button>`;
      if (!own && !s.ruined && s.big && Game.mySetts().length && Game.relation(s.owner) !== 'war') h += `<button onclick="UI.caravanTo('${s.id}')">🐪 Kervan</button>`;
      h += '</div>';
    } else if (hit.type === 'army') {
      const a = Game.army(hit.id);
      if (!a) { this.hideCard(); return; }
      const mine = a.owner === P;
      h += `<div class="c-head" style="--c:${a.lentFrom ? Game.ownerColor(a.lentFrom) : Game.ownerColor(a.owner)}"><b>${esc(a.name)}</b><br><small>${esc(Game.ownerName(a.owner))}${a.lentFrom ? ' · ' + esc(Game.ownerName(a.lentFrom)) + ' emrinde verdi' : ''} · ${this.modeName(a)}</small></div>`;
      h += `<div class="c-row">${this.unitLine(a.units, a.siege)}</div>`;
      h += '<div class="c-acts">';
      if (mine) {
        h += `<span class="hint">Haritada bir yere dokun → ordu oraya yürür.</span>`;
        h += `<button onclick="UI.armyMode(${a.id}, 'ambush')" class="${a.mode === 'ambush' ? 'on' : ''}">🌿 Pusu kur</button>`;
        h += `<button onclick="UI.armyMode(${a.id}, 'raid')" class="${a.mode === 'raid' ? 'on' : ''}">🏴 Yol kes</button>`;
        h += `<button onclick="UI.armyMode(${a.id}, 'idle')">✋ Dur</button>`;
        h += `<button onclick="Game.order(${a.id},{type:'home'});UI.showCard(UI.cardHit,true)">🏠 Şehre dön</button>`;
        if (a.lentFrom) h += `<button onclick="Game.returnLent(${a.id});UI.hideCard()">↩️ Geri gönder</button>`;
        else h += `<button onclick="Game.disband(${a.id});UI.hideCard()">🏰 Garnizona kat</button>`;
        const allies = Object.values(S.nations).filter(n => n.alive && n.status === 'ally');
        if (!a.lentFrom && allies.length) h += `<button onclick="UI.giveToAlly(${a.id})">🤝 Müttefiğe devret</button>`;
      } else if (selArmy && selArmy.owner === P) {
        h += `<button class="red" onclick="Game.order(${selArmy.id},{type:'army',id:${a.id}});toast('⚔️ Saldırı emri verildi!');UI.hideCard()">⚔️ Saldır</button>`;
      } else h += '<span class="hint">Saldırmak için önce kendi ordunu seç.</span>';
      h += '</div>';
    } else if (hit.type === 'caravan') {
      const c = S.caravans.find(c => c.id === hit.id);
      if (!c) { this.hideCard(); return; }
      const d = Game.sett(c.dest);
      h += `<div class="c-head" style="--c:${Game.ownerColor(c.owner)}"><b>🐪 ${esc(Game.ownerName(c.owner))} Kervanı</b><br><small>→ ${esc(d ? d.name : '?')} · ${fmt(c.goods)} altınlık mal</small></div>`;
      h += `<div class="c-row">Muhafız: ${this.unitLine(c.guards)}</div>`;
      if (c.owner !== P) h += '<div class="c-acts"><span class="hint">Yol kesmek için ordunu kervanın yoluna koy ve 🏴 Yol kes moduna al.</span></div>';
    }
    el.innerHTML = `<button class="x" onclick="UI.hideCard();MapView.selected=null">✕</button>` + h;
    if (!refresh) el.classList.add('show');
  },
  statusTag(n) {
    const S = Game.S;
    if (n.overlord === P) return '<span class="st vas">Vasalın</span>';
    if (S.player.overlord === n.id) return '<span class="st ally">Hamin</span>';
    return { war: '<span class="st war">Savaş</span>', peace: '<span class="st peace">Barış</span>', ally: '<span class="st ally">Müttefik</span>' }[n.status];
  },
  modeName(a) { return { idle: 'Bekliyor', move: 'Yürüyor', ambush: '🌿 Pusuda', raid: '🏴 Yol kesiyor', return: 'Dönüyor' }[a.mode] || a.mode; },
  unitLine(u, sg) {
    let t = UNIT_KEYS.filter(k => u[k] > 0).map(k => `${UNITS[k].icon}${fmt(u[k])}`).join(' ');
    if (sg) t += ' ' + ['catapult', 'tower', 'cannon'].filter(k => sg[k] > 0).map(k => `${SIEGE[k].icon}${sg[k]}`).join(' ') + (sg.balls ? ` ⚫${sg.balls}` : '');
    return t || '—';
  },
  go(id, plunder) {
    const a = Game.army(MapView.selected.id);
    Game.order(a.id, { type: 'sett', id, plunder });
    toast(plunder ? '🔥 Yağma için yola çıkıldı!' : '🚶 Ordu yola çıktı.');
    MapView.selected = { type: 'army', id: a.id };
    this.showCard(MapView.selected);
  },
  armyMode(id, mode) {
    Game.order(id, { type: 'mode', mode });
    toast(mode === 'ambush' ? '🌿 Askerler pusuya yattı. Yoldan geçen düşmanı basacaklar.' : mode === 'raid' ? '🏴 Yol kesiliyor: geçen kervanlar yağmalanacak.' : '✋ Ordu duruyor.');
    this.showCard({ type: 'army', id }, true);
  },
  giveToAlly(armyId) {
    const allies = Object.values(Game.S.nations).filter(n => n.alive && n.status === 'ally');
    this.open('🤝 Orduyu Müttefiğe Devret', `<p>Askerlerin müttefiğin emir komutasına girer. Müttefiğin seni daha çok sever.</p>` +
      allies.map(n => `<button class="row-btn" onclick="Game.giveArmyToAlly(${armyId},'${n.id}');UI.close();UI.hideCard()"><i class="dot" style="background:${n.color}"></i>${esc(n.name)}</button>`).join(''));
  },

  /* ================== ŞEHİR PANELİ ================== */
  city(id, tab) {
    const s = Game.sett(id); if (!s || s.owner !== P) return;
    this.curCity = id;
    if (tab) this.cityTab = tab;
    this.open(`🏰 ${esc(s.name)}`, '', true);
    this.live = () => { const el = $('.city-sum'), c = Game.sett(this.curCity); if (!c || c.owner !== P) { this.close(); return; } if (el) el.innerHTML = this.citySum(c); };
    this.renderCity();
  },
  renderCity() {
    const s = Game.sett(this.curCity);
    if (!s || s.owner !== P) { this.close(); return; }
    const tabs = [['build', '🏗️ Yapılar'], ['army', '⚔️ Asker Kuşan'], ['form', '🚩 Ordu Çıkar'], ['caravan', '🐪 Kervan'], ['defense', '🏰 Savunma'], ['pop', '👪 Nüfus']];
    let h = `<div class="tabs">${tabs.map(([k, n]) => `<button class="${this.cityTab === k ? 'on' : ''}" onclick="UI.cityTab='${k}';UI.renderCity()">${n}</button>`).join('')}</div>`;
    h += `<div class="city-sum">${this.citySum(s)}</div>`;
    h += this['city_' + this.cityTab](s);
    const body = $('#modal .sheet-body');
    const st = body.scrollTop;
    this.body(h);
    body.scrollTop = st;
    this.paintHats();
  },

  citySum(s) {
    return `👪 ${fmt(Game.totalPop(s))}/${fmt(Game.capacity(s))} · 💰 Hazine ${fmt(Game.S.player.gold)} · vergi ${Game.taxOf(s).toFixed(1)}/gün · ⚔️ ${this.unitLine(s.garrison, s.garrison)}${s.unrest > 5 ? ` · 😠 Huzursuzluk ${Math.round(s.unrest)}` : ''}`;
  },
  city_build(s) {
    // Şehir dizaynı: hangi bina nereye (madde 24) ve nüfusa göre yerleşim (madde 25)
    const tot = Game.totalPop(s), sc = s.scale || 1;
    let houseCap = 0; for (const b of s.grid) if (b && BUILDINGS[b].cap) houseCap += BUILDINGS[b].cap * sc;
    let remain = tot;
    let g = `<div class="grid" style="grid-template-columns:repeat(${GRID_W},1fr)">`;
    s.grid.forEach((b, i) => {
      if (b) {
        const B = BUILDINGS[b];
        let occ = '';
        if (B.cap) {
          const cap = B.cap * sc, n = Math.min(cap, Math.max(0, remain)); remain -= n;
          const dots = Math.round(n / cap * 5);
          occ = `<span class="occ">${'●'.repeat(dots)}${'○'.repeat(5 - dots)}</span>`;
        }
        g += `<button class="tile b-${b}" onclick="UI.tile(${i})" title="${B.name}">${B.icon}${occ}</button>`;
      } else g += `<button class="tile empty" onclick="UI.tile(${i})"></button>`;
    });
    g += '</div>';
    const full = tot >= Game.capacity(s) * 0.98;
    let pal = `<div class="pal">`;
    for (const k in BUILDINGS) {
      if (k === 'saray') continue;
      const B = BUILDINGS[k];
      const name = k === 'mabet' ? RELIGIONS[Game.S.player.religion].temple : B.name;
      pal += `<button class="${this.buildSel === k ? 'on' : ''}" onclick="UI.buildSel='${k}';UI.renderCity()"><span>${B.icon}</span><b>${name}</b><small>💰${B.cost}${sc > 1 && B.cap ? ` · ×${sc} mahalle` : ''}</small><em>${B.desc}</em></button>`;
    }
    pal += `<button class="${this.buildSel === 'yik' ? 'on red' : ''}" onclick="UI.buildSel='yik';UI.renderCity()"><span>🔨</span><b>Yık</b><small>%50 iade</small><em>Binayı kaldır</em></button></div>`;
    return `${full ? '<div class="warn">🏠 Konut yetersiz! Nüfus artmıyor — ev veya konak yap.</div>' : ''}
      <p class="hint">Bir bina seç, sonra boş kareye dokun. ● dolu konut, ○ boş yer. Halkın evlere nüfusa göre yerleşir.</p>${g}${pal}`;
  },
  tile(i) {
    const s = Game.sett(this.curCity);
    const cur = s.grid[i], sel = this.buildSel;
    if (sel === 'yik') {
      if (!cur) return;
      if (cur === 'saray') { toast('Saray yıkılamaz.', 'bad'); return; }
      s.grid[i] = null; Game.earn(Math.floor(BUILDINGS[cur].cost * 0.5), 'tax');
      toast(`🔨 ${BUILDINGS[cur].name} yıkıldı.`);
    } else {
      if (cur) { toast(`Burada ${BUILDINGS[cur].name} var. Önce yık.`, 'bad'); return; }
      const B = BUILDINGS[sel];
      if (!Game.spend(B.cost)) return;
      s.grid[i] = sel; SFX.drum();
      toast(`${B.icon} ${B.name} inşa edildi!`, 'good');
    }
    Game.mapDirty = true;
    this.renderCity(); this.refreshTop();
  },

  city_army(s) {
    // Para ile anında kuşanma (madde 15, 16, 38)
    const disc = Game.bonus(s, 'discount');
    const st = this.step;
    let h = `<div class="steps">Adet: ${[1, 5, 10, 25, 100].map(n => `<button class="${st === n ? 'on' : ''}" onclick="UI.step=${n};UI.renderCity()">${n}</button>`).join('')}</div>`;
    h += `<p class="hint">Asker eğitmek zaman almaz: altınla kuşandırılır ve hemen garnizona katılır. Halktan asker için erkek nüfus gerekir (👨 ${fmt(s.pop.m)}). Paralı asker 2 kat pahalıdır ama nüfus istemez.</p>`;
    h += '<div class="rows">';
    for (const k of UNIT_KEYS) {
      const U = UNITS[k], c = Math.ceil(U.cost * (1 - Math.min(0.4, disc)));
      const tier = Game.S.player.armor[k];
      h += `<div class="urow"><span class="uic">${U.icon}</span><div><b>${U.name}</b> <small>(${fmt(s.garrison[k])} mevcut)</small><br><small>${U.desc} · Zırh: ${ARMOR_TIERS[tier].name}</small></div>
        <button onclick="Game.recruit(Game.sett('${s.id}'),'${k}',${st},false);UI.renderCity();UI.refreshTop()">Kuşan ×${st}<br><small>💰${fmt(c * st)}</small></button>
        <button class="alt" onclick="Game.recruit(Game.sett('${s.id}'),'${k}',${st},true);UI.renderCity();UI.refreshTop()">Paralı ×${st}<br><small>💰${fmt(c * st * 2)}</small></button></div>`;
    }
    h += '</div><h3>Kuşatma Makineleri ve Cephane</h3><div class="rows">';
    for (const k in SIEGE) {
      const G = SIEGE[k];
      h += `<div class="urow"><span class="uic">${G.icon}</span><div><b>${G.name}</b> <small>(${fmt(s.garrison[k] || 0)} mevcut)</small><br><small>${G.desc}</small></div>
        <button onclick="Game.buySiege(Game.sett('${s.id}'),'${k}',1);UI.renderCity();UI.refreshTop()">Al<br><small>💰${G.cost}</small></button></div>`;
    }
    h += '</div><h3>Zırh Araştırması (tüm birlikler)</h3><div class="rows">';
    for (const k of UNIT_KEYS) {
      const tier = Game.S.player.armor[k], c = Game.armorCost(k);
      h += `<div class="urow"><span class="uic">🛡️</span><div><b>${UNITS[k].name}</b><br><small>${ARMOR_TIERS[tier].name} (can ×${ARMOR_TIERS[tier].mult})</small></div>
        ${c != null ? `<button onclick="Game.buyArmor('${k}');UI.renderCity();UI.refreshTop()">→ ${ARMOR_TIERS[tier + 1].name}<br><small>💰${fmt(c)}</small></button>` : '<span class="ok">En iyi zırh ✓</span>'}</div>`;
    }
    h += `</div><h3>Kültürel Asker Başlıkları</h3>${this.headgearList()}`;
    return h;
  },
  headgearList() {
    const p = Game.S.player;
    return '<div class="hg">' + Object.entries(HEADGEARS).map(([k, H]) => {
      const owned = p.headgears.includes(k), on = p.headgear === k;
      return `<button class="${on ? 'on' : ''}" onclick="Game.researchHeadgear('${k}');UI.rerenderHats()"><canvas class="hgc" data-hg="${k}" width="80" height="80"></canvas><b>${H.name}</b><small>${H.culture}</small><em>${H.desc}</em><small>${on ? '✓ Giyiliyor' : owned ? 'Giydir' : '🎓 Araştır 💰' + H.cost}</small></button>`;
    }).join('') + '</div>';
  },
  rerenderHats() {
    if (document.getElementById('char-cv')) this.renderChar(); else { this.renderCity(); this.paintHats(); }
    this.refreshTop();
  },
  paintHats() {
    document.querySelectorAll('canvas.hgc').forEach(c => Hats.preview(c, c.dataset.hg));
  },

  city_form(s) {
    let h = `<p class="hint">Garnizondan bir ordu çıkar. Ordu haritada belirir; ona dokunup hedef seçebilirsin.</p><div class="rows">`;
    for (const k of UNIT_KEYS) h += `<div class="urow"><span class="uic">${UNITS[k].icon}</span><div><b>${UNITS[k].name}</b><br><small>Garnizon: ${fmt(s.garrison[k])}</small></div><input type="number" min="0" max="${s.garrison[k]}" value="${s.garrison[k]}" id="f-${k}"></div>`;
    for (const k of ['catapult', 'tower', 'cannon', 'balls']) if ((s.garrison[k] || 0) > 0) h += `<div class="urow"><span class="uic">${SIEGE[k].icon}</span><div><b>${SIEGE[k].name.replace(' (10 adet)', '')}</b><br><small>Garnizon: ${s.garrison[k]}</small></div><input type="number" min="0" max="${s.garrison[k]}" value="${s.garrison[k]}" id="f-${k}"></div>`;
    h += `</div><button class="big" onclick="UI.doForm('${s.id}')">🚩 Orduyu Çıkar</button>`;
    return h;
  },
  doForm(id) {
    const s = Game.sett(id), u = {}, sg = {};
    for (const k of UNIT_KEYS) u[k] = Math.max(0, parseInt(($('#f-' + k) || {}).value || 0, 10));
    for (const k of ['catapult', 'tower', 'cannon', 'balls']) { const el = $('#f-' + k); sg[k] = el ? Math.max(0, parseInt(el.value || 0, 10)) : 0; }
    const a = Game.formArmy(s, u, sg);
    if (a) { this.close(); MapView.selected = { type: 'army', id: a.id }; MapView.focus(a.x, a.y); this.showCard(MapView.selected); toast('🚩 Ordu hazır! Haritada hedefe dokun.', 'good'); SFX.horn(); }
  },

  city_caravan(s, destId) {
    const S = Game.S;
    const dests = S.setts.filter(x => x.big && !x.ruined && x.owner !== P && Game.relation(x.owner) !== 'war');
    if (!dests.length) return '<p>Ticaret yapılabilecek büyük şehir yok.</p>';
    const sel = destId || this.carDest || dests.sort((a, b) => dist(s.x, s.y, a.x, a.y) - dist(s.x, s.y, b.x, b.y))[0].id;
    this.carDest = sel;
    const r = Game.path(s.id, sel);
    const goods = this.carGoods || 100;
    const tb = Game.bonus(s, 'trade') + (S.player.religion === 'yahudi' ? 0.15 : 0);
    const est = r ? Math.round(goods * (1.3 + r.len / 1400) * (1 + tb)) : 0;
    let h = `<p class="hint">Kervanlar sadece büyük (merkezî) şehirlere gidip satış yapar. Yolda haydutlar ve düşmanlar saldırabilir; savunması sana aittir — muhafız koy!</p>
      <label>Hedef şehir <select onchange="UI.carDest=this.value;UI.renderCity()">${dests.map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)} (${esc(Game.ownerName(d.owner))})</option>`).join('')}</select></label>
      <label>Mal değeri (altın) <input type="number" min="20" step="10" value="${goods}" onchange="UI.carGoods=Math.max(20,+this.value);UI.renderCity()"></label>
      <div class="info">📦 Tahmini satış: <b>💰${fmt(est)}</b> · Yol: ${r ? Math.round(r.len) + ' fersah, ' + r.path.length + ' durak' : 'yok'}</div>
      <h3>Muhafızlar</h3><div class="rows">`;
    for (const k of UNIT_KEYS) h += `<div class="urow"><span class="uic">${UNITS[k].icon}</span><div><b>${UNITS[k].name}</b><br><small>Garnizon: ${fmt(s.garrison[k])}</small></div><input type="number" min="0" max="${s.garrison[k]}" value="0" id="g-${k}"></div>`;
    h += `</div><button class="big" onclick="UI.doCaravan('${s.id}')">🐪 Kervanı Yola Çıkar</button>`;
    return h;
  },
  caravanTo(destId) {
    const from = Game.sett(Game.S.player.capital) || Game.mySetts()[0];
    this.carDest = destId; this.cityTab = 'caravan';
    this.city(from.id);
  },
  doCaravan(id) {
    const s = Game.sett(id), g = {};
    for (const k of UNIT_KEYS) g[k] = Math.max(0, parseInt($('#g-' + k).value || 0, 10));
    if (Game.createCaravan(s, Game.sett(this.carDest), this.carGoods || 100, g)) { this.close(); this.refreshTop(); }
  },

  city_defense(s) {
    const D = Game.wallsOf(s);
    return `<div class="defcard"><h3>🏰 ${esc(D.name)}</h3><p>${esc(D.desc)}</p>
      <div class="info">🧱 Sur katmanları: ${D.walls.map(w => '<b>' + fmt(w) + '</b>').join(' → ')}<br>🗼 Ok kuleleri: <b>${D.towers}</b><br>✨ Özel savunma: <b>${this.specialName(D.special)}</b></div>
      <p class="hint">Bu savunma sistemi artık sana aittir. Düşman bu şehre saldırırsa surlar, kuleler ve özel savunma senin için savaşır. Sur Parçası (+%15 sur) ve Gözcü Kulesi (+1 ok kulesi) inşa ederek güçlendir.</p></div>`;
  },
  specialName(k) {
    return { rocks: 'Kaya yuvarlama', greekfire: 'Rum ateşi', moat: 'Hendek', archers: 'Fazla okçu', sortie: 'Şövalye çıkışı', cold: 'Dondurucu kış', horsearch: 'Atlı okçular', crossbow: 'Arbalet kuleleri', elephants: 'Savaş filleri', samurai: 'Samuray piyadesi', heat: 'Çöl sıcağı', shieldwall: 'Kalkan duvarı', canal: 'Kanallar ve toplar', none: 'Yok' }[k] || 'Yok';
  },

  city_pop(s) {
    const p = s.pop, tot = Game.totalPop(s);
    const bar = (icon, name, v, col) => `<div class="pbar"><span>${icon} ${name}</span><b>${fmt(v)}</b><i><em style="width:${tot ? v / tot * 100 : 0}%;background:${col}"></em></i></div>`;
    return `<div class="pop">${bar('👨', 'Erkek', p.m, '#3b7dd8')}${bar('👩', 'Kadın', p.w, '#e45c8f')}${bar('👴', 'Yaşlı', p.e, '#9b8a6b')}${bar('🧒', 'Çocuk', p.c, '#f0a830')}${p.s > 0.5 ? bar('⛓️', 'Köle', p.s, '#555') : ''}</div>
      <div class="info">Konut: ${fmt(tot)}/${fmt(Game.capacity(s))} · Vergi: 💰${Game.taxOf(s).toFixed(1)}/gün</div>
      <p class="hint">Nüfus sürekli artar: çocuklar büyüyüp erkek/kadın olur, yetişkinler yaşlanır. Tarla artışı hızlandırır; ev ve konak yeni yer açar.</p>`;
  },

  /* ================== ŞEHİRLER / ORDULAR LİSTESİ ================== */
  cities() {
    const list = Game.mySetts();
    this.open('🏰 Şehirlerim', list.map(s => `<button class="row-btn" onclick="UI.city('${s.id}')">${s.big ? '🏰' : '🏡'} <b>${esc(s.name)}</b> <small>👪${fmt(Game.totalPop(s))} · ⚔️${fmt(Game.count(s.garrison))} · 💰${Game.taxOf(s).toFixed(1)}/g</small></button>`).join('') || '<p>Şehrin yok.</p>');
  },
  armies() {
    const list = Game.S.armies.filter(a => a.owner === P);
    this.open('⚔️ Ordularım', (list.map(a => `<button class="row-btn" onclick="UI.close();MapView.selected={type:'army',id:${a.id}};MapView.focus(${a.x},${a.y});UI.showCard(MapView.selected)"><i class="dot" style="background:${a.lentFrom ? Game.ownerColor(a.lentFrom) : Game.S.player.color}"></i><b>${esc(a.name)}</b> <small>${this.unitLine(a.units, a.siege)} · ${this.modeName(a)}</small></button>`).join('') || '<p>Sahada ordun yok. Bir şehrini aç → 🚩 Ordu Çıkar.</p>') +
      `<h3>Kervanlarım</h3>` + (Game.S.caravans.filter(c => c.owner === P).map(c => `<div class="row-btn">🐪 → ${esc(Game.sett(c.dest).name)} <small>${fmt(c.goods)} altın · ${this.unitLine(c.guards)}</small></div>`).join('') || '<p class="hint">Yolda kervan yok.</p>'));
  },

  /* ================== HAZİNE ve NÜFUS (madde 10, 13) ================== */
  treasury() {
    const S = Game.S, inc = Game.dailyIncome(), st = S.player.stats;
    this.open('💰 Devlet Hazinesi', `
      <div class="big-gold">💰 ${fmt(S.player.gold)} altın</div>
      <div class="info">Günlük: vergi <b class="up">+${inc.tax.toFixed(1)}</b>${inc.tribIn ? ` · vasal vergisi <b class="up">+${inc.tribIn.toFixed(1)}</b>` : ''}${inc.tribOut ? ` · hamine vergi <b class="down">-${inc.tribOut.toFixed(1)}</b>` : ''} · asker maaşı <b class="down">-${inc.upkeep.toFixed(1)}</b> → <b>${inc.net >= 0 ? '+' : ''}${inc.net.toFixed(1)}/gün</b></div>
      <h3>Toplam kazanç</h3>
      <div class="stats"><span>🏛️ Vergi<b>${fmt(st.tax)}</b></span><span>⚔️ Ganimet/Yağma<b>${fmt(st.loot)}</b></span><span>🐪 Ticaret<b>${fmt(st.trade)}</b></span><span>👑 Haraç<b>${fmt(st.tribute)}</b></span><span>🪖 Maaş<b>-${fmt(st.upkeep)}</b></span></div>
      <h3>Son gelirler</h3>
      ${S.player.ledger.slice(0, 15).map(l => `<div class="ledger"><span>${l.day}. gün</span> ${esc(l.note)} <b class="${l.amount >= 0 ? 'up' : 'down'}">${l.amount >= 0 ? '+' : ''}${fmt(l.amount)}</b></div>`).join('') || '<p class="hint">Henüz fetih/ticaret geliri yok.</p>'}
      <p class="hint">Tek harcama birimi altındır. Vergi nüfusa göre her gün gelir; fetihler, yağma, yol kesme ve kervanlar hazineyi büyütür.</p>`);
    this.live = () => { $('.big-gold').textContent = `💰 ${fmt(Game.S.player.gold)} altın`; };
  },
  population() {
    const S = Game.S; const t = { m: 0, w: 0, e: 0, c: 0, s: 0 };
    for (const s of Game.mySetts()) for (const k in t) t[k] += s.pop[k];
    const tot = t.m + t.w + t.e + t.c + t.s;
    const render = () => {
      const t = { m: 0, w: 0, e: 0, c: 0, s: 0 };
      for (const s of Game.mySetts()) for (const k in t) t[k] += s.pop[k];
      const tot = t.m + t.w + t.e + t.c + t.s;
      return `<div class="big-gold">👪 ${fmt(tot)} kişi</div><div class="popgrid">
        <div><span>👨</span><b>${fmt(t.m)}</b><small>Erkek</small></div><div><span>👩</span><b>${fmt(t.w)}</b><small>Kadın</small></div>
        <div><span>👴</span><b>${fmt(t.e)}</b><small>Yaşlı</small></div><div><span>🧒</span><b>${fmt(t.c)}</b><small>Çocuk</small></div>
        ${t.s > 0.5 ? `<div><span>⛓️</span><b>${fmt(t.s)}</b><small>Köle</small></div>` : ''}</div>
        ${Game.mySetts().map(s => `<button class="row-btn" onclick="UI.cityTab='pop';UI.city('${s.id}')"><b>${esc(s.name)}</b> <small>👨${fmt(s.pop.m)} 👩${fmt(s.pop.w)} 👴${fmt(s.pop.e)} 🧒${fmt(s.pop.c)}${s.pop.s > 0.5 ? ' ⛓️' + fmt(s.pop.s) : ''} · 🏠${fmt(Game.totalPop(s))}/${fmt(Game.capacity(s))}</small></button>`).join('')}`;
    };
    this.open('👪 Nüfus', render());
    this.live = () => this.body(render());
  },

  /* ================== DİPLOMASİ (madde 11, 12, 22, 39) ================== */
  diplomacy() {
    const S = Game.S;
    const myP = Game.playerPower();
    const list = Object.values(S.nations).filter(n => n.alive).sort((a, b) => (b.status === 'war') - (a.status === 'war') || b.opinion - a.opinion);
    this.open('🤝 Diplomasi', `<div class="info">Senin gücün: <b>${fmt(myP)}</b>${S.player.overlord ? ` · 🛡️ Hamin: <b>${esc(Game.nation(S.player.overlord).name)}</b> <button class="mini" onclick="Game.leaveProtection();UI.diplomacy()">Himayeden çık</button>` : ''}</div>` +
      list.map(n => `<button class="row-btn nrow" onclick="UI.nation('${n.id}')"><i class="dot" style="background:${n.color}"></i><div><b>${esc(n.name)}</b> ${this.statusTag(n)}<br><small>${esc(n.ruler)} · ${RELIGIONS[n.religion].name} · Güç ~${fmt(Game.nationPower(n.id))}</small></div><span class="op" title="Görüş"><i style="width:${n.opinion}%;background:${n.opinion > 60 ? '#5cc05c' : n.opinion > 30 ? '#f0b03c' : '#e0524a'}"></i></span></button>`).join(''));
  },
  nation(id) {
    const S = Game.S, n = S.nations[id];
    const sel = MapView.selected && MapView.selected.type === 'army' ? Game.army(MapView.selected.id) : null;
    const isOverlord = S.player.overlord === id, isVassal = n.overlord === P;
    const btn = (label, fn, cls = '') => `<button class="${cls}" onclick="${fn}">${label}</button>`;
    let acts = '';
    if (n.status === 'war') acts += btn('🕊️ Barış teklif et (100💰 hediye)', `Game.proposePeace('${id}',100);UI.nation('${id}')`);
    else acts += btn('⚔️ Savaş ilan et', `if(confirm('${esc(n.name)} ile savaşa girilsin mi?')){Game.declareWar('${id}');UI.nation('${id}')}`, 'red');
    if (n.status === 'peace') acts += btn('🤝 İttifak teklif et (150💰)', `Game.proposeAlliance('${id}',150);UI.nation('${id}')`);
    if (n.status === 'ally') {
      acts += btn('🪖 Asker iste (emrine verilsin)', `Game.requestTroops('${id}',60);UI.close()`);
      if (sel && sel.owner === P && !sel.lentFrom) acts += btn(`➡️ Seçili ordunu devret (${fmt(Game.count(sel.units))})`, `Game.giveArmyToAlly(${sel.id},'${id}');UI.hideCard();UI.nation('${id}')`);
      acts += btn('💔 İttifakı boz', `Game.breakAlliance('${id}');UI.nation('${id}')`);
    }
    acts += btn('🎁 Hediye gönder (100💰)', `Game.giftGold('${id}',100);UI.nation('${id}')`);
    if (!isOverlord && !S.player.overlord && n.status !== 'war') acts += btn('🛡️ Himayesine gir (ikna: 200💰)', `Game.seekProtection('${id}',200);UI.nation('${id}')`);
    if (isOverlord) acts += btn('🚪 Himayesinden çık', `Game.leaveProtection();UI.nation('${id}')`);
    if (!isVassal && n.overlord == null) acts += btn('👑 Himayeme al (vasal yap)', `Game.demandVassal('${id}',0);UI.nation('${id}')`);
    if (isVassal) acts += btn('🚪 Vasallıktan çıkar', `Game.releaseVassal('${id}');UI.nation('${id}')`);
    acts += btn(`🏟️ Meydan savaşına davet et${sel && sel.owner === P ? ' (seçili ordu)' : ' (başkent garnizonu)'}`, `UI.close();Game.inviteDuel('${id}',${sel && sel.owner === P ? sel.id : 'null'})`);
    acts += btn('🏇 Ulak gönder', `UI.compose('${id}')`);
    const cap = Game.capitalOf(id);
    this.open(`<i class="dot" style="background:${n.color}"></i> ${esc(n.name)}`, `
      <div class="info">👑 <b>${esc(n.ruler)}</b> · ${RELIGIONS[n.religion].name} · ${esc(n.culture)}<br>
      Durum: ${this.statusTag(n)} · Görüş: <b>${Math.round(n.opinion)}</b>/100 · Güç: ~${fmt(Game.nationPower(id))} (sen: ${fmt(Game.playerPower())})<br>
      Şehirler: ${Game.nationSetts(id).map(s => esc(s.name)).join(', ')}</div>
      ${cap ? `<button class="mini" onclick="UI.close();MapView.focus(${cap.x},${cap.y})">📍 Haritada göster</button>` : ''}
      <div class="acts">${acts}</div>
      <p class="hint">Himaye: daha güçlü bir devleti ikna edersen gelirinin %20'sini vergi verirsin, onların askerleri seninle savaşır. İstediğin zaman çıkabilirsin; hamin de seni istemezse çıkarabilir.</p>`);
  },

  /* ================== ULAK / MESAJLAR (madde 36) ================== */
  mail() {
    const S = Game.S;
    S.inbox.forEach(m => m.read = true);
    this.refreshTop();
    this.open('📜 Ulaklar ve Mektuplar', `<button class="big" onclick="UI.compose()">✍️ Yeni mektup yaz</button>` +
      S.inbox.map(m => {
        const n = m.from ? Game.nation(m.from) : null;
        const act = m.action && !m.done ? `<div class="acts"><button onclick="UI.inbox(${m.id},true)">✅ ${m.action.type === 'tribute' ? 'Öde (' + fmt(m.action.amount) + '💰)' : 'Kabul et'}</button><button class="red" onclick="UI.inbox(${m.id},false)">❌ Reddet</button></div>` : '';
        return `<div class="msg ${m.kind}"><div class="mh"><i class="dot" style="background:${n ? n.color : '#c9a35c'}"></i><b>${n ? esc(n.name) : 'Saray Kâtibi'}</b><small>${m.day}. gün</small></div><p>${m.text}</p>${act}</div>`;
      }).join(''));
  },
  inbox(id, ok) {
    const m = Game.S.inbox.find(x => x.id === id);
    Game.inboxAction(m, ok);
    if (Game.pending.length) this.close(); else this.mail();
  },
  compose(to) {
    const S = Game.S;
    const list = Object.values(S.nations).filter(n => n.alive);
    const chips = ['Selam olsun, komşu!', 'Barış yapalım.', 'Seninle ittifak kurmak istiyorum.', 'Ticaret yapalım, kervanlarımızı ağırla.', 'Teslim ol ve himayeme gir!', 'Bana haraç ver!', 'Seni meydanda bekliyorum!'];
    this.open('✍️ Ulak Gönder', `
      <label>Kime <select id="m-to">${list.map(n => `<option value="${n.id}" ${n.id === to ? 'selected' : ''}>${esc(n.ruler)} — ${esc(n.name)}</option>`).join('')}</select></label>
      <label>Mektup <textarea id="m-text" rows="4" placeholder="Mektubunu yaz...">${to ? '' : ''}</textarea></label>
      <div class="chips">${chips.map(c => `<button onclick="$('#m-text').value='${c}'">${c}</button>`).join('')}</div>
      <button class="big" onclick="UI.sendMsg()">🏇 Ulağı Gönder (5💰)</button>
      <p class="hint">Ulak haritada at üstünde yolculuk eder. Hükümdar mektubu okuyup kendi ulağıyla cevap yollar.</p>`);
  },
  sendMsg() {
    const to = $('#m-to').value, text = $('#m-text').value.trim();
    if (!text) { toast('Mektup boş olamaz.', 'bad'); return; }
    if (Game.sendMessenger(to, text)) this.close();
  },

  /* ================== KARAKTER (madde 20, 33, 35, 37) ================== */
  character() {
    this.open('👤 Komutan ve Halk', '', true);
    this.live = null;
    this.renderChar();
  },
  renderChar() {
    const S = Game.S, p = S.player, o = p.outfit;
    let h = `<div class="char"><canvas id="char-cv" width="220" height="260"></canvas><div class="char-opts">`;
    for (const cat of ['helmet', 'armor', 'weapon', 'shield', 'beard']) {
      const title = { helmet: 'Başlık', armor: 'Zırh', weapon: 'Silah', shield: 'Kalkan', beard: 'Sakal' }[cat];
      h += `<h4>${title}</h4><div class="opts">` + OUTFIT[cat].map(it => {
        const owned = p.owned[cat].includes(it.id), on = o[cat] === it.id;
        const stat = it.hp ? ` +${it.hp}❤` : it.dmg ? ` +${it.dmg}⚔` : '';
        return `<button class="${on ? 'on' : ''}" onclick="UI.wear('${cat}','${it.id}')">${it.name}${stat}${owned ? '' : `<small>💰${it.cost}</small>`}</button>`;
      }).join('') + '</div>';
    }
    h += `<h4>Pelerin</h4><div class="sw">${CAPE_COLORS.map(c => `<button class="${o.cape === c ? 'on' : ''}" style="background:${c === 'none' ? 'repeating-linear-gradient(45deg,#fff,#fff 4px,#ccc 4px,#ccc 8px)' : c}" onclick="UI.wear('cape','${c}')"></button>`).join('')}</div>`;
    h += `<h4>Giysi rengi</h4><div class="sw">${BODY_COLORS.map(c => `<button class="${o.body === c ? 'on' : ''}" style="background:${c}" onclick="UI.wear('body','${c}')"></button>`).join('')}</div>`;
    h += `</div></div>`;
    // Din ve nida
    const R = RELIGIONS[p.religion];
    h += `<h3>🕌 Toplumun dini</h3><div class="opts">${Object.entries(RELIGIONS).map(([k, r]) => `<button class="${p.religion === k ? 'on' : ''}" onclick="UI.setReligion('${k}')">${r.name}<small>${r.cleric} · ${r.bonus}</small></button>`).join('')}</div>
      <p class="hint">Ordunda bir <b>${R.cleric}</b> bulunur: yanındaki askerleri savaşta iyileştirir. Din değiştirmek 300💰 (ilk seçim ücretsizdir).</p>
      <h3>📣 Savaş nidası / tekbir</h3><div class="opts">${WAR_CRIES.map(c => `<button class="${!p.customCry && p.cry === c ? 'on' : ''}" onclick="UI.setCry('${c.replace(/'/g, "\\'")}')">${c}</button>`).join('')}</div>
      <label>Kendi nidan <input id="cc" value="${esc(p.customCry || '')}" placeholder="Örn: Ya Allah, Bismillah!" maxlength="40"></label>
      <div class="acts"><button onclick="UI.setCustomCry()">✔️ Kendi nidamı kullan</button><button onclick="Voice.speak(Game.S.player.customCry||Game.S.player.cry,{pitch:0.7})">🔊 Dinle</button></div>
      <h3>🎓 Askerlerin kültürel başlığı</h3>${this.headgearList()}`;
    const body = $('#modal .sheet-body'); const st = body.scrollTop;
    this.body(h); body.scrollTop = st;
    this.live = null;
    this.drawCharPreview();
  },
  drawCharPreview() {
    const cv = $('#char-cv'); if (!cv) return;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    const g = x.createRadialGradient(110, 150, 10, 110, 150, 140); g.addColorStop(0, '#fff8e6'); g.addColorStop(1, '#f1dfb8');
    x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = '#9fcf7f'; x.fillRect(0, 210, cv.width, 50);
    const f = { id: 1, x: 0, y: 0, dir: 1, ph: 0.6, atkT: 0, type: 'cmd', isCmd: true, color: Game.S.player.color, outfit: Game.S.player.outfit, team: 0, armorTier: 0 };
    x.save(); x.translate(110, 222); x.scale(3, 3);
    Battle.drawBody(x, f);
    x.restore();
    const sol = { id: 2, x: 0, y: 0, dir: 1, ph: 2, atkT: 0, type: 'inf', color: Game.S.player.color, hat: Game.S.player.headgear, team: 0, armorTier: Game.S.player.armor.inf };
    x.save(); x.translate(185, 232); x.scale(1.6, 1.6); Battle.drawBody(x, sol); x.restore();
    this.paintHats();
  },
  wear(cat, id) {
    const p = Game.S.player;
    if (cat === 'cape' || cat === 'body') { p.outfit[cat] = id; this.renderChar(); return; }
    if (!p.owned[cat].includes(id)) {
      const it = OUTFIT[cat].find(x => x.id === id);
      if (!Game.spend(it.cost)) return;
      p.owned[cat].push(id);
      toast(`🛍️ ${it.name} satın alındı!`, 'good');
    }
    p.outfit[cat] = id; this.renderChar(); this.refreshTop();
  },
  setReligion(k) {
    const p = Game.S.player;
    if (p.religion === k) return;
    if (p.relChanged && !Game.spend(300)) return;
    p.religion = k; p.relChanged = true;
    toast(`🕌 Toplumun dini artık ${RELIGIONS[k].name}. Ordunda bir ${RELIGIONS[k].cleric} var.`, 'good');
    this.renderChar(); this.refreshTop();
  },
  setCry(c) { const p = Game.S.player; p.cry = c; p.customCry = ''; Voice.speak(c, { pitch: 0.7 }); this.renderChar(); },
  setCustomCry() { const v = $('#cc').value.trim(); if (!v) return; Game.S.player.customCry = v; Voice.speak(v, { pitch: 0.7 }); toast('📣 Nidan kaydedildi!', 'good'); this.renderChar(); },

  /* ================== GÜNLÜK ve AYARLAR ================== */
  journal() {
    this.open('📖 Vakayiname', Game.S.log.map(l => `<div class="ledger"><span>${l.day}. gün</span> ${esc(l.t)}</div>`).join('') || '<p>Henüz kayıt yok.</p>');
  },
  settings() {
    const st = Game.S.player.settings;
    const tg = (k, label) => `<label class="tgl"><input type="checkbox" ${st[k] ? 'checked' : ''} onchange="UI.setOpt('${k}',this.checked)"> ${label}</label>`;
    this.open('⚙️ Ayarlar', `${tg('gore', '🩸 Kan efektleri ve ikiye bölünme')}${tg('sound', '🔊 Ses efektleri')}${tg('voice', '🗣️ Nida ve komut sesleri (konuşma)')}
      <div class="acts"><button onclick="Game.save();toast('💾 Kaydedildi','good')">💾 Kaydet</button><button class="red" onclick="UI.confirmNew()">🆕 Yeni oyun</button></div>
      <h3>Nasıl oynanır?</h3><ul class="help">
      <li>🏡 40 kişilik halkla başlarsın. Şehrini aç → <b>Yapılar</b>: ev yaparak nüfusa yer aç.</li>
      <li>💰 Vergi nüfusa göre her gün gelir. Tek para birimi altındır.</li>
      <li>⚔️ <b>Asker Kuşan</b>: okçu, mızraklı, piyade, atlı anında alınır. Mancınık, kuşatma kulesi, top, gülle ve zırh al.</li>
      <li>🚩 <b>Ordu Çıkar</b> → haritada ordunu seç → hedef şehre dokun → <b>Kuşat</b>.</li>
      <li>🕹️ Savaş kuşbakışıdır: alttan bölük seç (👑 komutan, 1 piyade, 2 okçu, 3 mızraklı, 4 atlı, 5 kuşatma), sahaya dokun → oraya yürürler. İleri / Saldır / Savun / Bekle / Geri Çekil / Formasyon komutlarını ver, 📣 nida at. Tümü seçiliyken Geri Çekil = Ricat!</li>
      <li>🏰 Kuşatmada surları mancınık/topla yık ya da kuşatma kulesiyle aş, sonra sancağı ele geçir.</li>
      <li>🌿 Pusu: ordunu yol üstünde pusuya yatır. 🏴 Yol kes: geçen kervanları yağmala.</li>
      <li>🤝 İttifak kur, müttefikten asker iste, himayeye gir, ulak gönder, meydan savaşına davet et.</li></ul>`);
  },
  setOpt(k, v) {
    Game.S.player.settings[k] = v;
    SFX.enabled = Game.S.player.settings.sound; Voice.enabled = Game.S.player.settings.voice;
  },
  confirmNew() { if (confirm('Mevcut oyun silinecek. Emin misin?')) { Game.wipe(); location.reload(); } },

  /* ================== SAVAŞ İSTEMİ ================== */
  battlePrompt(cfg) {
    this.promptOpen = true;
    const mine = cfg.playerSide === 'att' ? cfg.att : cfg.def, th = cfg.playerSide === 'att' ? cfg.def : cfg.att;
    const side = (s, isMe) => `<div class="bside" style="--c:${Game.ownerColor(s.owner)}"><b>${esc(Game.ownerName(s.owner))}</b><div>${this.unitLine(s.units, s.siege)}</div>${(s.allies || []).map(a => `<div class="ally">+ ${esc(a.label)}: ${this.unitLine(a.units)}</div>`).join('')}${isMe ? `<div class="ally">+ 👤 Komutan ${Game.S.player.wounded ? '(yaralı)' : esc(Game.S.player.ruler)}</div>` : ''}</div>`;
    const D = cfg.defense;
    this.open(`⚔️ ${esc(cfg.title)}`, `
      <div class="bpre">${side(mine, true)}<div class="vs">VS</div>${side(th)}</div>
      ${D ? `<div class="info">🏰 <b>${esc(D.name)}</b> — ${esc(D.desc)}<br>🧱 Surlar: ${D.walls.map(fmt).join(' → ')} · 🗼 Kule: ${D.towers}</div>` : ''}
      ${cfg.ambush ? '<div class="info">🌿 Pusu! Düşman şaşkın ve dağınık.</div>' : ''}
      <div class="acts"><button class="big" onclick="UI.fight(true)">🕹️ Savaşı Yönet</button><button onclick="UI.fight(false)">🎲 Komutanlara Bırak</button></div>
      <p class="hint">Savaşı kendin yönetirsen çöp adam komutanın sahaya iner. Ölürsen yaralanıp şehrine götürülürsün ve ordun geri çekilir.</p>`);
    this.lockModal = true;
  },
  fight(manual) {
    const cfg = Game.pending[0];
    this.close(); this.hideCard();
    if (manual) {
      $('#battle').classList.add('show'); $('#battle-ui').classList.add('show'); $('#hud').classList.add('hide');
      Battle.start(cfg, res => this.afterBattle(cfg, res));
    } else {
      const res = Game.autoResolve(cfg);
      toast(res.winner === cfg.playerSide ? '🏆 Komutanların zafer kazandı!' : '💀 Komutanların yenildi...', res.winner === cfg.playerSide ? 'good' : 'bad');
      this.afterBattle(cfg, res);
    }
  },
  afterBattle(cfg, res) {
    $('#battle').classList.remove('show'); $('#battle-ui').classList.remove('show'); $('#hud').classList.remove('hide');
    Game.pending.shift();
    if (cfg.onDone) cfg.onDone(res);
    const out = Game.applyResult(cfg, res);
    this.promptOpen = false;
    if (out.conquest) this.conquestChoice(out.conquest);
    if (res.playerWounded) toast('🩹 Komutan yaralandı, şehrine götürüldü. Ordu geri çekiliyor!', 'bad');
    this.refreshTop(); Game.save();
  },
  battleOver(won, wounded, retreated, kills, loss, cb) {
    const el = $('#bover');
    el.innerHTML = `<div class="bo-box ${won ? 'win' : 'lose'}"><h1>${won ? '🏆 ZAFER!' : retreated ? '🏳️ RİCAT' : wounded ? '🩹 YARALANDIN' : '💀 YENİLGİ'}</h1>
      <p>${won ? 'Düşman bozguna uğradı!' : retreated ? 'Ordun geri çekildi.' : wounded ? 'Komutan ağır yaralandı ve şehrine götürülüyor. Savaş kaybedildi, ordu geri çekiliyor.' : 'Ordun yenildi.'}</p>
      <div class="stats"><span>⚔️ Öldürülen<b>${fmt(kills)}</b></span><span>💀 Kayıp<b>${fmt(loss)}</b></span></div>
      <button class="big">Devam</button></div>`;
    el.classList.add('show');
    el.querySelector('button').onclick = () => { el.classList.remove('show'); cb(); };
  },

  /* ================== FETİH SEÇİMİ (madde 7, 8, 9) ================== */
  conquestChoice(settId) {
    const s = Game.sett(settId);
    Game.hold = true;
    const tot = Game.totalPop(s);
    this.open(`🚩 ${esc(s.name)} fethedildi!`, `
      <p>Kale zapt edildi. Şehrin <b>${fmt(tot)}</b> kişilik halkına ne yapılacak?</p>
      <div class="choices">
        <button onclick="UI.conquer('${s.id}','annex')"><span>🤝</span><b>Tebaya kat</b><small>Halk sana vergi öder. Huzursuzluk az, ganimet normal.</small></button>
        <button onclick="UI.conquer('${s.id}','enslave')"><span>⛓️</span><b>Köleleştir</b><small>Yetişkinler köle olur: çalışır ama nüfus artmaz. Ganimet ×1.4, itibar -8.</small></button>
        <button onclick="UI.conquer('${s.id}','massacre')"><span>🗡️</span><b>Katlet</b><small>Halkın çoğu yok edilir. Ganimet ×2, tüm devletler senden nefret eder (-18).</small></button>
        <button class="red" onclick="UI.conquer('${s.id}','raze')"><span>🔥</span><b>Yerle bir et</b><small>Şehir haritadan silinir, harabe kalır. Ganimet ×2.6, itibar -25.</small></button>
      </div>`);
    this.lockModal = true;
  },
  conquer(id, choice) {
    Game.conquer(id, P, choice);
    const s = Game.sett(id);
    // Kuşatan ordu şehre yerleşir
    for (const a of [...Game.S.armies]) if (a.owner === P && !a.lentFrom && dist(a.x, a.y, s.x, s.y) < 30 && !s.ruined) Game.disband(a.id, true);
    for (const a of Game.S.armies) if (a.owner === P && s.ruined && dist(a.x, a.y, s.x, s.y) < 30) Game.order(a.id, { type: 'home' });
    Game.hold = false;
    this.close(); this.refreshTop();
    if (Game.gameOver) this.gameOver();
  },
  gameOver() {
    this.open('💀 Devletin Yıkıldı', `<p>Son şehrin de düştü. ${esc(Game.S.player.name)} tarihe karıştı...</p><button class="big" onclick="Game.wipe();location.reload()">🆕 Yeni oyun</button>`);
    this.lockModal = true;
  },

  /* ================== BAŞLANGIÇ EKRANI ================== */
  startScreen() {
    const el = $('#start');
    const colors = ['#e84a5f', '#2a9d8f', '#f4a261', '#6a4c93', '#1d3557', '#ff6b9a', '#3a86ff', '#8ac926'];
    const vil = VILLAGES.map(v => v);
    el.innerHTML = `<div class="st-box">
      <h1 class="logo">⚔️ FETİH</h1><p class="sub">Sevimli bir dünyada beylikten cihan devletine</p>
      ${Game.hasSave() ? '<button class="big" id="st-cont">▶️ Devam Et</button><div class="or">— ya da —</div>' : ''}
      <div class="form">
        <label>Devletinin adı <input id="st-realm" value="Kayı Beyliği" maxlength="28"></label>
        <label>Hükümdarın adı <input id="st-ruler" value="Osman Bey" maxlength="24"></label>
        <label>Başlangıç köyü <select id="st-start">${vil.map(v => `<option value="${v[0]}" ${v[0] === 'sogut' ? 'selected' : ''}>${v[1]}</option>`).join('')}</select></label>
        <label>Din <select id="st-rel">${Object.entries(RELIGIONS).map(([k, r]) => `<option value="${k}">${r.name}</option>`).join('')}</select></label>
        <label>Kültür <select id="st-cul">${CULTURES.map(c => `<option>${c}</option>`).join('')}</select></label>
        <label>Savaş nidası <select id="st-cry">${WAR_CRIES.map(c => `<option>${c}</option>`).join('')}</select></label>
        <div class="sw" id="st-col">${colors.map((c, i) => `<button data-c="${c}" class="${i === 0 ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
      </div>
      <button class="big" id="st-new">🏡 Yeni Oyuna Başla</button>
      <p class="hint">Her oyuncu 40 kişilik bir halkla başlar.</p></div>`;
    el.classList.add('show');
    let color = colors[0];
    el.querySelectorAll('#st-col button').forEach(b => b.onclick = () => { color = b.dataset.c; el.querySelectorAll('#st-col button').forEach(x => x.classList.toggle('on', x === b)); });
    const go = () => { el.classList.remove('show'); Main.begin(); };
    if ($('#st-cont')) $('#st-cont').onclick = () => { if (Game.load()) go(); else toast('Kayıt okunamadı.', 'bad'); };
    $('#st-new').onclick = () => {
      Game.newGame({ realm: $('#st-realm').value.trim(), ruler: $('#st-ruler').value.trim(), start: $('#st-start').value, religion: $('#st-rel').value, culture: $('#st-cul').value, cry: $('#st-cry').value, color });
      go();
    };
  }
};
