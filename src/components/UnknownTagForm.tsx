import { useMemo, useState } from "react";
import { Check, ImageOff, Plus, X } from "lucide-react";
import { Rarity, type MezastarTag, type TagSeries } from "../types";

interface UnknownTagFormProps {
  onCancel: () => void;
  onSave: (tag: MezastarTag) => void;
}

const TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting",
  "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost",
  "Dragon", "Dark", "Steel", "Fairy",
];

const rarityToStars: Record<Rarity, number> = {
  [Rarity.COMMON]: 2,
  [Rarity.UNCOMMON]: 3,
  [Rarity.RARE]: 4,
  [Rarity.STAR]: 5,
  [Rarity.SUPERSTAR]: 6,
  [Rarity.LEGEND]: 6,
  [Rarity.REGULAR]: 3,
};

const rarityToEnergy: Record<Rarity, number> = {
  [Rarity.COMMON]: 70,
  [Rarity.UNCOMMON]: 88,
  [Rarity.RARE]: 106,
  [Rarity.STAR]: 128,
  [Rarity.SUPERSTAR]: 150,
  [Rarity.LEGEND]: 165,
  [Rarity.REGULAR]: 88,
};

function makeHomeStats(energy: number) {
  const base = Math.max(65, energy);
  return {
    hp: base,
    attack: Math.round(base * 0.9),
    defense: Math.round(base * 0.78),
    spAtk: Math.round(base * 0.88),
    spDef: Math.round(base * 0.76),
    speed: Math.round(base * 0.92),
  };
}

export function UnknownTagForm({ onCancel, onSave }: UnknownTagFormProps) {
  const [name, setName] = useState("");
  const [tagCode, setTagCode] = useState("");
  const [series, setSeries] = useState<TagSeries>("Unknown");
  const [type1, setType1] = useState("Normal");
  const [type2, setType2] = useState("");
  const [rarity, setRarity] = useState<Rarity>(Rarity.RARE);
  const [moveName, setMoveName] = useState("");
  const [moveType, setMoveType] = useState("Normal");
  const [specialNote, setSpecialNote] = useState("");

  const energy = useMemo(() => rarityToEnergy[rarity], [rarity]);
  const canSave = name.trim().length > 0;

  function save() {
    if (!canSave) return;

    const normalizedCode = tagCode.trim().toUpperCase();
    const now = Date.now();
    const id = `needs-review-${now}-${Math.random().toString(36).slice(2, 7)}`;

    onSave({
      id,
      pokemonId: 0,
      name: name.trim(),
      rarity,
      stars: rarityToStars[rarity],
      type1,
      type2: type2 || undefined,
      energy,
      pokedexNo: normalizedCode || "UNMATCHED",
      officialTagCode: normalizedCode || undefined,
      series,
      sourceStatus: "needs-review",
      sourceNote: specialNote.trim() || "Added manually; needs catalogue match.",
      stats: makeHomeStats(energy),
      moves: [
        {
          name: moveName.trim() || "Move not recorded",
          type: moveType,
          power: Math.round(energy * 0.8),
          category: "Physical",
        },
      ],
      owned: true,
      copiesOwned: 1,
    });
  }

  return (
    <section className="rounded-3xl border border-fuchsia-300/25 bg-fuchsia-500/10 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-fuchsia-200">
            <ImageOff className="h-3.5 w-3.5" />
            Unknown / Needs Match
          </div>
          <h2 className="mt-1 text-xl font-black text-white">
            Add a tag you cannot identify yet
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Enter only what you can read from the physical tag. The app will
            keep it in your binder with a Needs Match label until we link it
            to a verified catalogue record later.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/75 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          Close
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
            Pokémon name *
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: Charizard"
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-400/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
            Printed tag code
          </span>
          <input
            value={tagCode}
            onChange={(event) => setTagCode(event.target.value)}
            placeholder="Example: 1-1-001"
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm uppercase text-white outline-none placeholder:text-white/25 focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-400/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
            Series guess
          </span>
          <select
            value={series}
            onChange={(event) => setSeries(event.target.value as TagSeries)}
            className="rounded-xl border border-white/10 bg-[#170d24] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300"
          >
            <option value="Unknown">I am not sure</option>
            <option value="Version 1">Version 1</option>
            <option value="Version 2">Version 2</option>
            <option value="Version 3">Version 3</option>
            <option value="Version 4">Version 4</option>
            <option value="Galaxy Version 1">Galaxy Version 1</option>
            <option value="Galaxy Version 2">Galaxy Version 2</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
            Rarity / visible stars
          </span>
          <select
            value={rarity}
            onChange={(event) => setRarity(event.target.value as Rarity)}
            className="rounded-xl border border-white/10 bg-[#170d24] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300"
          >
            {Object.values(Rarity).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
            Primary type
          </span>
          <select
            value={type1}
            onChange={(event) => {
              setType1(event.target.value);
              if (moveType === "Normal") setMoveType(event.target.value);
            }}
            className="rounded-xl border border-white/10 bg-[#170d24] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300"
          >
            {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
            Secondary type
          </span>
          <select
            value={type2}
            onChange={(event) => setType2(event.target.value)}
            className="rounded-xl border border-white/10 bg-[#170d24] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300"
          >
            <option value="">None</option>
            {TYPES.filter((type) => type !== type1).map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
            Move name
          </span>
          <input
            value={moveName}
            onChange={(event) => setMoveName(event.target.value)}
            placeholder="Optional if unreadable"
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-400/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
            Move type
          </span>
          <select
            value={moveType}
            onChange={(event) => setMoveType(event.target.value)}
            className="rounded-xl border border-white/10 bg-[#170d24] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300"
          >
            {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white/45">
          Note / special wording on tag
        </span>
        <textarea
          value={specialNote}
          onChange={(event) => setSpecialNote(event.target.value)}
          rows={3}
          placeholder="Example: has Z-Move wording, foil border, or bought from third party"
          className="resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-400/20"
        />
      </label>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-white/45">
          Home Arena display values are temporary and clearly marked as
          non-official until this tag is matched to a verified catalogue record.
        </p>
        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-300 to-purple-300 px-4 py-2.5 text-sm font-black text-fuchsia-950 shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Plus className="h-4 w-4" />
          Add to My Collection
        </button>
      </div>
    </section>
  );
}
