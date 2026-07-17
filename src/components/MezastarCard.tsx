import React, { useState, useRef } from "react";
import { MezastarTag, Rarity } from "../types";
import { getElementColors } from "../data/tags";
import { getPortraitSources, getPortraitTreatment } from "../utils/portraitResolver";
import { Swords, CircleHelp } from "lucide-react";

interface MezastarCardProps {
  tag: MezastarTag;
  onToggleOwned?: (id: string) => void;
  interactive?: boolean;
}

const MezastarCardComponent: React.FC<MezastarCardProps> = ({
  tag,
  interactive = true,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [portraitIndex, setPortraitIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Play a retro physical plastic click/tap sound
  const playClickSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Tap / Snap physical click
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      // Audio context blocked or not supported
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || isFlipped || e.pointerType === "touch") return;
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const px = x / rect.width;
    const py = y / rect.height;

    // Convert pointer coordinate to degree of tilt (-15 to 15 degrees)
    const rotateY = (px - 0.5) * 30;
    const rotateX = -(py - 0.5) * 30;

    setTilt({ x: rotateX, y: rotateY });
    setGlare({
      x: px * 100,
      y: py * 100,
      opacity: 0.6,
    });
  };

  const handlePointerLeave = () => {
    setTilt({ x: 0, y: 0 });
    setGlare(prev => ({ ...prev, opacity: 0 }));
  };

  const handleFlip = () => {
    if (!interactive) return;
    playClickSound();
    setTilt({ x: 0, y: 0 });
    setGlare((prev) => ({ ...prev, opacity: 0 }));
    setIsFlipped((current) => !current);
  };

  const typeColor = getElementColors(tag.type1);
  const secondaryTypeColor = tag.type2 ? getElementColors(tag.type2) : null;

  // Bezel Style Mapper (based on original physical colors of Mezastar)
  const getBezelStyles = (rarity: Rarity) => {
    switch (rarity) {
      case Rarity.SUPERSTAR: // Purple/Black Sparkly
        return {
          bg: "bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950",
          border: "border-purple-600/60 shadow-[0_0_20px_rgba(168,85,247,0.3)]",
          starsColor: "text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]",
          innerFrame: "border-amber-400/40 bg-purple-950/20",
          particleColor: "bg-purple-400/80",
          glitter: true,
          label: "★ SUPERSTAR ★",
        };
      case Rarity.STAR: // Shiny pink/red
        return {
          bg: "bg-gradient-to-br from-rose-950 via-red-950 to-pink-950",
          border: "border-rose-600/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]",
          starsColor: "text-rose-400 fill-rose-400",
          innerFrame: "border-rose-500/30 bg-rose-950/20",
          particleColor: "bg-rose-400/70",
          glitter: true,
          label: "★ STAR ★",
        };
      case Rarity.RARE: // Dark green
        return {
          bg: "bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950",
          border: "border-emerald-600/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
          starsColor: "text-emerald-400 fill-emerald-400",
          innerFrame: "border-emerald-500/20 bg-emerald-950/20",
          particleColor: "bg-emerald-400/50",
          glitter: false,
          label: "RARE",
        };
      case Rarity.UNCOMMON: // Dark blue
        return {
          bg: "bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950",
          border: "border-blue-600/40",
          starsColor: "text-blue-400 fill-blue-400",
          innerFrame: "border-blue-500/20 bg-blue-950/20",
          particleColor: "bg-blue-400/50",
          glitter: false,
          label: "UNCOMMON",
        };
      case Rarity.COMMON: // Yellow/Orange
        return {
          bg: "bg-gradient-to-br from-amber-600 via-amber-700 to-orange-800",
          border: "border-amber-500/40",
          starsColor: "text-amber-300 fill-amber-300",
          innerFrame: "border-amber-400/20 bg-amber-900/10",
          particleColor: "bg-yellow-300/40",
          glitter: false,
          label: "COMMON",
        };
      case Rarity.LEGEND: // Gold Sparkly
        return {
          bg: "bg-gradient-to-br from-amber-800 via-yellow-950 to-orange-950",
          border: "border-yellow-400/70 shadow-[0_0_25px_rgba(234,179,8,0.4)]",
          starsColor: "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.7)]",
          innerFrame: "border-yellow-400/50 bg-amber-950/30",
          particleColor: "bg-yellow-300/95",
          glitter: true,
          label: "★ LEGEND SPECIAL ★",
        };
      case Rarity.REGULAR:
        return {
          bg: "bg-gradient-to-br from-slate-800 via-zinc-900 to-slate-950",
          border: "border-slate-500/45 shadow-[0_0_10px_rgba(148,163,184,0.18)]",
          starsColor: "text-slate-300 fill-slate-300",
          innerFrame: "border-slate-300/20 bg-slate-950/20",
          particleColor: "bg-slate-300/60",
          glitter: false,
          label: "★2–4 REGULAR★",
        };
      default:
        return {
          bg: "bg-gradient-to-br from-zinc-800 to-zinc-950",
          border: "border-zinc-700",
          starsColor: "text-zinc-400 fill-zinc-400",
          innerFrame: "border-zinc-600/20 bg-zinc-900/20",
          particleColor: "bg-zinc-400",
          glitter: false,
          label: "TAG",
        };
    }
  };

  const bStyles = getBezelStyles(tag.rarity);

  // Exact portrait overrides are supported per tag. Otherwise Version/rarity
  // selects a different portrait source with graceful fallbacks.
  const paddedId = tag.pokemonId > 0 ? String(tag.pokemonId).padStart(3, "0") : "???";
  const portraitSources = getPortraitSources(tag);
  const portraitSource = portraitSources[portraitIndex];
  const portraitTreatment = getPortraitTreatment(tag);
  const printedCode = tag.officialTagCode || tag.pokedexNo;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative w-80 h-44 cursor-pointer select-none transition-transform duration-300`}
      style={{
        perspective: 1200,
        transform: `scale(${interactive ? 1 : 0.95})`,
      }}
      id={`mezastar-card-${tag.id}`}
    >
      {/* 3D Inner Rotatable container */}
      <div
        className="w-full h-full relative duration-500 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped
            ? "rotateY(180deg)"
            : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          willChange: "transform",
          transition: isFlipped
            ? "transform 860ms cubic-bezier(0.22, 1, 0.36, 1)"
            : tilt.x === 0 && tilt.y === 0
              ? "transform 260ms ease-out"
              : "none",
        }}
        onClick={handleFlip}
      >
        
        {/* FRONT OF THE MEZASTAR TAG */}
        <div
          className={`absolute inset-0 w-full h-full rounded-[2.5rem] p-3 border-4 flex flex-col justify-between overflow-hidden ${bStyles.bg} ${bStyles.border}`}
          style={{
            backfaceVisibility: "hidden",
            boxShadow: tag.rarity === Rarity.SUPERSTAR ? "inset 0 0 15px rgba(168,85,247,0.5), 0 10px 25px rgba(0,0,0,0.5)" : "0 10px 25px rgba(0,0,0,0.4)",
          }}
        >
          {/* Sparkles / Glitter background particles for higher rarities */}
          {bStyles.glitter && (
            <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen overflow-hidden">
              <div className="absolute top-2 left-6 w-1 h-1 rounded-full bg-white animate-pulse"></div>
              <div className="absolute top-8 right-12 w-1.5 h-1.5 rounded-full bg-yellow-300 animate-ping" style={{ animationDuration: "3s" }}></div>
              <div className="absolute bottom-10 left-10 w-1 h-1 rounded-full bg-pink-400 animate-pulse" style={{ animationDuration: "1.5s" }}></div>
              <div className="absolute bottom-4 right-16 w-1 h-1 rounded-full bg-blue-300 animate-pulse" style={{ animationDuration: "2s" }}></div>
              <div className="absolute top-16 left-24 w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping" style={{ animationDuration: "4s" }}></div>
              {/* Silver speckled noise texture */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-25"></div>
            </div>
          )}

          {/* Recessed Sticker Area Frame */}
          <div className={`absolute inset-1.5 rounded-[2.1rem] border ${bStyles.innerFrame} overflow-hidden flex flex-col justify-between p-2.5`}>
            
            {/* STICKER BACKGROUND - Radial starburst or neon ring pattern */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35 z-0">
              <div className={`absolute -inset-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-${typeColor.bg.replace('bg-', '')}/40 via-transparent to-transparent animate-spin-slow`} style={{ animationDuration: "15s" }}></div>
              <div className="absolute w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.05)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.05)_75%,transparent_75%,transparent)] bg-[length:20px_20px]"></div>
            </div>

            {/* HOLO GLARE OVERLAY (Shifts dynamically on hover) */}
            <div
              className="absolute inset-0 pointer-events-none mix-blend-color-dodge transition-opacity duration-200 z-10"
              style={{
                opacity: glare.opacity,
                background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 120, 255, 0.2) 30%, transparent 65%)`,
              }}
            ></div>

            {/* TOP HEADER ROW: Energy Rating & Pokemon Types */}
            <div className="flex justify-between items-start z-10 w-full">
              {/* Combat Energy Badge - Styled chunky arcade font */}
              <div className="flex flex-col">
                <span className="text-[9px] font-mono font-bold text-yellow-300 tracking-wider leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">ENERGY</span>
                <div className="relative mt-0.5">
                  <span className="text-3xl font-extrabold text-yellow-400 font-mono tracking-tighter leading-none italic select-none drop-shadow-[0_2px_0px_#92400e,0_3px_5px_rgba(0,0,0,0.8)]">
                    {tag.energy}
                  </span>
                </div>
              </div>

              {/* Badges: Type indicators */}
              <div className="flex gap-1 items-center">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${typeColor.bg} ${typeColor.text} ${typeColor.border} uppercase font-mono tracking-wider shadow-sm shadow-black/40`}>
                  {tag.type1}
                </span>
                {tag.type2 && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${secondaryTypeColor?.bg} ${secondaryTypeColor?.text} ${secondaryTypeColor?.border} uppercase font-mono tracking-wider shadow-sm shadow-black/40`}>
                    {tag.type2}
                  </span>
                )}
              </div>
            </div>

            {/* CENTER POKÉMON PORTRAIT (Aesthetic Pop-out) */}
            <div className="absolute inset-x-8 top-5 bottom-8 flex justify-center items-center z-10 pointer-events-none">
              {portraitSource ? (
                <img
                  src={portraitSource.url}
                  alt={tag.name}
                  loading="lazy"
                  decoding="async"
                  onError={() => {
                    setPortraitIndex((current) =>
                      current < portraitSources.length - 1 ? current + 1 : current,
                    );
                  }}
                  className={`h-28 w-auto object-contain transition-transform duration-500 select-none ${portraitTreatment.className} ${portraitTreatment.glowClassName} hover:scale-120 hover:-translate-y-1`}
                  style={{
                    transform: `translateY(${tag.portraitOffsetY ?? 0}px) scale(${tag.portraitScale ?? 1})`,
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-white/20 bg-black/20 text-center shadow-inner">
                  <CircleHelp className="h-8 w-8 text-white/75" />
                  <span className="mt-1 px-2 text-[8px] font-mono font-black uppercase tracking-wider text-white/70">
                    Needs Match
                  </span>
                </div>
              )}
            </div>

            {/* BOTTOM INFO ROW: Pokemon Name Bar, Stars, & Scan Indicator */}
            <div className="mt-auto flex justify-between items-end z-20 w-full">
              {/* Slanted Black Ribbon for Pokemon Name */}
              <div className="relative bg-zinc-950/95 border border-zinc-700/80 px-4 py-1 rounded-lg transform -skew-x-12 flex items-center gap-2 max-w-[65%] shadow-md shadow-black/60">
                <div className={`w-2.5 h-2.5 rounded-full ${typeColor.bg} ${typeColor.glow} shadow-lg`}></div>
                <span className="text-white font-extrabold text-sm tracking-tight capitalize font-sans select-none truncate">
                  {tag.name}
                </span>
              </div>

              {/* Stars rating and rarity sticker */}
              <div className="flex flex-col items-end gap-1 font-mono">
                {/* Rarity Tag */}
                <span className="text-[8px] font-extrabold text-white/90 bg-black/60 border border-white/20 px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">
                  {bStyles.label}
                </span>

                {/* Star Row */}
                <div className="flex gap-0.5">
                  {Array.from({ length: tag.stars }).map((_, i) => (
                    <svg
                      key={i}
                      className={`w-3.5 h-3.5 ${bStyles.starsColor}`}
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>

            {/* Tactile Embossed Pokemon Logo at the Bottom Left Rim */}
            <div className="absolute bottom-1.5 left-3 flex items-center gap-2 text-[7px] font-mono uppercase tracking-widest text-white/30 select-none pointer-events-none">
              <span>{printedCode}</span>
              <span className="hidden sm:inline text-white/22">TAP FOR STATS</span>
            </div>
          </div>
        </div>

        {/* BACK OF THE MEZASTAR TAG */}
        <div
          className={`absolute inset-0 w-full h-full rounded-[2.5rem] p-3 border-4 flex flex-col justify-between overflow-hidden ${bStyles.bg} ${bStyles.border}`}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
          }}
        >
          {/* Paper Sticker Style Background */}
          <div className="absolute inset-1.5 rounded-[2.1rem] bg-gradient-to-br from-yellow-50 via-slate-100 to-yellow-50/90 border border-zinc-400 p-2.5 flex flex-col justify-between overflow-hidden shadow-inner">
            
            {/* Top row of the sticker backing */}
            <div className="flex justify-between items-start w-full border-b border-zinc-300 pb-1">
              <div className="flex flex-col font-mono">
                <div className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-full ${typeColor.bg} border border-zinc-500`}></span>
                  <span className="text-[10px] font-bold text-zinc-900 uppercase">
                    No.{paddedId}
                  </span>
                </div>
                <span className="text-[14px] font-black text-zinc-800 tracking-tight mt-0.5 capitalize leading-none">
                  {tag.name}
                </span>
              </div>

              {/* Rarity Badge Back */}
              <div className="text-right flex flex-col items-end">
                <span className="text-[8px] font-bold text-zinc-500 tracking-wider">RARE ELEMENT</span>
                <span className="text-[10px] font-black text-purple-900 tracking-tighter uppercase">
                  {tag.rarity}
                </span>
              </div>
            </div>

            {/* Middle Main Content Grid (Stats vs Move + Barcode) */}
            <div className="grid grid-cols-2 gap-2 my-1 items-center flex-1 min-h-0">
              
              {/* Left Column: Stats Radar Meter */}
              <div className="flex flex-col gap-0.5 w-full justify-center">
                <span className="text-[8px] font-bold text-zinc-500 font-mono tracking-wider flex items-center gap-1">
                  <Swords className="w-2.5 h-2.5 text-zinc-700" /> BASE POWER MATRIX
                </span>
                
                {/* Visual mini progress bars for key battle stats */}
                <div className="flex flex-col gap-0.5 font-mono mt-0.5 text-[8px]">
                  <div className="flex flex-col">
                    <div className="flex justify-between text-zinc-700 font-bold px-0.5">
                      <span>HP</span>
                      <span className="text-zinc-900">{tag.stats.hp}</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-[3px] rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min(100, (tag.stats.hp / 220) * 100)}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <div className="flex justify-between text-zinc-700 font-bold px-0.5">
                      <span>ATK</span>
                      <span className="text-zinc-900">{tag.stats.attack}</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-[3px] rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (tag.stats.attack / 220) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex justify-between text-zinc-700 font-bold px-0.5">
                      <span>DEF</span>
                      <span className="text-zinc-900">{tag.stats.defense}</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-[3px] rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, (tag.stats.defense / 220) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex justify-between text-zinc-700 font-bold px-0.5">
                      <span>SPD</span>
                      <span className="text-zinc-900">{tag.stats.speed}</span>
                    </div>
                    <div className="w-full bg-zinc-200 h-[3px] rounded-full overflow-hidden">
                      <div className="bg-teal-500 h-full rounded-full" style={{ width: `${Math.min(100, (tag.stats.speed / 220) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Active Combat Moves & QR Barcode Area */}
              <div className="flex flex-col justify-between h-full py-0 min-h-0">
                {/* Active Battle Move info */}
                {tag.moves && tag.moves.length > 0 && (
                  <div className="flex flex-col gap-0.5 rounded bg-zinc-100 p-1 border border-zinc-200">
                    <span className="text-[7px] font-bold text-zinc-400 font-mono tracking-widest uppercase">MAIN BATTLE MOVE</span>
                    <div className="flex items-center justify-between text-[10px] font-black text-zinc-800 leading-none">
                      <span className="truncate max-w-[80%]">{tag.moves[0].name}</span>
                      <span className="text-[8px] bg-red-100 text-red-700 px-1 py-0.5 rounded ml-1">
                        {tag.moves[0].power}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${getElementColors(tag.moves[0].type).bg} ${getElementColors(tag.moves[0].type).text}`}>
                        {tag.moves[0].type}
                      </span>
                      <span className="text-[7px] text-zinc-500 font-mono font-bold uppercase">
                        {tag.moves[0].category}
                      </span>
                    </div>
                  </div>
                )}

                {/* Unique QR Code scanning graphic (represents Mezastar scan interface) */}
                <div className="flex items-center gap-1 mt-0.5 bg-white rounded border border-zinc-200 p-0.5">
                  {/* Decorative QR code matrix */}
                  <div className="w-5 h-5 bg-zinc-950 p-0.5 rounded shrink-0 flex flex-wrap gap-[1px]">
                    {Array.from({ length: 49 }).map((_, i) => {
                      const isPixel = (i * 7 + (i % 3) * 5 + 13) % 2 === 0 || i < 4 || i % 7 === 0 || i > 44 || i % 7 === 6;
                      return (
                        <div
                          key={i}
                          className={`w-0.5 h-0.5 ${isPixel ? "bg-white" : "bg-black"}`}
                        ></div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col font-mono text-[5.5px] leading-tight">
                    <span className="font-extrabold text-zinc-800">{tag.sourceStatus === "verified" ? "VERIFIED CATALOGUE" : "HOME ARENA"}</span>
                    <span className="text-zinc-500">SERIAL: MZ-{tag.energy}-{paddedId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact source row: no ownership phrase on the card back.
                Ownership status belongs outside the tiny card face so it never blocks stats. */}
            <div className="border-t border-zinc-300 pt-1 flex justify-between items-center w-full mt-auto gap-2">
              <span className="text-[7px] text-zinc-500 font-mono uppercase tracking-widest font-black truncate">
                {tag.sourceStatus === "verified"
                  ? "VERIFIED CATALOGUE"
                  : tag.sourceStatus === "needs-review"
                    ? "NEEDS MATCH"
                    : "HOME ARENA"}
              </span>

              <span className="shrink-0 text-[7px] text-zinc-500 font-mono uppercase tracking-widest font-black">
                {printedCode}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export const MezastarCard = React.memo(MezastarCardComponent);
