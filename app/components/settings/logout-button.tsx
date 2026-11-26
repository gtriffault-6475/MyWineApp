"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        router.replace("/login");
        router.refresh();
      }}
      className="self-start rounded-lg border border-error px-3 py-2 text-sm font-medium text-error disabled:opacity-50"
    >
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
