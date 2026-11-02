/**
 * Раскладка UV для скина Minecraft (64×64 или 64×32).
 * Для блока w×h×d с левым верхним углом (u,v) грани в текстуре:
 *   right(+x): (u, v+d, d, h)   front(+z): (u+d, v+d, w, h)   left(-x): (u+d+w, v+d, d, h)
 *   back(-z): (u+2d+w, v+d, w, h)   top(+y): (u+d, v, w, d)   bottom(-y): (u+d+w, v, w, d)
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoxFaces {
  px: Rect; // +x
  nx: Rect; // -x
  py: Rect; // +y (top)
  ny: Rect; // -y (bottom)
  pz: Rect; // +z (front)
  nz: Rect; // -z (back)
}

export function boxFaces(u: number, v: number, w: number, h: number, d: number): BoxFaces {
  return {
    px: { x: u, y: v + d, w: d, h },
    pz: { x: u + d, y: v + d, w, h },
    nx: { x: u + d + w, y: v + d, w: d, h },
    nz: { x: u + 2 * d + w, y: v + d, w, h },
    py: { x: u + d, y: v, w, h: d },
    ny: { x: u + d + w, y: v, w, h: d },
  };
}

/** Порядок граней, как у BoxGeometry в three.js: +x, -x, +y, -y, +z, -z. */
export function faceOrder(f: BoxFaces): Rect[] {
  return [f.px, f.nx, f.py, f.ny, f.pz, f.nz];
}

/** Нормализованные UV для 4 вершин грани (порядок BoxGeometry), size — размер текстуры. */
export function rectToUv(r: Rect, texW: number, texH: number): [number, number][] {
  const u0 = r.x / texW;
  const u1 = (r.x + r.w) / texW;
  const v0 = 1 - (r.y + r.h) / texH;
  const v1 = 1 - r.y / texH;
  return [[u0, v1], [u1, v1], [u0, v0], [u1, v0]];
}
