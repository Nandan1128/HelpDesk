import { useState, useEffect } from 'react';

/**
 * Hook that delays updating the debounced value until after the specified delay.
 * Useful for debouncing search input to prevent firing API queries on every keystroke.
 *
 * @param value The value to debounce (e.g. search input string)
 * @param delay The delay in milliseconds (default 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // If value is empty string, update immediately for fast filter reset
    if (typeof value === 'string' && value === '') {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
