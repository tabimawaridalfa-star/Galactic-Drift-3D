import * as THREE from 'three';
import {
  generateDreadnoughtWindowTexture,
  generateHullPlatingTextures,
  type PbrTextureSet,
} from './textures';
import { createVolumetricThrusterMaterial } from './shaders';

export interface DreadnoughtBossRig {
  group: THREE.Group;
  turretOffsets: THREE.Vector3[];
  hangarBayOffset: THREE.Vector3;
  updateVisuals: (
    dt: number,
    elapsed: number,
    phase: 1 | 2,
    hitFlash: number,
    dyingRatio: number
  ) => void;
  applyQuality: (maxAnisotropy: number, hullTexSize: number) => void;
  dispose: () => void;
}

function scaleUVs(geo: THREE.BufferGeometry, repeatU: number, repeatV: number): void {
  const uv = geo.attributes.uv;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repeatU, uv.getY(i) * repeatV);
  }
  uv.needsUpdate = true;
}

/**
 * Builds a colossal procedural 3D Dreadnought Carrier Boss (~6x player scale)
 * with angular beveled stealth ExtrudeGeometry armor plates, hundreds of illuminated
 * micro deck windows & corridor strips, Sci-Fi Hull Plating PBR maps, armored twin
 * flight prongs, stepped command citadel, exposed rotating plasma reactor core,
 * 6 heavy plasma turrets, and quad GLSL Volumetric Plasma Exhaust engines.
 */
