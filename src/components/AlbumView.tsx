import React, { useState, useMemo } from "react";
import { MezastarTag, Rarity, CollectionStats } from "../types";
import { MezastarCard } from "./MezastarCard";
import { TagDetailModal } from "./TagDetailModal";
import { MatchUnknownTagModal } from "./MatchUnknownTagModal";
import { getElementColors } from "../data/tags";
import {
  Search,
  SlidersHorizontal,
  Bookmark,
  Award,
  Flame,
  LayoutGrid,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  X,
  Sparkles,
  Eye,
  Link2,
} from "lucide-react";

interface AlbumViewProps {
  tags: MezastarTag[];
  onToggleOwned: (id: string) => void;
  onSelectTag: (tag: MezastarTag) => void;
  defaultOwnedOnly?: boolean;
  onBrowseCatalogue?: () => void;
  catalogueTags?: MezastarTag[];
  onMatchUnknownTag?: (unknownTagId: string, catalogueTagId: string) => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({
  tags,
  onToggleOwned,
  onSelectTag,
  defaultOwnedOnly = false,
  onBrowseCatalogue,
  catalogueTags = [],
  onMatchUnknownTag,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRarity, setSelectedRarity] = useState<string>("All");
  const [selectedElement, setSelectedElement] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("energy-desc");
  const [showOwnedOnly, setShowOwnedOnly] = useState<boolean>(defaultOwnedOnly);
  const [detailTag, setDetailTag] = useState<MezastarTag | null>(null);
  const [matchTag, setMatchTag] = useState<MezastarTag | null>(null);

  // Extract all unique element types present in the current tag database
  const availableElements = useMemo(() => {
    const types = new Set<string>();
    tags.forEach((t) => {
      types.add(t.type1);
      if (t.type2) types.add(t.type2);
    });
    return ["All", ...Array.from(types).sort()];
  }, [tags]);

  // Compute stats on the fly
  const stats = useMemo<CollectionStats>(() => {
    let owned = 0;
    let ownedCopies = 0;
    let superstars = 0;
    let stars = 0;
    let customs = 0;
    let energySum = 0;
    const types: Record<string, number> = {};

    tags.forEach((t) => {
      if (t.owned) {
        owned++;
        ownedCopies += t.copiesOwned ?? 1;
        if (t.rarity === Rarity.SUPERSTAR) superstars++;
        if (t.rarity === Rarity.STAR) stars++;
        if (t.isCustom) customs++;
        energySum += t.energy;
        
        // Add to types count
        types[t.type1] = (types[t.type1] || 0) + 1;
        if (t.type2) {
          types[t.type2] = (types[t.type2] || 0) + 1;
        }
      }
    });

    return {
      totalCount: tags.length,
      ownedCount: owned,
      ownedCopies,
      superstarCount: superstars,
      starCount: stars,
      customCount: customs,
      totalEnergy: energySum,
      typesCount: types,
    };
  }, [tags]);

  // Filter and sort the tag collection
  const filteredTags = useMemo(() => {
    return tags
      .filter((tag) => {
        // Search Filter
        const matchesSearch =
          tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tag.pokedexNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tag.id.toLowerCase().includes(searchTerm.toLowerCase());

        // Rarity Filter
        const matchesRarity =
          selectedRarity === "All" ||
          tag.rarity === selectedRarity ||
          (selectedRarity === "Special" && false);

        // Element Filter
        const matchesElement =
          selectedElement === "All" ||
          tag.type1 === selectedElement ||
          tag.type2 === selectedElement;

        // Owned Only Filter
        const matchesOwned = !showOwnedOnly || tag.owned;

        return matchesSearch && matchesRarity && matchesElement && matchesOwned;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "energy-desc":
            return b.energy - a.energy;
          case "energy-asc":
            return a.energy - b.energy;
          case "hp-desc":
            return b.stats.hp - a.stats.hp;
          case "speed-desc":
            return b.stats.speed - a.stats.speed;
          case "dex-asc":
            // Strips prefixes like PE- to sort numerically
            const aNum = parseInt(a.pokedexNo.replace(/\D/g, "")) || 0;
            const bNum = parseInt(b.pokedexNo.replace(/\D/g, "")) || 0;
            return aNum - bNum;
          case "name-asc":
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
  }, [tags, searchTerm, selectedRarity, selectedElement, sortBy, showOwnedOnly]);

  const completionPercentage = Math.round((stats.ownedCount / (stats.totalCount || 1)) * 100);

  return (
    <div className="flex flex-col gap-6" id="album-view-container">
      {/* 1. COLLECTION LEADERBOARD DASHBOARD BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        {/* Card 1: Completion Circular Indicator */}
        <div className="flex items-center gap-4 border-r border-white/10 pr-4 md:col-span-1">
          <div className="relative w-20 h-20 shrink-0">
            {/* SVG circle */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-white/10"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-purple-400 transition-all duration-500 ease-out"
                strokeDasharray={`${completionPercentage}, 100`}
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black text-white">{completionPercentage}%</span>
              <span className="text-[8px] font-mono font-bold text-white/40 tracking-wider">COMPLETED</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest">Sleeve Storage</span>
            <span className="text-2xl font-black text-white tracking-tight">
              {stats.ownedCopies} <span className="text-white/30 text-lg">copies · {stats.ownedCount} designs</span>
            </span>
            <span className="text-xs text-white/60 mt-1">Tags placed in your family binder</span>
          </div>
        </div>

        {/* Card 2: Cumulative Energy Level */}
        <div className="flex flex-col justify-center border-r border-white/10 pr-4 pl-0 md:pl-2">
          <span className="text-[10px] font-mono font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1">
            <Flame className="w-3 h-3 fill-amber-400 text-amber-400" /> TOTAL ACTIVE ENERGY
          </span>
          <span className="text-3xl font-black text-amber-300 font-mono italic tracking-tight mt-1 drop-shadow-[0_2px_8px_rgba(251,191,36,0.2)]">
            {stats.totalEnergy}
          </span>
          <span className="text-xs text-white/60 mt-1">Combined combat energy level</span>
        </div>

        {/* Card 3: Rarity Breakdowns */}
        <div className="flex flex-col justify-center border-r border-white/10 pr-4 pl-0 md:pl-2">
          <span className="text-[10px] font-mono font-extrabold text-purple-300 uppercase tracking-widest flex items-center gap-1">
            <Award className="w-3 h-3 text-purple-300" /> HIGH GRADE COLLECTIBLES
          </span>
          <div className="flex items-baseline gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-xl font-black text-purple-300 font-sans">{stats.superstarCount}</span>
              <span className="text-[8px] font-mono text-white/40 tracking-wider">6★ SUPERSTAR</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-rose-300 font-sans">{stats.starCount}</span>
              <span className="text-[8px] font-mono text-white/40 tracking-wider">5★ STAR</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-sky-300 font-sans">{stats.customCount}</span>
              <span className="text-[8px] font-mono text-white/40 tracking-wider">SPECIAL / FIXTURE</span>
            </div>
          </div>
        </div>

        {/* Card 4: Element distribution overview */}
        <div className="flex flex-col justify-center pl-0 md:pl-2">
          <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest flex items-center gap-1">
            <LayoutGrid className="w-3 h-3 text-white/30" /> TOP ELEMENT TYPES
          </span>
          <div className="flex flex-wrap gap-1 mt-2 max-h-[42px] overflow-y-auto">
            {Object.keys(stats.typesCount).length === 0 ? (
              <span className="text-xs text-white/30 font-mono italic">No elements in collection</span>
            ) : (
              Object.entries(stats.typesCount)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .slice(0, 5)
                .map(([type, count]) => {
                  const colors = getElementColors(type);
                  return (
                    <div
                      key={type}
                      className={`px-2 py-0.5 rounded-full text-[8px] font-bold border ${colors.bg} ${colors.text} ${colors.border} flex items-center gap-1 shadow-sm`}
                    >
                      <span>{type}</span>
                      <span className="bg-black/20 px-1 rounded font-mono font-black">{count}</span>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* 2. FILTER & UTILITIES CONTROLS PANEL */}
      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        {/* Search & Main Toggles Row */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          {/* Text Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 w-4.5 h-4.5" />
            <input
              type="text"
              placeholder="Search Mezastar tag by name, Pokédex, or Serial ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filters Group */}
          <div className="flex flex-wrap items-center gap-3">
            {onBrowseCatalogue && (
              <button
                type="button"
                onClick={onBrowseCatalogue}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black border border-amber-300/35 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 transition-all shadow-md shadow-amber-950/20"
              >
                <Sparkles className="w-4 h-4" />
                Browse Catalogue
              </button>
            )}
            {/* Owned Toggle */}
            <button
              onClick={() => setShowOwnedOnly(!showOwnedOnly)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                showOwnedOnly
                  ? "bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-md shadow-purple-900/20"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <CheckCircle className={`w-4 h-4 ${showOwnedOnly ? "fill-white/20" : ""}`} />
              <span>{showOwnedOnly ? "My Collection" : "Show Catalogue Tags"}</span>
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2">
              <SlidersHorizontal className="text-white/40 w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-white/80 focus:outline-none cursor-pointer pr-1 [&>option]:bg-[#140e24] [&>option]:text-white"
              >
                <option value="energy-desc">Energy (Highest)</option>
                <option value="energy-asc">Energy (Lowest)</option>
                <option value="hp-desc">HP (Highest)</option>
                <option value="speed-desc">Speed (Highest)</option>
                <option value="dex-asc">Dex Number</option>
                <option value="name-asc">Alphabetical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs Row for Star / Rarity Categories */}
        <div className="border-t border-white/10 pt-3.5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest mr-2">RARITY STARS</span>
            {["All", Rarity.SUPERSTAR, Rarity.STAR, Rarity.RARE, Rarity.UNCOMMON, Rarity.COMMON, "Special"].map((rarity) => {
              const isActive = selectedRarity === rarity;
              return (
                <button
                  key={rarity}
                  onClick={() => setSelectedRarity(rarity)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isActive
                      ? "bg-white/20 border-white/30 text-white shadow-md font-extrabold scale-102"
                      : "bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {rarity === "All" && "Show All"}
                  {rarity === Rarity.SUPERSTAR && "6★ Superstar"}
                  {rarity === Rarity.STAR && "5★ Star"}
                  {rarity === Rarity.RARE && "4★ Rare"}
                  {rarity === Rarity.UNCOMMON && "3★ Uncommon"}
                  {rarity === Rarity.COMMON && "2★ Common"}
                  {rarity === "Special" && "Special"}
                </button>
              );
            })}
          </div>

          {/* Element Selection bar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest mr-2">ELEMENT TYPE</span>
            {availableElements.map((elem) => {
              const isActive = selectedElement === elem;
              const typeColors = elem !== "All" ? getElementColors(elem) : null;
              
              return (
                <button
                  key={elem}
                  onClick={() => setSelectedElement(elem)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    isActive
                      ? elem === "All"
                        ? "bg-white/20 text-white border-white/30 font-extrabold shadow-md scale-102"
                        : `${typeColors?.bg} ${typeColors?.text} ${typeColors?.border} font-extrabold shadow-sm scale-102`
                      : "bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {elem === "All" ? "ALL ELEMENTS" : elem.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. BINDER SHELF / POCKET GRID */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-sm font-mono font-extrabold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-purple-400" /> BINDER COMPARTMENTS
            <span className="text-xs text-white/25">({filteredTags.length} compartments matched)</span>
          </h3>
          <span className="text-xs text-white/40 font-sans italic">
            💡 Tap a tag to rotate and flip it. Toggle collection hearts to save locally.
          </span>
        </div>

        {filteredTags.length === 0 ? (
          /* Empty Search results or collection */
          <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-3xl py-16 px-4 text-center flex flex-col items-center justify-center max-w-xl mx-auto w-full mt-4">
            <LayoutGrid className="w-12 h-12 text-white/20 mb-4 stroke-[1.5]" />
            <span className="text-base font-extrabold text-white/70">No tags found in binder</span>
            <p className="text-sm text-white/45 mt-2 max-w-md">
              Your binder only shows tags you have marked as owned. Browse the fixture catalogue to place more tags into it, or reset filters to see matching saved entries.
            </p>
            {(searchTerm || selectedRarity !== "All" || selectedElement !== "All" || showOwnedOnly) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedRarity("All");
                  setSelectedElement("All");
                  setShowOwnedOnly(false);
                }}
                className="mt-5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors border border-white/15 cursor-pointer"
              >
                Reset Binder Filters
              </button>
            )}
          </div>
        ) : (
          /* BINDER SLOT CONTAINER GRID */
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 lg:p-8 shadow-inner backdrop-blur-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-y-10 gap-x-6 justify-items-center">
              {filteredTags.map((tag) => {
                return (
                  <div
                    key={tag.id}
                    className="relative group flex justify-center items-center"
                    id={`sleeve-pocket-${tag.id}`}
                  >
                    {/* Retro vinyl/plastic binder pocket outline */}
                    <div className="absolute -inset-3.5 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-[3rem] -z-10 group-hover:bg-white/10 transition-all duration-300 flex items-center justify-center shadow-inner">
                      {/* Pocket ring tabs or binders rivets */}
                      <div className="absolute left-1/2 -top-1 -translate-x-1/2 w-8 h-2 bg-white/10 border-b border-white/10 rounded-full flex gap-1 justify-center items-center">
                        <div className="w-1 h-1 rounded-full bg-white/25"></div>
                        <div className="w-1 h-1 rounded-full bg-white/25"></div>
                      </div>
                    </div>

                    {/* Darkened unowned silhouette overlay */}
                    {!tag.owned && (
                      <div className="absolute inset-0 rounded-[2.5rem] bg-black/75 z-20 pointer-events-none flex flex-col items-center justify-center p-4 backdrop-blur-[1px] transition-all duration-300 group-hover:bg-black/65">
                        <svg
                          className="w-8 h-8 text-white/30 group-hover:text-white/40 group-hover:scale-110 transition-transform duration-300"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <span className="text-[10px] font-mono font-black text-white/40 tracking-wider uppercase mt-2 select-none group-hover:text-white/65">
                          Empty Slot No.{tag.id.split('-').pop()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleOwned(tag.id);
                          }}
                          className="mt-3 text-[9px] bg-purple-600/90 hover:bg-purple-600 text-white font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider transition-colors shadow-lg shadow-purple-950 pointer-events-auto cursor-pointer"
                        >
                          Place into Binder
                        </button>
                      </div>
                    )}

                    {/* The physical rendered 3D chip */}
                    {(tag.copiesOwned ?? (tag.owned ? 1 : 0)) > 1 && (
                      <span className="absolute -right-2 -top-2 z-30 min-w-7 h-7 px-2 rounded-full bg-amber-300 text-amber-950 border-2 border-[#160d25] shadow-lg flex items-center justify-center text-[11px] font-black font-mono">
                        ×{tag.copiesOwned}
                      </span>
                    )}
                    <div className="flex flex-col items-center gap-3">
                      <div className={!tag.owned ? "opacity-30 mix-blend-luminosity scale-98 pointer-events-none" : ""}>
                        <MezastarCard
                          tag={tag}
                          onToggleOwned={onToggleOwned}
                          interactive={tag.owned}
                        />
                      </div>

                      {tag.owned && (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetailTag(tag);
                              onSelectTag(tag);
                            }}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white/75 shadow-lg transition hover:bg-white/10 hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </button>

                          {tag.sourceStatus === "needs-review" && onMatchUnknownTag && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setMatchTag(tag);
                              }}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/35 bg-fuchsia-400/10 px-4 py-2 text-xs font-black text-fuchsia-100 shadow-lg transition hover:bg-fuchsia-400/20"
                            >
                              <Link2 className="h-4 w-4" />
                              Match Tag
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {detailTag && (
        <TagDetailModal tag={detailTag} onClose={() => setDetailTag(null)} />
      )}

      {matchTag && onMatchUnknownTag && (
        <MatchUnknownTagModal
          unknownTag={matchTag}
          catalogueTags={catalogueTags}
          onClose={() => setMatchTag(null)}
          onConfirm={(unknownTagId, catalogueTagId) => {
            onMatchUnknownTag(unknownTagId, catalogueTagId);
            setMatchTag(null);
          }}
        />
      )}
    </div>
  );
};
