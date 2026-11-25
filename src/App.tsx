import { useEffect, useRef, useState } from 'react';
import { FastForward } from 'lucide-react';
import { CockpitHud } from './components/CockpitHud';
import { HangarModal } from './components/HangarModal';
import { drawHoloRadar } from './components/HoloRadar';
import { MobileControls } from './components/MobileControls';
import { StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import {
  GalacticDriftEngine,
  type FastOverlayFrame,
  type HudSnapshot,
} from './game/engine';
import {
  BOSS_MAX_HP,
  MAX_BOOST,
  MAX_PLAYER_HP,
  PLANET_CONFIGS,
  createInitialUpgradeLevels,
  getPlayerUpgradeStats,
} from './game/rules';

const INITIAL_UPGRADES = createInitialUpgradeLevels();

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  graphicsQuality: 'ultra',
  cameraMode: 'third-person',
  hp: MAX_PLAYER_HP,
  maxHp: MAX_PLAYER_HP,
  shield: 0,
  maxShield: 0,
  boost: MAX_BOOST,
  maxBoost: MAX_BOOST,
  score: 0,
  bestScore: 0,
  coins: 0,
  upgradeLevels: INITIAL_UPGRADES,
  upgradeStats: getPlayerUpgradeStats(INITIAL_UPGRADES),
  scannedCount: 0,
  totalPlanets: PLANET_CONFIGS.length,
  nearestPlanetName: PLANET_CONFIGS[0].name,
  nearestPlanetDistance: 219,
  nearestPlanetAccent: PLANET_CONFIGS[0].accentHex,
  scanningPlanetName: null,
  scanningProgress: 0,
  scanLockedMessage: null,
  speedKmh: 816,
  isBoosting: false,
  muted: false,
  elapsedSec: 0,
  enemiesDestroyed: 0,
  asteroidsDestroyed: 0,
  bannerText: null,
  bannerAccent: '#38bdf8',
  damageVignette: 0,
  planetStatuses: PLANET_CONFIGS.map((p) => ({
    id: p.id,
    name: p.name,
    scanned: false,
    accentHex: p.accentHex,
  })),
  bossStatus: 'dormant',
  bossHp: BOSS_MAX_HP,
  bossMaxHp: BOSS_MAX_HP,
  bossPhase: 1,
  flybyPlanetIndex: 1,
  flybyPlanetName: PLANET_CONFIGS[0].name,
  flybyPlanetSubtitle: PLANET_CONFIGS[0].subtitle,
  flybyAccentHex: PLANET_CONFIGS[0].accentHex,
  missileAmmo: 3,
  missileMaxAmmo: 3,
  missileReloadRatio: 0,
  dodgeCooldownRatio: 0,
  dodgeActive: false,
  lockedTargetName: null,
  lockedTargetFull: false,
};

