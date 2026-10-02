import { Trash } from "@phosphor-icons/react";
import { startTransition, useId, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";

import { AppBar } from "@maat-apps/ui/app-bar";
import { Button } from "@maat-apps/ui/button";
import { ConfirmDrawer } from "@maat-apps/ui/confirm-drawer";
import { Input } from "@maat-apps/ui/input";
import { MissingAlbum } from "../../components/missing-album";
import { useAlbum, useAlbumsReady } from "../../hooks/use-albums";
import { useSmartBack } from "../../hooks/use-smart-back";
import { useTranslation } from "../../i18n/use-translation";
import {
  albumToForm,
  EMPTY_ALBUM_FORM,
  formToAlbum,
  validateAlbumForm,
  type AlbumFormError,
  type AlbumFormErrors,
  type AlbumFormField,
  type AlbumFormValues,
} from "../../lib/album-form";
import type { Album } from "../../lib/schemas";
import { deleteAlbum, saveAlbum } from "../../lib/storage";

import { StatusPicker } from "./status-picker";

function TextField({
  field,
  label,
  values,
  errors,
  inputMode,
  onChange,
}: {
  field: Exclude<AlbumFormField, "status">;
  label: string;
  values: AlbumFormValues;
  errors: AlbumFormErrors;
  inputMode?: "numeric" | "url";
  onChange: (field: AlbumFormField, value: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const error = errors[field];
  const message: Record<AlbumFormError, string> = {
    required: t("errorRequired"),
    year: t("errorYear"),
    url: t("errorUrl"),
  };
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        value={values[field]}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="text-destructive m-0 text-xs">
          {message[error]}
        </p>
      )}
    </div>
  );
}

function AlbumForm({ album }: { album: Album | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const back = useSmartBack(album ? `/${encodeURIComponent(album.id)}` : "/");
  const [values, setValues] = useState<AlbumFormValues>(
    album ? albumToForm(album) : EMPTY_ALBUM_FORM,
  );
  const [errors, setErrors] = useState<AlbumFormErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  function change(field: AlbumFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateAlbumForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = formToAlbum(values, album);
    saveAlbum(saved);
    // Replace the form's history entry: saving is a forward step, and Back
    // from the album shouldn't land on the form again.
    navigate(`/${encodeURIComponent(saved.id)}`, { replace: true });
  }

  function remove() {
    if (!album) return;
    deleteAlbum(album.id);
    navigate("/", { replace: true });
  }

  const fieldProps = { values, errors, onChange: change };

  return (
    <form
      noValidate
      onSubmit={submit}
      className="mx-auto grid min-h-dvh w-[min(100%,480px)] content-start gap-4 px-5 pt-27 pb-[calc(32px+env(safe-area-inset-bottom))]"
    >
      <AppBar
        title={album ? t("editAlbum") : t("addAlbum")}
        backLabel={t("back")}
        onBack={() => startTransition(back)}
        action={
          album ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={t("deleteAlbum")}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash className="size-6" />
            </Button>
          ) : undefined
        }
      />
      <TextField field="artist" label={t("artist")} {...fieldProps} />
      <TextField field="title" label={t("albumTitle")} {...fieldProps} />
      <TextField
        field="year"
        label={t("year")}
        inputMode="numeric"
        {...fieldProps}
      />
      <StatusPicker
        value={values.status}
        onChange={(status) => setValues((current) => ({ ...current, status }))}
      />
      <TextField
        field="coverUrl"
        label={t("coverUrl")}
        inputMode="url"
        {...fieldProps}
      />
      <TextField
        field="spotifyUrl"
        label={t("spotifyUrl")}
        inputMode="url"
        {...fieldProps}
      />
      <Button type="submit" size="lg" className="mt-2">
        {t("save")}
      </Button>
      {album && (
        <ConfirmDrawer
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("deleteAlbumTitle")}
          description={t("deleteAlbumDescription")}
          cancelLabel={t("cancel")}
          confirmLabel={t("delete")}
          onConfirm={remove}
        />
      )}
    </form>
  );
}

/** "/new": add an album. */
export function NewAlbumView() {
  return <AlbumForm album={null} />;
}

/** "/:id/edit": edit an album. */
export function EditAlbumView() {
  const { id = "" } = useParams();
  const ready = useAlbumsReady();
  const album = useAlbum(id);
  if (!album) return ready ? <MissingAlbum /> : null;
  return <AlbumForm key={album.id} album={album} />;
}
