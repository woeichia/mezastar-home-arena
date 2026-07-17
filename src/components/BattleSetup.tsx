import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Play,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { MezastarTag } from "../types";
import { getElementColors } from "../data/tags";
import { MezastarCard } from "./MezastarCard";
import { TagDetailModal } from "./TagDetailModal";
import { getPortraitSources, getPortraitTreatment } from "../utils/portraitResolver";
import { resolveHomeBattleProfile } from "../utils/battleProfile";
import { calculateTeamDamage, effectivenessLabel, type DamageTargetResult } from "../utils/battleDamage";
import { BATTLE_MUSIC_TRACKS, playBattleSfx, playVictoryMusic, setBattleSfxMuted, startBattleMusic, stopBattleMusic, unlockBattleAudio, type BattleMusicTrack } from "../utils/battleSfx";

interface BattleSetupProps {
  ownedTags: MezastarTag[];
  onBackToCollection: () => void;
}

type PlayerKey = "player1" | "player2";

interface BattleSelection {
  player1: string[];
  player2: string[];
}

interface RoundAttackerSelection {
  player1: number | null;
  player2: number | null;
}

type TapRacePhase = "idle" | "countdown" | "tapping" | "result";
type BattleWheelPhase = "idle" | "spinning" | "locked";
type AttackChargePhase = "idle" | "charging" | "rainbowReady" | "rainbow" | "doubleReady" | "doubleChallenge" | "locked";
type AttackAnimationPhase = "idle" | "intro" | "impact" | "secondImpact" | "effectiveness" | "hp" | "complete";

interface BattleWheelOutcome {
  id: string;
  label: string;
  multiplier: number;
  color: string;
  textClass: string;
}

interface StoredBattleWheelResult {
  player: PlayerKey;
  tagId: string;
  moveName: string;
  moveType: string;
  power: number;
  category: "Physical" | "Special";
  outcomeId: string;
  multiplier: number;
}

interface StoredAttackChargeResult {
  player: PlayerKey;
  tagId: string;
  taps: number;
  chargeMultiplier: number;
  rainbowHit: boolean;
  doubleStrike: boolean;
}

interface TapCounts {
  player1: number;
  player2: number;
}

interface AttackResolution {
  attackerPlayer: PlayerKey;
  defenderPlayer: PlayerKey;
  attackerName: string;
  moveName: string;
  moveType: string;
  combinedMultiplier: number;
  doubleStrike: boolean;
  targets: DamageTargetResult[];
}

const TEAM_SIZE = 3;
const MAX_CHARGE_TAPS = 12;
const CHARGE_DURATION_SECONDS = 2.5;
const DOUBLE_STRIKE_SECONDS = 4.5;
const DOUBLE_STRIKE_BONUS = 1.5;
const DOUBLE_BUBBLE_COUNT = 6;

interface DoubleBubblePosition {
  left: number;
  top: number;
}

function createDoubleBubbleLayout(): DoubleBubblePosition[] {
  const positions: DoubleBubblePosition[] = [];
  const minimumDistance = 21;
  let attempts = 0;

  while (positions.length < DOUBLE_BUBBLE_COUNT && attempts < 240) {
    attempts += 1;
    const candidate = {
      left: 12 + Math.random() * 76,
      top: 24 + Math.random() * 63,
    };
    const hasEnoughSpace = positions.every((position) => {
      const horizontal = candidate.left - position.left;
      const vertical = (candidate.top - position.top) * 0.72;
      return Math.hypot(horizontal, vertical) >= minimumDistance;
    });
    if (hasEnoughSpace) positions.push(candidate);
  }

  // Very small or unusually shaped screens can make rejection sampling run
  // out of attempts. These safe fallbacks complete the layout without moving
  // bubbles that were already placed.
  const fallbacks: DoubleBubblePosition[] = [
    { left: 16, top: 30 }, { left: 50, top: 28 }, { left: 84, top: 32 },
    { left: 20, top: 72 }, { left: 52, top: 78 }, { left: 82, top: 68 },
  ];
  while (positions.length < DOUBLE_BUBBLE_COUNT) {
    positions.push(fallbacks[positions.length]);
  }

  return positions;
}

const BATTLE_WHEEL_OUTCOMES: BattleWheelOutcome[] = [
  { id: "miss", label: "MISS", multiplier: 0, color: "#3f3f46", textClass: "text-zinc-100" },
  { id: "weak-a", label: "WEAK HIT", multiplier: 0.75, color: "#0369a1", textClass: "text-sky-100" },
  { id: "hit-a", label: "HIT", multiplier: 1, color: "#2563eb", textClass: "text-blue-100" },
  { id: "strong", label: "STRONG", multiplier: 1.25, color: "#ea580c", textClass: "text-orange-100" },
  { id: "hit-b", label: "HIT", multiplier: 1, color: "#4f46e5", textClass: "text-indigo-100" },
  { id: "critical", label: "CRITICAL", multiplier: 1.5, color: "#c026d3", textClass: "text-fuchsia-100" },
  { id: "hit-c", label: "HIT", multiplier: 1, color: "#7c3aed", textClass: "text-violet-100" },
  { id: "weak-b", label: "WEAK HIT", multiplier: 0.75, color: "#0e7490", textClass: "text-cyan-100" },
];

function getOwnedCopies(tag: MezastarTag) {
  return Math.max(0, tag.copiesOwned ?? (tag.owned ? 1 : 0));
}

function countSelected(tagId: string, selection: BattleSelection) {
  return selection.player1.filter((id) => id === tagId).length + selection.player2.filter((id) => id === tagId).length;
}

function playerLabel(player: PlayerKey) {
  return player === "player1" ? "Player 1" : "Player 2";
}

function opponentOf(player: PlayerKey): PlayerKey {
  return player === "player1" ? "player2" : "player1";
}

function createRandomMusicOrder(): BattleMusicTrack[] {
  const order: BattleMusicTrack[] = [0, 1, 2];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

function TeamSlot({
  tag,
  slotNumber,
  player,
  onRemove,
}: {
  tag?: MezastarTag;
  slotNumber: number;
  player: PlayerKey;
  onRemove: () => void;
}) {
  if (!tag) {
    return (
      <div className="flex min-h-24 items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-3 text-white/35">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-black/20 font-mono text-sm font-black">
          {slotNumber}
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-widest">Empty Slot</div>
          <div className="mt-1 text-[11px] text-white/30">Choose one drawn physical tag</div>
        </div>
      </div>
    );
  }

  const typeColors = getElementColors(tag.type1);

  return (
    <div className="flex min-h-24 items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.055] p-3 shadow-lg">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 font-mono text-sm font-black text-amber-100">
        {slotNumber}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${typeColors.bg} ${typeColors.text} ${typeColors.border}`}>
            {tag.type1}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[8px] font-black uppercase text-white/45">
            {tag.officialTagCode || tag.pokedexNo}
          </span>
        </div>
        <div className="mt-1 truncate text-base font-black text-white">{tag.name}</div>
        <div className="mt-0.5 text-[10px] font-mono font-black uppercase tracking-widest text-white/35">
          Energy {tag.energy} · {tag.stars}★
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-300/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/20"
        aria-label={`Remove ${tag.name} from ${playerLabel(player)}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function TeamPanel({
  title,
  player,
  teamIds,
  tagsById,
  onRemove,
}: {
  title: string;
  player: PlayerKey;
  teamIds: string[];
  tagsById: Map<string, MezastarTag>;
  onRemove: (index: number) => void;
}) {
  const totalEnergy = teamIds.reduce((sum, id) => sum + (tagsById.get(id)?.energy ?? 0), 0);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-white/35">
            Team Setup
          </div>
          <h2 className="mt-1 text-xl font-black text-white">{title}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-white/35">Energy</div>
          <div className="text-lg font-black text-amber-200">{totalEnergy}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: TEAM_SIZE }).map((_, index) => (
          <TeamSlot
            key={`${player}-${index}-${teamIds[index] ?? "empty"}`}
            player={player}
            slotNumber={index + 1}
            tag={teamIds[index] ? tagsById.get(teamIds[index]) : undefined}
            onRemove={() => onRemove(index)}
          />
        ))}
      </div>
    </section>
  );
}


function SelectorTagCard({
  tag,
  ownedCopies,
  selectedCopies,
  availableCopies,
  onDetails,
  onAddPlayer1,
  onAddPlayer2,
  player1Full,
  player2Full,
}: {
  tag: MezastarTag;
  ownedCopies: number;
  selectedCopies: number;
  availableCopies: number;
  onDetails: () => void;
  onAddPlayer1: () => void;
  onAddPlayer2: () => void;
  player1Full: boolean;
  player2Full: boolean;
}) {
  const [portraitIndex, setPortraitIndex] = useState(0);
  const typeColors = getElementColors(tag.type1);
  const portraitSources = getPortraitSources(tag);
  const portraitSource = portraitSources[portraitIndex];
  const treatment = getPortraitTreatment(tag);
  const printedCode = tag.officialTagCode || tag.pokedexNo;

  return (
    <article className={`relative overflow-hidden rounded-[2rem] border p-4 transition ${
      availableCopies <= 0
        ? "border-white/5 bg-white/[0.025] opacity-55"
        : "border-white/10 bg-white/[0.055] hover:bg-white/[0.075]"
    }`}>
      <TypeAura type={tag.type1} />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${typeColors.bg} ${typeColors.text} ${typeColors.border}`}>
              {tag.type1}
            </span>
            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[8px] font-black uppercase text-white/45">
              {printedCode}
            </span>
          </div>
          <h3 className="mt-2 truncate text-xl font-black text-white">{tag.name}</h3>
          <div className="mt-1 text-[10px] font-mono font-black uppercase tracking-widest text-white/40">
            {tag.stars}★ · {tag.rarity}
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-amber-300/25 bg-amber-300/12 px-3 py-2 text-center shadow-lg shadow-amber-950/20">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-amber-100/65">
            Energy
          </div>
          <div className="text-3xl font-black leading-none text-amber-100">{tag.energy}</div>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex min-h-[15rem] items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
        <div className="absolute inset-0 opacity-35">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.04)_75%,transparent_75%,transparent)] bg-[length:24px_24px]" />
        </div>

        {portraitSource ? (
          <img
            src={portraitSource.url}
            alt={tag.name}
            onError={() => setPortraitIndex((current) => (current < portraitSources.length - 1 ? current + 1 : current))}
            className={`relative z-10 max-h-[14rem] max-w-[94%] object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.82)] ${treatment.glowClassName}`}
            style={{
              transform: `translateY(${tag.portraitOffsetY ?? 0}px) scale(${tag.portraitScale ?? 1.05})`,
            }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="relative z-10 text-sm font-black uppercase tracking-widest text-white/40">
            No Portrait
          </div>
        )}
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-white/30">Owned</div>
          <div className="text-lg font-black text-white">×{ownedCopies}</div>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-2">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-amber-100/45">Selected</div>
          <div className="text-lg font-black text-amber-100">×{selectedCopies}</div>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-2">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-emerald-100/45">Available</div>
          <div className="text-lg font-black text-emerald-100">×{Math.max(0, availableCopies)}</div>
        </div>
      </div>

      <div className="relative z-10 mt-4 grid w-full grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onDetails}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          Details
        </button>
        <button
          type="button"
          disabled={availableCopies <= 0 || player1Full}
          onClick={onAddPlayer1}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-2xl border border-blue-300/25 bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus className="h-4 w-4" />
          P1
        </button>
        <button
          type="button"
          disabled={availableCopies <= 0 || player2Full}
          onClick={onAddPlayer2}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-2xl border border-red-300/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus className="h-4 w-4" />
          P2
        </button>
      </div>
    </article>
  );
}

function TeamPreviewPortrait({
  tag,
  slotNumber,
}: {
  tag: MezastarTag;
  slotNumber: number;
}) {
  const [portraitIndex, setPortraitIndex] = useState(0);
  const typeColors = getElementColors(tag.type1);
  const portraitSources = getPortraitSources(tag);
  const portraitSource = portraitSources[portraitIndex];
  const treatment = getPortraitTreatment(tag);

  return (
    <article className="relative min-h-[22rem] overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.045] p-4 shadow-2xl">
      <div className={`absolute -left-16 -top-16 h-48 w-48 rounded-full ${typeColors.bg} opacity-25 blur-[80px]`} />
      <div className="absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-purple-500/15 blur-[90px]" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-mono font-black uppercase tracking-widest text-white/55">
              Slot {slotNumber}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${typeColors.bg} ${typeColors.text} ${typeColors.border}`}>
              {tag.type1}
            </span>
          </div>
          <h4 className="mt-2 text-xl font-black leading-none text-white">{tag.name}</h4>
          <div className="mt-1 text-[10px] font-mono font-black uppercase tracking-widest text-white/40">
            {tag.officialTagCode || tag.pokedexNo} · {tag.stars}★
          </div>
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-center">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-amber-100/60">Energy</div>
          <div className="text-2xl font-black text-amber-100">{tag.energy}</div>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex min-h-[14rem] items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/20">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_58%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.04)_75%,transparent_75%,transparent)] bg-[length:24px_24px]" />
        </div>

        {portraitSource ? (
          <img
            src={portraitSource.url}
            alt={tag.name}
            onError={() => {
              setPortraitIndex((current) =>
                current < portraitSources.length - 1 ? current + 1 : current,
              );
            }}
            className={`relative z-10 max-h-[13rem] max-w-[92%] object-contain drop-shadow-[0_16px_26px_rgba(0,0,0,0.8)] ${treatment.glowClassName}`}
            style={{
              transform: `translateY(${tag.portraitOffsetY ?? 0}px) scale(${tag.portraitScale ?? 1})`,
            }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="relative z-10 text-sm font-black uppercase tracking-widest text-white/40">
            No Portrait
          </div>
        )}
      </div>

      <div className="relative z-10 mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-white/30">HP</div>
          <div className="text-sm font-black text-white">{tag.stats.hp}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-white/30">ATK</div>
          <div className="text-sm font-black text-white">{tag.stats.attack}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-white/30">SPD</div>
          <div className="text-sm font-black text-white">{tag.stats.speed}</div>
        </div>
      </div>
    </article>
  );
}


