/* ==========================================================
   FETİH — Ana döngü
   ========================================================== */
'use strict';

const Main = {
  last: 0, started: false,
  boot() {
    MapView.init(document.getElementById('map'));
    Battle.init(document.getElementById('battle'));
    UI.init();
    UI.startScreen();
    requestAnimationFrame(t => this.loop(t));
    document.addEventListener('visibilitychange', () => { if (document.hidden && Game.S) Game.save(); });
  },
  begin() {
    const S = Game.S;
    SFX.enabled = S.player.settings.sound; Voice.enabled = S.player.settings.voice;
    Game.mapDirty = true;
    const cap = Game.sett(S.player.capital) || Game.mySetts()[0];
    if (cap) MapView.focus(cap.x, cap.y, 2.2);
    this.started = true;
    UI.refreshTop();
  },
  loop(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000 || 0);
    this.last = t;
    try {
      if (this.started) {
        if (Battle.active) { Battle.update(dt); Battle.draw(); }
        else {
          if (!UI.isOpen() || UI.live) Game.update(dt);
          if (Game.pending.length && !UI.promptOpen && !Game.hold) UI.battlePrompt(Game.pending[0]);
          if (Game.gameOver && !UI.isOpen()) UI.gameOver();
          MapView.draw(dt);
          this.topT = (this.topT || 0) - dt;
          if (this.topT <= 0) { this.topT = 0.5; UI.refreshTop(); }
        }
      }
    } catch (e) { console.error(e); }
    requestAnimationFrame(t2 => this.loop(t2));
  }
};
window.addEventListener('load', () => Main.boot());

// Android geri tuşu: açık pencereyi kapat; harita açıksa uygulamadan çık
window.onAndroidBack = () => {
  if (Battle.active) return true;
  if (UI.isOpen() && !UI.lockModal) { UI.close(); return true; }
  if (UI.cardHit) { UI.hideCard(); MapView.selected = null; return true; }
  if (Game.S) Game.save();
  return false;
};
