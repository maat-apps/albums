import { useSyncExternalStore } from "react";

import type { LookupSource } from "../lib/cover-lookup";
import {
  getLookupState,
  startLookup,
  stopLookup,
  subscribeToLookup,
} from "../lib/cover-lookup-job";

export type { LookupPhase } from "../lib/cover-lookup-job";

/**
 * The app-wide bulk cover lookup (cover-lookup-job.ts): leaving the screen
 * doesn't stop it, and opening the screen again shows the run in progress.
 */
export function useCoverLookup(sources: LookupSource[]) {
  const { phase, progress } = useSyncExternalStore(
    subscribeToLookup,
    getLookupState,
  );
  return {
    phase,
    progress,
    start: () => startLookup(sources),
    stop: stopLookup,
  };
}
