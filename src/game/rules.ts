export type GamePhase =
  | 'title'
  | 'flyby'
  | 'playing'
  | 'paused'
  | 'hangar'
  | 'victory'
  | 'gameover';

export type PlanetKind = 'terra' | 'pyros' | 'cryos' | 'saturnia' | 'rubra' | 'aether';

export type UpgradeTrackId = 'weapon' | 'engine' | 'hull' | 'scanner';

export type BossStatus = 'dormant' | 'active' | 'defeated';

export type GraphicsQuality = 'ultra' | 'performance';

export type CameraMode = 'third-person' | 'cockpit';

export type MusicMode = 'off' | 'exploration' | 'boss' | 'victory';

export interface GraphicsQualityConfig {
  quality: GraphicsQuality;
  label: string;
  planetTexWidth: number;
  planetTexHeight: number;
  hullTexSize: number;
  asteroidTexSize: number;
  planetSegmentsW: number;
  planetSegmentsH: number;
  asteroidDetail: number;
  msaaSamples: number;
  maxPixelRatio: number;
  starCount: number;
  dustCount: number;
  beltCount: number;
  ringDustCount: number;
  particleScale: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  enableOpticalPass: boolean;
}

export function getDefaultGraphicsQuality(isMobileDevice: boolean): GraphicsQuality {
  return isMobileDevice ? 'performance' : 'ultra';
}

export function getGraphicsQualityConfig(quality: GraphicsQuality): GraphicsQualityConfig {
  if (quality === 'performance') {
    return {
      quality: 'performance',
      label: 'Performa',
      planetTexWidth: 1024,
      planetTexHeight: 512,
      hullTexSize: 512,
      asteroidTexSize: 256,
      planetSegmentsW: 64,
      planetSegmentsH: 64,
      asteroidDetail: 2,
      msaaSamples: 0,
      maxPixelRatio: 1.25,
      starCount: 2200,
      dustCount: 180,
      beltCount: 95,
      ringDustCount: 180,
      particleScale: 0.65,
      bloomStrength: 0.34,
      bloomRadius: 0.36,
      bloomThreshold: 0.88,
      enableOpticalPass: false,
    };
  }

  return {
    quality: 'ultra',
    label: 'Ultra (HD)',
    planetTexWidth: 2048,
    planetTexHeight: 1024,
    hullTexSize: 1024,
    asteroidTexSize: 512,
    planetSegmentsW: 72,
    planetSegmentsH: 64,
    asteroidDetail: 3,
    msaaSamples: 4,
    maxPixelRatio: 2,
    starCount: 4800,
    dustCount: 420,
    beltCount: 180,
    ringDustCount: 460,
    particleScale: 1.0,
    bloomStrength: 0.42,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
    enableOpticalPass: true,
  };
}

export type UpgradeLevels = Record<UpgradeTrackId, number>;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlanetConfig {
  id: PlanetKind;
  name: string;
  subtitle: string;
  position: Vec3;
  radius: number;
  scanRange: number;
  atmosphereColor: string;
  accentHex: string;
  rotationSpeed: number;
  hasClouds?: boolean;
  hasRings?: boolean;
  hasMoon?: boolean;
  moonOrbitRadius?: number;
  moonRadius?: number;
  moonOrbitSpeed?: number;
  droneCount: number;
  asteroidCount: number;
}

export interface PlanetScanState {
  id: PlanetKind;
  progress: number; // 0 to 100
  scanned: boolean;
}

export interface PlanetCollisionResult {
  collided: boolean;
  position: Vec3;
  velocity: Vec3;
  damage: number;
  normal: Vec3;
}

export interface WaypointScreenData {
  x: number; // screen px
  y: number; // screen px
  angleRad: number; // arrow angle in radians (0 = right, -PI/2 = up)
  isOffscreen: boolean;
  distance: number;
  planetId: PlanetKind;
  planetName: string;
  accentHex: string;
}

export interface PlayerUpgradeStats {
  weaponLevel: number;
  weaponLabel: string;
  boltCount: number;
  fireInterval: number;
  boltDamage: number;
  boltRadius: number;
  boltLength: number;
  boltSpeed: number;
  boltColorHex: number;
  boltHdrRgb: [number, number, number];
  missileMaxAmmo: number;
  missileReloadSec: number;
  missileDamage: number;
  missileSplashRadius: number;
  cruiseSpeed: number;
  boostSpeed: number;
  maxBoost: number;
  boostRegenRate: number;
  maxHp: number;
  maxShield: number;
  shieldRegenRate: number;
  scanRate: number;
  magnetRadius: number;
}

