// iOS can omit an SVG URL filter on a composited HTML animation. Render the
// phone lens independently; keep the original links/photos underneath it.
const vertex = `
attribute vec2 position;
varying vec2 uv;
void main(){uv=vec2((position.x+1.0)*.5,(1.0-position.y)*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D atlas;
uniform float width, cycle, offset;
vec3 source(vec2 p){
  return texture2D(atlas,vec2(fract((p.x*width-offset)/cycle),clamp(p.y,0.,1.))).rgb;
}
vec3 refractPhoto(vec2 p){
  float s=max(0.,sin(3.14159265*p.y));
  float extent=.0405+.1035*pow(s,.65);
  float left=1.-smoothstep(0.,extent,p.x);
  float right=1.-smoothstep(0.,extent,1.-p.x);
  vec2 shift=vec2(.40*(left-right)*(.30+.70*s*s),.32*(left+right)*sin(6.2831853*p.y));
  return vec3(source(p+.091854*shift).r,source(p+.0841995*shift).g,source(p+.076545*shift).b);
}
void main(){
  float extent=.0405+.1035*pow(max(0.,sin(3.14159265*uv.y)),.65);
  float edge=1.-smoothstep(0.,extent,uv.x)+1.-smoothstep(0.,extent,1.-uv.x);
  // A wider quintic feather has zero slope and curvature at both ends,
  // so the lens fades into the original photograph without an outline.
  edge=clamp(edge/.75,0.,1.);
  float mask=edge*edge*edge*(edge*(edge*6.-15.)+10.);
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
  const eligible = () => phone.matches && !clear.matches;

  function initialize() {
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
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
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
    const ratio = Math.min(devicePixelRatio || 1, 2);
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
      context.fillStyle = getComputedStyle(card).backgroundColor;
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
    if (dirty || time - last >= 1000 / 60 - 0.5) {
      // Read the CSS transition only during a manual 650 ms swipe. Native flow
      // uses its shared animation clock, without reading computed styles.
      const offset =
        getManual() || !flow
          ? new DOMMatrixReadOnly(getComputedStyle(track).transform).m41
          : base - cycle * ((Number(flow.currentTime || 0) / duration) % 1);
      gl.uniform1f(uniforms.offset, offset);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (aperture.dataset.optics !== "webgl") {
        if (gl.getError() !== gl.NO_ERROR) {
          fail();
          return;
        }
        aperture.dataset.optics = "webgl";
      }
      last = time;
      dirty = false;
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