function TypeAura({ type }: { type: string }) {
  const colors = getElementColors(type);
  const normalized = type.toLowerCase();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <div className={`absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full ${colors.bg} opacity-[0.24] blur-[42px]`} />
      <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_62%)]" />

      {normalized === "electric" && (
        <>
          <div className="absolute left-[30%] top-[22%] h-20 w-[3px] -rotate-12 rounded-full bg-yellow-200/60 blur-[1px] animate-pulse" />
          <div className="absolute right-[30%] bottom-[22%] h-16 w-[3px] rotate-[18deg] rounded-full bg-yellow-100/50 blur-[1px] animate-pulse" />
        </>
      )}

      {normalized === "fire" && (
        <>
          <div className="absolute left-1/2 bottom-[18%] h-24 w-36 -translate-x-1/2 rounded-full bg-orange-500/34 blur-[28px] animate-pulse" />
          <div className="absolute left-[42%] bottom-[34%] h-16 w-7 rounded-full bg-red-400/25 blur-[12px] animate-pulse" />
        </>
      )}

      {normalized === "water" && (
        <>
          <div className="absolute left-1/2 top-[58%] h-20 w-36 -translate-x-1/2 rounded-[50%] border border-cyan-200/25 blur-[2px]" />
          <div className="absolute left-1/2 top-[58%] h-24 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/14 blur-[24px]" />
        </>
      )}

      {normalized === "grass" && (
        <>
          <div className="absolute left-1/2 top-[58%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-300/18 blur-[25px]" />
          <div className="absolute left-[30%] top-[30%] h-2 w-8 rotate-45 rounded-full bg-green-200/35" />
          <div className="absolute right-[30%] bottom-[30%] h-2 w-10 -rotate-12 rounded-full bg-lime-200/35" />
        </>
      )}

      {normalized === "psychic" && (
        <>
          <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-200/30 blur-[3px] animate-pulse" />
          <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300/16 blur-[32px] animate-pulse" />
        </>
      )}

      {normalized === "dark" && (
        <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 blur-[35px]" />
      )}

      {normalized === "dragon" && (
        <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_90deg_at_50%_50%,rgba(251,191,36,0.12),rgba(96,165,250,0.25),rgba(251,191,36,0.12))] blur-[8px] animate-spin-slow" />
      )}

      {normalized === "steel" && (
        <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.30)_48%,transparent_58%)] opacity-55 blur-[8px]" />
      )}
    </div>
  );
}

function hexToRgb01(hex: string) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ] as const;
}

function getChargePalette(type?: string) {
  const normalized = (type ?? "").toLowerCase();
  if (normalized === "fire") return { core: "#fff1d6", glow: "#fb923c", deep: "#ef4444" };
  if (normalized === "water") return { core: "#e0f7ff", glow: "#38bdf8", deep: "#2563eb" };
  if (normalized === "grass") return { core: "#ecffd8", glow: "#84cc16", deep: "#16a34a" };
  if (normalized === "psychic") return { core: "#fce7ff", glow: "#d946ef", deep: "#7c3aed" };
  if (normalized === "dark") return { core: "#ede9fe", glow: "#7c3aed", deep: "#111827" };
  if (normalized === "dragon") return { core: "#fff7ed", glow: "#f59e0b", deep: "#3b82f6" };
  if (normalized === "steel") return { core: "#ffffff", glow: "#cbd5e1", deep: "#64748b" };
  if (normalized === "normal") return { core: "#ffffff", glow: "#d4d4d8", deep: "#71717a" };
  return { core: "#fff7ad", glow: "#facc15", deep: "#38bdf8" };
}

