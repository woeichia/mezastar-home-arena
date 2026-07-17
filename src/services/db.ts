import { INITIAL_TAGS } from "../data/tags";
import type { MezastarTag } from "../types";

/**
 * v7 keeps the separated catalogue model and retires the old PE-code fixtures.
 *
 * - Catalogue records ship with the application and are refreshed by app updates.
 * - IndexedDB stores ownership/source-note overrides and manually created tags.
 * - The legacy v5 `binder-tags` store remains readable for a one-time migration.
 */
const DB_NAME = "tag-battle-home-arena";
const DB_VERSION = 7;
const LEGACY_TAG_STORE = "binder-tags";
const COLLECTION_STORE = "collection-state";
const CUSTOM_TAG_STORE = "custom-tags";
const META_STORE = "storage-meta";
const MIGRATION_KEY = "v6-separated-catalogue";
const RETIRED_FIXTURE_MIGRATION_KEY = "v7-retired-pe-fixtures";
const RETIRED_FIXTURE_IDS = new Set([
  "mz-6-001", "mz-6-002", "mz-6-003", "mz-6-004", "mz-6-005",
  "mz-5-001", "mz-5-002", "mz-5-003",
  "mz-4-001", "mz-4-002",
  "mz-3-001", "mz-3-002",
  "mz-2-001", "mz-2-002",
]);

interface CollectionRecord {
  tagId: string;
  copiesOwned: number;
  sourceNote?: string;
}

interface MetaRecord {
  key: string;
  value: string;
}

interface BinderBackup {
  format: "tag-battle-home-arena-backup";
  version: 1;
  exportedAt: string;
  tags: MezastarTag[];
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_TAG_STORE)) db.createObjectStore(LEGACY_TAG_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(COLLECTION_STORE)) db.createObjectStore(COLLECTION_STORE, { keyPath: "tagId" });
      if (!db.objectStoreNames.contains(CUSTOM_TAG_STORE)) db.createObjectStore(CUSTOM_TAG_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local binder storage"));
    request.onblocked = () => reject(new Error("Local binder storage is blocked by another open version of the app. Close other tabs and try again."));
  });
}

function normaliseTag(value: MezastarTag): MezastarTag {
  const copiesOwned = typeof value.copiesOwned === "number"
    ? Math.max(0, Math.min(9, Math.floor(value.copiesOwned)))
    : value.owned
      ? 1
      : 0;

  return {
    ...value,
    copiesOwned,
    owned: copiesOwned > 0,
    series: value.series ?? "Fixture",
    sourceStatus: value.sourceStatus ?? "fixture",
  };
}

function isUsableBinderTag(value: unknown): value is MezastarTag {
  if (!value || typeof value !== "object") return false;
  const tag = value as Partial<MezastarTag>;
  return typeof tag.id === "string"
    && typeof tag.name === "string"
    && typeof tag.type1 === "string"
    && typeof tag.energy === "number"
    && Array.isArray(tag.moves)
    && Boolean(tag.stats);
}

function isRetiredFixtureId(id: string) {
  return RETIRED_FIXTURE_IDS.has(id);
}

function readStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result as T[] : []);
    request.onerror = () => reject(request.error ?? new Error(`Unable to read ${storeName}`));
  });
}

function readMeta(db: IDBDatabase, key: string): Promise<MetaRecord | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(META_STORE, "readonly").objectStore(META_STORE).get(key);
    request.onsuccess = () => resolve(request.result as MetaRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error("Unable to read storage metadata"));
  });
}

function writeSeparatedData(db: IDBDatabase, tags: MezastarTag[], markMigrated = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const storeNames = markMigrated
      ? [COLLECTION_STORE, CUSTOM_TAG_STORE, META_STORE]
      : [COLLECTION_STORE, CUSTOM_TAG_STORE];
    const transaction = db.transaction(storeNames, "readwrite");
    const collectionStore = transaction.objectStore(COLLECTION_STORE);
    const customStore = transaction.objectStore(CUSTOM_TAG_STORE);
    const catalogueById = new Map(INITIAL_TAGS.map((tag) => [tag.id, tag]));

    collectionStore.clear();
    customStore.clear();

    tags.filter(isUsableBinderTag).filter((tag) => !isRetiredFixtureId(tag.id)).map(normaliseTag).forEach((tag) => {
      const catalogueTag = catalogueById.get(tag.id);
      const record: CollectionRecord = {
        tagId: tag.id,
        copiesOwned: tag.copiesOwned ?? 0,
      };
      if (tag.sourceNote && tag.sourceNote !== catalogueTag?.sourceNote) record.sourceNote = tag.sourceNote;
      collectionStore.put(record);

      if (!catalogueTag || tag.isCustom || tag.sourceStatus === "needs-review") customStore.put(tag);
    });

    if (markMigrated) transaction.objectStore(META_STORE).put({ key: MIGRATION_KEY, value: new Date().toISOString() } satisfies MetaRecord);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save local collection"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving local collection was aborted"));
  });
}

