import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, Download, Heart, LibraryBig, Settings, Sparkles, Swords, Trash2, Upload } from "lucide-react";
import type { MezastarTag } from "./types";
import { AlbumView } from "./components/AlbumView";
import { CatalogueBrowser } from "./components/CatalogueBrowser";
import { UnknownTagForm } from "./components/UnknownTagForm";
import { BattleSetup } from "./components/BattleSetup";
import { clearBinderCollection, createBinderBackup, loadBinderTags, restoreBinderBackup, saveBinderTags } from "./services/db";

type Screen = "binder" | "catalogue" | "unknown" | "battle" | "settings";

export default function App() {
  const [tags, setTags] = useState<MezastarTag[]>([]);
  const [activeScreen, setActiveScreen] = useState<Screen>("binder");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const ownedTags = useMemo(
    () => tags.filter((tag) => (tag.copiesOwned ?? (tag.owned ? 1 : 0)) > 0),
    [tags],
  );

  const ownedCopyCount = useMemo(
    () => ownedTags.reduce(
      (sum, tag) => sum + (tag.copiesOwned ?? (tag.owned ? 1 : 0)),
      0,
    ),
    [ownedTags],
  );

  const needsMatchCount = useMemo(
    () => tags.filter((tag) => tag.sourceStatus === "needs-review").length,
    [tags],
  );

  const loadBinder = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      setTags(await loadBinderTags());
    } catch (error) {
      console.error("Could not open local binder storage", error);
      setLoadError(error instanceof Error ? error.message : "Could not open local binder storage.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBinder();
  }, [loadBinder]);

  const updateTags = (next: MezastarTag[]) => {
    setTags(next);
    void saveBinderTags(next).catch((error) => {
      console.error("Could not save local binder", error);
    });
  };

  const toggleOwned = (id: string) => {
    updateTags(tags.map((tag) => {
      if (tag.id !== id) return tag;
      const nextCopies = (tag.copiesOwned ?? (tag.owned ? 1 : 0)) > 0 ? 0 : 1;
      return { ...tag, copiesOwned: nextCopies, owned: nextCopies > 0 };
    }));
  };

  const addToCollection = (quantities: Record<string, number>) => {
    updateTags(tags.map((tag) => {
      const quantity = quantities[tag.id];
      if (!quantity) return tag;
      return { ...tag, copiesOwned: Math.max(1, Math.min(9, quantity)), owned: true };
    }));
  };

  const addUnknownTag = (tag: MezastarTag) => {
    updateTags([tag, ...tags]);
    setActiveScreen("binder");
  };

  const matchUnknownTag = (unknownTagId: string, catalogueTagId: string) => {
    const unknownTag = tags.find((tag) => tag.id === unknownTagId);
    const catalogueTag = tags.find((tag) => tag.id === catalogueTagId);

    if (!unknownTag || !catalogueTag) return;

    const unknownCopies = Math.max(
      1,
      unknownTag.copiesOwned ?? (unknownTag.owned ? 1 : 0),
    );
    const existingCopies = catalogueTag.copiesOwned ?? (catalogueTag.owned ? 1 : 0);
    const nextCopies = Math.min(9, existingCopies + unknownCopies);

    updateTags(
      tags
        .filter((tag) => tag.id !== unknownTagId)
        .map((tag) => {
          if (tag.id !== catalogueTagId) return tag;

          return {
            ...tag,
            copiesOwned: nextCopies,
            owned: true,
            sourceStatus: "verified",
            sourceNote:
              tag.sourceNote ||
              `Matched from manually added tag ${unknownTag.officialTagCode || unknownTag.pokedexNo || unknownTag.id}.`,
          };
        }),
    );
  };

  const exportBackup = () => {
    const blob = new Blob([createBinderBackup(tags)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tag-battle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupStatus({ kind: "success", message: `Backup created with ${ownedTags.length} owned designs.` });
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const restored = await restoreBinderBackup(await file.text());
      setTags(restored);
      setBackupStatus({ kind: "success", message: "Backup restored. Your bundled catalogue was kept up to date." });
    } catch (error) {
      setBackupStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not restore this backup." });
    }
  };

  const deleteCollection = async () => {
    const confirmed = window.confirm(
      `Delete your collection from this device?\n\nThis removes ${ownedCopyCount} owned tag${ownedCopyCount === 1 ? "" : "s"} and ${needsMatchCount} manually added tag${needsMatchCount === 1 ? "" : "s"}. The 420-tag catalogue will remain available. This cannot be undone unless you exported a backup.`,
    );
    if (!confirmed) return;

    try {
      setTags(await clearBinderCollection());
      setBackupStatus({ kind: "success", message: "Collection deleted from this device. The catalogue is still available." });
    } catch (error) {
      setBackupStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not delete the collection." });
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0510] font-sans text-white selection:bg-purple-600/30">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-40">
        <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-purple-600 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-red-600 blur-[120px]" />
        <div className="absolute right-[10%] top-[20%] h-[40%] w-[30%] rounded-full bg-blue-600 blur-[100px]" />
      </div>

      <div className="relative z-50 h-1.5 bg-gradient-to-r from-purple-600 via-amber-400 to-indigo-600 shadow-[0_0_12px_rgba(168,85,247,0.7)]" />
        {activeScreen !== "battle" && (


      <header className="sticky top-3 z-40 mx-3 mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-2xl backdrop-blur-xl sm:mx-6 sm:mt-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-purple-400/30 bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-950/50">
              <Sparkles className="h-5 w-5 text-white" />
              <div className="absolute inset-0 -skew-x-12 bg-white/10" />
            </div>
            <div className="flex flex-col">
              <div className="text-xl font-black leading-none tracking-tighter text-white">TAG BATTLE</div>
              <span className="mt-1 text-[10px] font-mono font-extrabold uppercase tracking-widest text-white/40">
                Home Arena · Private Family Binder
              </span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1.5 shadow-lg backdrop-blur-md">
            <button type="button" onClick={() => setActiveScreen("binder")} className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${activeScreen === "binder" ? "border-white/30 bg-white/20 text-white shadow-md" : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"}`}>
              <BookOpen className="h-4 w-4" /> My Collection
            </button>
            <button type="button" onClick={() => setActiveScreen("catalogue")} className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${activeScreen === "catalogue" || activeScreen === "unknown" ? "border-amber-300/40 bg-amber-300/15 text-amber-100 shadow-md" : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"}`}>
              <LibraryBig className="h-4 w-4" /> Catalogue
            </button>
            <button type="button" onClick={() => setActiveScreen("battle")} className="flex items-center gap-2 rounded-xl border border-transparent px-4 py-2 text-xs font-bold text-white/60 transition-all hover:bg-white/5 hover:text-white">
              <Swords className="h-4 w-4" /> Battle
            </button>
            <button type="button" onClick={() => setActiveScreen("settings")} className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${activeScreen === "settings" ? "border-white/30 bg-white/20 text-white shadow-md" : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"}`}>
              <Settings className="h-4 w-4" /> Settings
            </button>
          </nav>
        </div>
      </header>
        )}

      <main className="relative z-10 mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 md:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center font-mono text-sm text-white/60">Opening local binder…</div>
        ) : loadError ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-rose-300/30 bg-rose-500/10 p-6 shadow-2xl sm:p-8">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-rose-200">Binder storage needs attention</span>
            <h1 className="mt-2 text-2xl font-black">Your fixture cards could not load.</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{loadError}</p>
            <button type="button" onClick={() => void loadBinder()} className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition-colors hover:bg-purple-100">Retry Binder</button>
          </section>
        ) : activeScreen === "binder" ? (
          <AlbumView
            tags={ownedTags}
            catalogueTags={tags}
            onToggleOwned={toggleOwned}
            onSelectTag={() => undefined}
            defaultOwnedOnly={false}
            onBrowseCatalogue={() => setActiveScreen("catalogue")}
            onMatchUnknownTag={matchUnknownTag}
          />
        ) : activeScreen === "catalogue" ? (
          <CatalogueBrowser tags={tags} onClose={() => setActiveScreen("binder")} onAddToCollection={addToCollection} onAddUnknownTag={() => setActiveScreen("unknown")} />
        ) : activeScreen === "unknown" ? (
          <UnknownTagForm onCancel={() => setActiveScreen("catalogue")} onSave={addUnknownTag} />
        ) : activeScreen === "battle" ? (
          <BattleSetup ownedTags={ownedTags} onBackToCollection={() => setActiveScreen("binder")} />
        ) : (
          <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-purple-300">Local collection settings</span>
            <h1 className="mt-2 text-2xl font-black">Your binder stays on this device.</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Your ownership selections, copy quantities, and unknown tags are stored in IndexedDB. No AI Forge, server, Gemini key, scanner console, or online account is used.
            </p>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <Heart className="h-5 w-5 text-rose-300" />
              <span className="text-sm"><strong>{ownedCopyCount}</strong> physical tags across <strong>{ownedTags.length}</strong> collected designs.</span>
            </div>
            <div className="mt-3 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/5 p-4 text-sm text-white/65">
              <strong className="text-fuchsia-200">{needsMatchCount}</strong> tag{needsMatchCount === 1 ? "" : "s"} waiting for a catalogue match.
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-200/60">Device backup</div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">Export before changing phones, clearing browser storage, or uninstalling the app. Restoring keeps the catalogue from the installed app and reapplies your collection.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={exportBackup} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/15">
                  <Download className="h-4 w-4" />Export Backup
                </button>
                <button type="button" onClick={() => backupInputRef.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-100 transition hover:bg-sky-400/15">
                  <Upload className="h-4 w-4" />Import Backup
                </button>
                <input ref={backupInputRef} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event)} className="hidden" />
              </div>
              {backupStatus && (
                <div className={`mt-4 flex items-start gap-2 rounded-2xl border p-3 text-sm ${backupStatus.kind === "success" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}>
                  {backupStatus.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{backupStatus.message}</span>
                </div>
              )}
            </div>
            <div className="mt-6 rounded-3xl border border-rose-300/20 bg-rose-500/5 p-5">
              <div className="text-[10px] font-mono font-black uppercase tracking-widest text-rose-200/70">Delete local collection</div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Removes all owned quantities and manually added tags from this device. The 420-tag catalogue stays available. Export a backup first if you may want to restore the collection later.
              </p>
              <button
                type="button"
                onClick={() => void deleteCollection()}
                disabled={ownedCopyCount === 0 && needsMatchCount === 0}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />Delete My Collection
              </button>
            </div>
          </section>
        )}
      </main>{activeScreen !== "battle" && (

      <footer className="relative z-10 mt-auto border-t border-zinc-800/60 px-6 py-6 text-center font-mono text-xs text-zinc-500">
        Private family collector prototype · 420 verified catalogue identities · local collection backup enabled.
      </footer>
        )}
    </div>
  );
}
