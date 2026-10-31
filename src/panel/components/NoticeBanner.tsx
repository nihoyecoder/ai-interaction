import type { Notice } from '../panel-view';

export function NoticeBanner({ notice }: { notice: Notice }) {
  const { message, detail } =
    notice.kind === 'connection-closed'
      ? { message: 'The connection closed because the page reloaded or changed.', detail: '' }
      : notice;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p>{message}</p>
      {detail && <p className="mt-1 text-xs break-words text-amber-800 dark:text-amber-300">{detail}</p>}
    </div>
  );
}
