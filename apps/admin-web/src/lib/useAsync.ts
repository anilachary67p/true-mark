'use client';

import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, isApiError } from '@/lib/api';

export type AsyncData<T> = {
  data: T | undefined;
  loading: boolean;
  error: string;
  reload: () => void;
};

/**
 * Loads data for the current dependencies. Each run gets its own AbortSignal; stale responses
 * (from superseded dependency values or unmounted components) are discarded, so fast filter or
 * date-range changes can never render an older result over a newer one.
 */
export function useAsyncData<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  { enabled = true }: { enabled?: boolean } = {},
): AsyncData<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    loaderRef
      .current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (controller.signal.aborted || isApiError(err, 401)) return;
        setError(errorMessage(err, 'Failed to load data.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

export type AsyncAction<A extends unknown[]> = {
  run: (...args: A) => Promise<boolean>;
  pending: boolean;
  error: string;
  clearError: () => void;
};

/**
 * Wraps a user-triggered mutation: prevents double submission, exposes `pending` for disabling
 * controls, and converts failures into a displayable `error` instead of unhandled rejections.
 * `run` resolves to true on success.
 */
export function useAsyncAction<A extends unknown[]>(
  action: (...args: A) => Promise<unknown>,
): AsyncAction<A> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setError('');
    try {
      await actionRef.current(...args);
      return true;
    } catch (err) {
      if (mounted.current && !isApiError(err, 401)) setError(errorMessage(err));
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(''), []);
  return { run, pending, error, clearError };
}

/** Debounces a rapidly changing value (e.g. a search box) before it triggers requests. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
