// Bundled into the test page by scripts/golden/record-captures.mjs. It runs the extension's real
// snapshot and recorder code on the page, without the side panel, so captures can be recorded
// automatically in Chrome.
import { createCapture, type Capture } from '@/core/capture';
import type { ElementSnapshot } from '@/core/element-snapshot';
import type { Recording } from '@/core/recording';
import { firstVisualChildOf } from '@/inspector/dom';
import { startRecording, type ActiveRecording } from '@/inspector/recorder';
import { readSnapshot } from '@/inspector/snapshot';

let snapshot: ElementSnapshot | null = null;
let active: ActiveRecording | null = null;
let finished: Recording | null = null;

const harness = {
  /** Reads the snapshot (like selecting the element), then starts recording. */
  start(selector: string): void {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`No element matches ${selector}`);
    snapshot = readSnapshot(element, firstVisualChildOf(element) !== null);
    finished = null;
    active = startRecording(element, (recording) => {
      finished = recording;
    });
  },
  /** Stops recording and returns the capture, exactly as the panel would export it. */
  stop(): Capture {
    active?.stop();
    active = null;
    if (!snapshot || !finished) throw new Error('Nothing was recorded');
    return createCapture({
      hostname: location.hostname,
      extensionVersion: 'golden-harness',
      snapshot,
      recording: finished,
      exportedAt: new Date(),
    });
  },
};

(window as unknown as { __aiInteractionHarness: typeof harness }).__aiInteractionHarness = harness;
