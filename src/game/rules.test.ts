import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_MAX_HP,
  DODGE_COOLDOWN,
  DODGE_DURATION,
  MAX_UPGRADE_LEVEL,
  PLANET_CONFIGS,
  RADAR_RANGE,
  SHIELD_REGEN_DELAY,
  SHIP_COLLISION_RADIUS,
  applyDamageWithShield,
  applyHealthDelta,
  computeDynamicChroma,
  computeTargetLeadPosition,
  computeWaypointScreen,
  consumeMissileAmmo,
  createInitialDodgeState,
  createInitialScanStates,
  createInitialUpgradeLevels,
  distanceVec3,
  findNearestPlanet,
  getBossPhase,
  getDefaultGraphicsQuality,
  getGraphicsQualityConfig,
  getHullRepairInfo,
  getMoonPosition,
  getPlanetScanLockReason,
  getPlayerUpgradeStats,
  getUpgradeCost,
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

test('defines exactly 6 distinct procedural planets including Saturnia rings and Aether moon', () => {
  assert.equal(PLANET_CONFIGS.length, 6);
  const ids = PLANET_CONFIGS.map((p) => p.id);
  assert.deepEqual(ids, ['terra', 'pyros', 'cryos', 'saturnia', 'rubra', 'aether']);
  assert.equal(PLANET_CONFIGS.find((p) => p.id === 'saturnia')?.hasRings, true);
  assert.equal(PLANET_CONFIGS.find((p) => p.id === 'aether')?.hasMoon, true);
});

test('nearest unscanned planet returns Terra from origin and skips scanned planets', () => {
  const states = createInitialScanStates();
  const origin = { x: 0, y: 0, z: 0 };

  const first = findNearestPlanet(origin, states, true);
  assert.ok(first);
  assert.equal(first.planet.id, 'terra');

  states[0].scanned = true;
  const second = findNearestPlanet(origin, states, true);
  assert.ok(second);
  assert.notEqual(second.planet.id, 'terra');
});

test('planet scanning locks Aether until 5 planets scanned and Boss defeated, then completes victory at 6/6', () => {
  const states = createInitialScanStates();
  const terra = PLANET_CONFIGS[0];
  const nearTerra = {
    x: terra.position.x,
    y: terra.position.y,
    z: terra.position.z + terra.radius + 35,
  };

  const step1 = updatePlanetScan(nearTerra, states, 1.0, { bossStatus: 'dormant' });
  assert.equal(step1.activePlanet?.id, 'terra');
  assert.ok(step1.activeProgress > 25);
  assert.equal(step1.justCompleted, null);

  const step2 = updatePlanetScan(nearTerra, states, 3.0, { bossStatus: 'dormant' });
  assert.equal(step2.justCompleted?.id, 'terra');
  assert.equal(step2.scannedCount, 1);
  assert.equal(step2.allScanned, false);

  // Mark remaining 4 non-Aether planets scanned
  for (let i = 1; i < 5; i++) {
    states[i].scanned = true;
    states[i].progress = 100;
  }

  const aether = PLANET_CONFIGS[5];
  const nearAether = {
    x: aether.position.x,
    y: aether.position.y,
    z: aether.position.z + aether.radius + 30,
  };

  // While Boss is still active/dormant, Aether scan MUST remain locked
  assert.equal(getPlanetScanLockReason('aether', states, 'active'), 'boss_alive');
  const lockedAttempt = updatePlanetScan(nearAether, states, 3.0, { bossStatus: 'active' });
  assert.equal(lockedAttempt.lockedPlanet?.id, 'aether');
  assert.equal(lockedAttempt.lockReason, 'boss_alive');
  assert.equal(lockedAttempt.justCompleted, null);
  assert.equal(states[5].progress, 0);

  // Once Boss is defeated, Aether unlocks and triggers victory at 6/6
  const finalStep = updatePlanetScan(nearAether, states, 4.0, { bossStatus: 'defeated' });
  assert.equal(finalStep.justCompleted?.id, 'aether');
  assert.equal(finalStep.scannedCount, 6);
  assert.equal(finalStep.allScanned, true);
});

