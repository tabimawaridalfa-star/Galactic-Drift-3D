import * as THREE from 'three';
import type { PlanetKind } from './rules';

// Deterministic seeded PRNG for consistent procedural planets & PBR materials
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * High-speed periodic 2D value-noise & multi-octave fBM generator using a 256x256 power-of-two
 * grid with bitwise wrapping so full 2048x1024 PBR planet generation completes in milliseconds.
 */
class FastPeriodicNoise {
  private readonly grid: Float32Array;
  private readonly size = 256;
  private readonly mask = 255;

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const len = this.size * this.size;
    this.grid = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      this.grid[i] = rand();
    }
  }

  public sample(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const sx = x - xi;
    const sy = y - yi;
    const ux = sx * sx * (3 - 2 * sx);
    const uy = sy * sy * (3 - 2 * sy);

    const m = this.mask;
    const x0 = xi & m;
    const x1 = (x0 + 1) & m;
    const y0 = (yi & m) << 8;
    const y1 = ((yi + 1) & m) << 8;

    const g = this.grid;
    const n00 = g[y0 + x0];
    const n10 = g[y0 + x1];
    const n01 = g[y1 + x0];
    const n11 = g[y1 + x1];

    const ix0 = n00 + (n10 - n00) * ux;
    const ix1 = n01 + (n11 - n01) * ux;
    return ix0 + (ix1 - ix0) * uy;
  }

  public fbm5(u: number, v: number, baseFreqX: number, baseFreqY: number): number {
    let x = u * baseFreqX;
    let y = v * baseFreqY;
    let total = 0;
    total += this.sample(x, y) * 0.516129;
    x *= 2;
    y *= 2;
    total += this.sample(x, y) * 0.258065;
    x *= 2;
    y *= 2;
    total += this.sample(x, y) * 0.129032;
    x *= 2;
    y *= 2;
    total += this.sample(x, y) * 0.064516;
    x *= 2;
    y *= 2;
    total += this.sample(x, y) * 0.032258;
    return total;
  }

  public fbm4(u: number, v: number, baseFreqX: number, baseFreqY: number): number {
    let x = u * baseFreqX;
    let y = v * baseFreqY;
    let total = 0;
    total += this.sample(x, y) * 0.533333;
    x *= 2;
    y *= 2;
    total += this.sample(x, y) * 0.266667;
    x *= 2;
    y *= 2;
    total += this.sample(x, y) * 0.133333;
    x *= 2;
    y *= 2;
    total += this.sample(x, y) * 0.066667;
    return total;
  }

  public ridged4(u: number, v: number, baseFreqX: number, baseFreqY: number): number {
    let x = u * baseFreqX;
    let y = v * baseFreqY;
    let total = 0;
    let n = 1 - Math.abs(this.sample(x, y) * 2 - 1);
    total += n * n * 0.533333;
    x *= 2;
    y *= 2;
    n = 1 - Math.abs(this.sample(x, y) * 2 - 1);
    total += n * n * 0.266667;
    x *= 2;
    y *= 2;
    n = 1 - Math.abs(this.sample(x, y) * 2 - 1);
    total += n * n * 0.133333;
    x *= 2;
    y *= 2;
    n = 1 - Math.abs(this.sample(x, y) * 2 - 1);
    total += n * n * 0.066667;
    return total;
  }
}

export interface PlanetTextureBundle {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap?: THREE.CanvasTexture;
  nightMap?: THREE.CanvasTexture;
  cloudMap?: THREE.CanvasTexture;
  cloudNormalMap?: THREE.CanvasTexture;
  ringMap?: THREE.CanvasTexture;
  moonMap?: THREE.CanvasTexture;
  moonNormalMap?: THREE.CanvasTexture;
}

export interface PbrTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  wrapT: THREE.Wrapping = THREE.ClampToEdgeWrapping
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = wrapT;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function finalizeLinearTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  wrapT: THREE.Wrapping = THREE.ClampToEdgeWrapping
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = wrapT;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/**
 * Converts a 2D heightfield (either a single-channel Uint8Array or RGBA Uint8ClampedArray using R)
 * into a razor-sharp OpenGL Tangent-Space Normal Map (CanvasTexture, NoColorSpace) using a 3x3 Sobel kernel.
 * Horizontally seamless (wraps X) with configurable vertical wrapping (true for tiled armor/rock, false for spheres).
 */
