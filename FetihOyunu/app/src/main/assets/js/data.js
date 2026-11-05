/* ==========================================================
   FETİH — Oyun verileri
   Milletler, şehirler, savunma sistemleri, birlikler, dinler,
   nidalar, kültürel başlıklar, binalar ve kıyafetler.
   ========================================================== */
'use strict';

const MAP_W = 2400, MAP_H = 1300;

/* ---------- Dinler (madde 33) ---------- */
const RELIGIONS = {
  islam:    { name: 'İslam',        cleric: 'İmam',    temple: 'Cami',          robe: '#2f8f5b', bonus: 'Moral (nida) etkisi +%20', cries: ['Allahu Ekber!', 'Allah Allah Allah!', 'Ehadun Ehad!'] },
  hristiyan:{ name: 'Hristiyanlık', cleric: 'Papaz',   temple: 'Kilise',        robe: '#3a3a5a', bonus: 'Din adamı iyileştirmesi +%25', cries: ['Deus Vult!', 'Hurra!'] },
  tengri:   { name: 'Tengricilik',  cleric: 'Kam',     temple: 'Kurgan Mabedi', robe: '#6b8fd6', bonus: 'Atlı hızı +%15', cries: ['Tengri!', 'Hurra!'] },
  budizm:   { name: 'Budizm',       cleric: 'Keşiş',   temple: 'Tapınak',       robe: '#e08a1e', bonus: 'Nüfus artışı +%10', cries: ['Aaaaa!'] },
  hindu:    { name: 'Hinduizm',     cleric: 'Brahman', temple: 'Mandir',        robe: '#d9534f', bonus: 'Vergi +%5', cries: ['Jai!', 'Aaaaa!'] },
  yahudi:   { name: 'Yahudilik',    cleric: 'Haham',   temple: 'Sinagog',       robe: '#2c5aa0', bonus: 'Ticaret kârı +%15', cries: ['Hurra!'] },
  pagan:    { name: 'Paganizm',     cleric: 'Şaman',   temple: 'Kutsal Koru',   robe: '#5c4033', bonus: 'Piyade hasarı +%10', cries: ['Aaaaa!', 'Odin!'] }
};

/* ---------- Nidalar / Tekbir (madde 35, 37) ---------- */
const WAR_CRIES = [
  'Allah Allah Allah!', 'Allahu Ekber!', 'Ehadun Ehad!', 'Hurra!', 'Aaaaa!',
  'Bismillah, ileri!', 'Ya Allah!', 'Deus Vult!', 'Tengri!', 'Ura!', 'Odin!'
];

/* ---------- Kültürler ve kültürel başlıklar (madde 6) ---------- */
const CULTURES = ['Türk', 'Arap', 'Fars', 'Rum', 'Frank', 'İber', 'Slav', 'Moğol', 'Çin', 'Hint', 'Japon', 'Afrika', 'Aztek', 'İnka', 'Viking', 'Latin'];