export interface DodgeState {
  active: boolean;
  direction: -1 | 1;
  timer: number;
  cooldown: number;
  invulnTimer: number;
}

export interface RadarBlipProjection {
  rx: number; // normalized -1 (left) to +1 (right)
  rz: number; // normalized -1 (forward/up) to +1 (rear/down)
  alt: number; // normalized -1 (below) to +1 (above) for 3D stalk
  clamped: boolean;
}

export const SHIP_COLLISION_RADIUS = 3.2;
export const PLANET_SCAN_RATE = 30; // % per second (~3.33s full scan at Lv.1)
export const PLANET_SCAN_DECAY = 7; // % per second when flying away before completion
export const PLANET_SCAN_REWARD = 1000;
export const DRONE_KILL_REWARD = 250;
export const ASTEROID_KILL_REWARD = 100;
export const ORB_PICKUP_REWARD = 50;
export const BOSS_KILL_SCORE_REWARD = 5000;

// Coin / Credit economy constants
export const COIN_ASTEROID_VALUE = 25;
export const COIN_DRONE_VALUE = 35;
export const COIN_PLANET_SCAN_BONUS = 250;
export const COIN_BOSS_KILL_BONUS = 1500;

export const MAX_PLAYER_HP = 100;
export const MAX_BOOST = 100;
export const BOOST_DRAIN_RATE = 32; // per second
export const BOOST_REGEN_RATE = 18; // per second
export const PLANET_COLLISION_DAMAGE = 12;
export const SHIELD_REGEN_DELAY = 3.5; // seconds after last hit before shield recharges

export const MAX_UPGRADE_LEVEL = 4;

// Boss constants
export const BOSS_MAX_HP = 1800;
export const BOSS_TRIGGER_DISTANCE = 265;
export const BOSS_COLLISION_RADIUS = 17.5;

// Ace Pilot Combat & Navigation constants
export const MISSILE_LOCK_TIME = 0.62;
export const MISSILE_SPEED = 225;
export const MISSILE_TURN_RATE = 4.9;
export const DODGE_DURATION = 0.56;
export const DODGE_COOLDOWN = 2.5;
export const DODGE_INVULN_DURATION = 0.62;
export const RADAR_RANGE = 820;

export const UPGRADE_COSTS: Record<UpgradeTrackId, readonly [number, number, number]> = {
  weapon: [160, 340, 620],
  engine: [140, 300, 540],
  hull: [150, 320, 580],
  scanner: [130, 280, 500],
};

export const WEAPON_TIER_NAMES: readonly [string, string, string, string] = [
  'Dual Laser',
  'Rapid Fire',
  'Triple Laser',
  'Heavy Quad Plasma',
];

