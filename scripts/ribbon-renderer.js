// One textured mesh per photograph. No per-column image copies or DOM writes.
export function createRibbonRenderer(canvas, photos) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    premultipliedAlpha: true,
  });
  if (!gl) return createStaticRenderer(canvas, photos);
  const precision = gl.getShaderPrecisionFormat(
    gl.FRAGMENT_SHADER,
    gl.HIGH_FLOAT,
  ).precision
    ? "highp"
    : "mediump";

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec2 aUV;
    attribute vec2 aLocal;
    uniform vec2 uResolution;
    varying ${precision} vec2 vUV;
    varying ${precision} vec2 vLocal;
    void main() {
      vec2 clip = aPosition.xy / uResolution * 2.0 - 1.0;
      float w = 1.0 / aPosition.z;
      gl_Position = vec4(clip.x * w, -clip.y * w, 0.0, w);
      vUV = aUV;
      vLocal = aLocal;
    }
  `;
  const fragmentSource = `
    precision ${precision} float;
    uniform sampler2D uPhoto;
    uniform vec2 uCardSize;
    uniform float uFocus;
    varying ${precision} vec2 vUV;
    varying ${precision} vec2 vLocal;
    void main() {
      vec2 p = abs(vLocal - 0.5) * uCardSize - uCardSize * 0.5 + 6.0;
      float d = length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - 6.0;
      float alpha = 1.0 - smoothstep(-0.7, 0.7, d);
      vec3 color = texture2D(uPhoto, vUV).rgb;
      float border = smoothstep(-mix(0.8, 3.0, uFocus), -0.15, d);
      color = mix(color, vec3(0.929, 0.929, 0.961), border * mix(0.16, 1.0, uFocus));
      gl_FragColor = vec4(color * alpha, alpha);
    }
  `;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error("Ribbon shader unavailable");
    }
    return shader;
  };
  const program = gl.createProgram();
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error("Ribbon program unavailable");
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // 64 segments, two triangles each, seven floats per vertex. Reuse storage.
  const vertices = new Float32Array(64 * 6 * 7);
  gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, gl.DYNAMIC_DRAW);
  for (const [name, size, offset] of [
    ["aPosition", 3, 0],
    ["aUV", 2, 3],
    ["aLocal", 2, 5],
  ]) {
    const attribute = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 28, offset * 4);
  }
  const resolution = gl.getUniformLocation(program, "uResolution");
  const size = gl.getUniformLocation(program, "uCardSize");
  const focus = gl.getUniformLocation(program, "uFocus");
  gl.uniform1i(gl.getUniformLocation(program, "uPhoto"), 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const textures = new Map();
  const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");

  function textureFor(image) {
    const source = image.currentSrc || image.src;
    const cached = textures.get(image);
    if (cached?.source === source) return cached.texture;
    if (cached) gl.deleteTexture(cached.texture);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (anisotropy)
      gl.texParameterf(
        gl.TEXTURE_2D,
        anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(4, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)),
      );
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    textures.set(image, { source, texture });
    return texture;
  }

  return {
    name: "webgl",
    animated: true,
    draw(items, width, height) {
      if (gl.isContextLost()) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (const item of items) {
        const image = photos[item.index];
        if (!image.complete || !image.naturalWidth) continue;
        gl.bindTexture(gl.TEXTURE_2D, textureFor(image));
        const crop = photoCrop(image, item.aspect);
        let cursor = 0;
        const write = (point, bottom) => {
          vertices[cursor++] = point.x;
          vertices[cursor++] = bottom ? point.bottom : point.top;
          vertices[cursor++] = point.scale;
          vertices[cursor++] = crop.x + point.u * crop.width;
          vertices[cursor++] = bottom ? crop.y + crop.height : crop.y;
          vertices[cursor++] = point.u;
          vertices[cursor++] = bottom ? 1 : 0;
        };
        for (let n = 0; n < item.points.length - 1; n++) {
          const a = item.points[n],
            b = item.points[n + 1];
          write(a, false);
          write(a, true);
          write(b, false);
          write(b, false);
          write(a, true);
          write(b, true);
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices.subarray(0, cursor));
        gl.uniform2f(size, item.cardWidth, item.photoHeight);
        gl.uniform1f(focus, item.focused ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, cursor / 7);
      }
    },
  };
}

function photoCrop(image, aspect) {
  const imageAspect = image.naturalWidth / image.naturalHeight;
  const width = Math.min(1, aspect / imageAspect);
  const height = Math.min(1, imageAspect / aspect);
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

// Static curved windows remain sharp and usable without GPU acceleration.
// A single image copy per card; never run the old strip loop as a fallback.
export function createStaticRenderer(canvas, photos) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;
  // Canvas source rectangles use physical pixels. A responsive <img>'s
  // naturalWidth is density-corrected, so decode its selected URL separately.
  const sources = new Map();
  const sourceFor = (photo) => {
    const url = photo.currentSrc || photo.src;
    let entry = sources.get(photo);
    if (entry?.url !== url) {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => renderer.onReady?.(), {
        once: true,
      });
      entry = { url, image };
      sources.set(photo, entry);
      image.src = url;
    }
    return entry.image.complete && entry.image.naturalWidth
      ? entry.image
      : null;
  };
  const renderer = {
    name: "static-2d",
    animated: false,
    draw(items, width, height) {
      context.setTransform(
        canvas.width / width,
        0,
        0,
        canvas.height / height,
        0,
        0,
      );
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      for (const item of items) {
        const { points } = item;
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].top);
        for (const point of points.slice(1)) path.lineTo(point.x, point.top);
        for (const point of points.toReversed())
          path.lineTo(point.x, point.bottom);
        path.closePath();
        const photo = photos[item.index];
        const image =
          photo.complete && photo.naturalWidth ? sourceFor(photo) : null;
        if (image) {
          const crop = photoCrop(image, item.aspect);
          const start = points[0].u,
            fraction = points.at(-1).u - start;
          context.save();
          context.clip(path);
          context.drawImage(
            image,
            (crop.x + crop.width * start) * image.naturalWidth,
            crop.y * image.naturalHeight,
            crop.width * fraction * image.naturalWidth,
            crop.height * image.naturalHeight,
            item.left,
            item.top,
            item.right - item.left,
            item.bottom - item.top,
          );
          context.restore();
        }
        context.strokeStyle = item.focused
          ? "#EDEDF5"
          : "rgba(237,237,245,0.16)";
        context.lineWidth = item.focused ? 3 : 1;
        context.stroke(path);
      }
    },
  };
  return renderer;
}