// Araştırılınca (altınla) askerlerin başlığı olarak seçilebilir. Küçük bonus verir.
const HEADGEARS = {
  yok:     { name: 'Başlıksız',             culture: '-',      cost: 0,   hp: 0,    dmg: 0,    spd: 0,    desc: 'Sade asker.' },
  bork:    { name: 'Börk',                  culture: 'Türk',   cost: 140, hp: 0.04, dmg: 0.06, spd: 0,    desc: 'Disiplinli piyade. Hasar +%6' },
  sivri:   { name: 'Sivri Miğfer',          culture: 'Türk',   cost: 220, hp: 0.10, dmg: 0,    spd: 0,    desc: 'Selçuklu tarzı. Can +%10' },
  sarik:   { name: 'Sarık',                 culture: 'Arap',   cost: 70,  hp: 0.03, dmg: 0.03, spd: 0.03, desc: 'Çöl savaşçısı. Hafif bonuslar' },
  tolga:   { name: 'Tolga',                 culture: 'Fars',   cost: 180, hp: 0.07, dmg: 0.03, spd: 0,    desc: 'Tüylü sorguç. Can +%7' },
  sorguc:  { name: 'Sorguçlu Miğfer',       culture: 'Rum',    cost: 200, hp: 0.08, dmg: 0.02, spd: 0,    desc: 'Bizans muhafız tarzı.' },
  kask:    { name: 'Haçlı Kaskı',           culture: 'Frank',  cost: 260, hp: 0.14, dmg: 0,    spd: -0.05,desc: 'Ağır ama sağlam. Can +%14, hız -%5' },
  kalpak:  { name: 'Kalpak',                culture: 'Moğol',  cost: 150, hp: 0.02, dmg: 0.02, spd: 0.10, desc: 'Bozkır süvarisi. Hız +%10' },
  hasir:   { name: 'Hasır Şapka',           culture: 'Çin',    cost: 50,  hp: 0,    dmg: 0,    spd: 0.06, desc: 'Ucuz ve hafif. Hız +%6' },
  sarikH:  { name: 'Pagri',                 culture: 'Hint',   cost: 90,  hp: 0.04, dmg: 0.04, spd: 0,    desc: 'Racput savaşçısı.' },
  kabuto:  { name: 'Kabuto',                culture: 'Japon',  cost: 280, hp: 0.10, dmg: 0.08, spd: 0,    desc: 'Samuray miğferi. Can+Hasar' },
  viking:  { name: 'Viking Miğferi',        culture: 'Viking', cost: 160, hp: 0.06, dmg: 0.06, spd: 0,    desc: 'Kalkan duvarı ruhu.' },
  tuy:     { name: 'Tüylü Başlık',          culture: 'Aztek',  cost: 110, hp: 0,    dmg: 0.09, spd: 0.02, desc: 'Kartal savaşçısı. Hasar +%9' },
  kurk:    { name: 'Kürk Şapka',            culture: 'Slav',   cost: 80,  hp: 0.06, dmg: 0,    spd: 0,    desc: 'Soğuğa dayanıklı.' }
};

/* ---------- Birlikler (madde 16, 38) ---------- */
const UNITS = {
  inf:    { name: 'Piyade',   icon: '🗡️', cost: 14, hp: 100, dmg: 16, range: 22,  cd: 0.9, speed: 55,  desc: 'Kılıçlı dengeli asker' },
  spear:  { name: 'Mızraklı', icon: '🔱', cost: 12, hp: 95,  dmg: 13, range: 36,  cd: 1.0, speed: 50,  desc: 'Atlılara karşı 2.5 kat hasar' },
  archer: { name: 'Okçu',     icon: '🏹', cost: 16, hp: 70,  dmg: 12, range: 380, cd: 1.8, speed: 50,  desc: 'Uzaktan ok yağdırır' },
  cav:    { name: 'Atlı',     icon: '🐎', cost: 32, hp: 175, dmg: 22, range: 26,  cd: 1.1, speed: 115, desc: 'Hızlı ve güçlü hücum' }
};
const UNIT_KEYS = ['inf', 'spear', 'archer', 'cav'];

const SIEGE = {
  catapult: { name: 'Mancınık',        icon: '🪨', cost: 120, desc: 'Surlara taş atar' },
  tower:    { name: 'Kuşatma Kulesi',  icon: '🗼', cost: 160, desc: 'Surlara yanaşır, askerler surdan geçer' },
  cannon:   { name: 'Top',             icon: '💣', cost: 280, desc: 'Gülle ile surları yıkar (gülle gerekir)' },
  balls:    { name: 'Gülle (10 adet)', icon: '⚫', cost: 40,  desc: 'Toplar için cephane', pack: 10 }
};

const ARMOR_TIERS = [
  { name: 'Zırhsız', mult: 1.00, cost: 0 },
  { name: 'Deri',    mult: 1.20, cost: 150 },
  { name: 'Zincir',  mult: 1.45, cost: 450 },
  { name: 'Plaka',   mult: 1.75, cost: 1100 }
];

