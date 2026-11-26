/** Apparence choisie dans les Paramètres (ThemeContext iOS) : Auto suit le téléphone. */
export type Appearance = "auto" | "light" | "dark";

export const THEME_COOKIE = "myvine_theme";

export const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

export function parseAppearance(value: string | undefined): Appearance {
  return value === "light" || value === "dark" ? value : "auto";
}