export function createBossDreadnought(
  maxAnisotropy: number,
  hullTexSize = 1024
): DreadnoughtBossRig {
  const group = new THREE.Group();
  const hullGroup = new THREE.Group();
  // Three.js Object3D.lookAt() aims +Z toward target; rotate model 180deg so bow & reactor face player
  hullGroup.rotation.y = Math.PI;
  group.add(hullGroup);
  const disposables: Array<{ dispose: () => void }> = [];

  let hullTex: PbrTextureSet = generateHullPlatingTextures('dreadnought', maxAnisotropy, hullTexSize);
  const windowTex = generateDreadnoughtWindowTexture(maxAnisotropy);
  disposables.push(windowTex);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xd0d9e8,
    map: hullTex.map,
    normalMap: hullTex.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: hullTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.84,
    envMapIntensity: 1.45,
  });
  const armorPlateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hullTex.map,
    normalMap: hullTex.normalMap,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: hullTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.88,
    envMapIntensity: 1.5,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x202a40,
    roughness: 0.48,
    metalness: 0.82,
    envMapIntensity: 1.3,
  });
  const bridgeGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x140e1a,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.65,
    roughness: 0.05,
    metalness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.45,
    roughness: 0.24,
    metalness: 0.72,
  });
  // Emissive micro deck window strips conveying colossal warship scale
  const windowStripMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    emissive: 0xffffff,
    emissiveMap: windowTex,
    emissiveIntensity: 1.55,
    roughness: 0.24,
    metalness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const reactorMat = new THREE.MeshStandardMaterial({
    color: 0xffedd5,
    emissive: 0xf97316,
    emissiveIntensity: 2.1,
    roughness: 0.14,
    metalness: 0.12,
  });
  const reactorRingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.85, 0.82, 0.24),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const turretGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.9, 0.52, 0.36),
    toneMapped: false,
  });
  const engineRingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.9, 0.78, 0.22),
    toneMapped: false,
  });

  // Shared GLSL Volumetric Plasma Exhaust Shaders for Boss Quad Dreadnought Drives
  const bossPlumeOuterMat = createVolumetricThrusterMaterial({
    coreColor: 0xffedd5,
    outerColor: 0xf97316,
    boostCoreColor: 0xffe4e6,
    boostOuterColor: 0xff1e42,
    speed: 7.5,
    diamondCount: 4.0,
    intensity: 1.65,
    isInnerCore: false,
  });
  const bossPlumeInnerMat = createVolumetricThrusterMaterial({
    coreColor: 0xffffff,
    outerColor: 0xfb923c,
    boostCoreColor: 0xfff1f2,
    boostOuterColor: 0xf43f5e,
    speed: 10.5,
    diamondCount: 5.0,
    intensity: 1.95,
    isInnerCore: true,
  });

  disposables.push(
    hullMat,
    armorPlateMat,
    darkMetalMat,
    bridgeGlassMat,
    trimMat,
    windowStripMat,
    reactorMat,
    reactorRingMat,
    turretGlowMat,
    engineRingMat,
    bossPlumeOuterMat,
    bossPlumeInnerMat
  );

  // 1. Sculpted Angular Beveled Central Dreadnought Spine & Sloped Keel (replaces plain boxes)
  const spineShape = new THREE.Shape();
  spineShape.moveTo(0, 17.8);
  spineShape.lineTo(4.6, 13.5);
  spineShape.lineTo(5.6, -13.2);
  spineShape.lineTo(3.4, -17.4);
  spineShape.lineTo(-3.4, -17.4);
  spineShape.lineTo(-5.6, -13.2);
  spineShape.lineTo(-4.6, 13.5);
  spineShape.closePath();

  const spineGeo = new THREE.ExtrudeGeometry(spineShape, {
    depth: 4.4,
    bevelEnabled: true,
    bevelThickness: 0.95,
    bevelSize: 0.85,
    bevelSegments: 2,
  });
  spineGeo.center();
  spineGeo.rotateX(-Math.PI / 2);
  scaleUVs(spineGeo, 0.08, 0.08);
  const spine = new THREE.Mesh(spineGeo, hullMat);
  hullGroup.add(spine);
  disposables.push(spineGeo);

  // Sloped Dorsal Armored Superstructure Deck (beveled wedge)
  const deckShape = new THREE.Shape();
  deckShape.moveTo(0, 14.5);
  deckShape.lineTo(3.4, 9.8);
  deckShape.lineTo(4.3, -12.6);
  deckShape.lineTo(2.4, -14.8);
  deckShape.lineTo(-2.4, -14.8);
  deckShape.lineTo(-4.3, -12.6);
  deckShape.lineTo(-3.4, 9.8);
  deckShape.closePath();

  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 1.65,
    bevelEnabled: true,
    bevelThickness: 0.55,
    bevelSize: 0.55,
    bevelSegments: 2,
  });
  deckGeo.center();
  deckGeo.rotateX(-Math.PI / 2);
  scaleUVs(deckGeo, 0.09, 0.09);
  const deck = new THREE.Mesh(deckGeo, armorPlateMat);
  deck.position.set(0, 3.6, 1.4);
  hullGroup.add(deck);
  disposables.push(deckGeo);

  // Micro deck window & corridor light strips along central spine flanks
  const spineWinGeo = new THREE.PlaneGeometry(24.5, 2.25);
  scaleUVs(spineWinGeo, 2.4, 1.0);
  for (const side of [-1, 1]) {
    const winPanel = new THREE.Mesh(spineWinGeo, windowStripMat);
    winPanel.position.set(side * 6.52, 0.15, 0.5);
    winPanel.rotation.y = side * (Math.PI / 2);
    hullGroup.add(winPanel);
  }
  disposables.push(spineWinGeo);

  // Stepped Angular Command Citadel Tower (aft dorsal) + reflective clearcoat bridge + sensor mast
  const citadelShape = new THREE.Shape();
  citadelShape.moveTo(-2.6, 4.9);
  citadelShape.lineTo(2.6, 4.9);
  citadelShape.lineTo(3.6, -4.4);
  citadelShape.lineTo(2.2, -5.6);
  citadelShape.lineTo(-2.2, -5.6);
  citadelShape.lineTo(-3.6, -4.4);
  citadelShape.closePath();

  const bridgeBaseGeo = new THREE.ExtrudeGeometry(citadelShape, {
    depth: 3.4,
    bevelEnabled: true,
    bevelThickness: 0.55,
    bevelSize: 0.5,
    bevelSegments: 2,
  });
  bridgeBaseGeo.center();
  bridgeBaseGeo.rotateX(-Math.PI / 2);
  scaleUVs(bridgeBaseGeo, 0.14, 0.14);
  const bridgeBase = new THREE.Mesh(bridgeBaseGeo, darkMetalMat);
  bridgeBase.position.set(0, 6.2, 8.5);
  hullGroup.add(bridgeBase);

  // Swept beveled Command Bridge Wings
  const bridgeWingShape = new THREE.Shape();
  bridgeWingShape.moveTo(-7.2, 1.2);
  bridgeWingShape.lineTo(7.2, 1.2);
  bridgeWingShape.lineTo(5.6, -1.7);
  bridgeWingShape.lineTo(-5.6, -1.7);
  bridgeWingShape.closePath();
  const bridgeWingGeo = new THREE.ExtrudeGeometry(bridgeWingShape, {
    depth: 0.88,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.26,
    bevelSegments: 2,
  });
  bridgeWingGeo.center();
  bridgeWingGeo.rotateX(-Math.PI / 2);
  scaleUVs(bridgeWingGeo, 0.14, 0.14);
  const bridgeWing = new THREE.Mesh(bridgeWingGeo, armorPlateMat);
  bridgeWing.position.set(0, 7.65, 8.2);
  hullGroup.add(bridgeWing);

  // Micro deck observation windows wrapping both flanks AND forward citadel superstructure decks
  const citadelWinGeo = new THREE.PlaneGeometry(7.8, 1.75);
  scaleUVs(citadelWinGeo, 1.0, 0.85);
  for (const side of [-1, 1]) {
    const cWin = new THREE.Mesh(citadelWinGeo, windowStripMat);
    cWin.position.set(side * 3.72, 6.0, 8.5);
    cWin.rotation.y = side * (Math.PI / 2);
    hullGroup.add(cWin);
  }

  // Forward-facing multi-deck citadel & sponson micro-window banks (visible head-on in combat)
  const citadelFrontWinGeo = new THREE.PlaneGeometry(5.6, 1.35);
  scaleUVs(citadelFrontWinGeo, 0.72, 0.7);
  const citadelFrontWin = new THREE.Mesh(citadelFrontWinGeo, windowStripMat);
  citadelFrontWin.position.set(0, 5.45, 3.28);
  citadelFrontWin.rotation.y = Math.PI;
  hullGroup.add(citadelFrontWin);

  const wingFrontWinGeo = new THREE.PlaneGeometry(12.2, 0.72);
  scaleUVs(wingFrontWinGeo, 1.35, 0.45);
  const wingFrontWin = new THREE.Mesh(wingFrontWinGeo, windowStripMat);
  wingFrontWin.position.set(0, 7.65, 6.72);
  wingFrontWin.rotation.y = Math.PI;
  hullGroup.add(wingFrontWin);

  const deckFrontWinGeo = new THREE.PlaneGeometry(6.8, 1.15);
  scaleUVs(deckFrontWinGeo, 0.9, 0.6);
  const deckFrontWin = new THREE.Mesh(deckFrontWinGeo, windowStripMat);
  deckFrontWin.position.set(0, 3.6, -13.68);
  deckFrontWin.rotation.y = Math.PI;
  hullGroup.add(deckFrontWin);
  disposables.push(citadelFrontWinGeo, wingFrontWinGeo, deckFrontWinGeo);

  // Reflective dark glass bridge canopy with armored mullion frames
  const bridgeGlassGeo = new THREE.BoxGeometry(5.2, 0.92, 0.65);
  const bridgeGlass = new THREE.Mesh(bridgeGlassGeo, bridgeGlassMat);
  bridgeGlass.position.set(0, 7.32, 3.65);
  hullGroup.add(bridgeGlass);

  const mullionGeo = new THREE.BoxGeometry(0.18, 1.02, 0.78);
  for (const mx of [-1.7, 0, 1.7]) {
    const mullion = new THREE.Mesh(mullionGeo, darkMetalMat);
    mullion.position.set(mx, 7.32, 3.62);
    hullGroup.add(mullion);
  }

  // Thin fiery visor slit beneath bridge glass
  const bridgeVisorGeo = new THREE.BoxGeometry(4.9, 0.24, 0.22);
  const bridgeVisor = new THREE.Mesh(bridgeVisorGeo, trimMat);
  bridgeVisor.position.set(0, 6.72, 3.62);
  hullGroup.add(bridgeVisor);

  // Dorsal comms & sensor mast array greebles
  const mastGeo = new THREE.CylinderGeometry(0.18, 0.34, 4.2, 8);
  const mast = new THREE.Mesh(mastGeo, darkMetalMat);
  mast.position.set(0, 10.2, 9.2);
  hullGroup.add(mast);

  const radarBarGeo = new THREE.BoxGeometry(4.4, 0.22, 0.36);
  const radarBar = new THREE.Mesh(radarBarGeo, armorPlateMat);
  radarBar.position.set(0, 11.4, 9.2);
  hullGroup.add(radarBar);

  const antennaGeo = new THREE.CylinderGeometry(0.06, 0.1, 3.4, 6);
  for (const side of [-1, 1]) {
    const ant = new THREE.Mesh(antennaGeo, darkMetalMat);
    ant.position.set(side * 2.4, 9.4, 10.5);
    ant.rotation.x = 0.22;
    hullGroup.add(ant);
  }
  disposables.push(
    bridgeBaseGeo,
    bridgeWingGeo,
    citadelWinGeo,
    bridgeGlassGeo,
    mullionGeo,
    bridgeVisorGeo,
    mastGeo,
    radarBarGeo,
    antennaGeo
  );

  // 2. Twin Angular Beveled Forward Carrier Prongs, Sloped Sponsons, Micro-Windows & Fins
  const prongShape = new THREE.Shape();
  prongShape.moveTo(0, 17.5);
  prongShape.lineTo(2.4, 11.2);
  prongShape.lineTo(2.85, -12.4);
  prongShape.lineTo(1.75, -14.2);
  prongShape.lineTo(-1.75, -14.2);
  prongShape.lineTo(-2.85, -12.4);
  prongShape.lineTo(-2.4, 11.2);
  prongShape.closePath();

  const prongGeo = new THREE.ExtrudeGeometry(prongShape, {
    depth: 2.6,
    bevelEnabled: true,
    bevelThickness: 0.65,
    bevelSize: 0.55,
    bevelSegments: 2,
  });
  prongGeo.center();
  prongGeo.rotateX(-Math.PI / 2);
  scaleUVs(prongGeo, 0.085, 0.085);

  const sponsonShape = new THREE.Shape();
  sponsonShape.moveTo(-3.4, 8.8);
  sponsonShape.lineTo(2.2, 5.2);
  sponsonShape.lineTo(3.8, -6.2);
  sponsonShape.lineTo(1.6, -9.2);
  sponsonShape.lineTo(-3.4, -7.8);
  sponsonShape.closePath();

  const wingArmorGeo = new THREE.ExtrudeGeometry(sponsonShape, {
    depth: 1.35,
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.42,
    bevelSegments: 2,
  });
  wingArmorGeo.center();
  wingArmorGeo.rotateX(-Math.PI / 2);
  scaleUVs(wingArmorGeo, 0.09, 0.09);

  const stabShape = new THREE.Shape();
  stabShape.moveTo(-1.7, 2.5);
  stabShape.lineTo(1.6, 0.6);
  stabShape.lineTo(1.9, -2.6);
  stabShape.lineTo(-1.7, -2.0);
  stabShape.closePath();
  const stabilizerGeo = new THREE.ExtrudeGeometry(stabShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  stabilizerGeo.center();
  stabilizerGeo.rotateX(-Math.PI / 2);

  const conduitGeo = new THREE.BoxGeometry(0.38, 0.26, 22);
  const heatVentGeo = new THREE.BoxGeometry(0.34, 1.15, 0.65);
  const prongWinOuterGeo = new THREE.PlaneGeometry(21.5, 1.65);
  scaleUVs(prongWinOuterGeo, 2.2, 0.85);
  const prongWinInnerGeo = new THREE.PlaneGeometry(18.5, 1.45);
  scaleUVs(prongWinInnerGeo, 1.8, 0.8);

  for (const side of [-1, 1]) {
    const prong = new THREE.Mesh(prongGeo, hullMat);
    prong.position.set(side * 9.8, -0.3, -6.4);
    hullGroup.add(prong);

    // Hundreds of glowing micro deck windows along outer & inner carrier prong flanks
    const outerWin = new THREE.Mesh(prongWinOuterGeo, windowStripMat);
    outerWin.position.set(side * 13.26, -0.25, -5.2);
    outerWin.rotation.y = side * (Math.PI / 2);
    hullGroup.add(outerWin);

    const innerWin = new THREE.Mesh(prongWinInnerGeo, windowStripMat);
    innerWin.position.set(side * 6.34, -0.25, -6.0);
    innerWin.rotation.y = side * (-Math.PI / 2);
    hullGroup.add(innerWin);

    const sponson = new THREE.Mesh(wingArmorGeo, armorPlateMat);
    sponson.position.set(side * 14.5, 0.4, 3.5);
    sponson.scale.x = side;
    sponson.rotation.z = side * -0.18;
    hullGroup.add(sponson);

    // Outer tactical beveled stabilizer winglets
    const stab = new THREE.Mesh(stabilizerGeo, darkMetalMat);
    stab.position.set(side * 18.8, 0.0, 6.2);
    stab.scale.x = side;
    stab.rotation.z = side * -0.26;
    hullGroup.add(stab);

    // Glowing plasma conduits along each prong
    const conduit = new THREE.Mesh(conduitGeo, trimMat);
    conduit.position.set(side * 9.8, 1.68, -5.8);
    hullGroup.add(conduit);

    // Flank cooling radiator vents with emissive heat slots
    for (let v = 0; v < 4; v++) {
      const vent = new THREE.Mesh(heatVentGeo, trimMat);
      vent.position.set(side * 13.38, 0.55, -10.0 + v * 4.2);
      hullGroup.add(vent);
    }

    // Heavy armored rib struts connecting spine to prongs
    for (const zPos of [-6, 4, 12]) {
      const strutGeo = new THREE.BoxGeometry(6.2, 2.2, 2.6);
      const strut = new THREE.Mesh(strutGeo, darkMetalMat);
      strut.position.set(side * 6.4, 0, zPos);
      hullGroup.add(strut);
      disposables.push(strutGeo);
    }
  }
  disposables.push(
    prongGeo,
    wingArmorGeo,
    conduitGeo,
    stabilizerGeo,
    heatVentGeo,
    prongWinOuterGeo,
    prongWinInnerGeo
  );

  // 3. Exposed Central Plasma Reactor Core + Containment Clamps + Dual Counter-Rotating Rings
  const reactorGroup = new THREE.Group();
  reactorGroup.position.set(0, 1.4, -5.5);
  hullGroup.add(reactorGroup);

  const reactorGeo = new THREE.IcosahedronGeometry(3.9, 2);
  const reactorMesh = new THREE.Mesh(reactorGeo, reactorMat);
  reactorGroup.add(reactorMesh);

  const ring1Geo = new THREE.TorusGeometry(5.3, 0.24, 12, 36);
  const ring1 = new THREE.Mesh(ring1Geo, reactorRingMat);
  reactorGroup.add(ring1);

  const ring2Geo = new THREE.TorusGeometry(6.1, 0.18, 10, 36);
  const ring2 = new THREE.Mesh(ring2Geo, reactorRingMat);
  ring2.rotation.x = Math.PI / 2;
  reactorGroup.add(ring2);

  // Heavy magnetic containment clamp arms cradling the reactor
  const clampGeo = new THREE.BoxGeometry(0.95, 1.15, 3.6);
  for (let c = 0; c < 4; c++) {
    const ang = (c * Math.PI) / 2 + Math.PI / 4;
    const clamp = new THREE.Mesh(clampGeo, darkMetalMat);
    clamp.position.set(Math.cos(ang) * 5.2, Math.sin(ang) * 5.2, 0.4);
    clamp.rotation.z = ang;
    reactorGroup.add(clamp);
  }

  const reactorLight = new THREE.PointLight(0xf97316, 16, 90, 1.4);
  reactorGroup.add(reactorLight);
  disposables.push(reactorGeo, ring1Geo, ring2Geo, clampGeo);

  // 4. Six Glowing Heavy Plasma Turrets (turretOffsets in group space with +Z bow forward)
  const rawTurretCoords: Array<[number, number, number]> = [
    [-9.8, 2.2, -16.5],
    [9.8, 2.2, -16.5],
    [-14.6, 2.1, -1.5],
    [14.6, 2.1, -1.5],
    [-7.8, 4.9, 6.0],
    [7.8, 4.9, 6.0],
  ];
  const turretOffsets: THREE.Vector3[] = rawTurretCoords.map(
    ([x, y, z]) => new THREE.Vector3(-x, y, -z)
  );

  const turretBaseGeo = new THREE.CylinderGeometry(1.15, 1.5, 1.2, 10);
  const turretBarrelGeo = new THREE.CylinderGeometry(0.26, 0.34, 3.3, 8);
  turretBarrelGeo.rotateX(Math.PI / 2);
  const turretCoreGeo = new THREE.SphereGeometry(0.56, 10, 10);
  disposables.push(turretBaseGeo, turretBarrelGeo, turretCoreGeo);

  for (const [tx, ty, tz] of rawTurretCoords) {
    const turret = new THREE.Group();
    turret.position.set(tx, ty, tz);

    const base = new THREE.Mesh(turretBaseGeo, darkMetalMat);
    turret.add(base);

    const barrelL = new THREE.Mesh(turretBarrelGeo, armorPlateMat);
    barrelL.position.set(-0.45, 0.25, -1.4);
    turret.add(barrelL);

    const barrelR = new THREE.Mesh(turretBarrelGeo, armorPlateMat);
    barrelR.position.set(0.45, 0.25, -1.4);
    turret.add(barrelR);

    const glow = new THREE.Mesh(turretCoreGeo, turretGlowMat);
    glow.position.set(0, 0.5, -0.3);
    turret.add(glow);

    hullGroup.add(turret);
  }

  // 5. Quad Heavy Rear Dreadnought Engines with GLSL Volumetric Plasma Exhaust Shaders
  const engineBlockGeo = new THREE.CylinderGeometry(1.85, 2.28, 4.3, 18);
  engineBlockGeo.rotateX(Math.PI / 2);
  const engineRingGeo = new THREE.TorusGeometry(1.52, 0.16, 10, 26);

  // Tapered open cylinders aligned along +Z (uv.y = 0 at nozzle -> uv.y = 1 at aft tip)
  const enginePlumeOuterGeo = new THREE.CylinderGeometry(0.28, 1.52, 9.2, 24, 14, true);
  enginePlumeOuterGeo.rotateX(Math.PI / 2);
  enginePlumeOuterGeo.translate(0, 0, 4.6);

  const enginePlumeInnerGeo = new THREE.CylinderGeometry(0.14, 0.88, 6.2, 18, 10, true);
  enginePlumeInnerGeo.rotateX(Math.PI / 2);
  enginePlumeInnerGeo.translate(0, 0, 3.1);

  disposables.push(
    engineBlockGeo,
    engineRingGeo,
    enginePlumeOuterGeo,
    enginePlumeInnerGeo
  );

  const engineFlares: THREE.Mesh[] = [];
  const engineInnerCores: THREE.Mesh[] = [];
  const engineCoords: Array<[number, number, number]> = [
    [-4.2, 0.8, 17.5],
    [4.2, 0.8, 17.5],
    [-10.2, -0.4, 15.8],
    [10.2, -0.4, 15.8],
  ];
  for (const [ex, ey, ez] of engineCoords) {
    const block = new THREE.Mesh(engineBlockGeo, darkMetalMat);
    block.position.set(ex, ey, ez);
    hullGroup.add(block);

    const ring = new THREE.Mesh(engineRingGeo, engineRingMat);
    ring.position.set(ex, ey, ez + 2.1);
    hullGroup.add(ring);

    const outerFlare = new THREE.Mesh(enginePlumeOuterGeo, bossPlumeOuterMat);
    outerFlare.position.set(ex, ey, ez + 2.05);
    outerFlare.renderOrder = 4;
    hullGroup.add(outerFlare);
    engineFlares.push(outerFlare);

    const innerCore = new THREE.Mesh(enginePlumeInnerGeo, bossPlumeInnerMat);
    innerCore.position.set(ex, ey, ez + 2.05);
    innerCore.renderOrder = 5;
    hullGroup.add(innerCore);
    engineInnerCores.push(innerCore);
  }

  // Ventral drone launch bay offset (in group space)
  const hangarBayOffset = new THREE.Vector3(0, -4.4, 1.5);

  const phase1Color = new THREE.Color(0xf97316);
  const phase2Color = new THREE.Color(0xff1e42);
  const hitWhite = new THREE.Color(0xffffff);
  const scratchColor = new THREE.Color();
  let phase2Blend = 0;

  return {
    group,
    turretOffsets,
    hangarBayOffset,
    updateVisuals: (dt, elapsed, phase, hitFlash, dyingRatio) => {
      const spinMult = phase === 2 ? 2.8 : 1.0;
      phase2Blend = THREE.MathUtils.damp(phase2Blend, phase === 2 ? 1 : 0, 4.5, dt);

      reactorMesh.rotation.y += dt * 1.4 * spinMult;
      reactorMesh.rotation.x += dt * 0.85 * spinMult;
      ring1.rotation.z += dt * 1.6 * spinMult;
      ring1.rotation.x = Math.sin(elapsed * (phase === 2 ? 4.2 : 1.5)) * 0.65;
      ring2.rotation.y -= dt * 1.9 * spinMult;

      // Phase 1 molten amber vs Phase 2 bright crimson overdrive
      const targetAccent = phase === 2 ? phase2Color : phase1Color;
      const pulse =
        phase === 2
          ? 2.2 + Math.sin(elapsed * 11.5) * 0.65
          : 1.5 + Math.sin(elapsed * 3.2) * 0.28;

      reactorMat.emissive.copy(targetAccent);
      reactorMat.emissiveIntensity = pulse;
      reactorMat.color.setHex(phase === 2 ? 0xffe4e6 : 0xffedd5);

      trimMat.emissive.copy(targetAccent);
      trimMat.emissiveIntensity = phase === 2 ? 1.85 + Math.sin(elapsed * 9) * 0.42 : 1.15;
      bridgeGlassMat.emissive.copy(targetAccent);
      bridgeGlassMat.emissiveIntensity = phase === 2 ? 0.95 : 0.45;
      windowStripMat.emissiveIntensity =
        phase === 2 ? 1.75 + Math.sin(elapsed * 8.5) * 0.22 : 1.48;

      if (phase === 2) {
        reactorRingMat.color.setRGB(2.1, 0.22, 0.36);
        turretGlowMat.color.setRGB(2.15, 0.22, 0.42);
        engineRingMat.color.setRGB(2.1, 0.22, 0.36);
      } else {
        reactorRingMat.color.setRGB(1.85, 0.82, 0.24);
        turretGlowMat.color.setRGB(1.9, 0.56, 0.28);
        engineRingMat.color.setRGB(1.85, 0.78, 0.22);
      }
      reactorLight.color.copy(targetAccent);
      reactorLight.intensity = phase === 2 ? 26 : 16;

      const coreScale =
        phase === 2
          ? 1.06 + Math.sin(elapsed * 12) * 0.08
          : 1.0 + Math.sin(elapsed * 3) * 0.03;
      reactorMesh.scale.setScalar(coreScale);

      // Update Dreadnought GLSL Volumetric Plasma Exhaust Shaders
      bossPlumeOuterMat.uniforms.uTime.value = elapsed;
      bossPlumeOuterMat.uniforms.uBoost.value = phase2Blend;
      bossPlumeInnerMat.uniforms.uTime.value = elapsed;
      bossPlumeInnerMat.uniforms.uBoost.value = phase2Blend;

      const flarePulse = 0.92 + Math.sin(elapsed * 22) * 0.08;
      const lenScale = (1.0 + phase2Blend * 0.36) * flarePulse;
      for (let i = 0; i < engineFlares.length; i++) {
        engineFlares[i].scale.set(1, 1, lenScale);
        engineInnerCores[i].scale.set(1, 1, lenScale * 0.94);
      }

      // Hull hit flash feedback
      if (hitFlash > 0.01) {
        scratchColor.copy(targetAccent).lerp(hitWhite, 0.55);
        hullMat.emissive.copy(scratchColor);
        hullMat.emissiveIntensity = hitFlash * 0.8;
        armorPlateMat.emissive.copy(scratchColor);
        armorPlateMat.emissiveIntensity = hitFlash * 0.9;
      } else {
        hullMat.emissive.setHex(0x000000);
        hullMat.emissiveIntensity = 0;
        armorPlateMat.emissive.setHex(0x000000);
        armorPlateMat.emissiveIntensity = 0;
      }

      // Dramatic shudder & list during destruction chain
      if (dyingRatio > 0) {
        group.rotation.z += dt * 0.55;
        group.rotation.x += dt * 0.25;
        reactorMesh.scale.setScalar(1.2 + Math.sin(elapsed * 32) * 0.25);
      }
    },
    applyQuality: (nextAniso, nextHullSize) => {
      const nextTex = generateHullPlatingTextures('dreadnought', nextAniso, nextHullSize);
      const oldTex = hullTex;
      hullTex = nextTex;

      hullMat.map = nextTex.map;
      hullMat.normalMap = nextTex.normalMap;
      hullMat.roughnessMap = nextTex.roughnessMap;
      hullMat.needsUpdate = true;

      armorPlateMat.map = nextTex.map;
      armorPlateMat.normalMap = nextTex.normalMap;
      armorPlateMat.roughnessMap = nextTex.roughnessMap;
      armorPlateMat.needsUpdate = true;

      oldTex.map.dispose();
      oldTex.normalMap.dispose();
      oldTex.roughnessMap.dispose();
    },
    dispose: () => {
      hullTex.map.dispose();
      hullTex.normalMap.dispose();
      hullTex.roughnessMap.dispose();
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