/* ---------- Şehir binaları (madde 24, 25) ---------- */
const BUILDINGS = {
  saray:   { name: 'Saray',        icon: '🏰', cost: 0,   cap: 10, unique: true,  desc: 'Yönetim merkezi (yıkılamaz)' },
  ev:      { name: 'Ev',           icon: '🏠', cost: 40,  cap: 10, desc: '+10 kişilik konut' },
  konak:   { name: 'Konak',        icon: '🏘️', cost: 140, cap: 35, desc: '+35 kişilik konut' },
  tarla:   { name: 'Tarla',        icon: '🌾', cost: 60,  growth: 0.12, desc: 'Nüfus artışı +%12' },
  pazar:   { name: 'Pazar',        icon: '🏪', cost: 160, tax: 0.12, desc: 'Vergi geliri +%12' },
  kisla:   { name: 'Kışla',        icon: '⛺', cost: 220, discount: 0.08, desc: 'Asker kuşanma fiyatı -%8' },
  demirci: { name: 'Demirci',      icon: '⚒️', cost: 240, armorDisc: 0.15, desc: 'Zırh araştırması -%15' },
  mabet:   { name: 'Mabet',        icon: '🕌', cost: 260, morale: 0.10, desc: 'Moral +%10, din adamı güçlenir' },
  kule:    { name: 'Gözcü Kulesi', icon: '🗼', cost: 180, towers: 1, vision: 40, desc: 'Kuşatmada +1 ok kulesi, görüş +' },
  sur:     { name: 'Sur Parçası',  icon: '🧱', cost: 130, wall: 0.15, desc: 'Sur dayanıklılığı +%15' },
  kervan:  { name: 'Kervansaray',  icon: '🐪', cost: 220, trade: 0.20, desc: 'Ticaret kârı +%20' },
  hazine:  { name: 'Hazine Odası', icon: '💰', cost: 300, tax: 0.06, loot: 0.15, desc: 'Vergi +%6, ganimet +%15' }
};
const GRID_W = 10, GRID_H = 7;

/* ---------- Savunma sistemleri — her şehrin kendine has (madde 5, 34) ---------- */
const DEFENSES = {
  koy:      { name: 'Ahşap Çit',              walls: [450],               towers: 0, desc: 'Basit bir ahşap çit. Köyler için.', wood: true },
  afyon:    { name: 'Afyon Kalesi – Kaya Sur', walls: [2300],              towers: 3, special: 'rocks',     desc: 'Dev kayanın tepesindeki kale. Surlardan aşağı kaya yuvarlanır; sur çok yüksektir.' },
  istanbul: { name: 'Üçlü Kara Surları',       walls: [1300, 1500, 1800],  towers: 4, special: 'greekfire', desc: 'Üç sıra sur ve Rum ateşi. Ancak toplarla aşılır.' },
  bagdat:   { name: 'Yuvarlak Şehir',          walls: [1400, 1400],        towers: 3, special: 'moat',      desc: 'Çift sur ve derin hendek; hendekteki düşman yavaşlar.' },
  kahire:   { name: 'Kölemen Kalesi',          walls: [1700],              towers: 3, special: 'archers',   desc: 'Surlarda %60 fazla okçu bekler.' },
  paris:    { name: 'Şövalye Garnizonu',       walls: [1500],              towers: 2, special: 'sortie',    desc: 'Ağır şövalyeler kapıdan çıkıp hücum eder.' },
  toledo:   { name: 'Tajo Uçurumu',            walls: [2000],              towers: 2, special: 'rocks',     desc: 'Nehir kıvrımındaki kayalık; kaya düşer.' },
  kiev:     { name: 'Ahşap Kremlin ve Kış',    walls: [1200],              towers: 2, special: 'cold',      desc: 'Dondurucu soğuk saldıranları yavaşlatıp yıpratır.', wood: true },
  karakurum:{ name: 'Bozkır Ordugâhı',         walls: [700],               towers: 1, special: 'horsearch', desc: 'Atlı okçular sur dışına çıkıp vur-kaç yapar.', wood: true },
  pekin:    { name: 'Arbalet Kuleleri',        walls: [1900],              towers: 6, special: 'crossbow',  desc: 'Çok sayıda ve güçlü arbalet kulesi.' },
  delhi:    { name: 'Savaş Filleri',           walls: [1500],              towers: 2, special: 'elephants', desc: 'Kale filleri kapıdan çıkıp ezer geçer.' },
  kyoto:    { name: 'Samuray Kalesi',          walls: [1500],              towers: 3, special: 'samurai',   desc: 'Savunan piyadeler %40 fazla hasar verir.' },
  tenoch:   { name: 'Göl Şehri',               walls: [1100],              towers: 2, special: 'moat',      desc: 'Gölün ortasında; geçitte düşman yavaşlar.' },
  cusco:    { name: 'Taş Teraslar',            walls: [2600],              towers: 2, special: 'rocks',     desc: 'Devasa taş bloklar ve kaya yağmuru.' },
  timbuktu: { name: 'Kerpiç Sur ve Çöl',       walls: [1100],              towers: 2, special: 'heat',      desc: 'Çöl sıcağı saldıranı yıpratır.' },
  uppsala:  { name: 'Kalkan Duvarı',           walls: [1000],              towers: 1, special: 'shieldwall',desc: 'Savunan piyadeler %40 az hasar alır.', wood: true },
  venedik:  { name: 'Kanallar ve Top Kuleleri',walls: [1300],              towers: 3, special: 'canal',     desc: 'Kanallar yavaşlatır, kulelerde top vardır.' },
  semerkant:{ name: 'Gök Kubbe Hisarı',        walls: [1600],              towers: 3, special: 'archers',   desc: 'Okçu ağırlıklı savunma.' },
  roma:     { name: 'Aurelian Surları',        walls: [1400, 1400],        towers: 3, special: 'none',      desc: 'Klasik çift sur.' }
};

