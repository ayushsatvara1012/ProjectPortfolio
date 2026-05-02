// Auth route group — no navbar/footer, centered on a blueprint-grid background.
// Applies to /sign-in/* and /sign-up/*.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 overflow-hidden">
      {/* Blueprint grid — matches Sapybase minimal aesthetic */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(226 232 240 / 1) 1px, transparent 1px), linear-gradient(to bottom, rgb(226 232 240 / 1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md px-6 py-12 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
