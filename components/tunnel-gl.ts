// The tunnel drawn on the GPU. Posters are textured quads, so flying past them costs almost
// nothing, and images are decoded off the main thread and uploaded one per frame.

const CARD_VERTEX = `#version 300 es
in vec2 corner;
uniform vec2 uCentre, uSize, uRes;
uniform float uScale;
out vec2 vUv;
void main() {
  vec2 p = (uCentre + corner * uSize) * uScale;
  gl_Position = vec4(p / (uRes * 0.5), 0.0, 1.0);
  vUv = corner + 0.5;
}`;

const CARD_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uImage;
uniform vec3 uFlat;
uniform float uAlpha, uHasImage;
out vec4 colour;
void main() {
  vec3 rgb = uHasImage > 0.5 ? texture(uImage, vUv).rgb : uFlat;
  colour = vec4(rgb * uAlpha, uAlpha);
}`;

const GLOW_VERTEX = `#version 300 es
in vec2 corner;
out vec2 vUv;
void main() {
  vUv = corner + 0.5;
  gl_Position = vec4(corner * 2.0, 0.0, 1.0);
}`;

const GLOW_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform vec3 uRoom;
out vec4 colour;
void main() {
  float d = length((vUv - 0.5) * vec2(1.25, 1.5));
  float alpha = smoothstep(0.72, 0.0, d) * 0.42;
  colour = vec4(uRoom * alpha, alpha);
}`;

const FOG_FAR = 3300;
const FOG_NEAR = 1500;
const LOADERS = 4;
const CAMERA_EASE = 0.13;
const ROOM_EASE = 0.045;

export type TunnelCard = { src: string; accent: string; x: number; y: number; z: number };

export type TunnelScene = {
  load: () => void;
  seek: (camera: number) => void;
  setVisible: (visible: boolean) => void;
  setRoom: (hex: string) => void;
  pick: (x: number, y: number) => number;
  destroy: () => void;
};

type Colour = [number, number, number];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Colour;

