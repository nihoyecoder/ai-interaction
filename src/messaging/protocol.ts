/**
 * Message contracts shared by the side panel, the inspector (inside the page),
 * and the background service worker. Every message has a `type`, so TypeScript
 * can tell them apart and catch mistakes at build time.
 */
import type { ElementSummary } from '@/core/element-summary';

/** Name of the port the side panel opens to the inspector in a tab. */
export const INSPECTOR_PORT_NAME = 'ai-interaction:inspector';

/** Basic facts about the connected page. The title comes from the page: treat it as untrusted text. */
export interface PageInfo {
  title: string;
}

/** Side panel → inspector, over the port. */
export type PanelToInspector =
  | { type: 'page-info:request' }
  | { type: 'picker:start' }
  | { type: 'picker:cancel' };

/** Inspector → side panel, over the port. */
export type InspectorToPanel =
  | { type: 'page-info'; page: PageInfo }
  /** The user clicked an element. */
  | { type: 'picker:selected'; element: ElementSummary }
  /** Picking stopped without a selection: Esc on the page, or the tab was hidden. */
  | { type: 'picker:cancelled' };

/** Background → side panel, as a runtime message. */
export type BackgroundToPanel = { type: 'toolbar-clicked'; tabId: number };
