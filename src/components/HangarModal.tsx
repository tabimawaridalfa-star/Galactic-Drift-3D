import React from 'react';
import {
  Coins,
  Crosshair,
  Flame,
  Play,
  Radar,
  Shield,
  Wrench,
  X,
} from 'lucide-react';
import type { HudSnapshot } from '../game/engine';
import {
  MAX_UPGRADE_LEVEL,
  type UpgradeTrackId,
  WEAPON_TIER_NAMES,
  getHullRepairInfo,
  getUpgradeCost,
} from '../game/rules';

interface HangarModalProps {
  hud: HudSnapshot;
  onBuyUpgrade: (track: UpgradeTrackId) => void;
  onRepairHull: () => void;
  onClose: () => void;
}

interface TrackMeta {
  id: UpgradeTrackId;
  title: string;
  accent: string;
  icon: React.ReactNode;
  tierSummary: (level: number) => string;
  nextBenefit: (nextLevel: number) => string;
}

const TRACKS: TrackMeta[] = [
  {
    id: 'weapon',
    title: 'Senjata Plasma',
    accent: '#38bdf8',
    icon: <Crosshair className="w-4 h-4 text-sky-300" />,
    tierSummary: (lv) => {
      const missiles = lv + 2;
      return `Lv.${lv} · ${WEAPON_TIER_NAMES[Math.min(3, lv - 1)]} · ${missiles} Rudal`;
    },
    nextBenefit: (next) =>
      next === 2
        ? 'Rapid Fire Aqua · +1 kapasitas Rudal Homing (4) & isi ulang lebih cepat'
        : next === 3
        ? 'Triple Laser Emerald · 5 Rudal Homing lebih kuat & reload cepat'
        : 'Heavy Quad Plasma Emas · 6 Rudal Homing masif & reload ultra-cepat',
  },
  {
    id: 'engine',
    title: 'Mesin & Thruster',
    accent: '#fbbf24',
    icon: <Flame className="w-4 h-4 text-amber-300" />,
    tierSummary: (lv) =>
      lv === 1
        ? 'Standar · Boost 100'
        : lv === 2
        ? 'Overclock · Boost 130'
        : lv === 3
        ? 'Ion Surge · Boost 165'
        : 'Hyperdrive · Boost 200',
    nextBenefit: (next) =>
      next === 2
        ? '+Kecepatan terbang, Boost 130 & isi ulang lebih cepat'
        : next === 3
        ? '+Kecepatan tinggi, Boost 165 & regenerasi cepat'
        : '+Kecepatan maksimal, Boost 200 & isi ulang ultra-cepat',
  },
  {
    id: 'hull',
    title: 'Lambung & Perisai',
    accent: '#34d399',
    icon: <Shield className="w-4 h-4 text-emerald-300" />,
    tierSummary: (lv) =>
      lv === 1
        ? 'Max HP 100 · Tanpa Perisai'
        : lv === 2
        ? 'Max HP 135 · Perisai 50'
        : lv === 3
        ? 'Max HP 175 · Perisai 95'
        : 'Max HP 220 · Perisai 150',
    nextBenefit: (next) =>
      next === 2
        ? 'Max HP 135 & buka Energy Shield 50 (auto-regen)'
        : next === 3
        ? 'Max HP 175 & perkuat Energy Shield 95 lebih cepat pulih'
        : 'Max HP 220 & Energy Shield 150 berdaya pulih maksimal',
  },
  {
    id: 'scanner',
    title: 'Scanner & Magnet',
    accent: '#c084fc',
    icon: <Radar className="w-4 h-4 text-purple-300" />,
    tierSummary: (lv) =>
      lv === 1
        ? 'Scan 1.0x · Magnet 52m'
        : lv === 2
        ? 'Scan 1.5x · Magnet 82m'
        : lv === 3
        ? 'Scan 2.1x · Magnet 118m'
        : 'Scan 2.9x · Magnet 160m',
    nextBenefit: (next) =>
      next === 2
        ? 'Durasi scan planet +45% lebih cepat & magnet koin 82m'
        : next === 3
        ? 'Scan planet 2.1x lebih cepat & radius magnet koin 118m'
        : 'Scan planet super-cepat 2.9x & magnet koin luas 160m',
  },
];