export function heightfieldToNormalMap(
  heightData: Uint8Array | Uint8ClampedArray,
  w: number,
  h: number,
  strength: number,
  maxAnisotropy: number,
  wrapY = false,
  stride = 1
): THREE.CanvasTexture {
  const nCanvas = document.createElement('canvas');
  nCanvas.width = w;
  nCanvas.height = h;
  const nCtx = nCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(w, h);
  const nd = nImg.data;
  const inv255 = 1 / 255;

  for (let y = 0; y < h; y++) {
    const ym1 = wrapY ? (y === 0 ? h - 1 : y - 1) : y === 0 ? 0 : y - 1;
    const yp1 = wrapY ? (y === h - 1 ? 0 : y + 1) : y === h - 1 ? h - 1 : y + 1;
    const rowM1 = ym1 * w;
    const row0 = y * w;
    const rowP1 = yp1 * w;

    for (let x = 0; x < w; x++) {
      const xm1 = x === 0 ? w - 1 : x - 1;
      const xp1 = x === w - 1 ? 0 : x + 1;

      const tl = heightData[(rowM1 + xm1) * stride] * inv255;
      const t = heightData[(rowM1 + x) * stride] * inv255;
      const tr = heightData[(rowM1 + xp1) * stride] * inv255;
      const l = heightData[(row0 + xm1) * stride] * inv255;
      const r = heightData[(row0 + xp1) * stride] * inv255;
      const bl = heightData[(rowP1 + xm1) * stride] * inv255;
      const b = heightData[(rowP1 + x) * stride] * inv255;
      const br = heightData[(rowP1 + xp1) * stride] * inv255;

      // 3x3 Sobel derivatives (canvas Y goes down while Three.js UV.v goes up with flipY=true)
      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      const nx = -dX * strength;
      const ny = dY * strength;
      const nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);

      const idx = (row0 + x) * 4;
      nd[idx] = clampByte((nx * invLen * 0.5 + 0.5) * 255);
      nd[idx + 1] = clampByte((ny * invLen * 0.5 + 0.5) * 255);
      nd[idx + 2] = clampByte((nz * invLen * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;
    }
  }

  nCtx.putImageData(nImg, 0, 0);
  return finalizeLinearTexture(
    nCanvas,
    maxAnisotropy,
    wrapY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  );
}

/**
 * Generates high-resolution (2048x1024 desktop / 1024x512 mobile) PBR planet texture bundles
 * with albedo, sharp relief bumpMap, physically calibrated roughnessMap, and optional
 * high-res emissiveMap, cloud maps, ring maps, and moon maps.
 */
export function generatePlanetTextures(
  kind: PlanetKind,
  maxAnisotropy: number,
  width = 2048,
  height = 1024
): PlanetTextureBundle {
  const w = width;
  const h = height;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const heightBuf = new Uint8Array(w * h);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(w, h);
  const rData = rImg.data;

  let emissiveCanvas: HTMLCanvasElement | undefined;
  let eCtx: CanvasRenderingContext2D | undefined;
  let eImg: ImageData | undefined;
  let eData: Uint8ClampedArray | undefined;

  if (kind === 'pyros' || kind === 'aether') {
    emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = w;
    emissiveCanvas.height = h;
    eCtx = emissiveCanvas.getContext('2d')!;
    eImg = eCtx.createImageData(w, h);
    eData = eImg.data;
  }

  // Terra warm-gold metropolitan night-side city lights map
  let nightCanvas: HTMLCanvasElement | undefined;
  let nCtx: CanvasRenderingContext2D | undefined;
  let nImg: ImageData | undefined;
  let nData: Uint8ClampedArray | undefined;
  if (kind === 'terra') {
    nightCanvas = document.createElement('canvas');
    nightCanvas.width = w;
    nightCanvas.height = h;
    nCtx = nightCanvas.getContext('2d')!;
    nImg = nCtx.createImageData(w, h);
    nData = nImg.data;
  }

  const seedMap: Record<PlanetKind, number> = {
    terra: 1013,
    pyros: 2027,
    cryos: 3037,
    saturnia: 4049,
    rubra: 5059,
    aether: 6067,
  };

  const n1 = new FastPeriodicNoise(seedMap[kind]);
  const n2 = new FastPeriodicNoise(seedMap[kind] + 137);
  const n3 = new FastPeriodicNoise(seedMap[kind] + 419);
  const nCity = kind === 'terra' ? new FastPeriodicNoise(7411) : null;

  // For Rubra, stamp 122 deep multi-scale terraced impact craters onto a fast Float32Array height buffer
  let craterField: Float32Array | null = null;
  let ejectaField: Float32Array | null = null;
  if (kind === 'rubra') {
    craterField = new Float32Array(w * h);
    ejectaField = new Float32Array(w * h);
    const rand = mulberry32(seedMap.rubra + 999);
    const craterCount = 122;
    for (let c = 0; c < craterCount; c++) {
      const cu = rand();
      const cv = 0.08 + rand() * 0.84;
      // Rich power-law crater sizing (ancient deep mega-basins + sharp fresh bowl craters + micro pits)
      const rad = 0.006 + Math.pow(rand(), 2.15) * 0.078;
      const depthScale = 0.78 + rand() * 0.55;
      const latScale = Math.max(0.32, Math.sin(cv * Math.PI));
      const rxPx = Math.ceil((rad / latScale) * w * 1.48);
      const ryPx = Math.ceil(rad * h * 2.0 * 1.48);
      const cxPx = Math.floor(cu * w);
      const cyPx = Math.floor(cv * h);

      const yStart = Math.max(0, cyPx - ryPx);
      const yEnd = Math.min(h - 1, cyPx + ryPx);
      for (let py = yStart; py <= yEnd; py++) {
        const dv = (py / (h - 1) - cv) * 0.5;
        const rowOff = py * w;
        for (let dx = -rxPx; dx <= rxPx; dx++) {
          const px = (cxPx + dx + w * 4) % w;
          const du = (dx / w) * latScale;
          const dist = Math.sqrt(du * du + dv * dv);
          const norm = dist / rad;
          if (norm >= 1.46) continue;

          let delta = 0;
          if (norm < 0.74) {
            // Deep concave sunken bowl with terraced inner wall & central rebound peak on large basins
            const t = norm / 0.74;
            const bowl = 1 - t * t * t;
            delta = -0.52 * depthScale * bowl;
            if (rad > 0.028 && norm < 0.2) {
              delta += 0.22 * depthScale * (1 - norm / 0.2);
            }
          } else if (norm < 1.02) {
            // Sharp raised rocky crater rim wall
            const rimT = 1 - Math.abs((norm - 0.85) / 0.17);
            delta = Math.max(0, rimT) * 0.38 * depthScale;
          } else {
            // Outer ejecta blanket slope
            const slope = 1 - (norm - 1.02) / 0.44;
            delta = slope * slope * 0.12 * depthScale;
            ejectaField[rowOff + px] = Math.min(1, ejectaField[rowOff + px] + slope * 0.5);
          }
          craterField[rowOff + px] += delta;
        }
      }
    }
  }

  const invW = 1 / w;
  const invHm1 = 1 / (h - 1);

  for (let y = 0; y < h; y++) {
    const v = y * invHm1;
    const lat = Math.abs(v - 0.5) * 2; // 0 equator -> 1 pole
    const rowOff = y * w;

    for (let x = 0; x < w; x++) {
      const u = x * invW;
      const pIdx = rowOff + x;
      const idx = pIdx * 4;

      let r = 128;
      let g = 128;
      let b = 128;
      let bump = 128;
      let rough = 200;
      let er = 0;
      let eg = 0;
      let eb = 0;
      let nr = 0;
      let ng = 0;
      let nb = 0;

      if (kind === 'terra') {
        // Domain-warped 5-octave fBM continents + mountain ridges + glossy oceans + warm night city lights
        const warpU = (n2.fbm4(u, v, 8, 4) - 0.5) * 0.055;
        const warpV = (n3.fbm4(u + 0.37, v + 0.19, 8, 4) - 0.5) * 0.055;
        const cont = n1.fbm5(u + warpU, v + warpV, 8, 4);
        const ridge = n2.ridged4(u, v, 16, 8);
        const micro = n3.fbm4(u, v, 32, 16);
        const elev = cont * 0.72 + micro * 0.16 + ridge * 0.12;
        const polarMask = lat + (micro - 0.5) * 0.16 + (cont - 0.5) * 0.12;

        if (polarMask > 0.855) {
          // Polar ice caps & glaciers
          const iceTone = 0.88 + micro * 0.12;
          r = clampByte(218 * iceTone + 22);
          g = clampByte(230 * iceTone + 20);
          b = clampByte(242 * iceTone + 13);
          bump = clampByte(155 + ridge * 45);
          rough = clampByte(88 + micro * 38);
        } else if (elev < 0.505) {
          // Deep cobalt ocean -> turquoise continental shelf (low roughness for solar glint!)
          const depth = elev / 0.505;
          const shelf = depth > 0.86 ? (depth - 0.86) / 0.14 : 0;
          r = clampByte(6 + depth * 14 + shelf * 28);
          g = clampByte(30 + depth * 64 + shelf * 76);
          b = clampByte(78 + depth * 96 + shelf * 46);
          bump = clampByte(68 + micro * 8);
          rough = clampByte(44 + micro * 22); // Specular sunlit ocean!
        } else if (elev < 0.532) {
          // Warm sandy coastline & lagoons
          const t = (elev - 0.505) / 0.027;
          r = clampByte(168 + t * 32 - micro * 16);
          g = clampByte(158 + t * 24 - micro * 14);
          b = clampByte(116 + t * 14);
          bump = clampByte(106 + t * 22);
          rough = clampByte(212 + micro * 24);
        } else if (elev < 0.71) {
          // Rich biome gradient: equatorial lush forest -> arid ochre belts -> temperate plains
          const t = (elev - 0.532) / 0.178;
          const aridBelt = Math.max(0, 1 - Math.abs(lat - 0.34) * 4.5) * (0.45 + micro * 0.55);
          const forestR = 26 + t * 44 + micro * 24;
          const forestG = 86 + t * 42 - micro * 20;
          const forestB = 34 + t * 18;
          const desertR = 176 + micro * 36;
          const desertG = 142 + micro * 26;
          const desertB = 92 + micro * 18;
          r = clampByte(forestR + (desertR - forestR) * aridBelt);
          g = clampByte(forestG + (desertG - forestG) * aridBelt);
          b = clampByte(forestB + (desertB - forestB) * aridBelt);
          bump = clampByte(126 + t * 52 + ridge * 32);
          rough = clampByte(214 + micro * 30); // Matte continents
        } else {
          // Rugged alpine mountain ranges & snow peaks
          const t = Math.min(1, (elev - 0.71) / 0.24);
          const snow = Math.max(0, (t - 0.48) / 0.52);
          const rockR = 88 + ridge * 46;
          const rockG = 82 + ridge * 44;
          const rockB = 78 + ridge * 42;
          r = clampByte(rockR + (242 - rockR) * snow);
          g = clampByte(rockG + (246 - rockG) * snow);
          b = clampByte(rockB + (252 - rockB) * snow);
          bump = clampByte(188 + t * 42 + ridge * 25);
          rough = clampByte(228 - snow * 88);
        }

        // Procedural warm golden night-side city lights clustered along habitable coasts & lowlands
        if (nCity && elev >= 0.508 && elev < 0.685 && polarMask < 0.73) {
          const coastalBonus = elev < 0.555 ? 0.22 : 0.0;
          const regionMask = nCity.fbm4(u + 0.13, v + 0.07, 14, 7) + coastalBonus;
          if (regionMask > 0.56) {
            const urbanCluster = nCity.fbm4(u, v, 64, 32);
            const highwayWeb = Math.pow(nCity.ridged4(u, v, 38, 19), 5.2);
            const pinpoint = nCity.sample(u * 210, v * 105);
            const metroCore =
              urbanCluster > 0.62 && pinpoint > 0.48
                ? Math.pow((urbanCluster - 0.62) / 0.38, 1.35) * (0.55 + pinpoint * 0.75)
                : 0;
            const corridor = highwayWeb > 0.28 && urbanCluster > 0.48 ? (highwayWeb - 0.28) * 1.15 : 0;
            const cityGlow = Math.min(1, (metroCore * 1.45 + corridor * 0.65) * ((regionMask - 0.54) / 0.46));
            if (cityGlow > 0.04) {
              const hot = cityGlow * cityGlow;
              nr = clampByte(cityGlow * 255);
              ng = clampByte(cityGlow * 172 + hot * 68);
              nb = clampByte(cityGlow * 62 + hot * 95);
            }
          }
        }
      } else if (kind === 'pyros') {
        // High-res volcanic obsidian crust with sharp branching glowing magma rivers
        const warpU = (n3.fbm4(u, v, 10, 5) - 0.5) * 0.045;
        const warpV = (n3.fbm4(u + 0.5, v + 0.2, 10, 5) - 0.5) * 0.045;
        const tectonic = n1.ridged4(u + warpU, v + warpV, 12, 6);
        const fineCracks = n2.ridged4(u, v, 28, 14);
        const basalt = n3.fbm5(u, v, 24, 12);

        const river = Math.max(
          Math.pow(tectonic, 3.6),
          Math.pow(fineCracks, 5.2) * 0.92
        );

        if (river > 0.34) {
          const hot = Math.min(1, (river - 0.34) / 0.48);
          const core = Math.pow(hot, 1.6);
          r = clampByte(215 + core * 40);
          g = clampByte(48 + hot * 145 + core * 55);
          b = clampByte(6 + core * 135);
          bump = clampByte(42 + (1 - hot) * 35);
          rough = clampByte(64 + (1 - hot) * 58);

          // High-resolution emissive magma rivers
          er = clampByte(220 + core * 35);
          eg = clampByte(52 + hot * 135 + core * 62);
          eb = clampByte(8 + core * 120);
        } else {
          // Charred dark volcanic basalt & cooled slag crust
          const crust = basalt * 0.65 + (1 - tectonic) * 0.35;
          r = clampByte(24 + crust * 36);
          g = clampByte(18 + crust * 24);
          b = clampByte(21 + crust * 24);
          bump = clampByte(112 + crust * 115 + fineCracks * 28);
          rough = clampByte(212 + basalt * 38);
          if (river > 0.23) {
            const ember = (river - 0.23) / 0.11;
            er = clampByte(ember * ember * 165);
            eg = clampByte(ember * ember * 26);
            eb = 0;
          }
        }
      } else if (kind === 'cryos') {
        // Gleaming glacial ice planet with specular ice plains & deep cyan-teal crevasses
        const warpU = (n3.fbm4(u, v, 8, 4) - 0.5) * 0.04;
        const warpV = (n3.fbm4(u + 0.4, v + 0.1, 8, 4) - 0.5) * 0.04;
        const sheet = n1.fbm5(u + warpU, v + warpV, 10, 5);
        const fracture = n2.ridged4(u + warpU * 0.5, v + warpV * 0.5, 22, 11);
        const frost = n3.fbm4(u, v, 36, 18);

        if (fracture > 0.72) {
          // Deep glassy turquoise glacial crevasses
          const depth = Math.min(1, (fracture - 0.72) / 0.28);
          r = clampByte(46 + (1 - depth) * 65);
          g = clampByte(154 + (1 - depth) * 55);
          b = clampByte(206 + (1 - depth) * 35);
          bump = clampByte(45 + (1 - depth) * 50);
          rough = clampByte(42 + depth * 26); // Sharp glossy ice canyon
        } else {
          const snowCover = sheet > 0.58 ? (sheet - 0.58) / 0.42 : 0;
          r = clampByte(138 + sheet * 82 + snowCover * 32);
          g = clampByte(198 + sheet * 44 + snowCover * 12);
          b = clampByte(226 + sheet * 26);
          bump = clampByte(126 + sheet * 62 + frost * 44 + fracture * 20);
          // Glossy blue glacier vs powdery matte snow drifts
          rough = clampByte(52 + snowCover * 130 + frost * 34);
        }
      } else if (kind === 'saturnia') {
        // High-res turbulent banded gas giant + swirling oval storm vortex
        const turb1 = n1.fbm5(u, v, 14, 7) - 0.5;
        const turb2 = n2.fbm4(u + turb1 * 0.12, v, 28, 14) - 0.5;
        const zonalV = v + turb1 * 0.055 + turb2 * 0.018;

        // Great swirling storm oval at southern mid-latitude
        let sdu = u - 0.36;
        if (sdu > 0.5) sdu -= 1;
        if (sdu < -0.5) sdu += 1;
        const sdv = (v - 0.62) * 1.9;
        const stormDist = Math.sqrt(sdu * sdu * 120 + sdv * sdv * 380);
        const stormFactor = stormDist < 1 ? (1 - stormDist) * (1 - stormDist) : 0;
        const stormSwirl = stormFactor * Math.sin(stormDist * 14 + Math.atan2(sdv, sdu) * 2);

        const b1 = Math.sin(zonalV * Math.PI * 16) * 0.5 + 0.5;
        const b2 = Math.cos(zonalV * Math.PI * 34 + turb1 * 4.5) * 0.5 + 0.5;
        const b3 = Math.sin(zonalV * Math.PI * 62) * 0.5 + 0.5;
        const mixVal = b1 * 0.56 + b2 * 0.3 + b3 * 0.14;
        const polarCool = Math.max(0, (lat - 0.68) / 0.32);

        r = clampByte(154 + mixVal * 88 + stormFactor * 36 + stormSwirl * 16 - polarCool * 56);
        g = clampByte(116 + mixVal * 82 + stormFactor * 10 + stormSwirl * 10 - polarCool * 34);
        b = clampByte(72 + mixVal * 58 - stormFactor * 16 + polarCool * 32);
        bump = clampByte(116 + mixVal * 30 + turb2 * 24 + stormFactor * 22);
        rough = clampByte(188 + (1 - mixVal) * 40 - stormFactor * 22);
      } else if (kind === 'rubra') {
        // Martian rust plains, dark basaltic maria, rocky mesas, and deep sculpted craters
        const base = n1.fbm5(u, v, 10, 5);
        const ridge = n2.ridged4(u, v, 20, 10);
        const grit = n3.fbm4(u, v, 44, 22);
        const cDelta = craterField ? craterField[pIdx] : 0;
        const ejecta = ejectaField ? ejectaField[pIdx] : 0;

        const hVal = Math.max(0, Math.min(1, base * 0.56 + ridge * 0.22 + grit * 0.16 + cDelta + 0.08));
        const maria = base < 0.42 ? (0.42 - base) / 0.42 : 0;
        const bowlShadow = cDelta < -0.08 ? Math.min(1, (-cDelta - 0.08) * 1.45) : 0;

        r = clampByte(106 + hVal * 124 + ejecta * 38 - maria * 38 - bowlShadow * 46);
        g = clampByte(42 + hVal * 68 + ejecta * 26 - maria * 18 - bowlShadow * 22);
        b = clampByte(26 + hVal * 40 + ejecta * 16 - maria * 8 - bowlShadow * 14);
        bump = clampByte(32 + hVal * 204 + ridge * 19);
        rough = clampByte(218 + grit * 34 - ejecta * 24);
      } else {
        // Aether: dark mineral crust + sharp glossy crystalline amethyst/cyan veins
        const warpU = (n3.fbm4(u, v, 12, 6) - 0.5) * 0.04;
        const warpV = (n3.fbm4(u + 0.3, v + 0.7, 12, 6) - 0.5) * 0.04;
        const facet = n1.ridged4(u + warpU, v + warpV, 14, 7);
        const veins = n2.ridged4(u, v, 26, 13);
        const grain = n3.fbm4(u, v, 36, 18);

        const crystal = Math.max(Math.pow(facet, 2.2), Math.pow(veins, 3.0));
        r = clampByte(34 + crystal * 146 + grain * 18);
        g = clampByte(18 + crystal * 72 + grain * 14);
        b = clampByte(66 + crystal * 174 + grain * 22);
        bump = clampByte(96 + crystal * 138 + grain * 22);
        // Glossy exposed crystal veins vs dark matte obsidian rock
        rough = clampByte(212 - crystal * 172);

        if (crystal > 0.62) {
          const glow = (crystal - 0.62) / 0.38;
          const g2 = glow * glow;
          er = clampByte(g2 * 175 + glow * 35);
          eg = clampByte(g2 * 96 + glow * 28);
          eb = clampByte(g2 * 255);
        }
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;

      heightBuf[pIdx] = bump;

      rData[idx] = rough;
      rData[idx + 1] = rough;
      rData[idx + 2] = rough;
      rData[idx + 3] = 255;

      if (eData) {
        eData[idx] = er;
        eData[idx + 1] = eg;
        eData[idx + 2] = eb;
        eData[idx + 3] = 255;
      }

      if (nData) {
        nData[idx] = nr;
        nData[idx + 1] = ng;
        nData[idx + 2] = nb;
        nData[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  if (eCtx && eImg) eCtx.putImageData(eImg, 0, 0);
  if (nCtx && nImg) nCtx.putImageData(nImg, 0, 0);

  const normalStrengthMap: Record<PlanetKind, number> = {
    terra: 3.6,
    pyros: 4.8,
    cryos: 4.2,
    saturnia: 1.1,
    rubra: 5.8,
    aether: 4.6,
  };

  const bundle: PlanetTextureBundle = {
    map: finalizeColorTexture(albedoCanvas, maxAnisotropy),
    normalMap: heightfieldToNormalMap(
      heightBuf,
      w,
      h,
      normalStrengthMap[kind],
      maxAnisotropy,
      false,
      1
    ),
    roughnessMap: finalizeLinearTexture(roughCanvas, maxAnisotropy),
  };

  if (emissiveCanvas) {
    bundle.emissiveMap = finalizeColorTexture(emissiveCanvas, maxAnisotropy);
  }
  if (nightCanvas) {
    bundle.nightMap = finalizeColorTexture(nightCanvas, maxAnisotropy);
  }

  if (kind === 'terra') {
    const clouds = generateCloudTextures(maxAnisotropy, w, h);
    bundle.cloudMap = clouds.map;
    bundle.cloudNormalMap = clouds.normalMap;
  }
  if (kind === 'saturnia') {
    bundle.ringMap = generateRingTexture(maxAnisotropy);
  }
  if (kind === 'aether') {
    const moon = generateMoonTextures(maxAnisotropy, Math.max(512, w >> 2), Math.max(256, h >> 2));
    bundle.moonMap = moon.map;
    bundle.moonNormalMap = moon.normalMap;
  }

  return bundle;
}

function generateCloudTextures(
  maxAnisotropy: number,
  w: number,
  h: number
): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const heightBuf = new Uint8Array(w * h);

  const n1 = new FastPeriodicNoise(8819);
  const n2 = new FastPeriodicNoise(9137);
  const invW = 1 / w;
  const invHm1 = 1 / (h - 1);

  for (let y = 0; y < h; y++) {
    const v = y * invHm1;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const u = x * invW;
      // Domain-warped trade-wind cloud bands and cyclones
      const swirlU = (n2.fbm4(u, v, 10, 5) - 0.5) * 0.085;
      const swirlV = (n2.fbm4(u + 0.4, v + 0.2, 10, 5) - 0.5) * 0.045;
      const n = n1.fbm5(u + swirlU, v + swirlV, 12, 6);
      const density = n > 0.52 ? Math.min(1, (n - 0.52) / 0.34) : 0;
      const alpha = clampByte(Math.pow(density, 0.85) * 242);
      const puff = clampByte(110 + density * 145);

      const pIdx = rowOff + x;
      const idx = pIdx * 4;
      d[idx] = 246;
      d[idx + 1] = 250;
      d[idx + 2] = 255;
      d[idx + 3] = alpha;

      heightBuf[pIdx] = puff;
    }
  }

  ctx.putImageData(img, 0, 0);
  return {
    map: finalizeColorTexture(canvas, maxAnisotropy),
    normalMap: heightfieldToNormalMap(heightBuf, w, h, 2.2, maxAnisotropy, false, 1),
  };
}

function generateRingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(4409);

  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    let alpha = 0;
    const fineBand =
      Math.sin(t * 185) * 0.12 +
      Math.cos(t * 370) * 0.07 +
      Math.sin(t * 620) * 0.04 +
      (rand() - 0.5) * 0.05;

    if (t > 0.05 && t < 0.14) {
      // Inner C-ring faint icy veil
      alpha = 0.18 + fineBand * 0.5;
    } else if (t >= 0.14 && t < 0.48) {
      // Dense bright B-ring
      alpha = 0.66 + fineBand;
    } else if (t > 0.54 && t < 0.83) {
      // Crisp A-ring outside Cassini division
      alpha = 0.48 + fineBand * 0.9;
    } else if (t > 0.855 && t < 0.95) {
      // Outer ring beyond Encke gap
      alpha = 0.34 + fineBand * 0.7;
    }

    const edgeFade = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
    alpha = Math.max(0, Math.min(0.92, alpha * (0.45 + edgeFade * 0.55)));

    const r = clampByte(224 + Math.sin(t * 68) * 18 + Math.cos(t * 140) * 8);
    const g = clampByte(196 + Math.cos(t * 58) * 18 + Math.sin(t * 110) * 8);
    const b = clampByte(148 + Math.sin(t * 88) * 20);

    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function generateMoonTextures(
  maxAnisotropy: number,
  w: number,
  h: number
): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const heightBuf = new Uint8Array(w * h);

  const n1 = new FastPeriodicNoise(9193);
  const n2 = new FastPeriodicNoise(9209);
  const invW = 1 / w;
  const invHm1 = 1 / (h - 1);

  for (let y = 0; y < h; y++) {
    const v = y * invHm1;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const u = x * invW;
      const base = n1.fbm4(u, v, 10, 5);
      const ridge = n2.ridged4(u, v, 18, 9);
      const val = base * 0.68 + ridge * 0.32;
      const pIdx = rowOff + x;
      const idx = pIdx * 4;

      d[idx] = clampByte(132 + val * 96);
      d[idx + 1] = clampByte(124 + val * 88);
      d[idx + 2] = clampByte(162 + val * 86);
      d[idx + 3] = 255;

      heightBuf[pIdx] = clampByte(70 + val * 185);
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    map: finalizeColorTexture(canvas, maxAnisotropy),
    normalMap: heightfieldToNormalMap(heightBuf, w, h, 4.0, maxAnisotropy, false, 1),
  };
}

/**
 * Generates procedural "Sci-Fi Hull Plating" PBR textures (albedo, sharp panel seam bumpMap,
 * and brushed/riveted roughnessMap) for the player starfighter and Dreadnought Boss.
 */
export function generateHullPlatingTextures(
  theme: 'fighter' | 'dreadnought',
  maxAnisotropy: number,
  size = 1024
): PbrTextureSet {
  const s = size;
  const scale = s / 512;
  const rand = mulberry32(theme === 'fighter' ? 7717 : 8831);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = s;
  albedoCanvas.height = s;
  const aCtx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = s;
  bumpCanvas.height = s;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = s;
  roughCanvas.height = s;
  const rCtx = roughCanvas.getContext('2d')!;

  // Base metallic alloy fill
  aCtx.fillStyle = theme === 'fighter' ? '#cbd6e4' : '#344157';
  aCtx.fillRect(0, 0, s, s);
  bCtx.fillStyle = '#929292';
  bCtx.fillRect(0, 0, s, s);
  rCtx.fillStyle = theme === 'fighter' ? '#565656' : '#5e5e5e'; // ~0.34 - 0.37 roughness
  rCtx.fillRect(0, 0, s, s);

  const fighterTones = ['#d8e2ee', '#c5d1e0', '#b4c3d6', '#e4ecf4', '#9eb1c6'];
  const bossTones = ['#3b4962', '#2f3b52', '#4a5a78', '#263145', '#556787'];
  const tones = theme === 'fighter' ? fighterTones : bossTones;

  // 1. Structured aerospace armor plate grid (seamless modulo tiling)
  const cols = 4;
  const rows = 4;
  const cellW = s / cols;
  const cellH = s / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = col * cellW;
      const py = row * cellH;
      const tone = tones[(row * 3 + col * 5 + Math.floor(rand() * 3)) % tones.length];

      aCtx.fillStyle = tone;
      aCtx.fillRect(px + 2 * scale, py + 2 * scale, cellW - 4 * scale, cellH - 4 * scale);

      // Subtle height & roughness variation per armor plate
      const bShade = 136 + Math.floor(rand() * 36);
      bCtx.fillStyle = `rgb(${bShade},${bShade},${bShade})`;
      bCtx.fillRect(px + 2 * scale, py + 2 * scale, cellW - 4 * scale, cellH - 4 * scale);

      const rShade = theme === 'fighter' ? 62 + Math.floor(rand() * 44) : 78 + Math.floor(rand() * 52);
      rCtx.fillStyle = `rgb(${rShade},${rShade},${rShade})`;
      rCtx.fillRect(px + 2 * scale, py + 2 * scale, cellW - 4 * scale, cellH - 4 * scale);

      // Sub-panels & access hatches inside half the cells
      if ((row + col) % 2 === 0) {
        const subX = px + cellW * 0.14;
        const subY = py + cellH * 0.18;
        const subW = cellW * 0.72;
        const subH = cellH * 0.64;

        aCtx.fillStyle = tones[(row + col + 2) % tones.length];
        aCtx.fillRect(subX, subY, subW, subH);

        // Recessed hatch seam
        aCtx.strokeStyle = theme === 'fighter' ? 'rgba(18, 28, 44, 0.55)' : 'rgba(6, 9, 16, 0.85)';
        aCtx.lineWidth = 1.6 * scale;
        aCtx.strokeRect(subX, subY, subW, subH);

        bCtx.fillStyle = '#b4b4b4';
        bCtx.fillRect(subX, subY, subW, subH);
        bCtx.strokeStyle = '#282828';
        bCtx.lineWidth = 2.0 * scale;
        bCtx.strokeRect(subX, subY, subW, subH);

        rCtx.strokeStyle = '#d4d4d4';
        rCtx.lineWidth = 2.0 * scale;
        rCtx.strokeRect(subX, subY, subW, subH);
      } else {
        // Fine cooling louver slats
        const louverX = px + cellW * 0.2;
        const louverY = py + cellH * 0.26;
        const louverW = cellW * 0.6;
        const slatH = 4 * scale;
        for (let k = 0; k < 5; k++) {
          const ly = louverY + k * 9 * scale;
          aCtx.fillStyle = theme === 'fighter' ? 'rgba(20, 34, 54, 0.42)' : 'rgba(7, 10, 18, 0.78)';
          aCtx.fillRect(louverX, ly, louverW, slatH);
          bCtx.fillStyle = '#2c2c2c';
          bCtx.fillRect(louverX, ly, louverW, slatH);
          rCtx.fillStyle = '#c8c8c8';
          rCtx.fillRect(louverX, ly, louverW, slatH);
        }
      }

      // Corner metallic rivets / fasteners
      const inset = 10 * scale;
      const rivetPts = [
        [px + inset, py + inset],
        [px + cellW - inset, py + inset],
        [px + inset, py + cellH - inset],
        [px + cellW - inset, py + cellH - inset],
        [px + cellW * 0.5, py + inset],
        [px + cellW * 0.5, py + cellH - inset],
      ];
      for (const [rx, ry] of rivetPts) {
        aCtx.fillStyle = theme === 'fighter' ? 'rgba(30, 46, 68, 0.45)' : 'rgba(110, 126, 152, 0.42)';
        aCtx.beginPath();
        aCtx.arc(rx, ry, 2.0 * scale, 0, Math.PI * 2);
        aCtx.fill();

        bCtx.fillStyle = '#e8e8e8';
        bCtx.beginPath();
        bCtx.arc(rx, ry, 2.2 * scale, 0, Math.PI * 2);
        bCtx.fill();

        rCtx.fillStyle = '#282828';
        rCtx.beginPath();
        rCtx.arc(rx, ry, 2.0 * scale, 0, Math.PI * 2);
        rCtx.fill();
      }
    }
  }

  // 2. Primary deep hull seam lines & edge specular wear highlight
  aCtx.strokeStyle = theme === 'fighter' ? 'rgba(16, 26, 42, 0.72)' : 'rgba(5, 8, 15, 0.92)';
  aCtx.lineWidth = 2.6 * scale;
  bCtx.strokeStyle = '#181818';
  bCtx.lineWidth = 3.2 * scale;
  rCtx.strokeStyle = '#dcdcdc';
  rCtx.lineWidth = 3.2 * scale;

  for (let i = 0; i <= cols; i++) {
    const x = i * cellW;
    aCtx.beginPath();
    aCtx.moveTo(x, 0);
    aCtx.lineTo(x, s);
    aCtx.stroke();
    bCtx.beginPath();
    bCtx.moveTo(x, 0);
    bCtx.lineTo(x, s);
    bCtx.stroke();
    rCtx.beginPath();
    rCtx.moveTo(x, 0);
    rCtx.lineTo(x, s);
    rCtx.stroke();

    // Crisp metallic chamfer edge highlight beside seam
    aCtx.strokeStyle = theme === 'fighter' ? 'rgba(255,255,255,0.34)' : 'rgba(186,204,228,0.36)';
    aCtx.lineWidth = 1.2 * scale;
    aCtx.beginPath();
    aCtx.moveTo(x + 2.4 * scale, 0);
    aCtx.lineTo(x + 2.4 * scale, s);
    aCtx.stroke();
    aCtx.strokeStyle = theme === 'fighter' ? 'rgba(16, 26, 42, 0.72)' : 'rgba(5, 8, 15, 0.92)';
    aCtx.lineWidth = 2.6 * scale;
  }

  for (let j = 0; j <= rows; j++) {
    const y = j * cellH;
    aCtx.beginPath();
    aCtx.moveTo(0, y);
    aCtx.lineTo(s, y);
    aCtx.stroke();
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.lineTo(s, y);
    bCtx.stroke();
    rCtx.beginPath();
    rCtx.moveTo(0, y);
    rCtx.lineTo(s, y);
    rCtx.stroke();
  }

  // 3. Crisp aerospace accent stripes, beveled panel chamfers & technical markings
  if (theme === 'fighter') {
    // Sleek cobalt/cyan dual racing stripe & hazard micro-chevrons
    aCtx.fillStyle = 'rgba(14, 165, 233, 0.56)';
    aCtx.fillRect(0, cellH * 1.42, s, 6.0 * scale);
    aCtx.fillStyle = 'rgba(224, 242, 254, 0.72)';
    aCtx.fillRect(0, cellH * 1.42 - 2.6 * scale, s, 1.6 * scale);
    aCtx.fillStyle = 'rgba(56, 189, 248, 0.34)';
    aCtx.fillRect(0, cellH * 3.12, s, 3.0 * scale);

    // Subtle amber/white technical maintenance stencils on alternating cells
    aCtx.fillStyle = 'rgba(251, 191, 36, 0.62)';
    aCtx.fillRect(cellW * 0.16, cellH * 0.08, cellW * 0.24, 2.2 * scale);
    aCtx.fillRect(cellW * 2.16, cellH * 2.08, cellW * 0.24, 2.2 * scale);
  } else {
    aCtx.fillStyle = 'rgba(249, 115, 22, 0.42)';
    aCtx.fillRect(0, cellH * 1.44, s, 5.0 * scale);
    aCtx.fillStyle = 'rgba(239, 68, 68, 0.32)';
    aCtx.fillRect(0, cellH * 3.12, s, 2.8 * scale);
  }

  // 4. Directional brushed-metal micro-grain streaks
  for (let i = 0; i < 480; i++) {
    const y = rand() * s;
    const x = rand() * s;
    const len = (24 + rand() * 84) * scale;
    const bright = rand() > 0.5;
    aCtx.fillStyle = bright
      ? theme === 'fighter'
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(180,200,235,0.05)'
      : 'rgba(0,0,0,0.06)';
    aCtx.fillRect(x, y, len, 1.2 * scale);

    rCtx.fillStyle = bright ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    rCtx.fillRect(x, y, len, 1.2 * scale);
  }

  const hullHeightRgba = bCtx.getImageData(0, 0, s, s).data;

  return {
    map: finalizeColorTexture(albedoCanvas, maxAnisotropy, THREE.RepeatWrapping),
    normalMap: heightfieldToNormalMap(
      hullHeightRgba,
      s,
      s,
      theme === 'fighter' ? 2.8 : 3.4,
      maxAnisotropy,
      true,
      4
    ),
    roughnessMap: finalizeLinearTexture(roughCanvas, maxAnisotropy, THREE.RepeatWrapping),
  };
}

/**
 * Generates a crisp transparent aerospace decal sheet ("GD-07" hull designation,
 * tactical squadron chevrons, and micro warning stencils) for the player starfighter.
 */
export function generateHullDecalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  // Diagonal tactical racing stripe & sharp chevron
  ctx.fillStyle = 'rgba(14, 165, 233, 0.88)';
  ctx.beginPath();
  ctx.moveTo(28, 34);
  ctx.lineTo(138, 34);
  ctx.lineTo(116, 62);
  ctx.lineTo(28, 62);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.fillRect(28, 70, 82, 5);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.fillRect(118, 70, 26, 5);

  // Crisp stenciled hull designation "GD-07"
  ctx.font = '700 84px "Chakra Petch", "Arial Black", sans-serif';
  ctx.fillStyle = 'rgba(241, 245, 249, 0.94)';
  ctx.textBaseline = 'middle';
  ctx.fillText('GD-07', 160, 128);

  // Technical sub-stencil bar
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(125, 211, 252, 0.88)';
  ctx.fillText('VANGUARD INTERCEPTOR // MK-IV', 164, 182);

  // Micro caution ticks
  ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(32 + i * 16, 178, 9, 9);
  }

  return finalizeColorTexture(canvas, maxAnisotropy, THREE.ClampToEdgeWrapping);
}

