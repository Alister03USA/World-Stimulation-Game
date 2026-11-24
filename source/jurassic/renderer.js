import { sceneShader, skyShader, waterShader } from './shaders.js';
import { animalTextures } from './assets.js';

export function writeTransform(a, offset, o) {
  const s = o.scale ?? 1, c = Math.cos(o.yaw || 0), n = Math.sin(o.yaw || 0), cp = Math.cos(o.pitch || 0), sp = Math.sin(o.pitch || 0), cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0);
  a.set([c * cr * s, sr * s, -n * cr * s, 0, (-c * sr * cp + n * sp) * s, cr * cp * s, (n * sr * cp + c * sp) * s, 0, (c * sr * sp + n * cp) * s, -cr * sp * s, (-n * sr * sp + c * cp) * s, 0, o.x || 0, o.y || 0, o.z || 0, 1, 1, 1, 1, 1, o.phase || 0, o.speed || 0, o.species === undefined ? 0 : o.species + 1, o.material || 0, o.gait || 0, o.headPose || 0, o.stride || 1, o.stepHeight || .18, ...(o.feet || [0, 0, 0, 0])], offset);
}

export function writeLightMatrix(out, offset, x, y, z, light) {
  const [lx, ly, lz] = light, len = Math.hypot(lz, lx), rx = lz / len, rz = -lx / len, fx = -lx, fy = -ly, fz = -lz;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy, r = 90, depth = 230;
  out.set([rx / r, ux / r, fx / depth, 0, 0, uy / r, fy / depth, 0, rz / r, uz / r, fz / depth, 0, -(rx * x + rz * z) / r, -(ux * x + uy * y + uz * z) / r, (115 - fx * x - fy * y - fz * z) / depth, 1], offset);
}

