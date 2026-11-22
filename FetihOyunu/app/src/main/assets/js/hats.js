/* ==========================================================
   FETİH — Kültürel başlıklar kataloğu ve çizimi (madde 6)
   Her başlık mürekkep çizgili, elle çizilmiş tarzda.
   ========================================================== */
'use strict';

// [id, ad, kültür, stil, renk1, renk2, maliyet, bonus{hp,dmg,spd}]
const HAT_LIST = [
  ['fes', 'Osmanlı Fesi', 'Türk', 'fez', '#c0281e', '#1a1a1a', 60, { dmg: 0.04 }],
  ['siyahKalpak', 'Siyah Kalpak', 'Türk', 'kalpak', '#2a2522', '#4a403a', 90, { hp: 0.05 }],
  ['dervis', 'Derviş Tekkesi', 'Türk', 'tallcone', '#f2ead8', '#c9bc9c', 80, { hp: 0.02, dmg: 0.02 }],
  ['turkmen', 'Türkmen Sarığı', 'Türk', 'turban', '#8b5a2b', '#6b431f', 70, { spd: 0.04, tail: 1 }],
  ['arapSarik', 'Arap Sarığı', 'Arap', 'turban', '#2e7d4a', '#1e5a34', 70, { dmg: 0.03, tail: 1 }],
  ['beylik', 'Beylik Sarığı', 'Türk', 'turban', '#f4efe2', '#c0281e', 140, { hp: 0.05, cap: 1, tail: 1 }],
  ['yoruk', 'Yörük Başlığı', 'Türk', 'turban', '#e6cf8f', '#2f6fa8', 60, { spd: 0.04, cap: 1 }],
  ['ahi', 'Ahi Külahı', 'Türk', 'cone', '#d9c49a', '#b59f74', 50, { hp: 0.03 }],
  ['colSarik', 'Çöl Sarığı', 'Arap', 'turban', '#b8382c', '#e2b35a', 80, { spd: 0.05, tail: 1, pattern: 1 }],
  ['akSarik', 'Ak Sarık', 'Arap', 'turban', '#f6f2e8', '#c0281e', 70, { hp: 0.03, band: 1 }],
  ['koyluKepi', 'Köylü Kepi', 'Slav', 'softcap', '#7a5233', '#5a3a22', 20, {}],
  ['hasirSapka', 'Hasır Şapka', 'Latin', 'straw', '#d8b366', '#a8823e', 30, { spd: 0.03 }],
  ['kirgiz', 'Kırgız Kalpağı', 'Moğol', 'kirgiz', '#f4f0e4', '#1a1a1a', 90, { hp: 0.04 }],
  ['alpKulah', 'Alp Külahı', 'Türk', 'cone', '#8c6239', '#6b4a2b', 110, { dmg: 0.05 }],
  ['macar', 'Macar Başlığı', 'Latin', 'turban', '#a32222', '#7a1717', 90, { dmg: 0.03, tail: 1, peak: 1 }],
  ['arapSarik2', 'Bedevi Sarığı', 'Arap', 'turban', '#f6f2e8', '#d8d0bc', 60, { spd: 0.03, tail: 1 }],
  ['avci', 'Avcı Şapkası', 'Frank', 'feathercap', '#3d6b3a', '#f1ece0', 70, { dmg: 0.03 }],
  ['balikci', 'Balıkçı Kepi', 'Viking', 'knitcap', '#b5562a', '#8a3f1e', 30, { hp: 0.02 }],
  ['uzakDogu', 'Uzak Doğu Şapkası', 'Çin', 'asian', '#e2c784', '#a8894a', 50, { spd: 0.06 }],
  ['koreGat', 'Kore Gat', 'Çin', 'widebrim', '#1d1d1d', '#a52a2a', 90, { hp: 0.03, beads: 1 }],
  ['seyyah', 'Seyyah Sarığı', 'Fars', 'turban', '#e6d9b5', '#b8a77c', 60, { spd: 0.04, tail: 1 }],
  ['denizci', 'Denizci Başlığı', 'Latin', 'turban', '#24407a', '#18305e', 60, { hp: 0.03, tail: 1 }],
  ['eskiya', 'Eşkıya Başlığı', 'Türk', 'bandana', '#b02828', '#801c1c', 50, { dmg: 0.05 }],
  ['kazak', 'Kazak Kepi', 'Slav', 'furtrim', '#6b4a2b', '#8a7563', 80, { hp: 0.05 }],
  ['tuareg', 'Tuareg Sarığı', 'Afrika', 'turban', '#d9b97a', '#b39257', 70, { spd: 0.04, tail: 1 }],
  ['iskit', 'İskit Külahı', 'Moğol', 'cone', '#d9c08a', '#b59f74', 80, { spd: 0.04, bend: 1 }],
  ['kizilderili', 'Kızılderili Kuşağı', 'Aztek', 'bandana', '#6b4a2b', '#1a1a1a', 60, { dmg: 0.04, feather: 1 }],
  ['cingene', 'Çingene Yazması', 'Latin', 'bandana', '#c0281e', '#e8b923', 40, { spd: 0.03, coins: 1 }],
  ['gocebe', 'Göçebe Kepi', 'Moğol', 'turban', '#8a8580', '#6a6560', 50, { hp: 0.03 }],
  ['coban', 'Çoban Şapkası', 'İber', 'widebrim', '#6b4a2b', '#4a321d', 40, { hp: 0.02 }],
  ['defne', 'Defne Tacı', 'Latin', 'laurel', '#3f7a32', '#2a5a22', 120, { dmg: 0.06 }],
  ['keffiyeh', 'Bedevi Keffiyeh', 'Arap', 'keffiyeh', '#f4f0e6', '#c0281e', 70, { hp: 0.04 }],
  ['balkan', 'Balkan Başlığı', 'Slav', 'furtrim', '#b02828', '#cfc6b5', 90, { hp: 0.05 }],
  ['levant', 'Levant Sarığı', 'Arap', 'turban', '#f4efe2', '#b02828', 70, { hp: 0.03, band: 1, tail: 1 }],
  ['sahra', 'Sahra Sarığı', 'Afrika', 'turban', '#2a4f8a', '#1c3a6a', 70, { spd: 0.05, tail: 1 }],
  ['tayland', 'Tayland Şapkası', 'Hint', 'asian', '#d9b96f', '#a8894a', 50, { spd: 0.05 }],
  ['mogolKece', 'Moğol Keçesi', 'Moğol', 'turban', '#7a5233', '#5a3a22', 80, { hp: 0.04 }],
  ['hintSarik', 'Hint Sarığı', 'Hint', 'turban', '#f4efe2', '#2e9e8f', 120, { dmg: 0.05, jewel: 1, feather: 1 }],
  ['maya', 'Maya Başlığı', 'Aztek', 'headdress', '#c0281e', '#2e9e6b', 160, { dmg: 0.08 }],
  ['kizilYazma', 'Kızıl Yazma', 'Türk', 'bandana', '#c0281e', '#801c1c', 40, { spd: 0.04, tail: 1 }],
  // Askerî miğferler
  ['sivri', 'Sivri Miğfer', 'Türk', 'spike', '#a9b1b8', '#6b7680', 220, { hp: 0.10 }],
  ['bork', 'Yeniçeri Börkü', 'Türk', 'bork', '#f4efe2', '#d4ac0d', 180, { hp: 0.04, dmg: 0.06 }],
  ['kask', 'Haçlı Kaskı', 'Frank', 'greathelm', '#b9c1c8', '#2a2a2a', 260, { hp: 0.14, spd: -0.05 }],
  ['kabuto', 'Kabuto', 'Japon', 'kabuto', '#2b2b2b', '#e8b923', 280, { hp: 0.10, dmg: 0.08 }],
  ['viking', 'Viking Miğferi', 'Viking', 'viking', '#a9b1b8', '#f4efe2', 160, { hp: 0.06, dmg: 0.06 }],
  ['sorguc', 'Sorguçlu Miğfer', 'Rum', 'plume', '#b9c1c8', '#8e44ad', 200, { hp: 0.08, dmg: 0.02 }]
];

