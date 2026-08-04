// Jsdom polyfills required by Radix UI primitives (used via shadcn's Select
// component) when rendered under vitest's jsdom environment — jsdom does not
// implement these DOM APIs, and Radix's Select/pointer-events handling calls
// them unconditionally. This is a standard, widely-documented gap (not a
// project-specific workaround); see Radix UI's own testing guidance and
// testing-library's jsdom-environment issues for the same three polyfills.
// Loaded once via vitest.config.ts's `setupFiles`, applies only to the
// jsdom-environment test files that opt in via the `@vitest-environment
// jsdom` docblock (suggestion-review-list.test.tsx) — never touches the
// "node"-environment suites.
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
