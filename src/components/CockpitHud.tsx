import React from 'react';
import {
  Coins,
  Eye,
  Pause,
  Rocket,
  RotateCw,
  ShieldAlert,
  Video,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import type { HudSnapshot } from '../game/engine';

interface CockpitHudProps {
  hud: HudSnapshot;
  isTouchLayout: boolean;
  hpBarRef: React.RefObject<HTMLDivElement | null>;
  hpGhostRef: React.RefObject<HTMLDivElement | null>;
  shieldBarRef: React.RefObject<HTMLDivElement | null>;
  boostBarRef: React.RefObject<HTMLDivElement | null>;
  bossHpBarRef: React.RefObject<HTMLDivElement | null>;
  waypointRef: React.RefObject<HTMLDivElement | null>;
  waypointArrowRef: React.RefObject<HTMLDivElement | null>;
  waypointLabelRef: React.RefObject<HTMLSpanElement | null>;
  waypointDistRef: React.RefObject<HTMLSpanElement | null>;
  damageVignetteRef: React.RefObject<HTMLDivElement | null>;
  crosshairRef: React.RefObject<HTMLDivElement | null>;
  hitmarkerRef: React.RefObject<SVGSVGElement | null>;
  lockOnRef: React.RefObject<HTMLDivElement | null>;
  lockOnRingRef: React.RefObject<SVGSVGElement | null>;
  lockOnLabelRef: React.RefObject<HTMLSpanElement | null>;
  leadRef: React.RefObject<HTMLDivElement | null>;
  leadLineRef: React.RefObject<SVGLineElement | null>;
  radarCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  missileReloadRef: React.RefObject<HTMLDivElement | null>;
  dodgeBarRef: React.RefObject<HTMLDivElement | null>;
  onPause: () => void;
  onOpenHangar: () => void;
  onToggleCamera: () => void;
  onToggleMute: () => void;
}

export const CockpitHud: React.FC<CockpitHudProps> = ({
  hud,
  isTouchLayout,
  hpBarRef,
  hpGhostRef,
  shieldBarRef,
  boostBarRef,
  bossHpBarRef,
  waypointRef,
  waypointArrowRef,
  waypointLabelRef,
  waypointDistRef,
  damageVignetteRef,
  crosshairRef,
  hitmarkerRef,
  lockOnRef,
  lockOnRingRef,
  lockOnLabelRef,
  leadRef,
  leadLineRef,
  radarCanvasRef,
  missileReloadRef,
  dodgeBarRef,
  onPause,
  onOpenHangar,
  onToggleCamera,
  onToggleMute,
}) => {
  const lowHp = hud.hp <= hud.maxHp * 0.3;
  const bossActive = hud.bossStatus === 'active';
  const isCockpit = hud.cameraMode === 'cockpit';
  const dodgeReady = !hud.dodgeActive && hud.dodgeCooldownRatio <= 0.01;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Minimalist Sci-Fi Pilot Helmet & Curved Glass Canopy Overlay (First-Person Cockpit View) */}
      {isCockpit && (
        <div
          data-testid="cockpit-frame"
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
        >
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <defs>
              <linearGradient id="canopySheenL" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.085" />
                <stop offset="42%" stopColor="#38bdf8" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="canopySheenR" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.065" />
                <stop offset="46%" stopColor="#38bdf8" stopOpacity="0.015" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="visorArcSpec" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                <stop offset="28%" stopColor="#bae6fd" stopOpacity="0.22" />
                <stop offset="50%" stopColor="#f0f9ff" stopOpacity="0.32" />
                <stop offset="72%" stopColor="#bae6fd" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="visorSideGlowL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="visorSideGlowR" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="strutMetal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.86" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.94" />
              </linearGradient>
            </defs>

            {/* Delicate curved helmet visor edge sheen (zero central flight obstruction) */}
            <polygon points="0,0 310,0 120,340 0,240" fill="url(#canopySheenL)" />
            <polygon points="1440,0 1130,0 1320,340 1440,240" fill="url(#canopySheenR)" />
            <rect x="0" y="130" width="90" height="620" fill="url(#visorSideGlowL)" />
            <rect x="1350" y="130" width="90" height="620" fill="url(#visorSideGlowR)" />

            {/* Subtle curved optical canopy glass reflection arcs */}
            <path
              d="M 190,62 Q 720,24 1250,62"
              fill="none"
              stroke="url(#visorArcSpec)"
              strokeWidth="1.4"
            />
            <path
              d="M 280,76 Q 720,44 1160,76"
              fill="none"
              stroke="url(#visorArcSpec)"
              strokeOpacity="0.45"
              strokeWidth="0.9"
            />
            <path
              d="M 96,210 Q 62,450 116,695"
              fill="none"
              stroke="#bae6fd"
              strokeOpacity="0.14"
              strokeWidth="1.1"
            />
            <path
              d="M 1344,210 Q 1378,450 1324,695"
              fill="none"
              stroke="#bae6fd"
              strokeOpacity="0.14"
              strokeWidth="1.1"
            />

            {/* Upper angled jet-fighter canopy arch bow */}
            <path
              d="M 0,132 L 155,34 L 460,12 L 980,12 L 1285,34 L 1440,132 L 1440,0 L 0,0 Z"
              fill="url(#strutMetal)"
            />
            <polyline
              points="0,134 155,36 460,14 980,14 1285,36 1440,134"
              fill="none"
              stroke="#7dd3fc"
              strokeOpacity="0.34"
              strokeWidth="1.2"
            />

            {/* Sleek side canopy ribs framing peripheral edges */}
            <path
              d="M 0,132 L 24,142 L 74,735 L 265,900 L 0,900 Z"
              fill="url(#strutMetal)"
              fillOpacity="0.72"
            />
            <polyline
              points="24,142 74,735 265,900"
              fill="none"
              stroke="#7dd3fc"
              strokeOpacity="0.26"
              strokeWidth="1.1"
            />

            <path
              d="M 1440,132 L 1416,142 L 1366,735 L 1175,900 L 1440,900 Z"
              fill="url(#strutMetal)"
              fillOpacity="0.72"
            />
            <polyline
              points="1416,142 1366,735 1175,900"
              fill="none"
              stroke="#7dd3fc"
              strokeOpacity="0.26"
              strokeWidth="1.1"
            />

            {/* Subtle lower nose cowling lip */}
            <path
              d="M 250,900 L 420,862 L 1020,862 L 1190,900 Z"
              fill="#020617"
              fillOpacity="0.82"
            />
            <polyline
              points="265,900 420,863 1020,863 1175,900"
              fill="none"
              stroke="#7dd3fc"
              strokeOpacity="0.28"
              strokeWidth="1.2"
            />

            {/* Minimalist curved helmet-mounted flight-path pitch ladder & lateral brackets */}
            <g stroke="#7dd3fc" strokeOpacity="0.28" strokeWidth="1.15" fill="none">
              <path d="M 555,450 L 625,450 L 625,462" />
              <path d="M 885,450 L 815,450 L 815,462" />
              <line x1="635" y1="395" x2="665" y2="395" />
              <line x1="775" y1="395" x2="805" y2="395" />
              <line x1="635" y1="505" x2="665" y2="505" />
              <line x1="775" y1="505" x2="805" y2="505" />
            </g>
          </svg>
        </div>
      )}

      {/* Peripheral damage & critical low HP vignette */}
      <div
        ref={damageVignetteRef}
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          opacity: lowHp ? 0.38 : 0,
          background:
            'radial-gradient(circle at center, rgba(0,0,0,0) 56%, rgba(239, 68, 68, 0.55) 100%)',
        }}
      />

      {/* Dynamic center sci-fi crosshair (expands smoothly on fire) + combat hitmarker */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          ref={crosshairRef}
          data-testid="dynamic-crosshair"
          className="will-change-transform flex items-center justify-center"
          style={{ transform: 'scale(1)' }}
        >
          <svg
            viewBox="0 0 56 56"
            className="w-12 h-12 sm:w-14 sm:h-14 opacity-85 drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]"
          >
            <path d="M12 18 L12 12 L18 12" fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="square" />
            <path d="M38 12 L44 12 L44 18" fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="square" />
            <path d="M44 38 L44 44 L38 44" fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="square" />
            <path d="M18 44 L12 44 L12 38" fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="square" />
            <circle cx="28" cy="28" r="11" fill="none" stroke="#38bdf8" strokeOpacity="0.6" strokeWidth="1.1" strokeDasharray="4 5" />
            <line x1="28" y1="7" x2="28" y2="14" stroke="#e0f2fe" strokeWidth="1.5" />
            <line x1="28" y1="42" x2="28" y2="49" stroke="#e0f2fe" strokeWidth="1.5" />
            <line x1="7" y1="28" x2="14" y2="28" stroke="#e0f2fe" strokeWidth="1.5" />
            <line x1="42" y1="28" x2="49" y2="28" stroke="#e0f2fe" strokeWidth="1.5" />
          </svg>
        </div>

        <span className="absolute w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8]" />

        <svg
          ref={hitmarkerRef}
          data-testid="combat-hitmarker"
          viewBox="0 0 40 40"
          className="absolute w-9 h-9 will-change-transform"
          style={{ opacity: 0, color: '#fbbf24' }}
        >
          <line x1="8" y1="8" x2="15.5" y2="15.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="32" y1="8" x2="24.5" y2="15.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="8" y1="32" x2="15.5" y2="24.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="32" y1="32" x2="24.5" y2="24.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Anti-Nyasar Screen-Space Waypoint Indicator */}
      <div
        ref={waypointRef}
        data-testid="planet-waypoint"
        className="fixed top-0 left-0 pointer-events-none will-change-transform flex flex-col items-center"
        style={{ transform: 'translate3d(-999px, -999px, 0)' }}
      >
        <div ref={waypointArrowRef} className="flex items-center justify-center w-8 h-8">
          <svg viewBox="0 0 28 28" className="w-7 h-7 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
            <polygon
              points="24,14 6,5 11,14 6,23"
              fill={bossActive ? '#fb7185' : '#38bdf8'}
              stroke="#040710"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="mt-0.5 px-2.5 py-0.5 rounded-md hud-plate text-center whitespace-nowrap">
          <span
            ref={waypointLabelRef}
            className="block text-[11px] font-display font-bold tracking-wide text-sky-200 leading-tight"
          >
            {hud.nearestPlanetName}
          </span>
          <span
            ref={waypointDistRef}
            className="block text-[10px] font-mono-hud text-slate-300 leading-tight"
          >
            {hud.nearestPlanetDistance} m
          </span>
        </div>
      </div>

      {/* Ballistic Target Lead Tether SVG (connects locked hostile to predicted intercept pip) */}
      <svg
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none"
      >
        <line
          ref={leadLineRef}
          x1="-10"
          y1="-10"
          x2="-10"
          y2="-10"
          stroke="#fbbf24"
          strokeOpacity="0"
          strokeWidth="1.2"
          strokeDasharray="3 4"
        />
      </svg>

      {/* Ballistic Target Lead Intercept Ring */}
      <div
        ref={leadRef}
        data-testid="lead-indicator"
        aria-hidden="true"
        className="fixed top-0 left-0 pointer-events-none will-change-transform flex items-center justify-center"
        style={{ opacity: 0, transform: 'translate3d(-999px, -999px, 0)' }}
      >
        <svg viewBox="0 0 28 28" className="w-6 h-6 drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]">
          <circle
            cx="14"
            cy="14"
            r="9.5"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeDasharray="4 3"
          />
          <circle cx="14" cy="14" r="2.2" fill="#fef08a" />
        </svg>
      </div>

      {/* Rotating Homing Missile Target Lock-On Reticle */}
      <div
        ref={lockOnRef}
        data-testid="lockon-reticle"
        aria-hidden="true"
        className="fixed top-0 left-0 pointer-events-none will-change-transform flex flex-col items-center"
        style={{ opacity: 0, transform: 'translate3d(-999px, -999px, 0)' }}
      >
        <svg
          ref={lockOnRingRef}
          viewBox="0 0 72 72"
          className="w-16 h-16 will-change-transform drop-shadow-[0_0_10px_rgba(251,113,133,0.6)]"
          style={{ color: '#fbbf24' }}
        >
          <path d="M10 22 L10 10 L22 10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
          <path d="M50 10 L62 10 L62 22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
          <path d="M62 50 L62 62 L50 62" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
          <path d="M22 62 L10 62 L10 50" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
          <polygon
            points="36,4 40,11 32,11"
            fill="currentColor"
            fillOpacity="0.85"
          />
          <polygon
            points="36,68 40,61 32,61"
            fill="currentColor"
            fillOpacity="0.85"
          />
          <circle
            cx="36"
            cy="36"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.48"
            strokeWidth="1.2"
            strokeDasharray="6 4"
          />
        </svg>
        <span
          ref={lockOnLabelRef}
          className="mt-0.5 px-2 py-0.5 rounded bg-[#040710]/85 border border-amber-400/55 font-mono-hud text-[10px] font-bold tracking-wider uppercase text-amber-300 whitespace-nowrap"
        >
          LOCKING
        </span>
      </div>

      {/* TOP-LEFT CORNER CLUSTER: Score, Coins, Scanned Planets (0/6), Nearest Target */}
      <div className="fixed top-3 left-3 sm:top-5 sm:left-5 flex flex-col gap-1.5 max-w-[64vw]">
        <div className="hud-plate rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-4">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-sky-300/70 rounded-tl-xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-sky-300/70 rounded-br-xl"
          />
          <div>
            <div className="text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase text-slate-400">
              Skor
            </div>
            <div
              data-testid="hud-score"
              className="font-mono-hud text-lg sm:text-xl font-bold text-slate-50 hud-text-shadow leading-none mt-0.5"
            >
              {hud.score.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="h-7 w-px bg-sky-400/20" aria-hidden="true" />

          <div>
            <div className="text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1">
              <Coins className="w-3 h-3 text-amber-300" />
              <span>Koin</span>
            </div>
            <div
              data-testid="hud-coins"
              className="font-mono-hud text-lg sm:text-xl font-bold text-amber-300 hud-text-shadow leading-none mt-0.5"
            >
              {hud.coins.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="h-7 w-px bg-sky-400/20" aria-hidden="true" />

          <div>
            <div className="text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase text-slate-400">
              Planet
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                data-testid="hud-planets"
                className="font-mono-hud text-lg sm:text-xl font-bold text-sky-300 hud-text-shadow leading-none"
              >
                {hud.scannedCount}/{hud.totalPlanets}
              </span>
              <div className="hidden md:flex items-center gap-1" aria-label="Status pemindaian 6 planet">
                {hud.planetStatuses.map((p) => (
                  <span
                    key={p.id}
                    title={p.name}
                    className="block w-2 h-2 rounded-xs border"
                    style={{
                      backgroundColor: p.scanned ? '#34d399' : 'rgba(15, 23, 42, 0.8)',
                      borderColor: p.scanned ? '#34d399' : p.accentHex,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-1 text-xs sm:text-sm text-slate-200 hud-text-shadow flex items-center gap-2">
          <span className="text-slate-400">{bossActive ? 'Target:' : 'Terdekat:'}</span>
          <span
            data-testid="hud-nearest-planet"
            className="font-display font-bold tracking-wide"
            style={{ color: hud.nearestPlanetAccent }}
          >
            {hud.nearestPlanetName}
          </span>
          <span aria-hidden="true" className="text-slate-500">·</span>
          <span className="font-mono-hud text-slate-300">{hud.nearestPlanetDistance} m</span>
        </div>
      </div>

      {/* TOP-RIGHT UTILITY CONTROLS: Camera [C], Hangar [H], Mute [M], Pause [P] */}
      <div className="fixed top-3 right-3 sm:top-5 sm:right-5 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          data-testid="hud-camera-btn"
          aria-pressed={isCockpit}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleCamera();
          }}
          aria-label={isCockpit ? 'Ganti ke Kamera Luar (C)' : 'Ganti ke Kamera Kokpit (C)'}
          title="Ganti Kamera Kokpit / Luar (C)"
          className={`${
            isCockpit ? 'hud-plate-accent text-sky-200 border-sky-400/70' : 'hud-plate text-slate-200'
          } flex items-center justify-center gap-1.5 h-10 sm:h-11 px-2.5 sm:px-3 rounded-lg hover:text-sky-300 hover:border-sky-400/55 transition-colors cursor-pointer`}
        >
          {isCockpit ? <Eye className="w-4 h-4 text-sky-300" /> : <Video className="w-4 h-4" />}
          <span className="hidden md:inline font-display font-bold text-xs tracking-wider uppercase">
            {isCockpit ? 'Kokpit' : '3P'}
          </span>
          <span className="hidden lg:inline font-mono-hud text-[10px] text-sky-300/80">[C]</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          data-testid="hud-hangar-btn"
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenHangar();
          }}
          aria-label="Buka Hangar Upgrade (H)"
          title="Hangar Upgrade (H)"
          className="hud-plate-accent flex items-center justify-center gap-1.5 h-10 sm:h-11 px-3 sm:px-3.5 rounded-lg text-sky-200 hover:text-amber-300 hover:border-amber-300/60 transition-colors cursor-pointer"
        >
          <Wrench className="w-4 h-4" />
          <span className="hidden sm:inline font-display font-bold text-xs tracking-wider uppercase">
            Hangar
          </span>
          <span className="hidden md:inline font-mono-hud text-[10px] text-sky-300/80">[H]</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={hud.muted ? 'Nyalakan suara' : 'Matikan suara'}
          title="Suara (M)"
          className="hud-plate flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg text-slate-200 hover:text-sky-300 hover:border-sky-400/50 transition-colors cursor-pointer"
        >
          {hud.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          aria-label="Jeda permainan"
          title="Jeda (P / Esc)"
          className="hud-plate flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg text-slate-200 hover:text-sky-300 hover:border-sky-400/50 transition-colors cursor-pointer"
        >
          <Pause className="w-5 h-5" />
        </button>
      </div>

      {/* COMPACT MOBILE HOLOGRAPHIC 3D RADAR (top-right below utility buttons, zero overlap) */}
      {isTouchLayout && (
        <div
          data-testid="holo-radar"
          className="fixed top-[58px] right-3 w-[104px] h-[82px] rounded-xl bg-[#040b18]/72 border border-sky-400/40 overflow-hidden shadow-[0_0_16px_rgba(14,165,233,0.18)]"
        >
          <span className="absolute top-1 left-1.5 font-mono-hud text-[8px] font-bold tracking-widest uppercase text-sky-300/80 pointer-events-none">
            RADAR 3D
          </span>
          <canvas ref={radarCanvasRef} className="w-full h-full block" />
        </div>
      )}

      {/* UPPER-CENTER BOSS HEALTH BAR, SCANNER INDICATOR, LOCK NOTICE, OR EVENT BANNER */}
      <div
        className={`fixed ${
          isTouchLayout ? 'top-[146px]' : 'top-5'
        } left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-[min(420px,90vw)]`}
      >
        {bossActive && (
          <div
            data-testid="boss-health-bar"
            className="hud-plate-accent w-full rounded-xl px-4 py-2.5"
            style={{
              borderColor: hud.bossPhase === 2 ? 'rgba(251, 113, 133, 0.72)' : 'rgba(251, 146, 60, 0.62)',
            }}
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`w-4 h-4 ${hud.bossPhase === 2 ? 'text-rose-400' : 'text-amber-400'}`}
                />
                <span className="font-display font-bold tracking-wider uppercase text-slate-100">
                  Dreadnought · Fase {hud.bossPhase}
                </span>
              </div>
              <span className="font-mono-hud font-bold text-rose-300">
                {hud.bossHp}/{hud.bossMaxHp}
              </span>
            </div>
            <div className="relative h-3 w-full rounded-sm bg-slate-950/90 overflow-hidden border border-rose-500/35">
              <div
                ref={bossHpBarRef}
                className={`absolute inset-0 origin-left ${
                  hud.bossPhase === 2
                    ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400'
                    : 'bg-gradient-to-r from-orange-600 via-amber-500 to-amber-300'
                }`}
                style={{ transform: `scaleX(${Math.max(0, hud.bossHp / hud.bossMaxHp)})` }}
              />
              {/* 50% Phase 2 Threshold Marker */}
              <div
                aria-hidden="true"
                className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-950/80"
              />
            </div>
          </div>
        )}

        {hud.scanningPlanetName && (
          <div
            data-testid="scanning-indicator"
            className="hud-plate-accent w-full rounded-xl px-4 py-2.5"
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-display font-bold tracking-wide text-sky-200">
                Scanning Planet... {hud.scanningPlanetName}
              </span>
              <span className="font-mono-hud font-bold text-sky-300">
                {hud.scanningProgress}%
              </span>
            </div>
            <div className="h-2 w-full rounded-sm bg-slate-900/90 overflow-hidden border border-sky-400/25">
              <div
                className="h-full bg-sky-400 transition-[width] duration-100"
                style={{ width: `${hud.scanningProgress}%` }}
              />
            </div>
          </div>
        )}

        {hud.scanLockedMessage && !hud.scanningPlanetName && (
          <div className="hud-plate rounded-lg px-4 py-1.5 text-xs font-medium text-center text-rose-300 border-rose-400/45 hud-text-shadow">
            {hud.scanLockedMessage}
          </div>
        )}

        {hud.bannerText && !hud.scanningPlanetName && !hud.scanLockedMessage && (
          <div
            className="hud-plate rounded-lg px-4 py-1.5 text-xs sm:text-sm font-display font-bold tracking-wide text-center hud-text-shadow"
            style={{ color: hud.bannerAccent, borderColor: `${hud.bannerAccent}66` }}
          >
            {hud.bannerText}
          </div>
        )}
      </div>

      {/* BOTTOM COCKPIT VITALS: SHIELD (when unlocked), HP & BOOST BARS */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 sm:left-5 sm:translate-x-0 ${
          isTouchLayout ? 'bottom-[178px] w-[min(320px,90vw)]' : 'bottom-5 w-[295px]'
        }`}
      >
        <div className="hud-plate rounded-xl px-3.5 py-2.5 space-y-2">
          {/* Energy Shield Bar (visible when Hull & Shield >= Lv.2) */}
          {hud.maxShield > 0 && (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-semibold tracking-wider uppercase text-sky-300">
                  Perisai Energi
                </span>
                <span data-testid="hud-shield" className="font-mono-hud font-bold text-sky-300">
                  {hud.shield}/{hud.maxShield}
                </span>
              </div>
              <div className="relative h-2 w-full rounded-xs bg-slate-900 overflow-hidden border border-sky-400/35">
                <div
                  ref={shieldBarRef}
                  className="absolute inset-0 origin-left bg-gradient-to-r from-sky-500 to-cyan-300"
                  style={{ transform: `scaleX(${hud.shield / Math.max(1, hud.maxShield)})` }}
                />
              </div>
            </div>
          )}

          {/* HP Bar with trailing damage ghost bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold tracking-wider uppercase text-slate-300">
                Lambung (HP)
              </span>
              <span
                data-testid="hud-hp"
                className={`font-mono-hud font-bold ${
                  lowHp ? 'text-rose-400' : 'text-emerald-300'
                }`}
              >
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
            <div className="relative h-2.5 w-full rounded-xs bg-slate-900 overflow-hidden border border-slate-700/80">
              <div
                ref={hpGhostRef}
                className="absolute inset-0 bg-rose-400/70 origin-left transition-transform duration-500 ease-out"
                style={{ transform: `scaleX(${hud.hp / Math.max(1, hud.maxHp)})` }}
              />
              <div
                ref={hpBarRef}
                className={`absolute inset-0 origin-left ${
                  lowHp ? 'bg-rose-500' : 'bg-emerald-400'
                }`}
                style={{ transform: `scaleX(${hud.hp / Math.max(1, hud.maxHp)})` }}
              />
            </div>
          </div>

          {/* Boost Energy Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold tracking-wider uppercase text-slate-300">
                Energi Boost
              </span>
              <span
                data-testid="hud-boost"
                className={`font-mono-hud font-bold ${
                  hud.isBoosting ? 'text-amber-300' : 'text-sky-300'
                }`}
              >
                {Math.round((hud.boost / Math.max(1, hud.maxBoost)) * 100)}%
              </span>
            </div>
            <div className="relative h-2 w-full rounded-xs bg-slate-900 overflow-hidden border border-slate-700/80">
              <div
                ref={boostBarRef}
                className={`absolute inset-0 origin-left ${
                  hud.isBoosting ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ transform: `scaleX(${hud.boost / Math.max(1, hud.maxBoost)})` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM-RIGHT HOLOGRAPHIC 3D RADAR & TACTICAL WEAPONS/DODGE CLUSTER (Desktop) */}
      {!isTouchLayout && (
        <div className="fixed bottom-5 right-5 flex flex-col items-end gap-2.5">
          {/* Transparent 3D Holographic Radar */}
          <div
            data-testid="holo-radar"
            className="relative w-[166px] h-[126px] rounded-xl bg-[#040b18]/72 border border-sky-400/40 overflow-hidden shadow-[0_0_22px_rgba(14,165,233,0.16)]"
          >
            <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
              <span className="font-mono-hud text-[9px] font-bold tracking-widest uppercase text-sky-300/85">
                RADAR 3D
              </span>
              <span className="font-mono-hud text-[9px] text-slate-400">820m</span>
            </div>
            <canvas ref={radarCanvasRef} className="w-full h-full block" />
          </div>

          {/* Tactical Card: Weapon Tier, Speedometer, Homing Missiles [E] & Barrel Roll [Q] */}
          <div className="hud-plate rounded-xl px-3.5 py-2.5 w-[238px] space-y-2">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-sky-300/70 rounded-tr-xl"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-sky-300/70 rounded-bl-xl"
            />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-sky-300/90 hud-text-shadow truncate">
                Lv.{hud.upgradeStats.weaponLevel} {hud.upgradeStats.weaponLabel}
              </span>
              <div className="flex items-baseline gap-1 shrink-0">
                <span
                  className={`font-mono-hud text-lg font-bold hud-text-shadow leading-none ${
                    hud.isBoosting ? 'text-amber-300' : 'text-slate-100'
                  }`}
                >
                  {hud.speedKmh}
                </span>
                <span className="text-[9px] text-slate-400 font-mono-hud">KM/J</span>
              </div>
            </div>

            {/* Homing Missiles Magazine & Auto-Reload */}
            <div data-testid="hud-missiles">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="flex items-center gap-1 font-semibold tracking-wider uppercase text-amber-300">
                  <Rocket className="w-3 h-3" />
                  <span>Rudal [E]</span>
                </span>
                <span className="font-mono-hud font-bold text-amber-200">
                  {hud.missileAmmo}/{hud.missileMaxAmmo}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: hud.missileMaxAmmo }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-xs transition-colors ${
                      i < hud.missileAmmo
                        ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.55)]'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-1 h-1 w-full rounded-xs bg-slate-900 overflow-hidden">
                <div
                  ref={missileReloadRef}
                  className="h-full origin-left bg-amber-300/80"
                  style={{ transform: `scaleX(${hud.missileReloadRatio})` }}
                />
              </div>
            </div>

            {/* Barrel Roll / Dodge Cooldown Indicator */}
            <div data-testid="hud-dodge">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="flex items-center gap-1 font-semibold tracking-wider uppercase text-cyan-300">
                  <RotateCw className={`w-3 h-3 ${hud.dodgeActive ? 'animate-spin' : ''}`} />
                  <span>Barrel Roll [Q]</span>
                </span>
                <span
                  className={`font-mono-hud font-bold ${
                    hud.dodgeActive
                      ? 'text-cyan-200'
                      : dodgeReady
                      ? 'text-emerald-300'
                      : 'text-slate-400'
                  }`}
                >
                  {hud.dodgeActive ? 'AKTIF' : dodgeReady ? 'SIAP' : 'PULIH'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-xs bg-slate-900 overflow-hidden border border-cyan-500/25">
                <div
                  ref={dodgeBarRef}
                  className={`h-full origin-left ${
                    hud.dodgeActive
                      ? 'bg-cyan-300'
                      : dodgeReady
                      ? 'bg-emerald-400'
                      : 'bg-cyan-500/75'
                  }`}
                  style={{ transform: `scaleX(${1 - hud.dodgeCooldownRatio})` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
