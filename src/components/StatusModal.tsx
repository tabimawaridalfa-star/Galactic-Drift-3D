import React from 'react';
import { Home, Monitor, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { HudSnapshot } from '../game/engine';
import type { GraphicsQuality } from '../game/rules';

interface StatusModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onChangeQuality: (quality: GraphicsQuality) => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
  onChangeQuality,
}) => {
  const isPaused = hud.phase === 'paused';
  const isVictory = hud.phase === 'victory';
  const isGameOver = hud.phase === 'gameover';

  if (!isPaused && !isVictory && !isGameOver) return null;

  const heading = isPaused
    ? 'Permainan Dijeda'
    : isVictory
    ? 'Tata Surya Terpindai!'
    : 'Pesawat Hancur';

  const subtitle = isPaused
    ? 'Sistem navigasi dalam mode siaga. Lanjutkan penerbangan kapan saja.'
    : isVictory
    ? 'Seluruh 6 planet berhasil dipindai. Misi eksplorasi Galactic Drift selesai sempurna.'
    : 'Integritas lambung mencapai 0%. Perbaiki strategi dan luncurkan misi baru.';

  const accentColor = isVictory
    ? 'text-emerald-300'
    : isGameOver
    ? 'text-rose-400'
    : 'text-sky-300';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#040710]/72"
    >
      <div className="hud-plate-accent w-full max-w-md rounded-xl p-6 sm:p-7 text-left">
        <h2
          id="status-modal-title"
          className={`font-display text-2xl sm:text-3xl font-bold tracking-wide ${accentColor}`}
        >
          {heading}
        </h2>
        <p className="text-sm text-slate-300 mt-2 leading-relaxed">{subtitle}</p>

        {/* 3 Tabular-Nums Stat Tiles */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-700/70">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Skor</div>
            <div className="font-mono-hud text-lg font-bold text-slate-50 mt-0.5">
              {hud.score.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Planet</div>
            <div className="font-mono-hud text-lg font-bold text-sky-300 mt-0.5">
              {hud.scannedCount}/{hud.totalPlanets}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              {isVictory ? 'Waktu' : 'Drone'}
            </div>
            <div className="font-mono-hud text-lg font-bold text-amber-300 mt-0.5">
              {isVictory ? formatDuration(hud.elapsedSec) : hud.enemiesDestroyed}
            </div>
          </div>
        </div>

        {(isVictory || isGameOver) && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Skor Terbaik</span>
            <span className="font-mono-hud font-bold text-slate-200">
              {hud.bestScore.toLocaleString('id-ID')}
            </span>
          </div>
        )}

        {/* Live Graphics Quality Preset Selector in Pause Menu */}
        {isPaused && (
          <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Kualitas Grafis</span>
            </div>
            <div
              role="group"
              aria-label="Kualitas Grafis"
              className="inline-flex rounded-lg bg-slate-950/80 border border-slate-700/75 p-0.5"
            >
              <button
                type="button"
                aria-pressed={hud.graphicsQuality === 'ultra'}
                onClick={() => onChangeQuality('ultra')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  hud.graphicsQuality === 'ultra'
                    ? 'bg-sky-500/25 text-sky-200 border border-sky-400/65'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ultra (HD)</span>
              </button>
              <button
                type="button"
                aria-pressed={hud.graphicsQuality === 'performance'}
                onClick={() => onChangeQuality('performance')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  hud.graphicsQuality === 'performance'
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/60'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>Performa</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Action CTAs */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Lanjutkan</span>
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Main Lagi</span>
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600/70 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Ulangi Misi</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReturnTitle}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            <span>Menu Utama</span>
          </button>
        </div>
      </div>
    </div>
  );
};
