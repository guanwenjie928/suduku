const SoundManager = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playDing() {
    this.init();
    const now = this.ctx.currentTime;
    [{ f: 880, t: 0, d: 0.3 }, { f: 1175, t: 0.08, d: 0.4 }].forEach(n => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.frequency.value = n.f; o.type = 'sine';
      g.gain.setValueAtTime(0.3, now + n.t);
      g.gain.exponentialRampToValueAtTime(0.01, now + n.t + n.d);
      o.start(now + n.t); o.stop(now + n.t + n.d);
    });
  },
  playClick() {
    this.init();
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.connect(g); g.connect(this.ctx.destination);
    o.frequency.value = 600; o.type = 'triangle';
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    o.start(now); o.stop(now + 0.05);
  },
  playVictory() {
    this.init();
    const now = this.ctx.currentTime;
    [{ f: 523, t: 0, d: 0.15 }, { f: 659, t: 0.1, d: 0.15 }, { f: 784, t: 0.2, d: 0.15 }, { f: 1047, t: 0.3, d: 0.4 }, { f: 880, t: 0.45, d: 0.15 }, { f: 1047, t: 0.55, d: 0.5 }].forEach(n => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.frequency.value = n.f; o.type = 'sine';
      g.gain.setValueAtTime(0, now + n.t);
      g.gain.linearRampToValueAtTime(0.4, now + n.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.01, now + n.t + n.d);
      o.start(now + n.t); o.stop(now + n.t + n.d);
    });
    [523, 659, 784].forEach(f => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.frequency.value = f; o.type = 'triangle';
      g.gain.setValueAtTime(0.05, now);
      g.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
      o.start(now); o.stop(now + 1.2);
    });
  },
  bgmOscillators: [],
  isPlayingBGM: false,
  bgmInterval: null,
  playBGM() {
    if (this.isPlayingBGM) return;
    this.init();
    this.isPlayingBGM = true;
    const bass = [{ f: 110, t: 0, d: 0.15 }, { f: 110, t: 0.25, d: 0.15 }, { f: 87, t: 0.5, d: 0.2 }, { f: 110, t: 0.75, d: 0.15 }];
    const melody = [220, 207, 196, 220, 196, 185, 174, 185];
    let mi = 0;
    const playPattern = () => {
      if (!this.isPlayingBGM) return;
      const now = this.ctx.currentTime;
      bass.forEach(n => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.frequency.value = n.f; o.type = 'sawtooth';
        g.gain.setValueAtTime(0.08, now + n.t);
        g.gain.exponentialRampToValueAtTime(0.01, now + n.t + n.d);
        o.start(now + n.t); o.stop(now + n.t + n.d);
        this.bgmOscillators.push(o);
      });
      const mo = this.ctx.createOscillator(), mg = this.ctx.createGain();
      mo.connect(mg); mg.connect(this.ctx.destination);
      mo.frequency.value = melody[mi]; mo.type = 'square';
      mg.gain.setValueAtTime(0.04, now);
      mg.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      mo.start(now); mo.stop(now + 0.3);
      this.bgmOscillators.push(mo);
      mi = (mi + 1) % melody.length;
    };
    playPattern();
    this.bgmInterval = setInterval(playPattern, 1000);
  },
  stopBGM() {
    this.isPlayingBGM = false;
    if (this.bgmInterval) { clearInterval(this.bgmInterval); this.bgmInterval = null; }
    this.bgmOscillators.forEach(o => { try { o.stop(); } catch (e) { /* ignore */ } });
    this.bgmOscillators = [];
  },
};

export default SoundManager;
