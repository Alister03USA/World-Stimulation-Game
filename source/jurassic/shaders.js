export const common = /*wgsl*/`
struct Globals { vp: mat4x4f, camera: vec4f, sun: vec4f, resolution: vec4f, right: vec4f, up: vec4f, forward: vec4f, misc: vec4f };
@group(0) @binding(0) var<uniform> g: Globals;
const PI: f32 = 3.14159265;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2f(1., 0.)), u.x), mix(hash(i + vec2f(0., 1.)), hash(i + 1.), u.x), u.y);
}
fn sky(rd: vec3f) -> vec3f {
  let day = g.sun.w; let h = pow(max(rd.y, 0.), .5);
  var c = mix(vec3f(.48, .64, .63), vec3f(.12, .34, .47), h) * (.12 + .88 * day);
  let sun = pow(max(dot(rd, g.sun.xyz), 0.), 500.);
  c += vec3f(1., .79, .42) * sun * day * 2.5;
  c += vec3f(.44, .30, .12) * pow(max(dot(rd, g.sun.xyz), 0.), 8.) * day * .38;
  if (rd.y > .02) {
    let q = rd.xz / (rd.y + .15) * 2. + vec2f(g.camera.w * .003, 0.);
    let n = noise(q) * .6 + noise(q * 2.1) * .3 + noise(q * 4.1) * .1;
    let cloud = smoothstep(.5, .74, n) * smoothstep(.02, .22, rd.y);
    c = mix(c, vec3f(.80, .82, .73) * (.12 + .88 * day), cloud * .8);
    let star = step(.998, hash(floor(rd.xz / max(rd.y, .08) * 350.))) * (1. - smoothstep(.08, .32, day));
    c += vec3f(star * .55);
  }
  return c;
}
fn atmosphere(color: vec3f, wp: vec3f) -> vec3f {
  let v = wp - g.camera.xyz; let d = max(length(v), .001); let rd = v / d;
  var wet = 0.;
  if (g.camera.y < 0. && wp.y < 0.) { wet = d; }
  else if (g.camera.y < 0.) { wet = d * clamp(-g.camera.y / (wp.y - g.camera.y), 0., 1.); }
  else if (wp.y < 0.) { wet = d * clamp(-wp.y / (g.camera.y - wp.y), 0., 1.); }
  let trans = exp(-vec3f(.105, .041, .028) * wet);
  let water = vec3f(.025, .23, .28) * (.25 + .75 * g.sun.w);
  let c = color * trans + water * (1. - trans);
  return mix(c, sky(rd), (1. - exp(-max(d - wet, 0.) * .0037)) * .8);
}
fn display(c0: vec3f, uv: vec2f) -> vec3f {
  var c = max(c0, vec3f(0.));
  c = c / (c + vec3f(.7)); c = pow(c, vec3f(1. / 2.2));
  let v = uv - .5; c *= 1. - dot(v, v) * .35;
  c = mix(c, vec3f(.58, .055, .02), g.misc.y * .35);
  return c;
}
`;

