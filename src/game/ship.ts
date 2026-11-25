import * as THREE from 'three';
import {
  generateHullDecalTexture,
  generateHullPlatingTextures,
  type PbrTextureSet,
} from './textures';
import { createVolumetricThrusterMaterial } from './shaders';

export interface PlayerShipRig {
  root: THREE.Group;
  visualGroup: THREE.Group; // handles banking roll & subtle recoil
  thrusterFlames: THREE.Mesh[];
  thrusterCores: THREE.Mesh[];
  thrusterLight: THREE.PointLight;
  muzzleOffsets: [THREE.Vector3, THREE.Vector3];
  muzzleOffsets4: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  centerMuzzleOffset: THREE.Vector3;
  shieldShell: THREE.Mesh;
  hullMaterials: THREE.MeshStandardMaterial[];
  triggerMuzzleFlash: (colorHex?: number) => void;
  updateVisuals: (
    dt: number,
    elapsed: number,
    isBoosting: boolean,
    bankAngle: number,
    hitFlash: number,
    dodgeRollAngle?: number,
    dodgeEnergy?: number,
    steerYaw?: number,
    steerPitch?: number
  ) => void;
  applyQuality: (maxAnisotropy: number, hullTexSize: number) => void;
  dispose: () => void;
}

function scaleGeometryUVs(geo: THREE.BufferGeometry, scaleU: number, scaleV: number): void {
  const uv = geo.attributes.uv;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * scaleU, uv.getY(i) * scaleV);
  }
  uv.needsUpdate = true;
}

