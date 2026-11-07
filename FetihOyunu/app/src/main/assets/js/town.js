/* ==========================================================
   FETİH — Şehir binalarının mürekkep çizimleri
   (şehir dizaynı ekranı ve haritadaki kendi şehrin)
   ========================================================== */
'use strict';

const Town = {
  ink: '#2b2018',
  // (cx, cy): binanın taban ortası; s: ölçek (≈ 1 → 40px kare); occ: 0..1 doluluk
  draw(x, key, cx, cy, s, occ = 0, religion = 'islam', seed = 1) {
    const I = this.ink;
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = I; x.lineWidth = 1.3;
    const fill = (c) => { x.fillStyle = c; x.fill(); x.stroke(); };
    const house = (hx, hy, w, h, roof = '#b8a07a') => {
      x.beginPath(); x.rect(hx - w / 2, hy - h, w, h); fill('#efe2c4');
      x.beginPath(); x.moveTo(hx - w / 2 - 2, hy - h); x.lineTo(hx, hy - h - h * 0.75); x.lineTo(hx + w / 2 + 2, hy - h); x.closePath(); fill(roof);
      x.lineWidth = 0.6; for (let i = -w / 2 + 3; i < w / 2; i += 3) { x.beginPath(); x.moveTo(hx + i * 0.6, hy - h - 1); x.lineTo(hx + i * 0.25, hy - h - h * 0.6); x.stroke(); }
      x.lineWidth = 1; x.strokeRect(hx - 1.5, hy - h * 0.5, 3, h * 0.5);
      x.strokeRect(hx + w / 4 - 1.5, hy - h * 0.8, 3, 3);
      x.lineWidth = 1.3;
    };
    const person = (px, py, k = 1) => {
      x.save(); x.translate(px, py); x.scale(k, k); x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, -4); x.lineTo(-1.5, 0); x.moveTo(0, -4); x.lineTo(1.5, 0); x.moveTo(0, -4); x.lineTo(0, -8); x.moveTo(-2, -6.5); x.lineTo(2, -6.5); x.stroke();
      x.beginPath(); x.arc(0, -9.5, 1.6, 0, 7); x.fillStyle = '#f6ecd4'; x.fill(); x.stroke();
      x.restore();
    };
    const people = (n, y0) => { for (let i = 0; i < n; i++) person(-12 + i * 6 + ((seed + i) % 2) * 1.5, y0 + ((seed * 7 + i * 3) % 4)); };
    switch (key) {
      case 'saray':
        x.beginPath(); x.rect(-14, -16, 28, 16); fill('#e8d8b4');
        for (let i = -14; i < 14; i += 4) { x.strokeRect(i, -19, 2.5, 3); }
        for (const tx of [-14, 14]) { x.beginPath(); x.rect(tx - 4, -24, 8, 24); fill('#efe2c4'); x.beginPath(); x.moveTo(tx - 5, -24); x.lineTo(tx, -32); x.lineTo(tx + 5, -24); x.closePath(); fill('#c0392b'); }
        x.beginPath(); x.arc(0, -3, 4, Math.PI, 0); x.lineTo(4, 0); x.lineTo(-4, 0); x.closePath(); fill('#7a5434');
        x.beginPath(); x.moveTo(0, -16); x.lineTo(0, -30); x.stroke(); x.beginPath(); x.moveTo(0, -30); x.lineTo(8, -27); x.lineTo(0, -24); fill('#c0392b');
        break;
      case 'ev':
        house(0, -2, 20, 13);
        people(Math.round(occ * 3), 4);
        break;
      case 'konak':
        x.beginPath(); x.rect(-14, -22, 28, 22); fill('#efe2c4');
        x.beginPath(); x.moveTo(-16, -22); x.lineTo(-8, -32); x.lineTo(8, -32); x.lineTo(16, -22); x.closePath(); fill('#a58a62');
        x.lineWidth = 1; for (const wx of [-9, 0, 9]) { x.strokeRect(wx - 2, -18, 4, 4); x.strokeRect(wx - 2, -10, 4, 4); }
        x.beginPath(); x.moveTo(-14, -12); x.lineTo(14, -12); x.stroke();
        people(Math.round(occ * 4), 4);
        break;
      case 'tarla':
        x.save(); x.rotate(-0.06);
        x.beginPath(); x.rect(-17, -16, 34, 22); fill('#e8d29a');
        x.lineWidth = 0.8; for (let i = -14; i < 17; i += 3) { x.beginPath(); x.moveTo(i, -14); x.lineTo(i, 4); x.stroke(); }
        x.restore();
        for (let i = -12; i <= 12; i += 6) { x.lineWidth = 1; x.beginPath(); x.moveTo(i, -16); x.lineTo(i, -22); x.moveTo(i, -20); x.lineTo(i - 2, -23); x.moveTo(i, -20); x.lineTo(i + 2, -23); x.stroke(); }
        break;
      case 'pazar':
        for (const [px, col] of [[-10, '#c0392b'], [10, '#2f6fa8']]) {
          x.beginPath(); x.rect(px - 8, -10, 16, 10); fill('#efe2c4');
          x.beginPath(); x.moveTo(px - 10, -10); x.lineTo(px - 7, -17); x.lineTo(px + 7, -17); x.lineTo(px + 10, -10); x.closePath(); fill(col);
          x.lineWidth = 1; x.strokeStyle = '#fff'; for (let i = -6; i <= 6; i += 4) { x.beginPath(); x.moveTo(px + i, -16); x.lineTo(px + i * 1.2, -11); x.stroke(); } x.strokeStyle = I; x.lineWidth = 1.3;
          x.beginPath(); x.arc(px - 3, -3, 2, 0, 7); fill('#e8b923'); x.beginPath(); x.arc(px + 3, -3, 2, 0, 7); fill('#7a9b4a');
        }
        person(0, 6, 1.1);
        break;
      case 'kisla':
        for (const tx of [-10, 8]) { x.beginPath(); x.moveTo(tx - 9, 0); x.lineTo(tx, -15); x.lineTo(tx + 9, 0); x.closePath(); fill('#efe2c4'); x.beginPath(); x.moveTo(tx, -15); x.lineTo(tx - 2, 0); x.stroke(); }
        x.beginPath(); x.moveTo(-1, -12); x.lineTo(-1, -30); x.stroke(); x.beginPath(); x.moveTo(-1, -30); x.lineTo(10, -27); x.lineTo(-1, -23); x.closePath(); fill('#c0392b');
        x.lineWidth = 1; for (const sx of [-16, 16]) { x.beginPath(); x.moveTo(sx, 4); x.lineTo(sx, -12); x.stroke(); }
        break;
      case 'demirci':
        house(-4, -2, 20, 12, '#8c7556');
        x.beginPath(); x.rect(8, -6, 9, 4); fill('#5b5f63'); x.beginPath(); x.rect(11, -2, 3, 3); fill('#5b5f63');
        x.fillStyle = 'rgba(90,80,70,0.35)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(-8 + i * 3, -24 - i * 5, 3 + i, 0, 7); x.fill(); }
        break;
      case 'mabet':
        if (religion === 'islam') {
          x.beginPath(); x.rect(-12, -12, 22, 12); fill('#efe2c4');
          x.beginPath(); x.arc(-1, -12, 9, Math.PI, 0); fill('#9fb8a0');
          x.beginPath(); x.moveTo(-1, -21); x.lineTo(-1, -25); x.stroke();
          x.beginPath(); x.rect(13, -30, 4, 30); fill('#efe2c4'); x.beginPath(); x.moveTo(12, -30); x.lineTo(15, -37); x.lineTo(18, -30); x.closePath(); fill('#9fb8a0');
        } else if (religion === 'hristiyan' || religion === 'yahudi') {
          house(-4, 0, 22, 14, '#a58a62');
          x.beginPath(); x.rect(8, -28, 7, 28); fill('#efe2c4'); x.beginPath(); x.moveTo(7, -28); x.lineTo(11.5, -36); x.lineTo(16, -28); x.closePath(); fill('#a58a62');
          x.beginPath(); x.moveTo(11.5, -36); x.lineTo(11.5, -42); x.moveTo(9, -40); x.lineTo(14, -40); x.stroke();
        } else {
          for (let i = 0; i < 3; i++) { const w = 26 - i * 7, y = -i * 9; x.beginPath(); x.rect(-w / 2 + 3, y - 7, w - 6, 7); fill('#efe2c4'); x.beginPath(); x.moveTo(-w / 2 - 2, y - 7); x.quadraticCurveTo(0, y - 13, w / 2 + 2, y - 7); x.closePath(); fill('#a5503a'); }
        }
        break;
      case 'kule':
        x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(-7, 2); x.lineTo(-4, -24); x.moveTo(7, 2); x.lineTo(4, -24); x.moveTo(-6, -4); x.lineTo(6, -14); x.moveTo(6, -4); x.lineTo(-6, -14); x.stroke();
        x.beginPath(); x.rect(-7, -32, 14, 8); fill('#c9a877');
        x.beginPath(); x.moveTo(-9, -32); x.lineTo(0, -41); x.lineTo(9, -32); x.closePath(); fill('#a58a62');
        person(0, -24, 0.7);
        break;
      case 'sur':
        x.beginPath(); x.rect(-18, -14, 36, 14); fill('#ddd0b2');
        x.lineWidth = 0.7; for (let yy = -10; yy < 0; yy += 5) { x.beginPath(); x.moveTo(-18, yy); x.lineTo(18, yy); x.stroke(); }
        x.lineWidth = 1.2; for (let i = -18; i < 18; i += 6) { x.beginPath(); x.rect(i, -18, 4, 4); fill('#ddd0b2'); }
        break;
      case 'kervan':
        x.beginPath(); x.rect(-17, -18, 34, 18); fill('#e8d8b4');
        x.beginPath(); x.rect(-10, -13, 20, 10); fill('#d9c49a');
        x.lineWidth = 1; for (const ax of [-12, -4, 4, 12]) { x.beginPath(); x.arc(ax, -15, 2.4, Math.PI, 0); x.stroke(); }
        x.lineWidth = 1.3;
        x.beginPath(); x.ellipse(0, -8, 5, 2.5, 0, 0, 7); fill('#c8a876'); x.beginPath(); x.moveTo(4, -9); x.lineTo(7, -13); x.stroke();
        break;
      case 'hazine':
        x.beginPath(); x.rect(-13, -16, 26, 16); fill('#d9cbb0');
        x.beginPath(); x.moveTo(-15, -16); x.lineTo(0, -24); x.lineTo(15, -16); x.closePath(); fill('#a58a62');
        x.beginPath(); x.rect(-5, -11, 10, 11); fill('#7a5434');
        for (const [ox, oy] of [[-16, 3], [-12, 4], [13, 3]]) { x.beginPath(); x.arc(ox, oy, 2.4, 0, 7); fill('#e8b923'); }
        break;
      default: // boş arazi: çimen tutamları
        x.strokeStyle = 'rgba(43,32,24,0.35)'; x.lineWidth = 0.9;
        for (const [gx, gy] of [[-10, -4], [6, -12], [12, 2], [-4, 6]]) { x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx - 2, gy - 4); x.moveTo(gx, gy); x.lineTo(gx + 2, gy - 5); x.stroke(); }
    }
    x.restore();
  },

  // Haritada kendi köyün/şehrin: binalarına göre ev ev çizilir
  drawSettlementTown(x, s, sx, sy, k) {
    const houses = [];
    s.grid.forEach((b, i) => { if (b && b !== 'saray') houses.push([b, i]); });
    const rel = Game.S.player.religion;
    const maxN = s.big ? 18 : 12;
    const list = houses.slice(0, maxN);
    x.save();
    x.fillStyle = 'rgba(60,40,20,0.18)'; x.beginPath(); x.ellipse(sx, sy + 6 * k, (14 + Math.sqrt(list.length) * 6) * k, (6 + Math.sqrt(list.length) * 2.5) * k, 0, 0, 7); x.fill();
    // Grid düzenine göre konum (gerçek şehir planını küçültülmüş haliyle yansıtır)
    const items = list.map(([b, i]) => ({ b, gx: i % GRID_W - 4, gy: Math.floor(i / GRID_W) - 3 })).sort((p, q) => p.gy - q.gy);
    const sp = 7.5 * k;
    let drewSaray = false;
    for (const it of items) {
      if (!drewSaray && it.gy >= 0) { this.draw(x, 'saray', sx, sy + 2 * k, 0.42 * k, 0, rel); drewSaray = true; }
      this.draw(x, it.b, sx + it.gx * sp, sy + it.gy * sp * 0.75, 0.3 * k, 0.6, rel, it.gx + it.gy);
    }
    if (!drewSaray) this.draw(x, 'saray', sx, sy + 2 * k, 0.42 * k, 0, rel);
    x.restore();
  }
};