export const PLANET_CONFIGS: readonly PlanetConfig[] = [
  {
    id: 'terra',
    name: 'Terra',
    subtitle: 'Dunia Samudra & Awan',
    position: { x: 0, y: 8, z: -245 },
    radius: 26,
    scanRange: 105,
    atmosphereColor: '#38bdf8',
    accentHex: '#38bdf8',
    rotationSpeed: 0.14,
    hasClouds: true,
    droneCount: 2,
    asteroidCount: 7,
  },
  {
    id: 'pyros',
    name: 'Pyros',
    subtitle: 'Planet Lava Vulkanik',
    position: { x: 255, y: 34, z: -430 },
    radius: 29,
    scanRange: 112,
    atmosphereColor: '#f97316',
    accentHex: '#fb923c',
    rotationSpeed: 0.11,
    droneCount: 3,
    asteroidCount: 9,
  },
  {
    id: 'cryos',
    name: 'Cryos',
    subtitle: 'Planet Es Berkilau',
    position: { x: -265, y: -22, z: -380 },
    radius: 25,
    scanRange: 105,
    atmosphereColor: '#67e8f9',
    accentHex: '#22d3ee',
    rotationSpeed: 0.16,
    droneCount: 3,
    asteroidCount: 8,
  },
  {
    id: 'saturnia',
    name: 'Saturnia',
    subtitle: 'Raksasa Gas Bercincin Ganda',
    position: { x: 310, y: -38, z: -760 },
    radius: 34,
    scanRange: 128,
    atmosphereColor: '#fbbf24',
    accentHex: '#f59e0b',
    rotationSpeed: 0.09,
    hasRings: true,
    droneCount: 3,
    asteroidCount: 10,
  },
  {
    id: 'rubra',
    name: 'Rubra',
    subtitle: 'Planet Merah Berkawah',
    position: { x: -325, y: 44, z: -735 },
    radius: 27,
    scanRange: 110,
    atmosphereColor: '#f87171',
    accentHex: '#ef4444',
    rotationSpeed: 0.13,
    droneCount: 4,
    asteroidCount: 10,
  },
  {
    id: 'aether',
    name: 'Aether',
    subtitle: 'Planet Kristal Ungu & Bulan',
    position: { x: 18, y: 58, z: -1010 },
    radius: 30,
    scanRange: 118,
    atmosphereColor: '#c084fc',
    accentHex: '#a855f7',
    rotationSpeed: 0.12,
    hasMoon: true,
    moonOrbitRadius: 56,
    moonRadius: 6.8,
    moonOrbitSpeed: 0.42,
    droneCount: 4,
    asteroidCount: 11,
  },
];

export function createInitialScanStates(): PlanetScanState[] {
  return PLANET_CONFIGS.map((p) => ({
    id: p.id,
    progress: 0,
    scanned: false,
  }));
}

export function createInitialUpgradeLevels(): UpgradeLevels {
  return {
    weapon: 1,
    engine: 1,
    hull: 1,
    scanner: 1,
  };
}

export function getUpgradeCost(track: UpgradeTrackId, currentLevel: number): number | null {
  if (currentLevel < 1 || currentLevel >= MAX_UPGRADE_LEVEL) return null;
  return UPGRADE_COSTS[track][currentLevel - 1] ?? null;
}

export function purchaseUpgrade(
  coins: number,
  track: UpgradeTrackId,
  levels: UpgradeLevels
): { ok: boolean; coins: number; levels: UpgradeLevels; cost: number } {
  const current = levels[track];
  const cost = getUpgradeCost(track, current);
  if (cost === null || coins < cost) {
    return { ok: false, coins, levels: { ...levels }, cost: cost ?? 0 };
  }
  return {
    ok: true,
    coins: coins - cost,
    levels: {
      ...levels,
      [track]: current + 1,
    },
    cost,
  };
}

export function getPlayerUpgradeStats(levels: UpgradeLevels): PlayerUpgradeStats {
  const wIdx = Math.max(0, Math.min(3, levels.weapon - 1));
  const eIdx = Math.max(0, Math.min(3, levels.engine - 1));
  const hIdx = Math.max(0, Math.min(3, levels.hull - 1));
  const sIdx = Math.max(0, Math.min(3, levels.scanner - 1));

  const weaponSpecs = [
    {
      boltCount: 2,
      fireInterval: 0.17,
      boltDamage: 25,
      boltRadius: 0.16,
      boltLength: 4.8,
      boltSpeed: 320,
      boltColorHex: 0x38bdf8,
      boltHdrRgb: [0.32, 1.48, 2.05] as [number, number, number],
      missileMaxAmmo: 3,
      missileReloadSec: 5.5,
      missileDamage: 145,
      missileSplashRadius: 26,
    },
    {
      boltCount: 2,
      fireInterval: 0.105,
      boltDamage: 27,
      boltRadius: 0.18,
      boltLength: 5.2,
      boltSpeed: 350,
      boltColorHex: 0x22d3ee,
      boltHdrRgb: [0.22, 1.72, 2.1] as [number, number, number],
      missileMaxAmmo: 4,
      missileReloadSec: 4.3,
      missileDamage: 180,
      missileSplashRadius: 30,
    },
    {
      boltCount: 3,
      fireInterval: 0.12,
      boltDamage: 30,
      boltRadius: 0.21,
      boltLength: 5.6,
      boltSpeed: 375,
      boltColorHex: 0x34d399,
      boltHdrRgb: [0.28, 1.92, 1.22] as [number, number, number],
      missileMaxAmmo: 5,
      missileReloadSec: 3.3,
      missileDamage: 220,
      missileSplashRadius: 34,
    },
    {
      boltCount: 4,
      fireInterval: 0.13,
      boltDamage: 34,
      boltRadius: 0.27,
      boltLength: 6.4,
      boltSpeed: 400,
      boltColorHex: 0xf59e0b,
      boltHdrRgb: [2.1, 1.32, 0.22] as [number, number, number],
      missileMaxAmmo: 6,
      missileReloadSec: 2.4,
      missileDamage: 270,
      missileSplashRadius: 40,
    },
  ];

  const cruiseSpeeds = [68, 78, 88, 98];
  const boostSpeeds = [142, 162, 184, 208];
  const maxBoosts = [100, 130, 165, 200];
  const boostRegens = [18, 25, 34, 44];

  const maxHps = [100, 135, 175, 220];
  const maxShields = [0, 50, 95, 150];
  const shieldRegens = [0, 14, 22, 32];

  const scanRates = [30, 44, 62, 88];
  const magnetRadii = [52, 82, 118, 160];

  const w = weaponSpecs[wIdx];

  return {
    weaponLevel: wIdx + 1,
    weaponLabel: WEAPON_TIER_NAMES[wIdx],
    ...w,
    cruiseSpeed: cruiseSpeeds[eIdx],
    boostSpeed: boostSpeeds[eIdx],
    maxBoost: maxBoosts[eIdx],
    boostRegenRate: boostRegens[eIdx],
    maxHp: maxHps[hIdx],
    maxShield: maxShields[hIdx],
    shieldRegenRate: shieldRegens[hIdx],
    scanRate: scanRates[sIdx],
    magnetRadius: magnetRadii[sIdx],
  };
}

