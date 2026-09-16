/** Camera moves honour the reduced-motion preference by jumping instead of animating. */
export const motionDuration = (ms: number) =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