const HEADGEARS = { yok: { name: 'Başlıksız', culture: '-', style: 'none', c1: '#000', c2: '#000', cost: 0, hp: 0, dmg: 0, spd: 0, desc: 'Sade asker.' } };
for (const [id, name, culture, style, c1, c2, cost, b] of HAT_LIST) {
  const parts = [];
  if (b.hp) parts.push(`Can +%${Math.round(b.hp * 100)}`);
  if (b.dmg) parts.push(`Hasar +%${Math.round(b.dmg * 100)}`);
  if (b.spd) parts.push(`Hız ${b.spd > 0 ? '+' : ''}%${Math.round(b.spd * 100)}`);
  HEADGEARS[id] = { name, culture, style, c1, c2, cost, hp: b.hp || 0, dmg: b.dmg || 0, spd: b.spd || 0, opt: b, desc: parts.join(', ') || 'Kültürel görünüm' };
}

// Kültüre göre hazır başlık (yeni oyunda ücretsiz verilir, düşman askerleri de giyer)
const CULTURE_HAT = {
  'Türk': 'fes', 'Arap': 'arapSarik', 'Fars': 'seyyah', 'Rum': 'sorguc', 'Frank': 'kask', 'İber': 'coban',
  'Slav': 'kazak', 'Moğol': 'mogolKece', 'Çin': 'uzakDogu', 'Hint': 'hintSarik', 'Japon': 'kabuto',
  'Afrika': 'tuareg', 'Aztek': 'maya', 'İnka': 'kizilderili', 'Viking': 'viking', 'Latin': 'avci'
};

