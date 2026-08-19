'use client';

import { useCallback, useState } from 'react';

/**
 * Sets pending synchronously on click (<100ms feedback), then runs the async action.
 * Do not use for clinically unsafe optimistic UI — only for disabled/spinner states.
 */
export function usePendingAction() {
  const [pending, setPending] = useState(false);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setPending(true);
    try {
      return await action();
    } finally {
      setPending(false);
    }
  }, []);

  return [pending, run] as const;
}
