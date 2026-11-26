/** Shared low-poly building blocks: cached geometries and materials, and box helpers. */
import * as THREE from "three";

export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  sph: new THREE.IcosahedronGeometry(0.5, 1),
  sph0: new THREE.IcosahedronGeometry(0.5, 0),
  plane: new THREE.PlaneGeometry(1, 1),
};
export const SHARED_GEOMETRIES = new Set<THREE.BufferGeometry>(Object.values(G));

const MC = new Map<string, THREE.MeshStandardMaterial>();
/** Cached flat-shaded standard material. */
export function M(color: string, o: THREE.MeshStandardMaterialParameters = {}) {
  const k = color + JSON.stringify(o);
  let m = MC.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, flatShading: true, ...o });
    MC.set(k, m);
  }
  return m;
}

export function mk(geo: THREE.BufferGeometry, mat: THREE.Material, par: THREE.Object3D, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  m.receiveShadow = true;
  par.add(m);
  return m;
}

/** Box centred at (x, y, z). */
export function bx(par: THREE.Object3D, col: string | THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, shadow = true) {
  return mk(G.box, typeof col === "string" ? M(col) : col, par, x, y, z, sx, sy, sz, shadow);
}

/** Box with its bottom at y. */
export function bb(par: THREE.Object3D, col: string | THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, shadow = true) {
  return bx(par, col, x, y + sy / 2, z, sx, sy, sz, shadow);
}

export function grp(par: THREE.Object3D, x = 0, z = 0, ry = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  par.add(g);
  return g;
}

export function radialTex(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)", size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let glow: THREE.Texture | null = null;
let blob: THREE.Texture | null = null;
export const glowTex = () => (glow ??= radialTex());
export const blobTex = () => (blob ??= radialTex("rgba(0,0,0,.5)", "rgba(0,0,0,0)"));

/** Palette (RedPen: red ink on warm paper). */
export const PAL = {
  ink: "#C4302B",
  inkGlow: "#ff7a5c",
  amber: "#E39B2D",
  green: "#3E9B5F",
  red: "#D8463A",
  paper: "#f6f1e4",
  paperEdge: "#e2dac6",
  navy: "#243a6b",
  white: "#f4f4f1",
  wood: "#9b6a3f",
  woodDark: "#6e4a2b",
};

/** Mastery % → ring colour (same thresholds as the app: under 50% weak, 60%+ secure). */
export function masteryRing(pct: number) {
  return pct < 50 ? PAL.red : pct < 60 ? PAL.amber : PAL.green;
}