async function makeSurfaceTextures(device) {
  const textures = ['rgba8unorm-srgb', 'rgba8unorm', 'rgba8unorm'].map(format => device.createTexture({ size: [1024, 1024, 3], format, mipLevelCount: 11, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT }));
  const defaults = [[255, 255, 255, 255], [128, 128, 255, 255], [255, 210, 0, 255]];
  for (let channel = 0; channel < 3; channel++) for (let mip = 0; mip < 11; mip++) {
    const w = Math.max(1, 1024 >> mip), pixels = new Uint8Array(w * w * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set(defaults[channel], i);
    device.queue.writeTexture({ texture: textures[channel], mipLevel: mip, origin: [0, 0, 0] }, pixels, { bytesPerRow: w * 4 }, [w, w, 1]);
  }
  await Promise.all(animalTextures.slice(1).flatMap((channels, layer) => channels.map(async (url, channel) => {
    const blob = await (await fetch(url)).blob(), image = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    for (let mip = 0; mip < 11; mip++) {
      const w = Math.max(1, 1024 >> mip), small = mip ? await createImageBitmap(image, { resizeWidth: w, resizeHeight: w, resizeQuality: 'high', colorSpaceConversion: 'none' }) : image;
      device.queue.copyExternalImageToTexture({ source: small }, { texture: textures[channel], mipLevel: mip, origin: [0, 0, layer + 1] }, [w, w]);
      if (mip) small.close();
    }
    image.close();
  })));
  return textures;
}

export async function makeRenderer(canvas, world, creatures, onError) {
  if (!navigator.gpu) throw new Error('WebGPU is unavailable. Try a current Chrome or Edge with hardware acceleration enabled.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU graphics adapter is available. Try Chrome or Edge with hardware acceleration enabled.');
  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', e => onError(e.error.message));
  device.lost.then(info => { if (info.reason !== 'destroyed') onError('The graphics device was lost. Reload to resume your saved expedition.'); });
  const context = canvas.getContext('webgpu'), format = navigator.gpu.getPreferredCanvasFormat(), globals = new Float32Array(64);
  const uniform = device.createBuffer({ size: globals.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const textures = await makeSurfaceTextures(device), sampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: 4 });
  const shadowTexture = device.createTexture({ size: [2048, 2048], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  const dummyShadow = device.createTexture({ size: [1, 1], format: 'depth32float', usage: GPUTextureUsage.TEXTURE_BINDING });
  const compare = device.createSampler({ compare: 'less-equal', minFilter: 'linear', magFilter: 'linear' });
  const layout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ...[2, 3, 4].map(binding => ({ binding, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } })),
    { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }, { binding: 6, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } }
  ] });
  const makeBind = shadow => device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: sampler }, ...textures.map((t, i) => ({ binding: i + 2, resource: t.createView({ dimension: '2d-array' }) })), { binding: 5, resource: shadow.createView() }, { binding: 6, resource: compare }] });
  const bind = makeBind(shadowTexture), shadowBind = makeBind(dummyShadow);
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const modules = [sceneShader, skyShader, waterShader].map(code => device.createShaderModule({ code }));
  for (const module of modules) {
    const compilation = await module.getCompilationInfo();
    const errors = compilation.messages.filter(m => m.type === 'error');
    if (errors.length) throw new Error(errors.map(e => `Shader line ${e.lineNum}: ${e.message}`).join('\n'));
  }
  const vertexLayout = { arrayStride: 64, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x3' }, { shaderLocation: 3, offset: 36, format: 'float32' }, { shaderLocation: 10, offset: 40, format: 'float32x2' }, { shaderLocation: 11, offset: 48, format: 'float32x3' }, { shaderLocation: 12, offset: 60, format: 'float32' }] };
  const instanceLayout = { arrayStride: 128, stepMode: 'instance', attributes: [...Array.from({ length: 6 }, (_, i) => ({ shaderLocation: i + 4, offset: i * 16, format: 'float32x4' })), { shaderLocation: 13, offset: 96, format: 'float32x4' }, { shaderLocation: 14, offset: 112, format: 'float32x4' }] };
  const pipe = (module, buffers, water = false, sky = false) => device.createRenderPipelineAsync({
    layout: pipelineLayout, vertex: { module, entryPoint: 'vs', buffers }, fragment: { module, entryPoint: 'fs', targets: [{ format, blend: water ? { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } : undefined }] },
    primitive: { topology: water ? 'triangle-strip' : 'triangle-list', cullMode: 'none' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: !water && !sky, depthCompare: sky ? 'always' : 'less-equal' }, multisample: { count: 4 }
  });
  const [scene, sky, water] = await Promise.all([pipe(modules[0], [vertexLayout, instanceLayout]), pipe(modules[1], [], false, true), pipe(modules[2], [], true)]);
  const shadowPipeline = await device.createRenderPipelineAsync({ layout: pipelineLayout, vertex: { module: modules[0], entryPoint: 'vsShadow', buffers: [vertexLayout, instanceLayout] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 1.4 } });
  const upload = (data, usage) => { const buffer = device.createBuffer({ size: Math.max(4, data.byteLength), usage: usage | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(buffer, 0, data); return buffer; };
  const meshes = new Map(Object.entries(world.meshes).map(([name, mesh]) => {
    let radius = 0, top = 0; for (let i = 0; i < mesh.vertices.length; i += 16) { radius = Math.max(radius, Math.hypot(mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2])); top = Math.max(top, mesh.vertices[i + 1]); }
    return [name, { vertex: upload(mesh.vertices, GPUBufferUsage.VERTEX), index: upload(mesh.indices, GPUBufferUsage.INDEX), count: mesh.indices.length, radius, top }];
  }));
  const groups = [];
  for (const name of meshes.keys()) {
    const objects = name === 'terrain' ? [{ x: 0, y: 0, z: 0 }] : world.objects.filter(o => o.mesh === name);
    const animals = creatures.filter(o => o.mesh === name), all = [...objects, ...animals];
    if (!all.length) continue;
    const data = new Float32Array(all.length * 32); all.forEach((o, i) => writeTransform(data, i * 32, o));
    groups.push({ name, mesh: meshes.get(name), all, data, buffer: upload(data, GPUBufferUsage.VERTEX), shadowData: new Float32Array(data.length), shadowBuffer: upload(data, GPUBufferUsage.VERTEX), count: all.length, shadowCount: all.length });
  }
  let depth, multisample, width = 0, height = 0, quality = 1, frames = 0, time = 0, lastResize = 0;
  const qualityLimit = matchMedia('(pointer:coarse)').matches ? 0.65 : 1;
  function resize() {
    const scale = Math.min(devicePixelRatio, 1.5) * Math.min(quality, qualityLimit), aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    let w = Math.max(2, Math.round(canvas.clientWidth * scale)), h = Math.max(2, Math.round(canvas.clientHeight * scale));
    if (w * h > 2560 * 1440) { h = Math.round(Math.sqrt(2560 * 1440 / aspect)); w = Math.round(h * aspect); }
    if (w === width && h === height) return;
    width = canvas.width = w; height = canvas.height = h; depth?.destroy(); multisample?.destroy();
    context.configure({ device, format, alphaMode: 'opaque' });
    depth = device.createTexture({ size: [w, h], format: 'depth24plus', sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    multisample = device.createTexture({ size: [w, h], format, sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  }
  function render(player, clock, daylight, damage, dt) {
    frames++; time += dt;
    if (time > 2 && clock - lastResize > 3) { const fps = frames / time; if (fps < 43 && quality > .5) quality = Math.max(.5, quality - .1); frames = 0; time = 0; lastResize = clock; }
    resize();
    const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch), sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const fx = sy * cp, fy = sp, fz = -cy * cp, rx = cy, rz = sy, ux = -sy * sp, uy = cp, uz = cy * sp;
    const aspect = width / height, tan = .66, sx = 1 / (tan * aspect), py = 1 / tan, near = .12, far = 1100;
    const a = far / (far - near), b = -far * near / (far - near), x = player.x, y = player.y, z = player.z;
    globals.set([rx * sx, ux * py, fx * a, fx, 0, uy * py, fy * a, fy, rz * sx, uz * py, fz * a, fz, -(rx * x + rz * z) * sx, -(ux * x + uy * y + uz * z) * py, -(fx * x + fy * y + fz * z) * a + b, -(fx * x + fy * y + fz * z)]);
    const angle = (clock / 720) * Math.PI * 2 + .23, sunY = Math.sin(angle), sunL = Math.hypot(.38, Math.max(.08, sunY), -.47);
    globals.set([x, y, z, clock], 16); globals.set([.38 / sunL, Math.max(.08, sunY) / sunL, -.47 / sunL, daylight], 20);
    globals.set([width, height, 1, y < 0 ? 1 : 0, rx, 0, rz, tan * aspect, ux, uy, uz, tan, fx, fy, fz, near, clock / 720, damage, 0, 0], 24);
    writeLightMatrix(globals, 44, x, Math.max(y - 1.7, 0) + 4, z, globals.subarray(20, 23)); globals.set([1, 0, 0, 0], 60);
    device.queue.writeBuffer(uniform, 0, globals);
    for (const group of groups) {
      if (group.name === 'terrain') continue;
      let visible = 0, shadowCount = 0;
      const farLimit = ['tree', 'ginkgo'].includes(group.name) ? 230 : ['fern', 'horsetail'].includes(group.name) ? 65 : ['weed', 'cycad'].includes(group.name) ? 85 : 200;
      for (const o of group.all) {
        const dx = o.x - x, dy = o.y - y, dz = o.z - z, radius = (o.scale || 1) * group.mesh.radius;
        if (Math.hypot(dx, dz) < 135 + radius) writeTransform(group.shadowData, shadowCount++ * 32, o);
        const forward = dx * fx + dy * fy + dz * fz;
        if (Math.hypot(dx, dz) > farLimit + radius || forward < -radius) continue;
        if (Math.abs(dx * rx + dz * rz) > Math.max(0, forward) * tan * aspect + radius * 2) continue;
        if (Math.abs(dx * ux + dy * uy + dz * uz) > Math.max(0, forward) * tan + radius * 2) continue;
        writeTransform(group.data, visible++ * 32, o);
      }
      group.count = visible;
      group.shadowCount = shadowCount;
      if (visible) device.queue.writeBuffer(group.buffer, 0, group.data, 0, visible * 32);
      if (shadowCount) device.queue.writeBuffer(group.shadowBuffer, 0, group.shadowData, 0, shadowCount * 32);
    }
    const encoder = device.createCommandEncoder();
    const shadowPass = encoder.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: shadowTexture.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    shadowPass.setBindGroup(0, shadowBind); shadowPass.setPipeline(shadowPipeline);
    for (const group of groups) if (group.shadowCount) { shadowPass.setVertexBuffer(0, group.mesh.vertex); shadowPass.setVertexBuffer(1, group.shadowBuffer); shadowPass.setIndexBuffer(group.mesh.index, 'uint32'); shadowPass.drawIndexed(group.mesh.count, group.shadowCount); }
    shadowPass.end();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: multisample.createView(), resolveTarget: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0.12, .25, .29, 1] }], depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthStoreOp: 'discard', depthClearValue: 1 } });
    pass.setBindGroup(0, bind); pass.setPipeline(sky); pass.draw(3); pass.setPipeline(scene);
    for (const group of groups) if (group.count) { pass.setVertexBuffer(0, group.mesh.vertex); pass.setVertexBuffer(1, group.buffer); pass.setIndexBuffer(group.mesh.index, 'uint32'); pass.drawIndexed(group.mesh.count, group.count); }
    pass.setPipeline(water); pass.draw(4); pass.end(); device.queue.submit([encoder.finish()]);
  }
  return { render, device, get size() { return [width, height]; } };
}