/* ---------- Milletler ---------- */
// Hükümdar isimleri kurgusaldır.
const NATIONS = [
  { id: 'afyon',   name: 'Afyon Krallığı',       ruler: 'Kara Murat Bey',   color: '#e8743b', religion: 'islam',     culture: 'Türk',   aggr: 0.4 },
  { id: 'bizans',  name: 'Bizans',               ruler: 'Basileus Leon',     color: '#9b59b6', religion: 'hristiyan', culture: 'Rum',    aggr: 0.3 },
  { id: 'abbasi',  name: 'Abbasi Hilafeti',      ruler: 'Halife Harun',      color: '#2e9e6b', religion: 'islam',     culture: 'Arap',   aggr: 0.3 },
  { id: 'memluk',  name: 'Memlük Sultanlığı',    ruler: 'Sultan Baybars',    color: '#d4ac0d', religion: 'islam',     culture: 'Arap',   aggr: 0.4 },
  { id: 'frank',   name: 'Frank Krallığı',       ruler: 'Kral Karl',         color: '#3b7dd8', religion: 'hristiyan', culture: 'Frank',  aggr: 0.5 },
  { id: 'kastilya',name: 'Kastilya',             ruler: 'Kral Alfonso',      color: '#c0392b', religion: 'hristiyan', culture: 'İber',   aggr: 0.4 },
  { id: 'rus',     name: 'Rus Knezliği',         ruler: 'Knez Igor',         color: '#7f8c8d', religion: 'hristiyan', culture: 'Slav',   aggr: 0.4 },
  { id: 'mogol',   name: 'Moğol Hanlığı',        ruler: 'Han Batu',          color: '#5d6d7e', religion: 'tengri',    culture: 'Moğol',  aggr: 0.8 },
  { id: 'cin',     name: 'Çin İmparatorluğu',    ruler: 'İmparator Zhao',    color: '#e74c3c', religion: 'budizm',    culture: 'Çin',    aggr: 0.2 },
  { id: 'hint',    name: 'Delhi Racalığı',       ruler: 'Raca Prithvi',      color: '#f39c12', religion: 'hindu',     culture: 'Hint',   aggr: 0.3 },
  { id: 'japon',   name: 'Japon Şogunluğu',      ruler: 'Şogun Minamoto',    color: '#ec7fa9', religion: 'budizm',    culture: 'Japon',  aggr: 0.3 },
  { id: 'aztek',   name: 'Aztek İmparatorluğu',  ruler: 'Tlatoani Itzcoatl', color: '#16a085', religion: 'pagan',     culture: 'Aztek',  aggr: 0.5 },
  { id: 'inka',    name: 'İnka İmparatorluğu',   ruler: 'Sapa Pachacuti',    color: '#a0522d', religion: 'pagan',     culture: 'İnka',   aggr: 0.3 },
  { id: 'mali',    name: 'Mali İmparatorluğu',   ruler: 'Mansa Musa',        color: '#b7950b', religion: 'islam',     culture: 'Afrika', aggr: 0.2 },
  { id: 'viking',  name: 'Viking Diyarı',        ruler: 'Jarl Ragnar',       color: '#1f618d', religion: 'pagan',     culture: 'Viking', aggr: 0.7 },
  { id: 'venedik', name: 'Venedik Cumhuriyeti',  ruler: 'Doç Dandolo',       color: '#48c9b0', religion: 'hristiyan', culture: 'Latin',  aggr: 0.2 },
  { id: 'timur',   name: 'Semerkant Hanlığı',    ruler: 'Emir Aksak',        color: '#8e44ad', religion: 'islam',     culture: 'Türk',   aggr: 0.6 }
];

