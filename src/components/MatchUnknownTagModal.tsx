import { useMemo, useState } from "react";
import { CheckCircle, Link2, Search, X } from "lucide-react";
import type { MezastarTag } from "../types";
import { getElementColors } from "../data/tags";

interface MatchUnknownTagModalProps {
  unknownTag: MezastarTag;
  catalogueTags: MezastarTag[];
  onClose: () => void;
  onConfirm: (unknownTagId: string, catalogueTagId: string) => void;
}

export function MatchUnknownTagModal({
  unknownTag,
  catalogueTags,
  onClose,
  onConfirm,
}: MatchUnknownTagModalProps) {
  const [searchTerm, setSearchTerm] = useState(
    unknownTag.officialTagCode || unknownTag.pokedexNo || unknownTag.name,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return catalogueTags
      .filter((tag) => tag.id !== unknownTag.id)
      .filter((tag) => tag.sourceStatus === "verified")
      .filter((tag) => {
        if (!search) return true;
        return (
          tag.name.toLowerCase().includes(search) ||
          tag.id.toLowerCase().includes(search) ||
          tag.pokedexNo.toLowerCase().includes(search) ||
          tag.officialTagCode?.toLowerCase().includes(search) ||
          tag.series?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const aNameMatch = a.name.toLowerCase() === unknownTag.name.toLowerCase() ? 0 : 1;
        const bNameMatch = b.name.toLowerCase() === unknownTag.name.toLowerCase() ? 0 : 1;
        if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;
        return (a.officialTagCode || a.id).localeCompare(b.officialTagCode || b.id);
      })
      .slice(0, 30);
  }, [catalogueTags, searchTerm, unknownTag.id, unknownTag.name]);

  const selectedTag = candidates.find((tag) => tag.id === selectedId);
  const unknownCopies = unknownTag.copiesOwned ?? (unknownTag.owned ? 1 : 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-md sm:px-6">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#10081d]/95 shadow-2xl shadow-black/70">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[100px]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-amber-500/10 blur-[110px]" />

        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-fuchsia-200">
              <Link2 className="h-3.5 w-3.5" /> Match Unknown Tag
            </div>
            <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-white">
              Link {unknownTag.name} to a verified catalogue record
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
              The unknown record will be removed, and its owned copy count will be transferred to the selected verified tag.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close match modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[18rem_1fr]">
          <aside className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-4">
            <div className="text-[10px] font-mono font-black uppercase tracking-widest text-fuchsia-100/70">
              Current unknown tag
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xl font-black text-white">{unknownTag.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase text-white/65">
                  {unknownTag.officialTagCode || unknownTag.pokedexNo || unknownTag.id}
                </span>
                <span className="rounded-full border border-fuchsia-200/20 bg-fuchsia-200/10 px-2 py-1 text-[10px] font-black uppercase text-fuchsia-100">
                  Needs Match
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-[9px] font-mono font-black uppercase tracking-widest text-white/35">Copies</div>
                  <div className="text-lg font-black text-white">{unknownCopies}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-[9px] font-mono font-black uppercase tracking-widest text-white/35">Energy</div>
                  <div className="text-lg font-black text-white">{unknownTag.energy}</div>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search printed code, Pokémon name, serial, or version…"
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-500/30"
              />
            </div>

            <div className="max-h-[24rem] overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.04] p-2">
              {candidates.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-white/55">
                  No verified catalogue records match this search.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {candidates.map((tag) => {
                    const isSelected = selectedId === tag.id;
                    const typeColor = getElementColors(tag.type1);
                    const ownedCopies = tag.copiesOwned ?? (tag.owned ? 1 : 0);

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setSelectedId(tag.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                          isSelected
                            ? "border-amber-300 bg-amber-300/15 shadow-[0_0_22px_rgba(252,211,77,0.2)]"
                            : "border-white/10 bg-black/20 hover:bg-white/8"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-black text-white">{tag.name}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}>
                              {tag.type1}
                            </span>
                            {ownedCopies > 0 && (
                              <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-950">
                                In Binder ×{ownedCopies}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-mono font-black uppercase tracking-wider text-white/45">
                            <span>{tag.officialTagCode || tag.id}</span>
                            <span>{tag.series}</span>
                            <span>{tag.rarity}</span>
                            <span>{tag.stars}★</span>
                          </div>
                        </div>

                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${isSelected ? "border-amber-300 bg-amber-300 text-amber-950" : "border-white/10 bg-white/5 text-white/35"}`}>
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/60">
                {selectedTag ? (
                  <>
                    Match to <strong className="text-white">{selectedTag.name}</strong> · <span className="font-mono text-amber-200">{selectedTag.officialTagCode || selectedTag.id}</span>
                  </>
                ) : (
                  "Choose the verified catalogue record that matches your physical tag."
                )}
              </div>
              <button
                type="button"
                disabled={!selectedTag}
                onClick={() => selectedTag && onConfirm(unknownTag.id, selectedTag.id)}
                className="min-h-11 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-5 py-2.5 text-sm font-black text-amber-950 shadow-lg shadow-amber-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm Match
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
