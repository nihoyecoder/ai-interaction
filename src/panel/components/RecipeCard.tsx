import { useEffect, useState } from 'react';
import { Button } from './Button';

/** The recipe to paste into an AI coding agent, with a copy button and an optional preview. */
export function RecipeCard({ recipe }: { recipe: string }) {
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const copy = () => {
    navigator.clipboard
      .writeText(recipe)
      .then(() => setStatus('copied'))
      .catch(() => setStatus('failed'));
  };

  return (
    <article className="rounded-lg border border-neutral-300 px-3 py-2.5 dark:border-neutral-700">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Recipe for your AI coding agent</h3>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        React + GSAP, with plain CSS where it’s enough. Paste it into Claude Code, Codex, or Cursor, in the project
        where you want this interaction.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={copy}>
          Copy recipe
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowPreview((shown) => !shown)} aria-expanded={showPreview}>
          {showPreview ? 'Hide preview' : 'Preview'}
        </Button>
        <span aria-live="polite" className="text-xs text-neutral-500 dark:text-neutral-400">
          {status === 'copied' ? 'Copied' : status === 'failed' ? "Couldn't copy. Select the preview text instead." : ''}
        </span>
      </div>
      {showPreview && (
        <pre className="mt-2.5 max-h-96 overflow-auto rounded-md bg-neutral-50 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {recipe}
        </pre>
      )}
    </article>
  );
}