export function getHullRepairInfo(
  currentHp: number,
  maxHp: number
): { needed: boolean; missingHp: number; cost: number } {
  const missingHp = Math.max(0, Math.ceil(maxHp - currentHp));
  if (missingHp <= 0) {
    return { needed: false, missingHp: 0, cost: 0 };
  }
  const cost = Math.max(20, Math.ceil(missingHp * 1.1));
  return { needed: true, missingHp, cost };
}

export function purchaseHullRepair(
  coins: number,
  currentHp: number,
  maxHp: number
): { ok: boolean; coins: number; hp: number; cost: number } {
  const info = getHullRepairInfo(currentHp, maxHp);
  if (!info.needed || coins < info.cost) {
    return { ok: false, coins, hp: currentHp, cost: info.cost };
  }
  return {
    ok: true,
    coins: coins - info.cost,
    hp: maxHp,
    cost: info.cost,
  };
}

export function getBossPhase(bossHp: number, bossMaxHp = BOSS_MAX_HP): 1 | 2 {
  if (bossMaxHp <= 0) return 2;
  return bossHp / bossMaxHp <= 0.5 ? 2 : 1;
}

export function countScannedNonAetherPlanets(scanStates: readonly PlanetScanState[]): number {
  let count = 0;
  for (const s of scanStates) {
    if (s.id !== 'aether' && s.scanned) count++;
  }
  return count;
}

/**
 * Planet ke-6 (Aether) hanya dapat dipindai setelah 5 planet lain terpindai
 * DAN Boss Kapal Induk Dreadnought telah dikalahkan.
 */
export function getPlanetScanLockReason(
  planetId: PlanetKind,
  scanStates: readonly PlanetScanState[],
  bossStatus: BossStatus
): 'none' | 'need_other_planets' | 'boss_alive' {
  if (planetId !== 'aether') return 'none';
  const othersScanned = countScannedNonAetherPlanets(scanStates);
  if (othersScanned < 5) return 'need_other_planets';
  if (bossStatus !== 'defeated') return 'boss_alive';
  return 'none';
}

export function shouldTriggerBossEncounter(
  shipPos: Vec3,
  scanStates: readonly PlanetScanState[],
  bossStatus: BossStatus
): boolean {
  if (bossStatus !== 'dormant') return false;
  if (countScannedNonAetherPlanets(scanStates) < 5) return false;
  const aether = PLANET_CONFIGS.find((p) => p.id === 'aether');
  if (!aether) return false;
  return distanceVec3(shipPos, aether.position) <= BOSS_TRIGGER_DISTANCE;
}

