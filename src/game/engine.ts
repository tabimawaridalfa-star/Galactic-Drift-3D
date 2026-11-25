import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SpaceAudioEngine } from './audio';
import {
  ASTEROID_KILL_REWARD,
  BOSS_COLLISION_RADIUS,
  BOSS_KILL_SCORE_REWARD,
  BOSS_MAX_HP,
  COIN_ASTEROID_VALUE,
  COIN_BOSS_KILL_BONUS,
  COIN_DRONE_VALUE,
  COIN_PLANET_SCAN_BONUS,
  DODGE_COOLDOWN,
  DODGE_DURATION,
  DRONE_KILL_REWARD,
  MAX_BOOST,
  MAX_PLAYER_HP,
  MISSILE_LOCK_TIME,
  MISSILE_SPEED,
  MISSILE_TURN_RATE,
  ORB_PICKUP_REWARD,
  PLANET_CONFIGS,
  PLANET_SCAN_REWARD,
  RADAR_RANGE,
  SHIP_COLLISION_RADIUS,
  type BossStatus,
  type CameraMode,
  type DodgeState,
  type GamePhase,
  type GraphicsQuality,
  type GraphicsQualityConfig,
  type PlanetConfig,
  type PlanetScanState,
  type PlayerUpgradeStats,
  type UpgradeLevels,
  type UpgradeTrackId,
  type WaypointScreenData,
  applyDamageWithShield,
  applyHealthDelta,
  computeDynamicChroma,
  computeTargetLeadPosition,
  computeWaypointScreen,
  consumeMissileAmmo,
  createInitialDodgeState,
  createInitialScanStates,
  createInitialUpgradeLevels,
  findNearestPlanet,
  getBossPhase,
  getDefaultGraphicsQuality,
  getDifficultyMultiplier,
  getGraphicsQualityConfig,
  getMoonPosition,
  getPlayerUpgradeStats,
  projectRadarBlip,
  purchaseHullRepair,
  purchaseUpgrade,
  resolveMusicMode,
  resolveSphereCollision,
  shouldTriggerBossEncounter,
  toggleCameraModeValue,
  triggerDodgeRoll,
  updateBoostEnergy,
  updateDodgeRoll,
  updateMissileAmmo,
  updatePlanetScan,
  updateShieldRegen,
} from './rules';
import { createPlayerShip, type PlayerShipRig } from './ship';
import { buildSolarSystemWorld, type EnemyDrone, type SolarSystemWorld } from './world';
import type { RadarFrameData } from '../components/HoloRadar';

export interface HudSnapshot {
  phase: GamePhase;
  graphicsQuality: GraphicsQuality;
  cameraMode: CameraMode;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  boost: number;
  maxBoost: number;
  score: number;
  bestScore: number;
  coins: number;
  upgradeLevels: UpgradeLevels;
  upgradeStats: PlayerUpgradeStats;
  scannedCount: number;
  totalPlanets: number;
  nearestPlanetName: string;
  nearestPlanetDistance: number;
  nearestPlanetAccent: string;
  scanningPlanetName: string | null;
  scanningProgress: number;
  scanLockedMessage: string | null;
  speedKmh: number;
  isBoosting: boolean;
  muted: boolean;
  elapsedSec: number;
  enemiesDestroyed: number;
  asteroidsDestroyed: number;
  bannerText: string | null;
  bannerAccent: string;
  damageVignette: number;
  planetStatuses: Array<{ id: string; name: string; scanned: boolean; accentHex: string }>;
  // Boss telemetry
  bossStatus: BossStatus;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: 1 | 2;
  // Cinematic fly-by telemetry
  flybyPlanetIndex: number;
  flybyPlanetName: string;
  flybyPlanetSubtitle: string;
  flybyAccentHex: string;
  // Ace Pilot combat telemetry
  missileAmmo: number;
  missileMaxAmmo: number;
  missileReloadRatio: number;
  dodgeCooldownRatio: number;
  dodgeActive: boolean;
  lockedTargetName: string | null;
  lockedTargetFull: boolean;
}

export interface LockOnScreenData {
  visible: boolean;
  x: number;
  y: number;
  progress: number;
  locked: boolean;
  label: string;
  distance: number;
}

export interface TargetLeadScreenData {
  visible: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export interface FastOverlayFrame {
  waypoint: WaypointScreenData | null;
  hpRatio: number;
  shieldRatio: number;
  boostRatio: number;
  bossHpRatio: number;
  scanProgress: number;
  damageFlash: number;
  crosshairBloom: number;
  hitmarkerRatio: number;
  hitmarkerKill: boolean;
  lockOn: LockOnScreenData | null;
  leadIndicator: TargetLeadScreenData | null;
  missileReloadRatio: number;
  dodgeCooldownRatio: number;
  dodgeActive: boolean;
  radar: RadarFrameData;
}

export interface MobileInputState {
  steerX: number; // -1 (left) to +1 (right)
  steerY: number; // -1 (down) to +1 (up)
  firing: boolean;
  boosting: boolean;
}

interface LaserBolt {
  active: boolean;
  isEnemy: boolean;
  damage: number;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
}

interface HomingMissile {
  active: boolean;
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  damage: number;
  splashRadius: number;
  targetType: 'none' | 'drone' | 'boss';
  targetDrone: EnemyDrone | null;
  trailAccum: number;
}

interface ExplosionParticle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  size: number;
}

interface EnergyOrb {
  active: boolean;
  kind: 'hp' | 'boost';
  group: THREE.Group;
  position: THREE.Vector3;
  life: number;
}

interface CreditCrystal {
  active: boolean;
  value: number;
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
}

interface ShockwaveRing {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  startRadius: number;
  endRadius: number;
}

interface PlasmaFlash {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxRadius: number;
}

interface DebrisShard {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Vector3;
  rotVel: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  scale: THREE.Vector3;
}

/**
 * Lightweight AAA optical post-processing pass placed right before OutputPass (Ultra mode):
 * - Dynamic radial Chromatic Aberration (subtle at rest, spikes on Turbo Boost, impact, and Boss blasts)
 * - Soft cinematic lens vignette framing the starfighter and planets
 * - Ultra-fine animated triangular-PDF filmic dithering / micro-grain eliminating deep-space 8-bit banding
 */
