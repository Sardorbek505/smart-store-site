// Bundled separately with Three.js; loaded only for the visible checkout story.
import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  Group,
  Mesh,
  Shape,
  ShapeGeometry,
  ExtrudeGeometry,
  BoxGeometry,
  PlaneGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  MeshBasicMaterial,
  HemisphereLight,
  DirectionalLight,
  TextureLoader,
  CanvasTexture,
  SRGBColorSpace,
  LinearFilter,
  Vector3,
  ACESFilmicToneMapping,
  DoubleSide,
} from "three";

export async function createCheckoutScene({ canvas, context }) {
  const renderer = new WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
    stencil: false,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0xededf5, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 4 / 3, 0.05, 50);
  const assembly = new Group();
  scene.add(assembly);
  scene.add(new HemisphereLight(0xffffff, 0x7585ae, 1.8));
  for (const [position, intensity] of [
    [[-3, 6, 5], 2.5],
    [[4, 3, 3], 1],
    [[-2, 4, -3], 1.3],
  ]) {
    const light = new DirectionalLight(0xffffff, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  const materials = [];
  const material = (options) => {
    const value = new MeshStandardMaterial(options);
    materials.push(value);
    return value;
  };
  const blue = material({ color: "#1d4ed8", roughness: 0.5, metalness: 0.08 });
  const ink = material({ color: "#17191e", roughness: 0.36, metalness: 0.18 });
  const metal = material({
    color: "#8b8d95",
    roughness: 0.32,
    metalness: 0.55,
  });
  const white = material({ color: "#f6f6fa", roughness: 0.48 });
  const dark = material({ color: "#080a0f", roughness: 0.8 });
  function roundedShape(w, h, r) {
    const s = new Shape(),
      x = -w / 2,
      y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function block(w, h, d, radius, surface, position, rotation = [0, 0, 0]) {
    const bevel = Math.min(radius / 3, d / 4, 0.035);
    const geometry = new ExtrudeGeometry(
      roundedShape(w - bevel * 2, h - bevel * 2, radius),
      {
        depth: Math.max(0.001, d - bevel * 2),
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel,
        curveSegments: 8,
      },
    );
    geometry.translate(0, 0, -d / 2 + bevel);
    const mesh = new Mesh(geometry, surface);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    assembly.add(mesh);
    return mesh;
  }
  function box(w, h, d, surface, position, rotation = [0, 0, 0]) {
    const mesh = new Mesh(new BoxGeometry(w, h, d), surface);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    assembly.add(mesh);
    return mesh;
  }
  // The entire monitor, stand, printer and plinth are actual depth geometry.
  block(4.4, 0.22, 1.95, 0.075, blue, [0.05, 0.11, 0.12]);
  block(0.95, 0.07, 0.72, 0.055, metal, [-0.45, 0.255, 0.02]);
  box(0.22, 0.58, 0.15, metal, [-0.45, 0.58, -0.15], [-0.2, 0, 0]);
  block(2.89, 1.86, 0.21, 0.09, ink, [-0.45, 1.66, -0.03]);
  block(2.76, 1.73, 0.018, 0.035, dark, [-0.45, 1.66, 0.085]);
  const loader = new TextureLoader();
  const load = async (name) => {
    const texture = await loader.loadAsync(
      new URL(`../img/${name}`, import.meta.url).href,
    );
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    texture.minFilter = LinearFilter;
    return texture;
  };
  let sale, payment;
  try {
    [sale, payment] = await Promise.all([
      load("demo-sale.png"),
      load("demo-payment.png"),
    ]);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  const screenGeometry = new ShapeGeometry(roundedShape(2.7, 1.6875, 0.025), 5);
  const positions = screenGeometry.attributes.position,
    uv = screenGeometry.attributes.uv;
  for (let i = 0; i < positions.count; i++)
    uv.setXY(
      i,
      (positions.getX(i) + 1.35) / 2.7,
      (positions.getY(i) + 0.84375) / 1.6875,
    );
  const display = new MeshBasicMaterial({ map: sale, toneMapped: false });
  const screen = new Mesh(screenGeometry, display);
  screen.position.set(-0.45, 1.66, 0.101);
  assembly.add(screen);
  block(0.1, 0.018, 0.008, 0.005, blue, [0.75, 0.765, 0.081]);
  // Thermal printer: rounded white housing, dark slot, curved paper and a button.
  block(0.86, 0.55, 0.91, 0.08, white, [1.47, 0.5, 0.42]);
  block(0.76, 0.065, 0.81, 0.035, ink, [1.47, 0.79, 0.41]);
  block(0.59, 0.017, 0.11, 0.007, dark, [1.47, 0.83, 0.21]);
  block(0.13, 0.09, 0.015, 0.03, metal, [1.73, 0.57, 0.885]);
  const paperCanvas = document.createElement("canvas");
  paperCanvas.width = 384;
  paperCanvas.height = 640;
  const p = paperCanvas.getContext("2d");
  p.fillStyle = "#fff";
  p.fillRect(0, 0, 384, 640);
  p.fillStyle = "#30343c";
  p.textAlign = "center";
  p.font = "bold 30px sans-serif";
  p.fillText("SMART STORE", 192, 58);
  p.font = "21px monospace";
  p.fillText("ДЕМО · ЧЕК", 192, 99);
  p.textAlign = "left";
  p.font = "20px monospace";
  for (const [i, text] of [
    "Шуруповёрт × 2",
    "Диск × 1",
    "Бур × 1",
    "",
    "ИТОГО  82 300 ₸",
    "Наличные 40 000",
    "Kaspi    42 300",
  ].entries())
    p.fillText(text, 26, 156 + i * 44);
  for (let i = 0, x = 37; i < 56; i++) {
    const w = i % 4 === 0 ? 4 : 2;
    if (i % 3 !== 0) p.fillRect(x, 510, w, 63);
    x += w + 2;
  }
  const paperTexture = new CanvasTexture(paperCanvas);
  paperTexture.colorSpace = SRGBColorSpace;
  const paperMaterial = new MeshBasicMaterial({
    map: paperTexture,
    side: DoubleSide,
    toneMapped: false,
  });
  const vertices = [],
    uvs = [],
    indices = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16,
      y = 0.84 + t * 0.68,
      z = 0.21 + Math.sin(t * Math.PI * 0.65) * 0.16;
    vertices.push(1.47 - 0.27, y, z, 1.47 + 0.27, y, z);
    uvs.push(0, t, 1, t);
    if (i < 16) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const paperGeometry = new BufferGeometry();
  paperGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(vertices, 3),
  );
  paperGeometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  paperGeometry.setIndex(indices);
  paperGeometry.computeVertexNormals();
  assembly.add(new Mesh(paperGeometry, paperMaterial));
  // A compact scanner remains part of the overview, with no extra animation.
  block(0.48, 0.2, 0.32, 0.06, blue, [-1.58, 0.36, 0.69], [0, 0.25, -0.12]);
  block(0.12, 0.12, 0.39, 0.025, blue, [-1.42, 0.3, 0.42], [0, -0.3, 0]);
  block(
    0.37,
    0.105,
    0.012,
    0.025,
    dark,
    [-1.62, 0.36, 0.855],
    [0, 0.25, -0.12],
  );
  // One precomputed translucent contact shadow replaces real-time shadow maps.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sc = shadowCanvas.getContext("2d"),
    gradient = sc.createRadialGradient(64, 64, 15, 64, 64, 64);
  gradient.addColorStop(0, "rgba(29,35,65,.22)");
  gradient.addColorStop(1, "rgba(29,35,65,0)");
  sc.fillStyle = gradient;
  sc.fillRect(0, 0, 128, 128);
  const shadowTexture = new CanvasTexture(shadowCanvas);
  const shadowMaterial = new MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const shadow = new Mesh(new PlaneGeometry(5.6, 3.4), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.015;
  scene.add(shadow);

  // Fit the complete physical assembly, excluding the decorative floor shadow.
  assembly.updateMatrixWorld(true);
  const fitPoints = [];
  assembly.traverse((object) => {
    if (!object.geometry) return;
    object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z])
          fitPoints.push(new Vector3(x, y, z).applyMatrix4(object.matrixWorld));
  });

  let view = "overview",
    draws = 0,
    viewportHeight = 600;
  const landmarks = [
    new Vector3(-1.118, 1.841, 0.11),
    new Vector3(0.25, 2.13, 0.11),
    new Vector3(0.195, 1.011, 0.11),
  ];
  const regions = [
    [253, 197, 473, 510],
    [743, 95, 1385, 307],
    [379, 76, 1051, 443],
  ];
  const target = new Vector3(),
    fromPosition = new Vector3(),
    fromTarget = new Vector3();
  let destination;
  function pose(name) {
    const definitions = {
      overview: {
        target: [0, 1.25, 0.1],
        direction: [0.5, 0.25, 1],
        width: 4.7,
        height: 3,
      },
      0: {
        target: [-1.12, 1.84, 0.11],
        direction: [0.025, 0.015, 1],
        width: 0.56,
        height: 0.64,
      },
      1: {
        target: [0.25, 2.13, 0.11],
        direction: [0.04, 0.015, 1],
        width: 1.3,
        height: 0.66,
      },
      2: {
        target: [-0.45, 2.07, 0.11],
        direction: [0.06, 0.025, 1],
        width: 1.42,
        height: 0.78,
      },
    };
    const spec = definitions[name] || definitions.overview;
    const aim = new Vector3(...spec.target),
      direction = new Vector3(...spec.direction).normalize();
    const tangent = Math.tan((camera.fov * Math.PI) / 360);
    // The controls occupy the top 64px and the return link the bottom 52px.
    // Fit the chosen screen region into the remaining area, rather than under them.
    const top = name === "overview" ? 0 : 64;
    const bottom = name === "overview" ? 0 : 52;
    const available = Math.max(
      0.2,
      (viewportHeight - top - bottom) / viewportHeight,
    );
    let distance = Math.max(
      spec.height / (2 * tangent * 0.87 * available),
      spec.width / (2 * tangent * camera.aspect * 0.87),
    );
    aim.y += ((top - bottom) / viewportHeight) * tangent * distance;
    if (name === "overview") {
      const probe = camera.clone();
      for (let attempt = 0; attempt < 8; attempt++) {
        probe.position.copy(aim).addScaledVector(direction, distance);
        probe.lookAt(aim);
        probe.updateMatrixWorld(true);
        let extent = 0;
        for (const point of fitPoints) {
          const projected = point.clone().project(probe);
          extent = Math.max(
            extent,
            Math.abs(projected.x),
            Math.abs(projected.y),
          );
        }
        if (extent <= 0.88) break;
        distance *= Math.max(1.015, extent / 0.88);
      }
    }
    return {
      position: aim.clone().addScaledVector(direction, distance),
      target: aim,
    };
  }
  destination = pose(view);
  camera.position.copy(destination.position);
  target.copy(destination.target);
  const api = {
    focus(next) {
      view = String(next);
      fromPosition.copy(camera.position);
      fromTarget.copy(target);
      destination = pose(view);
      display.map = view === "2" ? payment : sale;
      display.needsUpdate = true;
    },
    draw(progress = 1) {
      const t =
        progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      camera.position.lerpVectors(fromPosition, destination.position, t);
      target.lerpVectors(fromTarget, destination.target, t);
      camera.lookAt(target);
      renderer.render(scene, camera);
      draws++;
    },
    resize(width, height, pixelRatio = 1) {
      renderer.setPixelRatio(Math.min(2, pixelRatio));
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      viewportHeight = Math.max(1, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      destination = pose(view);
      camera.position.copy(destination.position);
      target.copy(destination.target);
      fromPosition.copy(camera.position);
      fromTarget.copy(target);
    },
    stats() {
      return {
        draws,
        distance: camera.position.distanceTo(target),
        view,
        triangles: renderer.info.render.triangles,
        calls: renderer.info.render.calls,
        landmarks: landmarks.map((point) => {
          const p = point.clone().project(camera);
          return [(p.x + 1) / 2, (1 - p.y) / 2];
        }),
        region:
          view === "overview"
            ? null
            : (() => {
                const [left, top, right, bottom] = regions[Number(view)];
                return [
                  [left, top],
                  [right, top],
                  [right, bottom],
                  [left, bottom],
                ].map(([x, y]) => {
                  const p = new Vector3(
                    -0.45 + (x - 720) * 0.001875,
                    1.66 + (450 - y) * 0.001875,
                    0.11,
                  ).project(camera);
                  return [(p.x + 1) / 2, (1 - p.y) / 2];
                });
              })(),
      };
    },
    dispose() {
      scene.traverse((object) => {
        object.geometry?.dispose();
      });
      for (const m of [...materials, display, paperMaterial, shadowMaterial])
        m.dispose();
      for (const texture of [sale, payment, paperTexture, shadowTexture])
        texture.dispose();
      renderer.dispose();
    },
  };
  return api;
}
