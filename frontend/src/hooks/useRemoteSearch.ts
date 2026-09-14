import { useCallback, useEffect, useRef, useState } from "react";
import { REMOTE_SEARCH_DEBOUNCE_MS, REMOTE_SEARCH_MIN_LENGTH } from "../config/search";

type RemoteSearchOptions<T> = {
    enabled?: boolean;
    minLength?: number;
    debounceMs?: number;
    search: (term: string, signal: AbortSignal) => Promise<T[]>;
    onResults: (results: T[]) => void;
    onError: (error: unknown) => void;
    onInvalidTerm?: (term: string) => void;
};

export function useRemoteSearch<T>({
    enabled = true,
    minLength = REMOTE_SEARCH_MIN_LENGTH,
    debounceMs = REMOTE_SEARCH_DEBOUNCE_MS,
    search,
    onResults,
    onError,
    onInvalidTerm,
}: RemoteSearchOptions<T>) {
    const [term, setTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const controller = useRef<AbortController | null>(null);
    const requestId = useRef(0);
    const callbacks = useRef({ onResults, onError, onInvalidTerm, search });
    useEffect(() => {
        callbacks.current = { onResults, onError, onInvalidTerm, search };
    }, [onError, onInvalidTerm, onResults, search]);

    const cancel = useCallback(() => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        controller.current?.abort();
        controller.current = null;
        requestId.current += 1;
        setLoading(false);
    }, []);

    const invalidate = useCallback(() => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        controller.current?.abort();
        controller.current = null;
        requestId.current += 1;
    }, []);

    const execute = useCallback((value: string) => {
        const normalized = value.trim();
        if (!enabled) return;

        if (normalized && normalized.length < minLength) {
            invalidate();
            callbacks.current.onInvalidTerm?.(normalized);
            return;
        }

        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        controller.current?.abort();
        const currentRequest = ++requestId.current;
        const nextController = new AbortController();
        controller.current = nextController;
        setLoading(true);

        callbacks.current.search(normalized, nextController.signal)
            .then((results) => {
                if (currentRequest !== requestId.current || nextController.signal.aborted) return;
                callbacks.current.onResults(results);
            })
            .catch((error: unknown) => {
                if (currentRequest !== requestId.current || nextController.signal.aborted) return;
                callbacks.current.onError(error);
            })
            .finally(() => {
                if (currentRequest === requestId.current) setLoading(false);
            });
    }, [enabled, invalidate, minLength]);

    useEffect(() => {
        if (!enabled) return;
        const normalized = term.trim();
        if (normalized && normalized.length < minLength) {
            invalidate();
            callbacks.current.onInvalidTerm?.(normalized);
            return;
        }

        if (!normalized) {
            timer.current = setTimeout(() => execute(""), 0);
            return;
        }

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => execute(term), debounceMs);
        return () => {
            if (timer.current) {
                clearTimeout(timer.current);
                timer.current = null;
            }
        };
    }, [debounceMs, enabled, execute, invalidate, minLength, term]);

    useEffect(() => () => cancel(), [cancel]);

    const updateTerm = useCallback((value: string) => {
        cancel();
        setTerm(value);
    }, [cancel]);

    const executeNow = useCallback(() => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        execute(term);
    }, [execute, term]);

    return { term, setTerm: updateTerm, loading, executeNow, refresh: executeNow, cancel };
}
