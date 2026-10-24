// Canonical geometry shared by the initial HTML and manual slide controls.
export const initialPosition = 0.35;
export const wrap = (value, count) => ((value % count) + count) % count;
export function ribbonLayout(count, position = initialPosition) {
  const width = 1000,
    height = 400,
    radius = 280,
    camera = 420;
  const step = 0.85,
    gap = 0.018,
    photoHeight = 150,
    segments = 48;
  const number = (value) => Number(value.toFixed(4));
  return Array.from({ length: count }, (_, index) => {
    const distance = wrap(index - position + count / 2, count) - count / 2;
    const leftAngle = distance * step - (step - gap) / 2;
    const rightAngle = leftAngle + step - gap;
    if (rightAngle < -1.55 || leftAngle > 1.55) return { hidden: true };
    const start = Math.max(leftAngle, -1.55),
      end = Math.min(rightAngle, 1.55);
    const points = Array.from({ length: segments + 1 }, (_, slice) => {
      const angle = start + ((end - start) * slice) / segments;
      const scale = camera / (camera - radius * (1 - Math.cos(angle)));
      return {
        x: width / 2 + radius * Math.sin(angle) * scale,
        top: height / 2 - (photoHeight * scale) / 2,
        bottom: height / 2 + (photoHeight * scale) / 2,
      };
    });
    const left = points[0].x,
      right = points[points.length - 1].x;
    if (right <= 0 || left >= width || right <= left) return { hidden: true };
    const top = Math.min(...points.map((p) => p.top)),
      bottom = Math.max(...points.map((p) => p.bottom));
    const polygon = [
      ...points.map(
        (p) =>
          `${number(((p.x - left) / (right - left)) * 100)}% ${number(((p.top - top) / (bottom - top)) * 100)}%`,
      ),
      ...points
        .slice()
        .reverse()
        .map(
          (p) =>
            `${number(((p.x - left) / (right - left)) * 100)}% ${number(((p.bottom - top) / (bottom - top)) * 100)}%`,
        ),
    ];
    return {
      hidden: false,
      tabIndex: Math.abs(distance) < 1.4 ? 0 : -1,
      style: `left:${number((left / width) * 100)}%;top:${number((top / height) * 100)}%;width:${number(((right - left) / width) * 100)}%;height:${number(((bottom - top) / height) * 100)}%;clip-path:polygon(${polygon.join(",")});`,
    };
  });
}