function detectTouchLayout(): boolean {
  if (typeof window === 'undefined') return false;
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrow = window.innerWidth < 768;
  return hasCoarsePointer || hasTouch || isNarrow;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GalacticDriftEngine | null>(null);

  // 60fps direct-DOM HUD refs (zero React reconciliation overhead per frame)
  const hpBarRef = useRef<HTMLDivElement | null>(null);
  const hpGhostRef = useRef<HTMLDivElement | null>(null);
  const shieldBarRef = useRef<HTMLDivElement | null>(null);
  const boostBarRef = useRef<HTMLDivElement | null>(null);
  const bossHpBarRef = useRef<HTMLDivElement | null>(null);
  const waypointRef = useRef<HTMLDivElement | null>(null);
  const waypointArrowRef = useRef<HTMLDivElement | null>(null);
  const waypointLabelRef = useRef<HTMLSpanElement | null>(null);
  const waypointDistRef = useRef<HTMLSpanElement | null>(null);
  const damageVignetteRef = useRef<HTMLDivElement | null>(null);
  const crosshairRef = useRef<HTMLDivElement | null>(null);
  const hitmarkerRef = useRef<SVGSVGElement | null>(null);
  const lockOnRef = useRef<HTMLDivElement | null>(null);
  const lockOnRingRef = useRef<SVGSVGElement | null>(null);
  const lockOnLabelRef = useRef<HTMLSpanElement | null>(null);
  const leadRef = useRef<HTMLDivElement | null>(null);
  const leadLineRef = useRef<SVGLineElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const missileReloadRef = useRef<HTMLDivElement | null>(null);
  const dodgeBarRef = useRef<HTMLDivElement | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [isTouchLayout, setIsTouchLayout] = useState<boolean>(detectTouchLayout);

  useEffect(() => {
    const onResize = () => setIsTouchLayout(detectTouchLayout());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const handleFastOverlay = (frame: FastOverlayFrame) => {
      if (hpBarRef.current) {
        hpBarRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, frame.hpRatio))})`;
      }
      if (hpGhostRef.current) {
        hpGhostRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, frame.hpRatio))})`;
      }
      if (shieldBarRef.current) {
        shieldBarRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, frame.shieldRatio))})`;
      }
      if (boostBarRef.current) {
        boostBarRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, frame.boostRatio))})`;
      }
      if (bossHpBarRef.current) {
        bossHpBarRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, frame.bossHpRatio))})`;
      }
      if (damageVignetteRef.current) {
        const baseLowHp = frame.hpRatio <= 0.3 ? 0.38 : 0;
        const opacity = Math.min(0.85, Math.max(baseLowHp, frame.damageFlash * 0.72));
        damageVignetteRef.current.style.opacity = String(opacity);
      }
      if (crosshairRef.current) {
        const scale = 1 + frame.crosshairBloom * 0.34;
        crosshairRef.current.style.transform = `scale(${scale.toFixed(3)})`;
      }
      if (hitmarkerRef.current) {
        if (frame.hitmarkerRatio > 0.01) {
          const hmScale = 0.88 + frame.hitmarkerRatio * 0.32;
          hitmarkerRef.current.style.opacity = String(Math.min(1, frame.hitmarkerRatio * 1.4));
          hitmarkerRef.current.style.transform = `scale(${hmScale.toFixed(3)})`;
          hitmarkerRef.current.style.color = frame.hitmarkerKill ? '#fb7185' : '#fbbf24';
        } else {
          hitmarkerRef.current.style.opacity = '0';
        }
      }

      if (waypointRef.current) {
        if (!frame.waypoint) {
          waypointRef.current.style.opacity = '0';
        } else {
          const wp = frame.waypoint;
          waypointRef.current.style.opacity = '1';
          waypointRef.current.style.transform = `translate3d(${wp.x.toFixed(1)}px, ${wp.y.toFixed(1)}px, 0) translate(-50%, -50%)`;

          if (waypointArrowRef.current) {
            const deg = wp.isOffscreen ? (wp.angleRad * 180) / Math.PI : 90;
            waypointArrowRef.current.style.transform = `rotate(${deg.toFixed(1)}deg)`;
          }
          if (waypointLabelRef.current) {
            waypointLabelRef.current.textContent = wp.planetName;
            waypointLabelRef.current.style.color = wp.accentHex;
          }
          if (waypointDistRef.current) {
            waypointDistRef.current.textContent = `${wp.distance} m`;
          }
        }
      }

      if (missileReloadRef.current) {
        missileReloadRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, frame.missileReloadRatio))})`;
      }
      if (dodgeBarRef.current) {
        const readiness = Math.max(0, Math.min(1, 1 - frame.dodgeCooldownRatio));
        dodgeBarRef.current.style.transform = `scaleX(${readiness})`;
      }

      if (lockOnRef.current) {
        const lo = frame.lockOn;
        if (!lo || !lo.visible) {
          lockOnRef.current.style.opacity = '0';
        } else {
          lockOnRef.current.style.opacity = '1';
          lockOnRef.current.style.transform = `translate3d(${lo.x.toFixed(1)}px, ${lo.y.toFixed(1)}px, 0) translate(-50%, -50%)`;

          if (lockOnRingRef.current) {
            const rotDeg = lo.locked ? 45 : (1 - lo.progress) * 140;
            const ringScale = lo.locked ? 0.88 : 1.35 - lo.progress * 0.42;
            lockOnRingRef.current.style.transform = `rotate(${rotDeg.toFixed(1)}deg) scale(${ringScale.toFixed(3)})`;
            lockOnRingRef.current.style.color = lo.locked ? '#fb7185' : '#fbbf24';
          }
          if (lockOnLabelRef.current) {
            lockOnLabelRef.current.textContent = lo.locked
              ? `LOCKED [E] · ${lo.label} · ${lo.distance}m`
              : `LOCKING ${Math.round(lo.progress * 100)}% · ${lo.label}`;
            lockOnLabelRef.current.style.color = lo.locked ? '#fda4af' : '#fcd34d';
            lockOnLabelRef.current.style.borderColor = lo.locked
              ? 'rgba(251, 113, 133, 0.75)'
              : 'rgba(251, 191, 36, 0.55)';
          }
        }
      }

      if (leadRef.current && leadLineRef.current) {
        const lead = frame.leadIndicator;
        if (!lead || !lead.visible) {
          leadRef.current.style.opacity = '0';
          leadLineRef.current.setAttribute('stroke-opacity', '0');
        } else {
          leadRef.current.style.opacity = '0.92';
          leadRef.current.style.transform = `translate3d(${lead.x.toFixed(1)}px, ${lead.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
          leadLineRef.current.setAttribute('x1', lead.targetX.toFixed(1));
          leadLineRef.current.setAttribute('y1', lead.targetY.toFixed(1));
          leadLineRef.current.setAttribute('x2', lead.x.toFixed(1));
          leadLineRef.current.setAttribute('y2', lead.y.toFixed(1));
          leadLineRef.current.setAttribute('stroke-opacity', '0.52');
        }
      }

      if (radarCanvasRef.current) {
        drawHoloRadar(radarCanvasRef.current, frame.radar);
      }
    };

    const engine = new GalacticDriftEngine(mount, setHud, handleFastOverlay);
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    const cockpit = params.get('cockpit') === '1';
    if (params.get('bossdemo') === '1') {
      engine.startNewGame({ skipFlyby: true, bossDemo: true, cockpit });
    } else if (params.get('autostart') === '1') {
      engine.startNewGame({ skipFlyby: true, cockpit });
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#040710]">
      {/* Isolated WebGL canvas container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full"
        aria-label="Dunia 3D Galactic Drift"
      />

      {hud.phase === 'title' && (
        <TitleOverlay
          bestScore={hud.bestScore}
          muted={hud.muted}
          graphicsQuality={hud.graphicsQuality}
          onStart={() => engineRef.current?.startNewGame()}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onChangeQuality={(quality) => engineRef.current?.setGraphicsQuality(quality)}
        />
      )}

      {/* Automated Cinematic 6-Planet Fly-By Letterbox Overlay */}
      {hud.phase === 'flyby' && (
        <div
          data-testid="flyby-overlay"
          className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between"
        >
          <div className="h-11 sm:h-14 bg-gradient-to-b from-[#030610] to-[#030610]/0 flex items-center justify-center px-4">
            <span className="font-mono-hud text-[11px] sm:text-xs tracking-[0.28em] uppercase text-sky-300/90 hud-text-shadow">
              Tinjauan Tata Surya · 6 Planet Target
            </span>
          </div>

          <div className="p-4 sm:p-8 bg-gradient-to-t from-[#030610]/95 via-[#030610]/55 to-transparent flex items-end justify-between gap-4">
            <div className="hud-plate rounded-xl px-4 py-3 max-w-sm">
              <div className="flex items-center gap-2 text-[11px] font-mono-hud tracking-widest text-slate-400">
                <span>0{hud.flybyPlanetIndex} / 06</span>
                <span aria-hidden="true">·</span>
                <span style={{ color: hud.flybyAccentHex }}>SEKTOR PLANET</span>
              </div>
              <div
                className="font-display text-2xl sm:text-3xl font-bold tracking-wide mt-0.5"
                style={{ color: hud.flybyAccentHex }}
              >
                {hud.flybyPlanetName}
              </div>
              <div className="text-xs sm:text-sm text-slate-300 mt-0.5">
                {hud.flybyPlanetSubtitle}
              </div>
            </div>

            <button
              type="button"
              data-testid="skip-flyby-btn"
              onClick={() => engineRef.current?.skipFlyby()}
              className="pointer-events-auto hud-plate-accent inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-display font-bold tracking-wide text-sky-200 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Lewati Intro</span>
              <FastForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {hud.phase === 'playing' && (
        <>
          <CockpitHud
            hud={hud}
            isTouchLayout={isTouchLayout}
            hpBarRef={hpBarRef}
            hpGhostRef={hpGhostRef}
            shieldBarRef={shieldBarRef}
            boostBarRef={boostBarRef}
            bossHpBarRef={bossHpBarRef}
            waypointRef={waypointRef}
            waypointArrowRef={waypointArrowRef}
            waypointLabelRef={waypointLabelRef}
            waypointDistRef={waypointDistRef}
            damageVignetteRef={damageVignetteRef}
            crosshairRef={crosshairRef}
            hitmarkerRef={hitmarkerRef}
            lockOnRef={lockOnRef}
            lockOnRingRef={lockOnRingRef}
            lockOnLabelRef={lockOnLabelRef}
            leadRef={leadRef}
            leadLineRef={leadLineRef}
            radarCanvasRef={radarCanvasRef}
            missileReloadRef={missileReloadRef}
            dodgeBarRef={dodgeBarRef}
            onPause={() => engineRef.current?.pauseGame()}
            onOpenHangar={() => engineRef.current?.openHangar()}
            onToggleCamera={() => engineRef.current?.toggleCameraMode()}
            onToggleMute={() => engineRef.current?.toggleMute()}
          />
          {isTouchLayout && (
            <MobileControls
              missileAmmo={hud.missileAmmo}
              dodgeReady={!hud.dodgeActive && hud.dodgeCooldownRatio <= 0.01}
              onChange={(partial) => engineRef.current?.setMobileInput(partial)}
              onFireMissile={() => engineRef.current?.fireHomingMissile()}
              onDodge={() => engineRef.current?.triggerDodge()}
            />
          )}
        </>
      )}

      <HangarModal
        hud={hud}
        onBuyUpgrade={(track) => engineRef.current?.buyUpgrade(track)}
        onRepairHull={() => engineRef.current?.repairHull()}
        onClose={() => engineRef.current?.closeHangar()}
      />

      <StatusModal
        hud={hud}
        onResume={() => engineRef.current?.resumeGame()}
        onRestart={() => engineRef.current?.startNewGame({ skipFlyby: true })}
        onReturnTitle={() => engineRef.current?.returnToTitle()}
        onChangeQuality={(quality) => engineRef.current?.setGraphicsQuality(quality)}
      />
    </main>
  );
}
