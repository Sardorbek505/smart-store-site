// Static curved windows: a single image copy per photograph, no GPU context.
export function createStaticRenderer(canvas) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;
  return {
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
        const { points, image } = item;
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].top);
        for (const point of points.slice(1)) path.lineTo(point.x, point.top);
        for (const point of points.toReversed())
          path.lineTo(point.x, point.bottom);
        path.closePath();
        if (image) {
          // ImageBitmap dimensions are physical pixels, including srcset/Retina.
          const imageWidth = image.width || image.naturalWidth;
          const imageHeight = image.height || image.naturalHeight;
          const aspect = imageWidth / imageHeight;
          const cropWidth = Math.min(1, item.aspect / aspect);
          const cropHeight = Math.min(1, aspect / item.aspect);
          const start = points[0].u;
          const fraction = points.at(-1).u - start;
          context.save();
          context.clip(path);
          context.drawImage(
            image,
            ((1 - cropWidth) / 2 + cropWidth * start) * imageWidth,
            ((1 - cropHeight) / 2) * imageHeight,
            cropWidth * fraction * imageWidth,
            cropHeight * imageHeight,
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
}
