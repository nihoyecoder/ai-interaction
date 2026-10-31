import { formatTime, parseTimeMs, splitCssList } from './css-values';
import type { StyleValues } from './element-snapshot';

export interface CssTransition {
  property: string;
  duration: string;
  easing: string;
  delay: string;
}

export interface CssAnimation {
  name: string;
  duration: string;
  easing: string;
  delay: string;
  iterations: string;
  direction: string;
  fillMode: string;
  playState: string;
  timeline: string;
}

/** The element's CSS transitions. Leaves out the default "all 0s", which means no transition. */
export function readTransitions(styles: StyleValues): CssTransition[] {
  const durations = splitCssList(styles['transition-duration']);
  const easings = splitCssList(styles['transition-timing-function']);
  const delays = splitCssList(styles['transition-delay']);

  return splitCssList(styles['transition-property'])
    .map((property, index) => ({
      property,
      duration: itemAt(durations, index, '0s'),
      easing: itemAt(easings, index, 'ease'),
      delay: itemAt(delays, index, '0s'),
    }))
    .filter(
      (transition) =>
        transition.property !== 'none' &&
        ((parseTimeMs(transition.duration) ?? 0) !== 0 || (parseTimeMs(transition.delay) ?? 0) !== 0),
    );
}

/** The element's CSS animations. An animation-name of "none" means there are none. */
export function readAnimations(styles: StyleValues): CssAnimation[] {
  const lists = {
    duration: splitCssList(styles['animation-duration']),
    easing: splitCssList(styles['animation-timing-function']),
    delay: splitCssList(styles['animation-delay']),
    iterations: splitCssList(styles['animation-iteration-count']),
    direction: splitCssList(styles['animation-direction']),
    fillMode: splitCssList(styles['animation-fill-mode']),
    playState: splitCssList(styles['animation-play-state']),
    timeline: splitCssList(styles['animation-timeline']),
  };

  return splitCssList(styles['animation-name'])
    .map((name, index) => ({
      name,
      duration: itemAt(lists.duration, index, '0s'),
      easing: itemAt(lists.easing, index, 'ease'),
      delay: itemAt(lists.delay, index, '0s'),
      iterations: itemAt(lists.iterations, index, '1'),
      direction: itemAt(lists.direction, index, 'normal'),
      fillMode: itemAt(lists.fillMode, index, 'none'),
      playState: itemAt(lists.playState, index, 'running'),
      timeline: itemAt(lists.timeline, index, 'auto'),
    }))
    .filter((animation) => animation.name !== 'none');
}

/** For example "opacity · 300 ms · ease-out · delay 100 ms". */
export function formatTransition({ property, duration, easing, delay }: CssTransition): string {
  const parts = [property, formatTime(duration), easing];
  if (parseTimeMs(delay)) parts.push(`delay ${formatTime(delay)}`);
  return parts.join(' · ');
}

/** For example "fade-up · 600 ms · ease-out · repeats forever · alternate". */
export function formatAnimation(animation: CssAnimation): string {
  const parts = [animation.name, formatTime(animation.duration), animation.easing];
  if (parseTimeMs(animation.delay)) parts.push(`delay ${formatTime(animation.delay)}`);
  if (animation.iterations !== '1') {
    parts.push(animation.iterations === 'infinite' ? 'repeats forever' : `${animation.iterations}×`);
  }
  if (animation.direction !== 'normal') parts.push(animation.direction);
  if (animation.fillMode !== 'none') parts.push(`fill ${animation.fillMode}`);
  if (animation.playState !== 'running') parts.push(animation.playState);
  if (animation.timeline !== 'auto') parts.push(`scroll-driven: ${animation.timeline}`);
  return parts.join(' · ');
}

/** CSS repeats shorter lists to match the number of items. */
function itemAt(list: readonly string[], index: number, fallback: string): string {
  return list.length > 0 ? (list[index % list.length] ?? fallback) : fallback;
}
