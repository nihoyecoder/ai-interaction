// Renders the side panel's "element selected + recording" screen with a real capture, outside the extension,
// so its layout can be screenshotted and reviewed (see render.mjs). The capture is injected as window.__capture.
import { createRoot } from 'react-dom/client';
import type { Capture } from '@/core/capture';
import type { Recording } from '@/core/recording';
import { ElementDetails } from '@/panel/components/ElementDetails';
import { RecordingResults } from '@/panel/components/RecordingResults';
import { RecordingSummaryCard } from '@/panel/components/RecordingSummaryCard';
import './preview.css';

const capture = (window as unknown as { __capture: Capture }).__capture;
const measured = capture.measured;
if (!measured) throw new Error('The capture has no recording');
const recording: Recording = { ...measured.recording, ...capture.observed };
const noop = () => undefined;

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-white px-4 py-6 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
    <div className="flex flex-col gap-4">
      <RecordingResults hostname={capture.page.hostname} snapshot={capture.observed.element} recording={recording} />
      <RecordingSummaryCard recording={recording} />
      <ElementDetails snapshot={capture.observed.element} onSelectParent={noop} onSelectChild={noop} />
    </div>
  </div>,
);