export function distanceVec3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function findNearestPlanet(
  shipPos: Vec3,
  scanStates: readonly PlanetScanState[],
  onlyUnscanned: boolean
): { planet: PlanetConfig; distance: number; state: PlanetScanState } | null {
  const nonAetherScanned = countScannedNonAetherPlanets(scanStates);
  let best: { planet: PlanetConfig; distance: number; state: PlanetScanState } | null = null;

  for (let i = 0; i < PLANET_CONFIGS.length; i++) {
    const planet = PLANET_CONFIGS[i];
    const state = scanStates[i];
    if (!state) continue;
    if (onlyUnscanned && state.scanned) continue;
    // Guide player to the 5 other planets before Aether while any of the 5 remain unscanned
    if (onlyUnscanned && planet.id === 'aether' && nonAetherScanned < 5) continue;
    const distToCenter = distanceVec3(shipPos, planet.position);
    const surfaceDist = Math.max(0, distToCenter - planet.radius);
    if (!best || surfaceDist < best.distance) {
      best = { planet, distance: surfaceDist, state };
    }
  }
  return best;
}

export function updatePlanetScan(
  shipPos: Vec3,
  scanStates: PlanetScanState[],
  dt: number,
  options?: {
    scanRate?: number;
    bossStatus?: BossStatus;
  }
): {
  activePlanet: PlanetConfig | null;
  activeProgress: number;
  justCompleted: PlanetConfig | null;
  lockedPlanet: PlanetConfig | null;
  lockReason: 'none' | 'need_other_planets' | 'boss_alive';
  scannedCount: number;
  allScanned: boolean;
} {
  const scanRate = options?.scanRate ?? PLANET_SCAN_RATE;
  const bossStatus: BossStatus = options?.bossStatus ?? 'defeated';

  let activePlanet: PlanetConfig | null = null;
  let activeProgress = 0;
  let justCompleted: PlanetConfig | null = null;
  let lockedPlanet: PlanetConfig | null = null;
  let lockReason: 'none' | 'need_other_planets' | 'boss_alive' = 'none';
  let scannedCount = 0;

  for (let i = 0; i < PLANET_CONFIGS.length; i++) {
    const planet = PLANET_CONFIGS[i];
    const state = scanStates[i];
    if (state.scanned) {
      scannedCount++;
      continue;
    }

    const dist = distanceVec3(shipPos, planet.position);
    if (dist <= planet.scanRange) {
      const lock = getPlanetScanLockReason(planet.id, scanStates, bossStatus);
      if (lock !== 'none') {
        lockedPlanet = planet;
        lockReason = lock;
        continue;
      }

      state.progress = Math.min(100, state.progress + scanRate * dt);
      if (state.progress >= 100) {
        state.progress = 100;
        state.scanned = true;
        scannedCount++;
        justCompleted = planet;
      } else {
        activePlanet = planet;
        activeProgress = state.progress;
      }
    } else if (state.progress > 0) {
      state.progress = Math.max(0, state.progress - PLANET_SCAN_DECAY * dt);
    }
  }

  return {
    activePlanet,
    activeProgress,
    justCompleted,
    lockedPlanet,
    lockReason,
    scannedCount,
    allScanned: scannedCount >= PLANET_CONFIGS.length,
  };
}

/**
 * Resolves solid sphere collision between the ship and a celestial body (planet or moon).
 * Guarantees the ship never tunnels through or stays inside the sphere.
 */
