import * as THREE from 'three';
import {
  PLANET_CONFIGS,
  type GraphicsQualityConfig,
  type PlanetConfig,
  type PlanetKind,
  getMoonPosition,
} from './rules';
import { createBossDreadnought, type DreadnoughtBossRig } from './boss';
import {
  generateAnamorphicFlareTexture,
  generateAsteroidTextures,
  generateNebulaCloudTexture,
  generatePlanetTextures,
  generateRadialGlowTexture,
  generateSolarFlareTexture,
  type PbrTextureSet,
  type PlanetTextureBundle,
} from './textures';
import { createAuroraCurtainMaterial } from './shaders';

export interface PlanetSceneObject {
  config: PlanetConfig;
  group: THREE.Group;
  surfaceMesh: THREE.Mesh;
  surfaceMat: THREE.MeshStandardMaterial;
  cloudMesh?: THREE.Mesh;
  cloudMat?: THREE.MeshStandardMaterial;
  moonMesh?: THREE.Mesh;
  moonMat?: THREE.MeshStandardMaterial;
  ringMesh?: THREE.Mesh;
  ringMat?: THREE.MeshStandardMaterial;
  ringDust?: THREE.Points;
  auroraGroup?: THREE.Group;
  auroraMat?: THREE.ShaderMaterial;
  volcanicEmbers?: THREE.Points;
  emberSeeds?: Float32Array;
  crystalField?: THREE.InstancedMesh;
  crystalOrbitData?: Array<{
    angle: number;
    radius: number;
    inclination: number;
    speed: number;
    scale: number;
    spin: number;
  }>;
  scanRing: THREE.Mesh;
  scanRingMat: THREE.MeshBasicMaterial;
  atmosphereMat: THREE.ShaderMaterial;
  textures: PlanetTextureBundle;
  terraNightUniforms?: {
    uNightMap: { value: THREE.Texture };
    uSunDir: { value: THREE.Vector3 };
  };
}

export interface DestructibleAsteroid {
  id: number;
  planetId: PlanetKind;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  orbitCenter: THREE.Vector3;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  orbitElevation: number;
  rotSpeed: THREE.Vector3;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  hitFlash: number;
}

export type DroneArchetype = 'interceptor' | 'orbiter' | 'sniper';

export interface EnemyDrone {
  id: number;
  planetId: PlanetKind;
  archetype: DroneArchetype;
  group: THREE.Group;
  eyeMat: THREE.MeshBasicMaterial;
  bodyMat: THREE.MeshStandardMaterial;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  homePos: THREE.Vector3;
  orbitPhase: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  dyingTimer: number; // > 0 during KO spiral dissolve
  fireCooldown: number;
  telegraphTimer: number; // > 0 while winding up high-speed shot
  hitFlash: number;
}

export interface SolarSystemWorld {
  planets: PlanetSceneObject[];
  asteroids: DestructibleAsteroid[];
  drones: EnemyDrone[];
  bossRig: DreadnoughtBossRig;
  sunGroup: THREE.Group;
  keyLight: THREE.DirectionalLight;
  sunDirGlobal: THREE.Vector3;
  starfield: THREE.Points;
  ambientBelt: THREE.InstancedMesh;
  spawnEscortDrone: (origin: THREE.Vector3) => boolean;
  updateAmbient: (
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    cameraForward?: THREE.Vector3
  ) => void;
  applyQuality: (
    qualityConfig: GraphicsQualityConfig,
    maxAnisotropy: number,
    pixelRatio: number
  ) => void;
  setPixelRatio: (pixelRatio: number) => void;
  resetEntities: () => void;
  dispose: () => void;
}

/**
 * Sharp procedural deep-space Milky Way GLSL skybox shader evaluated per screen pixel.
 * Produces deep velvety space black, a diagonal Milky Way band with dark cosmic dust rifts,
 * subtle indigo/cobalt/teal nebula wisps, and razor-sharp micro background stars (zero blurry canvas stretching).
 */
function createDeepSpaceSkyboxMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      varying vec3 vDir;

      float hash31(vec3 p) {
        p = fract(p * vec3(443.897, 441.423, 437.195));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);

        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);
        return mix(nxy0, nxy1, f.z);
      }

      float fbm3(vec3 p) {
        float val = noise3(p) * 0.55;
        p = p * 2.06 + vec3(13.7, -7.3, 5.1);
        val += noise3(p) * 0.30;
        p = p * 2.04 + vec3(-6.1, 11.3, -4.7);
        val += noise3(p) * 0.15;
        return val;
      }

      float fbm2(vec3 p) {
        float val = noise3(p) * 0.66;
        p = p * 2.12 + vec3(9.3, -5.7, 7.1);
        val += noise3(p) * 0.34;
        return val;
      }

      void main() {
        vec3 d = normalize(vDir);

        // Deep cosmic obsidian base gradient
        vec3 col = mix(vec3(0.008, 0.012, 0.026), vec3(0.018, 0.026, 0.056), smoothstep(-0.8, 0.9, d.y));

        // Tilted galactic plane coordinate for realistic Milky Way arc
        vec3 galNormal = normalize(vec3(0.28, 0.86, 0.42));
        float planeDist = abs(dot(d, galNormal));
        float band = exp(-planeDist * 5.8);
        float wideBand = exp(-planeDist * 2.2);

        if (wideBand > 0.025) {
          float neb1 = fbm3(d * 3.4);
          float neb2 = fbm2(d * 7.2 + vec3(neb1 * 1.35));
          float dustRift = band > 0.03 ? smoothstep(0.42, 0.68, fbm2(d * 8.6 + vec3(3.1, -2.4, 1.8))) : 0.0;

          // Layered cosmic nebula hues: deep royal blue, violet-plum, subtle teal & warm galactic core
          vec3 deepCobalt = vec3(0.05, 0.14, 0.34);
          vec3 cosmicViolet = vec3(0.18, 0.08, 0.32);
          vec3 oceanTeal = vec3(0.04, 0.22, 0.28);
          vec3 warmCore = vec3(0.36, 0.26, 0.18);

          float coreFocus = pow(max(0.0, dot(d, normalize(vec3(-0.42, -0.18, -0.88)))), 2.8);
          vec3 milkyColor = mix(deepCobalt, cosmicViolet, smoothstep(0.32, 0.72, neb1));
          milkyColor = mix(milkyColor, oceanTeal, smoothstep(0.45, 0.82, neb2) * 0.52);
          milkyColor += warmCore * coreFocus * 0.85;

          // Apply dark absorption dust lanes slicing through the bright Milky Way band
          float bandIntensity = band * (0.42 + 0.88 * neb2) * (1.0 - dustRift * 0.64);
          col += milkyColor * bandIntensity * 0.92;
          col += mix(deepCobalt, cosmicViolet, neb2) * wideBand * neb1 * 0.24;
        }

        // Subtle solar scatter wash in skybox direction of sun
        float sunAmt = max(0.0, dot(d, uSunDir));
        col += vec3(0.24, 0.17, 0.09) * pow(sunAmt, 14.0);

        // Crisp procedural micro background starfield dust (analytic, zero pixelation)
        vec3 cell = floor(d * 260.0);
        vec3 f = fract(d * 260.0) - 0.5;
        float rnd = hash31(cell);
        if (rnd > 0.962) {
          float distSq = dot(f, f);
          float star = exp(-distSq * 46.0) * smoothstep(0.962, 1.0, rnd);
          vec3 tint = mix(vec3(0.75, 0.86, 1.0), vec3(1.0, 0.92, 0.76), fract(rnd * 97.3));
          col += tint * star * (0.58 + band * 1.15);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

/**
 * Custom GLSL Starfield ShaderMaterial producing razor-sharp circular stars with varied
 * blackbody temperatures, soft airy-disk falloff, diffraction cross on hero stars, and gentle twinkle.
 */
function createStarfieldMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: `
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vHero;

      void main() {
        vColor = aColor;
        float tw = 0.78 + 0.22 * sin(uTime * (1.4 + mod(aPhase, 1.9)) + aPhase * 6.2831);
        vTwinkle = tw;
        vHero = step(14.5, aSize);

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float atten = 1950.0 / max(220.0, -mvPosition.z);
        gl_PointSize = clamp(aSize * atten * uPixelRatio, 1.3, 28.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vHero;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;

        // Razor-sharp circular core + smooth airy glow halo
        float core = smoothstep(0.24, 0.0, d);
        float halo = pow(max(0.0, 1.0 - d * 2.0), 2.8) * 0.65;

        // Delicate 4-point optical diffraction cross on brightest stars
        float spikeX = exp(-abs(uv.y) * 28.0) * exp(-abs(uv.x) * 4.5);
        float spikeY = exp(-abs(uv.x) * 28.0) * exp(-abs(uv.y) * 4.5);
        float spikes = (spikeX + spikeY) * 0.48 * vHero;

        float alpha = clamp((core + halo + spikes) * vTwinkle, 0.0, 1.0);
        vec3 finalCol = mix(vColor, vec3(1.0, 0.99, 0.97), core * 0.72) * (0.95 + core * 0.55);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
}

/**
 * Animated procedural solar photosphere shader with churning multi-octave convective
 * plasma granulation, fiery prominence veins, sunspot lanes & incandescent limb darkening.
 */
function createSunPhotosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = normalize(position);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float v = noise(p) * 0.52;
        p = p * 2.15 + vec3(7.3, -4.1, 3.7);
        v += noise(p) * 0.28;
        p = p * 2.18 + vec3(-5.9, 8.2, -6.1);
        v += noise(p) * 0.14;
        p = p * 2.25 + vec3(3.1, 2.7, 9.4);
        v += noise(p) * 0.06;
        return v;
      }

      void main() {
        vec3 drift = vec3(uTime * 0.075, -uTime * 0.055, uTime * 0.062);
        vec3 warp = vec3(
          fbm(vLocalPos * 4.2 + drift),
          fbm(vLocalPos * 4.2 - drift * 0.8 + vec3(5.2)),
          fbm(vLocalPos * 4.2 + drift * 0.6 + vec3(-3.7))
        );
        float cells = fbm(vLocalPos * 9.5 + warp * 1.45 + drift * 1.4);
        float filaments = 1.0 - abs(noise(vLocalPos * 16.0 + warp * 2.1 - drift * 1.9) * 2.0 - 1.0);
        float boil = clamp(cells * 0.72 + pow(filaments, 2.2) * 0.36, 0.0, 1.0);

        float ndv = max(0.0, dot(vNormal, vViewDir));
        float limb = pow(ndv, 0.52);
        float chromoRim = pow(1.0 - ndv, 2.6);

        vec3 coreWhite = vec3(1.82, 1.68, 1.32);
        vec3 midGold = vec3(1.52, 0.94, 0.26);
        vec3 deepAmber = vec3(1.18, 0.36, 0.06);
        vec3 chromoRed = vec3(1.55, 0.34, 0.08);

        vec3 col = mix(deepAmber, midGold, smoothstep(0.08, 0.68, limb * (0.65 + boil * 0.6)));
        col = mix(col, coreWhite, smoothstep(0.46, 0.98, limb * (0.58 + boil * 0.72)));
        col += chromoRed * chromoRim * (0.45 + filaments * 0.65);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    fog: false,
  });
}

/**
 * Physically inspired outer Rayleigh/Mie Fresnel atmospheric scattering halo (BackSide).
 * Brightly illuminates the sunlit crescent rim and emits warm orange-crimson Sunset Terminator
 * Scattering along the narrow day-night twilight boundary (especially vivid on Terra).
 */
function createAtmosphereHaloMaterial(
  hexColor: string,
  sunDirection: THREE.Vector3,
  intensity = 0.92,
  sunsetStrength = 0.28
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hexColor) },
      uSunDir: { value: sunDirection.clone().normalize() },
      uIntensity: { value: intensity },
      uSunsetStrength: { value: sunsetStrength },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uSunDir;
      uniform float uIntensity;
      uniform float uSunsetStrength;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        float facing = max(0.0, dot(-vNormal, vViewDir));
        float sunDot = dot(vWorldNormal, uSunDir);
        float sunLit = smoothstep(-0.28, 0.62, sunDot);
        float terminatorBand = exp(-pow((sunDot + 0.03) * 4.4, 2.0));

        float scatter = pow(facing, 3.5) * uIntensity * (0.14 + 1.05 * sunLit + terminatorBand * uSunsetStrength * 0.55);
        vec3 sunsetHue = vec3(1.18, 0.42, 0.16);
        vec3 scatterCol = mix(uColor, sunsetHue, clamp(terminatorBand * uSunsetStrength, 0.0, 0.92));
        scatterCol = mix(scatterCol, vec3(1.0, 0.98, 0.94), sunLit * facing * 0.22);
        gl_FragColor = vec4(scatterCol * (0.9 + 0.35 * sunLit), scatter);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/**
 * Crisp inner surface-hugging Fresnel atmospheric limb veil (FrontSide).
 * Follows the directional sun vector with a realistic sunlit atmospheric horizon and
 * warm orange-red Sunset Terminator Scattering hugging the twilight boundary.
 */
function createFresnelRimMaterial(
  hexColor: string,
  sunDirection: THREE.Vector3,
  intensity = 0.95,
  sunsetStrength = 0.3
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hexColor) },
      uSunDir: { value: sunDirection.clone().normalize() },
      uIntensity: { value: intensity },
      uSunsetStrength: { value: sunsetStrength },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uSunDir;
      uniform float uIntensity;
      uniform float uSunsetStrength;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 3.4);
        float sunDot = dot(vWorldNormal, uSunDir);
        float sunFactor = smoothstep(-0.24, 0.58, sunDot);
        float terminatorGlow = exp(-pow((sunDot + 0.02) * 4.8, 2.0));

        float alpha = fresnel * uIntensity * (0.1 + 1.02 * sunFactor + terminatorGlow * uSunsetStrength * 0.55);
        vec3 sunsetCol = vec3(1.25, 0.44, 0.14);
        vec3 col = mix(uColor, sunsetCol, clamp(terminatorGlow * uSunsetStrength, 0.0, 0.94));
        col = mix(col, vec3(1.0, 0.99, 0.95), sunFactor * fresnel * 0.30);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false,
  });
}

/**
 * Generates an organic rocky asteroid BufferGeometry using multi-frequency 3D ridged
 * noise displacement + carved impact depressions (no flat low-poly rock silhouettes).
 */
function createOrganicAsteroidGeometry(detail: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;

  // Deterministic impact crater directions on the boulder
  const craterDirs = [
    new THREE.Vector3(0.75, 0.45, 0.48).normalize(),
    new THREE.Vector3(-0.68, 0.52, -0.51).normalize(),
    new THREE.Vector3(0.18, -0.88, 0.44).normalize(),
    new THREE.Vector3(-0.42, -0.35, 0.84).normalize(),
    new THREE.Vector3(0.55, -0.25, -0.79).normalize(),
  ];
  const craterRadii = [0.46, 0.38, 0.42, 0.34, 0.32];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    // Multi-frequency organic elongation + craggy ridged noise
    const macro =
      Math.sin(nx * 2.7 + ny * 1.9) * 0.14 +
      Math.cos(nz * 2.9 - nx * 2.1) * 0.12 +
      Math.sin(ny * 3.4 + nz * 2.4) * 0.08;
    const mid =
      (1 - Math.abs(Math.sin(nx * 6.4 + ny * 5.2 + nz * 4.8))) * 0.095 +
      Math.cos(nx * 8.1 - nz * 7.3 + ny * 4.2) * 0.045;
    const fine = Math.sin(nx * 14.5 + ny * 12.1) * Math.cos(nz * 13.7) * 0.024;

    let craterOffset = 0;
    for (let c = 0; c < craterDirs.length; c++) {
      const cd = craterDirs[c];
      const dot = nx * cd.x + ny * cd.y + nz * cd.z;
      const angDist = Math.acos(Math.max(-1, Math.min(1, dot)));
      const r = craterRadii[c];
      if (angDist < r) {
        const t = angDist / r;
        if (t < 0.72) {
          craterOffset -= 0.14 * (1 - (t / 0.72) * (t / 0.72));
        } else {
          craterOffset += 0.055 * (1 - Math.abs((t - 0.86) / 0.14));
        }
      }
    }

    const disp = 0.96 + macro + mid + fine + craterOffset;
    // Slight non-uniform triaxial asteroid proportions
    pos.setXYZ(i, nx * disp * 1.12, ny * disp * 0.88, nz * disp * 1.02);
  }

  geo.computeVertexNormals();
  return geo;
}

function createDroneMesh(archetype: DroneArchetype): {
  group: THREE.Group;
  eyeMat: THREE.MeshBasicMaterial;
  bodyMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  const palette =
    archetype === 'interceptor'
      ? { body: 0x2c1720, accent: 0xef4444, eye: 0xff3b3b }
      : archetype === 'orbiter'
      ? { body: 0x292216, accent: 0xf59e0b, eye: 0xfbbf24 }
      : { body: 0x22183a, accent: 0xc084fc, eye: 0xe879f9 };

  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette.body,
    roughness: 0.36,
    metalness: 0.82,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: palette.accent,
    emissive: palette.accent,
    emissiveIntensity: 0.55,
    roughness: 0.22,
    metalness: 0.85,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: palette.eye, toneMapped: false });

  if (archetype === 'interceptor') {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.45, 0), bodyMat);
    core.scale.set(1.1, 0.7, 1.7);
    group.add(core);

    const wingGeo = new THREE.BoxGeometry(5.2, 0.22, 1.25);
    const wings = new THREE.Mesh(wingGeo, accentMat);
    wings.position.set(0, 0, 0.35);
    group.add(wings);

    const fangGeo = new THREE.ConeGeometry(0.28, 1.9, 5);
    fangGeo.rotateX(-Math.PI / 2);
    for (const s of [-1, 1]) {
      const fang = new THREE.Mesh(fangGeo, bodyMat);
      fang.position.set(s * 1.4, 0, -1.6);
      group.add(fang);
    }

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 10), eyeMat);
    eye.position.set(0, 0.15, -1.25);
    group.add(eye);
  } else if (archetype === 'orbiter') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 0), bodyMat);
    group.add(core);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.22, 8, 22), accentMat);
    ring.rotation.x = Math.PI / 2.2;
    group.add(ring);

    const podGeo = new THREE.BoxGeometry(0.65, 0.65, 1.4);
    for (const s of [-1, 1]) {
      const pod = new THREE.Mesh(podGeo, bodyMat);
      pod.position.set(s * 2.55, 0, 0);
      group.add(pod);
    }

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 10), eyeMat);
    eye.position.set(0, 0, -1.35);
    group.add(eye);
  } else {
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 2.8, 6), bodyMat);
    core.rotation.x = Math.PI / 2;
    group.add(core);

    const finGeo = new THREE.BoxGeometry(0.28, 2.6, 1.6);
    for (let k = 0; k < 3; k++) {
      const angle = (k * Math.PI * 2) / 3;
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.position.set(Math.cos(angle) * 1.8, Math.sin(angle) * 1.8, 0.2);
      fin.rotation.z = angle + Math.PI / 2;
      group.add(fin);
    }

    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), eyeMat);
    eye.position.set(0, 0, -1.65);
    group.add(eye);
  }

  return { group, eyeMat, bodyMat };
}

function disposePlanetTextureBundle(bundle: PlanetTextureBundle): void {
  bundle.map.dispose();
  bundle.normalMap.dispose();
  bundle.roughnessMap.dispose();
  bundle.emissiveMap?.dispose();
  bundle.nightMap?.dispose();
  bundle.cloudMap?.dispose();
  bundle.cloudNormalMap?.dispose();
  bundle.ringMap?.dispose();
  bundle.moonMap?.dispose();
  bundle.moonNormalMap?.dispose();
}

export function buildSolarSystemWorld(
  scene: THREE.Scene,
  maxAnisotropy: number,
  qualityConfig: GraphicsQualityConfig,
  pixelRatio: number
): SolarSystemWorld {
  const disposables: Array<{ dispose: () => void }> = [];

  const sunPos = new THREE.Vector3(680, 290, -1350);
  const sunDirGlobal = sunPos.clone().normalize();

  // 1. Razor-Sharp Procedural Deep-Space GLSL Milky Way Skybox
  const skyGeo = new THREE.SphereGeometry(2800, 48, 32);
  const skyMat = createDeepSpaceSkyboxMaterial(sunDirGlobal);
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);
  disposables.push(skyGeo, skyMat);

  // 2. High-Resolution Custom GLSL Starfield (up to 4,800 crisp twinkling stars)
  const maxStars = 4800;
  const starPositions = new Float32Array(maxStars * 3);
  const starColors = new Float32Array(maxStars * 3);
  const starSizes = new Float32Array(maxStars);
  const starPhases = new Float32Array(maxStars);

  // Realistic stellar blackbody temperatures (O/B blue-white, A pure white, F warm white, K gold, M soft peach)
  const starPalette = [
    new THREE.Color('#b8dcff'),
    new THREE.Color('#e2f0ff'),
    new THREE.Color('#ffffff'),
    new THREE.Color('#fff5e0'),
    new THREE.Color('#ffd38c'),
    new THREE.Color('#ffb899'),
  ];

  for (let i = 0; i < maxStars; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = 1400 + Math.random() * 1050;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const c = starPalette[i % starPalette.length];
    const bright = 0.62 + Math.random() * 0.38;
    starColors[i * 3] = c.r * bright;
    starColors[i * 3 + 1] = c.g * bright;
    starColors[i * 3 + 2] = c.b * bright;

    // Power-law apparent magnitude sizing: many crisp pinpoints + rare dazzling hero stars
    const magRand = Math.random();
    starSizes[i] =
      magRand > 0.965
        ? 15.0 + Math.random() * 6.0
        : magRand > 0.82
        ? 7.5 + Math.random() * 5.0
        : 3.4 + Math.random() * 3.8;
    starPhases[i] = Math.random();
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
  starGeo.setDrawRange(0, qualityConfig.starCount);

  const starMat = createStarfieldMaterial(pixelRatio);
  const starfield = new THREE.Points(starGeo, starMat);
  starfield.frustumCulled = false;
  scene.add(starfield);
  disposables.push(starGeo, starMat);

  // 3. Distant Crisp Sun (animated GLSL photosphere + dynamic anamorphic sci-fi lens flare)
  const sunGroup = new THREE.Group();
  sunGroup.position.copy(sunPos);

  const sunGeo = new THREE.SphereGeometry(86, 48, 36);
  const sunMat = createSunPhotosphereMaterial();
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunGroup.add(sunMesh);

  const flareTex = generateSolarFlareTexture();
  const flareMat = new THREE.SpriteMaterial({
    map: flareTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    fog: false,
  });
  const flareSprite = new THREE.Sprite(flareMat);
  flareSprite.scale.set(640, 640, 1);
  sunGroup.add(flareSprite);

  // Dynamic horizontal sci-fi anamorphic lens flare (intensifies smoothly when camera faces the Sun)
  const anamorphicTex = generateAnamorphicFlareTexture();
  const anamorphicMat = new THREE.SpriteMaterial({
    map: anamorphicTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const anamorphicSprite = new THREE.Sprite(anamorphicMat);
  anamorphicSprite.scale.set(1650, 340, 1);
  anamorphicSprite.renderOrder = 10;
  sunGroup.add(anamorphicSprite);

  const outerCoronaTex = generateRadialGlowTexture(
    'rgba(255, 224, 155, 0.28)',
    'rgba(255, 158, 62, 0.10)',
    'rgba(180, 60, 20, 0)',
    256
  );
  const outerCoronaMat = new THREE.SpriteMaterial({
    map: outerCoronaTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const outerCoronaSprite = new THREE.Sprite(outerCoronaMat);
  outerCoronaSprite.scale.set(820, 820, 1);
  sunGroup.add(outerCoronaSprite);
  scene.add(sunGroup);
  disposables.push(
    sunGeo,
    sunMat,
    flareTex,
    flareMat,
    anamorphicTex,
    anamorphicMat,
    outerCoronaTex,
    outerCoronaMat
  );

  // 3a. 3D Parallax Deep-Space Volumetric Nebula Clouds (subtle drifting spatial depth)
  const nebulaCloudGroup = new THREE.Group();
  const nebulaCloudTextures = [
    generateNebulaCloudTexture(0),
    generateNebulaCloudTexture(1),
    generateNebulaCloudTexture(2),
  ];
  const nebulaCloudPlanes: Array<{ mesh: THREE.Mesh; baseRotZ: number; speed: number }> = [];
  const nebulaPlaneGeo = new THREE.PlaneGeometry(1, 1);
  disposables.push(nebulaPlaneGeo, ...nebulaCloudTextures);

  const nebulaPlacements: Array<[number, number, number, number, 0 | 1 | 2, number]> = [
    [-580, 180, -960, 740, 0, 0.24],
    [540, -140, -1040, 820, 1, 0.22],
    [-820, -210, -480, 780, 2, 0.20],
    [780, 260, -420, 720, 0, 0.19],
    [120, 420, -880, 680, 1, 0.18],
    [-340, -340, -1120, 760, 2, 0.21],
    [680, 90, 320, 690, 1, 0.17],
    [-720, 220, 260, 740, 0, 0.18],
    [40, -360, -260, 620, 2, 0.16],
    [-460, 320, -640, 640, 1, 0.19],
  ];

  for (let i = 0; i < nebulaPlacements.length; i++) {
    const [nx, ny, nz, size, variant, opacity] = nebulaPlacements[i];
    const mat = new THREE.MeshBasicMaterial({
      map: nebulaCloudTextures[variant],
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(nebulaPlaneGeo, mat);
    mesh.position.set(nx, ny, nz);
    mesh.scale.set(size * 1.25, size, 1);
    mesh.lookAt(0, 0, -420);
    const baseRotZ = i * 0.72;
    mesh.rotation.z = baseRotZ;
    mesh.renderOrder = -2;
    nebulaCloudGroup.add(mesh);
    nebulaCloudPlanes.push({ mesh, baseRotZ, speed: (i % 2 === 0 ? 1 : -1) * (0.008 + i * 0.0012) });
    disposables.push(mat);
  }
  nebulaCloudGroup.visible = qualityConfig.enableOpticalPass;
  scene.add(nebulaCloudGroup);

  // High-contrast orbital directional sunlight for sharp terminator lines & player self-shadowing
  const keyLight = new THREE.DirectionalLight(0xfff4df, 3.35);
  keyLight.position.copy(sunPos);
  scene.add(keyLight);

  // Restrained deep-space bounce so night sides remain dramatic and shadowed
  const hemiLight = new THREE.HemisphereLight(0x3a6cb8, 0x090c1a, 0.44);
  scene.add(hemiLight);

  // Subtle cool cosmic rim light for silhouette readability on metal hulls & dark planet edges
  const rimLight = new THREE.DirectionalLight(0x5271ff, 0.46);
  rimLight.position.set(-460, -180, 380);
  scene.add(rimLight);

  // 3b. Streaming Cosmic Dust Field wrapping around player flight space
  const starSprite = generateRadialGlowTexture(
    'rgba(255,255,255,1)',
    'rgba(215,238,255,0.45)',
    'rgba(0,0,0,0)',
    128
  );
  disposables.push(starSprite);

  const maxDust = 420;
  let activeDustCount = qualityConfig.dustCount;
  const dustBox = 240;
  const dustHalf = dustBox * 0.5;
  const dustPositions = new Float32Array(maxDust * 3);
  const dustColors = new Float32Array(maxDust * 3);
  const dustPalette = [
    new THREE.Color('#bae6fd'),
    new THREE.Color('#e0f2fe'),
    new THREE.Color('#ddd6fe'),
    new THREE.Color('#fde68a'),
  ];
  for (let i = 0; i < maxDust; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * dustBox;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * dustBox;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * dustBox;
    const c = dustPalette[i % dustPalette.length];
    dustColors[i * 3] = c.r;
    dustColors[i * 3 + 1] = c.g;
    dustColors[i * 3 + 2] = c.b;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
  dustGeo.setDrawRange(0, activeDustCount);
  const dustMat = new THREE.PointsMaterial({
    size: 1.35,
    map: starSprite,
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const cosmicDust = new THREE.Points(dustGeo, dustMat);
  cosmicDust.frustumCulled = false;
  scene.add(cosmicDust);
  disposables.push(dustGeo, dustMat);

  // 4. Build the 6 High-Resolution Procedural PBR Planets (>= 64x64 sphere segments)
  const planets: PlanetSceneObject[] = [];
  const planetSphereGeo = new THREE.SphereGeometry(
    1,
    qualityConfig.planetSegmentsW,
    qualityConfig.planetSegmentsH
  );
  const atmosphereGeo = new THREE.SphereGeometry(1.22, 56, 44);
  const rimGeo = new THREE.SphereGeometry(1.016, 56, 44);
  const scanRingGeo = new THREE.RingGeometry(1.36, 1.43, 64);
  disposables.push(planetSphereGeo, atmosphereGeo, rimGeo, scanRingGeo);

  const sunDirFromPlanet = new THREE.Vector3();

  for (const config of PLANET_CONFIGS) {
    const group = new THREE.Group();
    group.position.set(config.position.x, config.position.y, config.position.z);

    const tex = generatePlanetTextures(
      config.id,
      maxAnisotropy,
      qualityConfig.planetTexWidth,
      qualityConfig.planetTexHeight
    );

    // Compute directional vector from this planet to the Sun (used by night lights, atmosphere & ring shadow)
    sunDirFromPlanet
      .set(
        sunPos.x - config.position.x,
        sunPos.y - config.position.y,
        sunPos.z - config.position.z
      )
      .normalize();

    const normalScaleMap: Record<PlanetKind, number> = {
      terra: 1.15,
      pyros: 1.4,
      cryos: 1.18,
      saturnia: 0.36,
      rubra: 1.92,
      aether: 1.42,
    };
    const ns = normalScaleMap[config.id];

    const matProps: THREE.MeshStandardMaterialParameters = {
      color: 0xffffff,
      map: tex.map,
      normalMap: tex.normalMap,
      normalScale: new THREE.Vector2(ns, ns),
      roughnessMap: tex.roughnessMap,
      roughness: 1.0, // Driven directly by per-pixel calibrated roughnessMap
      metalness: config.id === 'aether' ? 0.28 : config.id === 'cryos' ? 0.14 : 0.04,
    };

    if (tex.emissiveMap) {
      matProps.emissive = new THREE.Color(config.id === 'pyros' ? 0xff7b29 : 0xc084fc);
      matProps.emissiveMap = tex.emissiveMap;
      matProps.emissiveIntensity = config.id === 'pyros' ? 1.85 : 1.3;
    }

    const surfaceMat = new THREE.MeshStandardMaterial(matProps);

    // Terra Night-Side City Lights: warm-gold metropolitan clusters illuminate ONLY on the dark hemisphere
    let terraNightUniforms:
      | { uNightMap: { value: THREE.Texture }; uSunDir: { value: THREE.Vector3 } }
      | undefined;
    if (config.id === 'terra' && tex.nightMap) {
      terraNightUniforms = {
        uNightMap: { value: tex.nightMap },
        uSunDir: { value: sunDirFromPlanet.clone() },
      };
      surfaceMat.customProgramCacheKey = () => 'terra-night-sunset-v2';
      surfaceMat.onBeforeCompile = (shader) => {
        shader.uniforms.uNightMap = terraNightUniforms!.uNightMap;
        shader.uniforms.uSunDir = terraNightUniforms!.uSunDir;

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            varying vec2 vTerraUv;
            varying vec3 vTerraWorldNormal;`
          )
          .replace(
            '#include <beginnormal_vertex>',
            `#include <beginnormal_vertex>
            vTerraUv = uv;
            vTerraWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform sampler2D uNightMap;
            uniform vec3 uSunDir;
            varying vec2 vTerraUv;
            varying vec3 vTerraWorldNormal;`
          )
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            float terraSunDot = dot(normalize(vTerraWorldNormal), normalize(uSunDir));
            float terraNightMask = smoothstep(0.14, -0.22, terraSunDot);
            float terraSunsetBand = exp(-pow((terraSunDot + 0.015) * 6.8, 2.0));
            vec3 terraCity = texture2D(uNightMap, vTerraUv).rgb;
            totalEmissiveRadiance += terraCity * terraNightMask * 2.15;
            totalEmissiveRadiance += vec3(0.72, 0.24, 0.06) * terraSunsetBand * 0.48;`
          );
      };
    }

    const surfaceMesh = new THREE.Mesh(planetSphereGeo, surfaceMat);
    surfaceMesh.scale.setScalar(config.radius);
    group.add(surfaceMesh);
    disposables.push(surfaceMat);

    // Physically inspired Fresnel atmosphere with vivid Sunset Terminator Scattering on Terra
    const sunsetStrength = config.id === 'terra' ? 0.88 : config.id === 'rubra' ? 0.42 : 0.24;
    const atmosphereMat = createAtmosphereHaloMaterial(
      config.atmosphereColor,
      sunDirFromPlanet,
      config.id === 'pyros' ? 1.08 : config.id === 'terra' ? 1.02 : 0.92,
      sunsetStrength
    );
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    atmosphereMesh.scale.setScalar(config.radius);
    atmosphereMesh.renderOrder = 2;
    group.add(atmosphereMesh);
    disposables.push(atmosphereMat);

    const rimMat = createFresnelRimMaterial(
      config.atmosphereColor,
      sunDirFromPlanet,
      config.id === 'pyros' ? 1.18 : config.id === 'terra' ? 1.08 : 0.98,
      sunsetStrength
    );
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.scale.setScalar(config.radius);
    rimMesh.renderOrder = 2;
    group.add(rimMesh);
    disposables.push(rimMat);

    // Terra high-res rotating cloud layer with 3D tangent-space cloud-top normal relief
    let cloudMesh: THREE.Mesh | undefined;
    let cloudMat: THREE.MeshStandardMaterial | undefined;
    if (config.hasClouds && tex.cloudMap) {
      cloudMat = new THREE.MeshStandardMaterial({
        map: tex.cloudMap,
        normalMap: tex.cloudNormalMap,
        normalScale: new THREE.Vector2(0.5, 0.5),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        roughness: 0.92,
        metalness: 0.0,
      });
      cloudMesh = new THREE.Mesh(planetSphereGeo, cloudMat);
      cloudMesh.scale.setScalar(config.radius * 1.028);
      cloudMesh.renderOrder = 1;
      group.add(cloudMesh);
      disposables.push(cloudMat);
    }

    // Saturnia high-res double rings with analytic planetary eclipse shadow + sparkling ring dust
    let ringMesh: THREE.Mesh | undefined;
    let ringMat: THREE.MeshStandardMaterial | undefined;
    let ringDust: THREE.Points | undefined;
    if (config.hasRings && tex.ringMap) {
      const ringGeo = new THREE.RingGeometry(config.radius * 1.38, config.radius * 2.42, 96);
      const posAttr = ringGeo.attributes.position;
      const uvAttr = ringGeo.attributes.uv;
      const innerR = config.radius * 1.38;
      const outerR = config.radius * 2.42;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const rad = Math.sqrt(vx * vx + vy * vy);
        const u = (rad - innerR) / (outerR - innerR);
        uvAttr.setXY(i, u, 0.5);
      }
      ringMat = new THREE.MeshStandardMaterial({
        map: tex.ringMap,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.94,
        roughness: 0.62,
        metalness: 0.08,
        depthWrite: false,
      });

      const ringShadowCenter = new THREE.Vector3(
        config.position.x,
        config.position.y,
        config.position.z
      );
      const ringShadowSunDir = sunDirFromPlanet.clone();
      const ringShadowRadius = config.radius;
      ringMat.customProgramCacheKey = () => 'saturnia-ring-eclipse-v1';
      ringMat.onBeforeCompile = (shader) => {
        shader.uniforms.uPlanetCenter = { value: ringShadowCenter };
        shader.uniforms.uPlanetRadius = { value: ringShadowRadius };
        shader.uniforms.uSunDir = { value: ringShadowSunDir };

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            varying vec3 vRingWorldPos;`
          )
          .replace(
            '#include <project_vertex>',
            `#include <project_vertex>
            vRingWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform vec3 uPlanetCenter;
            uniform float uPlanetRadius;
            uniform vec3 uSunDir;
            varying vec3 vRingWorldPos;`
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            vec3 relRing = vRingWorldPos - uPlanetCenter;
            float projSun = dot(relRing, uSunDir);
            if (projSun < 0.0) {
              vec3 perpVec = relRing - uSunDir * projSun;
              float perpDist = length(perpVec);
              float eclipseShadow = smoothstep(uPlanetRadius * 0.92, uPlanetRadius * 1.08, perpDist);
              diffuseColor.rgb *= mix(0.14, 1.0, eclipseShadow);
            }`
          );
      };

      ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2 - 0.38;
      ringMesh.rotation.y = 0.25;
      ringMesh.renderOrder = 3;
      group.add(ringMesh);
      disposables.push(ringGeo, ringMat);

      const maxRingDust = 460;
      const rdPos = new Float32Array(maxRingDust * 3);
      const rdCol = new Float32Array(maxRingDust * 3);
      for (let i = 0; i < maxRingDust; i++) {
        const a = Math.random() * Math.PI * 2;
        const band =
          Math.random() < 0.52 ? 0.14 + Math.random() * 0.34 : 0.54 + Math.random() * 0.38;
        const r = innerR + band * (outerR - innerR);
        rdPos[i * 3] = Math.cos(a) * r;
        rdPos[i * 3 + 1] = Math.sin(a) * r;
        rdPos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;

        const sparkle = 0.78 + Math.random() * 0.35;
        rdCol[i * 3] = 1.0 * sparkle;
        rdCol[i * 3 + 1] = (0.86 + Math.random() * 0.14) * sparkle;
        rdCol[i * 3 + 2] = (0.64 + Math.random() * 0.28) * sparkle;
      }
      const rdGeo = new THREE.BufferGeometry();
      rdGeo.setAttribute('position', new THREE.BufferAttribute(rdPos, 3));
      rdGeo.setAttribute('color', new THREE.BufferAttribute(rdCol, 3));
      rdGeo.setDrawRange(0, qualityConfig.ringDustCount);
      const rdMat = new THREE.PointsMaterial({
        size: 2.2,
        map: starSprite,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      ringDust = new THREE.Points(rdGeo, rdMat);
      ringDust.rotation.copy(ringMesh.rotation);
      ringDust.renderOrder = 4;
      group.add(ringDust);
      disposables.push(rdGeo, rdMat);
    }

    // Aether orbiting crystal moon with tangent-space crater normal relief
    let moonMesh: THREE.Mesh | undefined;
    let moonMat: THREE.MeshStandardMaterial | undefined;
    if (config.hasMoon && tex.moonMap && config.moonRadius) {
      moonMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex.moonMap,
        normalMap: tex.moonNormalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughness: 0.72,
        metalness: 0.14,
      });
      moonMesh = new THREE.Mesh(planetSphereGeo, moonMat);
      moonMesh.scale.setScalar(config.moonRadius);
      scene.add(moonMesh);
      disposables.push(moonMat);
    }

    // Unique Planetary Phenomena (Ultra mode: Cryos Auroras, Pyros Embers, Aether Crystal Shards)
    let auroraGroup: THREE.Group | undefined;
    let auroraMat: THREE.ShaderMaterial | undefined;
    if (config.id === 'cryos') {
      auroraGroup = new THREE.Group();
      auroraMat = createAuroraCurtainMaterial();
      const auroraOuterGeo = new THREE.CylinderGeometry(
        config.radius * 0.62,
        config.radius * 0.44,
        config.radius * 0.42,
        64,
        4,
        true
      );
      const auroraInnerGeo = new THREE.CylinderGeometry(
        config.radius * 0.44,
        config.radius * 0.31,
        config.radius * 0.34,
        52,
        4,
        true
      );

      // North & South magnetic polar aurora crowns
      const northOuter = new THREE.Mesh(auroraOuterGeo, auroraMat);
      northOuter.position.set(0, config.radius * 1.01, 0);
      northOuter.renderOrder = 4;
      auroraGroup.add(northOuter);

      const northInner = new THREE.Mesh(auroraInnerGeo, auroraMat);
      northInner.position.set(0, config.radius * 1.05, 0);
      northInner.rotation.y = 1.4;
      northInner.renderOrder = 4;
      auroraGroup.add(northInner);

      const southOuter = new THREE.Mesh(auroraOuterGeo, auroraMat);
      southOuter.position.set(0, -config.radius * 1.01, 0);
      southOuter.rotation.x = Math.PI;
      southOuter.renderOrder = 4;
      auroraGroup.add(southOuter);

      auroraGroup.rotation.z = 0.22;
      auroraGroup.visible = qualityConfig.enableOpticalPass;
      group.add(auroraGroup);
      disposables.push(auroraMat, auroraOuterGeo, auroraInnerGeo);
    }

    let volcanicEmbers: THREE.Points | undefined;
    let emberSeeds: Float32Array | undefined;
    if (config.id === 'pyros') {
      const emberCount = 240;
      const ePos = new Float32Array(emberCount * 3);
      const eCol = new Float32Array(emberCount * 3);
      emberSeeds = new Float32Array(emberCount * 4); // theta, phi, altPhase, speed

      for (let i = 0; i < emberCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const altPhase = Math.random();
        const speed = 0.16 + Math.random() * 0.24;
        emberSeeds[i * 4] = theta;
        emberSeeds[i * 4 + 1] = phi;
        emberSeeds[i * 4 + 2] = altPhase;
        emberSeeds[i * 4 + 3] = speed;

        const r = config.radius * (1.03 + altPhase * 0.24);
        ePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        ePos[i * 3 + 1] = r * Math.cos(phi);
        ePos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        const hot = Math.random();
        eCol[i * 3] = 1.0;
        eCol[i * 3 + 1] = 0.34 + hot * 0.46;
        eCol[i * 3 + 2] = 0.06 + hot * 0.14;
      }

      const emberGeo = new THREE.BufferGeometry();
      emberGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
      emberGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
      const emberMat = new THREE.PointsMaterial({
        size: 2.35,
        map: starSprite,
        vertexColors: true,
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      volcanicEmbers = new THREE.Points(emberGeo, emberMat);
      volcanicEmbers.renderOrder = 4;
      volcanicEmbers.visible = qualityConfig.enableOpticalPass;
      group.add(volcanicEmbers);
      disposables.push(emberGeo, emberMat);
    }

    let crystalField: THREE.InstancedMesh | undefined;
    let crystalOrbitData: PlanetSceneObject['crystalOrbitData'];
    if (config.id === 'aether') {
      const shardCount = 44;
      const shardGeo = new THREE.OctahedronGeometry(1.0, 0);
      shardGeo.scale(0.42, 1.55, 0.42);
      const shardMat = new THREE.MeshStandardMaterial({
        color: 0xe9d5ff,
        emissive: 0xa855f7,
        emissiveIntensity: 1.45,
        roughness: 0.14,
        metalness: 0.45,
      });
      crystalField = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
      crystalField.frustumCulled = false;
      crystalOrbitData = [];
      const shardTint = new THREE.Color();

      for (let i = 0; i < shardCount; i++) {
        crystalOrbitData.push({
          angle: (i / shardCount) * Math.PI * 2 + Math.random() * 0.25,
          radius: config.radius * (1.26 + Math.random() * 0.44),
          inclination: (Math.random() - 0.5) * 0.62,
          speed: 0.12 + Math.random() * 0.16,
          scale: 0.9 + Math.random() * 1.45,
          spin: (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 1.1),
        });
        shardTint.setHSL(0.75 + Math.random() * 0.14, 0.78, 0.68 + Math.random() * 0.2);
        crystalField.setColorAt(i, shardTint);
      }
      if (crystalField.instanceColor) crystalField.instanceColor.needsUpdate = true;
      crystalField.visible = qualityConfig.enableOpticalPass;
      group.add(crystalField);
      disposables.push(shardGeo, shardMat);
    }

    // Diegetic orbital scan ring (faint until approached or scanned)
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(config.accentHex),
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
    scanRing.scale.setScalar(config.radius);
    scanRing.rotation.x = Math.PI / 2;
    group.add(scanRing);
    disposables.push(scanRingMat);

    scene.add(group);
    planets.push({
      config,
      group,
      surfaceMesh,
      surfaceMat,
      cloudMesh,
      cloudMat,
      moonMesh,
      moonMat,
      ringMesh,
      ringMat,
      ringDust,
      auroraGroup,
      auroraMat,
      volcanicEmbers,
      emberSeeds,
      crystalField,
      crystalOrbitData,
      scanRing,
      scanRingMat,
      atmosphereMat,
      textures: tex,
      terraNightUniforms,
    });
  }

  // 5. Organic High-Detail Asteroid Belt (InstancedMesh, up to 180 rocky boulders)
  let asteroidGeo = createOrganicAsteroidGeometry(qualityConfig.asteroidDetail);
  let asteroidTex: PbrTextureSet = generateAsteroidTextures(
    maxAnisotropy,
    qualityConfig.asteroidTexSize
  );
  const beltMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: asteroidTex.map,
    normalMap: asteroidTex.normalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: asteroidTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.14,
  });
  disposables.push(beltMat);

  const maxBeltCount = 180;
  let activeBeltCount = qualityConfig.beltCount;
  const ambientBelt = new THREE.InstancedMesh(asteroidGeo, beltMat, maxBeltCount);
  ambientBelt.count = activeBeltCount;
  ambientBelt.frustumCulled = false;

  const beltData: Array<{
    angle: number;
    radius: number;
    y: number;
    speed: number;
    scale: number;
    rot: THREE.Vector3;
  }> = [];
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < maxBeltCount; i++) {
    const angle = (i / maxBeltCount) * Math.PI * 2 + Math.random() * 0.2;
    const radius = 520 + Math.random() * 380;
    const y = (Math.random() - 0.5) * 260;
    const scale = 3.0 + Math.random() * 6.5;
    beltData.push({
      angle,
      radius,
      y,
      speed: 0.015 + Math.random() * 0.025,
      scale,
      rot: new THREE.Vector3(Math.random() * 0.6, Math.random() * 0.6, Math.random() * 0.5),
    });

    tint.setHSL(
      0.07 + Math.random() * 0.06,
      0.12 + Math.random() * 0.14,
      0.52 + Math.random() * 0.24
    );
    ambientBelt.setColorAt(i, tint);
  }
  if (ambientBelt.instanceColor) ambientBelt.instanceColor.needsUpdate = true;
  scene.add(ambientBelt);

  // 6. Destructible Planet-Guard Asteroids & Enemy Drones
  const asteroids: DestructibleAsteroid[] = [];
  const drones: EnemyDrone[] = [];
  const archetypes: DroneArchetype[] = ['interceptor', 'orbiter', 'sniper'];

  let asteroidId = 1;
  let droneId = 1;

  for (let pIdx = 0; pIdx < PLANET_CONFIGS.length; pIdx++) {
    const planet = PLANET_CONFIGS[pIdx];
    const center = new THREE.Vector3(planet.position.x, planet.position.y, planet.position.z);

    for (let a = 0; a < planet.asteroidCount; a++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xd4cbc2,
        map: asteroidTex.map,
        normalMap: asteroidTex.normalMap,
        normalScale: new THREE.Vector2(1.3, 1.3),
        roughnessMap: asteroidTex.roughnessMap,
        roughness: 1.0,
        metalness: 0.16,
      });
      disposables.push(mat);

      const radius = 3.2 + (a % 3) * 1.45;
      const mesh = new THREE.Mesh(asteroidGeo, mat);
      mesh.scale.setScalar(radius);

      const orbitRadius = planet.radius + 32 + (a % 4) * 16;
      const orbitAngle = (a / planet.asteroidCount) * Math.PI * 2;
      const orbitElevation = ((a % 5) - 2) * 11;
      const pos = new THREE.Vector3(
        center.x + Math.cos(orbitAngle) * orbitRadius,
        center.y + orbitElevation,
        center.z + Math.sin(orbitAngle) * orbitRadius
      );
      mesh.position.copy(pos);
      scene.add(mesh);

      asteroids.push({
        id: asteroidId++,
        planetId: planet.id,
        mesh,
        position: pos,
        orbitCenter: center.clone(),
        orbitRadius,
        orbitAngle,
        orbitSpeed: (0.14 + (a % 3) * 0.06) * (a % 2 === 0 ? 1 : -1),
        orbitElevation,
        rotSpeed: new THREE.Vector3(0.4 + (a % 3) * 0.25, 0.5, 0.35),
        radius,
        hp: 30,
        maxHp: 30,
        alive: true,
        hitFlash: 0,
      });
    }

    for (let d = 0; d < planet.droneCount; d++) {
      const archetype = archetypes[(pIdx + d) % archetypes.length];
      const { group, eyeMat, bodyMat } = createDroneMesh(archetype);
      disposables.push(eyeMat, bodyMat);

      const angle = (d / planet.droneCount) * Math.PI * 2 + 0.5;
      const dist = planet.radius + 46 + d * 10;
      const home = new THREE.Vector3(
        center.x + Math.cos(angle) * dist,
        center.y + ((d % 3) - 1) * 16,
        center.z + Math.sin(angle) * dist
      );
      group.position.copy(home);
      scene.add(group);

      const maxHp = archetype === 'sniper' ? 75 : archetype === 'orbiter' ? 60 : 50;
      drones.push({
        id: droneId++,
        planetId: planet.id,
        archetype,
        group,
        eyeMat,
        bodyMat,
        position: home.clone(),
        velocity: new THREE.Vector3(),
        homePos: home.clone(),
        orbitPhase: angle,
        hp: maxHp,
        maxHp,
        radius: 3.6,
        alive: true,
        dyingTimer: 0,
        fireCooldown: 1.5 + d * 0.6,
        telegraphTimer: 0,
        hitFlash: 0,
      });
    }
  }

  // 7. Colossal 3D Dreadnought Boss Carrier with Sci-Fi Hull Plating PBR maps
  const bossRig = createBossDreadnought(maxAnisotropy, qualityConfig.hullTexSize);
  bossRig.group.visible = false;
  scene.add(bossRig.group);

  const beltCenterZ = -540;
  const _toSun = new THREE.Vector3();
  const _crystalDummy = new THREE.Object3D();

  return {
    planets,
    asteroids,
    drones,
    bossRig,
    sunGroup,
    keyLight,
    sunDirGlobal,
    starfield,
    ambientBelt,
    spawnEscortDrone: (origin) => {
      for (const d of drones) {
        if (!d.alive && d.dyingTimer <= 0) {
          d.alive = true;
          d.hp = d.maxHp;
          d.hitFlash = 0;
          d.telegraphTimer = 0;
          d.fireCooldown = 1.4;
          d.position.copy(origin);
          d.homePos.copy(origin);
          d.velocity.set((Math.random() - 0.5) * 28, -12, (Math.random() - 0.5) * 28);
          d.group.position.copy(d.position);
          d.group.scale.setScalar(1);
          d.group.visible = true;
          return true;
        }
      }
      return false;
    },
    setPixelRatio: (nextPixelRatio) => {
      starMat.uniforms.uPixelRatio.value = nextPixelRatio;
    },
    applyQuality: (nextConfig, nextAniso, nextPixelRatio) => {
      // Update starfield density & DPI crispness
      starGeo.setDrawRange(0, nextConfig.starCount);
      starMat.uniforms.uPixelRatio.value = nextPixelRatio;

      // Update cosmic dust, ambient belt, 3D parallax nebula clouds & Ultra planetary phenomena
      activeDustCount = nextConfig.dustCount;
      dustGeo.setDrawRange(0, activeDustCount);
      activeBeltCount = nextConfig.beltCount;
      ambientBelt.count = activeBeltCount;
      nebulaCloudGroup.visible = nextConfig.enableOpticalPass;

      // Regenerate planet PBR textures at target resolution (2048x1024 vs 1024x512)
      for (const p of planets) {
        if (p.auroraGroup) p.auroraGroup.visible = nextConfig.enableOpticalPass;
        if (p.volcanicEmbers) p.volcanicEmbers.visible = nextConfig.enableOpticalPass;
        if (p.crystalField) p.crystalField.visible = nextConfig.enableOpticalPass;

        const nextTex = generatePlanetTextures(
          p.config.id,
          nextAniso,
          nextConfig.planetTexWidth,
          nextConfig.planetTexHeight
        );
        const oldTex = p.textures;
        p.textures = nextTex;

        p.surfaceMat.map = nextTex.map;
        p.surfaceMat.normalMap = nextTex.normalMap;
        p.surfaceMat.roughnessMap = nextTex.roughnessMap;
        if (nextTex.emissiveMap) {
          p.surfaceMat.emissiveMap = nextTex.emissiveMap;
        }
        if (p.terraNightUniforms && nextTex.nightMap) {
          p.terraNightUniforms.uNightMap.value = nextTex.nightMap;
        }
        p.surfaceMat.needsUpdate = true;

        if (p.cloudMat && nextTex.cloudMap) {
          p.cloudMat.map = nextTex.cloudMap;
          p.cloudMat.normalMap = nextTex.cloudNormalMap ?? null;
          p.cloudMat.needsUpdate = true;
        }
        if (p.ringMat && nextTex.ringMap) {
          p.ringMat.map = nextTex.ringMap;
          p.ringMat.needsUpdate = true;
        }
        if (p.ringDust) {
          p.ringDust.geometry.setDrawRange(0, nextConfig.ringDustCount);
        }
        if (p.moonMat && nextTex.moonMap) {
          p.moonMat.map = nextTex.moonMap;
          p.moonMat.normalMap = nextTex.moonNormalMap ?? null;
          p.moonMat.needsUpdate = true;
        }

        disposePlanetTextureBundle(oldTex);
      }

      // Regenerate asteroid geometry & porous rock textures at target quality
      const nextAstGeo = createOrganicAsteroidGeometry(nextConfig.asteroidDetail);
      const oldAstGeo = asteroidGeo;
      asteroidGeo = nextAstGeo;
      ambientBelt.geometry = nextAstGeo;

      const nextAstTex = generateAsteroidTextures(nextAniso, nextConfig.asteroidTexSize);
      const oldAstTex = asteroidTex;
      asteroidTex = nextAstTex;

      beltMat.map = nextAstTex.map;
      beltMat.normalMap = nextAstTex.normalMap;
      beltMat.roughnessMap = nextAstTex.roughnessMap;
      beltMat.needsUpdate = true;

      for (const a of asteroids) {
        a.mesh.geometry = nextAstGeo;
        const m = a.mesh.material as THREE.MeshStandardMaterial;
        m.map = nextAstTex.map;
        m.normalMap = nextAstTex.normalMap;
        m.roughnessMap = nextAstTex.roughnessMap;
        m.needsUpdate = true;
      }

      oldAstGeo.dispose();
      oldAstTex.map.dispose();
      oldAstTex.normalMap.dispose();
      oldAstTex.roughnessMap.dispose();

      // Update Dreadnought hull plating resolution
      bossRig.applyQuality(nextAniso, nextConfig.hullTexSize);
    },
    updateAmbient: (dt, elapsed, playerPos, cameraForward) => {
      // Keep distant procedural skybox & twinkling starfield centered around player
      skyDome.position.copy(playerPos);
      starfield.position.copy(playerPos);
      starMat.uniforms.uTime.value = elapsed;
      sunMat.uniforms.uTime.value = elapsed;

      // Delicate optical solar flare breathing + dynamic anamorphic horizontal lens flare
      const sunPulse = 1 + Math.sin(elapsed * 1.3) * 0.035;
      flareSprite.scale.set(640 * sunPulse, 640 * sunPulse, 1);
      const outerPulse = 1 + Math.cos(elapsed * 0.85) * 0.05;
      outerCoronaSprite.scale.set(820 * outerPulse, 820 * outerPulse, 1);

      let sunFacing = 0.35;
      if (cameraForward) {
        _toSun.subVectors(sunPos, playerPos).normalize();
        const dotSun = Math.max(0, cameraForward.dot(_toSun));
        sunFacing = Math.pow(THREE.MathUtils.clamp((dotSun - 0.32) / 0.68, 0, 1), 1.35);
      }
      const targetAnaOpacity = 0.14 + sunFacing * 0.78;
      anamorphicMat.opacity = THREE.MathUtils.damp(anamorphicMat.opacity, targetAnaOpacity, 6.5, dt);
      const anaStretch = 1480 + sunFacing * 960;
      anamorphicSprite.scale.set(anaStretch * sunPulse, (260 + sunFacing * 140) * sunPulse, 1);

      // Gentle 3D parallax nebula cloud drift
      if (nebulaCloudGroup.visible) {
        for (let i = 0; i < nebulaCloudPlanes.length; i++) {
          const nc = nebulaCloudPlanes[i];
          nc.mesh.rotation.z = nc.baseRotZ + elapsed * nc.speed;
        }
      }

      // Wrap cosmic dust motes seamlessly around player flight corridor
      const dustAttr = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < activeDustCount; i++) {
        const dx = dustPositions[i * 3] - playerPos.x;
        const dy = dustPositions[i * 3 + 1] - playerPos.y;
        const dz = dustPositions[i * 3 + 2] - playerPos.z;
        if (dx > dustHalf) dustPositions[i * 3] -= dustBox;
        else if (dx < -dustHalf) dustPositions[i * 3] += dustBox;
        if (dy > dustHalf) dustPositions[i * 3 + 1] -= dustBox;
        else if (dy < -dustHalf) dustPositions[i * 3 + 1] += dustBox;
        if (dz > dustHalf) dustPositions[i * 3 + 2] -= dustBox;
        else if (dz < -dustHalf) dustPositions[i * 3 + 2] += dustBox;
      }
      dustAttr.needsUpdate = true;

      // Rotate planets, separate Terra clouds, Saturnia ring dust, Aether moon & living phenomena
      for (const p of planets) {
        p.surfaceMesh.rotation.y += p.config.rotationSpeed * dt;
        if (p.cloudMesh) {
          p.cloudMesh.rotation.y += p.config.rotationSpeed * 1.55 * dt;
        }
        if (p.ringDust) {
          p.ringDust.rotation.z += 0.075 * dt;
        }
        if (p.auroraMat && p.auroraGroup?.visible) {
          p.auroraMat.uniforms.uTime.value = elapsed;
          p.auroraGroup.rotation.y += 0.045 * dt;
        }
        if (p.volcanicEmbers && p.emberSeeds && p.volcanicEmbers.visible) {
          const eAttr = p.volcanicEmbers.geometry.attributes.position as THREE.BufferAttribute;
          const eArr = eAttr.array as Float32Array;
          const count = p.emberSeeds.length / 4;
          const baseR = p.config.radius;
          for (let i = 0; i < count; i++) {
            const theta = p.emberSeeds[i * 4] + elapsed * p.emberSeeds[i * 4 + 3] * 0.55;
            const phi = p.emberSeeds[i * 4 + 1] + Math.sin(elapsed * 0.6 + i) * 0.04;
            const rise = (p.emberSeeds[i * 4 + 2] + elapsed * p.emberSeeds[i * 4 + 3] * 0.32) % 1;
            const r = baseR * (1.03 + rise * 0.25);
            const sinPhi = Math.sin(phi);
            eArr[i * 3] = r * sinPhi * Math.cos(theta);
            eArr[i * 3 + 1] = r * Math.cos(phi);
            eArr[i * 3 + 2] = r * sinPhi * Math.sin(theta);
          }
          eAttr.needsUpdate = true;
        }
        if (p.crystalField && p.crystalOrbitData && p.crystalField.visible) {
          for (let i = 0; i < p.crystalOrbitData.length; i++) {
            const c = p.crystalOrbitData[i];
            const ang = c.angle + elapsed * c.speed;
            _crystalDummy.position.set(
              Math.cos(ang) * c.radius,
              Math.sin(ang * 2.0 + c.angle) * c.radius * Math.sin(c.inclination) * 0.55,
              Math.sin(ang) * c.radius
            );
            _crystalDummy.rotation.set(
              elapsed * c.spin * 0.65,
              elapsed * c.spin,
              c.inclination
            );
            _crystalDummy.scale.setScalar(c.scale);
            _crystalDummy.updateMatrix();
            p.crystalField.setMatrixAt(i, _crystalDummy.matrix);
          }
          p.crystalField.instanceMatrix.needsUpdate = true;
        }
        if (p.config.id === 'pyros') {
          p.surfaceMat.emissiveIntensity = 1.75 + Math.sin(elapsed * 2.4) * 0.45;
        } else if (p.config.id === 'aether') {
          p.surfaceMat.emissiveIntensity = 1.25 + Math.sin(elapsed * 1.9 + 1.1) * 0.36;
        }
        if (p.moonMesh) {
          const mp = getMoonPosition(p.config, elapsed);
          if (mp) {
            p.moonMesh.position.set(mp.x, mp.y, mp.z);
            p.moonMesh.rotation.y += 0.35 * dt;
          }
        }
      }

      // Rotate ambient asteroid belt smoothly around solar system center
      for (let i = 0; i < activeBeltCount; i++) {
        const b = beltData[i];
        const a = b.angle + elapsed * b.speed;
        dummy.position.set(
          Math.cos(a) * b.radius,
          b.y + Math.sin(a * 2) * 14,
          beltCenterZ + Math.sin(a) * b.radius
        );
        dummy.rotation.set(elapsed * b.rot.x, elapsed * b.rot.y, elapsed * b.rot.z);
        dummy.scale.setScalar(b.scale);
        dummy.updateMatrix();
        ambientBelt.setMatrixAt(i, dummy.matrix);
      }
      ambientBelt.instanceMatrix.needsUpdate = true;
    },
    resetEntities: () => {
      for (const a of asteroids) {
        a.alive = true;
        a.hp = a.maxHp;
        a.hitFlash = 0;
        a.mesh.visible = true;
        a.position.set(
          a.orbitCenter.x + Math.cos(a.orbitAngle) * a.orbitRadius,
          a.orbitCenter.y + a.orbitElevation,
          a.orbitCenter.z + Math.sin(a.orbitAngle) * a.orbitRadius
        );
        a.mesh.position.copy(a.position);
      }

      for (const d of drones) {
        d.alive = true;
        d.hp = d.maxHp;
        d.dyingTimer = 0;
        d.hitFlash = 0;
        d.telegraphTimer = 0;
        d.fireCooldown = 1.6 + (d.id % 4) * 0.5;
        d.position.copy(d.homePos);
        d.velocity.set(0, 0, 0);
        d.group.position.copy(d.position);
        d.group.scale.setScalar(1);
        d.group.visible = true;
      }

      for (const p of planets) {
        p.scanRingMat.color.set(p.config.accentHex);
        p.scanRingMat.opacity = 0.2;
        p.scanRing.scale.setScalar(p.config.radius);
      }

      bossRig.group.visible = false;
      bossRig.group.rotation.set(0, 0, 0);
    },
    dispose: () => {
      bossRig.dispose();
      for (const p of planets) {
        disposePlanetTextureBundle(p.textures);
      }
      asteroidGeo.dispose();
      asteroidTex.map.dispose();
      asteroidTex.normalMap.dispose();
      asteroidTex.roughnessMap.dispose();
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
