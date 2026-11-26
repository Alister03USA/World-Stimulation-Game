// A repeatable weather front follows simulation time, so pauses and reloads cannot skip it.
const DURATIONS = [110, 90, 105, 75, 85, 135], PERIOD = 600;
const NAMES = ['Clear skies', 'Cloudy', 'Rain showers', 'Cloudy', 'Coastal mist', 'Clearing skies'];
const mix = (a, b, t) => a + (b - a) * t;
function phaseValues(index, cycle) {
  const shower = .55 + .25 * (.5 + .5 * Math.sin(cycle * 2.17 + .8));
  return [[.12, 0, .08, .18, 0], [.85, 0, .23, .52, .1], [.98, shower, .4, .8, .95], [.78, 0, .3, .43, .7], [.65, 0, .9, .14, .4], [.12, 0, .08, .22, .03]][index];
}
export function weatherAt(elapsed) {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0, cycle = Math.floor(time / PERIOD);
  let local = time % PERIOD, phase = 0;
  while (local >= DURATIONS[phase] && phase < DURATIONS.length - 1) local -= DURATIONS[phase++];
  const previous = phase ? phase - 1 : DURATIONS.length - 1, a = phaseValues(previous, phase ? cycle : cycle - 1), b = phaseValues(phase, cycle);
  const t = Math.min(1, local / 28), blend = t * t * (3 - 2 * t), values = b.map((v, i) => mix(a[i], v, blend));
  const [cloud, rain, fog, wind, wetness] = values, direction = .65 + Math.sin(time / 130) * .6;
  return { time, phase, label: NAMES[phase], cloud, rain, fog, wind, wetness, windX: Math.cos(direction), windZ: Math.sin(direction) };
}
export function rainExposure(player, tent) {
  if (player.y < 0) return 0;
  if (!tent) return 1;
  const dx = player.x - tent.x, dz = player.z - tent.z, c = Math.cos(tent.yaw), s = Math.sin(tent.yaw);
  const x = c * dx - s * dz, z = s * dx + c * dz;
  // Only suppress nearby drops while the eye is below the actual A-frame roof.
  return Math.abs(x) < 1.25 && Math.abs(z) < 1.35 && player.y > tent.y && player.y < tent.y + .15 + 1.95 * (1 - Math.abs(x) / 1.4) ? 0 : 1;
}
export function writeWeather(out, weather, exposure = 1) {
  out.set([weather.cloud, weather.rain, weather.fog, weather.wind, weather.time, weather.windX, weather.windZ, weather.wetness, exposure, 0, 0, 0], 64);
}
