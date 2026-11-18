/**
 * Per-Session Async Mutex Lock
 *
 * Concurrent chat requests to the same session are queued in strict FIFO order.
 * This prevents message interleaving, race conditions, broken sequence ordering,
 * and orphaned/misaligned dialogue history turns.
 */

const sessionQueues = new Map();

/**
 * Executes an async task while holding an exclusive lock on the given sessionId.
 *
 * Design Choice: Queue vs 409 Conflict:
 * CosmoAI queues concurrent sends sequentially per session rather than rejecting with 409 Conflict.
 * This guarantees that rapid successive messages (e.g. user rapid typing, multi-turn pipelines,
 * concurrent test runners) are all processed in strict FIFO order, producing a consistent,
 * monotonically ordered sequence of aligned (user, assistant) dialogue turns.
 *
 * @template T
 * @param {string} sessionId
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
export async function withSessionLock(sessionId, task) {
  if (!sessionId || typeof sessionId !== 'string') {
    return await task();
  }

  // Obtain the current tail of the queue for this session, or a resolved promise
  const previousTurnPromise = sessionQueues.get(sessionId) || Promise.resolve();

  let releaseLock;
  const currentTurnPromise = new Promise((resolve) => {
    releaseLock = resolve;
  });

  // Advance the tail of the session queue to the current turn
  sessionQueues.set(sessionId, currentTurnPromise);

  // Wait for the preceding turn to complete (irrespective of whether it succeeded or threw an error)
  await previousTurnPromise.catch(() => {});

  try {
    return await task();
  } finally {
    releaseLock();
    // If no other request has queued behind this one, clean up the Map entry to prevent memory leaks
    if (sessionQueues.get(sessionId) === currentTurnPromise) {
      sessionQueues.delete(sessionId);
    }
  }
}

/**
 * Checks whether a session currently has an active turn in flight.
 *
 * @param {string} sessionId
 * @returns {boolean}
 */
export function isSessionLocked(sessionId) {
  return sessionQueues.has(sessionId);
}

/**
 * Returns the number of currently active session queues.
 *
 * @returns {number}
 */
export function getActiveSessionLocksCount() {
  return sessionQueues.size;
}

/**
 * Clears all active session locks (for test cleanup).
 */
export function clearAllSessionLocks() {
  sessionQueues.clear();
}
