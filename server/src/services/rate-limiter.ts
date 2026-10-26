import { performance } from "node:perf_hooks";
import { HttpError } from "../errors.ts";

interface LimiterOptions {
  requestsPerSecond?: number;
  maxConcurrent?: number;
  maxQueue?: number;
  maxWaitMs?: number;
  now?: () => number;
}

export interface RequestLimiter {
  schedule<T>(task: () => Promise<T>): Promise<T>;
  pauseFor(milliseconds: number): void;
}

interface QueuedRequest {
  expiresAt: number;
  run: () => void;
  reject: (error: HttpError) => void;
}

// Pace starts rather than resetting a counter each second, which could allow boundary bursts.
export function createRateLimiter({
  // A cold 20-card page needs 21 starts, spanning at least one second at this rate.
  requestsPerSecond = 20,
  maxConcurrent = 5,
  maxQueue = 50,
  maxWaitMs = 15_000,
  now = () => performance.now(),
}: LimiterOptions = {}): RequestLimiter {
  for (const value of [requestsPerSecond, maxConcurrent, maxQueue, maxWaitMs]) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error("Rate limiter settings must be positive safe integers");
    }
  }
  if (requestsPerSecond > 1000) throw new Error("Rate cannot exceed timer precision of 1000 requests/second");

  const intervalMs = 1000 / requestsPerSecond;
  const queue: QueuedRequest[] = [];
  let active = 0;
  let nextStartAt = 0;
  let blockedUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function busyError(): HttpError {
    const retryAfter = Math.max(1, Math.ceil((Math.max(nextStartAt, blockedUntil) - now()) / 1000));
    return new HttpError(503, "Pokemon service is busy. Please try again shortly.", retryAfter);
  }

  function pump() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }

    // FIFO deadlines are ordered because every queued request has the same maximum wait.
    while (queue.length > 0 && queue[0].expiresAt <= now()) {
      queue.shift()!.reject(busyError());
    }
    if (queue.length === 0) return;

    if (active < maxConcurrent && now() >= Math.max(nextStartAt, blockedUntil)) {
      queue.shift()!.run();
    }

    if (queue.length > 0) {
      const current = now();
      const untilSlot = active < maxConcurrent ? Math.max(nextStartAt, blockedUntil) - current : Infinity;
      // Wake for either a dispatch slot or an expired wait, even while all slots are busy.
      const delay = Math.max(1, Math.min(untilSlot, queue[0].expiresAt - current));
      timer = setTimeout(pump, delay);
    }
  }

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      // Reject excess work instead of letting queued promises consume unlimited memory.
      if (queue.length >= maxQueue || blockedUntil - now() > maxWaitMs) {
        return Promise.reject(busyError());
      }

      return new Promise<T>((resolve, reject) => {
        queue.push({
          expiresAt: now() + maxWaitMs,
          reject,
          run() {
            active += 1;
            // Use the actual start time: a delayed event loop must not cause catch-up bursts.
            nextStartAt = now() + intervalMs;
            let result: Promise<T>;
            try {
              result = task();
            } catch (error) {
              result = Promise.reject(error);
            }
            Promise.resolve(result).then(resolve, reject).finally(() => {
              // Release the slot on success, rejection, or timeout.
              active -= 1;
              pump();
            });
          },
        });
        pump();
      });
    },
    pauseFor(milliseconds: number) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
      // Keep the longest upstream cooldown if several requests report one together.
      blockedUntil = Math.max(blockedUntil, now() + milliseconds);
      pump();
    },
  };
}

// One process-wide instance protects every service and browser using this backend.
export const pokeApiLimiter = createRateLimiter();
