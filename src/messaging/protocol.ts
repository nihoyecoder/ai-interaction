/**
 * Message contracts shared by the side panel, the inspector (inside the page),
 * and the background service worker. Every message has a `type`, so TypeScript
 * can tell them apart and catch mistakes at build time.
 */
import type { DesignSelection, PickMode } from '@/core/selection';

/** Name of the port the side panel opens to the inspector in a tab. */
export const INSPECTOR_PORT_NAME = 'ai-interaction:inspector';

/** Side panel → inspector, over the port. */
export type PanelToInspector =
  /** Asks the inspector to confirm it's ready. */
  | { type: 'hello' }
  | { type: 'picker:start'; mode: PickMode }
  | { type: 'picker:cancel' }
  /** ↑ and ↓ pressed in the side panel while picking. Keyboard focus stays there while the user picks. */
  | { type: 'picker:widen' }
  | { type: 'picker:narrow' }
  | { type: 'selection:wider' }
  | { type: 'selection:narrower' }
  /** Full page: selects the whole page. No picking needed. */
  | { type: 'selection:page' }
  | { type: 'selection:clear' };

/** Inspector → side panel, over the port. */
export type InspectorToPanel =
  | { type: 'ready' }
  /** Picking stopped without a selection: Esc on the page, or the tab was hidden. */
  | { type: 'picker:cancelled' }
  /** Something new is selected: picked on the page, made wider or narrower, or the whole page. */
  | { type: 'selection:changed'; selection: DesignSelection };

/** Background → side panel, as a runtime message. */
export type BackgroundToPanel = { type: 'toolbar-clicked'; tabId: number };
