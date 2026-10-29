// iOS can omit an SVG URL filter on a composited HTML animation. Render the
// phone lens independently; keep the original links/photos underneath it.
const vertex = `
attribute vec2 position;
varying vec2 uv;
void main(){uv=vec2((position.x+1.0)*.5,(1.0-position.y)*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D atlas, field;
uniform float width, cycle, offset;
vec3 source(vec2 p){
  return texture2D(atlas,vec2(fract((p.x*width-offset)/cycle),clamp(p.y,0.,1.))).rgb;
}
vec3 refractPhoto(vec2 p){
  vec2 shift=texture2D(field,p).rg-.5;
  return vec3(source(p+.091854*shift).r,source(p+.0841995*shift).g,source(p+.076545*shift).b);
}
void main(){
  float mask=texture2D(field,uv).b;
  if(mask<=0.){gl_FragColor=vec4(0.);return;}
  vec3 color=.40*refractPhoto(uv);
  color+=.15*refractPhoto(uv+vec2(.007776,0.));
  color+=.15*refractPhoto(uv-vec2(.007776,0.));
  color+=.15*refractPhoto(uv+vec2(0.,.002916));
  color+=.15*refractPhoto(uv-vec2(0.,.002916));
  // Match the browser compositor's premultiplied canvas convention. Straight
  // RGB at fractional alpha produces bright blue/white arcs in iOS WebViews.
  gl_FragColor=vec4(color*mask,mask);
}`;

// Precompute the curved field once instead of evaluating powers and trigonometry
// for every blur tap on every pixel of every animation frame. No image request
// or SVG filter is required by this independent phone renderer.
function refractionField() {
  const w = 256,
    h = 128,
    pixels = new Uint8Array(w * h * 4);
  const smooth = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };
  const byte = (n) => Math.max(0, Math.min(255, Math.round(n * 255)));
  for (let j = 0; j < h; j++) {
    const y = j / (h - 1),
      s = Math.sin(Math.PI * y);
    const extent = 0.0405 + 0.1035 * s ** 0.65;
    const bow = 0.3 + 0.7 * s * s,
      vertical = Math.sin(2 * Math.PI * y);
    for (let i = 0; i < w; i++) {
      const x = i / (w - 1),
        left = 1 - smooth(x / extent),
        right = 1 - smooth((1 - x) / extent);
      const edge = left + right,
        fade = Math.min(1, edge / 0.75),
        k = (j * w + i) * 4;
      pixels[k] = byte(0.5 + 0.4 * (left - right) * bow);
      pixels[k + 1] = byte(0.5 + 0.32 * edge * vertical);
      pixels[k + 2] = byte(fade ** 3 * (fade * (fade * 6 - 15) + 10));
      pixels[k + 3] = 255;
    }
  }
  return { w, h, pixels };
}

