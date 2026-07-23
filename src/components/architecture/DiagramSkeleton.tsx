export default function DiagramSkeleton({ label = 'Loading diagram' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex h-full min-h-64 w-full animate-pulse items-center justify-center rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="sr-only">{label}</span>
      <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-700" aria-hidden>
        account_tree
      </span>
    </div>
  );
}
