// Reading and writing one file in a GitHub repository through the REST API,
// straight from the browser (api.github.com allows cross-origin requests).
// Authenticated with the user's fine-grained personal access token: GitHub's
// sign-in flows need a server-side secret this app doesn't have.

export type RepoFileLocation = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
};

export type RepoFile = { text: string; sha: string };

export type GitHubErrorKind =
  "unauthorized" | "notFound" | "conflict" | "network" | "unexpected";

export class GitHubError extends Error {
  readonly kind: GitHubErrorKind;

  constructor(kind: GitHubErrorKind) {
    super(`GitHub request failed: ${kind}`);
    this.kind = kind;
  }
}

const API = "https://api.github.com";

function repoUrl({ owner, repo }: RepoFileLocation): string {
  return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function contentsUrl(location: RepoFileLocation): string {
  const path = location.path.split("/").map(encodeURIComponent).join("/");
  return `${repoUrl(location)}/contents/${path}`;
}

function errorKind(status: number): GitHubErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "notFound";
  // The file changed since it was read (a stale `sha`).
  if (status === 409) return "conflict";
  return "unexpected";
}

async function request(
  location: RepoFileLocation,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${location.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    throw new GitHubError("network");
  }
  if (!response.ok) throw new GitHubError(errorKind(response.status));
  return response;
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  // In chunks: spreading a whole large file into one call overflows the stack.
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

type ContentsResponse = { sha: string; content?: string; encoding?: string };

/** The file, or `null` when the repository exists but the file doesn't. */
export async function readRepoFile(
  location: RepoFileLocation,
): Promise<RepoFile | null> {
  let response: Response;
  try {
    response = await request(
      location,
      `${contentsUrl(location)}?ref=${encodeURIComponent(location.branch)}`,
    );
  } catch (error) {
    if (!(error instanceof GitHubError) || error.kind !== "notFound") {
      throw error;
    }
    // A 404 is also what a token without access to the repository gets.
    await request(location, repoUrl(location));
    return null;
  }
  const file = (await response.json()) as ContentsResponse;
  if (file.encoding === "base64" && file.content !== undefined) {
    return { text: decodeBase64(file.content), sha: file.sha };
  }
  // Over 1 MB the contents API leaves the content out; the blob has it.
  const blob = (await (
    await request(location, `${repoUrl(location)}/git/blobs/${file.sha}`)
  ).json()) as { content: string };
  return { text: decodeBase64(blob.content), sha: file.sha };
}

/** Commits `text` as the file; `sha` is the version it replaces (`null`: new file). */
export async function writeRepoFile(
  location: RepoFileLocation,
  text: string,
  sha: string | null,
  message: string,
): Promise<void> {
  await request(location, contentsUrl(location), {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: encodeBase64(text),
      branch: location.branch,
      ...(sha !== null && { sha }),
    }),
  });
}