export function resolveSphereCollision(
  shipPos: Vec3,
  shipVel: Vec3,
  shipRadius: number,
  bodyCenter: Vec3,
  bodyRadius: number,
  canDealDamage: boolean
): PlanetCollisionResult {
  const dx = shipPos.x - bodyCenter.x;
  const dy = shipPos.y - bodyCenter.y;
  const dz = shipPos.z - bodyCenter.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  const minDist = bodyRadius + shipRadius;

  if (distSq >= minDist * minDist) {
    return {
      collided: false,
      position: { ...shipPos },
      velocity: { ...shipVel },
      damage: 0,
      normal: { x: 0, y: 1, z: 0 },
    };
  }

  const dist = Math.sqrt(distSq);
  const nx = dist > 1e-4 ? dx / dist : 0;
  const ny = dist > 1e-4 ? dy / dist : 1;
  const nz = dist > 1e-4 ? dz / dist : 0;

  // Push ship cleanly outside surface with a slight safety buffer
  const pushDist = minDist + 0.6;
  const nextPos: Vec3 = {
    x: bodyCenter.x + nx * pushDist,
    y: bodyCenter.y + ny * pushDist,
    z: bodyCenter.z + nz * pushDist,
  };

  // Reflect inward velocity component smoothly and add outward bounce impulse
  const vn = shipVel.x * nx + shipVel.y * ny + shipVel.z * nz;
  const bounceStrength = Math.max(26, Math.abs(vn) * 0.75 + 18);
  const nextVel: Vec3 = {
    x: vn < 0 ? shipVel.x - (1 + 0.65) * vn * nx + nx * 14 : shipVel.x + nx * bounceStrength,
    y: vn < 0 ? shipVel.y - (1 + 0.65) * vn * ny + ny * 14 : shipVel.y + ny * bounceStrength,
    z: vn < 0 ? shipVel.z - (1 + 0.65) * vn * nz + nz * 14 : shipVel.z + nz * bounceStrength,
  };

  return {
    collided: true,
    position: nextPos,
    velocity: nextVel,
    damage: canDealDamage ? PLANET_COLLISION_DAMAGE : 0,
    normal: { x: nx, y: ny, z: nz },
  };
}

export function updateBoostEnergy(
  currentBoost: number,
  isBoostRequested: boolean,
  dt: number,
  maxBoost = MAX_BOOST,
  regenRate = BOOST_REGEN_RATE
): { boost: number; isBoosting: boolean } {
  if (isBoostRequested && currentBoost > 1.5) {
    const next = Math.max(0, currentBoost - BOOST_DRAIN_RATE * dt);
    return { boost: next, isBoosting: next > 0 };
  }
  const next = Math.min(maxBoost, currentBoost + regenRate * dt);
  return { boost: next, isBoosting: false };
}

export function applyHealthDelta(
  currentHp: number,
  delta: number,
  maxHp = MAX_PLAYER_HP
): { hp: number; isDead: boolean } {
  const hp = Math.max(0, Math.min(maxHp, currentHp + delta));
  return { hp, isDead: hp <= 0 };
}

export function applyDamageWithShield(
  currentHp: number,
  currentShield: number,
  damage: number,
  maxHp = MAX_PLAYER_HP
): {
  hp: number;
  shield: number;
  shieldAbsorbed: number;
  hullDamage: number;
  isDead: boolean;
} {
  const dmg = Math.max(0, damage);
  const shieldAbsorbed = Math.min(currentShield, dmg);
  const nextShield = Math.max(0, currentShield - shieldAbsorbed);
  const hullDamage = dmg - shieldAbsorbed;
  const hpRes = applyHealthDelta(currentHp, -hullDamage, maxHp);
  return {
    hp: hpRes.hp,
    shield: nextShield,
    shieldAbsorbed,
    hullDamage,
    isDead: hpRes.isDead,
  };
}

export function updateShieldRegen(
  currentShield: number,
  maxShield: number,
  timeSinceLastHit: number,
  regenRate: number,
  dt: number
): number {
  if (maxShield <= 0 || currentShield >= maxShield) return Math.min(currentShield, maxShield);
  if (timeSinceLastHit < SHIELD_REGEN_DELAY) return currentShield;
  return Math.min(maxShield, currentShield + regenRate * dt);
}

/**
 * Computes screen-space waypoint coordinates & directional arrow angle from NDC coordinates.
 * Works accurately even when target is directly behind the camera (ndcZ > 1 or behindCamera = true).
 */
