import type { AnimationRecord, ClassChange, StyleWrites } from '../recording';
import type { Cause, Confidence, Mechanism, RecordingData, UserTrigger } from './types';

interface UserAction {
  trigger: UserTrigger;
  t: number;
  /** How long before the reaction this action can still count as its trigger. */
  window: number;
  /** For viewport entries: which element entered. */
  element?: number;
}

export interface CauseContext {
  actions: UserAction[];
  classChanges: readonly ClassChange[];
  animations: readonly AnimationRecord[];
  styleWrites: readonly StyleWrites[];
  scrollTimes: number[];
  frameMs: number;
}

const ACTION_WINDOW_MS = 300;
/** Reveal-on-scroll code often waits until part of the element is visible, so entries can trigger later. */
const VIEWPORT_WINDOW_MS = 1000;
const SCROLL_WINDOW_MS = 150;
/** An action this close to the reaction is very likely its trigger. */
const CLOSE_MS = 50;

export function createCauseContext(
  recording: RecordingData,
  observed: { animations: readonly AnimationRecord[]; classChanges: readonly ClassChange[]; styleWrites: readonly StyleWrites[] },
  frameMs: number,
): CauseContext {
  const actions: UserAction[] = [
    ...recording.hover.map((change): UserAction => ({
      trigger: change.hovered ? 'hover-start' : 'hover-end',
      t: change.t,
      window: ACTION_WINDOW_MS,
    })),
    ...recording.presses.map((press): UserAction => ({
      trigger: press.type === 'press' ? 'pointer-down' : 'click',
      t: press.t,
      window: ACTION_WINDOW_MS,
    })),
    ...viewportEntries(recording).map(({ t, element }): UserAction => ({
      trigger: 'enters-viewport',
      t,
      window: VIEWPORT_WINDOW_MS,
      element,
    })),
  ].sort((a, b) => a.t - b.t);

  // The page's first scroll sample is where it started, not a scroll.
  const pageSamples = recording.scroll.filter((sample) => sample.area === -1);
  const scrollTimes = recording.scroll.filter((sample) => sample !== pageSamples[0]).map((sample) => sample.t);

  return { actions, ...observed, scrollTimes, frameMs };
}

/**
 * Finds what started a motion that began at `start`. It looks back from the
 * moment the motion was set off, either when Chrome created its animation or
 * when the element first changed. The chain it looks for is: a user action,
 * then possibly a class change, then the motion. The closest earlier action
 * wins.
 */
export function findCause(element: number, start: number, context: CauseContext): Cause {
  const tolerance = context.frameMs + 5;
  const animation = explainingAnimation(element, start, context.animations, tolerance);
  const causeTime = animation && !animation.runningAtStart ? animation.t : start;

  const classLink = latest(
    context.classChanges.filter(
      (change) =>
        (change.element === element || change.element === 0) &&
        change.t <= causeTime + tolerance &&
        change.t >= causeTime - ACTION_WINDOW_MS,
    ),
  );
  const anchor = classLink?.t ?? causeTime;
  const action = mostRecentAction(
    context.actions.filter(
      (candidate) =>
        (candidate.element === undefined || candidate.element === element || candidate.element === 0) &&
        candidate.t <= anchor + tolerance &&
        candidate.t >= anchor - candidate.window,
    ),
    context.frameMs,
  );

  let trigger: UserTrigger = action?.trigger ?? 'none';
  let triggerAt: number | null = action?.t ?? null;
  if (!action) {
    const scrolled = context.scrollTimes.filter((t) => t <= anchor + tolerance && t >= anchor - SCROLL_WINDOW_MS);
    if (scrolled.length > 0) {
      trigger = 'scroll';
      triggerAt = Math.max(...scrolled);
    }
  }

  const mechanism: Mechanism = animation
    ? mechanismOf(animation)
    : context.styleWrites.some((writes) => writes.element === element && writes.count > 0)
      ? 'javascript'
      : 'unknown';

  return {
    trigger,
    triggerAt,
    classChange: classLink ? { added: classLink.added, removed: classLink.removed, at: classLink.t } : null,
    mechanism,
    animation,
    confidence: confidenceOf(trigger, action ? anchor - action.t : null, mechanism, tolerance, context, causeTime),
  };
}

