export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1100;
const MIN_WIDTH = 400;

export const FULL_VIEW: View = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Width between 400 and 1600, the aspect of the map, and always inside it. */
export function clampView(view: View): View {
  const width = clamp(view.width, MIN_WIDTH, MAP_WIDTH);
  const height = (width * MAP_HEIGHT) / MAP_WIDTH;
  return {
    x: clamp(view.x, 0, MAP_WIDTH - width),
    y: clamp(view.y, 0, MAP_HEIGHT - height),
    width,
    height,
  };
}

/** A factor below 1 zooms in. The map point stays where it is on screen. */
export function zoomAt(view: View, factor: number, point: Point): View {
  const width = clamp(view.width * factor, MIN_WIDTH, MAP_WIDTH);
  const scale = width / view.width;
  return clampView({
    x: point.x - (point.x - view.x) * scale,
    y: point.y - (point.y - view.y) * scale,
    width,
    height: view.height * scale,
  });
}

export function panBy(view: View, dx: number, dy: number): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy });
}

export function centerOn(view: View, point: Point): View {
  return clampView({ ...view, x: point.x - view.width / 2, y: point.y - view.height / 2 });
}

export function viewCenter(view: View): Point {
  return { x: view.x + view.width / 2, y: view.y + view.height / 2 };
}

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** Screen pixels per map unit for an svg using xMidYMid meet. */
export function pixelsPerUnit(view: View, box: Box): number {
  return Math.min(box.width / view.width, box.height / view.height);
}

export function screenToMap(view: View, box: Box, clientX: number, clientY: number): Point {
  const scale = pixelsPerUnit(view, box);
  if (!scale) return viewCenter(view);
  return {
    x: view.x + (clientX - box.left - (box.width - view.width * scale) / 2) / scale,
    y: view.y + (clientY - box.top - (box.height - view.height * scale) / 2) / scale,
  };
}