/**
 * Generates a high-resolution procedural emissive micro-window & corridor light strip texture
 * (1024x128) depicting hundreds of illuminated deck portholes, hangar bays, and warm/cool
 * interior bridge strips for colossal Boss Dreadnought scale readability.
 */
export function generateDreadnoughtWindowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(4099);

  // Dark recessed armor bulkhead channel
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal deck tier separator lines
  const decks = 5;
  const deckH = h / decks;
  for (let d = 0; d < decks; d++) {
    const yBase = d * deckH + deckH * 0.24;
    const winH = Math.max(3, Math.floor(deckH * 0.36));

    // Clustered deck sections separated by armored structural ribs
    let x = 8;
    while (x < w - 12) {
      const bayWidth = 42 + Math.floor(rand() * 88);
      const bayActive = rand() > 0.22;

      if (bayActive) {
        const isWarm = rand() > 0.42;
        const isAmberCorridor = rand() > 0.78;
        let wx = x;
        while (wx < Math.min(w - 10, x + bayWidth)) {
          const lit = rand() > 0.26;
          const winW = isAmberCorridor ? 10 + Math.floor(rand() * 14) : 3 + Math.floor(rand() * 5);
          if (lit) {
            const bright = 0.55 + rand() * 0.45;
            if (isAmberCorridor) {
              ctx.fillStyle = `rgba(255, ${Math.round(165 + bright * 55)}, ${Math.round(68 + bright * 45)}, ${bright.toFixed(2)})`;
            } else if (isWarm) {
              ctx.fillStyle = `rgba(255, ${Math.round(220 + bright * 30)}, ${Math.round(165 + bright * 50)}, ${bright.toFixed(2)})`;
            } else {
              ctx.fillStyle = `rgba(${Math.round(160 + bright * 75)}, ${Math.round(220 + bright * 32)}, 255, ${bright.toFixed(2)})`;
            }
            ctx.fillRect(wx, yBase, winW, winH);
          }
          wx += winW + 3 + Math.floor(rand() * 4);
        }
      }

      // Armored rib gap between window clusters
      x += bayWidth + 14 + Math.floor(rand() * 26);
    }
  }

  return finalizeColorTexture(canvas, maxAnisotropy, THREE.RepeatWrapping);
}

