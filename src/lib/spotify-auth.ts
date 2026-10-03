import { randomBytes, toBase64Url } from "@maat-apps/core/crypto";
import * as v from "valibot";

// Spotify's Authorization Code flow with PKCE — the flow made for apps with
// no server: no client secret, the browser talks to Spotify directly. The
// client id is public by design (it's in the authorize URL anyway); the
// Spotify app it names lists this app's redirect URI. Only search is used,
// so no scopes are requested.

export const SPOTIFY_CLIENT_ID = "c0570198df534a60951ca88ff513fd88";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export type SpotifyToken = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
};

const TokenResponseSchema = v.object({
  access_token: v.string(),
  expires_in: v.number(),
  refresh_token: v.optional(v.string()),
});

/** The token request was refused (e.g. the refresh token was revoked). */
export class SpotifyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

/** Where Spotify sends the user back: the app's own root. */
export function redirectUri(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

/** A random URL-safe string (PKCE verifier, OAuth state). */
export function randomToken(): string {
  return toBase64Url(randomBytes(32));
}

/** PKCE's S256 challenge for `verifier`. */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return toBase64Url(new Uint8Array(digest));
}

export function authorizeUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

async function requestToken(
  params: Record<string, string>,
  previous: string | null,
  now: number,
): Promise<SpotifyToken> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...params }),
    credentials: "omit",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !v.is(TokenResponseSchema, body)) {
    throw new SpotifyAuthError(
      `Spotify token request: HTTP ${response.status}`,
    );
  }
  const refreshToken = body.refresh_token ?? previous;
  if (!refreshToken)
    throw new SpotifyAuthError("Spotify sent no refresh token");
  return {
    accessToken: body.access_token,
    refreshToken,
    expiresAt: now + body.expires_in * 1000,
  };
}

/** Trades the code Spotify redirected back with for a token. */
export function exchangeCode(
  code: string,
  verifier: string,
  now = Date.now(),
): Promise<SpotifyToken> {
  return requestToken(
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    },
    null,
    now,
  );
}

/** A fresh access token; Spotify may rotate the refresh token too. */
export function refreshToken(
  token: SpotifyToken,
  now = Date.now(),
): Promise<SpotifyToken> {
  return requestToken(
    { grant_type: "refresh_token", refresh_token: token.refreshToken },
    token.refreshToken,
    now,
  );
}
