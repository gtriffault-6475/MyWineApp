"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push("/");
        router.refresh();
        return;
      }

      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Une erreur est survenue.");
    } catch {
      setError("Connexion impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-sm"
      >
        <h1 className="mb-6 font-serif text-3xl italic text-primary">MyVine</h1>
        <label htmlFor="password" className="mb-2 block text-sm text-text">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
        />
        {error && (
          <p role="alert" className="mb-4 text-sm text-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-3 py-2 text-white disabled:opacity-60"
        >
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