export const sceneShader = common + /*wgsl*/`
struct Input {
  @location(0) p: vec3f, @location(1) n: vec3f, @location(2) color: vec3f, @location(3) joint: f32,
  @location(4) a: vec4f, @location(5) b: vec4f, @location(6) c: vec4f, @location(7) d: vec4f,
  @location(8) tint: vec4f, @location(9) params: vec4f
};
struct Output { @builtin(position) position: vec4f, @location(0) world: vec3f, @location(1) normal: vec3f, @location(2) color: vec3f };
@vertex fn vs(i: Input) -> Output {
  var p = i.p; let phase = g.camera.w * max(i.params.y * 2.8, .6) + i.params.x;
  if (i.joint == 1. || i.joint == 2.) {
    let t = phase + select(0., PI, i.joint == 2.);
    p.z += sin(t) * .36 * min(i.params.y, 1.8); p.y += max(cos(t), 0.) * .21 * min(i.params.y, 1.8);
  }
  if (i.joint == 3.) { p.x += sin(phase * .65 + p.z * .5) * .13 * max(p.z - 1.5, 0.); }
  if (i.joint == 4.) { p.x += sin(g.camera.w * .6 + i.params.x) * .08 * abs(p.z); }
  if (i.joint == 5.) { p.x += sin(g.camera.w * .8 + i.d.x * .1 + p.y) * p.y * .10; }
  if (i.joint == 6. || i.joint == 7.) { p.y += sin(g.camera.w * 1.6 + i.params.x + select(0., .5, i.joint == 7.)) * abs(p.x) * .25; }
  if (i.params.z > .5 && i.params.z < 2.5) { p.y += sin(phase * 2.) * .025 * min(i.params.y, 1.); }
  let m = mat4x4f(i.a, i.b, i.c, i.d); let wp = m * vec4f(p, 1.);
  var o: Output; o.position = g.vp * wp; o.world = wp.xyz; o.normal = normalize((m * vec4f(i.n, 0.)).xyz); o.color = i.color * i.tint.rgb; return o;
}
@fragment fn fs(i: Output, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  let normal = normalize(i.normal) * select(-1., 1., front); let n = noise(i.world.xz * 2.7 + i.world.y * .3);
  let ndl = max(dot(normal, g.sun.xyz), 0.); let day = g.sun.w;
  var lighting = vec3f(.16, .22, .25) * (.20 + .80 * day) + vec3f(1., .87, .62) * ndl * day * 1.15;
  lighting += vec3f(.04, .07, .075) * max(normal.y, 0.);
  if (i.world.y < 0.) {
    let p = i.world.xz * .75 + vec2f(g.camera.w * .3, sin(g.camera.w * .2));
    let caustic = pow(max(0., sin(p.x + sin(p.y)) * sin(p.y + cos(p.x))), 5.);
    lighting += vec3f(.26, .49, .41) * caustic * exp(i.world.y * .065) * day;
  }
  let color = atmosphere(i.color * lighting * (.88 + n * .24), i.world);
  return vec4f(display(color, i.position.xy / g.resolution.xy), 1.);
}
`;

export const skyShader = common + /*wgsl*/`
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32(i32(i & 1u) * 4 - 1), f32(i32(i >> 1u) * 4 - 1), 1., 1.);
}
@fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  let uv = p.xy / g.resolution.xy; let q = vec2f(uv.x * 2. - 1., 1. - uv.y * 2.);
  let rd = normalize(g.forward.xyz + g.right.xyz * q.x * g.right.w + g.up.xyz * q.y * g.up.w);
  let color = select(sky(rd), vec3f(.022, .22, .29) * (.35 + .65 * g.sun.w), g.camera.y < 0.);
  return vec4f(display(color, uv), 1.);
}
`;

export const waterShader = common + /*wgsl*/`
struct WaterOutput { @builtin(position) position: vec4f, @location(0) world: vec3f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> WaterOutput {
  let x = f32(i & 1u) * 2. - 1.; let z = f32(i >> 1u) * 2. - 1.;
  var o: WaterOutput; o.world = vec3f(x * 500., 0., z * 500.); o.position = g.vp * vec4f(o.world, 1.); return o;
}
@fragment fn fs(i: WaterOutput) -> @location(0) vec4f {
  let t = g.camera.w; let p = i.world.xz;
  let slope = vec2f(sin(p.x * .35 + t) * .07 + sin(p.y * .73 - t * .8) * .035, cos(p.y * .30 + t * .7) * .08 + cos(p.x * .6 + t) * .03);
  var normal = normalize(vec3f(slope.x, 1., slope.y));
  let view = normalize(g.camera.xyz - i.world); let below = g.camera.y < 0.; if (below) { normal = -normal; }
  let fresnel = .06 + .94 * pow(1. - abs(dot(view, normal)), 4.);
  let reflection = sky(reflect(-view, normal));
  let sparkle = pow(max(dot(reflect(-g.sun.xyz, normal), view), 0.), 160.) * g.sun.w;
  let sea = vec3f(.035, .29, .28) * (.25 + .75 * g.sun.w);
  var color = mix(sea, reflection, fresnel * .85) + vec3f(1., .8, .48) * sparkle * 2.;
  if (below) { color = mix(vec3f(.12, .42, .46), reflection * .7, fresnel); }
  return vec4f(display(atmosphere(color, i.world), i.position.xy / g.resolution.xy), select(.65 + fresnel * .30, .70, below));
}
`;