/* ---------- Merkezi şehirler (büyük şehirler, madde 2, 28) ---------- */
// style: harita simgesi tarzı
const CITIES = [
  { id: 'afyonk',   name: 'Afyon Kalesi',   lon: 30.5,  lat: 38.75, nation: 'afyon',   pop: 2400, def: 'afyon',     style: 'rock' },
  { id: 'istanbul', name: 'Kostantiniyye',  lon: 28.97, lat: 41.0,  nation: 'bizans',  pop: 6000, def: 'istanbul',  style: 'dome' },
  { id: 'bagdat',   name: 'Bağdat',         lon: 44.4,  lat: 33.3,  nation: 'abbasi',  pop: 5200, def: 'bagdat',    style: 'dome' },
  { id: 'kahire',   name: 'Kahire',         lon: 31.2,  lat: 30.0,  nation: 'memluk',  pop: 4800, def: 'kahire',    style: 'dome' },
  { id: 'paris',    name: 'Paris',          lon: 2.35,  lat: 48.85, nation: 'frank',   pop: 4200, def: 'paris',     style: 'euro' },
  { id: 'toledo',   name: 'Toledo',         lon: -4.0,  lat: 39.86, nation: 'kastilya',pop: 3000, def: 'toledo',    style: 'euro' },
  { id: 'kiev',     name: 'Kiev',           lon: 30.5,  lat: 50.45, nation: 'rus',     pop: 3200, def: 'kiev',      style: 'onion' },
  { id: 'karakurum',name: 'Karakurum',      lon: 102.8, lat: 47.2,  nation: 'mogol',   pop: 3500, def: 'karakurum', style: 'yurt' },
  { id: 'pekin',    name: 'Pekin',          lon: 116.4, lat: 39.9,  nation: 'cin',     pop: 7000, def: 'pekin',     style: 'pagoda' },
  { id: 'delhi',    name: 'Delhi',          lon: 77.2,  lat: 28.6,  nation: 'hint',    pop: 5500, def: 'delhi',     style: 'dome' },
  { id: 'kyoto',    name: 'Kyoto',          lon: 135.7, lat: 35.0,  nation: 'japon',   pop: 3800, def: 'kyoto',     style: 'pagoda' },
  { id: 'tenoch',   name: 'Tenochtitlan',   lon: -99.1, lat: 19.4,  nation: 'aztek',   pop: 4500, def: 'tenoch',    style: 'pyramid' },
  { id: 'cusco',    name: 'Cusco',          lon: -72.0, lat: -13.5, nation: 'inka',    pop: 3300, def: 'cusco',     style: 'pyramid' },
  { id: 'timbuktu', name: 'Timbuktu',       lon: -3.0,  lat: 16.8,  nation: 'mali',    pop: 3000, def: 'timbuktu',  style: 'mud' },
  { id: 'uppsala',  name: 'Uppsala',        lon: 17.6,  lat: 59.8,  nation: 'viking',  pop: 2200, def: 'uppsala',   style: 'wood' },
  { id: 'venedik',  name: 'Venedik',        lon: 12.3,  lat: 45.4,  nation: 'venedik', pop: 3600, def: 'venedik',   style: 'euro' },
  { id: 'semerkant',name: 'Semerkant',      lon: 66.97, lat: 39.65, nation: 'timur',   pop: 4000, def: 'semerkant', style: 'dome' },
  { id: 'roma',     name: 'Roma',           lon: 12.5,  lat: 41.9,  nation: 'venedik', pop: 2600, def: 'roma',      style: 'euro' }
];