const CinematicOpticsShader = {
  uniforms: {
    tDiffuse: { value: null },
    uChroma: { value: 0.00035 },
    uVignette: { value: 0.28 },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uChroma;
    uniform float uVignette;
    uniform float uTime;
    varying vec2 vUv;

    float ign(vec2 p) {
      return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);
      vec2 chromaOffset = centered * uChroma * (0.55 + dist * 1.65);

      float r = texture2D(tDiffuse, clamp(vUv + chromaOffset, 0.0, 1.0)).r;
      vec4 baseSample = texture2D(tDiffuse, vUv);
      float b = texture2D(tDiffuse, clamp(vUv - chromaOffset, 0.0, 1.0)).b;

      vec3 col = vec3(r, baseSample.g, b);
      float vig = 1.0 - smoothstep(0.46, 0.98, dist) * uVignette;
      col *= vig;

      // Animated triangular-PDF filmic dithering eliminates 8-bit color banding in dark nebulae
      vec2 seed = gl_FragCoord.xy + fract(uTime * 17.31) * 251.0;
      float n1 = ign(seed);
      float n2 = ign(seed + vec2(37.2, 17.9));
      float dither = (n1 - n2) * 0.0046;
      col = max(vec3(0.0), col + vec3(dither));

      gl_FragColor = vec4(col, baseSample.a);
    }
  `,
};

const BEST_SCORE_STORAGE_KEY = 'galactic_drift_3d_best_score';
const QUALITY_STORAGE_KEY = 'galactic_drift_3d_quality';
const FLYBY_DURATION_SEC = 7.2;
const FLYBY_ORDER: readonly number[] = [0, 2, 1, 4, 3, 5]; // Terra, Cryos, Pyros, Rubra, Saturnia, Aether

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function detectMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrow = window.innerWidth < 768;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return coarse || narrow || mobileUa;
}

/**
 * Generates a calibrated procedural Deep Space Environment Map via PMREMGenerator
 * so metallic starfighter hulls, Dreadnought armor plates, and clearcoat glass canopies
 * reflect authentic warm solar speculars and cool cosmic nebula bounce light.
 */
function createProceduralSpaceEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x040712);

  // Subtle cosmic hemisphere enclosure
  const domeGeo = new THREE.SphereGeometry(28, 24, 16);
  const domeMat = new THREE.MeshBasicMaterial({
    color: 0x0b152c,
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(domeGeo, domeMat));

  // Bright warm solar specular reflection panel (aligned with distant sun direction)
  const sunCardGeo = new THREE.PlaneGeometry(14, 14);
  const sunCardMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(4.2, 3.6, 2.7),
    side: THREE.DoubleSide,
  });
  const sunCard = new THREE.Mesh(sunCardGeo, sunCardMat);
  sunCard.position.set(14, 7, -18);
  sunCard.lookAt(0, 0, 0);
  envScene.add(sunCard);

  // Cool sapphire-cyan galactic nebula fill panel
  const nebCardGeo = new THREE.PlaneGeometry(24, 14);
  const nebCardMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.55, 1.05, 1.85),
    side: THREE.DoubleSide,
  });
  const nebCard = new THREE.Mesh(nebCardGeo, nebCardMat);
  nebCard.position.set(-16, 8, 12);
  nebCard.lookAt(0, 0, 0);
  envScene.add(nebCard);

  // Soft violet-teal lower bounce strip for crisp metallic bevel highlights
  const rimCardGeo = new THREE.PlaneGeometry(22, 10);
  const rimCardMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.75, 0.45, 1.35),
    side: THREE.DoubleSide,
  });
  const rimCard = new THREE.Mesh(rimCardGeo, rimCardMat);
  rimCard.position.set(4, -14, 14);
  rimCard.lookAt(0, 0, 0);
  envScene.add(rimCard);

  // Crisp overhead starlight strip for canopy clearcoat gleam
  const topCardGeo = new THREE.PlaneGeometry(18, 6);
  const topCardMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.45, 1.75, 2.2),
    side: THREE.DoubleSide,
  });
  const topCard = new THREE.Mesh(topCardGeo, topCardMat);
  topCard.position.set(0, 18, -2);
  topCard.lookAt(0, 0, 0);
  envScene.add(topCard);

  const envRT = pmrem.fromScene(envScene, 0.035);

  domeGeo.dispose();
  domeMat.dispose();
  sunCardGeo.dispose();
  sunCardMat.dispose();
  nebCardGeo.dispose();
  nebCardMat.dispose();
  rimCardGeo.dispose();
  rimCardMat.dispose();
  topCardGeo.dispose();
  topCardMat.dispose();
  pmrem.dispose();

  return envRT.texture;
}

export class GalacticDriftEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onFastOverlay: (frame: FastOverlayFrame) => void;

  private isSoftwareGl: boolean;
  private graphicsQuality: GraphicsQuality;
  private qualityConfig: GraphicsQualityConfig;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private composerTarget: THREE.WebGLRenderTarget | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private opticsPass: ShaderPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: SolarSystemWorld;
  private ship: PlayerShipRig;
  private audio: SpaceAudioEngine;
  private planetBounceLight: THREE.PointLight;
  private _bounceTargetColor = new THREE.Color(0x38bdf8);
  private _camForward = new THREE.Vector3(0, 0, -1);

  // Game state
  private phase: GamePhase = 'title';
  private cameraMode: CameraMode = 'third-person';
  private cockpitBlend = 0;
  private chromaPulse = 0;
  private upgradeLevels: UpgradeLevels = createInitialUpgradeLevels();
  private upgradeStats: PlayerUpgradeStats = getPlayerUpgradeStats(this.upgradeLevels);
  private hp = MAX_PLAYER_HP;
  private shield = 0;
  private timeSinceLastHit = 10;
  private boost = MAX_BOOST;
  private score = 0;
  private bestScore = 0;
  private coins = 0;
  private scanStates: PlanetScanState[] = createInitialScanStates();
  private elapsedRunSec = 0;
  private enemiesDestroyed = 0;
  private asteroidsDestroyed = 0;
  private scanLockedMessage: string | null = null;

  // Cinematic Fly-by Camera state
  private flybyElapsed = 0;
  private flybyCamCurve: THREE.CatmullRomCurve3;
  private flybyLookCurve: THREE.CatmullRomCurve3;

  // Boss Dreadnought state
  private bossStatus: BossStatus = 'dormant';
  private bossHp = BOSS_MAX_HP;
  private bossPhase: 1 | 2 = 1;
  private bossPos = new THREE.Vector3();
  private bossVel = new THREE.Vector3();
  private _prevBossPos = new THREE.Vector3();
  private bossOrbitAngle = 0;
  private bossAttackCooldown = 2.0;
  private bossWaveToggle = false;
  private bossEscortCooldown = 7.0;
  private bossHitFlash = 0;
  private bossDyingTimer = 0;
  private bossChainAccum = 0;

  // Ace Pilot: Homing Missiles, Target Lock-On & Barrel Roll Dodge
  private missileAmmo = 3;
  private missileReloadProgress = 0;
  private missileFireCooldown = 0;
  private missileSideToggle = 1;
  private lockedTargetType: 'none' | 'drone' | 'boss' = 'none';
  private lockedDrone: EnemyDrone | null = null;
  private lockProgress = 0;
  private lockBeepTimer = 0;
  private lockFullPlayed = false;
  private dodgeState: DodgeState = createInitialDodgeState();
  private lastTapDir: -1 | 0 | 1 = 0;
  private lastTapTime = 0;

  // Ship flight kinematics
  private shipPos = new THREE.Vector3(0, 0, 0);
  private shipVel = new THREE.Vector3(0, 0, -64);
  private shipYaw = 0; // radians, 0 faces -Z
  private shipPitch = 0.03;
  private yawRate = 0;
  private pitchRate = 0;
  private currentSpeed = 68;
  private isBoosting = false;
  private fireCooldown = 0;
  private collisionDamageCooldown = 0;
  private shipHitFlash = 0;
  private damageVignette = 0;
  private defeatDelayTimer = 0;

  // Juice: hitstop + camera trauma + banner + crosshair/hitmarker
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private sonarCooldown = 0;
  private crosshairBloom = 0;
  private hitmarkerTimer = 0;
  private hitmarkerKill = false;
  private bannerText: string | null = null;
  private bannerAccent = '#38bdf8';
  private bannerTimer = 0;

  // Pools (Zero GC in tick)
  private lasers: LaserBolt[] = [];
  private missiles: HomingMissile[] = [];
  private playerLaserMat!: THREE.MeshBasicMaterial;
  private enemyLaserMat!: THREE.MeshBasicMaterial;
  private particles: ExplosionParticle[] = [];
  private particleInstanced: THREE.InstancedMesh;
  private particleCursor = 0;
  private shockwaves: ShockwaveRing[] = [];
  private shockwaveCursor = 0;
  private plasmaFlashes: PlasmaFlash[] = [];
  private flashCursor = 0;
  private debris: DebrisShard[] = [];
  private debrisInstanced!: THREE.InstancedMesh;
  private debrisCursor = 0;
  private orbs: EnergyOrb[] = [];
  private crystals: CreditCrystal[] = [];

  // 3D Warp speed lines
  private warpLines: THREE.LineSegments;
  private warpLineMat: THREE.LineBasicMaterial;
  private warpPositions: Float32Array;
  private warpSeeds: Float32Array;
  private readonly warpCount = 85;

  // Input state
  private keys = new Set<string>();
  private mouseFiring = false;
  private mobileInput: MobileInputState = {
    steerX: 0,
    steerY: 0,
    firing: false,
    boosting: false,
  };

  // Loop & lifecycle
  private frameId = 0;
  private disposed = false;
  private lastPerfTime = 0;
  private totalElapsed = 0;
  private hudEmitAccum = 0;
  private resizeObserver: ResizeObserver | null = null;
  private viewportW = window.innerWidth;
  private viewportH = window.innerHeight;

  // Reusable scratch math objects (zero allocations per frame)
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _v3 = new THREE.Vector3();
  private readonly _forward = new THREE.Vector3();
  private readonly _up = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _camDesired = new THREE.Vector3();
  private readonly _chaseCamPos = new THREE.Vector3(0, 5.2, 16.5);
  private readonly _cockpitPos = new THREE.Vector3();
  private readonly _camUp = new THREE.Vector3(0, 1, 0);
  private readonly _camLook = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _dummy = new THREE.Object3D();
  private readonly _proj = new THREE.Vector3();
  private readonly _camLocal = new THREE.Vector3();
  private readonly _invCamMat = new THREE.Matrix4();
  private readonly _worldDisposables: Array<{ dispose: () => void }> = [];

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onFastOverlay: (frame: FastOverlayFrame) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onFastOverlay = onFastOverlay;

    try {
      const saved = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
      if (saved) this.bestScore = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      // Ignore restricted storage
    }

    let initialQuality = getDefaultGraphicsQuality(detectMobileDevice());
    try {
      const savedQuality = window.localStorage.getItem(QUALITY_STORAGE_KEY);
      if (savedQuality === 'ultra' || savedQuality === 'performance') {
        initialQuality = savedQuality;
      }
    } catch {
      // Ignore restricted storage
    }
    this.graphicsQuality = initialQuality;
    this.qualityConfig = getGraphicsQualityConfig(initialQuality);

    this.isSoftwareGl = detectSoftwareWebGL();
    this.audio = new SpaceAudioEngine();

    // Deep cosmic black backdrop & subtle spatial fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.scene.fog = new THREE.FogExp2(0x02040a, 0.00024);

    this.viewportW = Math.max(1, container.clientWidth || window.innerWidth);
    this.viewportH = Math.max(1, container.clientHeight || window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(62, this.viewportW / this.viewportH, 0.5, 3800);
    this.camera.position.set(16, 8, 22);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    const dpr = this.computeEffectivePixelRatio();
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setSize(this.viewportW, this.viewportH);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'game-canvas');

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Procedural Space IBL Environment Map via PMREMGenerator for realistic metallic & glass PBR
    const envTex = createProceduralSpaceEnvironment(this.renderer);
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.88;
    this._worldDisposables.push(envTex);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.world = buildSolarSystemWorld(this.scene, maxAniso, this.qualityConfig, dpr);
    this.ship = createPlayerShip(this.isSoftwareGl, maxAniso, this.qualityConfig.hullTexSize);
    this.scene.add(this.ship.root);

    // Configure Ultra-mode tight orthographic self-shadowing frustum following player starfighter
    const keyLight = this.world.keyLight;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 48;
    keyLight.shadow.camera.left = -7.8;
    keyLight.shadow.camera.right = 7.8;
    keyLight.shadow.camera.top = 7.8;
    keyLight.shadow.camera.bottom = -7.8;
    keyLight.shadow.bias = -0.00045;
    keyLight.shadow.normalBias = 0.025;
    this.scene.add(keyLight.target);
    this.syncShadowQuality();

    // Dynamic Planet Bounce Light reflecting nearest planet's atmosphere onto player hull
    this.planetBounceLight = new THREE.PointLight(0x38bdf8, 0, 220, 1.35);
    this.scene.add(this.planetBounceLight);

    // Build cinematic 6-planet fly-by curves
    const { camCurve, lookCurve } = this.buildFlybyCurves();
    this.flybyCamCurve = camCurve;
    this.flybyLookCurve = lookCurve;

    // Build zero-GC pools
    this.initLaserPool();
    this.initMissilePool();
    this.particleInstanced = this.initParticlePool();
    this.initExplosionVfxPools();
    this.initOrbPool();
    this.initCrystalPool();

    // Build 3D Warp Speed Lines
    const warp = this.initWarpLines();
    this.warpLines = warp.lines;
    this.warpLineMat = warp.mat;
    this.warpPositions = warp.positions;
    this.warpSeeds = warp.seeds;

    this.rebuildPostProcessing();
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.syncBodyState();
    this.emitHud(true);

    this.lastPerfTime = performance.now();
    this.tick();
  }

  private computeEffectivePixelRatio(): number {
    if (this.isSoftwareGl) return 1;
    return Math.min(window.devicePixelRatio || 1, this.qualityConfig.maxPixelRatio);
  }

  private rebuildPostProcessing(): void {
    this.composer?.dispose();
    this.composerTarget?.dispose();
    this.composer = null;
    this.composerTarget = null;
    this.bloomPass = null;
    this.opticsPass = null;

    if (this.isSoftwareGl) return;

    const dpr = this.computeEffectivePixelRatio();
    const rtW = Math.max(1, Math.floor(this.viewportW * dpr));
    const rtH = Math.max(1, Math.floor(this.viewportH * dpr));

    // Multisampled HalfFloat WebGLRenderTarget preserves crisp anti-aliased edges under UnrealBloomPass
    const renderTarget = new THREE.WebGLRenderTarget(rtW, rtH, {
      type: THREE.HalfFloatType,
      samples: this.renderer.capabilities.isWebGL2 ? this.qualityConfig.msaaSamples : 0,
    });

    const composer = new EffectComposer(this.renderer, renderTarget);
    composer.setPixelRatio(dpr);
    composer.setSize(this.viewportW, this.viewportH);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.viewportW, this.viewportH),
      this.qualityConfig.bloomStrength,
      this.qualityConfig.bloomRadius,
      this.qualityConfig.bloomThreshold
    );
    composer.addPass(bloomPass);

    if (this.qualityConfig.enableOpticalPass) {
      const opticsPass = new ShaderPass(CinematicOpticsShader);
      composer.addPass(opticsPass);
      this.opticsPass = opticsPass;
    }

    composer.addPass(new OutputPass());

    this.composerTarget = renderTarget;
    this.composer = composer;
    this.bloomPass = bloomPass;
  }

  private buildFlybyCurves(): {
    camCurve: THREE.CatmullRomCurve3;
    lookCurve: THREE.CatmullRomCurve3;
  } {
    const camPts: THREE.Vector3[] = [];
    const lookPts: THREE.Vector3[] = [];

    // Sweep smoothly across all 6 planets (Terra -> Cryos -> Pyros -> Rubra -> Saturnia -> Aether)
    const offsets: Array<[number, number, number]> = [
      [58, 22, 85],    // Terra
      [-74, 24, 72],   // Cryos
      [78, 28, 76],    // Pyros
      [-76, 30, 82],   // Rubra
      [96, 38, 108],   // Saturnia (wide framing to showcase double rings)
      [72, 34, 92],    // Aether + Moon
    ];

    for (let i = 0; i < FLYBY_ORDER.length; i++) {
      const p = PLANET_CONFIGS[FLYBY_ORDER[i]];
      const [ox, oy, oz] = offsets[i];
      camPts.push(new THREE.Vector3(p.position.x + ox, p.position.y + oy, p.position.z + oz));
      lookPts.push(new THREE.Vector3(p.position.x, p.position.y, p.position.z));
    }

    // Swoop back smoothly into the exact player starting chase camera position
    camPts.push(new THREE.Vector3(18, 24, -70));
    lookPts.push(new THREE.Vector3(0, 4, -140));

    camPts.push(new THREE.Vector3(0, 5.2, 16.5));
    lookPts.push(new THREE.Vector3(0, 0.8, -26));

    return {
      camCurve: new THREE.CatmullRomCurve3(camPts, false, 'catmullrom', 0.45),
      lookCurve: new THREE.CatmullRomCurve3(lookPts, false, 'catmullrom', 0.45),
    };
  }

  private initLaserPool(): void {
    const geo = new THREE.CylinderGeometry(0.17, 0.17, 4.9, 6);
    geo.rotateX(Math.PI / 2);
    this.playerLaserMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.32, 1.48, 2.05),
      toneMapped: false,
    });
    this.enemyLaserMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.1, 0.28, 0.48),
      toneMapped: false,
    });
    this._worldDisposables.push(geo, this.playerLaserMat, this.enemyLaserMat);

    // 48 player bolts + 48 enemy/boss bolts (supports Quad Plasma + Boss circular plasma waves)
    for (let i = 0; i < 96; i++) {
      const isEnemySlot = i >= 48;
      const mesh = new THREE.Mesh(geo, isEnemySlot ? this.enemyLaserMat : this.playerLaserMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.lasers.push({
        active: false,
        isEnemy: isEnemySlot,
        damage: isEnemySlot ? 10 : 25,
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
      });
    }
  }

  private initMissilePool(): void {
    const bodyGeo = new THREE.CylinderGeometry(0.22, 0.26, 2.5, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const noseGeo = new THREE.ConeGeometry(0.24, 0.95, 8);
    noseGeo.rotateX(Math.PI / 2);
    const finGeo = new THREE.BoxGeometry(0.95, 0.06, 0.55);
    const flameGeo = new THREE.ConeGeometry(0.28, 1.5, 8);
    flameGeo.rotateX(-Math.PI / 2);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.25,
    });
    const noseMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 0.65, 0.18),
      toneMapped: false,
    });
    const flameMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 1.35, 0.35),
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this._worldDisposables.push(bodyGeo, noseGeo, finGeo, flameGeo, bodyMat, noseMat, flameMat);

    for (let i = 0; i < 10; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.position.z = 1.65;
      const finH = new THREE.Mesh(finGeo, bodyMat);
      finH.position.z = -0.95;
      const finV = new THREE.Mesh(finGeo, bodyMat);
      finV.rotation.z = Math.PI / 2;
      finV.position.z = -0.95;
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.z = -1.95;

      group.add(body, nose, finH, finV, flame);
      group.visible = false;
      this.scene.add(group);

      this.missiles.push({
        active: false,
        group,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        damage: 145,
        splashRadius: 26,
        targetType: 'none',
        targetDrone: null,
        trailAccum: 0,
      });
    }
  }

  private initParticlePool(): THREE.InstancedMesh {
    const count = 340;
    const geo = new THREE.OctahedronGeometry(0.65, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._worldDisposables.push(geo, mat);

    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(0xffffff);

    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, zeroMat);
      mesh.setColorAt(i, white);
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(0xff9933),
        life: 0,
        maxLife: 0.6,
        size: 1,
      });
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  private initExplosionVfxPools(): void {
    // 1. Expanding translucent 3D Shockwave Rings
    const ringGeo = new THREE.RingGeometry(0.76, 1.0, 36);
    this._worldDisposables.push(ringGeo);

    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffb347,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.scene.add(mesh);
      this._worldDisposables.push(mat);
      this.shockwaves.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.45,
        startRadius: 1.5,
        endRadius: 16,
      });
    }

    // 2. Rapid incandescent plasma core flash spheres
    const flashGeo = new THREE.IcosahedronGeometry(1.0, 1);
    this._worldDisposables.push(flashGeo);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfff7ed,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(flashGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 7;
      this.scene.add(mesh);
      this._worldDisposables.push(mat);
      this.plasmaFlashes.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.22,
        maxRadius: 5,
      });
    }

    // 3. Tumbling 3D metal & rock debris shards (InstancedMesh, zero GC)
    const debrisCount = 140;
    const shardGeo = new THREE.TetrahedronGeometry(0.68, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.44,
      metalness: 0.68,
    });
    this._worldDisposables.push(shardGeo, shardMat);

    const inst = new THREE.InstancedMesh(shardGeo, shardMat, debrisCount);
    inst.frustumCulled = false;
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    const defaultCol = new THREE.Color(0x94a3b8);

    for (let i = 0; i < debrisCount; i++) {
      inst.setMatrixAt(i, zeroMat);
      inst.setColorAt(i, defaultCol);
      this.debris.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color(0x94a3b8),
        life: 0,
        maxLife: 1.1,
        scale: new THREE.Vector3(1, 0.5, 1.3),
      });
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);
    this.debrisInstanced = inst;
  }

  private initOrbPool(): void {
    const coreGeo = new THREE.OctahedronGeometry(1.55, 1);
    const ringGeo = new THREE.TorusGeometry(2.5, 0.16, 6, 18);
    const hpMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
    const boostMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const hpRingMat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const boostRingMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._worldDisposables.push(coreGeo, ringGeo, hpMat, boostMat, hpRingMat, boostRingMat);

    for (let i = 0; i < 24; i++) {
      const kind: 'hp' | 'boost' = i % 2 === 0 ? 'hp' : 'boost';
      const group = new THREE.Group();
      const core = new THREE.Mesh(coreGeo, kind === 'hp' ? hpMat : boostMat);
      const ring = new THREE.Mesh(ringGeo, kind === 'hp' ? hpRingMat : boostRingMat);
      group.add(core);
      group.add(ring);
      group.visible = false;
      this.scene.add(group);
      this.orbs.push({
        active: false,
        kind,
        group,
        position: new THREE.Vector3(),
        life: 0,
      });
    }
  }

  private initCrystalPool(): void {
    // Shimmering golden 3D Credit Crystals dropped by asteroids & drones
    const crystalGeo = new THREE.OctahedronGeometry(1.35, 0);
    crystalGeo.scale(0.72, 1.35, 0.72);
    const haloGeo = new THREE.TorusGeometry(1.85, 0.11, 6, 16);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.25,
      roughness: 0.16,
      metalness: 0.85,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._worldDisposables.push(crystalGeo, haloGeo, crystalMat, haloMat);

    for (let i = 0; i < 48; i++) {
      const group = new THREE.Group();
      const gem = new THREE.Mesh(crystalGeo, crystalMat);
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      group.add(gem);
      group.add(halo);
      group.visible = false;
      this.scene.add(group);
      this.crystals.push({
        active: false,
        value: COIN_ASTEROID_VALUE,
        group,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
      });
    }
  }

  private initWarpLines(): {
    lines: THREE.LineSegments;
    mat: THREE.LineBasicMaterial;
    positions: Float32Array;
    seeds: Float32Array;
  } {
    const positions = new Float32Array(this.warpCount * 2 * 3);
    const seeds = new Float32Array(this.warpCount * 3);
    for (let i = 0; i < this.warpCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = 10 + Math.random() * 28;
      seeds[i * 3] = Math.cos(angle) * rad;
      seeds[i * 3 + 1] = Math.sin(angle) * rad;
      seeds[i * 3 + 2] = Math.random() * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    this.scene.add(lines);
    this._worldDisposables.push(geo, mat);
    return { lines, mat, positions, seeds };
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handleCanvasPointerDown);
    canvas.addEventListener('contextmenu', this.handleCanvasContextMenu);
    window.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.handleResize);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    if (w === this.viewportW && h === this.viewportH) return;
    this.viewportW = w;
    this.viewportH = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    const dpr = this.computeEffectivePixelRatio();
    this.renderer.setPixelRatio(dpr);
    this.world.setPixelRatio(dpr);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  };

  private handleWindowBlur = (): void => {
    this.keys.clear();
    this.mouseFiring = false;
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.keys.clear();
      this.mouseFiring = false;
    }
  };

  private handleCanvasContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleCanvasPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button === 0) {
      this.audio.init();
      this.mouseFiring = true;
    } else if (e.pointerType === 'mouse' && e.button === 2) {
      e.preventDefault();
      this.audio.init();
      this.fireHomingMissile();
    }
  };

  private handlePointerUp = (): void => {
    this.mouseFiring = false;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;

    if (this.phase === 'title' && (code === 'Enter' || code === 'Space')) {
      e.preventDefault();
      this.startNewGame();
      return;
    }

    if (this.phase === 'flyby' && (code === 'Space' || code === 'Enter' || code === 'Escape')) {
      e.preventDefault();
      this.skipFlyby();
      return;
    }

    if (code === 'KeyM' && !e.repeat) {
      this.toggleMute();
      return;
    }

    if (code === 'KeyC' && !e.repeat && this.phase === 'playing') {
      e.preventDefault();
      this.toggleCameraMode();
      return;
    }

    if (code === 'KeyE' && !e.repeat && this.phase === 'playing') {
      e.preventDefault();
      this.audio.init();
      this.fireHomingMissile();
      return;
    }

    if (code === 'KeyQ' && !e.repeat && this.phase === 'playing') {
      e.preventDefault();
      this.audio.init();
      this.triggerDodge();
      return;
    }

    if (code === 'KeyH' && !e.repeat) {
      if (this.phase === 'playing') {
        e.preventDefault();
        this.openHangar();
      } else if (this.phase === 'hangar') {
        e.preventDefault();
        this.closeHangar();
      }
      return;
    }

    if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
      if (this.phase === 'playing') {
        this.pauseGame();
      } else if (this.phase === 'paused') {
        this.resumeGame();
      } else if (this.phase === 'hangar' && code === 'Escape') {
        this.closeHangar();
      }
      return;
    }

    // Double-tap A/D (or ArrowLeft/ArrowRight) within 260ms triggers Barrel Roll Dodge
    if (this.phase === 'playing' && !e.repeat) {
      const tapDir: -1 | 0 | 1 =
        code === 'KeyA' || code === 'ArrowLeft'
          ? -1
          : code === 'KeyD' || code === 'ArrowRight'
          ? 1
          : 0;
      if (tapDir !== 0) {
        const now = performance.now();
        if (this.lastTapDir === tapDir && now - this.lastTapTime <= 260) {
          this.lastTapDir = 0;
          this.lastTapTime = 0;
          this.audio.init();
          this.triggerDodge(tapDir);
        } else {
          this.lastTapDir = tapDir;
          this.lastTapTime = now;
        }
      }
    }

    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    this.keys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  // Public API for React Shell & Mobile Controls
  public startNewGame(options?: {
    skipFlyby?: boolean;
    bossDemo?: boolean;
    cockpit?: boolean;
  }): void {
    this.audio.init();
    this.keys.clear();
    this.mouseFiring = false;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.cameraMode = options?.cockpit ? 'cockpit' : 'third-person';
    this.cockpitBlend = this.cameraMode === 'cockpit' ? 1 : 0;
    this.chromaPulse = 0;

    this.upgradeLevels = createInitialUpgradeLevels();
    if (options?.bossDemo) {
      this.upgradeLevels = { weapon: 3, engine: 2, hull: 2, scanner: 2 };
    }
    this.upgradeStats = getPlayerUpgradeStats(this.upgradeLevels);
    this.syncPlayerWeaponVisuals();

    this.hp = this.upgradeStats.maxHp;
    this.shield = this.upgradeStats.maxShield;
    this.timeSinceLastHit = 10;
    this.boost = this.upgradeStats.maxBoost;
    this.score = options?.bossDemo ? 5400 : 0;
    this.coins = options?.bossDemo ? 680 : 0;
    this.elapsedRunSec = 0;
    this.enemiesDestroyed = 0;
    this.asteroidsDestroyed = 0;
    this.scanStates = createInitialScanStates();
    this.scanLockedMessage = null;
    this.defeatDelayTimer = 0;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;
    this.collisionDamageCooldown = 0;
    this.shipHitFlash = 0;
    this.damageVignette = 0;
    this.crosshairBloom = 0;
    this.hitmarkerTimer = 0;
    this.hitmarkerKill = false;

    // Reset Boss & Ace Pilot state
    this.bossStatus = 'dormant';
    this.bossHp = BOSS_MAX_HP;
    this.bossPhase = 1;
    this.bossVel.set(0, 0, 0);
    this.bossOrbitAngle = 0;
    this.bossAttackCooldown = 2.0;
    this.bossWaveToggle = false;
    this.bossEscortCooldown = 7.0;
    this.bossHitFlash = 0;
    this.bossDyingTimer = 0;
    this.bossChainAccum = 0;

    this.missileAmmo = this.upgradeStats.missileMaxAmmo;
    this.missileReloadProgress = 0;
    this.missileFireCooldown = 0;
    this.lockedTargetType = 'none';
    this.lockedDrone = null;
    this.lockProgress = 0;
    this.lockBeepTimer = 0;
    this.lockFullPlayed = false;
    this.dodgeState = createInitialDodgeState();
    this.lastTapDir = 0;
    this.lastTapTime = 0;

    // Spawn player on an open flight corridor facing Terra (or near Aether for bossDemo)
    if (options?.bossDemo) {
      for (let i = 0; i < 5; i++) {
        this.scanStates[i].scanned = true;
        this.scanStates[i].progress = 100;
      }
      const aether = PLANET_CONFIGS[5];
      this.shipPos.set(aether.position.x, aether.position.y + 6, aether.position.z + 235);
      this.shipYaw = 0;
      this.shipPitch = 0;
    } else {
      this.shipPos.set(0, 0, 0);
      this.shipYaw = 0;
      this.shipPitch = 0.03;
    }
    this.yawRate = 0;
    this.pitchRate = 0;
    this.currentSpeed = this.upgradeStats.cruiseSpeed;
    this.shipVel.set(0, 0, -this.currentSpeed);
    this.ship.root.position.copy(this.shipPos);
    this.ship.root.rotation.set(this.shipPitch, this.shipYaw, 0, 'YXZ');
    this.ship.visualGroup.rotation.set(0, 0, 0);
    this.ship.visualGroup.visible = true;
    this._chaseCamPos.set(this.shipPos.x, this.shipPos.y + 5.2, this.shipPos.z + 16.5);

    // Reset all world entities & pools
    this.world.resetEntities();
    for (const l of this.lasers) {
      l.active = false;
      l.mesh.visible = false;
    }
    for (const m of this.missiles) {
      m.active = false;
      m.group.visible = false;
      m.targetDrone = null;
    }
    for (const o of this.orbs) {
      o.active = false;
      o.group.visible = false;
    }
    for (const c of this.crystals) {
      c.active = false;
      c.group.visible = false;
    }
    for (const sw of this.shockwaves) {
      sw.active = false;
      sw.mesh.visible = false;
    }
    for (const fl of this.plasmaFlashes) {
      fl.active = false;
      fl.mesh.visible = false;
    }
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.debris.length; i++) {
      this.debris[i].active = false;
      this.debrisInstanced.setMatrixAt(i, zeroMat);
    }
    this.debrisInstanced.instanceMatrix.needsUpdate = true;

    if (options?.skipFlyby || options?.bossDemo) {
      this.enterPlayingPhase(options?.bossDemo);
    } else {
      this.phase = 'flyby';
      this.flybyElapsed = 0;
      this.audio.setActive(false);
      this.syncAdaptiveMusic();
      this.warpLineMat.opacity = 0;
      const startCam = this.flybyCamCurve.getPoint(0);
      const startLook = this.flybyLookCurve.getPoint(0);
      this.camera.up.set(0, 1, 0);
      this.camera.position.copy(startCam);
      this.camera.fov = 56;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(startLook);
      this.syncBodyState();
      this.emitHud(true);
    }
  }

  public skipFlyby(): void {
    if (this.phase !== 'flyby') return;
    this.enterPlayingPhase(false);
  }

  public toggleCameraMode(): CameraMode {
    this.cameraMode = toggleCameraModeValue(this.cameraMode);
    this.emitHud(true);
    return this.cameraMode;
  }

  private syncAdaptiveMusic(): void {
    const mode = resolveMusicMode(this.phase, this.bossStatus);
    this.audio.setMusicMode(mode, this.bossPhase);
    this.audio.setBgmDucked(this.phase === 'paused' || this.phase === 'hangar');
  }

  private enterPlayingPhase(isBossDemo = false): void {
    this.phase = 'playing';
    this.audio.init();
    this.audio.setActive(true);
    this.keys.clear();
    this.mouseFiring = false;

    this._chaseCamPos.set(this.shipPos.x, this.shipPos.y + 5.2, this.shipPos.z + 16.5);
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(this._chaseCamPos);
    this.camera.fov = this.cameraMode === 'cockpit' ? 70 : 62;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.shipPos.x, this.shipPos.y + 0.8, this.shipPos.z - 26);

    if (isBossDemo) {
      this.activateBossEncounter();
    } else {
      this.showBanner('Misi Dimulai · Pindai 6 Planet & Kumpulkan Kredit', '#38bdf8', 3.2);
    }
    this.syncAdaptiveMusic();
    this.syncBodyState();
    this.emitHud(true);
  }

  public openHangar(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'hangar';
    this.keys.clear();
    this.mouseFiring = false;
    this.audio.setActive(false);
    this.syncAdaptiveMusic();
    this.syncBodyState();
    this.emitHud(true);
  }

  public closeHangar(): void {
    if (this.phase !== 'hangar') return;
    this.phase = 'playing';
    this.keys.clear();
    this.mouseFiring = false;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.audio.init();
    this.audio.setActive(true);
    this.syncAdaptiveMusic();
    this.syncBodyState();
    this.emitHud(true);
  }

  public buyUpgrade(track: UpgradeTrackId): boolean {
    const prevStats = this.upgradeStats;
    const res = purchaseUpgrade(this.coins, track, this.upgradeLevels);
    if (!res.ok) return false;

    this.coins = res.coins;
    this.upgradeLevels = res.levels;
    this.upgradeStats = getPlayerUpgradeStats(this.upgradeLevels);
    this.syncPlayerWeaponVisuals();

    // Grant immediate bonus HP / Shield / Boost / Missile ammo gained from upgrading
    if (track === 'hull') {
      const hpGain = this.upgradeStats.maxHp - prevStats.maxHp;
      this.hp = Math.min(this.upgradeStats.maxHp, this.hp + hpGain);
      const shieldGain = this.upgradeStats.maxShield - prevStats.maxShield;
      this.shield = Math.min(this.upgradeStats.maxShield, this.shield + Math.max(0, shieldGain));
    } else if (track === 'engine') {
      this.boost = this.upgradeStats.maxBoost;
    } else if (track === 'weapon') {
      this.missileAmmo = this.upgradeStats.missileMaxAmmo;
      this.missileReloadProgress = 0;
    }

    this.audio.init();
    this.audio.playUpgradeSuccess();
    this.emitHud(true);
    return true;
  }

  public repairHull(): boolean {
    const res = purchaseHullRepair(this.coins, this.hp, this.upgradeStats.maxHp);
    if (!res.ok) return false;
    this.coins = res.coins;
    this.hp = res.hp;
    this.audio.init();
    this.audio.playRepair();
    this.emitHud(true);
    return true;
  }

  private syncPlayerWeaponVisuals(): void {
    const [r, g, b] = this.upgradeStats.boltHdrRgb;
    this.playerLaserMat.color.setRGB(r, g, b);
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.keys.clear();
    this.mouseFiring = false;
    this.audio.setActive(false);
    this.syncAdaptiveMusic();
    this.syncBodyState();
    this.emitHud(true);
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.keys.clear();
    this.mouseFiring = false;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.audio.init();
    this.audio.setActive(true);
    this.syncAdaptiveMusic();
    this.syncBodyState();
    this.emitHud(true);
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.keys.clear();
    this.mouseFiring = false;
    this.ship.visualGroup.visible = true;
    this.camera.up.set(0, 1, 0);
    this.audio.setActive(false);
    this.syncAdaptiveMusic();
    this.world.resetEntities();
    this.syncBodyState();
    this.emitHud(true);
  }

  public toggleMute(): boolean {
    this.audio.init();
    const muted = this.audio.toggleMute();
    this.emitHud(true);
    return muted;
  }

  public setGraphicsQuality(nextQuality: GraphicsQuality): void {
    if (this.disposed || this.graphicsQuality === nextQuality) return;
    this.graphicsQuality = nextQuality;
    this.qualityConfig = getGraphicsQualityConfig(nextQuality);

    try {
      window.localStorage.setItem(QUALITY_STORAGE_KEY, nextQuality);
    } catch {
      // Ignore restricted storage
    }

    const dpr = this.computeEffectivePixelRatio();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.viewportW, this.viewportH);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.world.applyQuality(this.qualityConfig, maxAniso, dpr);
    this.ship.applyQuality(maxAniso, this.qualityConfig.hullTexSize);
    this.syncShadowQuality();
    this.rebuildPostProcessing();
    this.emitHud(true);
  }

  private syncShadowQuality(): void {
    const enableShadows = !this.isSoftwareGl && this.graphicsQuality === 'ultra';
    this.renderer.shadowMap.enabled = enableShadows;
    this.world.keyLight.castShadow = enableShadows;
    this.renderer.shadowMap.needsUpdate = true;
    for (const mat of this.ship.hullMaterials) {
      mat.needsUpdate = true;
    }
  }

  private updateDynamicLighting(dt: number): void {
    // 1. Anchor tight 2048x2048 solar shadow camera around player starfighter for sharp self-shadowing
    const keyLight = this.world.keyLight;
    keyLight.target.position.copy(this.shipPos);
    keyLight.position
      .copy(this.shipPos)
      .addScaledVector(this.world.sunDirGlobal, 22);

    // 2. Dynamic Planet Bounce Light reflecting nearest planet's atmosphere onto ship hull
    let nearestDist = Infinity;
    let nearestPlanet = this.world.planets[0];
    for (let i = 0; i < this.world.planets.length; i++) {
      const p = this.world.planets[i];
      const d = this.shipPos.distanceTo(p.group.position) - p.config.radius;
      if (d < nearestDist) {
        nearestDist = d;
        nearestPlanet = p;
      }
    }

    const bounceRange = 235;
    const prox = THREE.MathUtils.clamp(1 - nearestDist / bounceRange, 0, 1);
    const targetIntensity = prox * prox * 4.8;

    if (nearestPlanet) {
      const bouncePalette: Record<string, number> = {
        terra: 0x38bdf8,
        pyros: 0xff5a1f,
        cryos: 0x67e8f9,
        saturnia: 0xf5c26b,
        rubra: 0xea580c,
        aether: 0xc084fc,
      };
      this._bounceTargetColor.setHex(bouncePalette[nearestPlanet.config.id] ?? 0x38bdf8);
      this.planetBounceLight.color.lerp(
        this._bounceTargetColor,
        1 - Math.exp(-4.5 * Math.max(dt, 0.016))
      );

      this._v2
        .subVectors(nearestPlanet.group.position, this.shipPos)
        .normalize();
      this.planetBounceLight.position
        .copy(this.shipPos)
        .addScaledVector(this._v2, 18);
    }

    this.planetBounceLight.intensity = THREE.MathUtils.damp(
      this.planetBounceLight.intensity,
      targetIntensity,
      5.5,
      Math.max(dt, 0.016)
    );
  }

  public setMobileInput(partial: Partial<MobileInputState>): void {
    if (partial.steerX !== undefined) this.mobileInput.steerX = partial.steerX;
    if (partial.steerY !== undefined) this.mobileInput.steerY = partial.steerY;
    if (partial.firing !== undefined) {
      if (partial.firing) this.audio.init();
      this.mobileInput.firing = partial.firing;
    }
    if (partial.boosting !== undefined) {
      if (partial.boosting) this.audio.init();
      this.mobileInput.boosting = partial.boosting;
    }
  }

  public fireHomingMissile(): boolean {
    if (this.phase !== 'playing' || this.defeatDelayTimer > 0) return false;
    if (this.missileFireCooldown > 0) return false;
    const consumed = consumeMissileAmmo(this.missileAmmo);
    if (!consumed.ok) return false;

    const slot = this.missiles.find((m) => !m.active);
    if (!slot) return false;

    this.missileAmmo = consumed.ammo;
    this.missileFireCooldown = 0.28;
    this.missileSideToggle *= -1;
    this.crosshairBloom = 1.0;

    this._forward.set(0, 0, -1).applyQuaternion(this.ship.root.quaternion).normalize();
    this._right.set(1, 0, 0).applyQuaternion(this.ship.root.quaternion).normalize();
    this._up.set(0, 1, 0).applyQuaternion(this.ship.root.quaternion).normalize();

    slot.active = true;
    slot.life = 4.6;
    slot.damage = this.upgradeStats.missileDamage;
    slot.splashRadius = this.upgradeStats.missileSplashRadius;
    slot.trailAccum = 0;

    // Launch from alternating under-wing pylon with a crisp outward arc
    slot.position
      .copy(this.shipPos)
      .addScaledVector(this._right, this.missileSideToggle * 2.8)
      .addScaledVector(this._up, -0.75)
      .addScaledVector(this._forward, 1.4);

    slot.velocity
      .copy(this._forward)
      .multiplyScalar(Math.max(this.currentSpeed + 55, MISSILE_SPEED * 0.72))
      .addScaledVector(this._right, this.missileSideToggle * 26)
      .addScaledVector(this._up, -6);

    if (this.lockedTargetType === 'boss' && this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
      slot.targetType = 'boss';
      slot.targetDrone = null;
    } else if (this.lockedTargetType === 'drone' && this.lockedDrone?.alive) {
      slot.targetType = 'drone';
      slot.targetDrone = this.lockedDrone;
    } else {
      // Snap onto the nearest forward hostile if player fires before full lock
      slot.targetType = 'none';
      slot.targetDrone = null;
      if (this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
        const toBoss = this._v1.copy(this.bossPos).sub(this.shipPos);
        const dBoss = toBoss.length();
        if (dBoss < 460 && toBoss.normalize().dot(this._forward) > 0.65) {
          slot.targetType = 'boss';
        }
      }
      if (slot.targetType === 'none') {
        let bestDot = 0.72;
        for (const d of this.world.drones) {
          if (!d.alive) continue;
          const dist = d.position.distanceTo(this.shipPos);
          if (dist > 340) continue;
          const dot = this._v1.copy(d.position).sub(this.shipPos).normalize().dot(this._forward);
          if (dot > bestDot) {
            bestDot = dot;
            slot.targetType = 'drone';
            slot.targetDrone = d;
          }
        }
      }
    }

    slot.group.position.copy(slot.position);
    this._v2.copy(slot.position).add(slot.velocity);
    slot.group.lookAt(this._v2);
    slot.group.visible = true;

    this.audio.playMissileLaunch();
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.14);
    this.emitHud(true);
    return true;
  }

  public triggerDodge(preferredDir?: -1 | 1): boolean {
    if (this.phase !== 'playing' || this.defeatDelayTimer > 0) return false;
    let dir: -1 | 1 = preferredDir ?? 1;
    if (!preferredDir) {
      const turnLeft =
        this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.mobileInput.steerX < -0.15;
      const turnRight =
        this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.mobileInput.steerX > 0.15;
      if (turnLeft && !turnRight) dir = -1;
      else if (turnRight && !turnLeft) dir = 1;
      else dir = this.dodgeState.direction === 1 ? -1 : 1;
    }

    const res = triggerDodgeRoll(this.dodgeState, dir);
    if (!res.triggered) return false;
    this.dodgeState = res.state;
    this.chromaPulse = Math.min(1, this.chromaPulse + 0.34);
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.12);
    this.audio.playBarrelRoll();
    this.emitHud(true);
    return true;
  }

  private syncBodyState(): void {
    const bodyState =
      this.phase === 'victory' || this.phase === 'gameover' ? 'gameover' : this.phase;
    document.body.dataset.state = bodyState;
    document.body.dataset.phase = this.phase;
  }

  private showBanner(text: string, accent: string, duration = 2.6): void {
    this.bannerText = text;
    this.bannerAccent = accent;
    this.bannerTimer = duration;
  }

  private saveBestScore(): void {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(this.bestScore));
      } catch {
        // Ignore restricted storage
      }
    }
  }

  private spawnShockwaveRing(
    pos: THREE.Vector3,
    colorHex: number,
    startRadius: number,
    endRadius: number,
    duration: number
  ): void {
    const sw = this.shockwaves[this.shockwaveCursor];
    this.shockwaveCursor = (this.shockwaveCursor + 1) % this.shockwaves.length;

    sw.active = true;
    sw.maxLife = duration;
    sw.life = duration;
    sw.startRadius = startRadius;
    sw.endRadius = endRadius;
    sw.mat.color.setHex(colorHex).multiplyScalar(1.65);
    sw.mat.opacity = 0.85;
    sw.mesh.position.copy(pos);
    sw.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    sw.mesh.scale.setScalar(startRadius);
    sw.mesh.visible = true;
  }

  private spawnPlasmaFlash(
    pos: THREE.Vector3,
    colorHex: number,
    maxRadius: number,
    duration = 0.2
  ): void {
    const fl = this.plasmaFlashes[this.flashCursor];
    this.flashCursor = (this.flashCursor + 1) % this.plasmaFlashes.length;

    fl.active = true;
    fl.maxLife = duration;
    fl.life = duration;
    fl.maxRadius = maxRadius;
    fl.mat.color.setHex(colorHex).lerp(new THREE.Color(0xffffff), 0.65).multiplyScalar(2.1);
    fl.mat.opacity = 0.95;
    fl.mesh.position.copy(pos);
    fl.mesh.scale.setScalar(maxRadius * 0.45);
    fl.mesh.visible = true;
  }

  private spawnDebrisShards(
    pos: THREE.Vector3,
    debrisColorHex: number,
    shardCount: number,
    speedScale: number
  ): void {
    const scaled = Math.max(2, Math.round(shardCount * this.qualityConfig.particleScale));
    const baseCol = new THREE.Color(debrisColorHex);
    const scorchedCol = new THREE.Color(0x334155);

    for (let i = 0; i < scaled; i++) {
      const sh = this.debris[this.debrisCursor];
      this.debrisCursor = (this.debrisCursor + 1) % this.debris.length;

      sh.active = true;
      sh.position.copy(pos);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = (18 + Math.random() * 44) * speedScale;
      sh.velocity.set(
        Math.sin(phi) * Math.cos(theta) * spd,
        Math.cos(phi) * spd,
        Math.sin(phi) * Math.sin(theta) * spd
      );
      sh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      sh.rotVel.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      );
      sh.maxLife = 0.75 + Math.random() * 0.75;
      sh.life = sh.maxLife;
      const baseSize = (0.55 + Math.random() * 1.15) * Math.min(2.2, 0.7 + speedScale * 0.42);
      sh.scale.set(
        baseSize * (0.65 + Math.random() * 0.8),
        baseSize * (0.35 + Math.random() * 0.55),
        baseSize * (0.85 + Math.random() * 0.9)
      );
      sh.color.copy(i % 3 === 0 ? scorchedCol : baseCol);
    }
  }

  private spawnExplosion(
    pos: THREE.Vector3,
    colorHex: number,
    count: number,
    speedScale = 1,
    vfx?: {
      shockwave?: boolean;
      shockwaveScale?: number;
      flashScale?: number;
      debrisCount?: number;
      debrisColorHex?: number;
      doubleRing?: boolean;
    }
  ): void {
    const scaledCount = Math.max(4, Math.round(count * this.qualityConfig.particleScale));
    const baseColor = new THREE.Color(colorHex);
    const hotColor = new THREE.Color(0xfffbeb);
    for (let i = 0; i < scaledCount; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;

      p.active = true;
      p.position.copy(pos);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = (14 + Math.random() * 38) * speedScale;
      p.velocity.set(
        Math.sin(phi) * Math.cos(theta) * spd,
        Math.cos(phi) * spd,
        Math.sin(phi) * Math.sin(theta) * spd
      );
      p.maxLife = 0.35 + Math.random() * 0.45;
      p.life = p.maxLife;
      p.size = 0.65 + Math.random() * 1.45;
      p.color.copy(i % 4 === 0 ? hotColor : baseColor);
    }

    // Cinematic 3D Shockwave Ring, rapid plasma core flash & tumbling 3D debris shards
    const triggerShockwave = vfx?.shockwave ?? count >= 14;
    if (triggerShockwave) {
      const swScale = vfx?.shockwaveScale ?? Math.max(10, count * 0.72 * speedScale);
      const swDur = Math.min(0.85, 0.34 + swScale * 0.008);
      this.spawnShockwaveRing(pos, colorHex, Math.max(1.2, swScale * 0.12), swScale, swDur);
      if (vfx?.doubleRing || count >= 34) {
        this.spawnShockwaveRing(pos, 0xfff7ed, Math.max(1.6, swScale * 0.14), swScale * 1.25, swDur * 1.18);
      }

      const flScale = vfx?.flashScale ?? Math.max(3.2, swScale * 0.34);
      this.spawnPlasmaFlash(pos, colorHex, flScale, 0.18 + Math.min(0.18, flScale * 0.008));
    }

    const debrisNum =
      vfx?.debrisCount !== undefined
        ? vfx.debrisCount
        : count >= 16
        ? Math.min(28, Math.round(count * 0.55))
        : 0;
    if (debrisNum > 0) {
      this.spawnDebrisShards(pos, vfx?.debrisColorHex ?? 0x7c8a9e, debrisNum, speedScale);
    }
  }

  private spawnOrb(pos: THREE.Vector3, preferredKind?: 'hp' | 'boost'): void {
    const wantKind =
      preferredKind ??
      (this.hp < this.upgradeStats.maxHp * 0.65 ? 'hp' : Math.random() < 0.5 ? 'hp' : 'boost');
    for (const orb of this.orbs) {
      if (!orb.active && orb.kind === wantKind) {
        orb.active = true;
        orb.position.copy(pos);
        orb.group.position.copy(pos);
        orb.group.visible = true;
        orb.life = 28;
        return;
      }
    }
  }

  private spawnCreditCrystals(pos: THREE.Vector3, count: number, valueEach: number): void {
    let spawned = 0;
    for (const c of this.crystals) {
      if (!c.active) {
        c.active = true;
        c.value = valueEach;
        c.life = 36;
        c.position.copy(pos);
        c.position.x += (Math.random() - 0.5) * 4;
        c.position.y += (Math.random() - 0.5) * 4;
        c.position.z += (Math.random() - 0.5) * 4;
        c.velocity.set(
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 24
        );
        c.group.position.copy(c.position);
        c.group.visible = true;
        spawned++;
        if (spawned >= count) return;
      }
    }
  }

  private firePlayerWeaponVolley(): void {
    const stats = this.upgradeStats;
    this.audio.playLaser(false, stats.weaponLevel);
    this.ship.triggerMuzzleFlash(stats.boltColorHex);
    this.crosshairBloom = 1.0;
    this._forward.set(0, 0, -1).applyQuaternion(this.ship.root.quaternion).normalize();

    const offsets: THREE.Vector3[] =
      stats.boltCount === 4
        ? this.ship.muzzleOffsets4
        : stats.boltCount === 3
        ? [this.ship.muzzleOffsets[0], this.ship.centerMuzzleOffset, this.ship.muzzleOffsets[1]]
        : [this.ship.muzzleOffsets[0], this.ship.muzzleOffsets[1]];

    const radScale = stats.boltRadius / 0.17;
    const lenScale = stats.boltLength / 4.9;

    for (let m = 0; m < offsets.length; m++) {
      for (const bolt of this.lasers) {
        if (!bolt.active && !bolt.isEnemy) {
          bolt.active = true;
          bolt.damage = stats.boltDamage;
          bolt.life = 1.7;

          this._v1.copy(offsets[m]);
          this.ship.visualGroup.localToWorld(this._v1);
          bolt.position.copy(this._v1);
          bolt.velocity.copy(this._forward).multiplyScalar(stats.boltSpeed);

          bolt.mesh.position.copy(bolt.position);
          bolt.mesh.quaternion.copy(this.ship.root.quaternion);
          bolt.mesh.scale.set(radScale, radScale, lenScale);
          bolt.mesh.visible = true;
          break;
        }
      }
    }
  }

  private spawnEnemyBolt(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    damage: number,
    scale = 1.0
  ): void {
    for (const bolt of this.lasers) {
      if (!bolt.active && bolt.isEnemy) {
        bolt.active = true;
        bolt.damage = damage;
        bolt.life = 3.2;
        bolt.position.copy(origin);
        bolt.velocity.copy(direction).normalize().multiplyScalar(speed);
        bolt.mesh.position.copy(bolt.position);
        this._v2.copy(bolt.position).add(bolt.velocity);
        bolt.mesh.lookAt(this._v2);
        bolt.mesh.scale.set(scale, scale, scale * 1.15);
        bolt.mesh.visible = true;
        return;
      }
    }
  }

  private fireEnemyLaser(drone: EnemyDrone, speed: number, damage: number): void {
    this._v1.copy(this.shipPos).sub(drone.position).normalize();
    this.spawnEnemyBolt(drone.position, this._v1, speed, damage, 1.0);
    this.audio.playLaser(true);
  }

  private activateBossEncounter(): void {
    if (this.bossStatus !== 'dormant') return;
    this.bossStatus = 'active';
    this.bossHp = BOSS_MAX_HP;
    this.bossPhase = 1;
    this.bossOrbitAngle = Math.PI * 0.45;
    this.bossAttackCooldown = 1.9;
    this.bossEscortCooldown = 6.5;
    this.bossDyingTimer = 0;

    const aether = PLANET_CONFIGS[5];
    this.bossPos.set(
      aether.position.x + Math.cos(this.bossOrbitAngle) * 105,
      aether.position.y + 18,
      aether.position.z + Math.sin(this.bossOrbitAngle) * 105
    );
    this.world.bossRig.group.position.copy(this.bossPos);
    this.world.bossRig.group.rotation.set(0, 0, 0);
    this.world.bossRig.group.visible = true;

    this.audio.playBossWarningSiren();
    this.syncAdaptiveMusic();
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
    this.chromaPulse = Math.min(1, this.chromaPulse + 0.55);
    this.showBanner('WARNING: DREADNOUGHT DETECTED', '#fb7185', 4.4);
    this.emitHud(true);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastPerfTime) / 1000;
    this.lastPerfTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.totalElapsed += dt;

    if (this.chromaPulse > 0) {
      this.chromaPulse = Math.max(0, this.chromaPulse - dt * 2.1);
    }

    if (this.phase === 'title') {
      this.updateTitleShowcase(dt);
    } else if (this.phase === 'flyby') {
      this.updateFlyby(dt);
    } else if (this.phase === 'playing') {
      this.updatePlaying(dt);
    } else if (this.phase === 'victory' || this.phase === 'gameover') {
      this.ship.visualGroup.visible = true;
      this.camera.up.set(0, 1, 0);
      this.camera.getWorldDirection(this._camForward);
      this.world.updateAmbient(dt, this.totalElapsed, this.shipPos, this._camForward);
      this.updateParticles(dt);
      const orbitAng = this.totalElapsed * 0.25;
      this._camDesired.set(
        this.shipPos.x + Math.cos(orbitAng) * 20,
        this.shipPos.y + 8,
        this.shipPos.z + Math.sin(orbitAng) * 20
      );
      this.camera.position.lerp(this._camDesired, 1 - Math.exp(-2.5 * dt));
      this.camera.lookAt(this.shipPos);
    }

    this.updateDynamicLighting(dt);

    if (this.opticsPass) {
      this.opticsPass.uniforms.uChroma.value = computeDynamicChroma(
        this.phase === 'playing' && this.isBoosting,
        this.chromaPulse
      );
      this.opticsPass.uniforms.uTime.value = this.totalElapsed;
    }

    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateTitleShowcase(dt: number): void {
    const t = this.totalElapsed;
    this.ship.visualGroup.visible = true;
    this.camera.up.set(0, 1, 0);
    this.shipPos.set(16 + Math.sin(t * 0.45) * 2.8, -2.5 + Math.sin(t * 0.7) * 1.4, -44);
    this.ship.root.position.copy(this.shipPos);
    this.ship.root.rotation.set(Math.sin(t * 0.6) * 0.05, -0.34 + Math.sin(t * 0.35) * 0.07, 0, 'YXZ');
    this.ship.updateVisuals(
      dt,
      t,
      false,
      -0.2 + Math.sin(t * 0.5) * 0.08,
      0,
      0,
      0,
      Math.cos(t * 0.35) * 0.35,
      Math.cos(t * 0.6) * 0.2
    );

    this.camera.position.set(10 + Math.sin(t * 0.25) * 2.0, 3.8 + Math.cos(t * 0.3) * 1.0, -24);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 54, 4, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(-6, 0.5, -108);

    this.warpLineMat.opacity = 0;
    this.camera.getWorldDirection(this._camForward);
    this.world.updateAmbient(dt, t, this.shipPos, this._camForward);
    this.updateParticles(dt);
  }

  private updateFlyby(dt: number): void {
    this.flybyElapsed += dt;
    const rawT = Math.min(1, this.flybyElapsed / FLYBY_DURATION_SEC);
    // Smooth ease-in-out curve across the 6-planet solar showcase
    const easedT = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
    const splineT = Math.min(1, Math.max(0, easedT * 0.25 + rawT * 0.75));

    this.flybyCamCurve.getPoint(splineT, this._camDesired);
    this.flybyLookCurve.getPoint(splineT, this._camLook);

    this.camera.position.copy(this._camDesired);
    const targetFov = rawT > 0.85 ? THREE.MathUtils.lerp(56, 62, (rawT - 0.85) / 0.15) : 56;
    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this._camLook);

    // Keep player ship idling gracefully at start gate waiting for handoff
    this.ship.root.position.copy(this.shipPos);
    this.ship.root.rotation.set(this.shipPitch, this.shipYaw, 0, 'YXZ');
    this.ship.updateVisuals(dt, this.totalElapsed, false, 0, 0);
    this.camera.getWorldDirection(this._camForward);
    this.world.updateAmbient(dt, this.totalElapsed, this.camera.position, this._camForward);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.12) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }

    if (rawT >= 1) {
      this.enterPlayingPhase(false);
    }
  }

  private updatePlaying(dt: number): void {
    if (this.defeatDelayTimer > 0) {
      this.defeatDelayTimer -= dt;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.4);
      this.updateParticles(dt);
      this.camera.getWorldDirection(this._camForward);
      this.world.updateAmbient(dt, this.totalElapsed, this.shipPos, this._camForward);
      if (this.defeatDelayTimer <= 0) {
        this.phase = 'gameover';
        this.audio.setActive(false);
        this.syncAdaptiveMusic();
        this.audio.playDefeat();
        this.saveBestScore();
        this.syncBodyState();
        this.emitHud(true);
      }
      return;
    }

    const timeScale = this.hitstopTimer > 0 ? 0.08 : 1.0;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
    }
    const simDt = dt * timeScale;
    this.elapsedRunSec += simDt;
    this.timeSinceLastHit += simDt;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
      }
    }

    if (this.collisionDamageCooldown > 0) this.collisionDamageCooldown -= dt;
    if (this.shipHitFlash > 0) this.shipHitFlash = Math.max(0, this.shipHitFlash - dt * 3.5);
    if (this.damageVignette > 0) this.damageVignette = Math.max(0, this.damageVignette - dt * 2.2);
    if (this.crosshairBloom > 0) this.crosshairBloom = Math.max(0, this.crosshairBloom - dt * 6.5);
    if (this.hitmarkerTimer > 0) this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - dt);
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);

    // Regenerate Energy Shield automatically if Hull & Shield >= Lv.2 and out of combat
    if (this.upgradeStats.maxShield > 0) {
      this.shield = updateShieldRegen(
        this.shield,
        this.upgradeStats.maxShield,
        this.timeSinceLastHit,
        this.upgradeStats.shieldRegenRate,
        simDt
      );
    }

    // Auto-recharge Homing Missile magazine & advance Barrel Roll dodge state
    if (this.missileFireCooldown > 0) this.missileFireCooldown = Math.max(0, this.missileFireCooldown - simDt);
    const missileNext = updateMissileAmmo(
      this.missileAmmo,
      this.upgradeStats.missileMaxAmmo,
      this.missileReloadProgress,
      this.upgradeStats.missileReloadSec,
      simDt
    );
    this.missileAmmo = missileNext.ammo;
    this.missileReloadProgress = missileNext.reloadProgress;
    this.dodgeState = updateDodgeRoll(this.dodgeState, simDt);

    // 1. Gather desktop + mobile flight inputs
    const pitchUp = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const pitchDown = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const turnLeft = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const turnRight = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const boostRequested =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.mobileInput.boosting;
    const fireRequested =
      this.keys.has('Space') || this.mouseFiring || this.mobileInput.firing;

    let steerX = (turnRight ? 1 : 0) - (turnLeft ? 1 : 0);
    if (Math.abs(this.mobileInput.steerX) > 0.05) {
      steerX = THREE.MathUtils.clamp(this.mobileInput.steerX, -1, 1);
    }

    let steerY = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
    if (Math.abs(this.mobileInput.steerY) > 0.05) {
      steerY = THREE.MathUtils.clamp(this.mobileInput.steerY, -1, 1);
    }

    // 2. Boost energy & speed curve (scaled by Engine upgrade)
    const boostRes = updateBoostEnergy(
      this.boost,
      boostRequested,
      simDt,
      this.upgradeStats.maxBoost,
      this.upgradeStats.boostRegenRate
    );
    this.boost = boostRes.boost;
    this.isBoosting = boostRes.isBoosting;

    const targetSpeed = this.isBoosting
      ? this.upgradeStats.boostSpeed
      : this.upgradeStats.cruiseSpeed;
    this.currentSpeed = THREE.MathUtils.damp(this.currentSpeed, targetSpeed, 5.5, simDt);

    // 3. Smooth flight turning & pitch with automatic banking
    const targetYawRate = -steerX * (this.isBoosting ? 1.55 : 1.85);
    const targetPitchRate = steerY * (this.isBoosting ? 1.25 : 1.45);
    this.yawRate = THREE.MathUtils.damp(this.yawRate, targetYawRate, 8.0, simDt);
    this.pitchRate = THREE.MathUtils.damp(this.pitchRate, targetPitchRate, 8.0, simDt);

    this.shipYaw += this.yawRate * simDt;
    this.shipPitch = THREE.MathUtils.clamp(this.shipPitch + this.pitchRate * simDt, -1.08, 1.08);

    this._euler.set(this.shipPitch, this.shipYaw, 0, 'YXZ');
    this._quat.setFromEuler(this._euler);
    this.ship.root.quaternion.copy(this._quat);

    this._forward.set(0, 0, -1).applyQuaternion(this._quat).normalize();
    this._right.set(1, 0, 0).applyQuaternion(this._quat).normalize();
    this._v1.copy(this._forward).multiplyScalar(this.currentSpeed);

    // Add brief lateral burst impulse during Barrel Roll Dodge
    let dodgeRollAngle = 0;
    let dodgeEnergy = 0;
    if (this.dodgeState.active) {
      const progress = 1 - this.dodgeState.timer / DODGE_DURATION;
      const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      dodgeRollAngle = -this.dodgeState.direction * eased * Math.PI * 2;
      dodgeEnergy = Math.sin(progress * Math.PI);
      this._v1.addScaledVector(this._right, this.dodgeState.direction * 98 * dodgeEnergy);
    }

    this.shipVel.lerp(this._v1, 1 - Math.exp(-(this.dodgeState.active ? 11.5 : 5.5) * simDt));
    this.shipPos.addScaledVector(this.shipVel, simDt);

    // Soft outer boundary leash
    if (this.shipPos.length() > 1450) {
      this._v2.copy(this.shipPos).normalize().multiplyScalar(-45);
      this.shipVel.lerp(this._v2, 0.25);
    }

    // 4. Solid Planet, Moon & Dreadnought Collisions
    for (const p of this.world.planets) {
      const col = resolveSphereCollision(
        this.shipPos,
        this.shipVel,
        SHIP_COLLISION_RADIUS,
        p.config.position,
        p.config.radius,
        this.collisionDamageCooldown <= 0
      );
      if (col.collided) {
        this.shipPos.set(col.position.x, col.position.y, col.position.z);
        this.shipVel.set(col.velocity.x, col.velocity.y, col.velocity.z);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
        this.shipHitFlash = 1.0;
        if (col.damage > 0) {
          this.collisionDamageCooldown = 0.85;
          this.applyPlayerDamage(col.damage, `Benturan atmosfer ${p.config.name}!`);
        }
      }

      if (p.config.hasMoon && p.config.moonRadius) {
        const moonPos = getMoonPosition(p.config, this.totalElapsed);
        if (moonPos) {
          const mCol = resolveSphereCollision(
            this.shipPos,
            this.shipVel,
            SHIP_COLLISION_RADIUS,
            moonPos,
            p.config.moonRadius,
            this.collisionDamageCooldown <= 0
          );
          if (mCol.collided) {
            this.shipPos.set(mCol.position.x, mCol.position.y, mCol.position.z);
            this.shipVel.set(mCol.velocity.x, mCol.velocity.y, mCol.velocity.z);
            this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
            this.shipHitFlash = 1.0;
            if (mCol.damage > 0) {
              this.collisionDamageCooldown = 0.85;
              this.applyPlayerDamage(mCol.damage, 'Benturan bulan Aether!');
            }
          }
        }
      }
    }

    if (this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
      const bCol = resolveSphereCollision(
        this.shipPos,
        this.shipVel,
        SHIP_COLLISION_RADIUS,
        this.bossPos,
        BOSS_COLLISION_RADIUS,
        this.collisionDamageCooldown <= 0
      );
      if (bCol.collided) {
        this.shipPos.set(bCol.position.x, bCol.position.y, bCol.position.z);
        this.shipVel.set(bCol.velocity.x, bCol.velocity.y, bCol.velocity.z);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.65);
        this.shipHitFlash = 1.0;
        if (bCol.damage > 0) {
          this.collisionDamageCooldown = 0.85;
          this.applyPlayerDamage(18, 'Benturan lambung Dreadnought!');
        }
      }
    }

    this.ship.root.position.copy(this.shipPos);
    const bankAngle = -steerX * 0.68;
    this.ship.updateVisuals(
      dt,
      this.totalElapsed,
      this.isBoosting,
      bankAngle,
      this.shipHitFlash,
      dodgeRollAngle,
      dodgeEnergy,
      this.yawRate,
      this.pitchRate
    );

    // 5. Weapons firing (uses upgraded weapon tier & fire rate)
    if (this.fireCooldown > 0) this.fireCooldown -= simDt;
    if (fireRequested && this.fireCooldown <= 0) {
      this.fireCooldown = this.upgradeStats.fireInterval;
      this.firePlayerWeaponVolley();
    }

    // 6. Check Boss Trigger & Update World Entities
    if (shouldTriggerBossEncounter(this.shipPos, this.scanStates, this.bossStatus)) {
      this.activateBossEncounter();
    }

    this.camera.getWorldDirection(this._camForward);
    this.world.updateAmbient(simDt, this.totalElapsed, this.shipPos, this._camForward);
    this.updateBoss(simDt);
    this.updateAsteroids(simDt);
    this.updateDrones(simDt);
    this.updateLasers(simDt);
    this.updateMissiles(simDt);
    this.updateOrbs(simDt);
    this.updateCrystals(simDt);
    this.updateParticles(dt);

    // 7. Planet Scanning Logic (with Scanner upgrade & 6th planet Boss lock)
    const scanRes = updatePlanetScan(this.shipPos, this.scanStates, simDt, {
      scanRate: this.upgradeStats.scanRate,
      bossStatus: this.bossStatus,
    });

    if (scanRes.lockedPlanet) {
      this.scanLockedMessage =
        scanRes.lockReason === 'boss_alive'
          ? 'Scan Aether Terkunci · Kalahkan Boss Dreadnought Dahulu!'
          : 'Pindai 5 Planet Lain Sebelum Memindai Aether';
    } else {
      this.scanLockedMessage = null;
    }

    if (scanRes.activePlanet) {
      this.sonarCooldown -= simDt;
      if (this.sonarCooldown <= 0) {
        this.sonarCooldown = 0.62;
        this.audio.playSonarPing(scanRes.activeProgress / 100);
      }
    } else {
      this.sonarCooldown = 0.1;
    }

    // Animate 3D planet scan rings
    for (let i = 0; i < this.world.planets.length; i++) {
      const pObj = this.world.planets[i];
      const st = this.scanStates[i];
      if (st.scanned) {
        pObj.scanRingMat.color.setHex(0x34d399);
        pObj.scanRingMat.opacity = 0.48;
        pObj.scanRing.rotation.z += simDt * 0.5;
        pObj.scanRing.scale.setScalar(pObj.config.radius);
      } else if (scanRes.lockedPlanet?.id === pObj.config.id) {
        pObj.scanRingMat.color.setHex(0xf43f5e);
        pObj.scanRingMat.opacity = 0.55 + Math.sin(this.totalElapsed * 8) * 0.2;
        pObj.scanRing.rotation.z -= simDt * 1.4;
        pObj.scanRing.scale.setScalar(pObj.config.radius * 1.05);
      } else if (scanRes.activePlanet?.id === pObj.config.id) {
        const pulse = 1 + Math.sin(this.totalElapsed * 7) * 0.12;
        pObj.scanRingMat.color.setHex(0x38bdf8);
        pObj.scanRingMat.opacity = 0.72;
        pObj.scanRing.rotation.z += simDt * 2.2;
        pObj.scanRing.scale.setScalar(pObj.config.radius * pulse);
      } else {
        pObj.scanRingMat.color.set(pObj.config.accentHex);
        pObj.scanRingMat.opacity = 0.18;
        pObj.scanRing.rotation.z += simDt * 0.2;
        pObj.scanRing.scale.setScalar(pObj.config.radius);
      }
    }

    if (scanRes.justCompleted) {
      this.score += PLANET_SCAN_REWARD;
      this.coins += COIN_PLANET_SCAN_BONUS;
      this.saveBestScore();
      this.audio.playScanComplete();
      this.spawnExplosion(
        this._v1.set(
          scanRes.justCompleted.position.x,
          scanRes.justCompleted.position.y,
          scanRes.justCompleted.position.z
        ),
        0x34d399,
        24,
        2.2,
        { shockwave: true, shockwaveScale: scanRes.justCompleted.radius * 1.7, debrisCount: 0 }
      );

      if (scanRes.scannedCount === 5 && this.bossStatus === 'dormant') {
        this.showBanner(
          `${scanRes.justCompleted.name} Terpindai! +${COIN_PLANET_SCAN_BONUS} Koin · Menuju Aether!`,
          '#fbbf24',
          3.8
        );
      } else {
        this.showBanner(
          `${scanRes.justCompleted.name} Terpindai! +${PLANET_SCAN_REWARD} Poin · +${COIN_PLANET_SCAN_BONUS} Koin`,
          '#34d399',
          3.2
        );
      }

      if (scanRes.allScanned) {
        this.phase = 'victory';
        this.audio.setActive(false);
        this.syncAdaptiveMusic();
        this.audio.playVictory();
        this.saveBestScore();
        this.syncBodyState();
        this.emitHud(true);
        return;
      }
      this.emitHud(true);
    }

    // 8. Smooth Third-Person Chase / First-Person Cockpit Camera + Dynamic FOV + Trauma Shake
    this._up.set(0, 1, 0).applyQuaternion(this._quat);
    this._right.set(1, 0, 0).applyQuaternion(this._quat);

    const targetCockpit = this.cameraMode === 'cockpit' ? 1 : 0;
    this.cockpitBlend = THREE.MathUtils.damp(this.cockpitBlend, targetCockpit, 9.5, dt);
    this.ship.visualGroup.visible = this.cockpitBlend < 0.55;

    const chaseDist = this.isBoosting ? 18.8 : 16.0;
    const chaseHeight = this.isBoosting ? 4.8 : 5.2;
    this._camDesired
      .copy(this.shipPos)
      .addScaledVector(this._forward, -chaseDist)
      .addScaledVector(this._up, chaseHeight);

    const camAlpha = 1 - Math.exp(-7.5 * dt);
    this._chaseCamPos.lerp(this._camDesired, camAlpha);

    // First-person cockpit eye-line anchored at pilot canopy looking straight down the nose
    this._cockpitPos
      .copy(this.shipPos)
      .addScaledVector(this._up, 0.58)
      .addScaledVector(this._forward, 1.35);

    this.camera.position.copy(this._chaseCamPos).lerp(this._cockpitPos, this.cockpitBlend);

    const lookForwardDist = THREE.MathUtils.lerp(26, 110, this.cockpitBlend);
    this._camLook.copy(this.shipPos).addScaledVector(this._forward, lookForwardDist);

    if (this.cameraTrauma > 0.005) {
      const shakeMult = THREE.MathUtils.lerp(1.45, 0.42, this.cockpitBlend);
      const shake = this.cameraTrauma * this.cameraTrauma * shakeMult;
      this.camera.position.x += (Math.random() * 2 - 1) * shake;
      this.camera.position.y += (Math.random() * 2 - 1) * shake;
      this._camLook.x += (Math.random() * 2 - 1) * shake * 0.7;
      this._camLook.y += (Math.random() * 2 - 1) * shake * 0.7;
    }

    // Subtle cockpit banking roll horizon tilt while keeping 3P chase level
    this._camUp
      .set(0, 1, 0)
      .lerp(this._up, this.cockpitBlend)
      .addScaledVector(this._right, -bankAngle * 0.34 * this.cockpitBlend)
      .normalize();
    this.camera.up.copy(this._camUp);
    this.camera.lookAt(this._camLook);

    const baseFov = THREE.MathUtils.lerp(62, 70, this.cockpitBlend);
    const boostFov = THREE.MathUtils.lerp(82, 88, this.cockpitBlend);
    const targetFov = this.isBoosting ? boostFov : baseFov;
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6.5, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.02) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    // 9. Update 3D Warp Speed Lines
    this.updateWarpLines(dt);

    // 10. Update Engine & Boost Audio
    this.audio.updateEngine((this.currentSpeed - 60) / 115, this.isBoosting);

    // 11. Compute Waypoint, Target Lock-On, Ballistic Lead Indicator & 3D Holographic Radar
    this.camera.updateMatrixWorld();
    const nearestUnscanned = findNearestPlanet(this.shipPos, this.scanStates, true);
    let waypoint: WaypointScreenData | null = null;
    if (this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
      waypoint = this.projectWorldWaypoint(
        this.bossPos,
        'DREADNOUGHT',
        '#fb7185',
        'aether',
        Math.max(0, this.shipPos.distanceTo(this.bossPos) - BOSS_COLLISION_RADIUS)
      );
    } else if (nearestUnscanned) {
      waypoint = this.projectPlanetWaypoint(nearestUnscanned.planet, nearestUnscanned.distance);
    }

    const { lockOn, leadIndicator } = this.updateTargetLockOn(simDt);
    const radar = this.buildRadarFrame();

    this.onFastOverlay({
      waypoint,
      hpRatio: this.hp / Math.max(1, this.upgradeStats.maxHp),
      shieldRatio:
        this.upgradeStats.maxShield > 0 ? this.shield / this.upgradeStats.maxShield : 0,
      boostRatio: this.boost / Math.max(1, this.upgradeStats.maxBoost),
      bossHpRatio: this.bossStatus === 'active' ? Math.max(0, this.bossHp / BOSS_MAX_HP) : 0,
      scanProgress: scanRes.activeProgress,
      damageFlash: this.damageVignette,
      crosshairBloom: this.crosshairBloom,
      hitmarkerRatio: Math.min(1, this.hitmarkerTimer / 0.22),
      hitmarkerKill: this.hitmarkerKill,
      lockOn,
      leadIndicator,
      missileReloadRatio: this.missileReloadProgress,
      dodgeCooldownRatio: Math.max(0, Math.min(1, this.dodgeState.cooldown / DODGE_COOLDOWN)),
      dodgeActive: this.dodgeState.active,
      radar,
    });

    // Throttled React HUD state update (~10Hz)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.1) {
      this.hudEmitAccum = 0;
      this.emitHud(false, scanRes.activePlanet, scanRes.activeProgress);
    }
  }

  private updateBoss(dt: number): void {
    if (this.bossStatus !== 'active') return;

    const rig = this.world.bossRig;

    // Dramatic chained explosion sequence when Boss HP hits 0
    if (this.bossDyingTimer > 0) {
      this.bossDyingTimer -= dt;
      this.bossChainAccum += dt;
      rig.updateVisuals(dt, this.totalElapsed, 2, 1.0, 1 - this.bossDyingTimer / 1.85);

      if (this.bossChainAccum >= 0.26) {
        this.bossChainAccum = 0;
        this._v1
          .copy(this.bossPos)
          .add(
            this._v2.set(
              (Math.random() - 0.5) * 26,
              (Math.random() - 0.5) * 10,
              (Math.random() - 0.5) * 28
            )
          );
        this.spawnExplosion(this._v1, Math.random() < 0.5 ? 0xf97316 : 0xfb7185, 22, 1.75, {
          shockwave: true,
          shockwaveScale: 24,
          debrisCount: 10,
          debrisColorHex: 0x64748b,
        });
        this.audio.playBossExplosionChain();
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);
        this.chromaPulse = Math.min(1, this.chromaPulse + 0.55);
      }

      if (this.bossDyingTimer <= 0) {
        this.bossStatus = 'defeated';
        rig.group.visible = false;
        this.spawnExplosion(this.bossPos, 0xfbbf24, 56, 2.8, {
          shockwave: true,
          shockwaveScale: 62,
          flashScale: 22,
          debrisCount: 34,
          debrisColorHex: 0x475569,
          doubleRing: true,
        });
        this.spawnExplosion(this.bossPos, 0x38bdf8, 28, 2.3, {
          shockwave: true,
          shockwaveScale: 48,
          debrisCount: 0,
        });
        this.audio.playBossExplosionChain();
        this.syncAdaptiveMusic();
        this.cameraTrauma = 1.0;
        this.chromaPulse = 1.0;

        this.score += BOSS_KILL_SCORE_REWARD;
        this.coins += COIN_BOSS_KILL_BONUS;
        this.saveBestScore();
        this.spawnCreditCrystals(this.bossPos, 10, 45);
        this.spawnOrb(this.bossPos, 'hp');
        this.showBanner(
          `DREADNOUGHT HANCUR! +${BOSS_KILL_SCORE_REWARD} Poin · +${COIN_BOSS_KILL_BONUS} Koin · Pindai Aether!`,
          '#34d399',
          4.8
        );
        this.emitHud(true);
      }
      return;
    }

    if (this.bossHitFlash > 0) {
      this.bossHitFlash = Math.max(0, this.bossHitFlash - dt * 5.5);
    }

    const nextPhase = getBossPhase(this.bossHp, BOSS_MAX_HP);
    if (nextPhase === 2 && this.bossPhase === 1) {
      this.bossPhase = 2;
      this.audio.playBossPhaseShift();
      this.syncAdaptiveMusic();
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.6);
      this.chromaPulse = Math.min(1, this.chromaPulse + 0.68);
      this.spawnExplosion(this.bossPos, 0xf43f5e, 28, 1.8, {
        shockwave: true,
        shockwaveScale: 42,
        debrisCount: 8,
      });
      this.showBanner('FASE 2 · INTI REAKTOR OVERDRIVE!', '#fb7185', 3.4);
      this.emitHud(true);
    }

    // Orbit majestically around Aether while tracking the player
    const aether = PLANET_CONFIGS[5];
    const orbitSpeed = this.bossPhase === 2 ? 0.34 : 0.21;
    this._prevBossPos.copy(this.bossPos);
    this.bossOrbitAngle += orbitSpeed * dt;
    const orbitR = 98;
    this.bossPos.set(
      aether.position.x + Math.cos(this.bossOrbitAngle) * orbitR,
      aether.position.y + 18 + Math.sin(this.bossOrbitAngle * 1.6) * 14,
      aether.position.z + Math.sin(this.bossOrbitAngle) * orbitR
    );
    if (dt > 0.0005) {
      this.bossVel.copy(this.bossPos).sub(this._prevBossPos).divideScalar(dt);
    }
    rig.group.position.copy(this.bossPos);

    // Smoothly turn bow toward the player
    this._dummy.position.copy(this.bossPos);
    this._dummy.lookAt(this.shipPos);
    rig.group.quaternion.slerp(this._dummy.quaternion, 1 - Math.exp(-2.2 * dt));
    rig.updateVisuals(dt, this.totalElapsed, this.bossPhase, this.bossHitFlash, 0);

    const distToPlayer = this.bossPos.distanceTo(this.shipPos);
    if (distToPlayer < 360) {
      // Weapon attack cadence
      this.bossAttackCooldown -= dt;
      if (this.bossAttackCooldown <= 0) {
        if (this.bossPhase === 1) {
          this.fireBossSpreadVolley(5, 178, 12);
          this.bossAttackCooldown = 2.05;
        } else {
          // Phase 2: faster cadence alternating heavy spread volley & circular plasma ring wave
          this.bossWaveToggle = !this.bossWaveToggle;
          if (this.bossWaveToggle) {
            this.fireBossCircularPlasmaWave(14, 152, 13);
            this.bossAttackCooldown = 1.45;
          } else {
            this.fireBossSpreadVolley(7, 205, 13);
            this.bossAttackCooldown = 1.35;
          }
        }
      }

      // Escort drone launches in Phase 1 (and slower in Phase 2)
      this.bossEscortCooldown -= dt;
      if (this.bossEscortCooldown <= 0) {
        this.bossEscortCooldown = this.bossPhase === 1 ? 8.8 : 11.5;
        let activeNearby = 0;
        for (const d of this.world.drones) {
          if (d.alive && d.position.distanceTo(this.bossPos) < 230) activeNearby++;
        }
        if (activeNearby < 3) {
          this._v1.copy(rig.hangarBayOffset);
          rig.group.localToWorld(this._v1);
          if (this.world.spawnEscortDrone(this._v1)) {
            this.spawnExplosion(this._v1, 0xf97316, 8, 0.7);
          }
        }
      }
    }
  }

  private fireBossSpreadVolley(boltCount: number, speed: number, damage: number): void {
    const rig = this.world.bossRig;
    const baseDir = this._v3.copy(this.shipPos).sub(this.bossPos).normalize();
    const rightAxis = new THREE.Vector3().crossVectors(baseDir, THREE.Object3D.DEFAULT_UP).normalize();
    if (rightAxis.lengthSq() < 0.01) rightAxis.set(1, 0, 0);

    const half = (boltCount - 1) / 2;
    for (let i = 0; i < boltCount; i++) {
      const turretOffset = rig.turretOffsets[i % rig.turretOffsets.length];
      this._v1.copy(turretOffset);
      rig.group.localToWorld(this._v1);

      const spread = (i - half) * 0.095;
      const dir = baseDir
        .clone()
        .addScaledVector(rightAxis, Math.sin(spread))
        .normalize();
      this.spawnEnemyBolt(this._v1, dir, speed, damage, 1.45);
    }
    this.audio.playLaser(true);
  }

  private fireBossCircularPlasmaWave(boltCount: number, speed: number, damage: number): void {
    // Radiate a dramatic 360-degree plasma wave tilted toward the player's elevation plane
    const toPlayer = this._v3.copy(this.shipPos).sub(this.bossPos).normalize();
    const basisA = new THREE.Vector3().crossVectors(toPlayer, THREE.Object3D.DEFAULT_UP).normalize();
    if (basisA.lengthSq() < 0.01) basisA.set(1, 0, 0);
    const basisB = new THREE.Vector3().crossVectors(basisA, toPlayer).normalize();

    for (let i = 0; i < boltCount; i++) {
      const angle = (i / boltCount) * Math.PI * 2;
      const dir = new THREE.Vector3()
        .addScaledVector(toPlayer, Math.cos(angle))
        .addScaledVector(basisA, Math.sin(angle))
        .addScaledVector(basisB, Math.sin(angle * 2) * 0.14)
        .normalize();
      this._v1.copy(this.bossPos).addScaledVector(dir, 14);
      this.spawnEnemyBolt(this._v1, dir, speed, damage, 1.65);
    }
    this.audio.playTelegraph();
  }

  private projectPlanetWaypoint(planet: PlanetConfig, surfaceDist: number): WaypointScreenData {
    return this.projectWorldWaypoint(
      this._v1.set(planet.position.x, planet.position.y, planet.position.z),
      planet.name,
      planet.accentHex,
      planet.id,
      surfaceDist
    );
  }

  private projectWorldWaypoint(
    worldPos: THREE.Vector3,
    label: string,
    accentHex: string,
    planetId: PlanetConfig['id'],
    distance: number
  ): WaypointScreenData {
    this._proj.copy(worldPos);
    this._invCamMat.copy(this.camera.matrixWorld).invert();
    this._camLocal.copy(this._proj).applyMatrix4(this._invCamMat);
    const behindCamera = this._camLocal.z > 0;

    this._proj.project(this.camera);
    const margin = this.viewportW < 640 ? 44 : 64;

    const pseudoPlanet: PlanetConfig = {
      ...PLANET_CONFIGS[0],
      id: planetId,
      name: label,
      accentHex,
    };

    return computeWaypointScreen(
      this._proj.x,
      this._proj.y,
      behindCamera,
      this.viewportW,
      this.viewportH,
      distance,
      pseudoPlanet,
      margin
    );
  }

  private updateWarpLines(dt: number): void {
    const targetOpacity = this.isBoosting ? 0.64 : 0.07;
    this.warpLineMat.opacity = THREE.MathUtils.damp(this.warpLineMat.opacity, targetOpacity, 7, dt);

    const streakLen = this.isBoosting ? 18.0 : 3.2;
    const speed = this.isBoosting ? 240 : 65;

    for (let i = 0; i < this.warpCount; i++) {
      let zPhase = this.warpSeeds[i * 3 + 2] - speed * dt;
      if (zPhase < -10) zPhase += 120;
      this.warpSeeds[i * 3 + 2] = zPhase;

      const ox = this.warpSeeds[i * 3];
      const oy = this.warpSeeds[i * 3 + 1];

      this._v1
        .copy(this.shipPos)
        .addScaledVector(this._right, ox)
        .addScaledVector(this._up, oy)
        .addScaledVector(this._forward, zPhase);

      this._v2.copy(this._v1).addScaledVector(this._forward, -streakLen);

      const base = i * 6;
      this.warpPositions[base] = this._v1.x;
      this.warpPositions[base + 1] = this._v1.y;
      this.warpPositions[base + 2] = this._v1.z;
      this.warpPositions[base + 3] = this._v2.x;
      this.warpPositions[base + 4] = this._v2.y;
      this.warpPositions[base + 5] = this._v2.z;
    }

    (this.warpLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateAsteroids(dt: number): void {
    for (const a of this.world.asteroids) {
      if (!a.alive) continue;
      a.orbitAngle += a.orbitSpeed * dt;
      a.position.set(
        a.orbitCenter.x + Math.cos(a.orbitAngle) * a.orbitRadius,
        a.orbitCenter.y + a.orbitElevation + Math.sin(a.orbitAngle * 2) * 3.5,
        a.orbitCenter.z + Math.sin(a.orbitAngle) * a.orbitRadius
      );
      a.mesh.position.copy(a.position);
      a.mesh.rotation.x += a.rotSpeed.x * dt;
      a.mesh.rotation.y += a.rotSpeed.y * dt;

      if (a.hitFlash > 0) {
        a.hitFlash = Math.max(0, a.hitFlash - dt * 6);
        const mat = a.mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(a.hitFlash > 0 ? 0xffaa44 : 0x000000);
        mat.emissiveIntensity = a.hitFlash * 1.4;
      }

      const minDist = a.radius + SHIP_COLLISION_RADIUS;
      if (this.shipPos.distanceToSquared(a.position) < minDist * minDist) {
        a.alive = false;
        a.mesh.visible = false;
        this.spawnExplosion(a.position, 0xf97316, 16, 1.1);
        this.spawnCreditCrystals(a.position, 1, COIN_ASTEROID_VALUE);
        this.audio.playExplosion(false);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.5);
        this.applyPlayerDamage(14, 'Menabrak asteroid!');
      }
    }
  }

  private updateDrones(dt: number): void {
    const scannedCount = this.scanStates.filter((s) => s.scanned).length;
    const diff = getDifficultyMultiplier(scannedCount);
    let activeAttackers = 0;

    for (const d of this.world.drones) {
      if (!d.alive) {
        if (d.dyingTimer > 0) {
          d.dyingTimer -= dt;
          d.group.rotation.z += 12 * dt;
          d.group.rotation.x += 8 * dt;
          d.group.position.addScaledVector(d.velocity, dt);
          const s = Math.max(0.01, d.dyingTimer / 0.32);
          d.group.scale.setScalar(s);
          if (d.dyingTimer <= 0) {
            d.group.visible = false;
            this.spawnExplosion(d.position, 0xfb7185, 22, 1.35);
            this.audio.playExplosion(true);
            this.spawnOrb(d.position);
            this.spawnCreditCrystals(d.position, 2, COIN_DRONE_VALUE);
          }
        }
        continue;
      }

      if (d.hitFlash > 0) {
        d.hitFlash = Math.max(0, d.hitFlash - dt * 6);
        d.bodyMat.emissive.setHex(d.hitFlash > 0 ? 0xffffff : 0x000000);
        d.bodyMat.emissiveIntensity = d.hitFlash * 1.6;
      }

      const distToPlayer = d.position.distanceTo(this.shipPos);
      const aggroRange = 185;
      d.orbitPhase += dt * 1.2;

      if (distToPlayer < aggroRange) {
        this._v1.copy(this.shipPos).sub(d.position);
        const dirToPlayer = this._v2.copy(this._v1).normalize();

        if (d.archetype === 'interceptor') {
          const desiredDist = 42;
          const speed = 56 * diff.droneSpeedScale;
          const push = distToPlayer > desiredDist ? 1 : -0.35;
          this._v3.copy(dirToPlayer).multiplyScalar(speed * push);
          d.velocity.lerp(this._v3, 1 - Math.exp(-3.5 * dt));
        } else if (d.archetype === 'orbiter') {
          const tangent = this._v3
            .set(-dirToPlayer.z, Math.sin(d.orbitPhase) * 0.35, dirToPlayer.x)
            .normalize();
          const radialCorrection = (distToPlayer - 68) * 0.7;
          tangent
            .multiplyScalar(54 * diff.droneSpeedScale)
            .addScaledVector(dirToPlayer, radialCorrection);
          d.velocity.lerp(tangent, 1 - Math.exp(-4.0 * dt));
        } else {
          const radial = distToPlayer < 85 ? -44 : distToPlayer > 125 ? 36 : 0;
          this._v3
            .copy(dirToPlayer)
            .multiplyScalar(radial)
            .add(
              new THREE.Vector3(
                Math.cos(d.orbitPhase) * 14,
                Math.sin(d.orbitPhase * 1.3) * 10,
                0
              )
            );
          d.velocity.lerp(this._v3, 1 - Math.exp(-3.2 * dt));
        }

        d.position.addScaledVector(d.velocity, dt);
        d.group.position.copy(d.position);
        d.group.lookAt(this.shipPos);

        if (activeAttackers < diff.maxConcurrentAttackers && distToPlayer < 160) {
          activeAttackers++;

          if (d.telegraphTimer > 0) {
            d.telegraphTimer -= dt;
            const pulse = 1.4 + Math.sin(this.totalElapsed * 35) * 0.45;
            d.eyeMat.color.setHex(0xffffff);
            d.group.scale.setScalar(1 + (0.45 - d.telegraphTimer) * 0.35);
            if (d.telegraphTimer <= 0) {
              d.group.scale.setScalar(1);
              d.eyeMat.color.setHex(0xe879f9);
              this.fireEnemyLaser(d, 210, 14);
              d.fireCooldown = 2.6 / diff.droneFireRateScale;
            } else {
              d.bodyMat.emissive.setHex(0xe879f9);
              d.bodyMat.emissiveIntensity = pulse * 0.7;
            }
          } else {
            d.fireCooldown -= dt;
            if (d.fireCooldown <= 0) {
              if (d.archetype === 'sniper') {
                d.telegraphTimer = 0.45;
                this.audio.playTelegraph();
              } else {
                const boltSpeed = d.archetype === 'interceptor' ? 165 : 150;
                const dmg = d.archetype === 'interceptor' ? 9 : 8;
                this.fireEnemyLaser(d, boltSpeed, dmg);
                d.fireCooldown =
                  (d.archetype === 'interceptor' ? 1.75 : 2.1) / diff.droneFireRateScale;
              }
            }
          }
        }
      } else {
        d.telegraphTimer = 0;
        const patrolX = d.homePos.x + Math.cos(d.orbitPhase * 0.45) * 18;
        const patrolY = d.homePos.y + Math.sin(d.orbitPhase * 0.65) * 8;
        const patrolZ = d.homePos.z + Math.sin(d.orbitPhase * 0.45) * 18;
        this._v1.set(patrolX, patrolY, patrolZ);
        d.position.lerp(this._v1, 1 - Math.exp(-1.5 * dt));
        d.group.position.copy(d.position);
        d.group.rotation.y += 0.8 * dt;
      }

      const colDist = d.radius + SHIP_COLLISION_RADIUS;
      if (this.shipPos.distanceToSquared(d.position) < colDist * colDist) {
        this.killDrone(d);
        this.applyPlayerDamage(16, 'Tabrakan dengan drone musuh!');
      }
    }
  }

  private killDrone(d: EnemyDrone): void {
    if (!d.alive) return;
    d.alive = false;
    d.dyingTimer = 0.32;
    d.velocity.set(
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35
    );
    this.score += DRONE_KILL_REWARD;
    this.enemiesDestroyed++;
    this.saveBestScore();
    this.hitstopTimer = 0.04;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
    this.spawnExplosion(d.position, 0xf97316, 10, 0.9);
    this.audio.playExplosion(false);
  }

  private updateLasers(dt: number): void {
    for (const bolt of this.lasers) {
      if (!bolt.active) continue;
      bolt.life -= dt;
      if (bolt.life <= 0) {
        bolt.active = false;
        bolt.mesh.visible = false;
        continue;
      }

      bolt.position.addScaledVector(bolt.velocity, dt);
      bolt.mesh.position.copy(bolt.position);

      if (bolt.isEnemy) {
        if (bolt.position.distanceToSquared(this.shipPos) < (SHIP_COLLISION_RADIUS + 1.8) ** 2) {
          bolt.active = false;
          bolt.mesh.visible = false;
          this.spawnExplosion(bolt.position, 0xf43f5e, 10, 0.75);
          this.applyPlayerDamage(bolt.damage);
        }
      } else {
        // Check hit against Dreadnought Boss first
        if (this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
          const bossHitR = BOSS_COLLISION_RADIUS + 2.8;
          if (bolt.position.distanceToSquared(this.bossPos) < bossHitR * bossHitR) {
            bolt.active = false;
            bolt.mesh.visible = false;
            this.bossHp = Math.max(0, this.bossHp - bolt.damage);
            this.bossHitFlash = 1.0;
            this.hitmarkerTimer = 0.22;
            this.hitmarkerKill = this.bossHp <= 0;
            this.spawnExplosion(bolt.position, this.upgradeStats.boltColorHex, 8, 0.8);

            if (this.bossHp <= 0) {
              this.bossDyingTimer = 1.85;
              this.bossChainAccum = 0.25;
              this.hitstopTimer = 0.06;
              this.audio.playBossExplosionChain();
              this.showBanner('INTI DREADNOUGHT KRITIS!', '#fbbf24', 2.0);
              this.emitHud(true);
            }
            continue;
          }
        }

        // Check hit against enemy drones
        let hit = false;
        for (const d of this.world.drones) {
          if (!d.alive) continue;
          const r = d.radius + 2.2;
          if (bolt.position.distanceToSquared(d.position) < r * r) {
            bolt.active = false;
            bolt.mesh.visible = false;
            d.hp -= bolt.damage;
            d.hitFlash = 1.0;
            this.hitmarkerTimer = 0.22;
            this.hitmarkerKill = d.hp <= 0;
            this.spawnExplosion(bolt.position, this.upgradeStats.boltColorHex, 8, 0.7);
            if (d.hp <= 0) {
              this.killDrone(d);
            }
            hit = true;
            break;
          }
        }
        if (hit) continue;

        // Check hit against destructible asteroids
        for (const a of this.world.asteroids) {
          if (!a.alive) continue;
          const r = a.radius + 1.9;
          if (bolt.position.distanceToSquared(a.position) < r * r) {
            bolt.active = false;
            bolt.mesh.visible = false;
            a.hp -= bolt.damage;
            a.hitFlash = 1.0;
            this.hitmarkerTimer = 0.22;
            this.hitmarkerKill = a.hp <= 0;
            this.spawnExplosion(bolt.position, 0xfbbf24, 7, 0.65);
            if (a.hp <= 0) {
              a.alive = false;
              a.mesh.visible = false;
              this.score += ASTEROID_KILL_REWARD;
              this.asteroidsDestroyed++;
              this.saveBestScore();
              this.spawnExplosion(a.position, 0xf97316, 18, 1.15);
              this.spawnCreditCrystals(a.position, 2, COIN_ASTEROID_VALUE);
              this.audio.playExplosion(false);
              this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.22);
              if (Math.random() < 0.55) {
                this.spawnOrb(a.position);
              }
            }
            break;
          }
        }
      }
    }
  }

  private emitMissileTrailParticle(pos: THREE.Vector3, missileVel: THREE.Vector3): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;

    p.active = true;
    p.position.copy(pos);
    p.velocity
      .copy(missileVel)
      .multiplyScalar(-0.08)
      .add(
        this._v3.set(
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9
        )
      );
    p.maxLife = 0.26 + Math.random() * 0.2;
    p.life = p.maxLife;
    p.size = 0.72 + Math.random() * 0.55;
    p.color.setHex(Math.random() < 0.45 ? 0xfbbf24 : 0xfb7185);
  }

  private detonateMissile(m: HomingMissile): void {
    m.active = false;
    m.group.visible = false;
    m.targetDrone = null;

    const pos = m.position;
    const splashSq = m.splashRadius * m.splashRadius;
    let landedHit = false;
    let landedKill = false;

    // 1. Area-of-effect blast vs Dreadnought Boss
    if (this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
      const dist = pos.distanceTo(this.bossPos);
      if (dist <= m.splashRadius + BOSS_COLLISION_RADIUS) {
        const direct = dist <= BOSS_COLLISION_RADIUS + 6;
        const dmg = direct ? m.damage : Math.round(m.damage * 0.65);
        this.bossHp = Math.max(0, this.bossHp - dmg);
        this.bossHitFlash = 1.0;
        landedHit = true;
        if (this.bossHp <= 0) {
          landedKill = true;
          this.bossDyingTimer = 1.85;
          this.bossChainAccum = 0.25;
          this.hitstopTimer = 0.06;
          this.audio.playBossExplosionChain();
          this.showBanner('INTI DREADNOUGHT KRITIS!', '#fbbf24', 2.0);
          this.emitHud(true);
        }
      }
    }

    // 2. Area-of-effect blast vs Enemy Drones
    for (const d of this.world.drones) {
      if (!d.alive) continue;
      const dSq = pos.distanceToSquared(d.position);
      const hitR = m.splashRadius + d.radius;
      if (dSq <= hitR * hitR) {
        const direct = dSq <= (d.radius + 7) * (d.radius + 7);
        const dmg = direct ? m.damage : Math.round(m.damage * 0.72);
        d.hp -= dmg;
        d.hitFlash = 1.0;
        landedHit = true;
        if (d.hp <= 0) {
          landedKill = true;
          this.killDrone(d);
        }
      }
    }

    // 3. Area-of-effect blast vs Destructible Asteroids
    for (const a of this.world.asteroids) {
      if (!a.alive) continue;
      const aSq = pos.distanceToSquared(a.position);
      if (aSq <= splashSq + a.radius * a.radius) {
        a.hp -= Math.round(m.damage * 0.75);
        a.hitFlash = 1.0;
        landedHit = true;
        if (a.hp <= 0) {
          landedKill = true;
          a.alive = false;
          a.mesh.visible = false;
          this.score += ASTEROID_KILL_REWARD;
          this.asteroidsDestroyed++;
          this.saveBestScore();
          this.spawnCreditCrystals(a.position, 2, COIN_ASTEROID_VALUE);
        }
      }
    }

    if (landedHit) {
      this.hitmarkerTimer = 0.28;
      this.hitmarkerKill = landedKill;
    }

    this.spawnExplosion(pos, 0xf97316, 28, 1.55, {
      shockwave: true,
      shockwaveScale: m.splashRadius * 0.95,
      flashScale: 8.5,
      debrisCount: 12,
      doubleRing: true,
    });
    this.audio.playMissileExplosion();
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.34);
    this.chromaPulse = Math.min(1, this.chromaPulse + 0.42);
  }

  private updateMissiles(dt: number): void {
    for (const m of this.missiles) {
      if (!m.active) continue;
      m.life -= dt;
      if (m.life <= 0) {
        this.detonateMissile(m);
        continue;
      }

      // Resolve live homing target position
      let hasTarget = false;
      if (m.targetType === 'boss' && this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
        this._v1.copy(this.bossPos);
        hasTarget = true;
      } else if (m.targetType === 'drone' && m.targetDrone && m.targetDrone.alive) {
        this._v1.copy(m.targetDrone.position);
        hasTarget = true;
      }

      if (hasTarget) {
        this._v2.copy(this._v1).sub(m.position);
        const dist = this._v2.length();
        const triggerDist = m.targetType === 'boss' ? BOSS_COLLISION_RADIUS + 4.5 : 6.2;
        if (dist <= triggerDist) {
          this.detonateMissile(m);
          continue;
        }
        const desiredDir = this._v2.normalize();
        const currentDir = this._v3.copy(m.velocity).normalize();
        const steerAlpha = 1 - Math.exp(-MISSILE_TURN_RATE * dt);
        currentDir.lerp(desiredDir, steerAlpha).normalize();
        m.velocity.copy(currentDir).multiplyScalar(MISSILE_SPEED);
      } else {
        // Accelerate cleanly along current flight vector
        const spd = Math.min(MISSILE_SPEED, m.velocity.length() + 120 * dt);
        m.velocity.normalize().multiplyScalar(spd);
      }

      m.position.addScaledVector(m.velocity, dt);
      m.group.position.copy(m.position);
      this._v2.copy(m.position).add(m.velocity);
      m.group.lookAt(this._v2);

      // Emit glowing exhaust trail sparks
      m.trailAccum += dt;
      if (m.trailAccum >= 0.024) {
        m.trailAccum = 0;
        this.emitMissileTrailParticle(m.position, m.velocity);
      }

      // Check proximity detonation against any hostile drone or asteroid along path
      let hit = false;
      for (const d of this.world.drones) {
        if (!d.alive) continue;
        const r = d.radius + 3.2;
        if (m.position.distanceToSquared(d.position) < r * r) {
          this.detonateMissile(m);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      for (const a of this.world.asteroids) {
        if (!a.alive) continue;
        const r = a.radius + 2.4;
        if (m.position.distanceToSquared(a.position) < r * r) {
          this.detonateMissile(m);
          break;
        }
      }
    }
  }

  private projectToScreen(worldPos: THREE.Vector3): { x: number; y: number; inFront: boolean } {
    this._invCamMat.copy(this.camera.matrixWorld).invert();
    this._camLocal.copy(worldPos).applyMatrix4(this._invCamMat);
    const inFront = this._camLocal.z < -1;
    this._proj.copy(worldPos).project(this.camera);
    return {
      x: (this._proj.x * 0.5 + 0.5) * this.viewportW,
      y: (-this._proj.y * 0.5 + 0.5) * this.viewportH,
      inFront,
    };
  }

  private updateTargetLockOn(dt: number): {
    lockOn: LockOnScreenData | null;
    leadIndicator: TargetLeadScreenData | null;
  } {
    const cx = this.viewportW * 0.5;
    const cy = this.viewportH * 0.5;
    const lockRadiusPx = Math.min(this.viewportW, this.viewportH) * 0.26;

    let bestType: 'none' | 'drone' | 'boss' = 'none';
    let bestDrone: EnemyDrone | null = null;
    let bestScreenX = cx;
    let bestScreenY = cy;
    let bestScore = Infinity;
    let bestDist = 0;
    let bestLabel = '';

    // 1. Evaluate Boss Dreadnought as lock candidate
    if (this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
      const dist = this.shipPos.distanceTo(this.bossPos);
      if (dist <= 470) {
        const scr = this.projectToScreen(this.bossPos);
        if (scr.inFront) {
          const offset = Math.hypot(scr.x - cx, scr.y - cy);
          if (offset <= lockRadiusPx * 1.25) {
            bestType = 'boss';
            bestScreenX = scr.x;
            bestScreenY = scr.y;
            bestScore = offset * 0.85;
            bestDist = Math.max(0, Math.round(dist - BOSS_COLLISION_RADIUS));
            bestLabel = 'DREADNOUGHT';
          }
        }
      }
    }

    // 2. Evaluate alive nearby Enemy Drones
    for (const d of this.world.drones) {
      if (!d.alive) continue;
      const dist = this.shipPos.distanceTo(d.position);
      if (dist > 340) continue;
      const scr = this.projectToScreen(d.position);
      if (!scr.inFront) continue;
      const offset = Math.hypot(scr.x - cx, scr.y - cy);
      if (offset <= lockRadiusPx && offset < bestScore) {
        bestType = 'drone';
        bestDrone = d;
        bestScreenX = scr.x;
        bestScreenY = scr.y;
        bestScore = offset;
        bestDist = Math.round(dist);
        bestLabel =
          d.archetype === 'sniper'
            ? 'DRONE SNIPER'
            : d.archetype === 'orbiter'
            ? 'DRONE ORBIT'
            : 'INTERCEPTOR';
      }
    }

    if (bestType === 'none') {
      this.lockedTargetType = 'none';
      this.lockedDrone = null;
      this.lockProgress = Math.max(0, this.lockProgress - dt * 2.5);
      this.lockFullPlayed = false;
      this.lockBeepTimer = 0;
      return { lockOn: null, leadIndicator: null };
    }

    const sameTarget =
      bestType === this.lockedTargetType &&
      (bestType === 'boss' || bestDrone === this.lockedDrone);

    if (!sameTarget) {
      this.lockedTargetType = bestType;
      this.lockedDrone = bestDrone;
      this.lockProgress = 0.08;
      this.lockFullPlayed = false;
      this.lockBeepTimer = 0.02;
    } else {
      this.lockProgress = Math.min(1, this.lockProgress + dt / MISSILE_LOCK_TIME);
    }

    const locked = this.lockProgress >= 1;
    if (locked && !this.lockFullPlayed) {
      this.lockFullPlayed = true;
      this.audio.playLockOnBeep(true);
    } else if (!locked) {
      this.lockBeepTimer -= dt;
      if (this.lockBeepTimer <= 0) {
        this.lockBeepTimer = 0.19;
        this.audio.playLockOnBeep(false);
      }
    }

    const targetWorldPos = bestType === 'boss' ? this.bossPos : bestDrone!.position;
    const targetWorldVel = bestType === 'boss' ? this.bossVel : bestDrone!.velocity;
    const leadWorld = computeTargetLeadPosition(
      this.shipPos,
      targetWorldPos,
      targetWorldVel,
      this.upgradeStats.boltSpeed
    );
    const leadScr = this.projectToScreen(this._v1.set(leadWorld.x, leadWorld.y, leadWorld.z));

    const leadIndicator: TargetLeadScreenData | null =
      leadScr.inFront &&
      leadScr.x >= 20 &&
      leadScr.x <= this.viewportW - 20 &&
      leadScr.y >= 20 &&
      leadScr.y <= this.viewportH - 20
        ? {
            visible: true,
            x: leadScr.x,
            y: leadScr.y,
            targetX: bestScreenX,
            targetY: bestScreenY,
          }
        : null;

    return {
      lockOn: {
        visible: true,
        x: bestScreenX,
        y: bestScreenY,
        progress: this.lockProgress,
        locked,
        label: bestLabel,
        distance: bestDist,
      },
      leadIndicator,
    };
  }

  private buildRadarFrame(): RadarFrameData {
    const planets: RadarFrameData['planets'] = [];
    for (let i = 0; i < PLANET_CONFIGS.length; i++) {
      const p = PLANET_CONFIGS[i];
      const proj = projectRadarBlip(this.shipPos, this.shipYaw, p.position, RADAR_RANGE, true);
      if (proj) {
        planets.push({
          rx: proj.rx,
          rz: proj.rz,
          alt: proj.alt,
          color: p.accentHex,
          scanned: this.scanStates[i]?.scanned ?? false,
          clamped: proj.clamped,
        });
      }
    }

    const drones: RadarFrameData['drones'] = [];
    for (const d of this.world.drones) {
      if (!d.alive) continue;
      const proj = projectRadarBlip(this.shipPos, this.shipYaw, d.position, RADAR_RANGE * 0.65, false);
      if (proj) {
        drones.push({ rx: proj.rx, rz: proj.rz, alt: proj.alt });
      }
    }

    let boss: RadarFrameData['boss'] = null;
    if (this.bossStatus === 'active' && this.bossDyingTimer <= 0) {
      const proj = projectRadarBlip(this.shipPos, this.shipYaw, this.bossPos, RADAR_RANGE, true);
      if (proj) {
        boss = { rx: proj.rx, rz: proj.rz, alt: proj.alt, phase: this.bossPhase };
      }
    }

    return {
      planets,
      drones,
      boss,
      sweepAngle: (this.totalElapsed * 1.9) % (Math.PI * 2),
    };
  }

  private updateOrbs(dt: number): void {
    const magnetRange = Math.max(48, this.upgradeStats.magnetRadius * 0.85);
    for (const orb of this.orbs) {
      if (!orb.active) continue;
      orb.life -= dt;
      if (orb.life <= 0) {
        orb.active = false;
        orb.group.visible = false;
        continue;
      }

      orb.group.rotation.y += 2.2 * dt;
      orb.group.rotation.x += 1.4 * dt;

      const dist = orb.position.distanceTo(this.shipPos);
      if (dist < magnetRange) {
        this._v1.copy(this.shipPos).sub(orb.position).normalize();
        orb.position.addScaledVector(this._v1, (1 - dist / magnetRange) * 110 * dt);
        orb.group.position.copy(orb.position);
      }

      if (dist < 9.5) {
        orb.active = false;
        orb.group.visible = false;
        this.score += ORB_PICKUP_REWARD;
        this.saveBestScore();

        if (orb.kind === 'hp') {
          this.hp = applyHealthDelta(this.hp, 25, this.upgradeStats.maxHp).hp;
          this.audio.playPickup(true);
          this.spawnExplosion(this.shipPos, 0x34d399, 10, 0.7);
          this.showBanner('+25 HP Perbaikan Lambung', '#34d399', 1.9);
        } else {
          this.boost = this.upgradeStats.maxBoost;
          this.audio.playPickup(false);
          this.spawnExplosion(this.shipPos, 0x38bdf8, 10, 0.7);
          this.showBanner('Energi Turbo Boost Penuh!', '#38bdf8', 1.9);
        }
        this.emitHud(true);
      }
    }
  }

  private updateCrystals(dt: number): void {
    const magnetR = this.upgradeStats.magnetRadius;
    for (const c of this.crystals) {
      if (!c.active) continue;
      c.life -= dt;
      if (c.life <= 0) {
        c.active = false;
        c.group.visible = false;
        continue;
      }

      // Gentle drift damping + sparkling spin
      c.velocity.multiplyScalar(1 - Math.min(1, 2.2 * dt));
      c.position.addScaledVector(c.velocity, dt);
      c.group.rotation.y += 3.4 * dt;
      c.group.rotation.z += 1.8 * dt;

      const dist = c.position.distanceTo(this.shipPos);
      if (dist < magnetR) {
        // Strong auto-magnet pull accelerating as crystal approaches ship
        this._v1.copy(this.shipPos).sub(c.position).normalize();
        const pull = 75 + (1 - dist / magnetR) * 195;
        c.position.addScaledVector(this._v1, pull * dt);
      }
      c.group.position.copy(c.position);

      if (dist < 9.5) {
        c.active = false;
        c.group.visible = false;
        this.coins += c.value;
        this.score += Math.round(c.value * 1.5);
        this.saveBestScore();
        this.audio.playCoinPickup();
        this.spawnExplosion(this.shipPos, 0xfde047, 6, 0.55);
        this.emitHud(true);
      }
    }
  }

  private updateParticles(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this._dummy.scale.setScalar(0);
        this._dummy.updateMatrix();
        this.particleInstanced.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      p.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(1 - 1.8 * dt);
      const ratio = p.life / p.maxLife;
      this._dummy.position.copy(p.position);
      this._dummy.rotation.set(p.life * 6, p.life * 4, 0);
      this._dummy.scale.setScalar(p.size * ratio);
      this._dummy.updateMatrix();
      this.particleInstanced.setMatrixAt(i, this._dummy.matrix);
      this.particleInstanced.setColorAt(i, p.color);
    }

    if (anyChanged) {
      this.particleInstanced.instanceMatrix.needsUpdate = true;
      if (this.particleInstanced.instanceColor) {
        this.particleInstanced.instanceColor.needsUpdate = true;
      }
    }

    // Update 3D Shockwave Rings
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.life -= dt;
      if (sw.life <= 0) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      const progress = 1 - sw.life / sw.maxLife;
      const easeOut = 1 - Math.pow(1 - progress, 2.6);
      const radius = THREE.MathUtils.lerp(sw.startRadius, sw.endRadius, easeOut);
      sw.mesh.scale.setScalar(radius);
      sw.mat.opacity = Math.pow(1 - progress, 1.55) * 0.85;
    }

    // Update rapid Plasma Core Flash Spheres
    for (const fl of this.plasmaFlashes) {
      if (!fl.active) continue;
      fl.life -= dt;
      if (fl.life <= 0) {
        fl.active = false;
        fl.mesh.visible = false;
        continue;
      }
      const progress = 1 - fl.life / fl.maxLife;
      const expand = progress < 0.25 ? progress / 0.25 : 1 - (progress - 0.25) / 0.75;
      fl.mesh.scale.setScalar(Math.max(0.05, fl.maxRadius * (0.25 + 0.75 * expand)));
      fl.mat.opacity = Math.pow(1 - progress, 1.4) * 0.95;
    }

    // Update tumbling 3D metal & rock Debris Shards
    let debrisChanged = false;
    for (let i = 0; i < this.debris.length; i++) {
      const sh = this.debris[i];
      if (!sh.active) continue;
      debrisChanged = true;
      sh.life -= dt;
      if (sh.life <= 0) {
        sh.active = false;
        this._dummy.scale.setScalar(0);
        this._dummy.updateMatrix();
        this.debrisInstanced.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      sh.position.addScaledVector(sh.velocity, dt);
      sh.velocity.multiplyScalar(1 - 0.85 * dt);
      sh.rotation.x += sh.rotVel.x * dt;
      sh.rotation.y += sh.rotVel.y * dt;
      sh.rotation.z += sh.rotVel.z * dt;

      const ratio = sh.life / sh.maxLife;
      const fadeScale = ratio < 0.35 ? ratio / 0.35 : 1.0;
      this._dummy.position.copy(sh.position);
      this._dummy.rotation.set(sh.rotation.x, sh.rotation.y, sh.rotation.z);
      this._dummy.scale.set(
        sh.scale.x * fadeScale,
        sh.scale.y * fadeScale,
        sh.scale.z * fadeScale
      );
      this._dummy.updateMatrix();
      this.debrisInstanced.setMatrixAt(i, this._dummy.matrix);
      this.debrisInstanced.setColorAt(i, sh.color);
    }

    if (debrisChanged) {
      this.debrisInstanced.instanceMatrix.needsUpdate = true;
      if (this.debrisInstanced.instanceColor) {
        this.debrisInstanced.instanceColor.needsUpdate = true;
      }
    }
  }

  private applyPlayerDamage(amount: number, reasonBanner?: string): void {
    if (this.phase !== 'playing' || this.defeatDelayTimer > 0) return;
    // Barrel Roll brief invulnerability frames (i-frames) dodge incoming shots cleanly
    if (this.dodgeState.invulnTimer > 0) {
      this.shipHitFlash = 0.35;
      return;
    }
    this.timeSinceLastHit = 0;
    const res = applyDamageWithShield(this.hp, this.shield, amount, this.upgradeStats.maxHp);
    this.hp = res.hp;
    this.shield = res.shield;
    this.shipHitFlash = 1.0;
    if (res.hullDamage > 0) {
      this.damageVignette = 1.0;
    }
    this.cameraTrauma = Math.min(1, this.cameraTrauma + (res.hullDamage > 0 ? 0.45 : 0.25));
    this.chromaPulse = Math.min(1, this.chromaPulse + (res.hullDamage > 0 ? 0.72 : 0.36));
    this.audio.playDamage();

    if (reasonBanner) {
      this.showBanner(reasonBanner, '#fb7185', 1.8);
    }

    if (res.isDead) {
      this.defeatDelayTimer = 0.55;
      this.chromaPulse = 1.0;
      this.spawnExplosion(this.shipPos, 0xf97316, 36, 1.8, {
        shockwave: true,
        shockwaveScale: 28,
        debrisCount: 22,
        doubleRing: true,
      });
      this.audio.playExplosion(true);
    }
    this.emitHud(true);
  }

  private getCurrentFlybyInfo(): {
    index: number;
    name: string;
    subtitle: string;
    accentHex: string;
  } {
    const rawT = Math.min(0.999, Math.max(0, this.flybyElapsed / (FLYBY_DURATION_SEC * 0.86)));
    const idx = Math.min(FLYBY_ORDER.length - 1, Math.floor(rawT * FLYBY_ORDER.length));
    const planet = PLANET_CONFIGS[FLYBY_ORDER[idx]];
    return {
      index: idx + 1,
      name: planet.name,
      subtitle: planet.subtitle,
      accentHex: planet.accentHex,
    };
  }

  private emitHud(
    force: boolean,
    activeScanPlanet?: PlanetConfig | null,
    activeScanProgress?: number
  ): void {
    if (!force && this.disposed) return;

    const nearest =
      findNearestPlanet(this.shipPos, this.scanStates, true) ??
      findNearestPlanet(this.shipPos, this.scanStates, false);

    const scannedCount = this.scanStates.filter((s) => s.scanned).length;
    const flybyInfo = this.getCurrentFlybyInfo();

    this.onHudUpdate({
      phase: this.phase,
      graphicsQuality: this.graphicsQuality,
      cameraMode: this.cameraMode,
      hp: Math.round(this.hp),
      maxHp: this.upgradeStats.maxHp,
      shield: Math.round(this.shield),
      maxShield: this.upgradeStats.maxShield,
      boost: Math.round(this.boost),
      maxBoost: this.upgradeStats.maxBoost,
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScore),
      coins: Math.round(this.coins),
      upgradeLevels: { ...this.upgradeLevels },
      upgradeStats: this.upgradeStats,
      scannedCount,
      totalPlanets: PLANET_CONFIGS.length,
      nearestPlanetName:
        this.bossStatus === 'active'
          ? 'Dreadnought'
          : nearest
          ? nearest.planet.name
          : 'Selesai',
      nearestPlanetDistance:
        this.bossStatus === 'active'
          ? Math.max(0, Math.round(this.shipPos.distanceTo(this.bossPos) - BOSS_COLLISION_RADIUS))
          : nearest
          ? Math.round(nearest.distance)
          : 0,
      nearestPlanetAccent:
        this.bossStatus === 'active'
          ? '#fb7185'
          : nearest
          ? nearest.planet.accentHex
          : '#34d399',
      scanningPlanetName: activeScanPlanet ? activeScanPlanet.name : null,
      scanningProgress: Math.round(activeScanProgress ?? 0),
      scanLockedMessage: this.scanLockedMessage,
      speedKmh: Math.round(this.currentSpeed * 12),
      isBoosting: this.isBoosting,
      muted: this.audio.isMuted(),
      elapsedSec: Math.round(this.elapsedRunSec),
      enemiesDestroyed: this.enemiesDestroyed,
      asteroidsDestroyed: this.asteroidsDestroyed,
      bannerText: this.bannerText,
      bannerAccent: this.bannerAccent,
      damageVignette: this.damageVignette,
      planetStatuses: PLANET_CONFIGS.map((p, idx) => ({
        id: p.id,
        name: p.name,
        scanned: this.scanStates[idx]?.scanned ?? false,
        accentHex: p.accentHex,
      })),
      bossStatus: this.bossStatus,
      bossHp: Math.round(this.bossHp),
      bossMaxHp: BOSS_MAX_HP,
      bossPhase: this.bossPhase,
      flybyPlanetIndex: flybyInfo.index,
      flybyPlanetName: flybyInfo.name,
      flybyPlanetSubtitle: flybyInfo.subtitle,
      flybyAccentHex: flybyInfo.accentHex,
      missileAmmo: this.missileAmmo,
      missileMaxAmmo: this.upgradeStats.missileMaxAmmo,
      missileReloadRatio: this.missileReloadProgress,
      dodgeCooldownRatio: Math.max(0, Math.min(1, this.dodgeState.cooldown / DODGE_COOLDOWN)),
      dodgeActive: this.dodgeState.active,
      lockedTargetName:
        this.lockedTargetType === 'boss'
          ? 'DREADNOUGHT'
          : this.lockedTargetType === 'drone' && this.lockedDrone?.alive
          ? 'DRONE MUSUH'
          : null,
      lockedTargetFull: this.lockProgress >= 1,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();

    this.renderer.domElement.removeEventListener('pointerdown', this.handleCanvasPointerDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleCanvasContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);

    this.composer?.dispose();
    this.composerTarget?.dispose();
    this.ship.dispose();
    this.world.dispose();
    for (const d of this._worldDisposables) {
      d.dispose();
    }
    this.audio.dispose();
    this.renderer.dispose();
  }
}
