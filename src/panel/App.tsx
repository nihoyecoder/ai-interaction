import { browser } from '#imports';

const version = browser.runtime.getManifest().version;

export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="size-5 rounded-md bg-neutral-900 dark:bg-neutral-100" />
          <h1 className="text-sm font-semibold tracking-tight">AI Interaction</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
          Ready
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-base font-medium">See an interaction you love.</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Capture it. Recreate it with AI.</p>
      </main>

      <footer className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">v{version}</footer>
    </div>
  );
}
