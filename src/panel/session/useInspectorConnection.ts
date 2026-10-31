import { useCallback, useEffect, useRef, useState } from 'react';
import { browser, type Browser } from '#imports';
import type { ElementSnapshot } from '@/core/element-snapshot';
import {
  INSPECTOR_PORT_NAME,
  type InspectorToPanel,
  type PageInfo,
  type PanelToInspector,
} from '@/messaging/protocol';
import { describeConnectionError } from './connection-errors';

type Connected = {
  status: 'connected';
  tabId: number;
  hostname: string;
  page: PageInfo;
  /** The user is choosing an element on the page. */
  picking: boolean;
  selected: ElementSnapshot | null;
};

export type Connection =
  | { status: 'idle' }
  | { status: 'connecting'; tabId: number; hostname: string }
  | Connected
  /** The page reloaded, navigated away, or closed, which ended the session. */
  | { status: 'closed'; tabId: number }
  | { status: 'failed'; tabId: number; message: string; detail: string };

/**
 * Owns the connection between the side panel and the inspector in one tab.
 * Connecting injects the inspector, then opens a port to it. Closing the port
 * from either side ends the session, and the inspector cleans up after itself.
 */
export function useInspectorConnection() {
  const [connection, setConnection] = useState<Connection>({ status: 'idle' });
  const portRef = useRef<Browser.runtime.Port | null>(null);
  // Increases on every connect or disconnect, so a slow, outdated connect attempt can tell it was cancelled.
  const attemptRef = useRef(0);

  const connect = useCallback(async (tabId: number, hostname: string) => {
    const attempt = ++attemptRef.current;
    portRef.current?.disconnect();
    portRef.current = null;
    setConnection({ status: 'connecting', tabId, hostname });

    try {
      await browser.scripting.executeScript({ target: { tabId }, files: ['/inspector.js'] });
    } catch (error) {
      if (attempt === attemptRef.current) setConnection({ status: 'failed', tabId, ...describeConnectionError(error) });
      return;
    }
    if (attempt !== attemptRef.current) return;

    const port = browser.tabs.connect(tabId, { name: INSPECTOR_PORT_NAME });
    portRef.current = port;

    port.onMessage.addListener((message: InspectorToPanel) => {
      if (portRef.current !== port) return;
      switch (message.type) {
        case 'page-info':
          setConnection({ status: 'connected', tabId, hostname, page: message.page, picking: false, selected: null });
          break;
        case 'selection:changed':
          setConnection(whileConnected((current) => ({ ...current, picking: false, selected: message.snapshot })));
          break;
        case 'picker:cancelled':
          setConnection(whileConnected((current) => ({ ...current, picking: false })));
          break;
      }
    });
    port.onDisconnect.addListener(() => {
      if (portRef.current !== port) return;
      portRef.current = null;
      const error = browser.runtime.lastError;
      setConnection((current) =>
        current.status === 'connecting'
          ? { status: 'failed', tabId, ...describeConnectionError(error) }
          : { status: 'closed', tabId },
      );
    });

    send(port, { type: 'page-info:request' });
  }, []);

  const startPicking = useCallback(() => {
    if (!portRef.current) return;
    send(portRef.current, { type: 'picker:start' });
    setConnection(whileConnected((current) => ({ ...current, picking: true })));
  }, []);

  const cancelPicking = useCallback(() => {
    if (!portRef.current) return;
    send(portRef.current, { type: 'picker:cancel' });
    setConnection(whileConnected((current) => ({ ...current, picking: false })));
  }, []);

  const selectParent = useCallback(() => {
    if (portRef.current) send(portRef.current, { type: 'selection:parent' });
  }, []);

  const selectChild = useCallback(() => {
    if (portRef.current) send(portRef.current, { type: 'selection:child' });
  }, []);

  const clearSelection = useCallback(() => {
    if (!portRef.current) return;
    send(portRef.current, { type: 'selection:clear' });
    setConnection(whileConnected((current) => ({ ...current, selected: null })));
  }, []);

  const disconnect = useCallback(() => {
    attemptRef.current += 1;
    portRef.current?.disconnect();
    portRef.current = null;
    setConnection({ status: 'idle' });
  }, []);

  // Closing the panel ends the session. Chrome does this anyway; this makes it explicit.
  useEffect(() => () => portRef.current?.disconnect(), []);

  return {
    connection,
    connect,
    startPicking,
    cancelPicking,
    selectParent,
    selectChild,
    clearSelection,
    disconnect,
  };
}

/** Applies a change only while connected, e.g. a picker message that arrives as the session ends. */
function whileConnected(change: (current: Connected) => Connected) {
  return (current: Connection): Connection => (current.status === 'connected' ? change(current) : current);
}

function send(port: Browser.runtime.Port, message: PanelToInspector): void {
  port.postMessage(message);
}
