"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldLabel } from "./fields";

interface Suggestion {
  id: string;
  name: string;
  address: string | null;
}

/**
 * Nom du restaurant avec suggestions Foursquare autour de soi
 * (RestaurantAutocomplete.tsx iOS : position demandée à l'ouverture,
 * recherche dès 2 caractères, 350 ms après la dernière frappe).
 */
export function RestaurantAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const coordsRef = useRef<string | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        coordsRef.current = `${pos.coords.latitude},${pos.coords.longitude}`;
      },
      () => {
        coordsRef.current = null;
      },
      { timeout: 5000, maximumAge: 300_000 },
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function handleChange(text: string) {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (text.trim().length < 2) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: text.trim() });
        if (coordsRef.current) params.set("ll", coordsRef.current);
        const res = await fetch(`/api/restaurants?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Recherche impossible");
        setSuggestions(data.results);
        if (data.results.length === 0) setError("Aucun restaurant trouvé");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setSuggestions([]);
        setError(e instanceof TypeError ? "Pas de connexion" : (e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
  }

  return (
    <div className="mt-3">
      <FieldLabel htmlFor={id}>Nom du restaurant</FieldLabel>
      <div className="flex min-h-12 items-center rounded-lg border border-border bg-surface px-4 focus-within:border-primary">
        <input
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          placeholder="ex: Le Grand Véfour"
          autoCapitalize="words"
          autoCorrect="off"
          autoComplete="off"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={`${id}-list`}
          className="flex-1 bg-transparent py-3 text-base text-text outline-none placeholder:text-text-light"
        />
        {loading && (
          <span
            aria-label="Recherche…"
            className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-transparent"
          />
        )}
      </div>

      {error && !loading && <p className="mt-1 px-1 text-xs text-error">{error}</p>}

      {suggestions.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="mt-1 overflow-hidden rounded-lg border border-border bg-surface"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {suggestions.map((s) => (
            <li key={s.id} role="option" aria-selected={false} className="border-b border-border last:border-b-0">
              <button
                type="button"
                // pointerdown : passe avant le blur qui masque la liste
                onPointerDown={(e) => {
                  e.preventDefault();
                  onChange(s.name);
                  setSuggestions([]);
                }}
                className="block w-full px-4 py-3 text-left"
              >
                <span className="block truncate text-sm font-medium text-text">{s.name}</span>
                {s.address && (
                  <span className="mt-0.5 block truncate text-xs text-text-muted">{s.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
