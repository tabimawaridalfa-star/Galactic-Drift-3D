import * as THREE from 'three';

export interface VolumetricThrusterOptions {
  coreColor: number;
  outerColor: number;
  boostCoreColor?: number;
  boostOuterColor?: number;
  speed?: number;
  diamondCount?: number;
  intensity?: number;
  isInnerCore?: boolean;
}

/**
 * Custom GLSL Volumetric Plasma Exhaust Shader for Star Citizen / Everspace caliber engines.
 * Renders:
 * - Incandescent hot nozzle core (white-cyan / amber-white)
 * - Animated periodic Mach shock diamonds along the exhaust axis
 * - Fast-flowing procedural plasma turbulence streaming aft
 * - Soft radial Fresnel edge falloff + smooth axial fade (zero hard plastic cone edges)
 *
 * Expects an open tapered cylinder/lathe geometry aligned along +Z (z=0 nozzle, z=1 tail)
 * where `uv.y` runs 0.0 at the nozzle throat to 1.0 at the exhaust tip.
 */
export function createVolumetricThrusterMaterial(
  options: VolumetricThrusterOptions
): THREE.ShaderMaterial {
  const {
    coreColor,
    outerColor,
    boostCoreColor = 0xfff7ed,
    boostOuterColor = 0xf59e0b,
    speed = 11.5,
    diamondCount = 5.0,
    intensity = 1.45,
    isInnerCore = false,
  } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBoost: { value: 0 },
      uCoreColor: { value: new THREE.Color(coreColor) },
      uOuterColor: { value: new THREE.Color(outerColor) },
      uBoostCoreColor: { value: new THREE.Color(boostCoreColor) },
      uBoostOuterColor: { value: new THREE.Color(boostOuterColor) },
      uSpeed: { value: speed },
      uDiamondCount: { value: diamondCount },
      uIntensity: { value: intensity },
      uCoreBias: { value: isInnerCore ? 1.0 : 0.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uBoost;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Subtle aerodynamic plasma flutter along the aft plume
        float tailMask = smoothstep(0.08, 0.95, uv.y);
        float wave = sin(uv.y * 16.0 - uTime * (22.0 + uBoost * 16.0) + uv.x * 12.566);
        float pulse = 1.0 + wave * 0.045 * tailMask * (0.7 + uBoost * 0.6);
        pos.xy *= pulse;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBoost;
      uniform vec3 uCoreColor;
      uniform vec3 uOuterColor;
      uniform vec3 uBoostCoreColor;
      uniform vec3 uBoostOuterColor;
      uniform float uSpeed;
      uniform float uDiamondCount;
      uniform float uIntensity;
      uniform float uCoreBias;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.123);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = vnoise(p) * 0.56;
        p = p * 2.07 + vec2(13.1, 7.7);
        v += vnoise(p) * 0.29;
        p = p * 2.13 + vec2(-5.3, 11.4);
        v += vnoise(p) * 0.15;
        return v;
      }

      void main() {
        // vUv.y: 0.0 at nozzle exit -> 1.0 at aft tip
        float axial = clamp(vUv.y, 0.0, 1.0);

        // Seamless cylindrical wrap around circumference (x) while streaming fast along axial (y)
        float angle = vUv.x * 6.2831853;
        vec2 flowUv = vec2(cos(angle) * 1.45 + sin(angle) * 1.45, axial * 4.4 - uTime * (uSpeed + uBoost * 9.0));
        float plasma = fbm(flowUv);
        float fineStreaks = vnoise(vec2(sin(angle * 3.0) * 2.4, axial * 9.5 - uTime * (uSpeed * 1.65 + uBoost * 12.0)));
        float turbulence = plasma * 0.68 + fineStreaks * 0.32;

        // Soft radial Fresnel falloff tuned so plumes read vividly from both oblique and rear chase angles
        float ndv = abs(dot(normalize(vNormal), normalize(vViewDir)));
        float fresnelSoft = mix(0.28, 1.0, pow(clamp(ndv, 0.0, 1.0), mix(1.05, 0.8, uCoreBias)));

        // Smooth nozzle entry + long wispy aft dissipation
        float nozzleFade = smoothstep(0.0, 0.05, axial);
        float tailFade = pow(max(0.0, 1.0 - axial), mix(1.25, 1.75, uCoreBias));
        float tailDissolve = smoothstep(0.05, 0.68, tailFade + (turbulence - 0.45) * 0.38 * axial);

        // Periodic Mach shock diamonds (bright compression nodes pulsing down the plasma jet)
        float diamondPhase = axial * uDiamondCount * 3.14159265 - uTime * (3.6 + uBoost * 7.2);
        float diamondWave = exp(-pow(sin(diamondPhase), 2.0) * 6.5);
        float diamondEnvelope = smoothstep(0.04, 0.16, axial) * smoothstep(0.92, 0.18, axial);
        float shockDiamonds = diamondWave * diamondEnvelope * (0.62 + 0.92 * uBoost + 0.42 * uCoreBias);

        // Hot incandescent throat glow right at the nozzle lip
        float throatCore = exp(-axial * mix(5.2, 3.6, uCoreBias)) * (1.28 + uBoost * 0.6);

        // Blend base plasma hues toward overdrive/boost spectrum
        vec3 coreCol = mix(uCoreColor, uBoostCoreColor, uBoost);
        vec3 outerCol = mix(uOuterColor, uBoostOuterColor, uBoost);

        float heat = clamp(
          throatCore * 0.88 + shockDiamonds * 0.78 + (1.0 - axial) * 0.38 * turbulence + uCoreBias * 0.38,
          0.0,
          1.35
        );
        vec3 col = mix(outerCol, coreCol, smoothstep(0.16, 0.88, heat));
        // Pure white-hot pinch at Mach diamond centers & nozzle core
        col += vec3(0.96, 0.99, 1.0) * (shockDiamonds * 0.52 + throatCore * 0.42 * uCoreBias);

        float density = (0.44 + 0.62 * turbulence + shockDiamonds * 0.72 + throatCore * 0.55);
        float alpha = nozzleFade * tailDissolve * fresnelSoft * density;
        alpha = clamp(alpha * (0.72 + 0.38 * uBoost) * mix(0.9, 1.12, uCoreBias), 0.0, 1.0);

        if (alpha < 0.008) discard;
        gl_FragColor = vec4(col * uIntensity * (0.95 + 0.48 * uBoost), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * Custom GLSL Polar Aurora Curtain Shader for Cryos's magnetic poles.
 * Generates undulating emerald-green to cyan-teal curtains with animated vertical ray striations.
 */
export function createAuroraCurtainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1.05 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float angle = uv.x * 6.2831853;
        // Organic sinusoidal ribbon undulation along the polar ring
        float sway =
          sin(angle * 3.0 + uTime * 0.55) * 0.075 +
          cos(angle * 5.0 - uTime * 0.42) * 0.045 +
          sin(angle * 8.0 + uTime * 0.78) * 0.022;
        float heightFactor = smoothstep(0.0, 0.85, uv.y);
        pos.xz *= (1.0 + sway * (0.4 + 0.9 * heightFactor));
        pos.y += sin(angle * 4.0 + uTime * 0.48) * 0.04 * heightFactor;

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        float angle = vUv.x * 6.2831853;
        // Shimmering vertical ionization curtain rays
        float rays1 = 0.5 + 0.5 * sin(angle * 17.0 + uTime * 1.15 + sin(angle * 5.0 - uTime * 0.4) * 2.2);
        float rays2 = 0.5 + 0.5 * sin(angle * 31.0 - uTime * 1.55 + cos(angle * 7.0 + uTime * 0.6) * 1.8);
        float curtain = 0.22 + 0.78 * pow(rays1 * 0.62 + rays2 * 0.38, 1.45);

        // Bright lower emission edge fading softly upwards into high altitude teal-violet
        float vBottom = smoothstep(0.0, 0.18, vUv.y);
        float vTop = pow(max(0.0, 1.0 - vUv.y), 1.25);
        float vMask = vBottom * vTop;

        // Soft grazing angle modulation so curtains read brightly from orbital angles
        float viewGrazing = 0.48 + 0.52 * pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 0.55);

        // Vivid Aurora spectral gradient: luminous emerald-mint base -> icy cyan mid -> soft violet crest
        vec3 baseEmerald = vec3(0.24, 1.38, 0.78);
        vec3 midCyan = vec3(0.16, 1.05, 1.32);
        vec3 topViolet = vec3(0.62, 0.42, 1.18);

        vec3 col = mix(baseEmerald, midCyan, smoothstep(0.12, 0.62, vUv.y));
        col = mix(col, topViolet, smoothstep(0.58, 0.96, vUv.y) * 0.72);

        float alpha = clamp(curtain * vMask * viewGrazing * uOpacity, 0.0, 1.0);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col * (1.05 + curtain * 0.55), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
