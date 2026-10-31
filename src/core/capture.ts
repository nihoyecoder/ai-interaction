import type { ElementSnapshot } from './element-snapshot';
import type { Recording } from './recording';
import { describeEvidence, type EvidenceLine } from './recording-evidence';
import { summarizeRecording, type RecordingSummary } from './recording-summary';

export const CAPTURE_FORMAT = 'ai-interaction/capture';
/** Increase when the structure changes in a way older readers can't handle. */
export const CAPTURE_VERSION = 1;

type MeasuredRecording = Omit<Recording, 'animations' | 'classChanges' | 'attributeChanges' | 'styleWrites'>;

/**
 * Everything captured about one interaction, in one versioned package that
 * analysis and recipe generation can read. Facts are grouped by how we know
 * them, so nothing estimated can pass as observed.
 */
export interface Capture {
  format: typeof CAPTURE_FORMAT;
  version: typeof CAPTURE_VERSION;
  exportedAt: string;
  extensionVersion: string;
  /** The hostname only. Full addresses can contain private details such as account ids or tokens. */
  page: { hostname: string };
  /** What the three groups mean, so the file explains itself. */
  labels: { observed: string; measured: string; estimated: string };
  observed: {
    element: ElementSnapshot;
    animations: Recording['animations'];
    classChanges: Recording['classChanges'];
    attributeChanges: Recording['attributeChanges'];
    styleWrites: Recording['styleWrites'];
  };
  /** Null when nothing was recorded. */
  measured: { recording: MeasuredRecording; summary: RecordingSummary } | null;
  estimated: EvidenceLine[];
}

export function createCapture(input: {
  hostname: string;
  extensionVersion: string;
  snapshot: ElementSnapshot;
  recording: Recording | null;
  exportedAt: Date;
}): Capture {
  const { recording } = input;
  let measured: Capture['measured'] = null;
  if (recording) {
    const { animations, classChanges, attributeChanges, styleWrites, ...rest } = recording;
    measured = { recording: rest, summary: summarizeRecording(recording) };
  }

  return {
    format: CAPTURE_FORMAT,
    version: CAPTURE_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    extensionVersion: input.extensionVersion,
    page: { hostname: input.hostname },
    labels: {
      observed: 'Read directly from the browser: computed styles, Chrome’s animation list, and DOM changes.',
      measured: 'Measured by sampling the page while recording: positions, sizes, transforms, and timing.',
      estimated: 'Inferred from what was observed or measured. Treat as a likely explanation, not a fact.',
    },
    observed: {
      element: input.snapshot,
      animations: recording?.animations ?? [],
      classChanges: recording?.classChanges ?? [],
      attributeChanges: recording?.attributeChanges ?? [],
      styleWrites: recording?.styleWrites ?? [],
    },
    measured,
    estimated: recording ? describeEvidence(recording).filter((line) => line.label === 'Estimated') : [],
  };
}

/** For example "ai-interaction-dribbble.com-2026-10-31-1905.json". */
export function captureFileName(capture: Capture): string {
  const host = capture.page.hostname.toLowerCase().replace(/[^a-z0-9.-]+/g, '-') || 'page';
  const stamp = capture.exportedAt.slice(0, 16).replace('T', '-').replace(':', '');
  return `ai-interaction-${host}-${stamp}.json`;
}
