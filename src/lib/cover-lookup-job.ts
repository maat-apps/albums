import type { LookupSource } from "./cover-lookup";
import { lookUpCovers, type LookupProgress } from "./cover-lookup-runner";

// The bulk cover lookup as one app-wide job: it keeps going when the covers
// screen closes, until it finishes, the user stops it or the app itself
// closes. Screens read its state through src/hooks/use-cover-lookup.ts.

export type LookupPhase = "idle" | "running" | "done" | "stopped" | "failed";

export type LookupState = {
  phase: LookupPhase;
  progress: LookupProgress | null;
};

const listeners = new Set<() => void>();
let state: LookupState = { phase: "idle", progress: null };
let controller: AbortController | null = null;

function update(next: Partial<LookupState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function getLookupState(): LookupState {
  return state;
}

export function subscribeToLookup(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Starts a run over `sources`; does nothing while one is running. */
export function startLookup(sources: LookupSource[]): void {
  if (state.phase === "running") return;
  const current = new AbortController();
  controller = current;
  update({ phase: "running" });
  lookUpCovers({
    sources,
    signal: current.signal,
    onProgress: (progress) => update({ progress }),
  }).then(
    (final) =>
      update({
        progress: final,
        phase: current.signal.aborted ? "stopped" : "done",
      }),
    () => update({ phase: "failed" }),
  );
}

/** Stops the running lookup; what it found so far stays saved. */
export function stopLookup(): void {
  controller?.abort();
}
