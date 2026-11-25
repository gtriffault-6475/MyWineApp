"use client";

import { useId } from "react";

/** Libellé de champ en petites capitales, comme l'app iOS (ui/TextInput). */
export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-semibold tracking-wide text-text-muted uppercase"
    >
      {children}
    </label>
  );
}

const INPUT_CLASS =
  "w-full min-h-12 rounded-lg border bg-surface px-4 py-3 text-base text-text placeholder:text-text-light outline-none focus:border-primary";

export function TextField({
  label,
  value,
  onChange,
  error,
  multiline,
  className,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  multiline?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = useId();
  const errorId = `${id}-error`;
  const common = {
    id,
    value,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    className: `${INPUT_CLASS} ${error ? "border-error" : "border-border"}`,
  };

  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <textarea
          {...common}
          rows={4}
          placeholder={props.placeholder}
          autoCapitalize={props.autoCapitalize}
          onChange={(e) => onChange(e.target.value)}
          className={`${common.className} min-h-24 resize-y`}
        />
      ) : (
        <input {...props} {...common} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="-mb-1 text-xs font-semibold tracking-wide text-text-muted uppercase">
      {children}
    </h2>
  );
}