async function ensureV6Migration(db: IDBDatabase) {
  if (await readMeta(db, MIGRATION_KEY)) return;

  const legacyValues = db.objectStoreNames.contains(LEGACY_TAG_STORE)
    ? await readStore<unknown>(db, LEGACY_TAG_STORE)
    : [];
  const legacyTags = legacyValues.filter(isUsableBinderTag);
  await writeSeparatedData(db, legacyTags.length > 0 ? legacyTags : INITIAL_TAGS, true);
}

async function ensureRetiredFixtureCleanup(db: IDBDatabase) {
  if (await readMeta(db, RETIRED_FIXTURE_MIGRATION_KEY)) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([COLLECTION_STORE, CUSTOM_TAG_STORE, META_STORE], "readwrite");
    const collectionStore = transaction.objectStore(COLLECTION_STORE);
    const customStore = transaction.objectStore(CUSTOM_TAG_STORE);
    RETIRED_FIXTURE_IDS.forEach((id) => {
      collectionStore.delete(id);
      customStore.delete(id);
    });
    transaction.objectStore(META_STORE).put({
      key: RETIRED_FIXTURE_MIGRATION_KEY,
      value: new Date().toISOString(),
    } satisfies MetaRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to remove retired fixture records"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Fixture cleanup was aborted"));
  });
}

async function composeBinderTags(db: IDBDatabase): Promise<MezastarTag[]> {
  const [collection, customTags] = await Promise.all([
    readStore<CollectionRecord>(db, COLLECTION_STORE),
    readStore<MezastarTag>(db, CUSTOM_TAG_STORE),
  ]);
  const collectionById = new Map(collection.map((record) => [record.tagId, record]));
  const catalogueIds = new Set(INITIAL_TAGS.map((tag) => tag.id));

  const catalogue = INITIAL_TAGS.map((tag) => {
    const record = collectionById.get(tag.id);
    return normaliseTag({
      ...tag,
      copiesOwned: record?.copiesOwned ?? (tag.copiesOwned ?? (tag.owned ? 1 : 0)),
      sourceNote: record?.sourceNote ?? tag.sourceNote,
    });
  });
  const custom = customTags
    .filter(isUsableBinderTag)
    .filter((tag) => !isRetiredFixtureId(tag.id))
    .filter((tag) => !catalogueIds.has(tag.id))
    .map((tag) => {
      const record = collectionById.get(tag.id);
      return normaliseTag({
        ...tag,
        copiesOwned: record?.copiesOwned ?? tag.copiesOwned,
        sourceNote: record?.sourceNote ?? tag.sourceNote,
      });
    });

  return [...catalogue, ...custom];
}

export async function loadBinderTags(): Promise<MezastarTag[]> {
  const db = await openDatabase();
  try {
    await ensureV6Migration(db);
    await ensureRetiredFixtureCleanup(db);
    return await composeBinderTags(db);
  } finally {
    db.close();
  }
}

export async function saveBinderTags(tags: MezastarTag[]): Promise<void> {
  const db = await openDatabase();
  try {
    await ensureV6Migration(db);
    await ensureRetiredFixtureCleanup(db);
    await writeSeparatedData(db, tags);
  } finally {
    db.close();
  }
}

export function createBinderBackup(tags: MezastarTag[]) {
  const backup: BinderBackup = {
    format: "tag-battle-home-arena-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    tags: tags.filter(isUsableBinderTag).filter((tag) => !isRetiredFixtureId(tag.id)).map(normaliseTag),
  };
  return JSON.stringify(backup, null, 2);
}

export function parseBinderBackup(text: string): MezastarTag[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This is not a valid JSON backup file.");
  }

  const candidate = parsed as Partial<BinderBackup>;
  if (candidate.format !== "tag-battle-home-arena-backup" || candidate.version !== 1 || !Array.isArray(candidate.tags)) {
    throw new Error("This backup format is not supported.");
  }
  const tags = candidate.tags.filter(isUsableBinderTag).filter((tag) => !isRetiredFixtureId(tag.id)).map(normaliseTag);
  if (tags.length === 0) throw new Error("The backup does not contain any usable tag records.");
  return tags;
}

export async function restoreBinderBackup(text: string): Promise<MezastarTag[]> {
  const restored = parseBinderBackup(text);
  await saveBinderTags(restored);
  return loadBinderTags();
}