function build(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const program = gl.createProgram()!;
  [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].forEach(([type, source]) => {
    const shader = gl.createShader(type as number)!;
    gl.shaderSource(shader, source as string);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  });
  gl.bindAttribLocation(program, 0, 'corner');
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

/** @returns null if this device has no WebGL2, so the caller can show a plain grid instead. */
export function startTunnel(canvas: HTMLCanvasElement, cards: TunnelCard[], options: { phone: boolean; onFrame: (camera: number) => void }): TunnelScene | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const cardProgram = build(gl, CARD_VERTEX, CARD_FRAGMENT);
  const glowProgram = build(gl, GLOW_VERTEX, GLOW_FRAGMENT);
  if (!cardProgram || !glowProgram) return null;

  const perspective = options.phone ? 620 : 900;
  const passStart = perspective * 0.38;
  const passEnd = perspective * 0.84;

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const cardAt = (name: string) => gl.getUniformLocation(cardProgram, name);
  const uniforms = { centre: cardAt('uCentre'), size: cardAt('uSize'), res: cardAt('uRes'), scale: cardAt('uScale'), flat: cardAt('uFlat'), alpha: cardAt('uAlpha'), hasImage: cardAt('uHasImage') };
  const roomAt = gl.getUniformLocation(glowProgram, 'uRoom');
  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');

  const textures: (WebGLTexture | null)[] = cards.map(() => null);
  const flats = cards.map((card) => rgb(card.accent));
  const ready: { index: number; bitmap: ImageBitmap }[] = [];
  let camera = 0;
  let wanted = 0;
  let room: Colour = [0.1, 0.08, 0.07];
  let roomWanted = room;
  let visible = false;
  let dirty = true;
  let loading = false;
  let destroyed = false;
  let raf = 0;
  let width = 0;
  let height = 0;
  let cardWidth = 200;
  let dpr = 1;

  const resize = () => {
    dpr = Math.min(1.5, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (w === width && h === height) return;
    width = canvas.width = w;
    height = canvas.height = h;
    gl.viewport(0, 0, w, h);
    cardWidth = (options.phone ? 118 : Math.max(124, Math.min(236, canvas.clientWidth * 0.15))) * dpr;
    dirty = true;
  };
  const sizes = new ResizeObserver(resize);
  sizes.observe(canvas);

  const upload = () => {
    const next = ready.shift();
    if (!next) return;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, next.bitmap);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    next.bitmap.close();
    textures[next.index] = texture;
    dirty = true;
  };

  const alphaAt = (relative: number) => {
    const arriving = Math.max(0, Math.min(1, (relative + FOG_FAR) / (FOG_FAR - FOG_NEAR)));
    const leaving = Math.max(0, Math.min(1, (passEnd - relative) / (passEnd - passStart)));
    return arriving * leaving;
  };

  const draw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(glowProgram);
    gl.uniform3f(roomAt, room[0], room[1], room[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(cardProgram);
    gl.uniform2f(uniforms.res, width, height);
    gl.uniform2f(uniforms.size, cardWidth, cardWidth * 1.5);
    // Far to near, so closer posters land on top of the ones behind them.
    for (let index = cards.length - 1; index >= 0; index--) {
      const card = cards[index];
      const relative = card.z + camera;
      if (relative <= -FOG_FAR || relative >= passEnd) continue;
      const alpha = alphaAt(relative);
      if (alpha <= 0.003) continue;
      gl.uniform1f(uniforms.scale, perspective / (perspective - relative));
      gl.uniform2f(uniforms.centre, (card.x / 100) * width, -(card.y / 100) * height);
      gl.uniform1f(uniforms.alpha, alpha);
      const texture = textures[index];
      gl.uniform1f(uniforms.hasImage, texture ? 1 : 0);
      if (texture) gl.bindTexture(gl.TEXTURE_2D, texture);
      else gl.uniform3f(uniforms.flat, flats[index][0], flats[index][1], flats[index][2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    upload();
    const moved = Math.abs(wanted - camera) > 0.1;
    if (moved) camera += (wanted - camera) * CAMERA_EASE;
    let tinting = false;
    room = room.map((value, i) => {
      const gap = roomWanted[i] - value;
      if (Math.abs(gap) > 0.002) tinting = true;
      return value + gap * ROOM_EASE;
    }) as Colour;
    if (!moved && !tinting && !dirty) return;
    dirty = false;
    draw();
    if (moved) options.onFrame(camera);
  };
  resize();
  raf = requestAnimationFrame(frame);

  return {
    load() {
      if (loading) return;
      loading = true;
      const queue = cards.map((card, index) => ({ card, index }));
      const worker = async () => {
        for (let job = queue.shift(); job && !destroyed; job = queue.shift()) {
          try {
            // A separate address keeps this away from the page's cached copy, which WebGL can't read.
            const response = await fetch(`${job.card.src}?tunnel`, { mode: 'cors' });
            const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
            if (destroyed) bitmap.close();
            else ready.push({ index: job.index, bitmap });
          } catch { /* The poster's own colour stands in for it. */ }
        }
      };
      for (let i = 0; i < LOADERS; i++) worker();
    },
    seek: (value) => { wanted = value; },
    setVisible: (value) => { visible = value; dirty = true; },
    setRoom: (hex) => { roomWanted = rgb(hex); },
    pick(x, y) {
      const box = canvas.getBoundingClientRect();
      const px = (x - box.left - box.width / 2) * dpr;
      const py = (box.height / 2 - (y - box.top)) * dpr;
      // Nearest first, because that's the poster on top.
      let best = -1;
      let bestRelative = -Infinity;
      cards.forEach((card, index) => {
        const relative = card.z + camera;
        if (relative <= bestRelative || relative >= passEnd || alphaAt(relative) < 0.3) return;
        const scale = perspective / (perspective - relative);
        const dx = Math.abs(px - (card.x / 100) * width * scale);
        const dy = Math.abs(py + (card.y / 100) * height * scale);
        if (dx < (cardWidth * scale) / 2 && dy < (cardWidth * 1.5 * scale) / 2) {
          best = index;
          bestRelative = relative;
        }
      });
      return best;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      sizes.disconnect();
      ready.forEach((item) => item.bitmap.close());
      textures.forEach((texture) => texture && gl.deleteTexture(texture));
    },
  };
}
