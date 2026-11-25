export const common = /*wgsl*/`
struct Globals { vp: mat4x4f, camera: vec4f, sun: vec4f, resolution: vec4f, right: vec4f, up: vec4f, forward: vec4f, misc: vec4f, lightVP: mat4x4f, effects: vec4f };
@group(0) @binding(0) var<uniform> g: Globals;
@group(0) @binding(1) var surfaceSampler: sampler;
@group(0) @binding(2) var albedoMap: texture_2d_array<f32>;
@group(0) @binding(3) var normalMap: texture_2d_array<f32>;
@group(0) @binding(4) var ormMap: texture_2d_array<f32>;
@group(0) @binding(5) var shadowMap: texture_depth_2d;
@group(0) @binding(6) var shadowSampler: sampler_comparison;
const PI: f32 = 3.14159265;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2f(1., 0.)), u.x), mix(hash(i + vec2f(0., 1.)), hash(i + 1.), u.x), u.y); }
fn sky(rd: vec3f) -> vec3f {
  let day = g.sun.w; let h = pow(max(rd.y, 0.), .5);
  var c = mix(vec3f(.62, .74, .76), vec3f(.16, .37, .57), h) * (.045 + .955 * day);
  let mu = max(dot(rd, g.sun.xyz), 0.);
  c += vec3f(1., .88, .64) * pow(mu, 1200.) * day * 10.;
  c += vec3f(.34, .23, .10) * pow(mu, 14.) * day;
  if (rd.y > .025) {
    let q = rd.xz / (rd.y + .17) * 2. + vec2f(g.camera.w * .002, 0.);
    let n = noise(q) * .6 + noise(q * 2.1) * .3 + noise(q * 4.1) * .1;
    let cloud = smoothstep(.53, .76, n) * smoothstep(.025, .25, rd.y);
    c = mix(c, vec3f(.95, .95, .87) * (.045 + .955 * day), cloud * .75);
    c += vec3f(step(.998, hash(floor(rd.xz / max(rd.y, .08) * 350.))) * (1. - smoothstep(.08, .3, day)) * .7);
  }
  return c;
}
fn atmosphere(color: vec3f, wp: vec3f) -> vec3f {
  let v = wp - g.camera.xyz; let d = max(length(v), .001); let rd = v / d; var wet = 0.;
  if (g.camera.y < 0. && wp.y < 0.) { wet = d; }
  else if (g.camera.y < 0.) { wet = d * clamp(-g.camera.y / (wp.y - g.camera.y), 0., 1.); }
  else if (wp.y < 0.) { wet = d * clamp(-wp.y / (g.camera.y - wp.y), 0., 1.); }
  let trans = exp(-vec3f(.105, .041, .028) * wet);
  let water = vec3f(.018, .17, .23) * (.2 + .8 * g.sun.w);
  let c = color * trans + water * (1. - trans);
  let haze = (1. - exp(-max(d - wet, 0.) * .0019)) * .7;
  return mix(c, sky(rd), haze);
}
fn display(c0: vec3f, uv: vec2f) -> vec3f {
  let x = max(c0 * 1.14, vec3f(0.));
  var c = clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), vec3f(0.), vec3f(1.));
  c = pow(c, vec3f(1. / 2.2)); let v = uv - .5; c *= 1. - dot(v, v) * .24;
  return mix(c, vec3f(.58, .055, .02), g.misc.y * .35);
}
fn visibility(p: vec3f, normal: vec3f) -> f32 {
  let c = g.lightVP * vec4f(p + normal * .035, 1.); let uv = vec2f(c.x * .5 + .5, .5 - c.y * .5);
  if (any(uv < vec2f(.003)) || any(uv > vec2f(.997)) || c.z < 0. || c.z > 1.) { return 1.; }
  let bias = max(.00009, .00038 * (1. - max(dot(normal, g.sun.xyz), 0.))); var sum = 0.;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) { sum += textureSampleCompareLevel(shadowMap, shadowSampler, uv + vec2f(f32(x), f32(y)) / 2048., c.z - bias); } }
  return sum / 9.;
}
`;

