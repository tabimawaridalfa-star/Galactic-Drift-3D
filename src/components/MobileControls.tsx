import React, { useRef, useState } from 'react';
import { Crosshair, Rocket, RotateCw, Zap } from 'lucide-react';
import type { MobileInputState } from '../game/engine';

interface MobileControlsProps {
  missileAmmo: number;
  dodgeReady: boolean;
  onChange: (partial: Partial<MobileInputState>) => void;
  onFireMissile: () => void;
  onDodge: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  missileAmmo,
  dodgeReady,
  onChange,
  onFireMissile,
  onDodge,
}) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [firing, setFiring] = useState(false);
  const [boosting, setBoosting] = useState(false);

  const maxRadius = 40;

  const updateStickFromEvent = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    onChange({
      steerX: dx / maxRadius,
      steerY: -dy / maxRadius,
    });
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onChange({ steerX: 0, steerY: 0 });
  };

  return (
    <div
      data-testid="mobile-controls"
      className="fixed inset-x-0 bottom-0 z-20 pointer-events-none flex items-end justify-between px-4 pb-5"
    >
      {/* Left: Virtual Analog Joystick */}
      <div
        ref={baseRef}
        role="application"
        aria-label="Joystick navigasi pesawat"
        onPointerDown={(e) => {
          e.stopPropagation();
          activePointerId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStickFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activePointerId.current !== e.pointerId) return;
          e.stopPropagation();
          updateStickFromEvent(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (activePointerId.current !== e.pointerId) return;
          resetStick();
        }}
        onPointerCancel={resetStick}
        className="pointer-events-auto relative w-28 h-28 rounded-full bg-[#060b16]/75 border border-sky-400/35 flex items-center justify-center touch-none"
      >
        <div className="w-12 h-12 rounded-full border border-sky-300/20 pointer-events-none" />
        <div
          className="absolute w-12 h-12 rounded-full bg-sky-400/85 border-2 border-sky-100 shadow-[0_0_16px_rgba(56,189,248,0.6)] pointer-events-none"
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        />
      </div>

      {/* Right: Ace Pilot 2-Row Combat Cluster (Roll + Rudal above Boost + Tembak) */}
      <div className="pointer-events-auto flex flex-col items-end gap-2.5">
        {/* Upper row: Barrel Roll Dodge & Homing Missile */}
        <div className="flex items-center gap-2.5 pr-1">
          <button
            type="button"
            data-testid="mobile-dodge-btn"
            aria-label="Barrel Roll Menghindar"
            onPointerDown={(e) => {
              e.stopPropagation();
              onDodge();
            }}
            className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center gap-0.5 text-[9px] font-display font-bold tracking-wide touch-none transition-colors ${
              dodgeReady
                ? 'bg-[#060b16]/85 text-cyan-300 border-cyan-400/60 active:bg-cyan-400 active:text-slate-950'
                : 'bg-[#060b16]/65 text-slate-500 border-slate-700/60'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span>ROLL</span>
          </button>

          <button
            type="button"
            data-testid="mobile-missile-btn"
            aria-label="Tembak Rudal Homing"
            onPointerDown={(e) => {
              e.stopPropagation();
              onFireMissile();
            }}
            className={`relative w-14 h-14 rounded-full border flex flex-col items-center justify-center gap-0.5 text-[10px] font-display font-bold tracking-wide touch-none transition-colors ${
              missileAmmo > 0
                ? 'bg-[#060b16]/85 text-amber-300 border-amber-400/65 active:bg-amber-400 active:text-slate-950'
                : 'bg-[#060b16]/65 text-slate-500 border-slate-700/60'
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span>RUDAL</span>
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-950 font-mono-hud text-[10px] font-bold flex items-center justify-center">
              {missileAmmo}
            </span>
          </button>
        </div>

        {/* Lower row: Turbo Boost & Primary Plasma Laser */}
        <div className="flex items-end gap-3">
          <button
            type="button"
            aria-label="Turbo Boost"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              setBoosting(true);
              onChange({ boosting: true });
            }}
            onPointerUp={() => {
              setBoosting(false);
              onChange({ boosting: false });
            }}
            onPointerCancel={() => {
              setBoosting(false);
              onChange({ boosting: false });
            }}
            className={`w-15 h-15 rounded-full border flex flex-col items-center justify-center gap-0.5 text-[10px] font-display font-bold tracking-wide touch-none transition-colors ${
              boosting
                ? 'bg-amber-400 text-slate-950 border-amber-200'
                : 'bg-[#060b16]/82 text-amber-300 border-amber-400/45'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span>BOOST</span>
          </button>

          <button
            type="button"
            aria-label="Tembak Laser"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              setFiring(true);
              onChange({ firing: true });
            }}
            onPointerUp={() => {
              setFiring(false);
              onChange({ firing: false });
            }}
            onPointerCancel={() => {
              setFiring(false);
              onChange({ firing: false });
            }}
            className={`w-20 h-20 rounded-full border flex flex-col items-center justify-center gap-0.5 text-xs font-display font-bold tracking-wide touch-none transition-colors ${
              firing
                ? 'bg-sky-400 text-slate-950 border-sky-100'
                : 'bg-[#060b16]/85 text-sky-300 border-sky-400/55'
            }`}
          >
            <Crosshair className="w-6 h-6" />
            <span>TEMBAK</span>
          </button>
        </div>
      </div>
    </div>
  );
};