export function computeWaypointScreen(
  ndcX: number,
  ndcY: number,
  behindCamera: boolean,
  viewportWidth: number,
  viewportHeight: number,
  distance: number,
  planet: PlanetConfig,
  marginPx = 56
): WaypointScreenData {
  let sx = (ndcX * 0.5 + 0.5) * viewportWidth;
  let sy = (-ndcY * 0.5 + 0.5) * viewportHeight;

  const cx = viewportWidth * 0.5;
  const cy = viewportHeight * 0.5;

  if (behindCamera) {
    // Mirror through center so indicator points back toward the off-screen target
    sx = viewportWidth - sx;
    sy = viewportHeight - sy;
  }

  const maxRx = Math.max(40, cx - marginPx);
  const maxRy = Math.max(40, cy - marginPx);

  const inBounds =
    !behindCamera &&
    sx >= marginPx &&
    sx <= viewportWidth - marginPx &&
    sy >= marginPx &&
    sy <= viewportHeight - marginPx;

  if (inBounds) {
    return {
      x: sx,
      y: sy,
      angleRad: -Math.PI / 2,
      isOffscreen: false,
      distance: Math.round(distance),
      planetId: planet.id,
      planetName: planet.name,
      accentHex: planet.accentHex,
    };
  }

  let dx = sx - cx;
  let dy = sy - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) {
    dx = 0;
    dy = 1;
  } else {
    dx /= len;
    dy /= len;
  }

  // Clamp onto an inset box/ellipse margin for smooth screen-edge sliding
  const scaleX = Math.abs(dx) > 1e-5 ? maxRx / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 1e-5 ? maxRy / Math.abs(dy) : Infinity;
  const t = Math.min(scaleX, scaleY);

  const clampedX = cx + dx * t;
  const clampedY = cy + dy * t;
  const angleRad = Math.atan2(dy, dx);

  return {
    x: clampedX,
    y: clampedY,
    angleRad,
    isOffscreen: true,
    distance: Math.round(distance),
    planetId: planet.id,
    planetName: planet.name,
    accentHex: planet.accentHex,
  };
}

export function getDifficultyMultiplier(scannedCount: number): {
  droneSpeedScale: number;
  droneFireRateScale: number;
  maxConcurrentAttackers: number;
} {
  return {
    droneSpeedScale: 1 + scannedCount * 0.08,
    droneFireRateScale: 1 + scannedCount * 0.1,
    maxConcurrentAttackers: Math.min(4, 2 + Math.floor(scannedCount / 2)),
  };
}

export function getMoonPosition(planet: PlanetConfig, elapsedSec: number): Vec3 | null {
  if (!planet.hasMoon || !planet.moonOrbitRadius || !planet.moonOrbitSpeed) return null;
  const angle = elapsedSec * planet.moonOrbitSpeed;
  return {
    x: planet.position.x + Math.cos(angle) * planet.moonOrbitRadius,
    y: planet.position.y + Math.sin(angle * 0.7) * 10,
    z: planet.position.z + Math.sin(angle) * planet.moonOrbitRadius,
  };
}

export function toggleCameraModeValue(current: CameraMode): CameraMode {
  return current === 'third-person' ? 'cockpit' : 'third-person';
}

export function resolveMusicMode(phase: GamePhase, bossStatus: BossStatus): MusicMode {
  if (phase === 'gameover') return 'off';
  if (phase === 'victory') return 'victory';
  if (phase === 'title') return 'exploration';
  if (bossStatus === 'active' && (phase === 'playing' || phase === 'paused' || phase === 'hangar')) {
    return 'boss';
  }
  return 'exploration';
}

export function computeDynamicChroma(isBoosting: boolean, chromaPulse: number): number {
  const clampedPulse = Math.max(0, Math.min(1.5, chromaPulse));
  const boostContrib = isBoosting ? 0.0042 : 0.0002;
  return Math.min(0.015, boostContrib + clampedPulse * 0.0085);
}

/**
 * Auto-recharges Homing Missile magazine cleanly over time, accelerated by Weapon upgrade level.
 */
export function updateMissileAmmo(
  ammo: number,
  maxAmmo: number,
  reloadProgress: number,
  reloadSec: number,
  dt: number
): { ammo: number; reloadProgress: number } {
  if (ammo >= maxAmmo) {
    return { ammo: maxAmmo, reloadProgress: 0 };
  }
  const safeReload = Math.max(0.5, reloadSec);
  let nextAmmo = ammo;
  let nextProg = reloadProgress + dt / safeReload;
  while (nextProg >= 1 && nextAmmo < maxAmmo) {
    nextProg -= 1;
    nextAmmo++;
  }
  if (nextAmmo >= maxAmmo) {
    nextProg = 0;
  }
  return { ammo: nextAmmo, reloadProgress: Math.max(0, Math.min(1, nextProg)) };
}

export function consumeMissileAmmo(ammo: number): { ok: boolean; ammo: number } {
  if (ammo <= 0) return { ok: false, ammo: 0 };
  return { ok: true, ammo: ammo - 1 };
}