export const sceneShader = common + /*wgsl*/`
struct Input {
  @location(0) p: vec3f, @location(1) n: vec3f, @location(2) color: vec3f, @location(3) joint: f32,
  @location(4) a: vec4f, @location(5) b: vec4f, @location(6) c: vec4f, @location(7) d: vec4f,
  @location(8) contact0: vec4f, @location(9) params: vec4f, @location(10) uv: vec2f, @location(11) pivot: vec3f, @location(12) weight: f32,
  @location(13) motion: vec4f, @location(14) feet: vec4f, @location(15) contact1: vec4f
};
struct Deformed { p: vec3f, n: vec3f };
fn rotateX(p: vec3f, a: f32) -> vec3f { return vec3f(p.x, p.y * cos(a) - p.z * sin(a), p.y * sin(a) + p.z * cos(a)); }
fn rotateY(p: vec3f, a: f32) -> vec3f { return vec3f(p.x * cos(a) + p.z * sin(a), p.y, -p.x * sin(a) + p.z * cos(a)); }
fn rotateZ(p: vec3f, a: f32) -> vec3f { return vec3f(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a), p.z); }
fn deform(i: Input) -> Deformed {
  var p = i.p; var normal = i.n; let moving = min(i.params.y, 1.);
  if (i.joint >= 10. && i.joint <= 13.) {
    let leg = i32(i.joint) - 10; let biped = i.params.z == 2. || i.params.z == 6.;
    let offsets = select(vec4f(0., .5, .75, .25), vec4f(0., 0., .5, .5), biped);
    let phase = fract(i.motion.x / (2. * PI) + offsets[leg]); let swing = clamp((phase - .64) / .36, 0., 1.);
    let slide = select(.5 - swing, phase / .64 - .5, phase < .64) * i.motion.z * moving;
    let contacts = select(i.contact0, i.contact1, leg >= 2); let contact = (leg % 2) * 2;
    p.x += contacts[contact] * i.weight; p.z += (slide + contacts[contact + 1]) * i.weight; p.y += (sin(swing * PI) * i.motion.w * moving + i.feet[leg]) * i.weight;
  }
  if (i.joint == 16.) {
    let hinge = select(vec3f(0., 2.74, -2.02), vec3f(0., .13, -2.77), i.params.z == 3.);
    let jawHinge = vec3f(hinge.xy, select(hinge.z, hinge.z * .88, i.params.z == 6.));
    let angle = -.24 * i.motion.y; p = jawHinge + rotateX(p - jawHinge, angle); normal = rotateX(normal, angle);
  }
  if (i.joint == 14. || i.joint == 15. || i.joint == 16.) {
    let angle = sin(g.camera.w * select(.56, .25, i.joint >= 15.) + i.params.x + p.z * .12) * select(.065, .025, i.joint >= 15.);
    p = mix(p, i.pivot + rotateY(p - i.pivot, angle), i.weight); normal = normalize(mix(normal, rotateY(normal, angle), i.weight));
    if (i.joint >= 15.) { let dip = i.motion.y * select(select(.32, .12, i.params.z == 4.), .035, i.params.z == 2. || i.params.z == 3. || i.params.z == 6.); p = mix(p, i.pivot + rotateX(p - i.pivot, -dip), i.weight); normal = normalize(mix(normal, rotateX(normal, -dip), i.weight)); }
  }
  if (i.joint >= 6. && i.joint <= 9.) {
    let side = select(1., -1., i.joint == 7. || i.joint == 9.); let stroke = i.motion.x + select(0., .3, i.joint >= 8.);
    let angle = sin(stroke) * .38 * side; let twist = cos(stroke) * .14;
    p = i.pivot + rotateZ(rotateX(p - i.pivot, twist * i.weight), angle); normal = rotateZ(rotateX(normal, twist * i.weight), angle);
  }
  if (i.joint == 30.) {
    let wind = sin(g.camera.w * .75 + i.d.x * .055 + i.d.z * .08) + .35 * sin(g.camera.w * 1.7 + p.x * .4);
    p.x += wind * min(p.y, 25.) * .012; p.z += sin(g.camera.w * .6 + i.d.x * .04) * p.y * .006;
    let flutter = sin(g.camera.w * 2.3 + i.pivot.x * 3. + i.pivot.z * 2.) * .018 * i.weight;
    p.y += flutter; normal = rotateZ(normal, flutter * .6);
  }
  if (i.joint == 42. && i.params.z < .5 && p.y < .8) {
    let tx = clamp(abs(p.x) * .5, 0., 1.); let tz = clamp(abs(p.z) * .5, 0., 1.);
    let height = select(i.feet.y, i.feet.x, p.x >= 0.) * tx + select(i.feet.w, i.feet.z, p.z >= 0.) * tz;
    p.y += height * (1. - smoothstep(.35, .8, i.p.y));
  }
  if (i.joint >= 48. && i.joint <= 51. && p.y < 0.) { p.y = i.feet[i32(i.joint) - 48] - .05; }
  if (i.params.z > .5) { p.x *= 1. + sin(g.camera.w * 1.05 + i.params.x) * .004; }
  var result: Deformed; result.p = p; result.n = normal; return result;
}
struct Output {
  @builtin(position) position: vec4f, @location(0) world: vec3f, @location(1) normal: vec3f, @location(2) color: vec3f,
  @location(3) uv: vec2f, @location(4) local: vec3f, @location(5) @interpolate(flat) material: vec3f, @location(6) localNormal: vec3f, @location(7) @interpolate(flat) surface: f32
};
@vertex fn vs(i: Input) -> Output {
  let d = deform(i); let m = mat4x4f(i.a, i.b, i.c, i.d); let wp = m * vec4f(d.p, 1.);
  var o: Output; o.position = g.vp * wp; o.world = wp.xyz; o.normal = normalize((m * vec4f(d.n, 0.)).xyz);
  o.color = i.color; o.uv = i.uv; o.local = i.p; o.localNormal = i.n; o.surface = i.joint; o.material = vec3f(i.params.w, i.params.z, select(0., 1., i.joint == 30.)); return o;
}
@vertex fn vsShadow(i: Input) -> @builtin(position) vec4f { let d = deform(i); return g.lightVP * mat4x4f(i.a, i.b, i.c, i.d) * vec4f(d.p, 1.); }
fn fresnel(f0: vec3f, cosine: f32) -> vec3f { return f0 + (1. - f0) * pow(1. - cosine, 5.); }
@fragment fn fs(i: Output, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  let layer = i32(i.material.x + .5); let species = i.material.y; let leaf = i.material.z;
  let sampled = textureSample(albedoMap, surfaceSampler, i.uv, layer).rgb;
  let packedNormal = textureSample(normalMap, surfaceSampler, i.uv, layer).xyz * 2. - 1.;
  let orm = textureSample(ormMap, surfaceSampler, i.uv, layer).rgb;
  var normal = normalize(i.normal) * select(-1., 1., front); var albedo = i.color; var roughness = .85; var ao = 1.;
  let dp1 = dpdx(i.world); let dp2 = dpdy(i.world); let duv1 = dpdx(i.uv); let duv2 = dpdy(i.uv);
  let frequency = select(select(1.6, 1., species == 5.), 2.8, species == 3.); let q = i.local * frequency; let qx = dpdx(q); let qy = dpdy(q);
  let nearDetail = 1. - smoothstep(8., 32., length(i.world - g.camera.xyz)); let uvFootprint = max(length(duv1), length(duv2));
  if (layer == 3) {
    let weights0 = pow(abs(normalize(i.localNormal)), vec3f(4.)); let weights = weights0 / max(dot(weights0, vec3f(1.)), .001);
    let skin = textureSampleGrad(albedoMap, surfaceSampler, q.yz, 3, qx.yz, qy.yz).rgb * weights.x + textureSampleGrad(albedoMap, surfaceSampler, q.xz, 3, qx.xz, qy.xz).rgb * weights.y + textureSampleGrad(albedoMap, surfaceSampler, q.xy, 3, qx.xy, qy.xy).rgb * weights.z;
    let detail = clamp(dot(skin, vec3f(.2126, .7152, .0722)) * 2.8, .55, 1.35); let mask = select(1., 0., i.uv.x < -50.);
    albedo *= mix(1., mix(1., detail, select(.58, .22, species == 3.)), mask); roughness = select(.77, .53, species == 3.);
  } else if (layer > 0) {
    let tangent = dp1 * duv2.y - dp2 * duv1.y; let bitangent = dp2 * duv1.x - dp1 * duv2.x;
    if (dot(tangent, tangent) > 1e-12 && dot(bitangent, bitangent) > 1e-12) {
      let t = normalize(tangent); let b = normalize(bitangent); normal = normalize(t * packedNormal.x * .7 + b * packedNormal.y * .7 + normal * packedNormal.z);
    }
    albedo = sampled; roughness = clamp(orm.g, .48, .98); ao = mix(.8, 1., orm.r);
  } else if (species > .5) {
    let stripe = smoothstep(.24, .68, noise(i.local.yz * vec2f(.8, 1.4)) + sin(i.local.z * 2.1 + i.local.y * .7) * .18);
    let scales = noise(i.local.xz * 37. + i.local.y * 13.); let belly = 1. - smoothstep(-.7, .1, normal.y);
    albedo *= mix(.55, 1.15, stripe) * (.85 + .25 * scales);
    albedo = mix(albedo, vec3f(.48, .43, .30), belly * .65);
    normal = normalize(normal + vec3f(noise(i.local.yz * 35.) - .5, noise(i.local.xz * 35.) - .5, scales - .5) * .095);
    roughness = .74;
  } else {
    let n = noise(i.world.xz * 3.1 + i.world.y * .4); let broadNoise = noise(i.world.xz * .22);
    albedo *= (.81 + .19 * broadNoise + n * .17);
    if (i.surface == 40.) {
      let p = i.world.xz; let forest = i.uv.x; let moisture = i.uv.y; let slope = 1. - abs(normal.y);
      let patches = noise(p * .38); let grain = noise(p * 47.); let grit = smoothstep(.76, .92, noise(p * 14.));
      let sand = 1. - smoothstep(.6, 4., i.world.y); let mud = moisture * (1. - smoothstep(1., 6., i.world.y));
      let ripples = sin(p.x * 8. + sin(p.y * 1.8) * 2.) * .025 * sand * nearDetail;
      albedo *= .91 + patches * .15 + ((grain - .5) * .17 + grit * .12 + ripples) * nearDetail;
      albedo = mix(albedo, vec3f(.12, .105, .065) * (.8 + patches * .35), mud * .44);
      let moss = smoothstep(.55, .76, patches) * forest * moisture * (1. - smoothstep(.4, .65, slope));
      albedo = mix(albedo, vec3f(.11, .15, .045), moss * .5); roughness = mix(.94, .58, mud);
      normal = normalize(normal + vec3f((grain - .5) * .075, 0., (n - .5) * .075) * nearDetail);
    } else if (i.surface == 41.) {
      let layers = sin(i.world.y * 8. + noise(i.world.xz * 2.) * 2.); let mineral = noise(i.world.xz * 17. + i.world.y * 9.);
      albedo *= .84 + .19 * noise(i.world.xz * .7 + i.world.y) + (mineral - .5) * .20 * nearDetail;
      albedo *= 1. - smoothstep(.86, 1., abs(layers)) * .13 * nearDetail;
      let damp = 1. - smoothstep(.1, 2.8, i.world.y); roughness = mix(.87, .48, damp); albedo *= 1. - damp * .25;
      albedo = mix(albedo, vec3f(.13, .17, .065), smoothstep(.55, .8, noise(i.world.xz * .9)) * max(normal.y, 0.) * .3);
    } else if (i.surface == 42. || i.surface == 44.) {
      let a = select(atan2(i.local.x, i.local.z), atan2(i.local.x, i.local.y - .34), i.surface == 44.); let along = select(i.local.y, i.local.z, i.surface == 44.);
      let furrows = noise(vec2f(a * 19., along * 1.4)); let splits = smoothstep(.68, .85, noise(vec2f(a * 37., along * .75)));
      albedo *= .65 + furrows * .65 - splits * .17 * nearDetail;
      let moss = (1. - smoothstep(.2, 2., i.local.y)) * smoothstep(.43, .75, noise(i.world.xz * 2.));
      albedo = mix(albedo, vec3f(.12, .15, .045), moss * .42); roughness = .91;
    } else if (i.surface == 45.) {
      let r = length(i.uv); let rings = sin(r * 65. + noise(i.uv * 7.) * 2.);
      albedo *= mix(.92, .83 + smoothstep(-.4, .5, rings) * .19, 1. - smoothstep(.02, .12, uvFootprint)); roughness = .94;
    } else if (leaf > .5) {
      let veinWidth = max(.025, uvFootprint * 1.2); let midrib = 1. - smoothstep(veinWidth, veinWidth * 2., abs(i.uv.x));
      let vein = 1. - smoothstep(.055 + uvFootprint, .13 + uvFootprint, abs(sin((i.uv.y * 11. - abs(i.uv.x) * 2.) * PI)));
      let detail = 1. - smoothstep(.025, .12, uvFootprint); albedo *= 1. + (midrib * .18 + vein * .09) * detail;
      albedo *= .93 + noise(i.local.xz * 30. + i.local.y * 11.) * .10 * nearDetail; roughness = .72;
    } else if (i.surface == 43.) { albedo *= .82 + noise(i.world.xz * 28.) * .35; roughness = .98; }
  }
  let light = g.sun.xyz; let view = normalize(g.camera.xyz - i.world); let halfVector = normalize(light + view);
  let nl = max(dot(normal, light), 0.); let nv = max(dot(normal, view), .001); let nh = max(dot(normal, halfVector), 0.); let vh = max(dot(view, halfVector), 0.);
  let alpha = roughness * roughness; let a2 = alpha * alpha; let den = nh * nh * (a2 - 1.) + 1.; let distribution = a2 / max(PI * den * den, .0001);
  let k = (roughness + 1.) * (roughness + 1.) / 8.; let geometry = nv / (nv * (1. - k) + k) * nl / max(nl * (1. - k) + k, .001);
  let f = fresnel(vec3f(.035), vh); let specular = f * distribution * geometry / max(4. * nv * nl, .001);
  let shadow = visibility(i.world, normal); let day = g.sun.w;
  let radiance = vec3f(3.1, 2.87, 2.43) * day; let diffuse = albedo * (1. - f) / PI;
  let up = normal.y * .5 + .5; let ambient = mix(vec3f(.065, .060, .041), vec3f(.15, .205, .26), up) * (.10 + .90 * day);
  var color = (diffuse + specular) * radiance * nl * shadow + albedo * ambient * ao;
  let fireVector = g.effects.xyz - i.world; let fireDistance = length(fireVector);
  color += albedo * vec3f(3.8, 1.5, .35) * g.effects.w * max(0., dot(normal, normalize(fireVector + vec3f(0., .001, 0.)))) / (1. + fireDistance * fireDistance * .55);
  if (i.surface == 52.) { color = vec3f(4., 1.0, .05) * (1. + sin(g.camera.w * 11. + i.local.y * 5.) * .16); }
  if (i.surface == 53.) { color = vec3f(.18, .19, .17) * (.4 + g.sun.w * .6); if (hash(floor(i.position.xy)) > .38) { discard; } }
  if (i.surface == 46.) { color = i.color * 1.5; if (fract((i.position.x + i.position.y) * .18) > .55) { discard; } }
  color += albedo * leaf * max(dot(-normal, light), 0.) * radiance * shadow * .09;
  if (i.world.y < 0.) {
    let p = i.world.xz * .75 + vec2f(g.camera.w * .3, sin(g.camera.w * .2)); let caustic = pow(max(0., sin(p.x + sin(p.y)) * sin(p.y + cos(p.x))), 5.);
    color += albedo * vec3f(.25, .45, .39) * caustic * exp(i.world.y * .065) * day * shadow;
  }
  return vec4f(display(atmosphere(color, i.world), i.position.xy / g.resolution.xy), 1.);
}
`;