test('solid planet collision pushes ship outside radius, reflects velocity, and respects damage cooldown', () => {
  const terra = PLANET_CONFIGS[0];
  const insidePos = {
    x: terra.position.x,
    y: terra.position.y,
    z: terra.position.z + terra.radius - 4,
  };
  const inwardVel = { x: 0, y: 0, z: -70 };

  const res = resolveSphereCollision(
    insidePos,
    inwardVel,
    SHIP_COLLISION_RADIUS,
    terra.position,
    terra.radius,
    true
  );

  assert.equal(res.collided, true);
  assert.ok(res.damage > 0);
  const newDist = distanceVec3(res.position, terra.position);
  assert.ok(newDist >= terra.radius + SHIP_COLLISION_RADIUS);
  assert.ok(res.velocity.z > 0, 'inward Z velocity should bounce outward');

  const resNoDmg = resolveSphereCollision(
    insidePos,
    inwardVel,
    SHIP_COLLISION_RADIUS,
    terra.position,
    terra.radius,
    false
  );
  assert.equal(resNoDmg.collided, true);
  assert.equal(resNoDmg.damage, 0);
});

test('boost energy drains when active and regenerates smoothly up to upgraded maxBoost', () => {
  const drained = updateBoostEnergy(100, true, 1.0);
  assert.equal(drained.isBoosting, true);
  assert.ok(drained.boost < 100);

  const empty = updateBoostEnergy(0.5, true, 0.5);
  assert.equal(empty.isBoosting, false);

  const regen = updateBoostEnergy(120, false, 1.0, 165, 34);
  assert.equal(regen.isBoosting, false);
  assert.equal(regen.boost, 154);
});

test('health delta clamps between 0 and maxHp and signals death at 0', () => {
  const healed = applyHealthDelta(90, 25, 100);
  assert.equal(healed.hp, 100);
  assert.equal(healed.isDead, false);

  const lethal = applyHealthDelta(10, -25, 100);
  assert.equal(lethal.hp, 0);
  assert.equal(lethal.isDead, true);
});

test('upgrade pricing, purchasing, level cap, and derived stats scale across all 4 tracks', () => {
  let levels = createInitialUpgradeLevels();
  let coins = 1200;

  const lv1Stats = getPlayerUpgradeStats(levels);
  assert.equal(lv1Stats.boltCount, 2);
  assert.equal(lv1Stats.maxShield, 0);

  // Reject purchase if coins insufficient
  const poor = purchaseUpgrade(50, 'weapon', levels);
  assert.equal(poor.ok, false);
  assert.equal(poor.levels.weapon, 1);

  // Upgrade weapon all the way to Lv.4 Heavy Quad Plasma
  for (let expected = 2; expected <= MAX_UPGRADE_LEVEL; expected++) {
    const cost = getUpgradeCost('weapon', levels.weapon);
    assert.ok(cost !== null && cost > 0);
    const res = purchaseUpgrade(coins, 'weapon', levels);
    assert.equal(res.ok, true);
    assert.equal(res.levels.weapon, expected);
    assert.equal(res.coins, coins - cost);
    coins = res.coins;
    levels = res.levels;
  }

  // Max level returns null cost and rejects further purchase
  assert.equal(getUpgradeCost('weapon', MAX_UPGRADE_LEVEL), null);
  const maxed = purchaseUpgrade(9999, 'weapon', levels);
  assert.equal(maxed.ok, false);

  const lv4WeaponStats = getPlayerUpgradeStats({
    weapon: 4,
    engine: 4,
    hull: 4,
    scanner: 4,
  });
  assert.equal(lv4WeaponStats.boltCount, 4);
  assert.equal(lv4WeaponStats.weaponLabel, 'Heavy Quad Plasma');
  assert.ok(lv4WeaponStats.cruiseSpeed > lv1Stats.cruiseSpeed);
  assert.ok(lv4WeaponStats.maxBoost > lv1Stats.maxBoost);
  assert.ok(lv4WeaponStats.maxHp > lv1Stats.maxHp);
  assert.ok(lv4WeaponStats.maxShield >= 150);
  assert.ok(lv4WeaponStats.scanRate > lv1Stats.scanRate);
  assert.ok(lv4WeaponStats.magnetRadius > lv1Stats.magnetRadius);
});

