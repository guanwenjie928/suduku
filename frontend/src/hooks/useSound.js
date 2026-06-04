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
  playCountdownBeep() {
    this.init();
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.connect(g); g.connect(this.ctx.destination);
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    o.start(now); o.stop(now + 0.15);
  },
  playGo() {
    this.init();
    const now = this.ctx.currentTime;
    // 上行滑音 440→880Hz，带和声
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.connect(g); g.connect(this.ctx.destination);
    o.frequency.setValueAtTime(440, now);
    o.frequency.linearRampToValueAtTime(880, now + 0.3);
    o.type = 'sawtooth';
    g.gain.setValueAtTime(0.15, now);
    g.gain.linearRampToValueAtTime(0.3, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    o.start(now); o.stop(now + 0.5);
    // 高八度和声
    const o2 = this.ctx.createOscillator(), g2 = this.ctx.createGain();
    o2.connect(g2); g2.connect(this.ctx.destination);
    o2.frequency.setValueAtTime(880, now + 0.05);
    o2.type = 'square';
    g2.gain.setValueAtTime(0.06, now + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    o2.start(now + 0.05); o2.stop(now + 0.5);
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

  // ── 紧张背景音乐（竞技模式专用）──
  tenseBgmOscillators: [],
  isPlayingTenseBGM: false,
  tenseBgmInterval: null,
  playTenseBGM() {
    if (this.isPlayingTenseBGM) return;
    this.init();
    this.isPlayingTenseBGM = true;
    // 清理旧振荡器，防止内存泄漏
    this.tenseBgmOscillators.forEach(o => { try { o.stop(); } catch (e) { /* ignore */ } });
    this.tenseBgmOscillators = [];
    // 低沉持续的 bass 线 + 紧张高音点缀
    const bassNotes = [
      { f: 82, t: 0, d: 0.4 },
      { f: 82, t: 0.5, d: 0.4 },
      { f: 98, t: 1.0, d: 0.3 },
      { f: 82, t: 1.5, d: 0.4 },
    ];
    const highNotes = [330, 311, 294, 277, 294, 311, 330, 349];
    let hi = 0;
    const playPattern = () => {
      if (!this.isPlayingTenseBGM) return;
      const now = this.ctx.currentTime;
      // 低沉 bass
      bassNotes.forEach(n => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.frequency.value = n.f; o.type = 'sawtooth';
        g.gain.setValueAtTime(0.06, now + n.t);
        g.gain.exponentialRampToValueAtTime(0.01, now + n.t + n.d);
        o.start(now + n.t); o.stop(now + n.t + n.d);
        this.tenseBgmOscillators.push(o);
      });
      // 紧张高音点缀（短促）
      const ho = this.ctx.createOscillator(), hg = this.ctx.createGain();
      ho.connect(hg); hg.connect(this.ctx.destination);
      ho.frequency.value = highNotes[hi]; ho.type = 'square';
      hg.gain.setValueAtTime(0.03, now);
      hg.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      ho.start(now); ho.stop(now + 0.15);
      this.tenseBgmOscillators.push(ho);
      hi = (hi + 1) % highNotes.length;
    };
    playPattern();
    this.tenseBgmInterval = setInterval(playPattern, 2000);
  },
  stopTenseBGM() {
    this.isPlayingTenseBGM = false;
    if (this.tenseBgmInterval) { clearInterval(this.tenseBgmInterval); this.tenseBgmInterval = null; }
    this.tenseBgmOscillators.forEach(o => { try { o.stop(); } catch (e) { /* ignore */ } });
    this.tenseBgmOscillators = [];
  },

  // ── 计时结束警报音效（教师大屏专用）──
  playTimerEnd() {
    this.init();
    const now = this.ctx.currentTime;
    // 警报喇叭声：交替高低频，持续 2 秒
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.5;
      const freq = i % 2 === 0 ? 440 : 587;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.frequency.value = freq; o.type = 'sawtooth';
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      o.start(t); o.stop(t + 0.4);
    }
    // 结尾低音重击
    const bo = this.ctx.createOscillator(), bg = this.ctx.createGain();
    bo.connect(bg); bg.connect(this.ctx.destination);
    bo.frequency.value = 55; bo.type = 'sine';
    bg.gain.setValueAtTime(0, now + 2.0);
    bg.gain.linearRampToValueAtTime(0.5, now + 2.02);
    bg.gain.exponentialRampToValueAtTime(0.01, now + 3.0);
    bo.start(now + 2.0); bo.stop(now + 3.0);
  },
};

export default SoundManager;
