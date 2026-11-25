/** État vide centré (repris de EmptyState.tsx iOS). */
export function EmptyState({
  icon = "🍷",
  title,
  message,
  children,
}: {
  icon?: string;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="mb-2 text-[56px]" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-[22px] font-bold text-text">{title}</h2>
      <p className="text-base leading-6 text-text-muted">{message}</p>
      {children}
    </div>
  );
}
