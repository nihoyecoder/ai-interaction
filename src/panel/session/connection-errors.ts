export interface ConnectionError {
  /** What happened, in plain language. */
  message: string;
  /** Chrome's original wording, kept for debugging. */
  detail: string;
}

/** Turns Chrome's technical errors into messages a person can act on. */
export function describeConnectionError(error: unknown): ConnectionError {
  const detail = errorText(error);

  if (/extensions gallery cannot be scripted/i.test(detail)) {
    return { message: "Chrome doesn't allow extensions on the Chrome Web Store.", detail };
  }
  if (/error page/i.test(detail)) {
    return { message: "This page didn't load properly. Reload it, then try again.", detail };
  }
  if (/cannot access|permission/i.test(detail)) {
    return {
      message: "AI Interaction doesn't have access to this page. Click its icon in Chrome's toolbar, then try again.",
      detail,
    };
  }
  return { message: "Couldn't connect to this page. Reload it, then try again.", detail };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '';
}
