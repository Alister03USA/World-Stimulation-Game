// A small pooled soundscape inspired by Abyssal Garden's procedural Web Audio approach.
export function makeAudio() {
  let context, master, filter, landGain, seaGain, muted = false;
  function start() {
    if (!context) {
      context = new AudioContext(); master = context.createGain(); master.gain.value = .12; master.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate), values = buffer.getChannelData(0);
      let brown = 0; for (let i = 0; i < values.length; i++) { brown = (brown + (Math.random() * 2 - 1) * .025) / 1.02; values[i] = brown * 3; }
      const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 680;
      seaGain = context.createGain(); seaGain.gain.value = .3; noise.connect(filter); filter.connect(seaGain); seaGain.connect(master); noise.start();
      landGain = context.createGain(); landGain.gain.value = .035; landGain.connect(master);
      for (const f of [73.42, 110, 146.83]) { const o = context.createOscillator(); o.frequency.value = f; o.connect(landGain); o.start(); }
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  }
  function update(underwater, coastal, paused) {
    if (!context) return;
    const t = context.currentTime;
    master.gain.setTargetAtTime(muted || paused ? 0 : .12, t, .25);
    filter.frequency.setTargetAtTime(underwater ? 180 : 600, t, .3);
    seaGain.gain.setTargetAtTime(underwater ? .8 : coastal ? .55 : .12, t, .3);
  }
  return { start, update, toggle() { muted = !muted; return muted; }, get muted() { return muted; } };
}
