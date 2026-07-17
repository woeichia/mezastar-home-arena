import { useEffect, useMemo, useState } from "react";
import {
  BadgePlus,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Search,
  Sparkles,
  X,
  Eye,
} from "lucide-react";
import { Rarity, type MezastarTag, type TagSeries } from "../types";
import { getElementColors } from "../data/tags";
import { MezastarCard } from "./MezastarCard";
import { TagDetailModal } from "./TagDetailModal";

interface CatalogueBrowserProps {
  tags: MezastarTag[];
  onClose: () => void;
  onAddToCollection: (quantities: Record<string, number>) => void;
  onAddUnknownTag: () => void;
}

const SERIES_FILTERS: Array<"All" | TagSeries> = [
  "All",
  "Version 1",
  "Version 2",
  "Version 3",
  "Version 4",
  "Galaxy Version 1",
  "Galaxy Version 2",
  "Unknown",
  "Fixture",
];

const CATALOGUE_PAGE_SIZE = 30;

export function CatalogueBrowser({
  tags,
  onClose,
  onAddToCollection,
  onAddUnknownTag,
}: CatalogueBrowserProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRarity, setSelectedRarity] = useState<string>("All");
  const [selectedElement, setSelectedElement] = useState<string>("All");
  const [selectedSeries, setSelectedSeries] = useState<"All" | TagSeries>("All");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [detailTag, setDetailTag] = useState<MezastarTag | null>(null);
  const [visibleCount, setVisibleCount] = useState(CATALOGUE_PAGE_SIZE);

  const availableElements = useMemo(() => {
    const values = new Set<string>();
    tags.forEach((tag) => {
      values.add(tag.type1);
      if (tag.type2) values.add(tag.type2);
    });
    return ["All", ...Array.from(values).sort()];
  }, [tags]);

  const filteredTags = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return tags.filter((tag) => {
      const matchesSearch =
        !search ||
        tag.name.toLowerCase().includes(search) ||
        tag.id.toLowerCase().includes(search) ||
        tag.pokedexNo.toLowerCase().includes(search) ||
        tag.officialTagCode?.toLowerCase().includes(search);

      const matchesRarity = selectedRarity === "All" || tag.rarity === selectedRarity;
      const matchesElement =
        selectedElement === "All" ||
        tag.type1 === selectedElement ||
        tag.type2 === selectedElement;
      const series = tag.series ?? "Fixture";
      const matchesSeries = selectedSeries === "All" || series === selectedSeries;

      return matchesSearch && matchesRarity && matchesElement && matchesSeries;
    });
  }, [tags, searchTerm, selectedRarity, selectedElement, selectedSeries]);

  const selectedEntries = useMemo(
    () => tags.filter((tag) => selected[tag.id]).map((tag) => ({ tag, quantity: selected[tag.id] })),
    [selected, tags],
  );

  useEffect(() => {
    setVisibleCount(CATALOGUE_PAGE_SIZE);
  }, [searchTerm, selectedRarity, selectedElement, selectedSeries]);

  const visibleTags = useMemo(
    () => filteredTags.slice(0, visibleCount),
    [filteredTags, visibleCount],
  );

  const selectedCopyCount = selectedEntries.reduce((total, entry) => total + entry.quantity, 0);

  function toggleSelected(tag: MezastarTag) {
    setSelected((current) => {
      const next = { ...current };
      if (next[tag.id]) delete next[tag.id];
      else next[tag.id] = Math.max(1, tag.copiesOwned ?? (tag.owned ? 1 : 1));
      return next;
    });
  }

  function setQuantity(tagId: string, quantity: number) {
    setSelected((current) => ({ ...current, [tagId]: Math.max(1, Math.min(9, quantity)) }));
  }

  function addSelected() {
    if (!selectedEntries.length) return;
    onAddToCollection(selected);
    setSelected({});
    onClose();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/10 blur-[90px]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> Catalogue & Match Desk
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Find the physical tags you own</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
              Search the printed code first when possible. For a third-party tag whose version is unclear, add it to the Needs Match tray instead of guessing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onAddUnknownTag} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/35 bg-fuchsia-400/10 px-4 py-2.5 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20">
              <BadgePlus className="h-4 w-4" /> Add Unknown Tag
            </button>
            <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black text-white/75 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" /> Back to Binder
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search printed tag code, Pokémon, or serial…" className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30" />
            {searchTerm && <button type="button" onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white" aria-label="Clear search"><X className="h-4 w-4" /></button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", Rarity.SUPERSTAR, Rarity.STAR, Rarity.RARE, Rarity.UNCOMMON, Rarity.COMMON].map((rarity) => (
              <button type="button" key={rarity} onClick={() => setSelectedRarity(rarity)} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${selectedRarity === rarity ? "border-white/30 bg-white/20 text-white" : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"}`}>{rarity === "All" ? "All rarity" : rarity}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-4">
          <span className="mr-1 text-[10px] font-mono font-black uppercase tracking-widest text-white/40">Series</span>
          {SERIES_FILTERS.map((series) => (
            <button type="button" key={series} onClick={() => setSelectedSeries(series)} className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase transition ${selectedSeries === series ? "border-amber-300/50 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"}`}>{series}</button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-mono font-black uppercase tracking-widest text-white/40">Element</span>
          {availableElements.map((element) => {
            const colors = element === "All" ? null : getElementColors(element);
            const active = selectedElement === element;
            return <button type="button" key={element} onClick={() => setSelectedElement(element)} className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase transition ${active ? element === "All" ? "border-white/30 bg-white/20 text-white" : `${colors?.bg} ${colors?.text} ${colors?.border}` : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"}`}>{element}</button>;
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-2">
          <div className="text-xs font-mono font-black uppercase tracking-widest text-white/40">{filteredTags.length} catalogue records</div>
          <div className="text-xs text-white/50">Tap a card to inspect it; use Select tag to add a physical tag to your queue.</div>
        </div>

        {filteredTags.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-white/10 bg-white/5 px-4 py-16 text-center text-sm text-white/55">No tags match those filters. Use Add Unknown Tag if yours is not listed yet.</div>
        ) : (
          <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-inner backdrop-blur-xl lg:p-8">
            <div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {visibleTags.map((tag) => {
                const isSelected = Boolean(selected[tag.id]);
                const ownedCopies = tag.copiesOwned ?? (tag.owned ? 1 : 0);
                const isNeedsMatch = tag.sourceStatus === "needs-review";

                return <div key={tag.id} className="relative flex w-full max-w-[20rem] flex-col items-center gap-3" style={{ contentVisibility: "auto", containIntrinsicSize: "320px 245px" }}>
                  <div className="relative">
                    <MezastarCard tag={tag} interactive />
                    {ownedCopies > 0 && <div className="absolute -left-2 -top-2 z-20 rounded-full border-2 border-[#160d25] bg-emerald-300 px-2 py-1 text-[10px] font-black text-emerald-950 shadow-lg">IN BINDER ×{ownedCopies}</div>}
                    {isNeedsMatch && <div className="absolute -right-2 -top-2 z-20 rounded-full border-2 border-[#160d25] bg-fuchsia-200 px-2 py-1 text-[9px] font-black text-fuchsia-950 shadow-lg">NEEDS MATCH</div>}
                    {isSelected && <div className="pointer-events-none absolute inset-0 z-10 rounded-[2.5rem] border-4 border-amber-300 bg-amber-300/10 shadow-[0_0_28px_rgba(252,211,77,0.5)]" />}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={() => setDetailTag(tag)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white/75 transition hover:bg-white/10 hover:text-white">
                      <Eye className="h-4 w-4" />
                      View Details
                    </button>

                    <button type="button" onClick={() => toggleSelected(tag)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-black transition ${isSelected ? "border-amber-300 bg-amber-300 text-amber-950" : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"}`}>
                      {isSelected ? <><CircleCheck className="h-4 w-4" /> Selected</> : <><Check className="h-4 w-4" /> Select tag</>}
                    </button>
                  </div>
                </div>;
              })}
            </div>
            {visibleCount < filteredTags.length && (
              <div className="mt-10 flex flex-col items-center gap-2">
                <div className="text-xs font-bold text-white/45">Showing {visibleTags.length} of {filteredTags.length} tags</div>
                <button type="button" onClick={() => setVisibleCount((current) => Math.min(filteredTags.length, current + CATALOGUE_PAGE_SIZE))} className="min-h-12 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-7 text-sm font-black text-amber-100 transition active:scale-95 hover:bg-amber-300/20">
                  Load 30 more
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {selectedEntries.length > 0 && (
        <aside className="sticky bottom-3 z-30 rounded-3xl border border-amber-300/30 bg-[#1b102c]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-amber-300">Collection queue</div>
              <p className="mt-1 text-sm font-bold text-white">{selectedEntries.length} designs · {selectedCopyCount} physical {selectedCopyCount === 1 ? "tag" : "tags"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedEntries.map(({ tag, quantity }) => <div key={tag.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                <span className="max-w-24 truncate text-[10px] font-black text-white/80">{tag.name}</span>
                <button type="button" onClick={() => setQuantity(tag.id, quantity - 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/20 text-white/75 hover:bg-black/40" aria-label={`Decrease ${tag.name} quantity`}><ChevronDown className="h-3.5 w-3.5" /></button>
                <span className="min-w-5 text-center text-xs font-black text-amber-200">{quantity}</span>
                <button type="button" onClick={() => setQuantity(tag.id, quantity + 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/20 text-white/75 hover:bg-black/40" aria-label={`Increase ${tag.name} quantity`}><ChevronUp className="h-3.5 w-3.5" /></button>
              </div>)}
            </div>
            <button type="button" onClick={addSelected} className="min-h-12 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-5 py-3 text-sm font-black text-amber-950 shadow-lg shadow-amber-950/40 transition hover:brightness-110">Add Selected to My Collection</button>
          </div>
        </aside>
      )}

      {detailTag && (
        <TagDetailModal tag={detailTag} onClose={() => setDetailTag(null)} />
      )}
    </div>
  );
}
