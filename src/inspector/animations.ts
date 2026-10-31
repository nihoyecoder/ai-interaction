import { createElementName } from '@/core/element-summary';
import { createAnimationRecord, type AnimationRecord } from '@/core/recording';

/**
 * Reads one animation from Chrome's animation list. That covers CSS
 * transitions, CSS animations, and Web Animations, which some libraries
 * (Framer Motion, for example) use under the hood. Everything is read from the
 * animation itself, so its timing and keyframes count as observed.
 */
export function readAnimation(
  animation: Animation,
  t: number,
  runningAtStart: boolean,
  indexOf: (element: Element) => number,
): AnimationRecord | null {
  const effect = animation.effect;
  if (!(effect instanceof KeyframeEffect) || !effect.target) return null;
  const { target } = effect;
  const timing = effect.getTiming();

  let kind: AnimationRecord['kind'] = 'web-animation';
  let name = animation.id;
  if (animation instanceof CSSTransition) {
    kind = 'css-transition';
    name = animation.transitionProperty;
  } else if (animation instanceof CSSAnimation) {
    kind = 'css-animation';
    name = animation.animationName;
  }

  return createAnimationRecord({
    t,
    runningAtStart,
    element: indexOf(target),
    target: createElementName({ tag: target.localName, id: target.id, classes: Array.from(target.classList) }),
    kind,
    name,
    pseudo: effect.pseudoElement,
    duration: timing.duration,
    delay: timing.delay ?? 0,
    easing: timing.easing ?? 'linear',
    iterations: timing.iterations ?? 1,
    direction: timing.direction ?? 'normal',
    fill: timing.fill ?? 'auto',
    // Time-based animations run on the document timeline; anything else is a scroll or view timeline.
    scrollDriven: animation.timeline !== null && !(animation.timeline instanceof DocumentTimeline),
    keyframes: effect.getKeyframes(),
  });
}