export const skyShader = common + /*wgsl*/`
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f { return vec4f(f32(i32(i & 1u) * 4 - 1), f32(i32(i >> 1u) * 4 - 1), 1., 1.); }
@fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  let uv = p.xy / g.resolution.xy; let q = vec2f(uv.x * 2. - 1., 1. - uv.y * 2.);
  let rd = normalize(g.forward.xyz + g.right.xyz * q.x * g.right.w + g.up.xyz * q.y * g.up.w);
  let color = select(sky(rd), vec3f(.015, .17, .23) * (.25 + .75 * g.sun.w), g.camera.y < 0.);
  return vec4f(display(color, uv), 1.);
}
`;

export const waterShader = common + /*wgsl*/`
struct WaterOutput { @builtin(position) position: vec4f, @location(0) world: vec3f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> WaterOutput { let x = f32(i & 1u) * 2. - 1.; let z = f32(i >> 1u) * 2. - 1.; var o: WaterOutput; o.world = vec3f(x * 500., 0., z * 500.); o.position = g.vp * vec4f(o.world, 1.); return o; }
@fragment fn fs(i: WaterOutput) -> @location(0) vec4f {
  let t = g.camera.w; let p = i.world.xz;
  let slope = vec2f(sin(p.x * .35 + t) * .07 + sin(p.y * .73 - t * .8) * .035, cos(p.y * .30 + t * .7) * .08 + cos(p.x * .6 + t) * .03);
  var normal = normalize(vec3f(slope.x, 1., slope.y)); let view = normalize(g.camera.xyz - i.world); let below = g.camera.y < 0.; if (below) { normal = -normal; }
  let fresnel = .04 + .96 * pow(1. - abs(dot(view, normal)), 4.); let reflection = sky(reflect(-view, normal));
  let sparkle = pow(max(dot(reflect(-g.sun.xyz, normal), view), 0.), 260.) * g.sun.w;
  let sea = vec3f(.025, .22, .21) * (.18 + .82 * g.sun.w);
  var color = mix(sea, reflection, fresnel * .85) + vec3f(1., .85, .57) * sparkle * 3.;
  if (below) { color = mix(vec3f(.10, .32, .39), reflection * .7, fresnel); }
  return vec4f(display(atmosphere(color, i.world), i.position.xy / g.resolution.xy), select(.62 + fresnel * .33, .70, below));
}
`;
