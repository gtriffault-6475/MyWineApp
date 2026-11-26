"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  validateCellarForm,
  type CellarFormErrors,
  type CellarFormValues,
} from "@/lib/cellar/entry";
import { photoUrl } from "@/lib/wines/wine";
import { errorMessage, readError, uploadLabelPhoto } from "@/lib/photos/upload";
import { FieldLabel, SectionTitle, TextField } from "@/app/components/form/fields";
import { LabelPhotoInput } from "@/app/components/form/label-photo-input";

type Props = {
  caves: { id: string; name: string }[];
  initial: CellarFormValues;
  /** Bouteille modifiée ; absent pour un ajout. */
  entryId?: string;
  /** Où revenir après enregistrement ou annulation (écran précédent, comme iOS). */
  doneHref: string;
};

/** Ajout / modification d'une bouteille (AddCellarEntryScreen + CellarForm iOS). */
export function CellarForm({ caves, initial, entryId, doneHref }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<CellarFormErrors>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function update<K extends keyof CellarFormValues>(key: K, value: CellarFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  const digits = (max: number) => (v: string) => v.replace(/\D/g, "").slice(0, max);

  async function handlePick(file: File) {
    setUploading(true);
    try {
      update("photo_path", await uploadLabelPhoto(file, setPreview));
    } catch (error) {
      setPreview(null);
      window.alert(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateCellarForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(entryId ? `/api/cellar/${entryId}` : "/api/cellar", {
        method: entryId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await readError(res, "Impossible d'enregistrer la bouteille."));
      router.replace(doneHref);
      router.refresh();
    } catch (error) {
      window.alert(errorMessage(error));
      setSubmitting(false);
    }
  }

  const busy = submitting || uploading;

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-12">
      <LabelPhotoInput
          height={180}
          src={preview ?? photoUrl(form.photo_path, 800)}
          busyLabel={uploading ? "Envoi…" : null}
          onPick={handlePick}
          onRemove={
            entryId
              ? () => {
                  setPreview(null);
                  update("photo_path", null);
                }
              : null
          }
        />

      {caves.length > 1 && (
        <div>
          <FieldLabel>Cave</FieldLabel>
          <div role="radiogroup" aria-label="Cave" className="mt-1 flex flex-wrap gap-2">
            {caves.map((cave) => {
              const active = form.cave_id === cave.id;
              return (
                <button
                  key={cave.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update("cave_id", cave.id)}
                  className={`rounded-3xl border px-4 py-2 text-sm font-medium ${
                    active ? "border-primary bg-primary text-white" : "border-border bg-surface text-text"
                  }`}
                >
                  {cave.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <TextField
          label="Nom de la bouteille *"
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
            onChange={(v) => update("vintage", v.slice(0, 4))}
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
        <SectionTitle>Stock</SectionTitle>
        <div className="flex items-start gap-3">
          <TextField
            label="Quantité *"
            value={form.quantity}
            onChange={(v) => update("quantity", digits(4)(v))}
            inputMode="numeric"
            error={errors.quantity}
            className="w-[110px] shrink-0"
          />
          <TextField
            label="Emplacement"
            value={form.storage_location}
            onChange={(v) => update("storage_location", v)}
            placeholder="ex: Casier 3, rangée A"
            className="min-w-0 flex-1"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Apogée</SectionTitle>
        <div className="flex items-start gap-3">
          <TextField
            label="De"
            value={form.optimal_from}
            onChange={(v) => update("optimal_from", digits(4)(v))}
            placeholder="ex: 2026"
            inputMode="numeric"
            className="w-[120px]"
          />
          <TextField
            label="À"
            value={form.optimal_to}
            onChange={(v) => update("optimal_to", digits(4)(v))}
            placeholder="ex: 2035"
            inputMode="numeric"
            error={errors.optimal_to}
            className="w-[120px]"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Achat</SectionTitle>
        <div className="flex items-start gap-3">
          <TextField
            label="Date d'achat"
            type="date"
            value={form.purchase_date}
            onChange={(v) => update("purchase_date", v)}
            className="min-w-0 flex-1"
          />
          <TextField
            label="Prix (€)"
            value={form.purchase_price}
            onChange={(v) => update("purchase_price", v.replace(/[^\d.,]/g, ""))}
            placeholder="ex: 24.90"
            inputMode="decimal"
            error={errors.purchase_price}
            className="w-[110px] shrink-0"
          />
        </div>
      </section>

      <TextField
        label="Notes"
        value={form.notes}
        onChange={(v) => update("notes", v)}
        placeholder="Caractéristiques, conseils de service…"
        autoCapitalize="sentences"
        multiline
      />

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-12 rounded-lg bg-primary text-base font-semibold text-white disabled:opacity-60"
        >
          {uploading
            ? "Envoi de la photo…"
            : submitting
              ? "Enregistrement…"
              : entryId
                ? "Enregistrer les modifications"
                : "Ajouter à la cave"}
        </button>
        <button
          type="button"
          onClick={() => router.push(doneHref)}
          className="h-12 rounded-lg text-base font-semibold text-primary"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