function enableShadows(mesh: THREE.Object3D): void {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

/**
 * Builds a Star Citizen / Everspace caliber aerospace starfighter with:
 * - Sculpted beveled ExtrudeGeometry hull, intakes, dorsal spine, canards & canted tail fins
 * - Sci-Fi Hull Plating PBR maps + crisp stenciled hull number decals ("GD-07")
 * - Custom GLSL Volumetric Plasma Exhaust Shaders with animated Mach shock diamonds & Fresnel fade
 * - Gimbaled vector-thrust nozzles responding to yaw/pitch steering
 * - Articulated wing-aft cooling heat vents that open and glow orange-blue during Turbo Boost
 * - Framed dark clearcoat glass canopy, blinking strobes, muzzle flashes & Fresnel energy shield
 * Oriented facing -Z (Three.js forward convention).
 */
export function createPlayerShip(
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  hullTexSize = 1024
): PlayerShipRig {
  const root = new THREE.Group();
  const visualGroup = new THREE.Group();
  root.add(visualGroup);
  const disposables: Array<{ dispose: () => void }> = [];

  let hullTex: PbrTextureSet = generateHullPlatingTextures('fighter', maxAnisotropy, hullTexSize);
  const decalTex = generateHullDecalTexture(maxAnisotropy);
  disposables.push(decalTex);

  const primaryHullMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hullTex.map,
    normalMap: hullTex.normalMap,
    normalScale: new THREE.Vector2(0.92, 0.92),
    roughnessMap: hullTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.78,
  });
  const darkArmorMat = new THREE.MeshStandardMaterial({
    color: 0x384864,
    map: hullTex.map,
    normalMap: hullTex.normalMap,
    normalScale: new THREE.Vector2(0.82, 0.82),
    roughnessMap: hullTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.68,
  });
  const intakeDarkMat = new THREE.MeshStandardMaterial({
    color: 0x0b101b,
    roughness: 0.85,
    metalness: 0.45,
  });
  const accentTrimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.45,
    roughness: 0.22,
    metalness: 0.85,
  });
  // Sleek dark-tinted reflective clearcoat aerospace glass canopy
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b223d,
    emissive: 0x083558,
    emissiveIntensity: 0.52,
    roughness: 0.05,
    metalness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.88 : 0.94,
  });
  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    map: hullTex.map,
    normalMap: hullTex.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.28,
    metalness: 0.92,
  });
  const canopyFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.34,
    metalness: 0.88,
  });
  const cockpitGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });
  const decalMat = new THREE.MeshStandardMaterial({
    map: decalTex,
    transparent: true,
    roughness: 0.42,
    metalness: 0.35,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const heatVentGlowMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.45,
    roughness: 0.28,
    metalness: 0.72,
  });

  disposables.push(
    primaryHullMat,
    darkArmorMat,
    intakeDarkMat,
    accentTrimMat,
    canopyMat,
    gunMetalMat,
    canopyFrameMat,
    cockpitGlowMat,
    decalMat,
    heatVentGlowMat
  );

  // 1. Primary sculpted fuselage body with beveled chines & normalized panel UVs
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 3.68);
  hullShape.lineTo(0.86, 0.95);
  hullShape.lineTo(1.1, -2.42);
  hullShape.lineTo(0.58, -3.02);
  hullShape.lineTo(-0.58, -3.02);
  hullShape.lineTo(-1.1, -2.42);
  hullShape.lineTo(-0.86, 0.95);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.68,
    bevelEnabled: true,
    bevelThickness: 0.22,
    bevelSize: 0.18,
    bevelSegments: 3,
  });
  hullGeo.center();
  hullGeo.rotateX(-Math.PI / 2);
  scaleGeometryUVs(hullGeo, 0.26, 0.26);
  const hullMesh = new THREE.Mesh(hullGeo, primaryHullMat);
  enableShadows(hullMesh);
  visualGroup.add(hullMesh);
  disposables.push(hullGeo);

  // 2. Sharp faceted metallic nose cone + nose sensor pitot
  const noseGeo = new THREE.ConeGeometry(0.47, 2.45, 8);
  noseGeo.rotateX(-Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, darkArmorMat);
  noseMesh.position.set(0, -0.02, -4.18);
  enableShadows(noseMesh);
  visualGroup.add(noseMesh);

  const pitotGeo = new THREE.CylinderGeometry(0.024, 0.055, 0.74, 6);
  pitotGeo.rotateX(Math.PI / 2);
  const pitot = new THREE.Mesh(pitotGeo, gunMetalMat);
  pitot.position.set(0, -0.02, -5.52);
  enableShadows(pitot);
  visualGroup.add(pitot);
  disposables.push(noseGeo, pitotGeo);

  // 3. Beveled stealth dorsal armor spine ridge + radiator louver greebles
  const spineShape = new THREE.Shape();
  spineShape.moveTo(-0.28, -1.78);
  spineShape.lineTo(0.28, -1.78);
  spineShape.lineTo(0.18, 1.72);
  spineShape.lineTo(-0.18, 1.72);
  spineShape.closePath();

  const spineGeo = new THREE.ExtrudeGeometry(spineShape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  spineGeo.center();
  spineGeo.rotateX(-Math.PI / 2);
  scaleGeometryUVs(spineGeo, 0.35, 0.35);
  const spineMesh = new THREE.Mesh(spineGeo, darkArmorMat);
  spineMesh.position.set(0, 0.48, 0.74);
  enableShadows(spineMesh);
  visualGroup.add(spineMesh);

  const dorsalStripGeo = new THREE.BoxGeometry(0.085, 0.036, 2.75);
  const dorsalStrip = new THREE.Mesh(dorsalStripGeo, accentTrimMat);
  dorsalStrip.position.set(0, 0.675, 0.84);
  visualGroup.add(dorsalStrip);

  const ventSlatGeo = new THREE.BoxGeometry(0.32, 0.07, 0.11);
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(ventSlatGeo, intakeDarkMat);
    slat.position.set(0, 0.65, 0.14 + i * 0.48);
    enableShadows(slat);
    visualGroup.add(slat);
  }
  disposables.push(spineGeo, dorsalStripGeo, ventSlatGeo);

  // 4. Framed reflective clearcoat glass cockpit canopy + inner HUD glow
  const canopyGeo = new THREE.CapsuleGeometry(0.43, 1.38, 10, 18);
  canopyGeo.rotateX(Math.PI / 2);
  canopyGeo.scale(1.06, 0.72, 1.0);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.position.set(0, 0.43, -1.16);
  canopyMesh.castShadow = true;
  visualGroup.add(canopyMesh);

  // Subtle internal glowing pilot console visible through tinted clearcoat canopy
  const consoleGeo = new THREE.BoxGeometry(0.34, 0.08, 0.32);
  const consoleMesh = new THREE.Mesh(consoleGeo, cockpitGlowMat);
  consoleMesh.position.set(0, 0.36, -1.68);
  consoleMesh.rotation.x = 0.35;
  visualGroup.add(consoleMesh);

  // Metallic canopy arch frame ribs
  const frameArchGeo = new THREE.TorusGeometry(0.45, 0.032, 6, 18, Math.PI);
  for (const zPos of [-1.72, -1.12, -0.58]) {
    const arch = new THREE.Mesh(frameArchGeo, canopyFrameMat);
    arch.position.set(0, 0.42, zPos);
    arch.scale.set(1.06, 0.74, 1);
    enableShadows(arch);
    visualGroup.add(arch);
  }
  const sillGeo = new THREE.BoxGeometry(0.06, 0.07, 1.95);
  for (const side of [-1, 1]) {
    const sill = new THREE.Mesh(sillGeo, canopyFrameMat);
    sill.position.set(side * 0.47, 0.41, -1.15);
    enableShadows(sill);
    visualGroup.add(sill);
  }
  disposables.push(canopyGeo, consoleGeo, frameArchGeo, sillGeo);

  // 5. Beveled stealth twin side aerospace engine intakes
  const intakeShape = new THREE.Shape();
  intakeShape.moveTo(-0.24, -1.12);
  intakeShape.lineTo(0.28, -0.94);
  intakeShape.lineTo(0.24, 1.15);
  intakeShape.lineTo(-0.26, 1.02);
  intakeShape.closePath();

  const intakeCowlGeo = new THREE.ExtrudeGeometry(intakeShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  intakeCowlGeo.center();
  intakeCowlGeo.rotateX(-Math.PI / 2);
  scaleGeometryUVs(intakeCowlGeo, 0.36, 0.36);

  const intakeMouthGeo = new THREE.BoxGeometry(0.42, 0.3, 0.14);
  const intakeLipGeo = new THREE.BoxGeometry(0.46, 0.04, 0.08);
  for (const side of [-1, 1]) {
    const cowl = new THREE.Mesh(intakeCowlGeo, darkArmorMat);
    cowl.position.set(side * 1.18, -0.02, 0.42);
    cowl.rotation.y = side * -0.06;
    enableShadows(cowl);
    visualGroup.add(cowl);

    const mouth = new THREE.Mesh(intakeMouthGeo, intakeDarkMat);
    mouth.position.set(side * 1.24, -0.02, -0.76);
    visualGroup.add(mouth);

    const lip = new THREE.Mesh(intakeLipGeo, accentTrimMat);
    lip.position.set(side * 1.24, 0.16, -0.78);
    visualGroup.add(lip);
  }
  disposables.push(intakeCowlGeo, intakeMouthGeo, intakeLipGeo);

  // 6. Swept delta main wings (beveled ExtrudeGeometry with normalized hull plating UVs)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.7, 1.0);
  wingShape.lineTo(4.35, -1.35);
  wingShape.lineTo(4.15, -2.25);
  wingShape.lineTo(0.85, -1.75);
  wingShape.closePath();

  const wingExtrude = {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.055,
    bevelSegments: 2,
  };
  const rightWingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrude);
  rightWingGeo.rotateX(-Math.PI / 2);
  scaleGeometryUVs(rightWingGeo, 0.28, 0.28);
  const rightWing = new THREE.Mesh(rightWingGeo, primaryHullMat);
  rightWing.position.set(0, -0.05, 0.25);
  enableShadows(rightWing);
  visualGroup.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.x = -1;
  enableShadows(leftWing);
  visualGroup.add(leftWing);
  disposables.push(rightWingGeo);

  // Crisp stenciled hull designation decals ("GD-07") flush on upper wing root shoulders
  const wingDecalGeo = new THREE.PlaneGeometry(1.38, 0.68);
  wingDecalGeo.rotateX(-Math.PI / 2);
  const rightDecal = new THREE.Mesh(wingDecalGeo, decalMat);
  rightDecal.position.set(2.15, 0.16, 1.15);
  rightDecal.rotation.y = -0.34;
  visualGroup.add(rightDecal);

  const leftDecal = new THREE.Mesh(wingDecalGeo, decalMat);
  leftDecal.position.set(-2.15, 0.16, 1.15);
  leftDecal.rotation.y = 0.34;
  visualGroup.add(leftDecal);
  disposables.push(wingDecalGeo);

  // 6b. Articulated Wing-Aft Cooling Heat Vents (swing open & glow orange-blue on Turbo Boost)
  const ventHousingGeo = new THREE.BoxGeometry(1.18, 0.09, 0.42);
  const ventRadiatorGeo = new THREE.BoxGeometry(1.06, 0.05, 0.3);
  const ventFlapGeo = new THREE.BoxGeometry(1.14, 0.055, 0.38);
  // Shift flap geometry so its front edge sits at pivot z = 0 and swings upward cleanly
  ventFlapGeo.translate(0, 0.02, 0.19);
  disposables.push(ventHousingGeo, ventRadiatorGeo, ventFlapGeo);

  const heatVentFlaps: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const bayGroup = new THREE.Group();
    bayGroup.position.set(side * 2.15, 0.12, 1.72);
    bayGroup.rotation.y = side * -0.17;
    visualGroup.add(bayGroup);

    const housing = new THREE.Mesh(ventHousingGeo, intakeDarkMat);
    enableShadows(housing);
    bayGroup.add(housing);

    const radiator = new THREE.Mesh(ventRadiatorGeo, heatVentGlowMat);
    radiator.position.set(0, 0.03, 0);
    bayGroup.add(radiator);

    const flap = new THREE.Mesh(ventFlapGeo, darkArmorMat);
    flap.position.set(0, 0.04, -0.19);
    enableShadows(flap);
    bayGroup.add(flap);
    heatVentFlaps.push(flap);
  }

  // Sculpted beveled forward canard stabilizer winglets + ventral keel stabilizer
  const canardShape = new THREE.Shape();
  canardShape.moveTo(0, 0.34);
  canardShape.lineTo(1.18, -0.12);
  canardShape.lineTo(1.06, -0.34);
  canardShape.lineTo(0, -0.22);
  canardShape.closePath();

  const canardGeo = new THREE.ExtrudeGeometry(canardShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  canardGeo.rotateX(-Math.PI / 2);
  scaleGeometryUVs(canardGeo, 0.4, 0.4);

  for (const side of [-1, 1]) {
    const canard = new THREE.Mesh(canardGeo, darkArmorMat);
    canard.position.set(side * 0.66, -0.08, -2.28);
    canard.scale.x = side;
    canard.rotation.z = side * -0.12;
    enableShadows(canard);
    visualGroup.add(canard);
  }

  const keelShape = new THREE.Shape();
  keelShape.moveTo(-0.92, 0.22);
  keelShape.lineTo(0.88, 0.22);
  keelShape.lineTo(0.55, -0.34);
  keelShape.lineTo(-0.62, -0.24);
  keelShape.closePath();
  const keelGeo = new THREE.ExtrudeGeometry(keelShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  keelGeo.center();
  keelGeo.rotateY(Math.PI / 2);
  const keel = new THREE.Mesh(keelGeo, darkArmorMat);
  keel.position.set(0, -0.52, 1.35);
  enableShadows(keel);
  visualGroup.add(keel);
  disposables.push(canardGeo, keelGeo);

  // 7. Thin crisp wing emissive energy strips & armor trim ribs
  const stripGeo = new THREE.BoxGeometry(2.35, 0.045, 0.085);
  const rightStrip = new THREE.Mesh(stripGeo, accentTrimMat);
  rightStrip.position.set(2.32, 0.095, 0.78);
  rightStrip.rotation.y = -0.52;
  visualGroup.add(rightStrip);

  const leftStrip = rightStrip.clone();
  leftStrip.position.x = -2.32;
  leftStrip.rotation.y = 0.52;
  visualGroup.add(leftStrip);
  disposables.push(stripGeo);

  // 8. Blinking aerospace wingtip navigation strobe lights (red port / emerald-cyan starboard)
  const navGeo = new THREE.SphereGeometry(0.13, 10, 10);
  const portNavMat = new THREE.MeshBasicMaterial({ color: 0xff3b5c, toneMapped: false });
  const starNavMat = new THREE.MeshBasicMaterial({ color: 0x34f5c5, toneMapped: false });

  const portNav = new THREE.Mesh(navGeo, portNavMat);
  portNav.position.set(-4.26, 0.02, 2.02);
  visualGroup.add(portNav);

  const starNav = new THREE.Mesh(navGeo, starNavMat);
  starNav.position.set(4.26, 0.02, 2.02);
  visualGroup.add(starNav);
  disposables.push(navGeo, portNavMat, starNavMat);

  // 9. Wingtip Turbo Boost light trails (tapered additive ribbons stretching aft during boost)
  const trailGeo = new THREE.ConeGeometry(0.11, 1.0, 6, 1, true);
  trailGeo.rotateX(Math.PI / 2);
  trailGeo.translate(0, 0, 0.5);
  const trailMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const leftTrail = new THREE.Mesh(trailGeo, trailMat);
  leftTrail.position.set(-4.26, 0.02, 2.08);
  visualGroup.add(leftTrail);

  const rightTrail = new THREE.Mesh(trailGeo, trailMat);
  rightTrail.position.set(4.26, 0.02, 2.08);
  visualGroup.add(rightTrail);
  disposables.push(trailGeo, trailMat);

  // 10. Swept beveled twin vertical stabilizer tail fins + crisp top accent tips
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.82, -0.62);
  finShape.lineTo(0.74, -0.62);
  finShape.lineTo(0.92, 0.68);
  finShape.lineTo(0.18, 0.68);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.075,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.022,
    bevelSegments: 2,
  });
  finGeo.center();
  finGeo.rotateY(Math.PI / 2);
  scaleGeometryUVs(finGeo, 0.4, 0.4);

  const finTipGeo = new THREE.BoxGeometry(0.11, 0.055, 0.78);
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, darkArmorMat);
    fin.position.set(side * 1.36, 0.56, 2.04);
    fin.rotation.z = side * -0.32;
    enableShadows(fin);
    visualGroup.add(fin);

    const tip = new THREE.Mesh(finTipGeo, accentTrimMat);
    tip.position.set(side * 1.56, 1.19, 2.38);
    tip.rotation.z = side * -0.32;
    visualGroup.add(tip);
  }
  disposables.push(finGeo, finTipGeo);

  // 11. Twin plasma laser cannons + cooling shrouds + additive Muzzle Flash bursts
  const barrelGeo = new THREE.CylinderGeometry(0.095, 0.13, 2.15, 10);
  barrelGeo.rotateX(Math.PI / 2);
  const shroudGeo = new THREE.BoxGeometry(0.32, 0.24, 0.92);
  const tipGeo = new THREE.SphereGeometry(0.105, 8, 8);
  const tipMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });

  const flashGeo = new THREE.OctahedronGeometry(0.56, 0);
  flashGeo.scale(0.85, 0.85, 1.85);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const muzzleFlashes: THREE.Mesh[] = [];

  const cannonX = 2.65;
  for (const side of [-1, 1]) {
    const barrel = new THREE.Mesh(barrelGeo, gunMetalMat);
    barrel.position.set(side * cannonX, -0.22, -0.35);
    enableShadows(barrel);
    visualGroup.add(barrel);

    const shroud = new THREE.Mesh(shroudGeo, darkArmorMat);
    shroud.position.set(side * cannonX, -0.2, 0.15);
    enableShadows(shroud);
    visualGroup.add(shroud);

    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(side * cannonX, -0.22, -1.46);
    visualGroup.add(tip);

    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(side * cannonX, -0.22, -1.78);
    visualGroup.add(flash);
    muzzleFlashes.push(flash);
  }
  disposables.push(barrelGeo, shroudGeo, tipGeo, tipMat, flashGeo, flashMat);

  const muzzleLight = new THREE.PointLight(0x38bdf8, 0, 14, 1.8);
  muzzleLight.position.set(0, -0.2, -1.9);
  visualGroup.add(muzzleLight);

  // 12. Twin Vector-Thrust Engine Nacelles + GLSL Volumetric Plasma Exhaust Shaders
  const nacelleGeo = new THREE.CylinderGeometry(0.36, 0.46, 1.55, 18);
  nacelleGeo.rotateX(Math.PI / 2);
  const gimbalShroudGeo = new THREE.CylinderGeometry(0.33, 0.4, 0.48, 18);
  gimbalShroudGeo.rotateX(Math.PI / 2);
  gimbalShroudGeo.translate(0, 0, 0.2);
  const plasmaRingGeo = new THREE.TorusGeometry(0.31, 0.044, 10, 26);
  const innerCoreDiscGeo = new THREE.CircleGeometry(0.26, 18);

  const plasmaRingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.38, 1.45, 1.95),
    toneMapped: false,
  });
  const innerCoreMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.85, 1.65, 2.2),
    transparent: true,
    opacity: 0.94,
    toneMapped: false,
  });

  // Tapered open cylinders aligned along +Z (uv.y = 0 at nozzle z=0 -> uv.y = 1 at aft tip)
  const outerPlumeGeo = new THREE.CylinderGeometry(0.08, 0.35, 3.15, 24, 14, true);
  outerPlumeGeo.rotateX(Math.PI / 2);
  outerPlumeGeo.translate(0, 0, 1.575);

  const innerPlumeGeo = new THREE.CylinderGeometry(0.04, 0.21, 2.2, 20, 10, true);
  innerPlumeGeo.rotateX(Math.PI / 2);
  innerPlumeGeo.translate(0, 0, 1.1);

  const outerPlumeMat = createVolumetricThrusterMaterial({
    coreColor: 0xe0f7ff,
    outerColor: 0x0284c7,
    boostCoreColor: 0xfffbeb,
    boostOuterColor: 0xf97316,
    speed: 13.0,
    diamondCount: 5.0,
    intensity: 1.95,
    isInnerCore: false,
  });

  const innerPlumeMat = createVolumetricThrusterMaterial({
    coreColor: 0xffffff,
    outerColor: 0x38bdf8,
    boostCoreColor: 0xffffff,
    boostOuterColor: 0xfbbf24,
    speed: 17.0,
    diamondCount: 6.0,
    intensity: 2.35,
    isInnerCore: true,
  });

  disposables.push(
    nacelleGeo,
    gimbalShroudGeo,
    plasmaRingGeo,
    innerCoreDiscGeo,
    plasmaRingMat,
    innerCoreMat,
    outerPlumeGeo,
    innerPlumeGeo,
    outerPlumeMat,
    innerPlumeMat
  );

  const thrusterFlames: THREE.Mesh[] = [];
  const thrusterCores: THREE.Mesh[] = [];
  const nozzlePivots: THREE.Group[] = [];

  for (const side of [-1, 1]) {
    const nacelle = new THREE.Mesh(nacelleGeo, gunMetalMat);
    nacelle.position.set(side * 0.62, 0.0, 2.95);
    enableShadows(nacelle);
    visualGroup.add(nacelle);

    // Vector-thrust gimbal pivot protruding cleanly aft of the rear fuselage transom
    const nozzlePivot = new THREE.Group();
    nozzlePivot.position.set(side * 0.62, 0.0, 3.55);
    visualGroup.add(nozzlePivot);
    nozzlePivots.push(nozzlePivot);

    const shroud = new THREE.Mesh(gimbalShroudGeo, intakeDarkMat);
    enableShadows(shroud);
    nozzlePivot.add(shroud);

    const disc = new THREE.Mesh(innerCoreDiscGeo, innerCoreMat);
    disc.position.set(0, 0, 0.36);
    nozzlePivot.add(disc);

    const ring = new THREE.Mesh(plasmaRingGeo, plasmaRingMat);
    ring.position.set(0, 0, 0.42);
    nozzlePivot.add(ring);

    const outerFlame = new THREE.Mesh(outerPlumeGeo, outerPlumeMat);
    outerFlame.position.set(0, 0, 0.38);
    outerFlame.renderOrder = 4;
    nozzlePivot.add(outerFlame);
    thrusterFlames.push(outerFlame);

    const innerFlame = new THREE.Mesh(innerPlumeGeo, innerPlumeMat);
    innerFlame.position.set(0, 0, 0.38);
    innerFlame.renderOrder = 5;
    nozzlePivot.add(innerFlame);
    thrusterCores.push(innerFlame);
  }

  // 13. Translucent Fresnel Energy Shield Dome (shimmers & flashes when struck)
  const shieldGeo = new THREE.SphereGeometry(4.65, 28, 20);
  const shieldShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x38bdf8) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        if (uOpacity <= 0.005) discard;
        float rim = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.1);
        float hexBands = 0.55 + 0.45 * sin(vLocalPos.y * 6.5 - uTime * 18.0) * cos(vLocalPos.x * 5.0 + vLocalPos.z * 5.0);
        float alpha = (0.18 + rim * 0.95) * (0.7 + 0.3 * hexBands) * uOpacity;
        vec3 col = mix(uColor, vec3(0.95, 0.98, 1.0), rim * 0.55);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const shieldShell = new THREE.Mesh(shieldGeo, shieldShaderMat);
  shieldShell.visible = false;
  shieldShell.renderOrder = 5;
  visualGroup.add(shieldShell);
  disposables.push(shieldGeo, shieldShaderMat);

  // 14. Barrel Roll aerodynamic energy slipstream rings (visible during Q / double-tap dodge)
  const dodgeRingGeo = new THREE.TorusGeometry(3.7, 0.11, 8, 36);
  const dodgeRingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.55, 1.55, 2.2),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const dodgeRing1 = new THREE.Mesh(dodgeRingGeo, dodgeRingMat);
  dodgeRing1.rotation.y = Math.PI / 10;
  dodgeRing1.visible = false;
  dodgeRing1.renderOrder = 6;
  visualGroup.add(dodgeRing1);

  const dodgeRing2 = new THREE.Mesh(dodgeRingGeo, dodgeRingMat);
  dodgeRing2.rotation.y = -Math.PI / 10;
  dodgeRing2.position.z = 1.1;
  dodgeRing2.visible = false;
  dodgeRing2.renderOrder = 6;
  visualGroup.add(dodgeRing2);
  disposables.push(dodgeRingGeo, dodgeRingMat);

  const thrusterLight = new THREE.PointLight(0x38bdf8, 2.2, 18, 1.8);
  thrusterLight.position.set(0, 0, 4.4);
  visualGroup.add(thrusterLight);

  const normalColor = new THREE.Color(0x0ea5e9);
  const boostColor = new THREE.Color(0xf97316);
  const ventCoolColor = new THREE.Color(0x0ea5e9);
  const ventHotColor = new THREE.Color(0xff6b1a);
  const flameColorScratch = new THREE.Color();

  let currentBank = 0;
  let currentFlameLen = 1.0;
  let boostBlend = 0;
  let gimbalYaw = 0;
  let gimbalPitch = 0;
  let trailLen = 0;
  let muzzleFlashTimer = 0;

  return {
    root,
    visualGroup,
    thrusterFlames,
    thrusterCores,
    thrusterLight,
    muzzleOffsets: [
      new THREE.Vector3(-cannonX, -0.22, -1.65),
      new THREE.Vector3(cannonX, -0.22, -1.65),
    ],
    muzzleOffsets4: [
      new THREE.Vector3(-3.35, -0.18, -0.95),
      new THREE.Vector3(-1.85, -0.24, -1.75),
      new THREE.Vector3(1.85, -0.24, -1.75),
      new THREE.Vector3(3.35, -0.18, -0.95),
    ],
    centerMuzzleOffset: new THREE.Vector3(0, -0.18, -3.6),
    shieldShell,
    hullMaterials: [primaryHullMat, darkArmorMat],
    triggerMuzzleFlash: (colorHex = 0xe0f2fe) => {
      muzzleFlashTimer = 0.095;
      flashMat.color.setHex(colorHex);
      muzzleLight.color.setHex(colorHex);
    },
    updateVisuals: (
      dt,
      elapsed,
      isBoosting,
      bankAngle,
      hitFlash,
      dodgeRollAngle = 0,
      dodgeEnergy = 0,
      steerYaw = 0,
      steerPitch = 0
    ) => {
      // Smooth roll banking on turns + full 360-deg Barrel Roll spin overlay
      currentBank = THREE.MathUtils.damp(currentBank, bankAngle, 8.5, dt);
      visualGroup.rotation.z = currentBank + dodgeRollAngle;

      // Smooth Turbo Boost mechanical state blend (drives plasma shader & heat vents)
      boostBlend = THREE.MathUtils.damp(boostBlend, isBoosting ? 1 : 0, 7.5, dt);

      // Vector-thrust engine nozzle gimballing responding to yaw & pitch steering
      const targetGimbalYaw = THREE.MathUtils.clamp(-steerYaw * 0.2, -0.26, 0.26);
      const targetGimbalPitch = THREE.MathUtils.clamp(steerPitch * 0.22, -0.24, 0.24);
      gimbalYaw = THREE.MathUtils.damp(gimbalYaw, targetGimbalYaw, 10, dt);
      gimbalPitch = THREE.MathUtils.damp(gimbalPitch, targetGimbalPitch, 10, dt);
      for (let i = 0; i < nozzlePivots.length; i++) {
        nozzlePivots[i].rotation.y = gimbalYaw;
        nozzlePivots[i].rotation.x = gimbalPitch;
      }

      // Articulated wing-aft cooling heat vents swing open & ignite orange-blue during boost
      const ventAngle = 0.06 + boostBlend * 0.56;
      for (let i = 0; i < heatVentFlaps.length; i++) {
        heatVentFlaps[i].rotation.x = -ventAngle;
      }
      heatVentGlowMat.color.copy(ventCoolColor).lerp(ventHotColor, boostBlend * 0.85);
      heatVentGlowMat.emissive.copy(ventCoolColor).lerp(ventHotColor, boostBlend * 0.92);
      heatVentGlowMat.emissiveIntensity =
        0.45 + boostBlend * (2.6 + Math.sin(elapsed * 22) * 0.28);

      // Barrel Roll aerodynamic energy slipstream rings
      const showDodge = dodgeEnergy > 0.02;
      dodgeRing1.visible = showDodge;
      dodgeRing2.visible = showDodge;
      if (showDodge) {
        dodgeRingMat.opacity = dodgeEnergy * 0.78;
        const rScale = 0.78 + dodgeEnergy * 0.42;
        dodgeRing1.scale.set(rScale, rScale, 1);
        dodgeRing2.scale.set(rScale * 0.82, rScale * 0.82, 1);
        dodgeRing1.rotation.z = elapsed * 14;
        dodgeRing2.rotation.z = -elapsed * 18;
      }

      // Blinking aerospace navigation strobes
      const strobeCycle = elapsed % 1.4;
      const strobeOn = strobeCycle < 0.14 || (strobeCycle > 0.24 && strobeCycle < 0.36);
      portNav.scale.setScalar(strobeOn ? 1.45 : 0.72);
      starNav.scale.setScalar(strobeOn ? 1.45 : 0.72);
      portNavMat.color.setRGB(strobeOn ? 1.8 : 0.45, strobeOn ? 0.25 : 0.06, strobeOn ? 0.35 : 0.1);
      starNavMat.color.setRGB(strobeOn ? 0.22 : 0.05, strobeOn ? 1.65 : 0.35, strobeOn ? 1.3 : 0.28);

      // Wingtip light trails extend smoothly during Turbo Boost or Barrel Roll
      const targetTrail = isBoosting ? 12.5 : dodgeEnergy > 0.1 ? 9.5 * dodgeEnergy : 0.0;
      trailLen = THREE.MathUtils.damp(trailLen, targetTrail, 8.5, dt);
      const showTrail = trailLen > 0.25;
      leftTrail.visible = showTrail;
      rightTrail.visible = showTrail;
      if (showTrail) {
        leftTrail.scale.set(1, 1, trailLen);
        rightTrail.scale.set(1, 1, trailLen);
        trailMat.opacity = Math.min(0.66, (trailLen / 12.5) * 0.66);
        trailMat.color.setHex(dodgeEnergy > 0.1 ? 0xa5f3fc : isBoosting ? 0x7dd3fc : 0x38bdf8);
      }

      // Twin plasma cannon muzzle flash decay
      if (muzzleFlashTimer > 0) {
        muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
        const ratio = muzzleFlashTimer / 0.095;
        flashMat.opacity = ratio * 0.92;
        muzzleLight.intensity = ratio * 11;
        for (let i = 0; i < muzzleFlashes.length; i++) {
          muzzleFlashes[i].visible = true;
          muzzleFlashes[i].scale.setScalar(0.55 + ratio * 0.85);
          muzzleFlashes[i].rotation.z = elapsed * 35 + i;
        }
      } else {
        flashMat.opacity = 0;
        muzzleLight.intensity = 0;
        for (let i = 0; i < muzzleFlashes.length; i++) {
          muzzleFlashes[i].visible = false;
        }
      }

      // Update GLSL Volumetric Plasma Exhaust Shaders (Mach shock diamonds & plasma flow)
      outerPlumeMat.uniforms.uTime.value = elapsed;
      outerPlumeMat.uniforms.uBoost.value = boostBlend;
      innerPlumeMat.uniforms.uTime.value = elapsed;
      innerPlumeMat.uniforms.uBoost.value = boostBlend;

      const targetLen = 0.92 + boostBlend * 1.48;
      currentFlameLen = THREE.MathUtils.damp(currentFlameLen, targetLen, 11, dt);
      const flicker = 0.94 + Math.sin(elapsed * 42) * 0.045 + Math.cos(elapsed * 67) * 0.025;

      flameColorScratch.copy(normalColor).lerp(boostColor, boostBlend * 0.78);
      plasmaRingMat.color.setRGB(
        THREE.MathUtils.lerp(0.32, 1.9, boostBlend),
        THREE.MathUtils.lerp(1.28, 1.15, boostBlend),
        THREE.MathUtils.lerp(1.85, 0.28, boostBlend)
      );
      innerCoreMat.color.setRGB(
        THREE.MathUtils.lerp(0.75, 2.0, boostBlend),
        THREE.MathUtils.lerp(1.5, 1.55, boostBlend),
        THREE.MathUtils.lerp(2.1, 0.75, boostBlend)
      );

      thrusterLight.color.copy(flameColorScratch);
      thrusterLight.intensity = (2.4 + boostBlend * 5.6) * flicker;

      for (let i = 0; i < thrusterFlames.length; i++) {
        const s = currentFlameLen * flicker;
        const width = 0.94 + boostBlend * 0.22;
        thrusterFlames[i].scale.set(width, width, s);
        thrusterCores[i].scale.set(width * 0.88, width * 0.88, s * 0.92);
      }

      // Translucent Fresnel Energy Shield dome flash on hit/collision OR invulnerability phase during barrel roll
      const shieldStrength = Math.max(hitFlash, dodgeEnergy * 0.52);
      if (shieldStrength > 0.01) {
        shieldShell.visible = true;
        shieldShaderMat.uniforms.uOpacity.value = Math.min(1, shieldStrength * 1.1);
        shieldShaderMat.uniforms.uTime.value = elapsed;
        shieldShaderMat.uniforms.uColor.value.setHex(
          dodgeEnergy > hitFlash ? 0xa5f3fc : hitFlash > 0.55 ? 0x38bdf8 : 0x60a5fa
        );
        primaryHullMat.emissive.setHex(0x38bdf8);
        primaryHullMat.emissiveIntensity = hitFlash * 0.4 + dodgeEnergy * 0.16;
      } else {
        shieldShell.visible = false;
        shieldShaderMat.uniforms.uOpacity.value = 0;
        primaryHullMat.emissive.setHex(0x000000);
        primaryHullMat.emissiveIntensity = 0;
      }
    },
    applyQuality: (nextAniso, nextHullSize) => {
      const nextTex = generateHullPlatingTextures('fighter', nextAniso, nextHullSize);
      const oldTex = hullTex;
      hullTex = nextTex;

      primaryHullMat.map = nextTex.map;
      primaryHullMat.normalMap = nextTex.normalMap;
      primaryHullMat.roughnessMap = nextTex.roughnessMap;
      primaryHullMat.needsUpdate = true;

      darkArmorMat.map = nextTex.map;
      darkArmorMat.normalMap = nextTex.normalMap;
      darkArmorMat.roughnessMap = nextTex.roughnessMap;
      darkArmorMat.needsUpdate = true;

      gunMetalMat.map = nextTex.map;
      gunMetalMat.normalMap = nextTex.normalMap;
      gunMetalMat.needsUpdate = true;

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
