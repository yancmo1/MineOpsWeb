/**
 * Import History — stores sanitized import metadata in IndexedDB.
 *
 * Contains NO credentials, NO tokens, NO raw save payloads.
 * Only diagnostic summaries, counts, and catalog references.
 */

import Dexie, { type EntityTable } from "dexie";
import { type ImportRecord } from "./kolibri-fixtures";

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

class ImportHistoryDb extends Dexie {
  imports!: Dexie.Table<ImportRecord, number>;

  constructor() {
    super("mineops_import_history");
    this.version(1).stores({
      imports: "++id, importedAt, source, catalogVersion",
    });
  }
}

const importDb = new ImportHistoryDb();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store a sanitized import record.
 */
export async function saveImportRecord(record: ImportRecord): Promise<number> {
  return importDb.imports.add(record);
}

/**
 * List all import records, newest first.
 */
export async function listImportRecords(): Promise<ImportRecord[]> {
  return importDb.imports.orderBy("importedAt").reverse().toArray();
}

/**
 * Get a single import record by ID.
 */
export async function getImportRecord(id: number): Promise<ImportRecord | undefined> {
  return importDb.imports.get(id);
}

/**
 * Get the most recent import record.
 */
export async function getLatestImport(): Promise<ImportRecord | undefined> {
  const records = await importDb.imports.orderBy("importedAt").reverse().limit(1).toArray();
  return records[0];
}

/**
 * Get all imports for a specific catalog version.
 */
export async function getImportsByCatalog(catalogVersion: string): Promise<ImportRecord[]> {
  return importDb.imports
    .where("catalogVersion")
    .equals(catalogVersion)
    .reverse()
    .toArray();
}

/**
 * Delete all import records.
 */
export async function clearImportHistory(): Promise<void> {
  await importDb.imports.clear();
}

/**
 * Get import history statistics.
 */
export async function getImportStats(): Promise<{
  totalImports: number;
  totalResolved: number;
  totalUnresolved: number;
  totalNewlyUnlocked: number;
  latestImport: ImportRecord | null;
}> {
  const all = await importDb.imports.toArray();
  return {
    totalImports: all.length,
    totalResolved: all.reduce((s, r) => s + r.resolvedCount, 0),
    totalUnresolved: all.reduce((s, r) => s + r.unresolvedCount, 0),
    totalNewlyUnlocked: all.reduce((s, r) => s + r.newlyUnlocked, 0),
    latestImport: all.sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0] ?? null,
  };
}
