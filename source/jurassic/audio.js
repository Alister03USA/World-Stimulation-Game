// A small pooled soundscape inspired by Abyssal Garden's procedural Web Audio approach.
export function makeAudio() {
  let context, master, filter, landGain, seaGain, fireGain, rainGain, windGain, muted = false;
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
      const crackle = context.createBuffer(1, context.sampleRate * 3, context.sampleRate), samples = crackle.getChannelData(0);
      let tail = 0; for (let i = 0; i < samples.length; i++) { if (Math.random() < .0014) tail = Math.random(); tail *= .975; samples[i] = (Math.random() * 2 - 1) * (.06 + tail * .75); }
      const fire = context.createBufferSource(); fire.buffer = crackle; fire.loop = true; fireGain = context.createGain(); fireGain.gain.value = 0; fire.connect(fireGain); fireGain.connect(master); fire.start();
      const rainBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate), drops = rainBuffer.getChannelData(0);
      for (let i = 0; i < drops.length; i++) drops[i] = (Math.random() * 2 - 1) * .65;
      const rain = context.createBufferSource(); rain.buffer = rainBuffer; rain.loop = true;
      const rainFilter = context.createBiquadFilter(); rainFilter.type = 'lowpass'; rainFilter.frequency.value = 3200;
      rainGain = context.createGain(); rainGain.gain.value = 0; rain.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(master); rain.start();
      const wind = context.createBiquadFilter(); wind.type = 'lowpass'; wind.frequency.value = 420;
      windGain = context.createGain(); windGain.gain.value = 0; noise.connect(wind); wind.connect(windGain); windGain.connect(master);
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  }
  function update(underwater, coastal, paused, fireVolume = 0, weather = null, exposure = 1) {
    if (!context) return;
    const t = context.currentTime;
    master.gain.setTargetAtTime(muted || paused ? 0 : .12, t, .25);
    filter.frequency.setTargetAtTime(underwater ? 180 : 600, t, .3);
    seaGain.gain.setTargetAtTime(underwater ? .8 : coastal ? .55 : .12, t, .3);
    fireGain.gain.setTargetAtTime(underwater ? 0 : Math.max(0, Math.min(1, fireVolume)) * .55, t, .2);
    rainGain.gain.setTargetAtTime(underwater ? 0 : (weather?.rain || 0) * (exposure ? .48 : .18), t, .6);
    windGain.gain.setTargetAtTime(underwater ? 0 : (weather?.wind || 0) * .65, t, .8);
  }
  return { start, update, toggle() { muted = !muted; return muted; }, get muted() { return muted; } };
}
