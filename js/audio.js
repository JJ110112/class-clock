/* ══════════════════════════════════
   Audio – Status Transition Sounds
   ══════════════════════════════════ */

const AudioModule = (() => {
  let audioCtx = null;

  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  // Simple tone generator
  function playTone(freq, duration, type = 'sine') {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) { /* audio not available */ }
  }

  function playSequence(notes) {
    let offset = 0;
    notes.forEach(([freq, dur, type]) => {
      setTimeout(() => playTone(freq, dur, type || 'sine'), offset * 1000);
      offset += dur * 0.7;
    });
  }

  const SOUNDS = {
    exam_active: () => playSequence([[880, 0.15], [1047, 0.15], [1319, 0.3]]),
    early_submit: () => playSequence([[660, 0.2], [880, 0.3]]),
    last_5_min: () => playSequence([[440, 0.15], [440, 0.15], [440, 0.15], [880, 0.4]]),
    school_over: () => playSequence([[523, 0.2], [659, 0.2], [784, 0.2], [1047, 0.4]]),
  };

  function play(statusType) {
    if (ExamData.isMuted()) return;
    const fn = SOUNDS[statusType];
    if (fn) fn();
  }

  return { play };
})();
