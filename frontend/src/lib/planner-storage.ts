/**
 * Planner persistence (IndexedDB via Dexie).
 *
 * Stores saved strategy plans and dismissed recommendations so the planner
 * is repeatable across sessions (PRD §9.1). Plans store a snapshot of the
 * evaluated content plus the catalog release identity it was built from.
 */

import { db } from "./db";

export type StrategyPlanKind = "lineup" | "upgrade" | "frontier";

export interface SavedStrategyPlan {
  id?: number;
  kind: StrategyPlanKind;
  title: string;
  createdAt: string;
  catalogReleaseId: string | null;
  catalogVersion: string | null;
  snapshot: unknown;
}

export interface DismissedRecommendation {
  id: string;
  managerId: string;
  kind: "lineup" | "upgrade";
  dismissedAt: string;
}

export async function saveStrategyPlan(plan: Omit<SavedStrategyPlan, "id" | "createdAt">): Promise<number> {
  const id = await db.table<SavedStrategyPlan, number>("strategy_plans").add({
    ...plan,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function listStrategyPlans(): Promise<SavedStrategyPlan[]> {
  return (await db.table<SavedStrategyPlan, number>("strategy_plans").toArray())
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function deleteStrategyPlan(id: number): Promise<void> {
  await db.table<SavedStrategyPlan, number>("strategy_plans").delete(id);
}

function dismissalId(managerId: string, kind: "lineup" | "upgrade"): string {
  return `${kind}:${managerId}`;
}

export async function dismissRecommendation(managerId: string, kind: "lineup" | "upgrade"): Promise<void> {
  const id = dismissalId(managerId, kind);
  await db.table<DismissedRecommendation, string>("dismissed_recommendations").put({
    id,
    managerId,
    kind,
    dismissedAt: new Date().toISOString(),
  });
}

export async function undismissRecommendation(managerId: string, kind: "lineup" | "upgrade"): Promise<void> {
  await db.table<DismissedRecommendation, string>("dismissed_recommendations").delete(dismissalId(managerId, kind));
}

export async function listDismissedRecommendations(): Promise<DismissedRecommendation[]> {
  return db.table<DismissedRecommendation, string>("dismissed_recommendations").toArray();
}

export async function isDismissed(managerId: string, kind: "lineup" | "upgrade"): Promise<boolean> {
  return (await db.table<DismissedRecommendation, string>("dismissed_recommendations").get(dismissalId(managerId, kind))) != null;
}