/** The animation Chrome reported on this element that covers the moment the motion started. */
function explainingAnimation(
  element: number,
  start: number,
  animations: readonly AnimationRecord[],
  tolerance: number,
): AnimationRecord | null {
  let best: AnimationRecord | null = null;
  for (const animation of animations) {
    if (animation.element !== element) continue;
    const ongoing =
      animation.runningAtStart &&
      (animation.scrollDriven || animation.durationMs === null || animation.iterations === null);
    if (!ongoing) {
      const total = (animation.durationMs ?? 0) * (animation.iterations ?? 1);
      const end = animation.t + Math.max(0, animation.delayMs) + total;
      if (animation.t > start + tolerance || start > end + tolerance) continue;
    }
    // Prefer the most recently created animation that covers this moment over one that was always running.
    if (!best || (!ongoing && (best.runningAtStart || animation.t >= best.t))) best = animation;
  }
  return best;
}

function mechanismOf(animation: AnimationRecord): Mechanism {
  if (animation.scrollDriven) return 'scroll-driven-animation';
  if (animation.kind === 'css-transition') return 'css-transition';
  if (animation.kind === 'css-animation') return 'css-animation';
  return 'web-animation';
}

function confidenceOf(
  trigger: UserTrigger,
  gap: number | null,
  mechanism: Mechanism,
  tolerance: number,
  context: CauseContext,
  causeTime: number,
): Confidence {
  if (trigger === 'none') {
    // No user action anywhere near it: probably autoplay, a loop, or a timer.
    const quietBefore = !context.actions.some((action) => action.t <= causeTime && action.t >= causeTime - 1000);
    return quietBefore ? 'medium' : 'low';
  }
  if (trigger === 'scroll') return 'low';
  return gap !== null && gap <= CLOSE_MS + tolerance && mechanism !== 'unknown' ? 'high' : 'medium';
}

/** Moments when an element went from outside the viewport to (partly) inside it. */
function viewportEntries(recording: RecordingData): Array<{ t: number; element: number }> {
  const { width, height } = recording.viewport;
  const wasVisible = new Map<number, boolean>();
  const entries: Array<{ t: number; element: number }> = [];
  for (const sample of recording.samples) {
    const visible =
      sample.width > 0 &&
      sample.height > 0 &&
      sample.x < width &&
      sample.x + sample.width > 0 &&
      sample.y < height &&
      sample.y + sample.height > 0;
    const before = wasVisible.get(sample.element);
    if (before === false && visible) entries.push({ t: sample.t, element: sample.element });
    wasVisible.set(sample.element, visible);
  }
  return entries;
}

/**
 * The action closest before the reaction. Presses and clicks carry exact event
 * times. Hover and viewport changes are only noticed at the next frame, so they
 * may really have happened up to one frame earlier. Comparing them by their
 * earliest possible time means a pointer that moves onto a button and clicks
 * straight away counts as a click, not a hover.
 */
function mostRecentAction(actions: readonly UserAction[], frameMs: number): UserAction | null {
  const exact = (action: UserAction) => action.trigger === 'pointer-down' || action.trigger === 'click';
  const earliest = (action: UserAction) => (exact(action) ? action.t : action.t - frameMs);
  let found: UserAction | null = null;
  for (const action of actions) {
    if (!found || earliest(action) > earliest(found) || (earliest(action) === earliest(found) && exact(action))) {
      found = action;
    }
  }
  return found;
}

function latest<T extends { t: number }>(items: readonly T[]): T | null {
  let found: T | null = null;
  for (const item of items) if (!found || item.t >= found.t) found = item;
  return found;
}
