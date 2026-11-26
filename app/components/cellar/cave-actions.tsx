"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage, readError } from "@/lib/photos/upload";
import { Icon } from "@/app/components/icons";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await readError(res, "Action impossible."));
  return res.json();
}

/** « + » de l'écran Mes caves : crée une cave (Alert.prompt iOS → prompt). */
export function AddCaveButton({ label }: { label?: string }) {
  const router = useRouter();
  async function handleAdd() {
    const name = window.prompt("Nouvelle cave\n\nNom de la cave")?.trim();
    if (!name) return;
    try {
      await send("/api/caves", "POST", { name });
      router.refresh();
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  if (label) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        className="mt-4 rounded-lg bg-primary px-8 py-3 text-base font-semibold text-white"
      >
        {label}
      </button>
    );
  }
  return (
    <button type="button" onClick={handleAdd} aria-label="Nouvelle cave" className="text-primary">
      <Icon name="add" size={28} />
    </button>
  );
}

/**
 * Menu « ⋯ » d'une cave : Renommer / Supprimer la cave (mêmes actions et
 * messages qu'iOS). `afterDelete` : page où aller une fois la cave supprimée.
 */
export function CaveMenu({
  cave,
  afterDelete,
}: {
  cave: { id: string; name: string; bottle_count: number };
  afterDelete?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function rename() {
    setOpen(false);
    const name = window.prompt("Renommer la cave", cave.name)?.trim();
    if (!name || name === cave.name) return;
    try {
      await send(`/api/caves/${cave.id}`, "PATCH", { name });
      router.refresh();
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  async function remove() {
    setOpen(false);
    if (cave.bottle_count > 0) {
      const n = cave.bottle_count;
      window.alert(
        `Cave non vide\n\nImpossible de supprimer « ${cave.name} » car elle contient ${n} bouteille${n > 1 ? "s" : ""}.`,
      );
      return;
    }
    if (!window.confirm(`Supprimer « ${cave.name} » définitivement ?`)) return;
    try {
      await send(`/api/caves/${cave.id}`, "DELETE");
      if (afterDelete) router.replace(afterDelete);
      router.refresh();
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={`Actions pour ${cave.name}`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none font-bold text-primary"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-10 right-0 z-30 w-52 overflow-hidden rounded-xl border border-border bg-surface text-left"
          style={{ boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)" }}
        >
          <button role="menuitem" type="button" onClick={rename} className="block w-full px-4 py-3 text-left text-base text-text">
            Renommer
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={remove}
            className="block w-full border-t border-border px-4 py-3 text-left text-base text-error"
          >
            Supprimer la cave
          </button>
        </div>
      )}
    </div>
  );
}