/* ---------- Köyler (tarafsız, başlangıçta) ---------- */
const VILLAGES = [
  ['sogut', 'Söğüt', 30.18, 40.02], ['konya', 'Konya', 32.5, 37.9], ['sivas', 'Sivas', 37.0, 39.75],
  ['trabzon', 'Trabzon', 39.7, 41.0], ['halep', 'Halep', 37.15, 36.2], ['tebriz', 'Tebriz', 46.3, 38.1],
  ['selanik', 'Selanik', 22.9, 40.6], ['kirim', 'Kırım', 34.1, 44.9], ['kazan', 'Kazan', 49.1, 55.8],
  ['buhara', 'Buhara', 64.4, 39.8], ['kabil', 'Kabil', 69.2, 34.5], ['lahor', 'Lahor', 74.3, 31.5],
  ['kasgar', 'Kaşgar', 76.0, 39.5], ['seul', 'Seul', 127.0, 37.5], ['lizbon', 'Lizbon', -9.1, 38.7],
  ['londra', 'Londra', -0.1, 51.5], ['tunus', 'Tunus', 10.2, 36.8], ['fes', 'Fes', -5.0, 34.0],
  ['zanzibar', 'Zanzibar', 39.2, -6.2], ['kongo', 'Kongo', 15.3, -4.3], ['lima', 'Lima', -77.0, -12.0],
  ['quebec', 'Kebek', -71.2, 46.8], ['cahokia', 'Cahokia', -90.1, 38.6], ['sidney', 'Wurundjeri', 145.0, -37.8],
  ['kudus', 'Kudüs', 35.2, 31.8], ['sam', 'Şam', 36.3, 33.5], ['isfahan', 'İsfahan', 51.7, 32.65],
  ['mekke', 'Mekke', 39.8, 21.4], ['kopenhag', 'Kopenhag', 12.6, 55.7], ['krakov', 'Krakov', 19.9, 50.05],
  ['budin', 'Budin', 19.04, 47.5], ['novgorod', 'Novgorod', 31.3, 58.5], ['dakka', 'Dakka', 90.4, 23.8],
  ['hanoi', 'Hanoi', 105.8, 21.0], ['nanking', 'Nanking', 118.8, 32.0], ['sarayk', 'Saraycık', 47.0, 47.0]
];

