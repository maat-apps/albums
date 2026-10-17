import { useId, useState, type ComponentProps, type FormEvent } from "react";

import { GitHubError } from "@maat-apps/core/github";
import { Button } from "@maat-apps/ui/button";
import { Input } from "@maat-apps/ui/input";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";
import { useAppSettings } from "../../hooks/use-app-settings";
import {
  useGitHubConnection,
  useGitHubSyncStatus,
} from "../../hooks/use-github";
import { useTranslation } from "../../i18n/use-translation";

import {
  connectGitHub,
  disconnectGitHub,
  syncWithGitHub,
} from "../../lib/github-sync";

type TranslationKey = Parameters<ReturnType<typeof useTranslation>["t"]>[0];

function errorMessage(error: unknown): TranslationKey {
  if (!(error instanceof GitHubError)) return "githubErrorUnexpected";
  const messages: Record<GitHubError["kind"], TranslationKey> = {
    unauthorized: "githubErrorUnauthorized",
    notFound: "githubErrorNotFound",
    conflict: "githubErrorConflict",
    rateLimited: "githubErrorRateLimited",
    network: "githubErrorNetwork",
    server: "githubErrorUnexpected",
    // A file with albums the app can't read (albums-file.ts).
    invalid: "githubErrorFile",
  };
  return messages[error.kind];
}

function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground m-0 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

function ConnectForm({
  onStatus,
  onCancel,
}: {
  onStatus: (message: string | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("main");
  const [path, setPath] = useState("albums.json");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    onStatus(null);
    const [owner, repo, ...rest] = repository.trim().split("/");
    if (!owner || !repo || rest.length > 0) {
      onStatus(t("githubErrorRepository"));
      return;
    }
    setBusy(true);
    try {
      await connectGitHub({
        owner,
        repo: repo.replace(/\.git$/, ""),
        branch: branch.trim() || "main",
        path: path.trim().replace(/^\/+/, "") || "albums.json",
        token: token.trim(),
      });
      onStatus(t("githubConnected"));
    } catch (error) {
      onStatus(t(errorMessage(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 px-1" onSubmit={(event) => void submit(event)}>
      <Field
        label={t("githubRepository")}
        placeholder="owner/albums-data"
        value={repository}
        onChange={(event) => setRepository(event.target.value)}
        required
      />
      <Field
        label={t("githubBranch")}
        value={branch}
        onChange={(event) => setBranch(event.target.value)}
      />
      <Field
        label={t("githubPath")}
        value={path}
        onChange={(event) => setPath(event.target.value)}
      />
      <Field
        label={t("githubToken")}
        hint={t("githubTokenHint")}
        type="password"
        autoComplete="off"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        required
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-10.5 px-4"
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
        <Button type="submit" className="min-h-10.5 px-4" disabled={busy}>
          {busy ? t("githubConnectBusy") : t("githubConnect")}
        </Button>
      </div>
    </form>
  );
}

// Sync with a JSON file in the user's own GitHub repository (PRODUCT.md,
// lib/github-sync.ts). Offered only with a lock that encrypts: the access
// token is never stored otherwise.
export function GitHubSection({
  onStatus,
}: {
  onStatus: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const { lock } = useAppSettings();
  const connection = useGitHubConnection();
  const { syncing, error } = useGitHubSyncStatus();
  const [connecting, setConnecting] = useState(false);

  async function sync() {
    onStatus(null);
    try {
      const result = await syncWithGitHub();
      onStatus(
        t(result.pushed ? "githubSyncDonePushed" : "githubSyncDoneUpToDate", {
          added: result.added,
          updated: result.updated,
          removed: result.removed,
        }),
      );
    } catch (error) {
      onStatus(t(errorMessage(error)));
    }
  }

  if (!lock?.encryptionSupported) {
    return (
      <SettingsSection title={t("githubSync")}>
        <p className="text-muted-foreground px-1 text-xs">
          {t("githubNeedsEncryption")}
        </p>
      </SettingsSection>
    );
  }

  if (connection) {
    return (
      <SettingsSection title={t("githubSync")}>
        <SettingsRow
          title={`${connection.owner}/${connection.repo}`}
          description={
            <>
              {`${connection.path} · ${connection.branch}`}
              {error !== null && (
                <span className="text-destructive block">
                  {t(errorMessage(error))}
                </span>
              )}
            </>
          }
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              disabled={syncing}
              onClick={() => void sync()}
            >
              {syncing ? t("githubSyncBusy") : t("githubSyncAction")}
            </Button>
          }
        />
        <SettingsRow
          title={t("githubDisconnect")}
          description={t("githubDisconnectDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              disabled={syncing}
              onClick={() => {
                onStatus(null);
                setConnecting(false);
                void disconnectGitHub();
              }}
            >
              {t("githubDisconnectAction")}
            </Button>
          }
        />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={t("githubSync")}>
      <SettingsRow
        title={t("githubSync")}
        description={t("githubSyncDescription")}
        action={
          !connecting && (
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              onClick={() => setConnecting(true)}
            >
              {t("githubConnect")}
            </Button>
          )
        }
      />
      {connecting && (
        <ConnectForm
          onStatus={onStatus}
          onCancel={() => setConnecting(false)}
        />
      )}
    </SettingsSection>
  );
}
