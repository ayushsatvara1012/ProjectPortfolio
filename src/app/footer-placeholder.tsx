import Link from 'next/link';

// Placeholder for the real Footer (ports in Step 4c).
export default function FooterPlaceholder() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 mt-20">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <p>© {new Date().getFullYear()} Sapybase. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/privacy-policy" className="hover:text-indigo-600">Privacy</Link>
          <Link href="/terms-and-conditions" className="hover:text-indigo-600">Terms</Link>
          <Link href="/contact" className="hover:text-indigo-600">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
