import { useEffect } from 'react';

/**
 * Calls the handler for a key pressed in the side panel while `active` is
 * true, such as `Escape` or `ArrowUp`. Keys pressed with Alt, Ctrl, or the
 * Command key are left alone.
 */
export function useKeys(active: boolean, handlers: Readonly<Record<string, () => void>>): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const handler = handlers[event.key];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, handlers]);
}
