import { useEffect, useRef, useState } from "react";

import { lookUpCovers, type LookupProgress } from "../lib/cover-lookup-runner";

export type LookupPhase = "idle" | "running" | "done" | "stopped" | "failed";

/**
 * Runs the bulk cover lookup (cover-lookup-runner.ts) while the screen is
 * open: leaving it stops the run, and starting again carries on with the
 * albums still left.
 */
export function useCoverLookup() {
  const [phase, setPhase] = useState<LookupPhase>("idle");
  const [progress, setProgress] = useState<LookupProgress | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function start() {
    const current = new AbortController();
    controller.current = current;
    setPhase("running");
    lookUpCovers({ signal: current.signal, onProgress: setProgress }).then(
      (final) => {
        setProgress(final);
        setPhase(current.signal.aborted ? "stopped" : "done");
      },
      () => setPhase("failed"),
    );
  }

  function stop() {
    controller.current?.abort();
  }

  return { phase, progress, start, stop };
}
