import {
  decryptJson,
  encryptJson,
  isEncryptedBlob,
} from "@maat-apps/core/crypto";
import * as v from "valibot";

import {
  getSettingsSnapshot,
  whenLoaded as whenSettingsLoaded,
} from "./app-settings";
import { encryptionKey } from "./encryption-key";
import { keyValueStore } from "./idb-store";
import {
  authorizeUrl,
  codeChallenge,
  exchangeCode,
  randomToken,
  refreshToken,
  SpotifyAuthError,
  type SpotifyToken,
} from "./spotify-auth";
import { SPOTIFY_KEY } from "./storage-keys";

// The Spotify connection: its token lives in IndexedDB, encrypted with the
// lock's key like the albums, and never in a backup. Screens subscribe for
// "connected or not" (src/hooks/use-spotify.ts); spotify-api.ts asks for an
// access token, refreshed here when it's about to expire.

const TokenSchema = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
  expiresAt: v.number(),
});

// Survives the round trip to Spotify's login page in this tab only.
const PENDING_KEY = "albums-spotify-pending";
const PendingSchema = v.object({ state: v.string(), verifier: v.string() });

/** Refresh this long before the token actually expires. */
const EXPIRY_MARGIN = 60_000;

const listeners = new Set<() => void>();
let token: SpotifyToken | null = null;
let loaded: Promise<void> | null = null;
let completing: Promise<ConnectResult> | null = null;

function emitChange(): void {
  for (const listener of listeners) listener();
}

async function load(): Promise<void> {
  await whenSettingsLoaded();
  if (getSettingsSnapshot().lock?.encryptionSupported) {
    await encryptionKey.whenSet();
  }
  try {
    const stored = await keyValueStore.get<unknown>(SPOTIFY_KEY);
    const key = encryptionKey.get();
    const value =
      key && isEncryptedBlob(stored)
        ? await decryptJson<unknown>(key, stored)
        : stored;
    if (v.is(TokenSchema, value)) token = value;
  } catch {
    // Unreadable: treated as not connected.
  }
  emitChange();
}

/** Starts the background read on first use. */
export function whenLoaded(): Promise<void> {
  loaded ??= load();
  return loaded;
}

async function save(next: SpotifyToken | null): Promise<void> {
  token = next;
  emitChange();
  if (!next) {
    await keyValueStore.delete(SPOTIFY_KEY);
    return;
  }
  const key = encryptionKey.get();
  await keyValueStore.set(
    SPOTIFY_KEY,
    key ? await encryptJson(key, next) : next,
  );
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void whenLoaded();
  return () => listeners.delete(listener);
}

export function isConnected(): boolean {
  return token !== null;
}

/** The server render's answer — never connected. */
export function isConnectedOnServer(): boolean {
  return false;
}

/** Sends the user to Spotify's login; they come back with `?code=`. */
export async function beginConnect(): Promise<void> {
  const state = randomToken();
  const verifier = randomToken();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, verifier }));
  window.location.assign(authorizeUrl(state, await codeChallenge(verifier)));
}

export type ConnectResult = "connected" | "failed" | "none";

function readPending(): v.InferOutput<typeof PendingSchema> | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return v.is(PendingSchema, value) ? value : null;
  } catch {
    return null;
  }
}

async function complete(params: URLSearchParams): Promise<ConnectResult> {
  const pending = readPending();
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) {
    return "failed";
  }
  try {
    await whenLoaded();
    await save(await exchangeCode(code, pending.verifier));
    return "connected";
  } catch {
    return "failed";
  }
}

/**
 * Finishes a connection from the redirect's query string ("none" when it
 * isn't one). Runs once even if called twice (React's strict effects).
 */
export function completeConnect(
  params: URLSearchParams,
): Promise<ConnectResult> {
  if (!params.has("code") && !params.has("error")) {
    return Promise.resolve("none");
  }
  completing ??= complete(params).finally(() => {
    completing = null;
  });
  return completing;
}

/** Thrown when there's no (longer a) usable connection. */
export class NotConnectedError extends Error {
  constructor() {
    super("Spotify isn't connected");
    this.name = "NotConnectedError";
  }
}

/**
 * A valid access token, refreshed first when it's (about to be) expired or
 * `force` says the last one was rejected. A refused refresh disconnects.
 */
export async function getAccessToken(force = false): Promise<string> {
  await whenLoaded();
  if (!token) throw new NotConnectedError();
  if (!force && token.expiresAt - EXPIRY_MARGIN > Date.now()) {
    return token.accessToken;
  }
  try {
    const fresh = await refreshToken(token);
    await save(fresh);
    return fresh.accessToken;
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      await save(null);
      throw new NotConnectedError();
    }
    throw error;
  }
}

export async function disconnect(): Promise<void> {
  await whenLoaded();
  await save(null);
}

/** The lock changed keys: store the token again under the new one. */
export async function rewriteSpotifyToken(): Promise<void> {
  await whenLoaded();
  await save(token);
}
