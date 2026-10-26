import type { RequestLimiter } from "../src/services/rate-limiter.ts";

// Shape/cache tests use fake transport without waiting; limiter behavior has its own clock tests.
export const immediateLimiter: RequestLimiter = {
  schedule: (task) => task(),
  pauseFor: () => {},
};
