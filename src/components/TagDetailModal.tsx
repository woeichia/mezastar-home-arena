import { useState } from "react";
import {
  X,
  BadgeCheck,
  CircleHelp,
  Star,
  Zap,
  Swords,
  Shield,
  Gauge,
  Heart,
} from "lucide-react";
import type { MezastarTag } from "../types";
import { getElementColors } from "../data/tags";
import { getPortraitSources, getPortraitTreatment } from "../utils/portraitResolver";

interface TagDetailModalProps {
  tag: MezastarTag;
  onClose: () => void;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <div className="text-[9px] font-mono font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <div className="mt-1 min-h-5 break-words text-sm font-black text-white">
        {value === undefined || value === "" ? "—" : value}
      </div>
    </div>
  );
}

function StatBar({
  label,
  value,
  colorClass,
  icon,
}: {
  label: string;
  value: number;
  colorClass: string;
  icon: React.ReactNode;
}) {
  const width = Math.min(100, Math.max(8, (value / 220) * 100));

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-widest text-white/50">
          {icon}
          {label}
        </span>
        <span className="text-lg font-black text-white">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function PokemonPortraitPanel({ tag }: { tag: MezastarTag }) {
  const [portraitIndex, setPortraitIndex] = useState(0);
  const primaryType = getElementColors(tag.type1);
  const secondaryType = tag.type2 ? getElementColors(tag.type2) : null;
  const portraitSources = getPortraitSources(tag);
  const portraitSource = portraitSources[portraitIndex];
  const treatment = getPortraitTreatment(tag);
  const printedCode = tag.officialTagCode || tag.pokedexNo;

  return (
    <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.045] p-4 shadow-2xl">
      <div className={`absolute -left-16 -top-16 h-48 w-48 rounded-full ${primaryType.bg} opacity-25 blur-[70px]`} />
      <div className="absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-purple-500/20 blur-[75px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.14),transparent_45%)]" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-mono font-black uppercase tracking-widest text-white/60">
              {printedCode}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${primaryType.bg} ${primaryType.text} ${primaryType.border}`}>
              {tag.type1}
            </span>
            {tag.type2 && secondaryType && (
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${secondaryType.bg} ${secondaryType.text} ${secondaryType.border}`}>
                {tag.type2}
              </span>
            )}
          </div>

          <h3 className="mt-3 text-2xl font-black leading-none tracking-tight text-white">
            {tag.name}
          </h3>
          <div className="mt-2 flex gap-0.5" aria-label={`${tag.stars} stars`}>
            {Array.from({ length: tag.stars }).map((_, index) => (
              <svg key={index} className="h-4 w-4 fill-amber-300 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-center">
          <div className="text-[8px] font-mono font-black uppercase tracking-widest text-amber-100/70">
            Energy
          </div>
          <div className="text-2xl font-black text-amber-200">
            {tag.energy}
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex min-h-[19rem] items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
        <div className="absolute inset-0 opacity-35">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.045)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.045)_50%,rgba(255,255,255,0.045)_75%,transparent_75%,transparent)] bg-[length:26px_26px]" />
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
            className={`relative z-10 max-h-[18rem] max-w-[95%] object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.75)] ${treatment.glowClassName}`}
            style={{
              transform: `translateY(${tag.portraitOffsetY ?? 0}px) scale(${tag.portraitScale ?? 1})`,
            }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="relative z-10 flex h-40 w-40 flex-col items-center justify-center rounded-full border border-white/20 bg-black/25 text-center shadow-inner">
            <CircleHelp className="h-14 w-14 text-white/75" />
            <span className="mt-2 px-4 text-[10px] font-mono font-black uppercase tracking-wider text-white/70">
              Needs Match
            </span>
          </div>
        )}
      </div>

      <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-white/55">
        Portrait uses the best available source for this tag. Exact form artwork can later be overridden per printed tag code.
      </div>
    </div>
  );
}

