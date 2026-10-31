import { createTopLayer, layerElement } from './layer';

const STYLES = `
  .pill {
    position: absolute;
    right: 16px;
    bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgb(17 24 39 / 0.92);
    color: rgb(255 255 255);
    font: 500 12px/16px system-ui, sans-serif;
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgb(239 68 68);
  }
  .time {
    color: rgb(209 213 219);
    font-variant-numeric: tabular-nums;
  }
`;

export interface RecordingIndicator {
  update(elapsedMs: number): void;
  destroy(): void;
}

/** The "● Recording" pill in the page's bottom-right corner, shown while recording. */
export function showRecordingIndicator(): RecordingIndicator {
  const layer = createTopLayer(STYLES);
  const pill = layerElement('div', 'pill');
  const label = layerElement('span', 'label');
  const time = layerElement('span', 'time');
  label.textContent = 'Recording';
  time.textContent = '0s';
  pill.append(layerElement('span', 'dot'), label, time);
  layer.root.append(pill);

  let shownSeconds = 0;
  return {
    update(elapsedMs) {
      const seconds = Math.floor(elapsedMs / 1000);
      if (seconds === shownSeconds) return;
      shownSeconds = seconds;
      time.textContent = `${seconds}s`;
    },
    destroy: layer.destroy,
  };
}
