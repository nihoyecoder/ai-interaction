import { describe, expect, it } from 'vitest';
import { createElementSnapshot, INITIAL_STYLE_VALUES, type StyleValues } from './element-snapshot';
import { describeStyles } from './style-groups';

function snapshotWith(styles: Partial<StyleValues>) {
  return createElementSnapshot({
    tag: 'div',
    id: '',
    classes: ['card'],
    namespace: 'html',
    rect: { left: 0, top: 0, width: 320, height: 480 },
    scroll: { x: 0, y: 0 },
    layoutSize: { width: 320, height: 480 },
    path: [],
    styles: { ...INITIAL_STYLE_VALUES, display: 'block', 'transform-origin': '160px 240px', ...styles },
    type: null,
    open: false,
    hovered: false,
    canSelectParent: true,
    canSelectChild: false,
  });
}

/** What Chrome reports for an unstyled div. */
const divDefaults: Partial<StyleValues> = { display: 'block' };

describe('describeStyles', () => {
  it('shows nothing when every style is the browser default', () => {
    expect(describeStyles(snapshotWith({}), divDefaults)).toEqual([]);
  });

  it('compares against the defaults for this kind of element', () => {
    expect(describeStyles(snapshotWith({ display: 'flex', position: 'relative' }), divDefaults)).toEqual([
      {
        title: 'Layout',
        rows: [
          { label: 'Display', value: 'flex' },
          { label: 'Position', value: 'relative' },
        ],
      },
    ]);
  });

  it('decodes transforms and keeps the raw matrix as a note', () => {
    const [group] = describeStyles(snapshotWith({ transform: 'matrix(1, 0, 0, 1, 0, -40)' }), divDefaults);
    expect(group).toEqual({
      title: 'Transform',
      rows: [{ label: 'Transform', value: 'translate 0px, -40px', note: 'Decoded from matrix(1, 0, 0, 1, 0, -40)' }],
    });
  });

  it('shows a transform origin only when it is not the center', () => {
    const [group] = describeStyles(snapshotWith({ 'transform-origin': '0px 0px' }), divDefaults);
    expect(group?.rows).toEqual([{ label: 'Origin', value: 'top left' }]);
  });

  it('combines overflow and corner radius values', () => {
    const groups = describeStyles(
      snapshotWith({
        'overflow-x': 'hidden',
        'overflow-y': 'hidden',
        'border-top-left-radius': '16px',
        'border-top-right-radius': '16px',
        'border-bottom-right-radius': '16px',
        'border-bottom-left-radius': '16px',
      }),
      divDefaults,
    );
    expect(groups).toEqual([
      { title: 'Layout', rows: [{ label: 'Overflow', value: 'hidden' }] },
      { title: 'Appearance', rows: [{ label: 'Corner radius', value: '16px' }] },
    ]);
  });

  it('lists transitions and animations under Motion', () => {
    const groups = describeStyles(
      snapshotWith({
        'transition-property': 'opacity',
        'transition-duration': '0.3s',
        'animation-name': 'pulse',
        'animation-duration': '2s',
      }),
      divDefaults,
    );
    expect(groups).toEqual([
      {
        title: 'Motion',
        rows: [
          { label: 'Transition', value: 'opacity · 300 ms · ease' },
          { label: 'Animation', value: 'pulse · 2 s · ease' },
        ],
      },
    ]);
  });

  it('falls back to CSS initial values when defaults are unknown', () => {
    expect(describeStyles(snapshotWith({}), {})).toEqual([
      { title: 'Layout', rows: [{ label: 'Display', value: 'block' }] },
    ]);
  });
});