export function TagDetailModal({ tag, onClose }: TagDetailModalProps) {
  const primaryType = getElementColors(tag.type1);
  const secondaryType = tag.type2 ? getElementColors(tag.type2) : null;
  const primaryMove = tag.moves?.[0];
  const printedCode = tag.officialTagCode || tag.pokedexNo;
  const ownedCopies = tag.copiesOwned ?? (tag.owned ? 1 : 0);
  const sourceLabel =
    tag.sourceStatus === "verified"
      ? "Verified catalogue"
      : tag.sourceStatus === "needs-review"
        ? "Needs match"
        : "Fixture / demo data";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-md sm:px-6">
      <div className="relative w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#10081d]/95 shadow-2xl shadow-black/70">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-purple-600/20 blur-[110px]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-amber-500/10 blur-[120px]" />

        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono font-black uppercase tracking-widest text-white/55">
                {printedCode}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${primaryType.bg} ${primaryType.text} ${primaryType.border}`}>
                {tag.type1}
              </span>
              {tag.type2 && secondaryType && (
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${secondaryType.bg} ${secondaryType.text} ${secondaryType.border}`}>
                  {tag.type2}
                </span>
              )}
            </div>

            <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight text-white">
              {tag.name}
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">
              Large portrait view plus full tag information. The small card back can stay clean and readable.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[25rem_1fr]">
          <aside className="flex flex-col gap-4">
            <PokemonPortraitPanel tag={tag} />

            <div className="grid w-full grid-cols-2 gap-3">
              <DetailRow label="Owned copies" value={ownedCopies} />
              <DetailRow label="Source" value={sourceLabel} />
            </div>

            <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-white/40">
                <BadgeCheck className="h-3.5 w-3.5" />
                Source note
              </div>
              <p className="text-sm leading-relaxed text-white/65">
                {tag.sourceNote ||
                  (tag.sourceStatus === "verified"
                    ? "Matched to the imported verified catalogue."
                    : tag.sourceStatus === "needs-review"
                      ? "This tag was added manually and still needs a verified catalogue match."
                      : "Fixture data retained for layout and interaction testing.")}
              </p>
            </div>
          </aside>

          <section className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailRow label="Series" value={tag.series} />
              <DetailRow label="Rarity" value={tag.rarity} />
              <DetailRow label="Stars" value={`${tag.stars}★`} />
              <DetailRow label="Energy" value={tag.energy} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-white/40">
                <Star className="h-3.5 w-3.5 text-amber-300" />
                Battle Stat Matrix
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatBar label="HP" value={tag.stats.hp} colorClass="bg-rose-500" icon={<Heart className="h-3.5 w-3.5" />} />
                <StatBar label="Attack" value={tag.stats.attack} colorClass="bg-amber-500" icon={<Swords className="h-3.5 w-3.5" />} />
                <StatBar label="Defense" value={tag.stats.defense} colorClass="bg-blue-500" icon={<Shield className="h-3.5 w-3.5" />} />
                <StatBar label="Speed" value={tag.stats.speed} colorClass="bg-teal-500" icon={<Gauge className="h-3.5 w-3.5" />} />
                <StatBar label="Sp. Attack" value={tag.stats.spAtk} colorClass="bg-fuchsia-500" icon={<Zap className="h-3.5 w-3.5" />} />
                <StatBar label="Sp. Defense" value={tag.stats.spDef} colorClass="bg-indigo-500" icon={<Shield className="h-3.5 w-3.5" />} />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-white/40">
                  <Swords className="h-3.5 w-3.5" />
                  Main Battle Move
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-black text-white">
                      {primaryMove?.name || "Move not recorded"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${getElementColors(primaryMove?.type || tag.type1).bg} ${getElementColors(primaryMove?.type || tag.type1).text}`}>
                        {primaryMove?.type || tag.type1}
                      </span>
                      <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase text-white/55">
                        {primaryMove?.category || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-center">
                    <div className="text-[9px] font-mono font-black uppercase tracking-widest text-red-200/70">
                      Power
                    </div>
                    <div className="text-2xl font-black text-red-100">
                      {primaryMove?.power ?? "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-white/40">
                  <CircleHelp className="h-3.5 w-3.5" />
                  Catalogue Details
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Pokédex / artwork ID" value={tag.pokemonId > 0 ? tag.pokemonId : "Unknown"} />
                  <DetailRow label="Printed code" value={printedCode} />
                  <DetailRow label="Record ID" value={tag.id} />
                  <DetailRow label="Special feature" value={tag.specialFeature} />
                </div>
              </div>
            </div>

            {tag.desc && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-white/40">
                  Description
                </div>
                <p className="text-sm leading-relaxed text-white/70">{tag.desc}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
