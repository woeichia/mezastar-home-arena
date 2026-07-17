import type { MezastarTag } from "../types";
import { VERIFIED_CATALOGUE_TAGS } from "./verifiedCatalogue";
import { EXPANDED_VERIFIED_CATALOGUE_TAGS } from "./expandedCatalogue";

/**
 * Verified catalogue identities from Version 1 through Galaxy Version 2.
 * The retired PE-code visual fixtures are intentionally excluded.
 */
export const INITIAL_TAGS: MezastarTag[] = [
  ...VERIFIED_CATALOGUE_TAGS,
  ...EXPANDED_VERIFIED_CATALOGUE_TAGS,
];

export const ELEMENT_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  Electric: { bg: "bg-amber-400", text: "text-amber-950", border: "border-amber-300", glow: "shadow-amber-500/50" },
  Fire: { bg: "bg-red-500", text: "text-white", border: "border-red-400", glow: "shadow-red-500/50" },
  Water: { bg: "bg-blue-500", text: "text-white", border: "border-blue-400", glow: "shadow-blue-500/50" },
  Grass: { bg: "bg-emerald-500", text: "text-white", border: "border-emerald-400", glow: "shadow-emerald-500/50" },
  Psychic: { bg: "bg-purple-500", text: "text-white", border: "border-purple-400", glow: "shadow-purple-500/50" },
  Dragon: { bg: "bg-indigo-600", text: "text-white", border: "border-indigo-400", glow: "shadow-indigo-600/50" },
  Flying: { bg: "bg-sky-400", text: "text-sky-950", border: "border-sky-300", glow: "shadow-sky-400/50" },
  Ghost: { bg: "bg-violet-800", text: "text-white", border: "border-violet-600", glow: "shadow-violet-800/50" },
  Poison: { bg: "bg-fuchsia-700", text: "text-white", border: "border-fuchsia-500", glow: "shadow-fuchsia-700/50" },
  Dark: { bg: "bg-zinc-800", text: "text-zinc-100", border: "border-zinc-600", glow: "shadow-zinc-800/50" },
  Steel: { bg: "bg-slate-400", text: "text-slate-950", border: "border-slate-300", glow: "shadow-slate-400/50" },
  Fighting: { bg: "bg-orange-700", text: "text-white", border: "border-orange-500", glow: "shadow-orange-700/50" },
  Fairy: { bg: "bg-pink-400", text: "text-pink-950", border: "border-pink-300", glow: "shadow-pink-400/50" },
  Normal: { bg: "bg-stone-400", text: "text-stone-950", border: "border-stone-300", glow: "shadow-stone-400/50" },
  Ground: { bg: "bg-amber-700", text: "text-white", border: "border-amber-500", glow: "shadow-amber-700/50" },
  Rock: { bg: "bg-yellow-800", text: "text-white", border: "border-yellow-600", glow: "shadow-yellow-800/50" },
  Ice: { bg: "bg-cyan-300", text: "text-cyan-950", border: "border-cyan-200", glow: "shadow-cyan-300/50" },
  Bug: { bg: "bg-lime-600", text: "text-white", border: "border-lime-400", glow: "shadow-lime-600/50" },
};

export const getElementColors = (type: string) => {
  return ELEMENT_COLORS[type] || { bg: "bg-gray-500", text: "text-white", border: "border-gray-400", glow: "shadow-gray-500/50" };
};
