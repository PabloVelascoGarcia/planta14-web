/** Per-process probe: bounded frequency, shared response, and at most one underlying operation.
 * A timeout does not cancel a PostgreSQL promise: retain that operation until it really settles.
 */
export function createHealthProbe(check: () => Promise<unknown>, options: {
  ttlMs?: number; timeoutMs?: number; now?: () => number; onError?: (error: unknown) => void;
} = {}) {
  const { ttlMs = 15_000, timeoutMs = 4_000, now = Date.now, onError } = options;
  let operation: Promise<boolean> | undefined;
  let response: Promise<boolean> | undefined;
  let cached = false, expires = 0;
  return (): Promise<boolean> => {
    if (now() < expires) return Promise.resolve(cached);
    if (response) return response;
    operation ??= Promise.resolve().then(check).then(() => true, error => { onError?.(error); return false; })
      .finally(() => { operation = undefined; });
    let timer: ReturnType<typeof setTimeout>;
    response = Promise.race([operation, new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); })])
      .then(result => { cached = result; expires = now() + ttlMs; return result; })
      .finally(() => { clearTimeout(timer); response = undefined; });
    return response;
  };
}