export const HangarModal: React.FC<HangarModalProps> = ({
  hud,
  onBuyUpgrade,
  onRepairHull,
  onClose,
}) => {
  if (hud.phase !== 'hangar') return null;

  const repairInfo = getHullRepairInfo(hud.hp, hud.maxHp);
  const canAffordRepair = repairInfo.needed && hud.coins >= repairInfo.cost;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hangar-modal-title"
      data-testid="hangar-modal"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-[#040710]/80"
    >
      <div className="hud-plate-accent w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl p-4 sm:p-5 text-left">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-sky-400/20">
          <div>
            <div className="text-[10px] font-mono-hud uppercase tracking-widest text-sky-300">
              Dok Perawatan &amp; Modifikasi Pesawat
            </div>
            <h2
              id="hangar-modal-title"
              className="font-display text-xl sm:text-2xl font-bold tracking-wide text-slate-50"
            >
              HANGAR UPGRADE
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hud-plate rounded-xl px-3.5 py-2 flex items-center gap-2 border-amber-400/40">
              <Coins className="w-4 h-4 text-amber-300" />
              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-400 leading-none">
                  Kredit
                </div>
                <div
                  data-testid="hangar-coins"
                  className="font-mono-hud text-base sm:text-lg font-bold text-amber-300 leading-tight"
                >
                  {hud.coins.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Hangar"
              className="hud-plate flex items-center justify-center w-10 h-10 rounded-xl text-slate-300 hover:text-sky-300 hover:border-sky-400/50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hull Repair Strip */}
        <div className="mt-3 hud-plate rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-400/35">
              <Wrench className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="text-sm font-display font-bold text-slate-100">
                Repair Hull · Integritas Lambung{' '}
                <span className="font-mono-hud text-emerald-300">
                  {hud.hp}/{hud.maxHp}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {repairInfo.needed
                  ? `Pulihkan +${repairInfo.missingHp} HP kembali ke 100% menggunakan nanite perbaikan.`
                  : 'Lambung pesawat dalam kondisi prima (100%).'}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="hangar-repair-btn"
            disabled={!canAffordRepair}
            onClick={onRepairHull}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-display font-bold text-xs sm:text-sm tracking-wide whitespace-nowrap transition-all ${
              canAffordRepair
                ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 cursor-pointer shadow-[0_0_18px_rgba(52,211,153,0.35)]'
                : 'bg-slate-800/80 text-slate-500 border border-slate-700/70 cursor-not-allowed'
            }`}
          >
            <Wrench className="w-4 h-4" />
            {repairInfo.needed ? (
              <span>Repair ({repairInfo.cost} Koin)</span>
            ) : (
              <span>Lambung Penuh</span>
            )}
          </button>
        </div>

        {/* 4 Upgrade Tracks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
          {TRACKS.map((track) => {
            const level = hud.upgradeLevels[track.id];
            const cost = getUpgradeCost(track.id, level);
            const isMax = level >= MAX_UPGRADE_LEVEL || cost === null;
            const canBuy = !isMax && hud.coins >= cost;

            return (
              <div
                key={track.id}
                data-testid={`upgrade-card-${track.id}`}
                className="hud-plate rounded-xl p-3.5 flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {track.icon}
                      <h3 className="font-display font-bold text-base text-slate-100">
                        {track.title}
                      </h3>
                    </div>
                    <span
                      className="font-mono-hud text-xs font-bold px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80"
                      style={{ color: track.accent }}
                    >
                      LV.{level}/{MAX_UPGRADE_LEVEL}
                    </span>
                  </div>

                  {/* 4-segment level bar */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className="h-1.5 rounded-xs transition-colors"
                        style={{
                          backgroundColor:
                            step <= level ? track.accent : 'rgba(30, 41, 59, 0.85)',
                        }}
                      />
                    ))}
                  </div>

                  <div className="mt-2.5 text-xs font-medium text-slate-200">
                    Saat ini: <span className="text-sky-200">{track.tierSummary(level)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {isMax
                      ? 'Sistem ini telah mencapai konfigurasi puncak tempur.'
                      : `Lv.${level + 1}: ${track.nextBenefit(level + 1)}`}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid={`upgrade-buy-${track.id}`}
                  disabled={!canBuy}
                  onClick={() => onBuyUpgrade(track.id)}
                  className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg font-display font-bold text-xs sm:text-sm tracking-wide transition-all ${
                    isMax
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/35 cursor-default'
                      : canBuy
                      ? 'hud-btn-primary text-slate-950 cursor-pointer'
                      : 'bg-slate-900/85 text-slate-500 border border-slate-700/80 cursor-not-allowed'
                  }`}
                >
                  {isMax ? (
                    <span>LEVEL MAKSIMAL</span>
                  ) : (
                    <>
                      <Coins className="w-4 h-4" />
                      <span>
                        Upgrade Lv.{level + 1} · {cost.toLocaleString('id-ID')} Koin
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Resume Action */}
        <div className="mt-3.5 pt-3 border-t border-sky-400/20 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Pintasan cepat: tekan <span className="font-mono-hud text-sky-300">H</span> atau{' '}
            <span className="font-mono-hud text-sky-300">Esc</span> untuk kembali terbang.
          </div>
          <button
            type="button"
            data-testid="hangar-resume-btn"
            onClick={onClose}
            className="hud-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-slate-950 font-display font-bold text-sm tracking-wide cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Lanjutkan Terbang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