/* ---------- Kıta şekilleri (boylam, enlem) — basitleştirilmiş dünya ---------- */
const LANDS = [
  // Kuzey Amerika
  [[-165,65],[-160,70],[-140,70],[-125,72],[-95,72],[-80,73],[-65,62],[-55,52],[-65,45],[-70,42],[-76,35],[-81,31],[-80,26],[-82,28],[-85,30],[-90,29],[-97,27],[-97,21],[-90,21],[-87,21],[-88,16],[-83,11],[-79,9],[-82,8],[-86,12],[-92,15],[-105,20],[-110,24],[-112,30],[-117,32],[-120,35],[-124,40],[-124,48],[-130,55],[-140,60],[-150,60],[-158,57],[-165,60]],
  // Grönland
  [[-45,60],[-40,65],[-22,70],[-20,78],[-35,80],[-60,80],[-70,77],[-55,70],[-52,65]],
  // Güney Amerika
  [[-79,9],[-75,11],[-62,11],[-52,5],[-50,0],[-35,-6],[-39,-14],[-41,-22],[-48,-26],[-53,-34],[-58,-38],[-65,-42],[-68,-50],[-70,-55],[-74,-50],[-73,-40],[-71,-30],[-70,-18],[-76,-14],[-81,-6],[-80,0],[-77,4]],
  // Avrasya
  [[-9,43],[-9,37],[-6,36.2],[-2,37],[0,39],[3,42],[6,43],[9,44],[12,42],[16,38],[18,40],[13,45],[19,42],[23,37],[26,40],[27,37],[30,36],[36,36],[35,33],[34,31],[35,28],[39,22],[43,13],[45,13],[52,16],[58,21],[59,23],[56,26],[51,24],[48,30],[52,27],[57,25],[62,25],[67,24],[72,21],[73,16],[77,8],[80,10],[80,15],[86,20],[90,22],[92,21],[94,17],[98,16],[98,8],[101,3],[104,1],[103,6],[100,13],[105,9],[109,12],[108,17],[106,20],[110,21],[117,23],[121,28],[122,31],[119,35],[122,37],[118,38],[122,40],[125,39],[127,35],[129,35],[129,42],[135,43],[140,48],[141,53],[137,54],[143,59],[155,59],[163,60],[170,60],[180,65],[180,70],[160,70],[140,72],[113,74],[100,77],[80,73],[70,73],[60,70],[50,68],[44,68],[40,66],[33,69],[25,71],[15,68],[10,63],[5,62],[6,58],[10,59],[11,56],[10,55],[8,55],[8,54],[4,52],[2,51],[-2,48],[-4,48],[-1,46],[-2,44]],
  // Afrika
  [[-17,21],[-16,28],[-10,30],[-6,35.5],[3,37],[10,37],[11,33],[20,31],[25,32],[32,31],[34,28],[39,18],[43,12],[51,12],[48,5],[40,-3],[40,-15],[35,-24],[33,-28],[27,-34],[19,-35],[16,-28],[12,-17],[13,-6],[9,0],[9,4],[4,6],[-5,5],[-13,8],[-17,14]],
  // Britanya
  [[-5,50],[1,51],[2,53],[0,54],[-2,56],[-2,58],[-5,59],[-6,57],[-5,55],[-3,54],[-4,53],[-5,52]],
  // İrlanda
  [[-10,52],[-6,52],[-6,55],[-8,55],[-10,54]],
  // İzlanda
  [[-24,64],[-14,64],[-14,66],[-22,66.5]],
  // Japonya
  [[130,31],[132,34],[135,33.5],[140,35],[141,38],[142,41],[140,41.5],[139,38],[136,37],[133,35.5],[130,33.5]],
  // Avustralya
  [[114,-22],[114,-34],[118,-35],[123,-34],[129,-32],[135,-35],[139,-37],[146,-39],[150,-37],[153,-28],[153,-25],[146,-19],[145,-15],[142,-11],[141,-17],[136,-12],[131,-11],[126,-14],[122,-18]],
  // Madagaskar
  [[44,-25],[47,-25],[50,-15],[49,-12],[44,-16]],
  // Sumatra
  [[95,5],[98,4],[106,-6],[104,-6],[96,2]],
  // Borneo
  [[109,2],[115,5],[119,5],[118,0],[116,-4],[110,-3]],
  // Sri Lanka
  [[80,6],[82,7],[81,9.5],[79.8,9]],
  // Kıbrıs
  [[32.3,34.6],[34.6,35.6],[33.0,35.3]],
  // Sicilya + Sardinya
  [[12.4,38],[15.6,38.3],[15,37]], [[8.2,39],[9.8,39],[9.6,41],[8.2,41]]
];
const WATERS = [
  // Karadeniz
  [[28,41.2],[28.6,43.5],[29.8,45.3],[31.5,46.8],[34,46],[36.5,45.3],[38.5,47],[40,46],[39.5,44],[41.6,42],[38,40.9],[35,42],[32,41.6],[29.5,41.2]],
  // Hazar
  [[47,45],[50,47],[53,46],[54,40],[53,37],[50,37],[49,40],[47,43]],
  // Baltık
  [[10,54],[14,54],[20,55],[22,58],[28,60],[24,61],[22,65],[25,66],[18,62],[18,59],[16,56],[12,56]],
  // Kızıldeniz
  [[33,28],[35,28],[39,22],[43,13],[42.5,12.5],[38.5,18],[34,26]],
  // Basra
  [[48,30],[51,27],[56,26.5],[56,25],[51,24.5],[48,28]],
  // Ege + Marmara iç deniz detayı
  [[23,37],[26.5,40.4],[27.8,40.5],[27,37.8],[27,37],[24.5,36.5]],
  // Adriyatik
  [[12.5,44.5],[13.5,45.6],[19,41.8],[18.5,40.3],[16,41.5]],
  // Hudson körfezi
  [[-95,60],[-88,56],[-80,52],[-78,58],[-82,63],[-90,64]],
  // Meksika körfezi detayı
  [[-97,27],[-90,29.5],[-84,30],[-82,26],[-87,21.5],[-90,21],[-97,21]]
];

