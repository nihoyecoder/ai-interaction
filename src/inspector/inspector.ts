import { browser, type Browser } from '#imports';
import type { PickMode } from '@/core/selection';
import { INSPECTOR_PORT_NAME, type InspectorToPanel, type PanelToInspector } from '@/messaging/protocol';
import { flashElement } from './flash';
import { startPicker, type Picker } from './picker';
import { readElementSelection, readPageSelection } from './selection';
import { narrowerThan, trailBackTo, widerThan } from './targets';

/** Stop waiting if the side panel hasn't connected by then (for example, it was closed). */
const CONNECT_TIMEOUT_MS = 10_000;
/** Marks that an injected copy is already waiting for the panel to connect. */
const WAITING_FLAG = '__aiInteractionInspectorWaiting';

/**
 * Runs inside the web page, in the extension's isolated world, which shares
 * the page's DOM but not its JavaScript. Waits for the side panel to connect,
 * then serves it until the connection closes. Each connection is its own
 * session, and everything a session adds is removed when it ends.
 */
export function startInspector(): void {
  // This globalThis belongs to the isolated world; the page can't see it.
  const world = globalThis as typeof globalThis & { [WAITING_FLAG]?: boolean };
  if (world[WAITING_FLAG]) return;
  world[WAITING_FLAG] = true;

  const onConnect = (port: Browser.runtime.Port) => {
    if (port.name !== INSPECTOR_PORT_NAME) return;
    stopWaiting();
    runSession(port);
  };
  const timeout = setTimeout(stopWaiting, CONNECT_TIMEOUT_MS);
  browser.runtime.onConnect.addListener(onConnect);

  function stopWaiting() {
    clearTimeout(timeout);
    browser.runtime.onConnect.removeListener(onConnect);
    delete world[WAITING_FLAG];
  }
}

function runSession(port: Browser.runtime.Port): void {
  log('Connected to the side panel.');
  let picker: Picker | null = null;
  let stopFlash: (() => void) | null = null;
  let selected: { element: Element; scope: PickMode } | null = null;
  // Elements left behind by "Wider", so "Narrower" can go back down the same way.
  let trail: Element[] = [];

  const narrowerOf = (element: Element) => trailBackTo(element, trail) ?? narrowerThan(element);

  const select = (element: Element, scope: PickMode, highlight: boolean) => {
    selected = { element, scope };
    // Read before highlighting, so nothing we add is part of what's read.
    const steps = { canWiden: widerThan(element) !== null, canNarrow: narrowerOf(element) !== null };
    send(port, { type: 'selection:changed', selection: readElementSelection(element, scope, steps) });
    if (highlight) {
      stopFlash?.();
      stopFlash = flashElement(element);
    }
  };

  const stopPicking = () => {
    picker?.stop();
    picker = null;
  };

  const clearFlash = () => {
    stopFlash?.();
    stopFlash = null;
  };

  const onMessage = (message: PanelToInspector) => {
    switch (message.type) {
      case 'hello':
        send(port, { type: 'ready' });
        break;
      case 'picker:start': {
        const { mode } = message;
        clearFlash();
        stopPicking();
        picker = startPicker({
          mode,
          onSelect: (element) => {
            picker = null;
            trail = [];
            select(element, mode, false);
          },
          onCancel: () => {
            picker = null;
            send(port, { type: 'picker:cancelled' });
          },
        });
        break;
      }
      case 'picker:cancel':
        stopPicking();
        break;
      case 'picker:widen':
        picker?.widen();
        break;
      case 'picker:narrow':
        picker?.narrow();
        break;
      case 'selection:wider': {
        const wider = selected && widerThan(selected.element);
        if (!selected || !wider) break;
        trail.push(selected.element);
        select(wider, selected.scope, true);
        break;
      }
      case 'selection:narrower': {
        const narrower = selected && narrowerOf(selected.element);
        if (!selected || !narrower) break;
        if (trail.at(-1) === narrower) trail.pop();
        else trail = [];
        select(narrower, selected.scope, true);
        break;
      }
      case 'selection:page':
        stopPicking();
        clearFlash();
        selected = null;
        trail = [];
        send(port, { type: 'selection:changed', selection: readPageSelection() });
        break;
      case 'selection:clear':
        clearFlash();
        selected = null;
        trail = [];
        break;
    }
  };

  port.onMessage.addListener(onMessage);
  // Fires when the panel disconnects or closes. Session cleanup goes here.
  port.onDisconnect.addListener(() => {
    stopPicking();
    clearFlash();
    selected = null;
    trail = [];
    port.onMessage.removeListener(onMessage);
    log('Disconnected and cleaned up.');
  });
}

function send(port: Browser.runtime.Port, message: InspectorToPanel): void {
  port.postMessage(message);
}

/** Logs to the page's DevTools console in development builds only. */
function log(message: string): void {
  if (import.meta.env.DEV) console.info(`[AI Interaction] ${message}`);
}