const Hats = {
  /* Başlığı (0,0) merkezli, yarıçapı ~6.5 olan başın üstüne çizer. */
  draw(x, id, hx, hy, teamColor) {
    const H = HEADGEARS[id];
    if (!H || H.style === 'none') return;
    const ink = '#2b2018', o = H.opt || {}, c1 = H.c1, c2 = H.c2;
    x.save(); x.translate(hx, hy);
    x.strokeStyle = ink; x.lineWidth = 1.3; x.lineJoin = 'round'; x.lineCap = 'round';
    const fs = (f) => { x.fillStyle = f; x.fill(); x.stroke(); };
    switch (H.style) {
      case 'fez':
        x.beginPath(); x.moveTo(-5.2, -3.5); x.lineTo(-4, -12.5); x.lineTo(4, -12.5); x.lineTo(5.2, -3.5); x.closePath(); fs(c1);
        x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(-3.5, -11.5, 1.6, 7);
        x.strokeStyle = c2; x.lineWidth = 1.4; x.beginPath(); x.moveTo(0, -12.5); x.quadraticCurveTo(5, -12, 6, -6); x.stroke();
        x.fillStyle = c2; x.beginPath(); x.ellipse(6, -5.5, 1, 2, 0, 0, 7); x.fill();
        break;
      case 'kalpak':
        x.beginPath(); x.moveTo(-6.8, -3); x.lineTo(-6.5, -13); x.quadraticCurveTo(0, -15.5, 6.5, -13); x.lineTo(6.8, -3); x.closePath(); fs(c1);
        x.strokeStyle = c2; x.lineWidth = 1;
        for (let i = -5; i <= 5; i += 2.5) { x.beginPath(); x.moveTo(i, -12); x.lineTo(i + 1, -9); x.moveTo(i + 1, -7); x.lineTo(i, -4.5); x.stroke(); }
        break;
      case 'tallcone':
        x.beginPath(); x.moveTo(-6, -3); x.quadraticCurveTo(-6, -16, -1, -23); x.quadraticCurveTo(1, -24, 2, -22); x.quadraticCurveTo(6, -14, 6, -3); x.closePath(); fs(c1);
        x.strokeStyle = c2; x.lineWidth = 0.9;
        for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-5 + i * 0.8, -6 - i * 4); x.quadraticCurveTo(0, -4 - i * 4, 5 - i * 0.8, -7 - i * 4); x.stroke(); }
        break;
      case 'turban': {
        if (o.tail) { x.beginPath(); x.moveTo(5, -5); x.quadraticCurveTo(10, 0, 8, 9); x.lineTo(5, 8); x.quadraticCurveTo(7, 1, 3, -3); x.closePath(); fs(c1); }
        if (o.cap) { x.beginPath(); x.moveTo(-3.5, -10); x.quadraticCurveTo(0, -17, 3.5, -10); x.closePath(); fs(c2); }
        if (o.peak) { x.beginPath(); x.moveTo(-6, -8); x.quadraticCurveTo(-2, -18, 6, -14); x.quadraticCurveTo(4, -9, 6, -6); x.closePath(); fs(c1); }
        x.beginPath(); x.ellipse(0, -6.5, 8.5, 5.8, 0, 0, 7); fs(c1);
        x.strokeStyle = c2; x.lineWidth = 1;
        x.beginPath(); x.moveTo(-7.5, -4); x.quadraticCurveTo(0, -11, 7.5, -8); x.stroke();
        x.beginPath(); x.moveTo(-7, -8); x.quadraticCurveTo(1, -3, 7.8, -5); x.stroke();
        if (o.band) { x.strokeStyle = c2; x.lineWidth = 1.8; x.beginPath(); x.moveTo(-8, -4.5); x.quadraticCurveTo(0, -2, 8, -4.5); x.stroke(); }
        if (o.pattern) { x.fillStyle = c2; for (let i = -5; i <= 5; i += 3) { x.beginPath(); x.arc(i, -6 + (i % 2), 0.9, 0, 7); x.fill(); } }
        if (o.jewel) { x.fillStyle = c2; x.beginPath(); x.arc(0, -8, 1.8, 0, 7); x.fill(); x.stroke(); }
        if (o.feather) { x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(2, -15, 1.4, 5, 0.3, 0, 7); x.fill(); }
        x.strokeStyle = ink; x.lineWidth = 1.3; x.beginPath(); x.ellipse(0, -6.5, 8.5, 5.8, 0, 0, 7); x.stroke();
        break;
      }
      case 'cone':
        x.beginPath(); x.moveTo(-7, -3);
        if (o.bend) { x.quadraticCurveTo(-4, -14, 3, -19); x.quadraticCurveTo(2, -12, 7, -3); }
        else { x.quadraticCurveTo(-3, -12, 0, -18); x.quadraticCurveTo(3, -12, 7, -3); }
        x.closePath(); fs(c1);
        x.strokeStyle = c2; x.lineWidth = 0.9; x.beginPath(); x.moveTo(-3, -5); x.lineTo(-1, -13); x.stroke();
        break;
      case 'softcap':
        x.beginPath(); x.moveTo(-7.5, -2.5); x.quadraticCurveTo(-8, -12, 0, -12.5); x.quadraticCurveTo(8, -12, 7.5, -2.5); x.closePath(); fs(c1);
        x.strokeStyle = c2; x.beginPath(); x.moveTo(-7.5, -4.5); x.quadraticCurveTo(0, -2, 7.5, -4.5); x.stroke();
        break;
      case 'straw':
        x.beginPath(); x.ellipse(0, -4, 12, 3.2, 0, 0, 7); fs(c1);
        x.beginPath(); x.moveTo(-6, -4.5); x.quadraticCurveTo(-6, -12, 0, -12); x.quadraticCurveTo(6, -12, 6, -4.5); x.closePath(); fs(c1);
        x.strokeStyle = c2; x.lineWidth = 0.7;
        for (let i = -9; i <= 9; i += 3) { x.beginPath(); x.moveTo(i, -5.5); x.lineTo(i * 1.1, -2.8); x.stroke(); }
        x.beginPath(); x.moveTo(-6, -6.5); x.lineTo(6, -6.5); x.stroke();
        break;
      case 'kirgiz':
        x.beginPath(); x.moveTo(-7, -4); x.quadraticCurveTo(-5, -15, 0, -17); x.quadraticCurveTo(5, -15, 7, -4); x.closePath(); fs(c1);
        x.beginPath(); x.moveTo(-8, -3); x.lineTo(-7.5, -7.5); x.lineTo(-2, -6.5); x.lineTo(-2, -3); x.closePath(); fs(c2);
        x.beginPath(); x.moveTo(8, -3); x.lineTo(7.5, -7.5); x.lineTo(2, -6.5); x.lineTo(2, -3); x.closePath(); fs(c2);
        x.strokeStyle = c2; x.lineWidth = 1; x.beginPath(); x.moveTo(0, -14); x.lineTo(0, -9); x.moveTo(-2, -11.5); x.lineTo(2, -11.5); x.stroke();
        break;
      case 'asian':
        x.beginPath(); x.moveTo(-13, -3); x.lineTo(0, -13); x.lineTo(13, -3); x.quadraticCurveTo(0, -1, -13, -3); x.closePath(); fs(c1);
        x.strokeStyle = c2; x.lineWidth = 0.7;
        for (let i = -10; i <= 10; i += 4) { x.beginPath(); x.moveTo(0, -12.5); x.lineTo(i, -3); x.stroke(); }
        x.strokeStyle = ink; x.beginPath(); x.moveTo(-4, -2); x.lineTo(-3, 5); x.moveTo(4, -2); x.lineTo(3, 5); x.stroke();
        break;
      case 'widebrim':
        x.beginPath(); x.ellipse(0, -5, 13, 3, 0, 0, 7); fs(c1);
        x.beginPath(); x.moveTo(-6, -5); x.lineTo(-5.5, -14); x.quadraticCurveTo(0, -15.5, 5.5, -14); x.lineTo(6, -5); x.closePath(); fs(c1);
        x.strokeStyle = c2; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-5.8, -7.5); x.lineTo(5.8, -7.5); x.stroke();
        if (o.beads) { x.fillStyle = c2; for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(s * 7, -1 + i * 3, 1, 0, 7); x.fill(); } }
        break;
      case 'feathercap':
        x.beginPath(); x.moveTo(-7.5, -3); x.quadraticCurveTo(-7, -12, 1, -12); x.quadraticCurveTo(9, -11, 8, -3); x.closePath(); fs(c1);
        x.fillStyle = c2; x.beginPath(); x.moveTo(4, -10); x.quadraticCurveTo(14, -20, 9, -26); x.quadraticCurveTo(8, -17, 3, -11); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#c9a227'; x.beginPath(); x.arc(4, -9, 1.5, 0, 7); x.fill();
        break;
      case 'knitcap':
        x.beginPath(); x.moveTo(-7, -2.5); x.quadraticCurveTo(-7, -13, 2, -13); x.quadraticCurveTo(10, -12, 9, -4); x.lineTo(7, -2.5); x.closePath(); fs(c1);
        x.beginPath(); x.rect(-7.5, -5, 15, 3); fs(c2);
        x.strokeStyle = c2; x.beginPath(); x.moveTo(8, -9); x.lineTo(11, 0); x.stroke();
        x.fillStyle = c2; x.beginPath(); x.arc(11, 1, 1.6, 0, 7); x.fill();
        break;
      case 'bandana':
        x.beginPath(); x.moveTo(-7, -2); x.quadraticCurveTo(-7.5, -11, 0, -11.5); x.quadraticCurveTo(7.5, -11, 7, -2); x.quadraticCurveTo(0, -5, -7, -2); x.closePath(); fs(c1);
        x.beginPath(); x.moveTo(-6.5, -4); x.lineTo(-11, -1); x.lineTo(-10, 3); x.lineTo(-6, -2); x.closePath(); fs(c2);
        if (o.coins) { x.fillStyle = '#e8b923'; for (let i = -5; i <= 5; i += 2.5) { x.beginPath(); x.arc(i, -3.2, 1.1, 0, 7); x.fill(); } }
        if (o.feather) { x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(4, -15, 1.5, 6, 0.4, 0, 7); x.fill(); x.fillStyle = '#c0281e'; x.beginPath(); x.ellipse(-4, -14, 1.2, 4.5, -0.4, 0, 7); x.fill(); }
        break;
      case 'furtrim':
        x.beginPath(); x.moveTo(-6, -6); x.quadraticCurveTo(-5, -15, 1, -15); x.quadraticCurveTo(6, -14, 6, -6); x.closePath(); fs(c1);
        x.beginPath(); x.ellipse(0, -5, 8.8, 3.6, 0, 0, 7); fs(c2);
        x.strokeStyle = 'rgba(40,30,20,0.6)'; x.lineWidth = 0.8;
        for (let i = -7; i <= 7; i += 2) { x.beginPath(); x.moveTo(i, -7); x.lineTo(i + 0.8, -3); x.stroke(); }
        break;
      case 'laurel':
        x.fillStyle = c1;
        for (let a = -0.4; a <= Math.PI + 0.4; a += 0.42) {
          const lx = Math.cos(a) * -7.2, ly = -4 - Math.sin(a) * 5.5;
          x.beginPath(); x.ellipse(lx, ly, 2.6, 1.3, a + 0.6, 0, 7); x.fill(); x.stroke();
        }
        break;
      case 'keffiyeh':
        x.beginPath(); x.moveTo(-8.5, 9); x.lineTo(-8.5, -5); x.quadraticCurveTo(-8, -13, 0, -13.5); x.quadraticCurveTo(8, -13, 8.5, -5); x.lineTo(8.5, 9); x.lineTo(5.5, 7); x.lineTo(5.5, -3); x.lineTo(-5.5, -3); x.lineTo(-5.5, 7); x.closePath(); fs(c1);
        x.save(); x.clip(); x.strokeStyle = c2; x.lineWidth = 0.7;
        for (let i = -10; i <= 10; i += 2.5) { x.beginPath(); x.moveTo(i, -14); x.lineTo(i, 10); x.stroke(); x.beginPath(); x.moveTo(-10, i); x.lineTo(10, i); x.stroke(); }
        x.restore();
        x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.ellipse(0, -8, 7.5, 2.2, 0, 0, 7); x.stroke();
        break;
      case 'headdress': {
        const cols = ['#c0281e', '#2e9e6b', '#e8b923', '#2a6fb0', '#c0281e', '#2e9e6b', '#e8b923'];
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.32;
          x.fillStyle = cols[i]; x.beginPath(); x.ellipse(Math.cos(a) * 9, -6 + Math.sin(a) * 9, 1.8, 6, a + Math.PI / 2, 0, 7); x.fill(); x.stroke();
        }
        x.beginPath(); x.rect(-7.5, -6.5, 15, 3.5); fs('#e8b923');
        x.fillStyle = c1; for (let i = -5; i <= 5; i += 5) { x.beginPath(); x.arc(i, -4.8, 1.1, 0, 7); x.fill(); }
        break;
      }
      case 'spike':
        x.beginPath(); x.moveTo(-7, -1); x.quadraticCurveTo(-6.5, -9, 0, -16); x.quadraticCurveTo(6.5, -9, 7, -1); x.closePath(); fs(c1);
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(-4.5, -3); x.quadraticCurveTo(-3.5, -9, -0.5, -13); x.lineTo(-2, -4); x.fill();
        x.strokeStyle = c2; x.beginPath(); x.moveTo(0, -3); x.lineTo(0, 4); x.stroke();
        break;
      case 'bork':
        x.beginPath(); x.moveTo(-6, -3); x.lineTo(-4, -18); x.quadraticCurveTo(-12, -15, -13, -4); x.lineTo(6, -3); x.closePath(); fs(c1);
        x.fillStyle = c2; x.fillRect(-6, -6, 12, 3); x.strokeRect(-6, -6, 12, 3);
        break;
      case 'greathelm':
        x.beginPath(); x.rect(-7, -9.5, 14, 14); fs(c1);
        x.fillStyle = c2; x.fillRect(-5, -3.5, 10, 1.6); x.fillRect(-0.6, -3.5, 1.2, 6);
        break;
      case 'kabuto':
        x.beginPath(); x.arc(0, -3, 7.8, Math.PI, 0); x.closePath(); fs(c1);
        x.strokeStyle = c2; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-4, -9); x.lineTo(-9, -17); x.moveTo(4, -9); x.lineTo(9, -17); x.stroke();
        x.strokeStyle = ink; x.lineWidth = 1.3; x.beginPath(); x.moveTo(-9, -2); x.lineTo(9, -2); x.stroke();
        break;
      case 'viking':
        x.beginPath(); x.arc(0, -3, 7.2, Math.PI, 0); x.closePath(); fs(c1);
        for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 7, -5); x.quadraticCurveTo(s * 12, -9, s * 10, -15); x.lineTo(s * 6, -8); x.closePath(); fs(c2); }
        break;
      case 'plume':
        x.beginPath(); x.arc(0, -3, 7.2, Math.PI, 0); x.closePath(); fs(c1);
        x.fillStyle = c2; x.beginPath(); x.moveTo(0, -10); x.quadraticCurveTo(-8, -20, -13, -12); x.quadraticCurveTo(-6, -14, 0, -10); x.fill(); x.stroke();
        break;
    }
    x.restore();
  },

  /* Küçük kart/önizleme: siyah kafalı çöp adam + başlık */
  preview(cv, id) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H);
    x.save(); x.translate(W / 2, H * 0.62); const k = Math.min(W, H) / 30; x.scale(k, k);
    x.strokeStyle = '#1a1410'; x.lineWidth = 2.2; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, 6); x.lineTo(0, 16); x.moveTo(0, 9); x.lineTo(-7, 15); x.moveTo(0, 9); x.lineTo(7, 15); x.stroke();
    x.fillStyle = '#1a1410'; x.beginPath(); x.arc(0, 0, 6.5, 0, 7); x.fill();
    this.draw(x, id, 0, 0);
    x.restore();
  }
};
