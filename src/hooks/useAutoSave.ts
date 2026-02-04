'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Save status states for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Options for the useAutoSave hook
 */
export interface UseAutoSaveOptions {
  /** Initial value of the textarea */
  initialValue: string;
  /** Async function to call when saving */
  onSave: (value: string) => Promise<void>;
  /** Debounce delay in milliseconds (default: 1500) */
  debounceMs?: number;
  /** Whether auto-save is disabled (e.g., during report generation) */
  isDisabled?: boolean;
  /** Report ID for reset detection - status resets when this changes */
  reportId?: string | null;
}

/**
 * Return type for the useAutoSave hook
 */
export interface UseAutoSaveReturn {
  /** Current value of the textarea */
  value: string;
  /** Current save status */
  status: SaveStatus;
  /** Error message if last save failed */
  error: string | null;
  /** onChange handler for the textarea */
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** onBlur handler for the textarea */
  onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
}

/**
 * Constants for save behavior
 */
const DEFAULT_DEBOUNCE_MS = 1500;
const SAVED_STATE_DURATION_MS = 2000;

/**
 * Custom hook for auto-saving textarea content with status tracking
 * 
 * Features:
 * - Debounced saves after user stops typing
 * - Immediate save on blur
 * - Save status tracking (idle, saving, saved, error)
 * - Prevents saves when disabled
 * - Resets status when reportId changes
 * 
 * @param options - Configuration options for auto-save
 * @returns Hook return value with value, status, error, and event handlers
 */
export function useAutoSave({
  initialValue,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  isDisabled = false,
  reportId,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = useRef(initialValue);
  const previousReportIdRef = useRef(reportId);
  const savedStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync displayed value when initialValue changes (e.g., when switching reports)
  // Note: previousValueRef tracks what was LAST SAVED, not the current displayed value
  // This allows us to detect when user makes changes vs when parent updates the value
  useEffect(() => {
    if (initialValue !== value) {
      setValue(initialValue);
      // Don't update previousValueRef here - it's only updated after successful saves
      // or when reportId changes (handled by the reportId effect below)
    }
  }, [initialValue, value]);

  /**
   * Clears the saved state timeout if it exists
   */
  const clearSavedStateTimeout = useCallback(() => {
    if (savedStateTimeoutRef.current) {
      clearTimeout(savedStateTimeoutRef.current);
      savedStateTimeoutRef.current = null;
    }
  }, []);

  /**
   * Clears the debounce timeout if it exists
   */
  const clearDebounceTimeout = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  // Reset status when reportId changes
  useEffect(() => {
    if (reportId !== previousReportIdRef.current) {
      previousReportIdRef.current = reportId;
      // Clear any pending saves
      clearDebounceTimeout();
      // Clear saved state timeout
      clearSavedStateTimeout();
      // Reset previousValueRef to current initialValue when switching reports
      // This ensures we compare against the new report's saved value, not the old one
      previousValueRef.current = initialValue;
      // Reset to idle state
      setStatus('idle');
      setError(null);
    }
  }, [reportId, initialValue, clearSavedStateTimeout, clearDebounceTimeout]);

  /**
   * Performs the actual save operation
   */
  const performSave = useCallback(
    async (valueToSave: string) => {
      // Skip save if disabled
      if (isDisabled) {
        return;
      }

      // Skip save if value hasn't changed (compare trimmed values)
      const trimmedValue = valueToSave.trim();
      const trimmedPrevious = previousValueRef.current.trim();
      if (trimmedValue === trimmedPrevious) {
        return;
      }

      clearSavedStateTimeout();

      // Set status to saving
      setStatus('saving');
      setError(null);

      try {
        // Call the save function with trimmed value
        await onSave(trimmedValue);

        // Update previous value reference AFTER successful save
        // Store the trimmed value to match what was actually saved
        previousValueRef.current = trimmedValue;

        // Save successful
        setStatus('saved');

        // Auto-hide "saved" state after duration
        savedStateTimeoutRef.current = setTimeout(() => {
          setStatus('idle');
          savedStateTimeoutRef.current = null;
        }, SAVED_STATE_DURATION_MS);
      } catch (err) {
        // Save failed
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to save changes';
        setError(errorMessage);
        setStatus('error');
      }
    },
    [onSave, isDisabled, clearSavedStateTimeout]
  );

  /**
   * Handles onChange events with debouncing
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      // Clear existing timeout
      clearDebounceTimeout();

      // Only schedule save if not disabled
      if (!isDisabled) {
        debounceTimeoutRef.current = setTimeout(() => {
          performSave(newValue);
          debounceTimeoutRef.current = null;
        }, debounceMs);
      }
    },
    [performSave, debounceMs, clearDebounceTimeout, isDisabled]
  );

  /**
   * Handles onBlur events with immediate save
   */
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      // Clear any pending debounced save
      clearDebounceTimeout();

      // Trim and save immediately
      const trimmedValue = e.target.value.trim();
      setValue(trimmedValue);
      performSave(trimmedValue);
    },
    [performSave, clearDebounceTimeout]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearDebounceTimeout();
      clearSavedStateTimeout();
    };
  }, [clearDebounceTimeout, clearSavedStateTimeout]);

  return {
    value,
    status,
    error,
    onChange: handleChange,
    onBlur: handleBlur,
  };
}