test('hull repair, shield damage absorption, and delayed shield regeneration work accurately', () => {
  // Shield absorbs partial damage, overflow hits hull
  const hit1 = applyDamageWithShield(100, 30, 45, 135);
  assert.equal(hit1.shield, 0);
  assert.equal(hit1.shieldAbsorbed, 30);
  assert.equal(hit1.hullDamage, 15);
  assert.equal(hit1.hp, 85);
  assert.equal(hit1.isDead, false);

  // Shield does not regen before SHIELD_REGEN_DELAY, regens after
  assert.equal(updateShieldRegen(10, 50, SHIELD_REGEN_DELAY - 0.5, 14, 1.0), 10);
  assert.equal(updateShieldRegen(10, 50, SHIELD_REGEN_DELAY + 0.2, 14, 1.0), 24);

  // Hull repair calculates cost and restores full maxHp
  const repairInfo = getHullRepairInfo(85, 135);
  assert.equal(repairInfo.needed, true);
  assert.equal(repairInfo.missingHp, 50);
  assert.ok(repairInfo.cost > 0);

  const repaired = purchaseHullRepair(repairInfo.cost + 100, 85, 135);
  assert.equal(repaired.ok, true);
  assert.equal(repaired.hp, 135);
  assert.equal(repaired.coins, 100);
});

test('Boss encounter triggers near Aether after 5 planets scanned and shifts to Phase 2 at 50% HP', () => {
  const states = createInitialScanStates();
  const aether = PLANET_CONFIGS[5];
  const nearAether = {
    x: aether.position.x,
    y: aether.position.y,
    z: aether.position.z + 180,
  };

  // Does not trigger when fewer than 5 planets scanned
  assert.equal(shouldTriggerBossEncounter(nearAether, states, 'dormant'), false);

  for (let i = 0; i < 5; i++) {
    states[i].scanned = true;
    states[i].progress = 100;
  }

  assert.equal(shouldTriggerBossEncounter(nearAether, states, 'dormant'), true);
  assert.equal(shouldTriggerBossEncounter(nearAether, states, 'active'), false);
  assert.equal(shouldTriggerBossEncounter(nearAether, states, 'defeated'), false);

  assert.equal(getBossPhase(BOSS_MAX_HP, BOSS_MAX_HP), 1);
  assert.equal(getBossPhase(BOSS_MAX_HP * 0.55, BOSS_MAX_HP), 1);
  assert.equal(getBossPhase(BOSS_MAX_HP * 0.5, BOSS_MAX_HP), 2);
  assert.equal(getBossPhase(250, BOSS_MAX_HP), 2);
});

test('waypoint screen projection stays centered when in front and clamps to screen edge when offscreen or behind', () => {
  const terra = PLANET_CONFIGS[0];

  const onScreen = computeWaypointScreen(0, 0, false, 1440, 900, 180, terra);
  assert.equal(onScreen.isOffscreen, false);
  assert.equal(onScreen.x, 720);
  assert.equal(onScreen.y, 450);

  const offRight = computeWaypointScreen(2.2, 0.1, false, 1440, 900, 320, terra, 60);
  assert.equal(offRight.isOffscreen, true);
  assert.ok(Math.abs(offRight.x - (1440 - 60)) < 1);

  const behind = computeWaypointScreen(0.2, 0, true, 1440, 900, 400, terra, 60);
  assert.equal(behind.isOffscreen, true);
  assert.ok(behind.x <= 1440 - 60 && behind.x >= 60);
  assert.ok(behind.y <= 900 - 60 && behind.y >= 60);
});

test('Aether moon orbits dynamically over time', () => {
  const aether = PLANET_CONFIGS.find((p) => p.id === 'aether')!;
  const p0 = getMoonPosition(aether, 0)!;
  const p1 = getMoonPosition(aether, 3.0)!;
  assert.ok(distanceVec3(p0, p1) > 10);
});

