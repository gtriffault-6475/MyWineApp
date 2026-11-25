"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  emptyWineForm,
  localToday,
  validateWineForm,
  type WineFormErrors,
  type WineFormValues,
} from "@/lib/wines/input";
import { photoUrl } from "@/lib/wines/wine";
import { compressPhoto } from "@/lib/photos/compress";
import { StarRating } from "@/app/components/star-rating";
import { SectionTitle, TextField } from "./fields";
import { ScorePicker } from "./score-picker";
import { LocationPicker } from "./location-picker";
import { RestaurantAutocomplete } from "./restaurant-autocomplete";
import { BuyAgainToggle } from "./buy-again-toggle";
import { LabelPhotoInput } from "./label-photo-input";

type Props =
  | { mode: "create"; initial?: Partial<WineFormValues>; cancelHref: string }
  | { mode: "edit"; wineId: string; initial: WineFormValues; cancelHref: string };

const NETWORK_ERROR = "Pas de connexion. Vérifiez le réseau et réessayez.";

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? fallback;
}

/** Formulaire d'ajout / de modification d'une dégustation (WineForm.tsx iOS). */
export function WineForm(props: Props) {
  const router = useRouter();
  // Ajout : rendu uniquement côté téléphone (voir nouvelle/new-wine-form.tsx),
  // donc la date du jour est celle du fuseau de l'utilisateur.
  const [form, setForm] = useState<WineFormValues>(() => ({
    ...emptyWineForm(localToday()),
    ...props.initial,
  }));
  const [errors, setErrors] = useState<WineFormErrors>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<"upload" | "analyze" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function update<K extends keyof WineFormValues>(key: K, value: WineFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function analyze(photoPath: string) {
    const ok = window.confirm(
      "Voulez-vous que l'IA remplisse automatiquement les informations du vin ?",
    );
    if (!ok) return;
    setPhotoBusy("analyze");
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_path: photoPath }),
      });
      if (!res.ok) throw new Error(await readError(res, "Analyse impossible."));
      const result = (await res.json()) as Record<"name" | "producer" | "appellation" | "vintage", string | null>;
      setForm((f) => ({
        ...f,
        name: result.name ?? f.name,
        producer: result.producer ?? f.producer,
        appellation: result.appellation ?? f.appellation,
        vintage: result.vintage ?? f.vintage,
      }));
      if (result.name) setErrors((e) => ({ ...e, name: undefined }));
    } catch (error) {
      window.alert(error instanceof TypeError ? NETWORK_ERROR : (error as Error).message);
    } finally {
      setPhotoBusy(null);
    }
  }

  async function handlePick(file: File) {
    setPhotoBusy("upload");
    let localUrl: string | null = null;
    try {
      const blob = await compressPhoto(file);
      localUrl = URL.createObjectURL(blob);
      setPreview(localUrl);
      const body = new FormData();
      body.set("photo", blob, "etiquette.jpg");
      const res = await fetch("/api/photos", { method: "POST", body });
      if (!res.ok) throw new Error(await readError(res, "Envoi de la photo impossible."));
      const { photo_path } = (await res.json()) as { photo_path: string };
      update("photo_path", photo_path);
      setPhotoBusy(null);
      await analyze(photo_path);
    } catch (error) {
      setPreview(null);
      window.alert(error instanceof TypeError ? NETWORK_ERROR : (error as Error).message);
      setPhotoBusy(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateWineForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(props.mode === "create" ? "/api/wines" : `/api/wines/${props.wineId}`, {
        method: props.mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        throw new Error(
          await readError(
            res,
            props.mode === "create"
              ? "Impossible d'enregistrer le vin."
              : "Impossible de mettre à jour le vin.",
          ),
        );
      }
      // Comme iOS : retour à l'écran précédent (liste après un ajout, fiche après une modification).
      router.replace(props.cancelHref);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof TypeError ? NETWORK_ERROR : (error as Error).message);
      setSubmitting(false);
    }
  }

  const photoSrc = preview ?? photoUrl(form.photo_path, 800);
  const busy = submitting || photoBusy !== null;
  const submitLabel =
    photoBusy === "analyze"
      ? "Analyse en cours…"
      : photoBusy === "upload"
        ? "Envoi de la photo…"
        : submitting
          ? "Enregistrement…"
          : props.mode === "create"
            ? "Ajouter ce vin"
            : "Enregistrer les modifications";

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-12">
      <LabelPhotoInput
        src={photoSrc}
        busyLabel={photoBusy === "upload" ? "Envoi…" : photoBusy === "analyze" ? "Analyse de l'étiquette…" : null}
        onPick={handlePick}
        onRemove={
          props.mode === "edit"
            ? () => {
                setPreview(null);
                update("photo_path", null);
              }
            : null
        }
      />

      <section className="flex flex-col gap-4">
        <TextField
          label="Nom du vin *"
          value={form.name}
          onChange={(v) => update("name", v)}
          placeholder="ex: Château Margaux"
          error={errors.name}
          autoCapitalize="words"
        />
        <div className="flex items-start gap-3">
          <TextField
            label="Producteur"
            value={form.producer}
            onChange={(v) => update("producer", v)}
            placeholder="ex: Domaine Leflaive"
            className="min-w-0 flex-1"
          />
          <TextField
            label="Millésime"
            value={form.vintage}
            onChange={(v) => update("vintage", v.replace(/\D/g, "").slice(0, 4))}
            placeholder="ex: 2019"
            inputMode="numeric"
            error={errors.vintage}
            className="w-[110px] shrink-0"
          />
        </div>
        <TextField
          label="Appellation"
          value={form.appellation}
          onChange={(v) => update("appellation", v)}
          placeholder="ex: Pomerol, Chablis Premier Cru…"
          autoCapitalize="words"
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Note</SectionTitle>
        <ScorePicker score={form.score} onChange={(s) => update("score", s)} />
        {form.score !== null && <StarRating score={form.score} size={20} />}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Où ?</SectionTitle>
        <LocationPicker value={form.location_type} onChange={(v) => update("location_type", v)} />
        {form.location_type === "restaurant" && (
          <RestaurantAutocomplete
            value={form.restaurant_name}
            onChange={(v) => update("restaurant_name", v)}
          />
        )}
      </section>

      <TextField
        label="Avec qui"
        value={form.companion}
        onChange={(v) => update("companion", v)}
        placeholder="ex: Marie, famille, collègues…"
        autoCapitalize="words"
      />

      <TextField
        label="Date"
        type="date"
        value={form.drunk_at}
        onChange={(v) => update("drunk_at", v)}
        max={localToday()}
        error={errors.drunk_at}
      />

      <TextField
        label="Accord mets-vins"
        value={form.food_pairing}
        onChange={(v) => update("food_pairing", v)}
        placeholder="ex: Magret de canard, fromages…"
        autoCapitalize="sentences"
      />

      <TextField
        label="Commentaire"
        value={form.comment}
        onChange={(v) => update("comment", v)}
        placeholder="Notes de dégustation, impressions…"
        autoCapitalize="sentences"
        multiline
      />

      <BuyAgainToggle value={form.buy_again} onChange={(v) => update("buy_again", v)} />

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-12 rounded-lg bg-primary text-base font-semibold text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {props.mode === "create" && (
          <button
            type="button"
            onClick={() => router.push(props.cancelHref)}
            className="h-12 rounded-lg text-base font-semibold text-primary"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
