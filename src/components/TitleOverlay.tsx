import React from 'react';
import { Monitor, Play, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { GraphicsQuality } from '../game/rules';

interface TitleOverlayProps {
  bestScore: number;
  muted: boolean;
  graphicsQuality: GraphicsQuality;
  onStart: () => void;
  onToggleMute: () => void;
  onChangeQuality: (quality: GraphicsQuality) => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  bestScore,
  muted,
  graphicsQuality,
  onStart,
  onToggleMute,
  onChangeQuality,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-9"
      style={{
        background:
          'linear-gradient(90deg, rgba(3, 6, 15, 0.80) 0%, rgba(3, 6, 15, 0.40) 36%, rgba(3, 6, 15, 0) 64%)',
      }}
    >
      {/* Top-right single mute toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
          className="pointer-events-auto hud-plate flex items-center justify-center w-11 h-11 rounded-lg text-slate-200 hover:text-sky-300 hover:border-sky-400/55 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Left-third negative-space Glassmorphic Title Emblem & Single Primary CTA */}
      <div className="max-w-[420px] my-auto pointer-events-auto">
        <div className="hud-title-card rounded-2xl p-6 sm:p-7">
          {/* Precision sci-fi corner ticks */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-sky-400/80 rounded-tl-2xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-sky-400/80 rounded-br-2xl"
          />

          {/* Custom Inline SVG Starflight Crest & Title Lockup */}
          <div className="mb-3.5">
            <svg
              viewBox="0 0 360 112"
              className="w-full max-w-[332px] h-auto overflow-visible"
              role="img"
              aria-label="Galactic Drift 3D"
            >
              {/* Geometric starship crest emblem */}
              <g transform="translate(0, 8)">
                <polygon
                  points="22,4 40,34 22,26 4,34"
                  fill="#0ea5e9"
                  fillOpacity="0.26"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                <polygon points="22,10 30,28 22,23 14,28" fill="#e0f2fe" />
                <line
                  x1="50"
                  y1="20"
                  x2="176"
                  y2="20"
                  stroke="#38bdf8"
                  strokeOpacity="0.52"
                  strokeWidth="1.5"
                />
                <circle cx="182" cy="20" r="2.8" fill="#fbbf24" />
              </g>
              {/* Display title lettering */}
              <text
                x="0"
                y="76"
                fill="#f8fafc"
                fontFamily="'Chakra Petch', sans-serif"
                fontWeight="700"
                fontSize="40"
                letterSpacing="1.6"
                style={{ paintOrder: 'stroke fill', stroke: '#040710', strokeWidth: 5 }}
              >
                GALACTIC DRIFT
              </text>
              <text
                x="2"
                y="104"
                fill="#38bdf8"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="700"
                fontSize="15.5"
                letterSpacing="4.2"
                style={{ paintOrder: 'stroke fill', stroke: '#040710', strokeWidth: 3 }}
              >
                3D SOLAR EXPEDITION
              </text>
            </svg>
          </div>

          <p className="text-sm sm:text-[15px] text-slate-300/95 leading-relaxed mb-5">
            Jelajahi tata surya, pindai 6 planet prosedural, dan lumpuhkan drone penjaga di luar angkasa.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStart();
              }}
              className="hud-btn-primary inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-slate-950 font-display font-bold text-base tracking-wide cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>Mulai Misi</span>
            </button>

            {bestScore > 0 && (
              <div className="px-3.5 py-2 rounded-lg bg-slate-950/60 border border-amber-300/25 text-xs sm:text-sm">
                <span className="text-slate-400 mr-2">Rekor</span>
                <span className="font-mono-hud font-bold text-amber-300">
                  {bestScore.toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>

          {/* Graphics Quality Preset Selector */}
          <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
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
                aria-pressed={graphicsQuality === 'ultra'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onChangeQuality('ultra');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  graphicsQuality === 'ultra'
                    ? 'bg-sky-500/25 text-sky-200 border border-sky-400/65'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ultra (HD)</span>
              </button>
              <button
                type="button"
                aria-pressed={graphicsQuality === 'performance'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onChangeQuality('performance');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  graphicsQuality === 'performance'
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/60'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>Performa</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom safe-margin compact sci-fi control hint bar */}
      <div className="flex items-center">
        <div className="hud-plate rounded-lg px-3.5 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-[13px] text-slate-300">
          <span className="text-sky-200 font-medium">W/S</span>
          <span className="-ml-1.5">Pitch</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-sky-200 font-medium">A/D</span>
          <span className="-ml-1.5">Belok &amp; Banking</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-sky-200 font-medium">Shift</span>
          <span className="-ml-1.5">Turbo Boost</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-sky-200 font-medium">Spasi / Klik</span>
          <span className="-ml-1.5">Tembak</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-300 font-medium">E / Klik Kanan</span>
          <span className="-ml-1.5">Rudal</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-cyan-300 font-medium">Q / 2x A/D</span>
          <span className="-ml-1.5">Barrel Roll</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-sky-200 font-medium">C</span>
          <span className="-ml-1.5">Kamera</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-sky-200 font-medium">H</span>
          <span className="-ml-1.5">Hangar</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-sky-200 font-medium">P / Esc</span>
          <span className="-ml-1.5">Jeda</span>
        </div>
      </div>
    </div>
  );
};
