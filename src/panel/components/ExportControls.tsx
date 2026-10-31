import { useEffect, useState } from 'react';
import { browser } from '#imports';
import { captureFileName, createCapture } from '@/core/capture';
import type { ElementSnapshot } from '@/core/element-snapshot';
import type { Recording } from '@/core/recording';
import { Button } from './Button';

interface ExportControlsProps {
  hostname: string;
  snapshot: ElementSnapshot;
  recording: Recording | null;
}

/** Copy or download everything captured, as one JSON file. Nothing is sent anywhere. */
export function ExportControls({ hostname, snapshot, recording }: ExportControlsProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const build = () =>
    createCapture({
      hostname,
      extensionVersion: browser.runtime.getManifest().version,
      snapshot,
      recording,
      exportedAt: new Date(),
    });

  const copy = () => {
    navigator.clipboard
      .writeText(JSON.stringify(build(), null, 2))
      .then(() => setStatus('copied'))
      .catch(() => setStatus('failed'));
  };

  const download = () => {
    const capture = build();
    const url = URL.createObjectURL(new Blob([JSON.stringify(capture, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = captureFileName(capture);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="flex flex-col gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <h3 className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        Export evidence
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        One JSON file with the site's hostname, element names, styles, and{' '}
        {recording ? 'the recording' : 'no recording yet'}. No page text or full address.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={copy}>
          Copy JSON
        </Button>
        <Button size="sm" variant="secondary" onClick={download}>
          Download JSON
        </Button>
        <span aria-live="polite" className="text-xs text-neutral-500 dark:text-neutral-400">
          {status === 'copied' ? 'Copied' : status === 'failed' ? "Couldn't copy. Try Download instead." : ''}
        </span>
      </div>
    </section>
  );
}