const MOUNTAINS = [
  // [boylam, enlem, boy]
  [10, 46.3, 1.0], [7, 45.8, 0.8], [13, 47, 0.8], [-1, 42.7, 0.7], [43, 42.5, 0.9], [36, 37.5, 0.7], [32, 37, 0.6],
  [84, 29, 1.4], [88, 28, 1.3], [78, 33, 1.2], [72, 37, 1.1], [95, 31, 1.0],
  [-110, 42, 1.0], [-115, 48, 1.0], [-106, 36, 0.8], [-70, -20, 1.1], [-71, -32, 1.1], [-76, -8, 1.0], [-72, -45, 0.8],
  [59, 60, 0.7], [59, 54, 0.7], [7, 32, 0.7], [38, 9, 0.8], [52, 33, 0.7], [102, 30, 0.9], [-102, 20, 0.7]
];
const DESERTS = [
  // [boylam, enlem, yarıçap derece]
  [10, 24, 14], [25, 25, 10], [-2, 22, 10], [45, 23, 10], [105, 42, 9], [55, 31, 6], [130, -25, 12], [20, -24, 6], [-112, 33, 5], [62, 40, 6]
];
const FORESTS = [
  [20, 55, 9], [40, 58, 12], [90, 60, 18], [-80, 50, 14], [-120, 58, 10], [-60, -5, 14], [20, 0, 10], [10, 50, 6], [110, 25, 7], [140, 62, 10]
];

/* ---------- Komutan (çöp adam) kıyafetleri (madde 20) ---------- */
const OUTFIT = {
  helmet: [
    { id: 'yok', name: 'Başlıksız', cost: 0 },
    { id: 'sivri', name: 'Sivri Miğfer', cost: 60, hp: 40 },
    { id: 'sarik', name: 'Sarık', cost: 20 },
    { id: 'bork', name: 'Börk', cost: 40 },
    { id: 'kask', name: 'Şövalye Kaskı', cost: 90, hp: 70 },
    { id: 'tac', name: 'Hükümdar Tacı', cost: 250, hp: 20 },
    { id: 'kalpak', name: 'Kalpak', cost: 30 },
    { id: 'kabuto', name: 'Kabuto', cost: 110, hp: 60 },
    { id: 'viking', name: 'Boynuzlu Miğfer', cost: 70, hp: 40 }
  ],
  armor: [
    { id: 'yok', name: 'Zırhsız', cost: 0 },
    { id: 'deri', name: 'Deri Yelek', cost: 50, hp: 80 },
    { id: 'zincir', name: 'Zincir Zırh', cost: 160, hp: 180 },
    { id: 'plaka', name: 'Plaka Zırh', cost: 380, hp: 320 },
    { id: 'kaftan', name: 'Kaftan', cost: 70, hp: 40 }
  ],
  weapon: [
    { id: 'kilic', name: 'Kılıç', cost: 0, dmg: 0 },
    { id: 'pala', name: 'Pala', cost: 80, dmg: 10 },
    { id: 'balta', name: 'Savaş Baltası', cost: 120, dmg: 18 },
    { id: 'gurz', name: 'Gürz', cost: 140, dmg: 22 },
    { id: 'mizrak', name: 'Mızrak', cost: 90, dmg: 8, reach: 18 },
    { id: 'katana', name: 'Katana', cost: 200, dmg: 26 }
  ],
  shield: [
    { id: 'yok', name: 'Kalkansız', cost: 0 },
    { id: 'yuvarlak', name: 'Yuvarlak Kalkan', cost: 40, hp: 50 },
    { id: 'kalkan', name: 'Uzun Kalkan', cost: 100, hp: 110 }
  ],
  beard: [
    { id: 'yok', name: 'Sakalsız', cost: 0 },
    { id: 'kisa', name: 'Kısa Sakal', cost: 0 },
    { id: 'uzun', name: 'Uzun Sakal', cost: 0 },
    { id: 'biyik', name: 'Pala Bıyık', cost: 0 }
  ]
};
const CAPE_COLORS = ['#c0392b', '#8e44ad', '#2471a3', '#1e8449', '#d4ac0d', '#111111', '#ffffff', '#e67e22', 'none'];
const BODY_COLORS = ['#222222', '#5b3a29', '#1f3a5f', '#4a235a', '#7b241c', '#145a32'];
