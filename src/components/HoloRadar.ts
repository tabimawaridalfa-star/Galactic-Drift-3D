export interface RadarPlanetBlip {
  rx: number;
  rz: number;
  alt: number;
  color: string;
  scanned: boolean;
  clamped: boolean;
}

export interface RadarHostileBlip {
  rx: number;
  rz: number;
  alt: number;
}

export interface RadarBossBlip {
  rx: number;
  rz: number;
  alt: number;
  phase: 1 | 2;
}

export interface RadarFrameData {
  planets: RadarPlanetBlip[];
  drones: RadarHostileBlip[];
  boss: RadarBossBlip | null;
  sweepAngle: number;
}

/**
 * Pure Canvas2D tilted 3D holographic radar renderer updated directly at 60 FPS
 * via DOM ref (zero React re-renders, zero backdrop-filter cost).
 */
export function drawHoloRadar(canvas: HTMLCanvasElement, data: RadarFrameData): void {
  const cssW = canvas.clientWidth || 136;
  const cssH = canvas.clientHeight || 112;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const cx = cssW * 0.5;
  const cy = cssH * 0.6;
  const radiusX = Math.min(cssW * 0.42, cssH * 0.48);
  const tiltY = 0.6;
  const radiusY = radiusX * tiltY;
  const maxStalkPx = Math.max(9, cssH * 0.15);

  // Soft radial hologram disc fill
  const discGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radiusX);
  discGrad.addColorStop(0, 'rgba(14, 165, 233, 0.22)');
  discGrad.addColorStop(0.68, 'rgba(7, 22, 46, 0.68)');
  discGrad.addColorStop(1, 'rgba(3, 10, 24, 0.84)');

  ctx.beginPath();
  ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = discGrad;
  ctx.fill();

  // Concentric 3D perspective range rings
  for (const frac of [0.35, 0.68, 1.0]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX * frac, radiusY * frac, 0, 0, Math.PI * 2);
    ctx.strokeStyle =
      frac === 1.0 ? 'rgba(56, 189, 248, 0.58)' : 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = frac === 1.0 ? 1.35 : 0.9;
    ctx.stroke();
  }

  // Forward heading cone (+N / nose-up sector)
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - radiusX * 0.36, cy - radiusY * 0.92);
  ctx.lineTo(cx + radiusX * 0.36, cy - radiusY * 0.92);
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.09)';
  ctx.fill();

  // Crosshair grid axes
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(cx - radiusX, cy);
  ctx.lineTo(cx + radiusX, cy);
  ctx.moveTo(cx, cy - radiusY);
  ctx.lineTo(cx, cy + radiusY);
  ctx.stroke();

  // Sweeping holographic scanner beam
  const sweepA = data.sweepAngle;
  const beamEndX = cx + Math.cos(sweepA) * radiusX;
  const beamEndY = cy + Math.sin(sweepA) * radiusY;
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.52)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(beamEndX, beamEndY);
  ctx.stroke();

  // Subtle trailing sweep wedge
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const trailSteps = 6;
  for (let i = 0; i <= trailSteps; i++) {
    const a = sweepA - (i / trailSteps) * 0.55;
    ctx.lineTo(cx + Math.cos(a) * radiusX, cy + Math.sin(a) * radiusY);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.11)';
  ctx.fill();

  // Helper: draw 3D vertical altitude stalk from base disc to floating blip
  const projectPoint = (rx: number, rz: number, alt: number) => {
    const bx = cx + rx * radiusX;
    const by = cy + rz * radiusY;
    const py = by - alt * maxStalkPx;
    return { bx, by, py };
  };

  // 1. Plot all 6 planets with accent colors & emerald scanned checkmarks
  for (let i = 0; i < data.planets.length; i++) {
    const p = data.planets[i];
    const { bx, by, py } = projectPoint(p.rx, p.rz, p.alt);
    const col = p.scanned ? '#34d399' : p.color;

    // Base foot shadow & 3D altitude stalk
    if (Math.abs(py - by) > 1.5) {
      ctx.strokeStyle = p.scanned ? 'rgba(52, 211, 153, 0.45)' : 'rgba(148, 163, 184, 0.42)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, py);
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Planet orb
    const r = p.clamped ? 3.2 : 4.2;
    ctx.beginPath();
    ctx.arc(bx, py, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Scanned emerald checkmark overlay
    if (p.scanned) {
      ctx.strokeStyle = '#ecfdf5';
      ctx.lineWidth = 1.35;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bx - 2.1, py + 0.1);
      ctx.lineTo(bx - 0.5, py + 1.8);
      ctx.lineTo(bx + 2.3, py - 1.7);
      ctx.stroke();
    }
  }

  // 2. Plot enemy drones as crisp glowing crimson dots with vertical altitude stalks
  for (let i = 0; i < data.drones.length; i++) {
    const d = data.drones[i];
    const { bx, by, py } = projectPoint(d.rx, d.rz, d.alt);

    if (Math.abs(py - by) > 1.2) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, py);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(bx, py, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = '#fb7185';
    ctx.fill();
  }

  // 3. Plot Dreadnought Boss as a prominent pulsing crimson/gold diamond skull-core
  if (data.boss) {
    const b = data.boss;
    const { bx, by, py } = projectPoint(b.rx, b.rz, b.alt);
    const pulse = 0.5 + 0.5 * Math.sin(data.sweepAngle * 4);
    const bossCol = b.phase === 2 ? '#fb7185' : '#f97316';

    if (Math.abs(py - by) > 1.5) {
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.72)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, py);
      ctx.stroke();
    }

    // Outer threat pulse ring
    ctx.beginPath();
    ctx.arc(bx, py, 6.2 + pulse * 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = b.phase === 2 ? 'rgba(251, 113, 133, 0.72)' : 'rgba(251, 146, 60, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Crimson diamond hull icon
    const sz = 5.4;
    ctx.beginPath();
    ctx.moveTo(bx, py - sz);
    ctx.lineTo(bx + sz, py);
    ctx.lineTo(bx, py + sz);
    ctx.lineTo(bx - sz, py);
    ctx.closePath();
    ctx.fillStyle = bossCol;
    ctx.fill();
    ctx.strokeStyle = '#fff1f2';
    ctx.lineWidth = 1.15;
    ctx.stroke();

    // Inner threat dot
    ctx.beginPath();
    ctx.arc(bx, py, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();
  }

  // 4. Center player starfighter forward chevron (always pointing up = ship heading)
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5.2);
  ctx.lineTo(cx + 4.0, cy + 3.4);
  ctx.lineTo(cx, cy + 1.4);
  ctx.lineTo(cx - 4.0, cy + 3.4);
  ctx.closePath();
  ctx.fillStyle = '#e0f2fe';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}