/**
 * Generates an organic, soft-feathered volumetric-style deep-space nebula cloud texture
 * (zero rectangular border artifacts) for 3D parallax space clouds.
 */
export function generateNebulaCloudTexture(variant: 0 | 1 | 2): THREE.CanvasTexture {
  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(s, s);
  const d = img.data;

  const n1 = new FastPeriodicNoise(variant === 0 ? 6101 : variant === 1 ? 6217 : 6337);
  const n2 = new FastPeriodicNoise(variant === 0 ? 6133 : variant === 1 ? 6247 : 6359);

  // Subtle deep cosmic palettes (indigo-cobalt, violet-magenta, deep teal-cyan)
  const palettes: Array<[[number, number, number], [number, number, number]]> = [
    [
      [34, 92, 205],
      [104, 52, 196],
    ],
    [
      [24, 138, 174],
      [52, 82, 188],
    ],
    [
      [134, 54, 188],
      [212, 92, 132],
    ],
  ];
  const [cA, cB] = palettes[variant];

  const invS = 1 / s;
  for (let y = 0; y < s; y++) {
    const v = y * invS;
    const dy = (v - 0.5) * 2;
    for (let x = 0; x < s; x++) {
      const u = x * invS;
      const dx = (u - 0.5) * 2;
      const r2 = dx * dx + dy * dy;
      const idx = (y * s + x) * 4;
      if (r2 >= 1) {
        d[idx] = 0;
        d[idx + 1] = 0;
        d[idx + 2] = 0;
        d[idx + 3] = 0;
        continue;
      }

      const radial = Math.pow(1 - r2, 2.25);
      const warp = n2.fbm4(u, v, 3, 3);
      const cloud = n1.fbm5((u + warp * 0.18) % 1, (v + warp * 0.14) % 1, 4, 4);
      const wisp = Math.max(0, (cloud - 0.28) / 0.72);
      const alpha = Math.pow(wisp, 1.35) * radial;

      const mixT = Math.max(0, Math.min(1, warp * 1.15));
      d[idx] = clampByte(cA[0] + (cB[0] - cA[0]) * mixT);
      d[idx + 1] = clampByte(cA[1] + (cB[1] - cA[1]) * mixT);
      d[idx + 2] = clampByte(cA[2] + (cB[2] - cA[2]) * mixT);
      d[idx + 3] = clampByte(alpha * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a cinematic wide horizontal sci-fi anamorphic lens flare streak (1024x256)
 * with cool cyan-blue optical dispersion wings, warm solar core, and subtle ghost rings.
 */
export function generateAnamorphicFlareTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const cx = w * 0.5;
  const cy = h * 0.5;

  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'screen';

  // Wide cyan-indigo optical anamorphic streak
  const wideGrad = ctx.createLinearGradient(24, cy, w - 24, cy);
  wideGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
  wideGrad.addColorStop(0.18, 'rgba(56, 189, 248, 0.20)');
  wideGrad.addColorStop(0.38, 'rgba(147, 197, 253, 0.48)');
  wideGrad.addColorStop(0.5, 'rgba(255, 251, 235, 0.96)');
  wideGrad.addColorStop(0.62, 'rgba(147, 197, 253, 0.48)');
  wideGrad.addColorStop(0.82, 'rgba(56, 189, 248, 0.20)');
  wideGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = wideGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.48, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Razor-thin incandescent central filament
  const coreGrad = ctx.createLinearGradient(140, cy, w - 140, cy);
  coreGrad.addColorStop(0, 'rgba(255, 240, 200, 0)');
  coreGrad.addColorStop(0.35, 'rgba(255, 245, 220, 0.58)');
  coreGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
  coreGrad.addColorStop(0.65, 'rgba(255, 245, 220, 0.58)');
  coreGrad.addColorStop(1, 'rgba(255, 240, 200, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.36, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft warm central solar bloom core
  const centerGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 92);
  centerGlow.addColorStop(0, 'rgba(255, 252, 240, 0.85)');
  centerGlow.addColorStop(0.35, 'rgba(255, 214, 145, 0.26)');
  centerGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = centerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, 92, 0, Math.PI * 2);
  ctx.fill();

  // Delicate symmetric optical ghost bokeh rings along the anamorphic axis
  for (const offset of [-210, 210, -320, 320]) {
    const gx = cx + offset;
    const r = Math.abs(offset) > 250 ? 18 : 26;
    const ghost = ctx.createRadialGradient(gx, cy, r * 0.55, gx, cy, r);
    ghost.addColorStop(0, 'rgba(56, 189, 248, 0)');
    ghost.addColorStop(0.75, 'rgba(125, 211, 252, 0.14)');
    ghost.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = ghost;
    ctx.beginPath();
    ctx.arc(gx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates high-detail porous space rock PBR textures (albedo, sharp pitted bumpMap,
 * and dusty regolith + metallic ore roughnessMap) for organic asteroids.
 */
export function generateAsteroidTextures(
  maxAnisotropy: number,
  size = 512
): PbrTextureSet {
  const s = size;
  const c1 = document.createElement('canvas');
  c1.width = s;
  c1.height = s;
  const ctx1 = c1.getContext('2d')!;
  const img1 = ctx1.createImageData(s, s);

  const heightBuf = new Uint8Array(s * s);

  const c3 = document.createElement('canvas');
  c3.width = s;
  c3.height = s;
  const ctx3 = c3.getContext('2d')!;
  const img3 = ctx3.createImageData(s, s);

  const n1 = new FastPeriodicNoise(5557);
  const n2 = new FastPeriodicNoise(5779);
  const n3 = new FastPeriodicNoise(5923);

  // Stamp micro-pores / small rocky pockmarks onto a fast Float32Array
  const poreField = new Float32Array(s * s);
  const rand = mulberry32(5641);
  for (let i = 0; i < 110; i++) {
    const cx = Math.floor(rand() * s);
    const cy = Math.floor(rand() * s);
    const rad = Math.max(2, Math.floor((0.012 + Math.pow(rand(), 2.2) * 0.055) * s));
    for (let dy = -rad; dy <= rad; dy++) {
      const py = (cy + dy + s) % s;
      const row = py * s;
      for (let dx = -rad; dx <= rad; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / rad;
        if (d >= 1) continue;
        const px = (cx + dx + s) % s;
        const pit = d < 0.78 ? -(1 - (d / 0.78) * (d / 0.78)) * 0.42 : (1 - Math.abs((d - 0.88) / 0.12)) * 0.22;
        poreField[row + px] += pit;
      }
    }
  }

  const invS = 1 / s;
  for (let y = 0; y < s; y++) {
    const v = y * invS;
    const row = y * s;
    for (let x = 0; x < s; x++) {
      const u = x * invS;
      const pIdx = row + x;
      const idx = pIdx * 4;

      const rock = n1.fbm5(u, v, 8, 8);
      const ridge = n2.ridged4(u, v, 16, 16);
      const micro = n3.fbm4(u, v, 32, 32);
      const hVal = Math.max(0, Math.min(1, rock * 0.56 + ridge * 0.24 + micro * 0.2 + poreField[pIdx]));

      // Subtle mineral iron-nickel fleck glints
      const oreGlint = ridge > 0.78 && micro > 0.64 ? 1 : 0;

      const tone = 58 + hVal * 112;
      img1.data[idx] = clampByte(tone * 1.05 + oreGlint * 28);
      img1.data[idx + 1] = clampByte(tone * 0.99 + oreGlint * 24);
      img1.data[idx + 2] = clampByte(tone * 0.93 + oreGlint * 18);
      img1.data[idx + 3] = 255;

      heightBuf[pIdx] = clampByte(hVal * 255);

      const rough = oreGlint ? 98 : clampByte(208 + (1 - hVal) * 44);
      img3.data[idx] = rough;
      img3.data[idx + 1] = rough;
      img3.data[idx + 2] = rough;
      img3.data[idx + 3] = 255;
    }
  }

  ctx1.putImageData(img1, 0, 0);
  ctx3.putImageData(img3, 0, 0);

  return {
    map: finalizeColorTexture(c1, maxAnisotropy, THREE.RepeatWrapping),
    normalMap: heightfieldToNormalMap(heightBuf, s, s, 4.4, maxAnisotropy, true, 1),
    roughnessMap: finalizeLinearTexture(c3, maxAnisotropy, THREE.RepeatWrapping),
  };
}

export function generateRadialGlowTexture(
  innerRgba: string,
  midRgba: string,
  outerRgba: string,
  size = 256
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 1, half, half, half);
  grad.addColorStop(0, innerRgba);
  grad.addColorStop(0.28, midRgba);
  grad.addColorStop(1, outerRgba);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a refined cinematic optical sun flare (anamorphic streak + delicate star diffraction spikes).
 */
export function generateSolarFlareTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const cx = w * 0.5;
  const cy = h * 0.5;

  // Soft golden core halo
  const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, 220);
  core.addColorStop(0, 'rgba(255, 252, 238, 0.95)');
  core.addColorStop(0.14, 'rgba(255, 224, 152, 0.58)');
  core.addColorStop(0.38, 'rgba(255, 168, 72, 0.16)');
  core.addColorStop(1, 'rgba(255, 120, 30, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);

  // Elegant crisp horizontal anamorphic optical streak (feathered cleanly to 0 before edge)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const streak = ctx.createLinearGradient(cx - 224, cy, cx + 224, cy);
  streak.addColorStop(0, 'rgba(255, 200, 120, 0)');
  streak.addColorStop(0.22, 'rgba(255, 212, 142, 0.14)');
  streak.addColorStop(0.42, 'rgba(255, 236, 195, 0.48)');
  streak.addColorStop(0.5, 'rgba(255, 252, 238, 0.85)');
  streak.addColorStop(0.58, 'rgba(255, 236, 195, 0.48)');
  streak.addColorStop(0.78, 'rgba(255, 212, 142, 0.14)');
  streak.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 224, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle 6-point optical diffraction rays
  for (const ang of [Math.PI / 3, -Math.PI / 3]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const ray = ctx.createLinearGradient(-136, 0, 136, 0);
    ray.addColorStop(0, 'rgba(255, 220, 160, 0)');
    ray.addColorStop(0.32, 'rgba(255, 232, 184, 0.14)');
    ray.addColorStop(0.5, 'rgba(255, 246, 220, 0.34)');
    ray.addColorStop(0.68, 'rgba(255, 232, 184, 0.14)');
    ray.addColorStop(1, 'rgba(255, 220, 160, 0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.ellipse(0, 0, 136, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