test('graphics quality presets default to Ultra on desktop and Performance on mobile with distinct resolutions and MSAA', () => {
  assert.equal(getDefaultGraphicsQuality(false), 'ultra');
  assert.equal(getDefaultGraphicsQuality(true), 'performance');

  const ultra = getGraphicsQualityConfig('ultra');
  const perf = getGraphicsQualityConfig('performance');

  assert.equal(ultra.planetTexWidth, 2048);
  assert.equal(ultra.planetTexHeight, 1024);
  assert.equal(ultra.msaaSamples, 4);
  assert.ok(ultra.planetSegmentsW >= 64 && ultra.planetSegmentsH >= 64);

  assert.equal(perf.planetTexWidth, 1024);
  assert.equal(perf.planetTexHeight, 512);
  assert.equal(perf.msaaSamples, 0);
  assert.ok(perf.starCount < ultra.starCount);
  assert.ok(perf.particleScale < ultra.particleScale);
  assert.equal(ultra.enableOpticalPass, true);
  assert.equal(perf.enableOpticalPass, false);
});

test('camera mode toggles cleanly and adaptive BGM mode transitions across exploration, boss, victory, and gameover', () => {
  assert.equal(toggleCameraModeValue('third-person'), 'cockpit');
  assert.equal(toggleCameraModeValue('cockpit'), 'third-person');

  assert.equal(resolveMusicMode('title', 'dormant'), 'exploration');
  assert.equal(resolveMusicMode('flyby', 'dormant'), 'exploration');
  assert.equal(resolveMusicMode('playing', 'dormant'), 'exploration');
  assert.equal(resolveMusicMode('playing', 'active'), 'boss');
  assert.equal(resolveMusicMode('hangar', 'active'), 'boss');
  assert.equal(resolveMusicMode('playing', 'defeated'), 'exploration');
  assert.equal(resolveMusicMode('victory', 'defeated'), 'victory');
  assert.equal(resolveMusicMode('gameover', 'active'), 'off');

  const idleChroma = computeDynamicChroma(false, 0);
  const boostChroma = computeDynamicChroma(true, 0);
  const impactChroma = computeDynamicChroma(false, 1.0);
  assert.ok(idleChroma < 0.0005);
  assert.ok(boostChroma > idleChroma * 10);
  assert.ok(impactChroma > boostChroma);
});

test('homing missile magazine scales with weapon level and recharges cleanly', () => {
  const lv1 = getPlayerUpgradeStats({ weapon: 1, engine: 1, hull: 1, scanner: 1 });
  const lv4 = getPlayerUpgradeStats({ weapon: 4, engine: 1, hull: 1, scanner: 1 });

  assert.ok(lv4.missileMaxAmmo > lv1.missileMaxAmmo);
  assert.ok(lv4.missileReloadSec < lv1.missileReloadSec);
  assert.ok(lv4.missileDamage > lv1.missileDamage);
  assert.ok(lv4.missileSplashRadius > lv1.missileSplashRadius);

  const fired = consumeMissileAmmo(1);
  assert.equal(fired.ok, true);
  assert.equal(fired.ammo, 0);
  assert.equal(consumeMissileAmmo(0).ok, false);

  // Partial recharge then full recharge
  const mid = updateMissileAmmo(0, lv1.missileMaxAmmo, 0, lv1.missileReloadSec, lv1.missileReloadSec * 0.5);
  assert.equal(mid.ammo, 0);
  assert.ok(Math.abs(mid.reloadProgress - 0.5) < 1e-4);

  const filled = updateMissileAmmo(
    mid.ammo,
    lv1.missileMaxAmmo,
    mid.reloadProgress,
    lv1.missileReloadSec,
    lv1.missileReloadSec * 0.6
  );
  assert.equal(filled.ammo, 1);
  assert.ok(filled.reloadProgress < 0.2);

  // Never exceeds max capacity
  const capped = updateMissileAmmo(lv1.missileMaxAmmo, lv1.missileMaxAmmo, 0.4, lv1.missileReloadSec, 10);
  assert.equal(capped.ammo, lv1.missileMaxAmmo);
  assert.equal(capped.reloadProgress, 0);
});