export function createInitialDodgeState(): DodgeState {
  return {
    active: false,
    direction: 1,
    timer: 0,
    cooldown: 0,
    invulnTimer: 0,
  };
}

export function triggerDodgeRoll(
  state: DodgeState,
  direction: -1 | 1
): { triggered: boolean; state: DodgeState } {
  if (state.active || state.cooldown > 0) {
    return { triggered: false, state: { ...state } };
  }
  return {
    triggered: true,
    state: {
      active: true,
      direction,
      timer: DODGE_DURATION,
      cooldown: DODGE_COOLDOWN,
      invulnTimer: DODGE_INVULN_DURATION,
    },
  };
}

export function updateDodgeRoll(state: DodgeState, dt: number): DodgeState {
  const nextTimer = Math.max(0, state.timer - dt);
  const nextCooldown = Math.max(0, state.cooldown - dt);
  const nextInvuln = Math.max(0, state.invulnTimer - dt);
  return {
    active: nextTimer > 0,
    direction: state.direction,
    timer: nextTimer,
    cooldown: nextCooldown,
    invulnTimer: nextInvuln,
  };
}

/**
 * Exact first-order ballistic intercept solver for the HUD Target Lead Indicator.
 * Finds the smallest positive time t where |relPos + targetVel * t| = projectileSpeed * t.
 */
export function computeTargetLeadPosition(
  shooterPos: Vec3,
  targetPos: Vec3,
  targetVel: Vec3,
  projectileSpeed: number
): Vec3 {
  const rx = targetPos.x - shooterPos.x;
  const ry = targetPos.y - shooterPos.y;
  const rz = targetPos.z - shooterPos.z;

  const s = Math.max(1, projectileSpeed);
  const a = targetVel.x * targetVel.x + targetVel.y * targetVel.y + targetVel.z * targetVel.z - s * s;
  const b = 2 * (rx * targetVel.x + ry * targetVel.y + rz * targetVel.z);
  const c = rx * rx + ry * ry + rz * rz;

  let t = Math.sqrt(c) / s;
  if (Math.abs(a) < 1e-4) {
    if (Math.abs(b) > 1e-4) {
      const linearT = -c / b;
      if (linearT > 0) t = linearT;
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtD = Math.sqrt(disc);
      const t1 = (-b - sqrtD) / (2 * a);
      const t2 = (-b + sqrtD) / (2 * a);
      if (t1 > 0 && t2 > 0) t = Math.min(t1, t2);
      else if (t1 > 0) t = t1;
      else if (t2 > 0) t = t2;
    }
  }

  const clampedT = Math.max(0, Math.min(2.2, t));
  return {
    x: targetPos.x + targetVel.x * clampedT,
    y: targetPos.y + targetVel.y * clampedT,
    z: targetPos.z + targetVel.z * clampedT,
  };
}

/**
 * Projects a 3D world target onto the ship-centric Holographic 3D Radar disc.
 * Forward (-Z at shipYaw=0) always maps to rz = -1 (top of radar), right maps to rx = +1.
 */
export function projectRadarBlip(
  shipPos: Vec3,
  shipYaw: number,
  targetPos: Vec3,
  radarRange = RADAR_RANGE,
  clampToEdge = true
): RadarBlipProjection | null {
  const dx = targetPos.x - shipPos.x;
  const dy = targetPos.y - shipPos.y;
  const dz = targetPos.z - shipPos.z;

  const cosY = Math.cos(shipYaw);
  const sinY = Math.sin(shipYaw);

  // Rotate into ship heading frame (forward = (-sinY, 0, -cosY), right = (cosY, 0, -sinY))
  const relRight = dx * cosY - dz * sinY;
  const relForward = -dx * sinY - dz * cosY;

  let nx = relRight / radarRange;
  let nz = -relForward / radarRange; // -1 = up (ahead), +1 = down (behind)
  const planarDist = Math.hypot(nx, nz);

  let clamped = false;
  if (planarDist > 1) {
    if (!clampToEdge) return null;
    nx /= planarDist;
    nz /= planarDist;
    clamped = true;
  }

  const alt = Math.max(-1, Math.min(1, dy / 170));
  return { rx: nx, rz: nz, alt, clamped };
}


