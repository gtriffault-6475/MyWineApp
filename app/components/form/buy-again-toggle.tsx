"use client";

/** Interrupteur « À racheter » (BuyAgainToggle.tsx iOS). */
export function BuyAgainToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-base font-medium text-text">À racheter</span>
        <span className="mt-0.5 block text-xs text-text-muted">
          Envie d&apos;en racheter une bouteille ?
        </span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-[31px] w-[51px] rounded-full bg-border transition-colors peer-checked:bg-success peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
        <span className="pointer-events-none absolute top-0.5 left-0.5 h-[27px] w-[27px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