test('barrel roll dodge triggers brief invulnerability frames and respects cooldown', () => {
  let dodge = createInitialDodgeState();
  assert.equal(dodge.active, false);
  assert.equal(dodge.cooldown, 0);

  const first = triggerDodgeRoll(dodge, -1);
  assert.equal(first.triggered, true);
  dodge = first.state;
  assert.equal(dodge.active, true);
  assert.equal(dodge.direction, -1);
  assert.ok(dodge.invulnTimer >= DODGE_DURATION);
  assert.equal(dodge.cooldown, DODGE_COOLDOWN);

  // Cannot re-trigger while active or on cooldown
  assert.equal(triggerDodgeRoll(dodge, 1).triggered, false);

  // After roll finishes, active becomes false but cooldown still blocks
  dodge = updateDodgeRoll(dodge, DODGE_DURATION + 0.1);
  assert.equal(dodge.active, false);
  assert.equal(dodge.invulnTimer, 0);
  assert.ok(dodge.cooldown > 0);
  assert.equal(triggerDodgeRoll(dodge, 1).triggered, false);

  // After full cooldown expires, can trigger again
  dodge = updateDodgeRoll(dodge, DODGE_COOLDOWN);
  assert.equal(dodge.cooldown, 0);
  assert.equal(triggerDodgeRoll(dodge, 1).triggered, true);
});

test('ballistic target lead solver predicts exact intercept ahead of moving target', () => {
  const shooter = { x: 0, y: 0, z: 0 };
  const target = { x: 0, y: 0, z: -200 };
  const vel = { x: 40, y: 0, z: 0 };
  const boltSpeed = 200;

  const lead = computeTargetLeadPosition(shooter, target, vel, boltSpeed);
  // Target is moving in +X so lead point must be strictly ahead in +X
  assert.ok(lead.x > 35 && lead.x < 50);
  assert.equal(lead.y, 0);
  assert.equal(lead.z, -200);

  // Verify intercept distance matches projectile travel distance: |lead - shooter| == boltSpeed * t
  const t = lead.x / vel.x;
  const distToLead = Math.hypot(lead.x - shooter.x, lead.y - shooter.y, lead.z - shooter.z);
  assert.ok(Math.abs(distToLead - boltSpeed * t) < 0.05);
});

test('3D holographic radar projection rotates by ship heading, encodes altitude, and clamps range', () => {
  const ship = { x: 0, y: 0, z: 0 };

  // Directly ahead (-Z) at yaw = 0 -> rz < 0 (top of radar), rx = 0
  const ahead = projectRadarBlip(ship, 0, { x: 0, y: 85, z: -RADAR_RANGE * 0.5 }, RADAR_RANGE, true);
  assert.ok(ahead !== null);
  assert.ok(Math.abs(ahead.rx) < 1e-5);
  assert.ok(Math.abs(ahead.rz - -0.5) < 1e-5);
  assert.ok(Math.abs(ahead.alt - 0.5) < 1e-5);
  assert.equal(ahead.clamped, false);

  // Turn ship 90 degrees left (yaw = +PI/2, forward becomes -X, right becomes -Z)
  const aheadAfterTurn = projectRadarBlip(
    ship,
    Math.PI / 2,
    { x: -RADAR_RANGE * 0.5, y: -85, z: 0 },
    RADAR_RANGE,
    true
  );
  assert.ok(aheadAfterTurn !== null);
  assert.ok(Math.abs(aheadAfterTurn.rx) < 1e-5);
  assert.ok(Math.abs(aheadAfterTurn.rz - -0.5) < 1e-5);
  assert.ok(aheadAfterTurn.alt < 0);

  // Far target clamps to radar perimeter when clampToEdge = true, returns null when false
  const farClamped = projectRadarBlip(ship, 0, { x: RADAR_RANGE * 3, y: 0, z: 0 }, RADAR_RANGE, true);
  assert.ok(farClamped !== null);
  assert.equal(farClamped.clamped, true);
  assert.ok(Math.abs(Math.hypot(farClamped.rx, farClamped.rz) - 1) < 1e-5);

  const farOmitted = projectRadarBlip(ship, 0, { x: RADAR_RANGE * 3, y: 0, z: 0 }, RADAR_RANGE, false);
  assert.equal(farOmitted, null);
});



