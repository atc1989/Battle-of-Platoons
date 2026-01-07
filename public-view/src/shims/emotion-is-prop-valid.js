// Minimal browser-friendly stub for @emotion/is-prop-valid used by Framer Motion.
// We filter out known motion-specific props so they don't reach DOM nodes when
// styled-components/emotion are involved. Anything else passes through.
const BLOCKED_PROPS = new Set([
  'animate',
  'exit',
  'initial',
  'layout',
  'layoutId',
  'transition',
  'variants',
  'whileDrag',
  'whileFocus',
  'whileHover',
  'whileInView',
  'whileTap',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'dragPropagation',
  'dragSnapToOrigin',
  'onUpdate',
  'onAnimationComplete',
  'onAnimationStart',
  'onDrag',
  'onDragEnd',
  'onDragStart',
  'onDragTransitionEnd',
]);

export default function isPropValid(prop) {
  if (BLOCKED_PROPS.has(prop)) return false;
  if (prop === "className" || prop === "style") return true;
  // Allow standard data/aria attributes and anything React already permits.
  return (
    prop.startsWith('data-') ||
    prop.startsWith('aria-') ||
    // Rough heuristic: lowercase keys are likely native attributes.
    prop === prop.toLowerCase()
  );
}
