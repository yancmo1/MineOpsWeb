import { fetchSaveRoot, type KolibriCredentials } from "./kolibri";
import { summarizeSave, type SaveStructure } from "./save-structure";

export * from "./save-structure";

export async function inspectSave(credentials: KolibriCredentials): Promise<SaveStructure> {
  const { root } = await fetchSaveRoot(credentials);
  return summarizeSave(root);
}
