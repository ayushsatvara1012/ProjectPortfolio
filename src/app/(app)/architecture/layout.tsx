import BackControl from '@/src/components/architecture/BackControl';

// Chrome-free, full-viewport immersive shell. Lives outside the (site) group so
// it inherits no navbar/footer (same precedent as /demo). Per-route metadata and
// OpenGraph are set on the pages themselves (Phase 2).
export default function ArchitectureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <BackControl />
      {children}
    </div>
  );
}
