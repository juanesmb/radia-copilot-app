'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseDebouncedTextEditorOptions {
  initialValue: string;
  onUpdate: (value: string) => void;
  debounceMs?: number;
}

interface UseDebouncedTextEditorReturn {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
}

export function useDebouncedTextEditor({
  initialValue,
  onUpdate,
  debounceMs = 1000,
}: UseDebouncedTextEditorOptions): UseDebouncedTextEditorReturn {
  const [value, setValue] = useState(initialValue);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = useRef(initialValue);

  useEffect(() => {
    if (initialValue !== previousValueRef.current) {
      previousValueRef.current = initialValue;
      setValue(initialValue);
    }
  }, [initialValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        const trimmedValue = newValue.trim();
        if (trimmedValue !== previousValueRef.current.trim()) {
          previousValueRef.current = trimmedValue;
          onUpdate(trimmedValue);
        }
      }, debounceMs);
    },
    [onUpdate, debounceMs]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      const newValue = e.target.value.trim();
      if (newValue !== previousValueRef.current.trim()) {
        previousValueRef.current = newValue;
        setValue(newValue);
        onUpdate(newValue);
      }
    },
    [onUpdate]
  );

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    value,
    onChange: handleChange,
    onBlur: handleBlur,
  };
}