export function mount({ window: aperture, track, cards, flow, getManual }) {
  const phone = matchMedia("(max-width: 850px)");
  const clear = matchMedia(
    "(prefers-reduced-transparency: reduce), (forced-colors: active)",
  );
  const images = cards.map((card) => card.querySelector("img"));
  const duration = Number(flow?.effect.getTiming().duration || 1);
  let canvas, gl, program, texture, uniforms;
  let width = 0,
    height = 0,
    cycle = 0,
    base = 0;
  let raf = 0,
    moving = false,
    dirty = false,
    last = -Infinity;
  let ready = false,
    lost = false,
    loading = false,
    failed = false;
  let previousManual, previousTime;
  let atlasKey = "";
  let density = 1.5,
    interval = 1000 / 60,
    painted = 0,
    slowFrames = 0;
  const eligible = () => phone.matches && !clear.matches;

  function initialize() {
    atlasKey = "";
    const shader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error("Hero lens shader unavailable");
      return s;
    };
    const v = shader(gl.VERTEX_SHADER, vertex);
    const f = shader(gl.FRAGMENT_SHADER, fragment);
    program = gl.createProgram();
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Hero lens program unavailable");
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      // Two edge bands: don't shade the clear 70% of the viewport at all.
      new Float32Array([
        -1, -1, -0.7, -1, -1, 1, -1, 1, -0.7, -1, -0.7, 1, 0.7, -1, 1, -1, 0.7,
        1, 0.7, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    uniforms = Object.fromEntries(
      ["width", "cycle", "offset"].map((name) => [
        name,
        gl.getUniformLocation(program, name),
      ]),
    );
    gl.uniform1i(gl.getUniformLocation(program, "atlas"), 0);
    const data = refractionField();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
    for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      data.w,
      data.h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data.pixels,
    );
    gl.uniform1i(gl.getUniformLocation(program, "field"), 1);
    gl.activeTexture(gl.TEXTURE0);
  }

  // Build once on load/resize. There are no image uploads or layout reads in
  // normal animation frames: the shader samples this repeating five-photo strip.
  function resize() {
    if (!ready || !eligible() || lost) return;
    width = aperture.clientWidth;
    height = aperture.clientHeight;
    if (!width || !height) return;
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(cards[0].parentElement).columnGap);
    cycle = cards.length * (cardWidth + gap);
    base = -cycle + (width - cardWidth) / 2;
    const ratio = Math.min(devicePixelRatio || 1, density);
    const colors = cards.map((card) => getComputedStyle(card).backgroundColor);
    const key = [
      width,
      height,
      cardWidth,
      gap,
      ratio,
      ...images.map((image) => image.currentSrc || image.src),
      ...colors,
    ].join("|");
    // Browser toolbars often emit resize without changing the photo aperture.
    // Refresh the clock, but don't rebuild/upload the same atlas again.
    if (key === atlasKey) {
      dirty = true;
      schedule();
      return;
    }
    atlasKey = key;
    const resolution = Math.min(
      ratio,
      gl.getParameter(gl.MAX_TEXTURE_SIZE) / cycle,
    );
    const sheet = document.createElement("canvas");
    sheet.width = Math.max(1, Math.floor(cycle * resolution));
    sheet.height = Math.max(1, Math.floor(height * resolution));
    const context = sheet.getContext("2d");
    context.scale(sheet.width / cycle, sheet.height / height);
    context.fillStyle = "#111116";
    context.fillRect(0, 0, cycle, height);
    cards.forEach((card, index) => {
      const image = images[index];
      const style = getComputedStyle(image);
      const padding = parseFloat(style.paddingLeft);
      const imageHeight = parseFloat(style.height);
      const imageWidth = parseFloat(style.width);
      const fit = Math.min(
        (imageWidth - 2 * padding) / image.naturalWidth,
        (imageHeight - 2 * padding) / image.naturalHeight,
      );
      const w = image.naturalWidth * fit,
        h = image.naturalHeight * fit;
      const x = index * (cardWidth + gap);
      context.fillStyle = colors[index];
      context.fillRect(x, 0, cardWidth, height);
      context.drawImage(
        image,
        x + (imageWidth - w) / 2,
        parseFloat(style.top) + (imageHeight - h) / 2,
        w,
        h,
      );
    });
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    gl.uniform1f(uniforms.width, width);
    gl.uniform1f(uniforms.cycle, cycle);
    dirty = true;
    schedule();
  }
  function schedule() {
    if (!raf && ready && eligible() && !lost)
      raf = requestAnimationFrame(frame);
  }
  function frame(time) {
    raf = 0;
    if (!ready || !eligible() || lost || document.hidden) return;
    if (dirty || time - last >= interval - 0.5) {
      const started = performance.now();
      // Read the CSS transition only during a manual 650 ms swipe. Native flow
      // uses its shared animation clock, without reading computed styles.
      const offset =
        getManual() || !flow
          ? new DOMMatrixReadOnly(getComputedStyle(track).transform).m41
          : base - cycle * ((Number(flow.currentTime || 0) / duration) % 1);
      gl.uniform1f(uniforms.offset, offset);
      gl.drawArrays(gl.TRIANGLES, 0, 12);
      if (aperture.dataset.optics !== "webgl") {
        if (gl.getError() !== gl.NO_ERROR) {
          fail();
          return;
        }
        aperture.dataset.optics = "webgl";
      }
      last = time;
      dirty = false;
      // Real rendering cost, not browser/benchmark detection. A slow graphics
      // driver gets a smaller optical buffer; the original photos stay sharp.
      const cost = performance.now() - started;
      if (++painted > 2) slowFrames = cost > 16 ? slowFrames + 1 : 0;
      if (slowFrames >= 3 && density > 1) {
        density = 1;
        interval = 1000 / 30;
        slowFrames = 0;
        resize();
      }
    }
    if (moving) schedule();
  }
  function fail() {
    failed = true;
    ready = false;
    cancelAnimationFrame(raf);
    raf = 0;
    delete aperture.dataset.optics;
    canvas?.remove();
  }
  async function enable() {
    if (!eligible() || loading || ready || failed) return;
    loading = true;
    try {
      await Promise.all(images.map((image) => image.decode()));
      canvas = document.createElement("canvas");
      canvas.className = "ribbon-optics";
      canvas.setAttribute("aria-hidden", "true");
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "low-power",
      });
      if (!gl) throw new Error("WebGL unavailable");
      initialize();
      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        lost = true;
        cancelAnimationFrame(raf);
        raf = 0;
        delete aperture.dataset.optics;
      });
      canvas.addEventListener("webglcontextrestored", () => {
        try {
          initialize();
          lost = false;
          resize();
        } catch {
          fail();
        }
      });
      aperture.append(canvas);
      ready = true;
      resize();
    } catch {
      fail(); // The original photographs and links always remain available.
    } finally {
      loading = false;
    }
  }
  function change() {
    if (eligible()) {
      if (ready) resize();
      else void enable();
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
      delete aperture.dataset.optics;
    }
  }
  new ResizeObserver(change).observe(aperture);
  window.addEventListener("resize", change, { passive: true });
  phone.addEventListener("change", change);
  clear.addEventListener("change", change);
  images.forEach((image) => image.addEventListener("load", change));
  void enable();
  return {
    update(active) {
      const manual = getManual(),
        time = flow?.currentTime;
      if (
        active === moving &&
        manual === previousManual &&
        (active || time === previousTime)
      )
        return;
      previousManual = manual;
      previousTime = time;
      moving = active;
      dirty = true;
      schedule();
    },
  };
}