function LocalChargeAura({ type, intensity }: { type: string; intensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  const paletteRef = useRef(getChargePalette(type));

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    paletteRef.current = getChargePalette(type);
  }, [type]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) return;

    const vertexSrc = `
      attribute vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
    `;

    const fragmentSrc = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_power;
      uniform vec3 u_core;
      uniform vec3 u_glow;
      uniform vec3 u_deep;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float ring(vec2 p, float radius, float width) {
        return exp(-abs(length(p) - radius) * width);
      }

      float coreHole(vec2 p, float radius) {
        float r = length(p);
        return 1.0 - smoothstep(radius * 0.55, radius * 1.15, r);
      }

      float rays(vec2 p, float time, float power) {
        float r = length(p);
        float a = atan(p.y, p.x);
        float rayA = pow(abs(sin(a * 13.0 + time * 2.0 + noise(vec2(a * 2.0, time * 0.7)) * 1.4)), 22.0);
        float rayB = pow(abs(sin(a * 21.0 - time * 2.5)), 28.0);
        float rayC = pow(abs(sin(a * 7.0 + time * 1.4)), 15.0);
        float rayMix = rayA * 0.72 + rayB * 0.42 + rayC * 0.20;
        float radialGate = smoothstep(0.12, 0.22, r) * (1.0 - smoothstep(0.46 + power * 0.08, 0.60 + power * 0.10, r));
        return rayMix * radialGate * exp(-r * (2.9 - power * 0.65));
      }

      void main() {
        vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        float r = length(p);
        float power = clamp(u_power, 0.0, 1.0);
        float localMask = 1.0 - smoothstep(0.45, 0.60, r);

        float visible = smoothstep(0.04, 1.0, power) * 0.34;
        if (visible <= 0.001) discard;

        float pulse = 0.5 + 0.5 * sin(u_time * (2.0 + power * 3.0));
        float flicker = 0.82 + 0.18 * step(0.48, hash(vec2(floor(u_time * 22.0), 17.0)));

        float baseRadius = 0.125 + power * 0.060;
        float mainRing = ring(p, baseRadius + pulse * 0.010, 50.0 - power * 6.0);
        float outerRing = ring(p, baseRadius + 0.075 + power * 0.038, 30.0);
        float tunnel = ring(p, 0.26 + pulse * 0.012 + power * 0.046, 14.0) * (0.04 + power * 0.34);
        float radial = rays(p, u_time, power) * (0.08 + power * 0.88);
        float aura = exp(-r * r / (0.030 + power * 0.028)) * (0.06 + power * 0.32);
        float blackCore = coreHole(p, 0.056 + power * 0.010);
        float coreEdge = ring(p, 0.063 + power * 0.012, 80.0);

        float energy = aura + mainRing * (0.24 + power * 0.64) + outerRing * (0.08 + power * 0.34) + tunnel + radial + coreEdge * (0.24 + power * 0.50);
        energy *= visible * flicker * localMask;

        vec3 col = u_deep * radial * visible * localMask * (0.22 + power * 0.56);
        col += u_glow * energy * (0.48 + power * 0.48);
        col += u_core * pow(max(energy, 0.0), 1.45) * (0.34 + power * 0.52);
        col *= (1.0 - blackCore * (0.38 + power * 0.18));
        col += u_core * coreEdge * visible * localMask * (0.28 + power * 0.44);

        float alpha = clamp(length(col) * 0.26, 0.0, 0.62) * localMask;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `;

    function compile(type: number, source: string) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertex = compile(gl.VERTEX_SHADER, vertexSrc);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const powerLoc = gl.getUniformLocation(program, "u_power");
    const coreLoc = gl.getUniformLocation(program, "u_core");
    const glowLoc = gl.getUniformLocation(program, "u_glow");
    const deepLoc = gl.getUniformLocation(program, "u_deep");

    let frame = 0;
    let cancelled = false;
    const start = performance.now();

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    }

    function draw() {
      if (cancelled) return;
      resize();

      const power = Math.max(0, Math.min(1, intensityRef.current));
      const palette = paletteRef.current;
      const core = hexToRgb01(palette.core);
      const glow = hexToRgb01(palette.glow);
      const deep = hexToRgb01(palette.deep);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, (performance.now() - start) / 1000);
      gl.uniform1f(powerLoc, power);
      gl.uniform3f(coreLoc, core[0], core[1], core[2]);
      gl.uniform3f(glowLoc, glow[0], glow[1], glow[2]);
      gl.uniform3f(deepLoc, deep[0], deep[1], deep[2]);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = window.requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute left-1/2 top-1/2 z-[2] h-[17rem] w-[17rem] -translate-x-1/2 -translate-y-1/2 opacity-95 mix-blend-screen"
      aria-hidden="true"
    />
  );
}


function ArenaPortraitChoice({
  tag,
  slotNumber,
  selected,
  confirmed = false,
  tired = false,
  fainted = false,
  compact = false,
  formation = false,
  battleScale = 1,
  battleGlow = 0,
  topLane = false,
  onChoose,
}: {
  tag: MezastarTag;
  slotNumber: number;
  selected: boolean;
  confirmed?: boolean;
  tired?: boolean;
  fainted?: boolean;
  compact?: boolean;
  formation?: boolean;
  battleScale?: number;
  battleGlow?: number;
  topLane?: boolean;
  onChoose: () => void;
}) {
  const [portraitIndex, setPortraitIndex] = useState(0);
  const portraitSources = getPortraitSources(tag);
  const portraitSource = portraitSources[portraitIndex];
  const treatment = getPortraitTreatment(tag);
  const typeColors = getElementColors(tag.type1);

  const liftClass = selected && !compact && !formation
    ? (topLane ? "translate-y-10 scale-110" : "-translate-y-10 scale-110")
    : selected && compact
      ? "scale-105"
      : "";

  const baseSizeClass = compact
    ? "min-h-[6.3rem] w-[6.5rem] flex-none opacity-80"
    : formation
      ? "min-h-[12rem] w-[11rem] flex-none"
      : "min-h-[11.5rem] flex-1";

  const portraitBoxClass = compact ? "h-[4.5rem]" : formation ? "h-[9rem]" : "h-[8.5rem]";
  const portraitImgClass = compact ? "max-h-[4.5rem] max-w-[112%]" : formation ? "max-h-[9rem] max-w-[125%]" : "max-h-[8.5rem] max-w-[118%]";
  const scaleStyle = formation
    ? {
        transform: `scale(${battleScale})`,
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={fainted}
      style={scaleStyle}
      className={`group relative flex ${baseSizeClass} ${liftClass} flex-col items-center justify-end overflow-visible rounded-[2rem] px-1 pb-1 text-center transition duration-500 disabled:cursor-not-allowed ${fainted ? "opacity-35 grayscale" : ""} ${
        selected ? "z-20" : "z-10"
      }`}
      aria-label={`Choose ${tag.name} as attacker`}
    >
      <div className={`absolute left-1/2 top-[50%] ${compact ? "h-24 w-24" : "h-40 w-40"} -translate-x-1/2 -translate-y-1/2 rounded-full ${typeColors.bg} opacity-25 blur-[42px] transition duration-500 ${
        selected ? "scale-125 opacity-55" : ""
      }`} />
      {formation && selected && battleGlow > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[4] h-[16.5rem] w-[16.5rem] -translate-x-1/2 -translate-y-1/2 transition duration-300">
          <div
            className="absolute inset-[18%] rounded-full border animate-[chargeCorePulse_1200ms_ease-in-out_infinite]"
            style={{
              opacity: 0.18 + battleGlow * 0.72,
              borderColor: `${getChargePalette(tag.type1).core}88`,
              background: `radial-gradient(circle, rgba(0,0,0,0.42) 0%, ${getChargePalette(tag.type1).deep}30 34%, transparent 62%)`,
              boxShadow: `0 0 ${12 + battleGlow * 32}px ${getChargePalette(tag.type1).glow}, inset 0 0 ${10 + battleGlow * 26}px ${getChargePalette(tag.type1).deep}`,
            }}
          />
          <div
            className="absolute inset-[5%] rounded-full border"
            style={{
              opacity: 0.10 + battleGlow * 0.66,
              borderColor: `${getChargePalette(tag.type1).glow}66`,
              boxShadow: `0 0 ${10 + battleGlow * 30}px ${getChargePalette(tag.type1).glow}`,
            }}
          />
        </div>
      )}

      <div className={`relative z-10 flex w-full flex-col items-center ${topLane ? "rotate-180" : ""}`}>
        {fainted && (
          <div className="mb-1 rounded-full border border-zinc-300/30 bg-zinc-950/70 px-2 py-0.5 text-[7px] font-mono font-black uppercase tracking-widest text-zinc-200">
            Fainted
          </div>
        )}
        {tired && (
          <div className="mb-1 rounded-full border border-orange-300/45 bg-orange-500/20 px-2 py-0.5 text-[7px] font-mono font-black uppercase tracking-widest text-orange-100 shadow-[0_0_14px_rgba(251,146,60,0.22)]">
            Tired
          </div>
        )}
        <div className={`relative mb-1 flex ${portraitBoxClass} w-full items-end justify-center ${tired ? "animate-[tiredBreath_1700ms_ease-in-out_infinite]" : ""}`}>
          {tired && (
            <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden="true">
              <span
                className={`absolute ${compact ? "right-[12%] top-[12%] h-2.5 w-1.5" : "right-[16%] top-[8%] h-4 w-2.5"} rotate-[18deg] rounded-[70%_30%_65%_35%] bg-gradient-to-b from-cyan-100 to-sky-400 shadow-[0_0_10px_rgba(125,211,252,0.85)] animate-[tiredSweatDrop_1350ms_ease-in_infinite]`}
              />
              <span
                className={`absolute ${compact ? "right-[4%] top-[26%] h-2 w-1" : "right-[8%] top-[26%] h-3 w-2"} rotate-[22deg] rounded-[70%_30%_65%_35%] bg-gradient-to-b from-cyan-100 to-sky-400 shadow-[0_0_8px_rgba(125,211,252,0.75)] animate-[tiredSweatDrop_1350ms_ease-in_infinite]`}
                style={{ animationDelay: "480ms" }}
              />
              {!compact && (
                <span
                  className="absolute left-[14%] top-[18%] h-3 w-2 -rotate-[18deg] rounded-[30%_70%_35%_65%] bg-gradient-to-b from-cyan-100 to-sky-400 shadow-[0_0_8px_rgba(125,211,252,0.72)] animate-[tiredSweatDrop_1350ms_ease-in_infinite]"
                  style={{ animationDelay: "860ms" }}
                />
              )}
            </div>
          )}
          {portraitSource ? (
            <img
              src={portraitSource.url}
              alt={tag.name}
              onError={() => setPortraitIndex((current) => (current < portraitSources.length - 1 ? current + 1 : current))}
              className={`${portraitImgClass} object-contain drop-shadow-[0_24px_36px_rgba(0,0,0,0.98)] transition duration-500 ${selected ? "scale-115" : "group-hover:scale-105"} ${tired ? "saturate-[0.78] brightness-90" : ""} ${treatment.glowClassName}`}
              style={{ transform: `translateY(${tag.portraitOffsetY ?? 0}px) scale(${tag.portraitScale ?? (compact ? 1.08 : 1.18)})` }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-xs font-black uppercase tracking-widest text-white/40">No Portrait</div>
          )}
        </div>
        <div className={`rounded-full border px-2 py-0.5 text-[7px] font-mono font-black uppercase tracking-widest ${
          selected
            ? confirmed
              ? "border-emerald-300/55 bg-emerald-300/18 text-emerald-100"
              : "border-amber-300/55 bg-amber-300/20 text-amber-100"
            : "border-white/10 bg-black/35 text-white/45"
        }`}>
          {selected ? (confirmed ? "Locked" : "Attacker") : `Slot ${slotNumber}`}
        </div>
        <div className={`${compact ? "max-w-[6rem] text-[10px]" : "max-w-full text-xs"} mt-1 truncate px-1 font-black text-white drop-shadow`}>
          {tag.name}
        </div>
        <div className="mt-0.5 text-[8px] font-mono font-black uppercase tracking-widest text-white/45">EN {tag.energy}</div>
      </div>
    </button>
  );
}

function BattleFormationLane({
  player,
  teamIds,
  tagsById,
  attackerIndex,
  confirmed,
  battleScale,
  battleGlow,
  tiredSlots,
  hpValues,
}: {
  player: PlayerKey;
  teamIds: string[];
  tagsById: Map<string, MezastarTag>;
  attackerIndex: number;
  confirmed: boolean;
  battleScale: number;
  battleGlow: number;
  tiredSlots: number[];
  hpValues: number[];
}) {
  const topLane = player === "player1";
  const attackerTag = tagsById.get(teamIds[attackerIndex]);
  const teammateIndexes = [0, 1, 2].filter((index) => index !== attackerIndex);
  const laneStyle = {
    transform: `scale(${battleScale})`,
    transformOrigin: topLane ? "50% 18%" : "50% 82%",
  };

  const attackerPosition = topLane
    ? "left-[40%] top-[12%]"
    : "right-[40%] bottom-[12%]";
  const supportPosition = topLane
    ? "left-[16%] top-[6%]"
    : "right-[16%] bottom-[6%]";

  return (
    <div className="relative h-full w-full transition-transform duration-300 ease-out" style={laneStyle}>
      <div className={`absolute ${attackerPosition} z-20`}>
        {attackerTag && (
          <ArenaPortraitChoice
            tag={attackerTag}
            slotNumber={attackerIndex + 1}
            selected
            confirmed={confirmed}
            tired={tiredSlots.includes(attackerIndex)}
            fainted={(hpValues[attackerIndex] ?? 0) <= 0}
            formation
            battleScale={1}
            battleGlow={battleGlow}
            topLane={topLane}
            onChoose={() => undefined}
          />
        )}
      </div>

      <div className={`absolute ${supportPosition} z-10 flex flex-col gap-1.5`}>
        {teammateIndexes.map((index) => {
          const tag = tagsById.get(teamIds[index]);
          if (!tag) return null;
          return (
            <ArenaPortraitChoice
              key={`${player}-support-${tag.id}-${index}`}
              tag={tag}
              slotNumber={index + 1}
              compact
              formation
              topLane={topLane}
              selected={false}
              tired={tiredSlots.includes(index)}
              fainted={(hpValues[index] ?? 0) <= 0}
              onChoose={() => undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function getTapRaceWinner(counts: TapCounts): PlayerKey | "tie" {
  if (counts.player1 > counts.player2) return "player1";
  if (counts.player2 > counts.player1) return "player2";
  return "tie";
}

function selectedAttackerName(
  player: PlayerKey,
  selection: BattleSelection,
  tagsById: Map<string, MezastarTag>,
  attackerSelection: RoundAttackerSelection,
) {
  const slotIndex = attackerSelection[player];
  if (slotIndex === null) return "—";
  const tagId = selection[player][slotIndex];
  return tagsById.get(tagId)?.name ?? "—";
}

function selectedAttackerTag(
  player: PlayerKey,
  selection: BattleSelection,
  tagsById: Map<string, MezastarTag>,
  attackerSelection: RoundAttackerSelection,
) {
  const slotIndex = attackerSelection[player];
  if (slotIndex === null) return undefined;
  return tagsById.get(selection[player][slotIndex]);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function chargeMultiplierForTaps(taps: number) {
  if (taps >= MAX_CHARGE_TAPS) return 1.2;
  if (taps >= 9) return 1.1;
  if (taps >= 5) return 1;
  return 0.9;
}

function createInitialTeamHp(selection: BattleSelection, tagsById: Map<string, MezastarTag>) {
  return {
    player1: selection.player1.map((tagId) => Math.max(1, tagsById.get(tagId)?.stats.hp ?? 1)),
    player2: selection.player2.map((tagId) => Math.max(1, tagsById.get(tagId)?.stats.hp ?? 1)),
  } satisfies Record<PlayerKey, number[]>;
}

function effectivenessTextClass(multiplier: number) {
  if (multiplier === 0) return "text-zinc-200 border-zinc-300/30 bg-zinc-400/10";
  if (multiplier >= 2) return "text-emerald-200 border-emerald-300/35 bg-emerald-400/12";
  if (multiplier < 1) return "text-orange-200 border-orange-300/35 bg-orange-400/12";
  return "text-amber-100 border-amber-300/30 bg-amber-300/10";
}

function VictoryFireworks({ active, winner }: { active: boolean; winner: PlayerKey | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !winner || !canvasRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let lastBurst = 0;
    const palette = winner === "player1"
      ? ["#7dd3fc", "#ffffff", "#facc15", "#a78bfa"]
      : ["#fb7185", "#ffffff", "#facc15", "#f0abfc"];
    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = [];

    const resize = () => {
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const burst = () => {
      const x = window.innerWidth * (0.18 + Math.random() * 0.64);
      const y = window.innerHeight * (0.16 + Math.random() * 0.42);
      for (let index = 0; index < 28; index += 1) {
        const angle = (Math.PI * 2 * index) / 28;
        const speed = 1.7 + Math.random() * 3.2;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color: palette[index % palette.length] });
      }
      if (particles.length > 180) particles.splice(0, particles.length - 180);
    };
    const draw = (time: number) => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (time - lastBurst > 520) {
        burst();
        lastBurst = time;
      }
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.035;
        particle.vx *= 0.992;
        particle.life -= 0.014;
        context.globalAlpha = Math.max(0, particle.life);
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, 2.4, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        if (particles[index].life <= 0) particles.splice(index, 1);
      }
      frame = window.requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize);
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [active, winner]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[5]" aria-hidden="true" />;
}

function BattleRoundPrep({
  selection,
  tagsById,
  attackerSelection,
  onSelectAttacker,
  onBackToTeams,
}: {
  selection: BattleSelection;
  tagsById: Map<string, MezastarTag>;
  attackerSelection: RoundAttackerSelection;
  onSelectAttacker: (player: PlayerKey, slotIndex: number | null) => void;
  onBackToTeams: () => void;
}) {
  const bothReady = attackerSelection.player1 !== null && attackerSelection.player2 !== null;
  const [attackerConfirmed, setAttackerConfirmed] = useState<Record<PlayerKey, boolean>>({
    player1: false,
    player2: false,
  });
  const [tapRacePhase, setTapRacePhase] = useState<TapRacePhase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(3);
  const [tapCounts, setTapCounts] = useState<TapCounts>({ player1: 0, player2: 0 });
  const [lastTapPlayer, setLastTapPlayer] = useState<PlayerKey | null>(null);
  const tapCountsRef = useRef<TapCounts>({ player1: 0, player2: 0 });
  const tapPublishTimerRef = useRef<number | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [battleMusicOrder, setBattleMusicOrder] = useState<BattleMusicTrack[]>(() => createRandomMusicOrder());
  const [lastUsedRound, setLastUsedRound] = useState<Record<PlayerKey, Record<number, number>>>({
    player1: {},
    player2: {},
  });
  const [automaticWinner, setAutomaticWinner] = useState<PlayerKey | null>(null);
  const [roundFlowComplete, setRoundFlowComplete] = useState(false);
  const [attackTurn, setAttackTurn] = useState<1 | 2>(1);
  const [battleWheelPhase, setBattleWheelPhase] = useState<BattleWheelPhase>("idle");
  const [battleWheelTick, setBattleWheelTick] = useState(0);
  const battleWheelStartedAtRef = useRef(0);
  const [lockedWheelOutcome, setLockedWheelOutcome] = useState<BattleWheelOutcome | null>(null);
  const [roundWheelResults, setRoundWheelResults] = useState<Record<string, StoredBattleWheelResult>>({});
  const [attackChargePhase, setAttackChargePhase] = useState<AttackChargePhase>("idle");
  const [chargeTaps, setChargeTaps] = useState(0);
  const chargeTapsRef = useRef(0);
  const [chargeTimeLeft, setChargeTimeLeft] = useState(CHARGE_DURATION_SECONDS);
  const [rainbowPosition, setRainbowPosition] = useState(0);
  const [rainbowCanLock, setRainbowCanLock] = useState(false);
  const rainbowDirectionRef = useRef(1);
  const rainbowLockAllowedAtRef = useRef(0);
  const chargeDeadlineRef = useRef(0);
  const chargeResolvedRef = useRef(false);
  const [lockedChargeMultiplier, setLockedChargeMultiplier] = useState<number | null>(null);
  const [rainbowHit, setRainbowHit] = useState(false);
  const [doubleStrike, setDoubleStrike] = useState(false);
  const [doubleNextBubble, setDoubleNextBubble] = useState(1);
  const [doubleTimeLeft, setDoubleTimeLeft] = useState(DOUBLE_STRIKE_SECONDS);
  const [doubleBubblePositions, setDoubleBubblePositions] = useState<DoubleBubblePosition[]>(() => createDoubleBubbleLayout());
  const doubleDeadlineRef = useRef(0);
  const [roundChargeResults, setRoundChargeResults] = useState<Record<string, StoredAttackChargeResult>>({});
  const [teamHp, setTeamHp] = useState<Record<PlayerKey, number[]>>(() => createInitialTeamHp(selection, tagsById));
  const [attackAnimationPhase, setAttackAnimationPhase] = useState<AttackAnimationPhase>("idle");
  const [attackResolution, setAttackResolution] = useState<AttackResolution | null>(null);
  const [sfxMuted, setSfxMuted] = useState(false);
  const selectedDamageTarget = attackResolution?.targets.find((target) => target.distribution === 1) ?? attackResolution?.targets[0];

  const p1RemainingHp = teamHp.player1.reduce((total, hp) => total + hp, 0);
  const p2RemainingHp = teamHp.player2.reduce((total, hp) => total + hp, 0);
  const p1Survivors = teamHp.player1.filter((hp) => hp > 0).length;
  const p2Survivors = teamHp.player2.filter((hp) => hp > 0).length;
  const matchResultLabel = p1Survivors !== p2Survivors
    ? `${p1Survivors > p2Survivors ? "Player 1" : "Player 2"} wins`
    : p1RemainingHp !== p2RemainingHp
      ? `${p1RemainingHp > p2RemainingHp ? "Player 1" : "Player 2"} wins on remaining HP`
      : "Draw";
  const matchWinner: PlayerKey | null = p1Survivors !== p2Survivors
    ? (p1Survivors > p2Survivors ? "player1" : "player2")
    : p1RemainingHp !== p2RemainingHp
      ? (p1RemainingHp > p2RemainingHp ? "player1" : "player2")
      : null;
  const activeMusicTrack = battleMusicOrder[Math.min(2, Math.max(0, roundNumber - 1))];

  const bothConfirmed = bothReady && attackerConfirmed.player1 && attackerConfirmed.player2;
  const p1TiredSlots = [0, 1, 2].filter((slotIndex) => lastUsedRound.player1[slotIndex] === roundNumber - 1);
  const p2TiredSlots = [0, 1, 2].filter((slotIndex) => lastUsedRound.player2[slotIndex] === roundNumber - 1);
  const p1AttackerTired = attackerSelection.player1 !== null && p1TiredSlots.includes(attackerSelection.player1);
  const p2AttackerTired = attackerSelection.player2 !== null && p2TiredSlots.includes(attackerSelection.player2);
  const winner = automaticWinner ?? getTapRaceWinner(tapCounts);
  const activeAttackerPlayer = winner === "tie"
    ? undefined
    : attackTurn === 1 ? winner : opponentOf(winner);
  const activeAttacker = activeAttackerPlayer
    ? selectedAttackerTag(activeAttackerPlayer, selection, tagsById, attackerSelection)
    : undefined;
  const activeAttackerProfile = activeAttacker ? resolveHomeBattleProfile(activeAttacker) : undefined;
  const attackResultKey = `${roundNumber}-${attackTurn}`;
  const tapDiff = tapCounts.player1 - tapCounts.player2;
  const pressureAmount = clampNumber(tapDiff, -24, 24);
  const pressureRatio = clampNumber(pressureAmount / 24, -1, 1);
  const pressureLine = tapRacePhase === "tapping" || tapRacePhase === "result"
    ? clampNumber(50 + pressureRatio * 12, 38, 62)
    : 50;

  const p1BattleScale = 1;
  const p2BattleScale = 1;
  const p1BattleGlow = tapRacePhase === "tapping" ? 0.28 : 0;
  const p2BattleGlow = tapRacePhase === "tapping" ? 0.28 : 0;
  const pressureStrength = Math.abs(pressureRatio);
  const pressureWinner: PlayerKey | null = pressureRatio > 0.04 ? "player1" : pressureRatio < -0.04 ? "player2" : null;
  const boundaryColor = pressureWinner === "player1" ? "#7dd3fc" : pressureWinner === "player2" ? "#fb7185" : "#facc15";
  const boundaryGlow = pressureWinner === "player1" ? "rgba(125,211,252,0.9)" : pressureWinner === "player2" ? "rgba(251,113,133,0.9)" : "rgba(251,191,36,0.85)";
  const blueTerritoryOpacity = 0.10 + Math.max(0, pressureRatio) * 0.34;
  const redTerritoryOpacity = 0.10 + Math.max(0, -pressureRatio) * 0.34;

  function resetTapCounts() {
    tapCountsRef.current = { player1: 0, player2: 0 };
    setTapCounts({ player1: 0, player2: 0 });
  }

  function chooseAttacker(player: PlayerKey, slotIndex: number) {
    if (tapRacePhase !== "idle") return;
    if (attackerConfirmed[player]) return;
    if ((teamHp[player][slotIndex] ?? 0) <= 0) return;

    onSelectAttacker(player, slotIndex);
  }

  function confirmAttacker(player: PlayerKey) {
    if (attackerSelection[player] === null) return;
    setAttackerConfirmed((current) => ({ ...current, [player]: true }));
  }

  function changeAttacker(player: PlayerKey) {
    if (tapRacePhase !== "idle") return;
    setAttackerConfirmed((current) => ({ ...current, [player]: false }));
  }

  function startTapRace() {
    if (!bothConfirmed) return;
    resetTapCounts();
    setLastTapPlayer(null);
    setCountdown(3);
    setTimeLeft(5);
    setTapRacePhase("countdown");
  }

  function redoTapRace() {
    if (automaticWinner) return;
    resetTapCounts();
    setLastTapPlayer(null);
    setCountdown(3);
    setTimeLeft(5);
    setBattleWheelPhase("idle");
    setBattleWheelTick(0);
    setLockedWheelOutcome(null);
    setAttackTurn(1);
    setTapRacePhase("countdown");
  }

  function startBattleWheel() {
    if (!activeAttackerPlayer || !activeAttackerProfile) return;
    playBattleSfx("wheelStart");
    setBattleWheelTick(0);
    battleWheelStartedAtRef.current = performance.now();
    setLockedWheelOutcome(null);
    setBattleWheelPhase("spinning");
  }

  function stopBattleWheel() {
    if (battleWheelPhase !== "spinning" || !activeAttackerPlayer || !activeAttacker || !activeAttackerProfile) return;
    const elapsed = Math.max(0, performance.now() - battleWheelStartedAtRef.current);
    const stoppedTick = Math.floor(elapsed / 90);
    const stoppedOutcome = BATTLE_WHEEL_OUTCOMES[stoppedTick % BATTLE_WHEEL_OUTCOMES.length];
    playBattleSfx("wheelStop");
    setBattleWheelTick(stoppedTick);
    setLockedWheelOutcome(stoppedOutcome);
    setRoundWheelResults((current) => ({
      ...current,
      [attackResultKey]: {
        player: activeAttackerPlayer,
        tagId: activeAttacker.id,
        moveName: activeAttackerProfile.move.name,
        moveType: activeAttackerProfile.move.type,
        power: activeAttackerProfile.move.power,
        category: activeAttackerProfile.move.category,
        outcomeId: stoppedOutcome.id,
        multiplier: stoppedOutcome.multiplier,
      },
    }));
    setBattleWheelPhase("locked");
  }

  function startAttackCharge() {
    chargeResolvedRef.current = false;
    chargeTapsRef.current = 0;
    setChargeTaps(0);
    setChargeTimeLeft(CHARGE_DURATION_SECONDS);
    setRainbowPosition(0);
    rainbowDirectionRef.current = 1;
    setLockedChargeMultiplier(null);
    setRainbowHit(false);
    setDoubleStrike(false);
    setDoubleNextBubble(1);
    setDoubleTimeLeft(DOUBLE_STRIKE_SECONDS);
    setRainbowCanLock(false);
    chargeDeadlineRef.current = performance.now() + CHARGE_DURATION_SECONDS * 1000;
    setAttackChargePhase("charging");
  }

  function registerChargeTap() {
    if (attackChargePhase !== "charging" || chargeResolvedRef.current) return;
    const next = Math.min(MAX_CHARGE_TAPS, chargeTapsRef.current + 1);
    chargeTapsRef.current = next;
    setChargeTaps(next);
    playBattleSfx("chargeTap", next);
    if (next >= MAX_CHARGE_TAPS) {
      setChargeTimeLeft(0);
      setRainbowPosition(0);
      rainbowDirectionRef.current = 1;
      setAttackChargePhase("rainbowReady");
    }
  }

  function lockAttackCharge(multiplier: number, didHitRainbow: boolean) {
    if (!activeAttackerPlayer || !activeAttacker || chargeResolvedRef.current) return;
    chargeResolvedRef.current = true;
    setLockedChargeMultiplier(multiplier);
    setRainbowHit(didHitRainbow);
    playBattleSfx(didHitRainbow ? "rainbowHit" : "rainbowMiss");
    setRoundChargeResults((current) => ({
      ...current,
      [attackResultKey]: {
        player: activeAttackerPlayer,
        tagId: activeAttacker.id,
        taps: chargeTapsRef.current,
        chargeMultiplier: multiplier,
        rainbowHit: didHitRainbow,
        doubleStrike: false,
      },
    }));
    setAttackChargePhase("locked");
  }

  function stopRainbowTiming() {
    if (attackChargePhase !== "rainbow") return;
    if (!rainbowCanLock || performance.now() < rainbowLockAllowedAtRef.current) return;
    const hit = rainbowPosition >= 44 && rainbowPosition <= 56;
    const doubleZoneHit = rainbowPosition >= 48 && rainbowPosition <= 52;
    if (doubleZoneHit) {
      chargeResolvedRef.current = true;
      setLockedChargeMultiplier(1.3);
      setRainbowHit(true);
      setDoubleStrike(false);
      setDoubleNextBubble(1);
      setDoubleTimeLeft(DOUBLE_STRIKE_SECONDS);
      setDoubleBubblePositions(createDoubleBubbleLayout());
      setAttackChargePhase("doubleReady");
      playBattleSfx("rainbowHit");
      return;
    }
    lockAttackCharge(hit ? 1.3 : 1.2, hit);
  }

  function finishDoubleStrike(success: boolean) {
    if (!activeAttackerPlayer || !activeAttacker) return;
    setDoubleStrike(success);
    setRoundChargeResults((current) => ({
      ...current,
      [attackResultKey]: {
        player: activeAttackerPlayer,
        tagId: activeAttacker.id,
        taps: chargeTapsRef.current,
        chargeMultiplier: 1.3,
        rainbowHit: true,
        doubleStrike: success,
      },
    }));
    playBattleSfx(success ? "rainbowHit" : "rainbowMiss");
    setAttackChargePhase("locked");
  }

  function popDoubleBubble(number: number) {
    if (attackChargePhase !== "doubleChallenge" || number !== doubleNextBubble) return;
    playBattleSfx("chargeTap", number + 8);
    if (number === DOUBLE_BUBBLE_COUNT) {
      finishDoubleStrike(true);
    } else {
      setDoubleNextBubble(number + 1);
    }
  }

  function startAttackResolution(chargeMultiplier: number) {
    if (!activeAttackerPlayer || !activeAttacker || !activeAttackerProfile || !lockedWheelOutcome) return;
    const defenderPlayer = opponentOf(activeAttackerPlayer);
    const defenders = selection[defenderPlayer]
      .map((tagId) => tagsById.get(tagId))
      .filter((tag): tag is MezastarTag => Boolean(tag));
    const targets = calculateTeamDamage({
      attacker: activeAttacker,
      profile: activeAttackerProfile,
      defenders,
      defenderHp: teamHp[defenderPlayer],
      selectedDefenderIndex: attackerSelection[defenderPlayer] ?? 0,
      wheelMultiplier: lockedWheelOutcome.multiplier,
      chargeMultiplier: chargeMultiplier * (doubleStrike ? DOUBLE_STRIKE_BONUS : 1),
    });

    setAttackResolution({
      attackerPlayer: activeAttackerPlayer,
      defenderPlayer,
      attackerName: activeAttacker.name,
      moveName: activeAttackerProfile.move.name,
      moveType: activeAttackerProfile.move.type,
      combinedMultiplier: lockedWheelOutcome.multiplier * chargeMultiplier * (doubleStrike ? DOUBLE_STRIKE_BONUS : 1),
      doubleStrike,
      targets,
    });
    setAttackAnimationPhase("intro");
  }

  function resetAttackStage() {
    setBattleWheelPhase("idle");
    setBattleWheelTick(0);
    setLockedWheelOutcome(null);
    setAttackChargePhase("idle");
    chargeTapsRef.current = 0;
    setChargeTaps(0);
    setChargeTimeLeft(CHARGE_DURATION_SECONDS);
    setRainbowPosition(0);
    setLockedChargeMultiplier(null);
    setRainbowHit(false);
    setDoubleStrike(false);
    setDoubleNextBubble(1);
    setDoubleTimeLeft(DOUBLE_STRIKE_SECONDS);
    setRainbowCanLock(false);
    chargeResolvedRef.current = false;
    setAttackResolution(null);
    setAttackAnimationPhase("idle");
  }

  function completeAttackTurn() {
    const defendingTeamDefeated = attackResolution?.targets.length
      ? attackResolution.targets.every((target) => target.afterHp <= 0)
      : false;
    if (defendingTeamDefeated) {
      resetAttackStage();
      setRoundFlowComplete(true);
      return;
    }
    if (attackTurn === 1) {
      setAttackTurn(2);
      resetAttackStage();
      return;
    }
    completeRound();
  }

  function completeRound() {
    if (winner === "tie") return;
    const p1Slot = attackerSelection.player1;
    const p2Slot = attackerSelection.player2;
    if (p1Slot === null || p2Slot === null) return;

    setLastUsedRound((current) => ({
      player1: { ...current.player1, [p1Slot]: roundNumber },
      player2: { ...current.player2, [p2Slot]: roundNumber },
    }));

    if (roundNumber >= 3) {
      resetAttackStage();
      setRoundFlowComplete(true);
      return;
    }

    setRoundNumber((current) => current + 1);
    setAttackerConfirmed({ player1: false, player2: false });
    setAutomaticWinner(null);
    setAttackTurn(1);
    resetTapCounts();
    setLastTapPlayer(null);
    resetAttackStage();
    setTapRacePhase("idle");
    onSelectAttacker("player1", null);
    onSelectAttacker("player2", null);
  }

  function restartRoundFlow() {
    setRoundNumber(1);
    setBattleMusicOrder(createRandomMusicOrder());
    setLastUsedRound({ player1: {}, player2: {} });
    setAttackerConfirmed({ player1: false, player2: false });
    setAutomaticWinner(null);
    setRoundFlowComplete(false);
    setAttackTurn(1);
    resetTapCounts();
    setLastTapPlayer(null);
    resetAttackStage();
    setRoundWheelResults({});
    setRoundChargeResults({});
    setTeamHp(createInitialTeamHp(selection, tagsById));
    setTapRacePhase("idle");
    onSelectAttacker("player1", null);
    onSelectAttacker("player2", null);
  }

  function registerTap(player: PlayerKey) {
    if (tapRacePhase !== "tapping") return;
    setLastTapPlayer(player);
    tapCountsRef.current = {
      ...tapCountsRef.current,
      [player]: tapCountsRef.current[player] + 1,
    };
    playBattleSfx("tap", tapCountsRef.current[player]);
    if (tapPublishTimerRef.current === null) {
      tapPublishTimerRef.current = window.setTimeout(() => {
        setTapCounts({ ...tapCountsRef.current });
        tapPublishTimerRef.current = null;
      }, 33);
    }
  }

  useEffect(() => {
    if (tapRacePhase !== "countdown") return;

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 0) {
          window.clearInterval(timer);
          setTimeLeft(5);
          resetTapCounts();
          setTapRacePhase("tapping");
          return 0;
        }
        return current - 1;
      });
    }, 650);

    return () => window.clearInterval(timer);
  }, [tapRacePhase]);

  useEffect(() => {
    if (tapRacePhase === "countdown" && countdown > 0) playBattleSfx("countdown");
    if (tapRacePhase === "tapping") playBattleSfx("go");
  }, [tapRacePhase, countdown]);

  useEffect(() => {
    if (tapRacePhase !== "tapping") return;
    setTimeLeft(5);

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        const next = Math.max(0, Number((current - 0.1).toFixed(1)));
        if (next <= 0) {
          window.clearInterval(timer);
          setTapCounts({ ...tapCountsRef.current });
          setTapRacePhase("result");
          return 0;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [tapRacePhase]);

  useEffect(() => {
    if (!bothConfirmed) return;
    if (tapRacePhase !== "idle") return;

    resetTapCounts();
    setLastTapPlayer(null);

    if (p1AttackerTired !== p2AttackerTired) {
      setAutomaticWinner(p1AttackerTired ? "player2" : "player1");
      setTapRacePhase("result");
      return;
    }

    setAutomaticWinner(null);
    setCountdown(3);
    setTimeLeft(5);
    setTapRacePhase("countdown");
  }, [bothConfirmed, tapRacePhase, p1AttackerTired, p2AttackerTired]);

  useEffect(() => {
    if (tapRacePhase !== "result" || roundFlowComplete || winner === "tie") return;
    if (battleWheelPhase !== "idle" || attackChargePhase !== "idle") return;
    if (attackAnimationPhase !== "idle") return;
    if (!activeAttackerProfile) return;

    const timer = window.setTimeout(() => {
      startBattleWheel();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [tapRacePhase, roundFlowComplete, winner, battleWheelPhase, attackChargePhase, attackAnimationPhase, activeAttackerProfile, attackTurn]);

  useEffect(() => {
    if (battleWheelPhase !== "locked" || !lockedWheelOutcome || attackChargePhase !== "idle") return;

    const timer = window.setTimeout(() => {
      if (lockedWheelOutcome.multiplier === 0) {
        startAttackResolution(1);
      } else {
        startAttackCharge();
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [battleWheelPhase, lockedWheelOutcome, attackChargePhase]);

  useEffect(() => {
    if (attackChargePhase !== "charging") return;
    setChargeTimeLeft(CHARGE_DURATION_SECONDS);

    const timer = window.setInterval(() => {
      const next = Math.max(0, (chargeDeadlineRef.current - performance.now()) / 1000);
      setChargeTimeLeft(Number(next.toFixed(1)));
      if (next <= 0) {
        window.clearInterval(timer);
        if (chargeTapsRef.current >= MAX_CHARGE_TAPS) {
          setRainbowPosition(0);
          rainbowDirectionRef.current = 1;
          setAttackChargePhase("rainbowReady");
        } else {
          lockAttackCharge(chargeMultiplierForTaps(chargeTapsRef.current), false);
        }
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [attackChargePhase]);

  useEffect(() => {
    if (attackChargePhase !== "rainbowReady") return;
    setRainbowCanLock(false);
    playBattleSfx("rainbowReady");
    const timer = window.setTimeout(() => {
      setRainbowPosition(0);
      rainbowDirectionRef.current = 1;
      rainbowLockAllowedAtRef.current = performance.now() + 650;
      setAttackChargePhase("rainbow");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [attackChargePhase]);

  useEffect(() => {
    if (attackChargePhase !== "rainbow") return;

    const armTimer = window.setTimeout(() => setRainbowCanLock(true), 650);

    const movement = window.setInterval(() => {
      setRainbowPosition((current) => {
        let next = current + rainbowDirectionRef.current * 4;
        if (next >= 100) {
          next = 100;
          rainbowDirectionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          rainbowDirectionRef.current = 1;
        }
        return next;
      });
    }, 35);

    const timeout = window.setTimeout(() => {
      lockAttackCharge(1.2, false);
    }, 3300);

    return () => {
      window.clearTimeout(armTimer);
      window.clearInterval(movement);
      window.clearTimeout(timeout);
    };
  }, [attackChargePhase]);

  useEffect(() => {
    if (attackChargePhase !== "doubleReady") return;
    const timer = window.setTimeout(() => {
      doubleDeadlineRef.current = performance.now() + DOUBLE_STRIKE_SECONDS * 1000;
      setDoubleTimeLeft(DOUBLE_STRIKE_SECONDS);
      setAttackChargePhase("doubleChallenge");
    }, 850);
    return () => window.clearTimeout(timer);
  }, [attackChargePhase]);

  useEffect(() => {
    if (attackChargePhase !== "doubleChallenge") return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, (doubleDeadlineRef.current - performance.now()) / 1000);
      setDoubleTimeLeft(Number(next.toFixed(1)));
      if (next <= 0) {
        window.clearInterval(timer);
        finishDoubleStrike(false);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [attackChargePhase]);

  useEffect(() => {
    if (attackChargePhase !== "locked" || lockedChargeMultiplier === null) return;
    if (attackAnimationPhase !== "idle") return;
    const timer = window.setTimeout(() => {
      startAttackResolution(lockedChargeMultiplier);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [attackChargePhase, lockedChargeMultiplier, attackAnimationPhase]);

  useEffect(() => {
    if (!attackResolution || attackAnimationPhase === "idle") return;
    let timer: number;

    if (attackAnimationPhase === "intro") {
      playBattleSfx("attack");
      timer = window.setTimeout(() => setAttackAnimationPhase("impact"), 600);
    } else if (attackAnimationPhase === "impact") {
      playBattleSfx("impact");
      timer = window.setTimeout(() => setAttackAnimationPhase(attackResolution.doubleStrike ? "secondImpact" : "effectiveness"), 650);
    } else if (attackAnimationPhase === "secondImpact") {
      playBattleSfx("impact");
      timer = window.setTimeout(() => setAttackAnimationPhase("effectiveness"), 650);
    } else if (attackAnimationPhase === "effectiveness") {
      timer = window.setTimeout(() => {
        playBattleSfx("hpDrain");
        setTeamHp((current) => ({
          ...current,
          [attackResolution.defenderPlayer]: attackResolution.targets.map((target) => target.afterHp),
        }));
        setAttackAnimationPhase("hp");
      }, 1200);
    } else if (attackAnimationPhase === "hp") {
      timer = window.setTimeout(() => setAttackAnimationPhase("complete"), 2600);
    } else {
      timer = window.setTimeout(() => {
        if (attackTurn === 1) playBattleSfx("handoff");
        setAttackAnimationPhase("idle");
        setAttackResolution(null);
        completeAttackTurn();
      }, 900);
    }

    return () => window.clearTimeout(timer);
  }, [attackAnimationPhase, attackResolution]);

  useEffect(() => () => {
    if (tapPublishTimerRef.current !== null) {
      window.clearTimeout(tapPublishTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setBattleSfxMuted(sfxMuted);
  }, [sfxMuted]);

  useEffect(() => {
    if (sfxMuted) return;
    if (roundFlowComplete) {
      stopBattleMusic();
      playVictoryMusic();
      return;
    }
    void startBattleMusic(activeMusicTrack);
  }, [activeMusicTrack, roundFlowComplete, sfxMuted]);

  useEffect(() => () => stopBattleMusic(), []);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#03010a] text-white" onPointerDownCapture={() => { void unlockBattleAudio().then(() => { if (!roundFlowComplete) void startBattleMusic(activeMusicTrack); }); }}>
      <style>{`
        @keyframes arenaTopEnter {
          0% { opacity: 0; transform: translateY(-24vh) scale(0.94); }
          62% { opacity: 1; transform: translateY(10px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes arenaBottomEnter {
          0% { opacity: 0; transform: translateY(24vh) scale(0.94); }
          62% { opacity: 1; transform: translateY(-10px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes formationTopEnter {
          0% { opacity: 0; transform: translateY(-12vh) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes formationBottomEnter {
          0% { opacity: 0; transform: translateY(12vh) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tiredBreath {
          0%, 100% { transform: translateY(0) rotate(-0.8deg) scale(0.985); }
          50% { transform: translateY(4px) rotate(0.8deg) scale(0.97); }
        }
        @keyframes tiredSweatDrop {
          0% { opacity: 0; transform: translateY(-5px) scale(0.55); }
          18% { opacity: 0.95; }
          72% { opacity: 0.75; }
          100% { opacity: 0; transform: translateY(22px) scale(1.05); }
        }
        @keyframes wheelResultLock {
          0% { transform: scale(1.18); opacity: 0; }
          65% { transform: scale(0.96); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rainbowFlash {
          0% { opacity: 0; transform: scale(0.7); }
          55% { opacity: 1; transform: scale(1.12); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes vRush {
          0% { opacity: 0; transform: translate(-190vw, -50%) skewX(-18deg) scale(1.38); filter: blur(14px); }
          44% { opacity: 1; transform: translate(-62%, -50%) skewX(-12deg) scale(1.24); filter: blur(0); }
          56% { opacity: 1; transform: translate(-55%, -50%) skewX(-8deg) scale(1.05); }
          72% { opacity: 0.18; transform: translate(-61%, -50%) skewX(-8deg) scale(0.86); }
          100% { opacity: 0; transform: translate(-61%, -50%) skewX(-8deg) scale(0.82); }
        }
        @keyframes sRush {
          0% { opacity: 0; transform: translate(190vw, -50%) skewX(18deg) scale(1.38); filter: blur(14px); }
          44% { opacity: 1; transform: translate(-38%, -50%) skewX(12deg) scale(1.24); filter: blur(0); }
          56% { opacity: 1; transform: translate(-45%, -50%) skewX(8deg) scale(1.05); }
          72% { opacity: 0.18; transform: translate(-39%, -50%) skewX(8deg) scale(0.86); }
          100% { opacity: 0; transform: translate(-39%, -50%) skewX(8deg) scale(0.82); }
        }
        @keyframes finalVsGlow {
          0%, 54% { opacity: 0; transform: translate(-50%, -50%) scale(1.55); filter: blur(12px); }
          66% { opacity: 1; transform: translate(-50%, -50%) scale(0.92); filter: blur(0); }
          82% { opacity: 0.98; transform: translate(-50%, -50%) scale(1.04); }
          100% { opacity: 0.98; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes impactFlash { 0%, 45% { opacity: 0; } 54% { opacity: 0.95; } 100% { opacity: 0; } }
        @keyframes shockwave { 0%, 48% { opacity: 0; transform: translate(-50%, -50%) scale(0.25); } 57% { opacity: 0.92; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(3.8); } }
        @keyframes arenaLine { 0% { opacity: 0; transform: scaleX(0); } 55% { opacity: 0; transform: scaleX(0); } 75% { opacity: 0.58; transform: scaleX(1.08); } 100% { opacity: 0.20; transform: scaleX(1); } }
        @keyframes slashGlow { 0% { opacity: 0; transform: translateX(-18%) rotate(-10deg); } 54% { opacity: 0.62; } 100% { opacity: 0.18; transform: translateX(0) rotate(-10deg); } }
        @keyframes pressurePulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.45)); }
          50% { filter: drop-shadow(0 0 30px rgba(251,191,36,0.9)); }
        }
        @keyframes boundaryEnergyPulse {
          0%, 100% { opacity: 0.32; transform: translate(-50%, -50%) scaleX(0.90); }
          50% { opacity: 0.68; transform: translate(-50%, -50%) scaleX(1.08); }
        }
        @keyframes pressureStreak {
          0% { opacity: 0; transform: translate3d(-16vw, 0, 0) scaleX(0.55); }
          40% { opacity: 0.58; }
          100% { opacity: 0; transform: translate3d(16vw, 0, 0) scaleX(1.10); }
        }
        @keyframes tapPanelFlash {
          0% { opacity: 0.9; transform: scale(0.96); }
          100% { opacity: 0; transform: scale(1.08); }
        }
        @keyframes chargeCorePulse {
          0%, 100% { transform: scale(0.94); opacity: 0.72; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes battleWheelSpin { to { transform: rotate(360deg); } }
        @keyframes attackLunge {
          0% { opacity: 0; transform: translateY(26px) scale(0.90); }
          55% { opacity: 1; transform: translateY(-10px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes attackImpact {
          0% { opacity: 0; transform: scale(0.65); }
          45% { opacity: 0.9; transform: scale(1.12); }
          100% { opacity: 0; transform: scale(1.45); }
        }
        @keyframes damagePop {
          0% { opacity: 0; transform: translateY(-4px) scale(0.8); }
          65% { opacity: 1; transform: translateY(2px) scale(1.08); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hitCardShake {
          0%, 100% { transform: translate3d(0,0,0); }
          24% { transform: translate3d(-3px,1px,0); }
          48% { transform: translate3d(3px,-1px,0); }
          72% { transform: translate3d(-2px,0,0); }
        }
        @keyframes hitSplash {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.25); }
          38% { opacity: 1; transform: translate(-50%, -50%) scale(0.92); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.45); }
        }
        @keyframes hitRay {
          0% { opacity: 0; transform: scaleX(0.25); }
          42% { opacity: 0.9; }
          100% { opacity: 0; transform: scaleX(1.25); }
        }
        @keyframes doubleStrikeCard {
          0%, 100% { transform: translate3d(0,0,0) scale(1); filter: brightness(1); }
          20% { transform: translate3d(5px,-2px,0) scale(0.97); filter: brightness(1.65); }
          42% { transform: translate3d(-5px,2px,0) scale(1.04); }
          68% { transform: translate3d(3px,0,0) scale(0.99); }
        }
        @keyframes doubleSlashLeft {
          0% { opacity: 0; transform: translate(-135%, -50%) rotate(-38deg) scaleX(0.3); }
          38% { opacity: 1; transform: translate(-50%, -50%) rotate(-38deg) scaleX(1); }
          100% { opacity: 0; transform: translate(40%, -50%) rotate(-38deg) scaleX(1.2); }
        }
        @keyframes doubleSlashRight {
          0% { opacity: 0; transform: translate(35%, -50%) rotate(38deg) scaleX(0.3); }
          38% { opacity: 1; transform: translate(-50%, -50%) rotate(38deg) scaleX(1); }
          100% { opacity: 0; transform: translate(-135%, -50%) rotate(38deg) scaleX(1.2); }
        }
        @keyframes doubleStrikeBurst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
          35% { opacity: 1; transform: translate(-50%, -50%) scale(0.85); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.65); }
        }
        @keyframes effectivenessBanner {
          0% { opacity: 0; transform: scale(0.72); }
          58% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),transparent_25%),linear-gradient(180deg,rgba(37,99,235,0.20),transparent_44%,rgba(190,18,60,0.22))]" />
      <div className="pointer-events-none absolute inset-x-[-10%] top-[42%] z-10 h-3 rotate-[-10deg] bg-blue-200/20 blur-sm animate-[slashGlow_1300ms_cubic-bezier(0.22,1,0.36,1)_both]" />
      <div className="pointer-events-none absolute inset-x-[-10%] top-[57%] z-10 h-3 rotate-[10deg] bg-red-200/20 blur-sm animate-[slashGlow_1300ms_cubic-bezier(0.22,1,0.36,1)_both]" />
      {roundNumber === 1 && tapRacePhase !== "tapping" && tapRacePhase !== "result" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px origin-center bg-white/40 animate-[arenaLine_1450ms_cubic-bezier(0.22,1,0.36,1)_both]" />
      )}
      <div className="pointer-events-none absolute inset-0 z-20 bg-white animate-[impactFlash_1300ms_ease-out_both]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-28 w-28 rounded-full border border-white/80 animate-[shockwave_1300ms_ease-out_both]" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 text-8xl font-black italic tracking-[-0.18em] text-transparent drop-shadow-[0_0_34px_rgba(96,165,250,1)] animate-[vRush_1350ms_cubic-bezier(0.2,0.95,0.2,1)_both]" style={{ WebkitTextStroke: "2.5px rgba(219,234,254,1)", background: "linear-gradient(135deg, #ffffff 0%, #7dd3fc 42%, #2563eb 100%)", WebkitBackgroundClip: "text" }}>V</div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 text-8xl font-black italic tracking-[-0.18em] text-transparent drop-shadow-[0_0_34px_rgba(248,113,113,1)] animate-[sRush_1350ms_cubic-bezier(0.2,0.95,0.2,1)_both]" style={{ WebkitTextStroke: "2.5px rgba(254,226,226,1)", background: "linear-gradient(135deg, #ffffff 0%, #fb7185 42%, #dc2626 100%)", WebkitBackgroundClip: "text" }}>S</div>
      {roundNumber === 1 && tapRacePhase !== "tapping" && tapRacePhase !== "result" && (
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-40 flex items-center justify-center text-7xl font-black italic tracking-[-0.18em] animate-[finalVsGlow_1500ms_cubic-bezier(0.22,1,0.36,1)_both]"
        style={{ filter: "drop-shadow(0 0 16px rgba(255,255,255,0.72)) drop-shadow(0 0 32px rgba(251,191,36,0.45))" }}
      >
        <span className="relative -top-1 text-transparent" style={{ WebkitTextStroke: "2.5px rgba(219,234,254,1)", background: "linear-gradient(135deg, #ffffff 0%, #7dd3fc 42%, #2563eb 100%)", WebkitBackgroundClip: "text" }}>V</span>
        <span className="relative top-1 text-transparent" style={{ WebkitTextStroke: "2.5px rgba(254,226,226,1)", background: "linear-gradient(135deg, #ffffff 0%, #fb7185 42%, #dc2626 100%)", WebkitBackgroundClip: "text" }}>S</span>
      </div>
      )}

      <button type="button" onClick={onBackToTeams} className="absolute left-3 top-3 z-50 inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-black text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Teams</button>
      <div className="pointer-events-none absolute right-3 top-3 z-50 rounded-2xl border border-amber-300/25 bg-black/45 px-4 py-2 text-right backdrop-blur-md">
        <div className="text-[8px] font-mono font-black uppercase tracking-widest text-amber-200/55">Battle Progress</div>
        <div className="text-sm font-black text-white">Round {roundNumber} / 3</div>
        <div className="text-[7px] font-mono font-black uppercase tracking-widest text-cyan-200/55">♪ {roundFlowComplete ? "Victory Theme" : BATTLE_MUSIC_TRACKS[activeMusicTrack].name}</div>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = !sfxMuted;
          setSfxMuted(next);
          setBattleSfxMuted(next);
        }}
        className="absolute right-3 top-[4.5rem] z-50 grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-black/55 text-white/65 transition active:scale-95"
        aria-label={sfxMuted ? "Enable battle sound" : "Mute battle sound"}
      >
        {sfxMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {(tapRacePhase === "tapping" || tapRacePhase === "result") && (
        <div className="pointer-events-none absolute inset-0 z-25">
          <div
            className="absolute inset-x-0 top-0 transition-[height,background] duration-200 ease-out"
            style={{
              height: `${pressureLine}%`,
              background: `linear-gradient(180deg, rgba(37,99,235,${blueTerritoryOpacity * 0.72}), rgba(56,189,248,${blueTerritoryOpacity}) 74%, rgba(125,211,252,${blueTerritoryOpacity * 0.88}))`,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 transition-[height,background] duration-200 ease-out"
            style={{
              height: `${100 - pressureLine}%`,
              background: `linear-gradient(0deg, rgba(190,18,60,${redTerritoryOpacity * 0.72}), rgba(244,63,94,${redTerritoryOpacity}) 74%, rgba(251,113,133,${redTerritoryOpacity * 0.88}))`,
            }}
          />

          <div
            className="absolute inset-x-0 h-16 -translate-y-1/2 transition-all duration-300 ease-out"
            style={{ top: `${pressureLine}%` }}
          >
            <div
              className="absolute left-1/2 top-1/2 h-3 w-[58vw] rounded-full blur-[2px] animate-[pressureStreak_760ms_ease-in-out_infinite]"
              style={{ background: `linear-gradient(90deg, transparent, ${boundaryColor}, transparent)` }}
            />

            <div
              className="absolute left-0 right-0 top-1/2 z-0 -translate-y-1/2"
              style={{
                height: `${4 + pressureStrength * 4}px`,
                background: `linear-gradient(90deg, transparent, ${boundaryColor}, #fff7ad, ${boundaryColor}, transparent)`,
                boxShadow: `0 0 ${18 + pressureStrength * 26}px ${boundaryGlow}, 0 0 ${8 + pressureStrength * 18}px rgba(255,255,255,0.45)`,
              }}
            />

            <div
              className="absolute left-1/2 top-1/2 z-10 h-8 w-[36vw] rounded-full border animate-[boundaryEnergyPulse_720ms_ease-in-out_infinite]"
              style={{
                borderColor: boundaryColor,
                background: `${boundaryColor}14`,
                boxShadow: `0 0 24px ${boundaryGlow}`,
              }}
            />

            <div
              className="absolute left-1/2 top-1/2 z-20 flex h-20 w-32 items-center justify-center overflow-visible transition-transform duration-200 ease-out"
              style={{
                transform: `translate(-50%, -50%) scale(${1 + pressureStrength * 0.10})`,
                filter: `drop-shadow(0 0 16px rgba(255,255,255,0.78)) drop-shadow(0 0 ${30 + pressureStrength * 22}px ${boundaryGlow})`,
              }}
            >
              <div className="relative flex h-20 w-32 items-center justify-center">
                <div
                  className="absolute left-0 right-0 top-1/2 z-0 h-[3px] -translate-y-1/2"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${boundaryColor}, #fff7ad, ${boundaryColor}, transparent)`,
                    boxShadow: `0 0 ${14 + pressureStrength * 20}px ${boundaryGlow}`,
                  }}
                />
                <div className="relative z-10 flex -translate-y-[2px] items-center justify-center text-7xl font-black italic leading-none tracking-[-0.18em]">
                  <span className="text-transparent" style={{ WebkitTextStroke: "2.2px rgba(219,234,254,1)", background: "linear-gradient(135deg, #ffffff 0%, #7dd3fc 42%, #2563eb 100%)", WebkitBackgroundClip: "text" }}>V</span>
                  <span className="text-transparent" style={{ WebkitTextStroke: "2.2px rgba(254,226,226,1)", background: "linear-gradient(135deg, #ffffff 0%, #fb7185 42%, #dc2626 100%)", WebkitBackgroundClip: "text" }}>S</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="absolute inset-x-0 top-0 h-[43%] overflow-visible bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.18),transparent_62%)]">
        {!bothConfirmed ? (
          <div className={`absolute inset-x-2 top-5 flex origin-center items-start justify-around gap-1 pt-3 ${roundNumber === 1 ? "animate-[arenaTopEnter_1050ms_cubic-bezier(0.22,1,0.36,1)_both]" : ""}`}>
            {selection.player1.map((tagId, index) => {
              const tag = tagsById.get(tagId);
              if (!tag) return null;
              return (
                <div key={`player1-arena-${tagId}-${index}`} className="flex min-w-0 flex-1 rotate-180">
                  <ArenaPortraitChoice
                    tag={tag}
                    slotNumber={index + 1}
                    selected={attackerSelection.player1 === index}
                    confirmed={attackerConfirmed.player1 && attackerSelection.player1 === index}
                    tired={p1TiredSlots.includes(index)}
                    fainted={(teamHp.player1[index] ?? 0) <= 0}
                    onChoose={() => chooseAttacker("player1", index)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`absolute inset-x-0 top-5 h-[calc(100%-3.75rem)] ${roundNumber === 1 ? "animate-[formationTopEnter_600ms_cubic-bezier(0.22,1,0.36,1)_both]" : ""}`}>
            <BattleFormationLane
              player="player1"
              teamIds={selection.player1}
              tagsById={tagsById}
              attackerIndex={attackerSelection.player1 ?? 0}
              confirmed={attackerConfirmed.player1}
              battleScale={p1BattleScale}
              battleGlow={p1BattleGlow}
              tiredSlots={p1TiredSlots}
              hpValues={teamHp.player1}
            />
          </div>
        )}
      </section>

      <section className="pointer-events-none absolute inset-x-0 top-[43%] h-[14%] overflow-visible">
        {tapRacePhase !== "tapping" && tapRacePhase !== "result" && (
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.03] blur-[2px]" />
        )}
      </section>

      <section className="absolute inset-x-0 bottom-0 h-[43%] overflow-visible bg-[radial-gradient(circle_at_50%_100%,rgba(190,18,60,0.18),transparent_62%)]">
        {!bothConfirmed ? (
          <div className={`absolute inset-x-2 bottom-5 flex items-end justify-around gap-1 pb-3 ${roundNumber === 1 ? "animate-[arenaBottomEnter_1050ms_cubic-bezier(0.22,1,0.36,1)_both]" : ""}`}>
            {selection.player2.map((tagId, index) => {
              const tag = tagsById.get(tagId);
              if (!tag) return null;
              return (
                <ArenaPortraitChoice
                  key={`player2-arena-${tagId}-${index}`}
                  tag={tag}
                  slotNumber={index + 1}
                  selected={attackerSelection.player2 === index}
                  confirmed={attackerConfirmed.player2 && attackerSelection.player2 === index}
                  tired={p2TiredSlots.includes(index)}
                  fainted={(teamHp.player2[index] ?? 0) <= 0}
                  onChoose={() => chooseAttacker("player2", index)}
                />
              );
            })}
          </div>
        ) : (
          <div className={`absolute inset-x-0 bottom-5 h-[calc(100%-3.75rem)] ${roundNumber === 1 ? "animate-[formationBottomEnter_600ms_cubic-bezier(0.22,1,0.36,1)_both]" : ""}`}>
            <BattleFormationLane
              player="player2"
              teamIds={selection.player2}
              tagsById={tagsById}
              attackerIndex={attackerSelection.player2 ?? 0}
              confirmed={attackerConfirmed.player2}
              battleScale={p2BattleScale}
              battleGlow={p2BattleGlow}
              tiredSlots={p2TiredSlots}
              hpValues={teamHp.player2}
            />
          </div>
        )}
      </section>

      {tapRacePhase === "idle" && !bothConfirmed && (
        <>
          <div className="absolute left-3 top-[37%] z-50 flex -translate-y-1/2 rotate-180 flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => confirmAttacker("player1")}
              disabled={attackerSelection.player1 === null || attackerConfirmed.player1}
              className="min-h-10 rounded-2xl border border-blue-300/25 bg-blue-500/15 px-4 text-xs font-black text-blue-100 shadow-lg backdrop-blur-md transition hover:bg-blue-500/25 disabled:opacity-60"
            >
              {attackerConfirmed.player1 ? "P1 Confirmed" : "Confirm P1"}
            </button>
            {attackerConfirmed.player1 && !attackerConfirmed.player2 && (
              <div className="rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-white/55">
                Waiting for Player 2
              </div>
            )}
            {attackerConfirmed.player1 && !attackerConfirmed.player2 && (
              <button
                type="button"
                onClick={() => changeAttacker("player1")}
                className="min-h-8 rounded-2xl border border-white/10 bg-black/40 px-3 text-[10px] font-black text-white/55"
              >
                Change
              </button>
            )}
          </div>

          <div className="absolute right-3 top-[63%] z-50 flex -translate-y-1/2 flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => confirmAttacker("player2")}
              disabled={attackerSelection.player2 === null || attackerConfirmed.player2}
              className="min-h-10 rounded-2xl border border-red-300/25 bg-red-500/15 px-4 text-xs font-black text-red-100 shadow-lg backdrop-blur-md transition hover:bg-red-500/25 disabled:opacity-60"
            >
              {attackerConfirmed.player2 ? "P2 Confirmed" : "Confirm P2"}
            </button>
            {attackerConfirmed.player2 && !attackerConfirmed.player1 && (
              <div className="rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-white/55">
                Waiting for Player 1
              </div>
            )}
            {attackerConfirmed.player2 && !attackerConfirmed.player1 && (
              <button
                type="button"
                onClick={() => changeAttacker("player2")}
                className="min-h-8 rounded-2xl border border-white/10 bg-black/40 px-3 text-[10px] font-black text-white/55"
              >
                Change
              </button>
            )}
          </div>
        </>
      )}

      {tapRacePhase === "idle" && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-center text-[10px] font-mono font-black uppercase tracking-widest text-white/45 backdrop-blur-md">
          {bothConfirmed ? "Tap race starting" : bothReady ? "Confirm both attackers" : "Choose attacker from each side"}
        </div>
      )}

      {tapRacePhase !== "idle" && (
        <div className="absolute inset-0 z-[70] overflow-hidden pointer-events-none">
          {tapRacePhase === "countdown" && (
            <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/68 text-center">
              <div className="text-[13px] font-mono font-black uppercase tracking-[0.24em] text-amber-200/75">
                Tap for First Attack
              </div>
              <div className="mt-4 text-[8rem] font-black leading-none text-white drop-shadow-[0_0_36px_rgba(251,191,36,0.8)]">
                {countdown === 0 ? "GO!!" : countdown}
              </div>
            </div>
          )}

          {tapRacePhase === "tapping" && (
            <div className="pointer-events-auto relative h-full">
              <button
                type="button"
                onPointerDown={() => registerTap("player1")}
                className="touch-none select-none absolute right-[4%] top-[7%] flex h-24 w-44 rotate-180 items-center justify-center rounded-[1.8rem] border border-blue-200/30 bg-blue-400/9 text-center shadow-[0_0_30px_rgba(96,165,250,0.26)] backdrop-blur-md transition active:scale-95 active:bg-blue-300/18"
              >
                <span key={`p1-${tapCounts.player1}`} className="pointer-events-none absolute inset-2 rounded-[1.5rem] border border-blue-100/45 animate-[tapPanelFlash_260ms_ease-out_both]" />
                <span className="relative z-10">
                  <span className="block text-[11px] font-mono font-black uppercase tracking-[0.22em] text-blue-100/65">Player 1</span>
                  <span className="block text-3xl font-black leading-none text-blue-100">TAP</span>
                  <span className="mt-0.5 block text-sm font-black text-white/75">{tapCounts.player1}</span>
                </span>
              </button>

              <button
                type="button"
                onPointerDown={() => registerTap("player2")}
                className="touch-none select-none absolute bottom-[7%] left-[4%] flex h-24 w-44 items-center justify-center rounded-[1.8rem] border border-red-200/30 bg-red-400/9 text-center shadow-[0_0_30px_rgba(248,113,113,0.26)] backdrop-blur-md transition active:scale-95 active:bg-red-300/18"
              >
                <span key={`p2-${tapCounts.player2}`} className="pointer-events-none absolute inset-2 rounded-[1.5rem] border border-red-100/45 animate-[tapPanelFlash_260ms_ease-out_both]" />
                <span className="relative z-10">
                  <span className="block text-[11px] font-mono font-black uppercase tracking-[0.22em] text-red-100/65">Player 2</span>
                  <span className="block text-3xl font-black leading-none text-red-100">TAP</span>
                  <span className="mt-0.5 block text-sm font-black text-white/75">{tapCounts.player2}</span>
                </span>
              </button>
            </div>
          )}

          {tapRacePhase === "result" && !roundFlowComplete && attackAnimationPhase === "idle" && attackTurn === 1 && battleWheelPhase === "idle" && attackChargePhase === "idle" && (
            <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-5 text-center backdrop-blur-sm">
              <div className="text-[11px] font-mono font-black uppercase tracking-[0.22em] text-amber-200/70">
                {automaticWinner ? `Round ${roundNumber} · Fresh Advantage` : `Round ${roundNumber} · Tap Race Result`}
              </div>

              <div className="mt-5 grid w-full max-w-lg grid-cols-2 gap-3">
                <div className="rounded-3xl border border-blue-300/20 bg-blue-500/10 p-4">
                  <div className="text-[10px] font-mono font-black uppercase tracking-widest text-blue-100/45">Player 1</div>
                  <div className="mt-1 text-3xl font-black text-blue-100">{automaticWinner ? (p1AttackerTired ? "TIRED" : "FRESH") : tapCounts.player1}</div>
                  <div className="mt-2 text-sm font-black text-white">
                    {selectedAttackerName("player1", selection, tagsById, attackerSelection)}
                  </div>
                </div>
                <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-4">
                  <div className="text-[10px] font-mono font-black uppercase tracking-widest text-red-100/45">Player 2</div>
                  <div className="mt-1 text-3xl font-black text-red-100">{automaticWinner ? (p2AttackerTired ? "TIRED" : "FRESH") : tapCounts.player2}</div>
                  <div className="mt-2 text-sm font-black text-white">
                    {selectedAttackerName("player2", selection, tagsById, attackerSelection)}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-amber-300/25 bg-amber-300/10 px-6 py-4">
                <div className="text-2xl font-black text-white">
                  {winner === "tie" ? "Tie — redo tap race" : `${playerLabel(winner)} attacks first`}
                </div>
                {winner !== "tie" && (
                  <div className="mt-1 text-sm font-bold text-white/60">
                    {automaticWinner ? "Fresh Pokémon attacks first; the opponent follows." : "The Tap Race winner attacks first; the opponent follows."}
                  </div>
                )}
              </div>

              {winner === "tie" && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={redoTapRace}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-2 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white"
                  >
                    Redo Tap Race
                  </button>
                </div>
              )}
              <div className="mt-3 text-[10px] font-mono font-bold uppercase tracking-widest text-white/35">
                {winner === "tie" ? "Tap Race must be replayed" : `${playerLabel(winner)} Battle Wheel starting automatically`}
              </div>
            </div>
          )}

          {tapRacePhase === "result" && !roundFlowComplete && attackAnimationPhase === "idle" && attackTurn === 2 && battleWheelPhase === "idle" && attackChargePhase === "idle" && activeAttackerPlayer && activeAttacker && (
            <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-[#05020d] px-5 text-center">
              <div className={`flex flex-col items-center ${activeAttackerPlayer === "player1" ? "rotate-180" : ""}`}>
                <div className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200/65">Round {roundNumber} · Opponent Attack</div>
                <div className="mt-3 text-4xl font-black text-white">{playerLabel(activeAttackerPlayer)}</div>
                <div className="mt-1 text-xl font-black text-amber-200">{activeAttacker.name}</div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/55">
                  The first attack is complete. The opponent now performs their Battle Wheel and Attack Charge.
                </div>
                <div className="mt-4 text-[10px] font-mono font-black uppercase tracking-widest text-white/35">Battle Wheel starting automatically</div>
              </div>
            </div>
          )}

          {tapRacePhase === "result" && !roundFlowComplete && attackAnimationPhase === "idle" && battleWheelPhase !== "idle" && attackChargePhase === "idle" && activeAttackerPlayer && activeAttacker && activeAttackerProfile && (
            <div className="pointer-events-auto absolute inset-0 overflow-y-auto bg-[#05020d] px-4 py-6 text-center">
              <div className={`mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center ${activeAttackerPlayer === "player1" ? "rotate-180" : ""}`}>
                <div className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-amber-200/65">
                  Round {roundNumber} · {playerLabel(activeAttackerPlayer)} · {attackTurn === 1 ? "First" : "Second"} Attack
                </div>
                <div className="mt-1 text-3xl font-black text-white">{activeAttacker.name}</div>

                <div className="mt-5 grid w-full items-center gap-5 md:grid-cols-[1fr_auto]">
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-left shadow-2xl">
                    <div className="text-[9px] font-mono font-black uppercase tracking-widest text-white/35">Home Battle Profile</div>
                    <div className="mt-2 text-2xl font-black text-white">{activeAttackerProfile.move.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-violet-300/25 bg-violet-500/15 px-3 py-1 text-xs font-black text-violet-100">{activeAttackerProfile.move.type}</span>
                      <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-white/70">{activeAttackerProfile.move.category}</span>
                      <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-100">Power {activeAttackerProfile.move.power}</span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs font-bold text-white/45">
                      {activeAttackerProfile.move.sourceLabel}
                    </div>
                  </div>

                  <div className="relative mx-auto h-64 w-64">
                    <div className="absolute left-1/2 top-[-9px] z-30 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[24px] border-x-transparent border-t-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
                    <div
                      className={`absolute inset-0 rounded-full border-[7px] border-white/15 ${battleWheelPhase === "spinning" ? "animate-[battleWheelSpin_720ms_linear_infinite] will-change-transform" : ""}`}
                      style={{
                        transform: battleWheelPhase === "locked" ? `rotate(${battleWheelTick * 45}deg)` : undefined,
                        backfaceVisibility: "hidden",
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(${BATTLE_WHEEL_OUTCOMES.map((outcome, index) => `${outcome.color} ${index * 45}deg ${(index + 1) * 45}deg`).join(", ")})`,
                          contain: "paint",
                          transform: "translateZ(0)",
                        }}
                      />
                      <div className="absolute inset-[18%] rounded-full border border-white/15 bg-[#0b0615] shadow-[inset_0_0_28px_rgba(0,0,0,0.85)]" />
                    </div>
                    <div className="pointer-events-none absolute inset-[24%] z-20 flex flex-col items-center justify-center rounded-full border border-white/10 bg-black/80 px-2 shadow-2xl">
                      {battleWheelPhase === "spinning" ? (
                        <div className="text-lg font-black text-amber-100">SPINNING</div>
                      ) : lockedWheelOutcome ? (
                        <>
                          <div className={`text-xl font-black ${lockedWheelOutcome.textClass}`}>{lockedWheelOutcome.label}</div>
                          <div className="mt-1 font-mono text-sm font-black text-white/65">×{lockedWheelOutcome.multiplier.toFixed(2)}</div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {battleWheelPhase === "spinning" ? (
                  <button type="button" onClick={stopBattleWheel} className="mt-6 inline-flex min-h-14 min-w-56 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-8 text-lg font-black text-amber-950 shadow-[0_0_34px_rgba(251,191,36,0.38)] transition active:scale-95">
                    TAP TO STOP
                  </button>
                ) : lockedWheelOutcome ? (
                  <div className="mt-6 animate-[wheelResultLock_520ms_cubic-bezier(0.22,1,0.36,1)_both]">
                    <div className="rounded-3xl border border-amber-300/25 bg-amber-300/10 px-7 py-4">
                      <div className="text-[9px] font-mono font-black uppercase tracking-widest text-amber-100/50">Locked Result</div>
                      <div className={`mt-1 text-3xl font-black ${lockedWheelOutcome.textClass}`}>{lockedWheelOutcome.label}</div>
                      <div className="mt-1 font-mono text-lg font-black text-white/70">×{lockedWheelOutcome.multiplier.toFixed(2)}</div>
                    </div>
                    <div className="mt-3 text-[10px] font-mono font-bold uppercase tracking-widest text-white/35">
                      {lockedWheelOutcome.multiplier === 0 ? "Attack missed · charge skipped" : "Attack Charge starting automatically"}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {tapRacePhase === "result" && !roundFlowComplete && attackAnimationPhase === "idle" && attackChargePhase !== "idle" && activeAttackerPlayer && activeAttacker && activeAttackerProfile && lockedWheelOutcome && (
            <div className="pointer-events-auto absolute inset-0 overflow-y-auto bg-[#05020d] px-4 py-6 text-center">
              <div className={`mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center ${activeAttackerPlayer === "player1" && attackChargePhase !== "doubleChallenge" ? "rotate-180" : ""}`}>
                <div className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-amber-200/65">Round {roundNumber} · {attackTurn === 1 ? "First" : "Second"} Attack Charge</div>
                <div className="mt-1 text-3xl font-black text-white">{activeAttacker.name}</div>
                <div className="mt-2 text-sm font-bold text-white/50">{activeAttackerProfile.move.name} · Wheel ×{lockedWheelOutcome.multiplier.toFixed(2)}</div>

                {attackChargePhase === "charging" && (
                  <>
                    <div className="mt-6 w-full rounded-full border border-white/10 bg-black/45 p-1.5">
                      <div className="h-5 rounded-full bg-gradient-to-r from-sky-500 via-amber-300 to-fuchsia-500 transition-all duration-150" style={{ width: `${(chargeTaps / MAX_CHARGE_TAPS) * 100}%` }} />
                    </div>
                    <div className="mt-3 flex items-end justify-center gap-5">
                      <div><div className="text-[9px] font-mono font-black uppercase tracking-widest text-white/35">Time</div><div className="text-3xl font-black text-white">{chargeTimeLeft.toFixed(1)}</div></div>
                      <div><div className="text-[9px] font-mono font-black uppercase tracking-widest text-white/35">Charge</div><div className="text-3xl font-black text-amber-200">{chargeTaps}/{MAX_CHARGE_TAPS}</div></div>
                      <div><div className="text-[9px] font-mono font-black uppercase tracking-widest text-white/35">Power</div><div className="text-3xl font-black text-fuchsia-200">×{chargeMultiplierForTaps(chargeTaps).toFixed(2)}</div></div>
                    </div>
                    <button type="button" onPointerDown={registerChargeTap} className="touch-none relative mt-7 flex h-40 w-64 select-none flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border border-amber-200/35 bg-[#4a2818] text-amber-50 shadow-xl transition active:scale-95">
                      <span className="pointer-events-none absolute inset-4 rounded-[2rem] border border-amber-200/20 bg-[radial-gradient(circle,rgba(251,191,36,0.30),rgba(234,88,12,0.12)_52%,transparent_72%)] animate-[chargeCorePulse_1200ms_ease-in-out_infinite]" />
                      <span className="relative text-4xl font-black">TAP</span>
                      <span className="relative mt-1 text-[10px] font-mono font-black uppercase tracking-[0.24em] text-amber-100/60">Charge Attack</span>
                    </button>
                  </>
                )}

                {attackChargePhase === "rainbowReady" && (
                  <div className="mt-8 w-full rounded-[2.5rem] border border-fuchsia-200/25 bg-[#160b24] p-8 shadow-xl animate-[rainbowFlash_560ms_cubic-bezier(0.22,1,0.36,1)_both]">
                    <div className="text-[10px] font-mono font-black uppercase tracking-[0.28em] text-fuchsia-200/55">Charge Complete</div>
                    <div className="mt-3 text-4xl font-black text-white">RAINBOW CHANCE</div>
                    <div className="mt-4 text-lg font-black text-amber-200">GET READY…</div>
                    <div className="mt-2 text-xs font-bold text-white/45">The timing bar will appear shortly. Taps are temporarily disabled.</div>
                  </div>
                )}

                {attackChargePhase === "rainbow" && (
                  <button type="button" disabled={!rainbowCanLock} onPointerDown={stopRainbowTiming} className="touch-none select-none mt-8 w-full rounded-[2.5rem] border border-fuchsia-200/30 bg-white/5 p-6 shadow-2xl disabled:cursor-wait">
                    <div className="text-2xl font-black text-white">RAINBOW CHANCE</div>
                    <div className="mt-2 text-xs font-bold text-white/50">{rainbowCanLock ? "Centre Rainbow gives ×1.3; the thin gold zone unlocks Double Strike" : "Watch the marker — controls unlocking…"}</div>
                    <div className="relative mt-7 h-16 overflow-hidden rounded-full border border-white/15 bg-gradient-to-r from-blue-600 via-cyan-400 via-45% to-fuchsia-600">
                      <div className="absolute inset-y-0 left-[44%] w-[12%] border-x-2 border-white/80 bg-[linear-gradient(90deg,rgba(239,68,68,0.65),rgba(250,204,21,0.75),rgba(34,197,94,0.7),rgba(59,130,246,0.7),rgba(168,85,247,0.75))] shadow-[0_0_24px_rgba(255,255,255,0.75)]" />
                      <div className="absolute inset-y-0 left-[48%] z-10 w-[4%] border-x-2 border-yellow-100 bg-yellow-200/75 shadow-[0_0_18px_rgba(253,224,71,1)]" />
                      <div className="absolute top-1/2 h-14 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,1)]" style={{ left: `${rainbowPosition}%` }} />
                    </div>
                    <div className="mt-5 text-lg font-black text-fuchsia-100">{rainbowCanLock ? "TAP TO LOCK" : "WAIT…"}</div>
                  </button>
                )}

                {attackChargePhase === "doubleReady" && (
                  <div className="mt-8 w-full rounded-[2.5rem] border border-yellow-200/45 bg-yellow-300/10 p-8 shadow-[0_0_36px_rgba(250,204,21,0.22)] animate-[rainbowFlash_560ms_cubic-bezier(0.22,1,0.36,1)_both]">
                    <div className="text-[10px] font-mono font-black uppercase tracking-[0.28em] text-yellow-100/60">Bonus Zone Locked</div>
                    <div className="mt-3 text-4xl font-black text-white">DOUBLE STRIKE!</div>
                    <div className="mt-3 text-sm font-bold text-white/55">Get ready to pop bubbles 1 → 6. Inputs are temporarily locked.</div>
                  </div>
                )}

                {attackChargePhase === "doubleChallenge" && (
                  <div className={`fixed inset-0 z-[80] overflow-hidden bg-[#05020d]/96 ${activeAttackerPlayer === "player1" ? "rotate-180" : ""}`}>
                    <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-2xl border border-yellow-200/30 bg-black/55 px-5 py-2 backdrop-blur-md">
                      <div className="text-[9px] font-mono font-black uppercase tracking-widest text-yellow-100/60">Pop in order · Next {doubleNextBubble}</div>
                      <div className="text-2xl font-black text-white">{doubleTimeLeft.toFixed(1)}s</div>
                    </div>
                    {doubleBubblePositions.map((position, index) => {
                      const number = index + 1;
                      const popped = number < doubleNextBubble;
                      return (
                        <button
                          type="button"
                          key={number}
                          disabled={popped}
                          onPointerDown={(event) => { event.stopPropagation(); popDoubleBubble(number); }}
                          className={`touch-none absolute grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 select-none place-items-center rounded-full border-2 text-2xl font-black shadow-[inset_0_0_14px_rgba(255,255,255,0.5),0_0_24px_rgba(103,232,249,0.4)] transition active:scale-75 ${popped ? "pointer-events-none scale-150 opacity-0" : number === doubleNextBubble ? "border-yellow-100 bg-gradient-to-br from-cyan-200/80 to-fuchsia-400/70 text-slate-950" : "border-white/35 bg-cyan-300/20 text-white/65"}`}
                          style={{ left: `${position.left}%`, top: `${position.top}%` }}
                          aria-label={`Bubble ${number}`}
                        >
                          {number}
                        </button>
                      );
                    })}
                  </div>
                )}

                {attackChargePhase === "locked" && lockedChargeMultiplier !== null && (
                  <div className="mt-8 animate-[rainbowFlash_560ms_cubic-bezier(0.22,1,0.36,1)_both]">
                    <div className={`rounded-[2rem] border px-8 py-5 ${rainbowHit ? "border-fuchsia-200/45 bg-gradient-to-r from-red-500/15 via-amber-300/20 to-violet-500/20" : "border-amber-300/25 bg-amber-300/10"}`}>
                      <div className="text-[9px] font-mono font-black uppercase tracking-widest text-white/45">Charge Locked</div>
                      <div className="mt-1 text-3xl font-black text-white">{doubleStrike ? "DOUBLE STRIKE!" : rainbowHit ? "RAINBOW!" : `${chargeTaps} TAP CHARGE`}</div>
                      <div className="mt-1 font-mono text-xl font-black text-amber-200">Charge ×{lockedChargeMultiplier.toFixed(2)}</div>
                      <div className="mt-2 text-sm font-black text-white/55">Combined ×{(lockedWheelOutcome.multiplier * lockedChargeMultiplier * (doubleStrike ? DOUBLE_STRIKE_BONUS : 1)).toFixed(2)}</div>
                    </div>
                    <div className="mt-3 text-[10px] font-mono font-bold uppercase tracking-widest text-white/30">Attack animation starting</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tapRacePhase === "result" && !roundFlowComplete && attackResolution && attackAnimationPhase !== "idle" && (
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-[#05020d] px-3 py-5 text-center">
              {(attackAnimationPhase === "impact" || attackAnimationPhase === "secondImpact") && <div key={attackAnimationPhase} className={`absolute inset-0 z-[5] animate-[attackImpact_420ms_ease-out_both] ${attackAnimationPhase === "secondImpact" ? "bg-fuchsia-300/30" : "bg-white/20"}`} />}
              {attackAnimationPhase === "effectiveness" && selectedDamageTarget && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/72 px-5">
                  <div className={`w-full max-w-md rounded-[2rem] border-2 px-6 py-7 shadow-2xl animate-[effectivenessBanner_650ms_cubic-bezier(0.22,1,0.36,1)_both] ${effectivenessTextClass(selectedDamageTarget.effectiveness)} ${attackResolution.attackerPlayer === "player1" ? "rotate-180" : ""}`}>
                    <div className="text-[10px] font-mono font-black uppercase tracking-[0.28em] opacity-65">Type Effectiveness</div>
                    <div className="mt-3 text-4xl font-black leading-tight">{effectivenessLabel(selectedDamageTarget.effectiveness)}!</div>
                    <div className="mt-2 font-mono text-lg font-black opacity-80">Type ×{selectedDamageTarget.effectiveness}</div>
                    <div className="mt-3 text-sm font-black opacity-70">Against {selectedDamageTarget.name}</div>
                  </div>
                </div>
              )}
              <div className="relative z-10 mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center">
                <div className={`flex flex-col items-center ${attackResolution.attackerPlayer === "player1" ? "rotate-180" : ""}`}>
                  <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-amber-200/55">Round {roundNumber} · Attack Resolution</div>
                  <div className="mt-2 animate-[attackLunge_650ms_cubic-bezier(0.22,1,0.36,1)_both]">
                  <div className="text-3xl font-black text-white">{attackResolution.attackerName}</div>
                  <div className="mt-1 text-lg font-black text-amber-200">{attackResolution.moveName}</div>
                  <div className="mt-1 text-[10px] font-mono font-bold uppercase tracking-widest text-white/35">
                    {attackResolution.moveType} · Combined ×{attackResolution.combinedMultiplier.toFixed(2)}
                  </div>
                  {attackResolution.doubleStrike && <div className="mt-2 rounded-full border border-fuchsia-200/40 bg-fuchsia-300/15 px-4 py-1 text-sm font-black text-fuchsia-100">DOUBLE STRIKE · 2 HITS</div>}
                  </div>
                </div>

                <div className="mt-4 grid w-full grid-cols-3 gap-2">
                  {attackResolution.targets.map((target) => {
                    const tag = tagsById.get(target.tagId);
                    const portrait = tag ? getPortraitSources(tag)[0]?.url : undefined;
                    const damageVisible = attackAnimationPhase === "hp" || attackAnimationPhase === "complete";
                    const shownHp = damageVisible ? target.afterHp : target.beforeHp;
                    const hpPercent = target.maxHp > 0 ? (shownHp / target.maxHp) * 100 : 0;
                    const splashColor = target.effectiveness >= 2 ? "border-emerald-100 bg-emerald-300/35" : target.effectiveness < 1 ? "border-orange-100 bg-orange-300/30" : "border-amber-100 bg-amber-200/35";
                    return (
                      <div key={`${target.tagId}-${target.slotIndex}`} className={`relative overflow-hidden rounded-2xl border p-2 ${!target.wasAlreadyFainted && attackAnimationPhase === "impact" ? "animate-[hitCardShake_650ms_ease-out_both]" : ""} ${!target.wasAlreadyFainted && attackAnimationPhase === "secondImpact" ? "animate-[doubleStrikeCard_700ms_ease-out_both]" : ""} ${target.distribution === 1 ? "border-amber-300/35 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
                        {!target.wasAlreadyFainted && attackAnimationPhase === "impact" && (
                          <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
                            <div className={`absolute left-1/2 top-1/2 h-28 w-28 rounded-full border-4 animate-[hitSplash_650ms_ease-out_both] ${splashColor}`} />
                            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                              <div key={angle} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${angle}deg)` }}>
                                <span className="absolute left-2 top-[-1px] h-[3px] w-14 origin-left bg-white animate-[hitRay_650ms_ease-out_both]" />
                              </div>
                            ))}
                          </div>
                        )}
                        {!target.wasAlreadyFainted && attackAnimationPhase === "secondImpact" && (
                          <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
                            <div className="absolute left-1/2 top-1/2 h-24 w-24 rounded-full border-4 border-fuchsia-100 bg-fuchsia-300/25 shadow-[0_0_24px_rgba(232,121,249,0.9)] animate-[doubleStrikeBurst_700ms_ease-out_both]" />
                            <div className="absolute left-1/2 top-1/2 h-2 w-36 origin-center rounded-full bg-gradient-to-r from-transparent via-white to-fuchsia-300 shadow-[0_0_14px_rgba(255,255,255,1)] animate-[doubleSlashLeft_700ms_ease-out_both]" />
                            <div className="absolute left-1/2 top-1/2 h-2 w-36 origin-center rounded-full bg-gradient-to-r from-transparent via-yellow-100 to-cyan-300 shadow-[0_0_14px_rgba(253,224,71,1)] animate-[doubleSlashRight_700ms_ease-out_both]" />
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-xl font-black italic text-white drop-shadow-[0_0_10px_rgba(217,70,239,1)] animate-[damagePop_520ms_ease-out_both]">2nd HIT!</div>
                          </div>
                        )}
                        <div className={attackResolution.defenderPlayer === "player1" ? "rotate-180" : ""}>
                          <div className="text-[7px] font-mono font-black uppercase tracking-widest text-white/35">{target.distribution === 1 ? "Selected" : "Support"}</div>
                          {portrait && <img src={portrait} alt="" className="mx-auto mt-1 h-16 w-16 object-contain" draggable={false} />}
                          <div className="truncate text-[10px] font-black text-white">{target.name}</div>
                          {attackAnimationPhase === "effectiveness" && (
                            <div className={`mx-auto mt-1 rounded-full border px-1.5 py-0.5 text-[6px] font-mono font-black uppercase tracking-tight ${effectivenessTextClass(target.effectiveness)}`}>
                              {effectivenessLabel(target.effectiveness)}
                            </div>
                          )}
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/55">
                            <div className={`h-full rounded-full transition-[width] duration-700 ${hpPercent > 50 ? "bg-emerald-400" : hpPercent > 20 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${hpPercent}%` }} />
                          </div>
                          <div className="mt-1 font-mono text-[8px] font-black text-white/50">{shownHp}/{target.maxHp} HP</div>
                          {damageVisible && (
                            <div className="mt-1 animate-[damagePop_420ms_ease-out_both]">
                              <div className="text-sm font-black text-red-300">{target.wasAlreadyFainted ? "FAINTED" : target.damage > 0 ? `-${target.damage}` : "NO DAMAGE"}</div>
                              <div className={`text-[6px] font-mono font-black uppercase tracking-wide ${target.effectiveness >= 2 ? "text-emerald-300" : target.effectiveness < 1 ? "text-orange-300" : "text-white/45"}`}>{target.wasAlreadyFainted ? "ALREADY AT 0 HP" : effectivenessLabel(target.effectiveness)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`mt-5 text-sm font-black text-white/55 ${attackResolution.attackerPlayer === "player1" ? "rotate-180" : ""}`}>
                  {attackAnimationPhase === "intro" ? "ATTACKING…" : attackAnimationPhase === "impact" ? (attackResolution.doubleStrike ? "FIRST HIT!" : "IMPACT!") : attackAnimationPhase === "secondImpact" ? "SECOND HIT!" : attackAnimationPhase === "effectiveness" ? "TYPE EFFECTIVENESS" : attackAnimationPhase === "hp" ? "CHECK REMAINING HP" : attackTurn === 1 ? "OPPONENT ATTACK NEXT" : "ROUND COMPLETE"}
                </div>
              </div>
            </div>
          )}

          {tapRacePhase === "result" && roundFlowComplete && (
            <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-[#05020d] px-5 text-center">
              <VictoryFireworks active={roundFlowComplete} winner={matchWinner} />
              <div className={`relative z-10 flex flex-col items-center ${matchWinner === "player1" ? "rotate-180" : ""}`}>
              <div className="text-[11px] font-mono font-black uppercase tracking-[0.22em] text-amber-200/70">Battle Complete</div>
              <div className={`mt-3 font-black text-white drop-shadow-[0_0_28px_rgba(250,204,21,0.55)] ${matchWinner ? "text-6xl sm:text-7xl" : "text-4xl"}`}>{matchResultLabel}</div>
              <div className="mt-5 grid w-full max-w-lg grid-cols-2 gap-3">
                <div className={`rounded-3xl border border-blue-300/20 bg-blue-500/10 p-4 transition-transform ${matchWinner === "player1" ? "scale-110 border-blue-200/55 bg-blue-400/20 shadow-[0_0_32px_rgba(96,165,250,0.32)]" : matchWinner ? "scale-90 opacity-55" : ""}`}>
                  <div className="text-[9px] font-mono font-black uppercase tracking-widest text-blue-100/45">Player 1</div>
                  <div className="mt-1 text-2xl font-black text-blue-100">{p1Survivors} Pokémon</div>
                  <div className="mt-1 font-mono text-sm font-black text-white/55">{p1RemainingHp} HP</div>
                </div>
                <div className={`rounded-3xl border border-red-300/20 bg-red-500/10 p-4 transition-transform ${matchWinner === "player2" ? "scale-110 border-red-200/55 bg-red-400/20 shadow-[0_0_32px_rgba(248,113,113,0.32)]" : matchWinner ? "scale-90 opacity-55" : ""}`}>
                  <div className="text-[9px] font-mono font-black uppercase tracking-widest text-red-100/45">Player 2</div>
                  <div className="mt-1 text-2xl font-black text-red-100">{p2Survivors} Pokémon</div>
                  <div className="mt-1 font-mono text-sm font-black text-white/55">{p2RemainingHp} HP</div>
                </div>
              </div>
              <p className="mt-4 max-w-lg text-xs leading-relaxed text-white/45">
                {Object.keys(roundWheelResults).length} wheel results and {Object.keys(roundChargeResults).length} charge results stored. HP carried across all rounds.
              </p>
              <button type="button" onClick={restartRoundFlow} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-6 text-sm font-black text-amber-950 shadow-lg shadow-amber-950/40">
                <RotateCcw className="h-4 w-4" /> Restart Battle
              </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export function BattleSetup({ ownedTags, onBackToCollection }: BattleSetupProps) {
  const [selection, setSelection] = useState<BattleSelection>({ player1: [], player2: [] });
  const [searchTerm, setSearchTerm] = useState("");
  const [detailTag, setDetailTag] = useState<MezastarTag | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [battleStarted, setBattleStarted] = useState(false);
  const [attackerSelection, setAttackerSelection] = useState<RoundAttackerSelection>({
    player1: null,
    player2: null,
  });

  const tagsById = useMemo(
    () => new Map(ownedTags.map((tag) => [tag.id, tag])),
    [ownedTags],
  );

  useEffect(() => {
    const warmTargets = ownedTags.slice(0, 18);
    warmTargets.forEach((tag) => {
      getPortraitSources(tag)
        .slice(0, 2)
        .forEach((source) => {
          const img = new Image();
          img.src = source.url;
          img.decoding = "async";
          img.referrerPolicy = "no-referrer";
        });
    });
  }, [ownedTags]);

  const filteredTags = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return ownedTags
      .filter((tag) => {
        if (!search) return true;
        return (
          tag.name.toLowerCase().includes(search) ||
          tag.id.toLowerCase().includes(search) ||
          tag.pokedexNo.toLowerCase().includes(search) ||
          tag.officialTagCode?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => b.energy - a.energy || a.name.localeCompare(b.name));
  }, [ownedTags, searchTerm]);

  const totalSelected = selection.player1.length + selection.player2.length;
  const isComplete = selection.player1.length === TEAM_SIZE && selection.player2.length === TEAM_SIZE;

  function addToTeam(player: PlayerKey, tagId: string) {
    const tag = tagsById.get(tagId);
    if (!tag) return;

    const ownedCopies = getOwnedCopies(tag);
    const usedCopies = countSelected(tagId, selection);
    const availableCopies = ownedCopies - usedCopies;

    if (availableCopies <= 0) return;
    if (selection[player].length >= TEAM_SIZE) return;

    setShowPreview(false);
    setSelection((current) => ({
      ...current,
      [player]: [...current[player], tagId],
    }));
  }

  function removeFromTeam(player: PlayerKey, index: number) {
    setShowPreview(false);
    setSelection((current) => ({
      ...current,
      [player]: current[player].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function resetTeams() {
    setShowPreview(false);
    setBattleStarted(false);
    setAttackerSelection({ player1: null, player2: null });
    setSelection({ player1: [], player2: [] });
  }

  function startBattlePrep() {
    setShowPreview(false);
    setBattleStarted(true);
    setAttackerSelection({ player1: null, player2: null });
  }

  function selectAttacker(player: PlayerKey, slotIndex: number | null) {
    setAttackerSelection((current) => ({
      ...current,
      [player]: slotIndex,
    }));
  }

  if (battleStarted) {
    return (
      <BattleRoundPrep
        selection={selection}
        tagsById={tagsById}
        attackerSelection={attackerSelection}
        onSelectAttacker={selectAttacker}
        onBackToTeams={() => {
          setBattleStarted(false);
          setAttackerSelection({ player1: null, player2: null });
        }}
      />
    );
  }

  if (ownedTags.length === 0) {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
        <Users className="mx-auto h-12 w-12 text-white/25" />
        <h1 className="mt-4 text-2xl font-black text-white">No owned tags available for battle.</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Add physical tags to My Collection first, then come back to Battle Mode.
        </p>
        <button
          type="button"
          onClick={onBackToCollection}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-black text-white transition hover:bg-white/15"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Collection
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/15 blur-[95px]" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-blue-500/10 blur-[90px]" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-red-200">
              <Swords className="h-4 w-4" />
              Battle Mode · Phase 1
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Choose 3 tags for each player
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">
              This follows your physical draw flow. A same Pokémon/tag can be selected multiple times only when your owned quantity allows it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBackToCollection}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              My Collection
            </button>
            <button
              type="button"
              onClick={resetTeams}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Teams
            </button>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[9px] font-mono font-black uppercase tracking-widest text-white/35">Physical tags selected</div>
            <div className="mt-1 text-2xl font-black text-white">{totalSelected}/6</div>
          </div>
          <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
            <div className="text-[9px] font-mono font-black uppercase tracking-widest text-blue-100/50">Player 1</div>
            <div className="mt-1 text-2xl font-black text-blue-100">{selection.player1.length}/3</div>
          </div>
          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
            <div className="text-[9px] font-mono font-black uppercase tracking-widest text-red-100/50">Player 2</div>
            <div className="mt-1 text-2xl font-black text-red-100">{selection.player2.length}/3</div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <TeamPanel
          title="Player 1 Team"
          player="player1"
          teamIds={selection.player1}
          tagsById={tagsById}
          onRemove={(index) => removeFromTeam("player1", index)}
        />
        <TeamPanel
          title="Player 2 Team"
          player="player2"
          teamIds={selection.player2}
          tagsById={tagsById}
          onRemove={(index) => removeFromTeam("player2", index)}
        />
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-white/35">
              Owned Tag Selector
            </div>
            <h2 className="mt-1 text-xl font-black text-white">Select from physical owned quantity</h2>
          </div>

          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search Pokémon, printed code, or serial…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                aria-label="Clear battle search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredTags.map((tag) => {
            const ownedCopies = getOwnedCopies(tag);
            const selectedCopies = countSelected(tag.id, selection);
            const availableCopies = ownedCopies - selectedCopies;
            const p1Full = selection.player1.length >= TEAM_SIZE;
            const p2Full = selection.player2.length >= TEAM_SIZE;

            return (
              <SelectorTagCard
                key={tag.id}
                tag={tag}
                ownedCopies={ownedCopies}
                selectedCopies={selectedCopies}
                availableCopies={availableCopies}
                player1Full={p1Full}
                player2Full={p2Full}
                onDetails={() => setDetailTag(tag)}
                onAddPlayer1={() => addToTeam("player1", tag.id)}
                onAddPlayer2={() => addToTeam("player2", tag.id)}
              />
            );
          })}
        </div>
      </section>

      <aside className="sticky bottom-3 z-30 rounded-3xl border border-amber-300/30 bg-[#1b102c]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-amber-300">
              Battle setup status
            </div>
            <p className="mt-1 text-sm font-bold text-white">
              {isComplete
                ? "Both teams are ready. Preview is available."
                : "Choose exactly 3 physical tags for Player 1 and Player 2."}
            </p>
          </div>

          <button
            type="button"
            disabled={!isComplete}
            onClick={() => setShowPreview(true)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-5 py-3 text-sm font-black text-amber-950 shadow-lg shadow-amber-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trophy className="h-4 w-4" />
            Preview Teams
          </button>
        </div>
      </aside>

      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-md sm:px-6">
          <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#10081d]/95 shadow-2xl shadow-black/70">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-300">
                  <BadgeCheck className="h-4 w-4" />
                  Team Preview
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">Ready to Enter Battle Arena</h2>
                <p className="mt-1 text-sm text-white/55">
                  Confirm both teams, then enter the arena for the cinematic battle intro and Round 1 attacker selection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close team preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-white/10 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={startBattlePrep}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-5 py-3 text-sm font-black text-amber-950 shadow-lg shadow-amber-950/40 transition hover:brightness-110 sm:w-auto"
              >
                <Play className="h-4 w-4" />
                Enter Battle Arena
              </button>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
              {(["player1", "player2"] as PlayerKey[]).map((player) => (
                <section key={player} className={`rounded-[2rem] border p-4 ${player === "player1" ? "border-blue-300/20 bg-blue-500/5" : "border-red-300/20 bg-red-500/5"}`}>
                  <div className="mb-4 flex items-center gap-2">
                    {player === "player1" ? <Shield className="h-5 w-5 text-blue-200" /> : <Swords className="h-5 w-5 text-red-200" />}
                    <h3 className="text-xl font-black text-white">{playerLabel(player)}</h3>
                  </div>

                  <div className="grid gap-4">
                    {selection[player].map((tagId, index) => {
                      const tag = tagsById.get(tagId);
                      if (!tag) return null;
                      return (
                        <TeamPreviewPortrait
                          key={`${player}-preview-${tagId}-${index}`}
                          tag={tag}
                          slotNumber={index + 1}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {detailTag && (
        <TagDetailModal tag={detailTag} onClose={() => setDetailTag(null)} />
      )}
    </div>
  );
}
