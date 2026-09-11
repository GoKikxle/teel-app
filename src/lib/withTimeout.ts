export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

// Races `promise` against a timer so a hung request (dead network, a
// backgrounded tab whose fetch never got a chance to finish) rejects
// instead of leaving whatever's awaiting it — a `loading` state, an auth
// bootstrap — stuck forever with no way out but a hard refresh. This
// doesn't cancel the original promise, so if it resolves after the
// timeout already rejected, nothing here does anything further with it.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
