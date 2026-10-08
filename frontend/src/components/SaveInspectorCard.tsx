import { useState } from "react";
import type { KolibriCredentials } from "../lib/kolibri";
import { inspectSave } from "../lib/save-inspector";
import { formatSaveReport, type SaveStructure } from "../lib/save-structure";

/**
 * "What is inside my save?" — names only.
 * Lists every drawer in the Kolibri save (name, list/box, count, field
 * names). Never shows a value. Built to answer one question: does the
 * save carry mine/continent state we have been ignoring?
 */
export function SaveInspectorCard({ credentials }: { credentials: KolibriCredentials }) {
  const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState("");
  const [structure, setStructure] = useState<SaveStructure | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setState("loading");
    setMessage("");
    setCopied(false);
    try {
      const result = await inspectSave(credentials);
      setStructure(result);
      setState("done");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not read the save.");
    }
  }

  async function copyReport() {
    if (!structure) return;
    try {
      await navigator.clipboard.writeText(formatSaveReport(structure));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const interesting = structure?.sections.filter((s) => s.interesting) ?? [];

  return (
    <div className="save-inspector">
      <h3>What is inside my save?</h3>
      <p className="muted">
        This looks at your save and lists only the <strong>names</strong> of its parts.
        No numbers. No secrets. We use it to find out if your save already knows your mines.
      </p>
      <div className="save-inspector-actions">
        <button type="button" onClick={() => void run()} disabled={state === "loading"}>
          {state === "loading" ? "Looking inside…" : "Look inside my save"}
        </button>
        {structure && (
          <button type="button" className="secondary" onClick={() => void copyReport()}>
            {copied ? "Copied ✓" : "Copy the list"}
          </button>
        )}
      </div>
      {state === "error" && <p className="settings-error-text">{message} Fill in your Kolibri details above first, then try again.</p>}
      {structure && (
        <div className="save-inspector-results">
          <p>
            Found <strong>{structure.sections.length}</strong> parts.
            {interesting.length > 0 ? <> <strong>{interesting.length}</strong> look mine-related (⭐).</> : " None look mine-related by name."}
          </p>
          <ul>
            {structure.sections.map((section) => (
              <li key={section.key}>
                <strong>{section.interesting ? "⭐ " : ""}{section.key}</strong>
                <span className="muted"> — {section.kind === "list" ? `list of ${section.count}` : section.kind === "box" ? `box with ${section.count} parts` : "single value"}</span>
                {section.fieldNames.length > 0 && <div className="muted save-inspector-fields">Inside: {section.fieldNames.join(", ")}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
