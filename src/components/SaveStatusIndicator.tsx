'use client';

import { useMemo } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import type { SaveStatus } from '@/hooks/useAutoSave';

/**
 * Props for the SaveStatusIndicator component
 */
export interface SaveStatusIndicatorProps {
  /** Current save status */
  status: SaveStatus;
  /** Error message to display (only shown when status is 'error') */
  error?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Component that displays the current save status with an icon and text
 * 
 * Features:
 * - Shows different icons and text based on status
 * - Auto-fades "saved" state (handled by parent hook)
 * - Displays error message on hover via title attribute
 * - Accessible with ARIA labels
 * 
 * @param props - Component props
 */
export function SaveStatusIndicator({
  status,
  error,
  className = '',
}: SaveStatusIndicatorProps) {
  const { icon, text, ariaLabel } = useMemo(() => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          text: 'Saving...',
          ariaLabel: 'Saving changes',
        };
      case 'saved':
        return {
          icon: <Check className="w-3.5 h-3.5" />,
          text: 'Saved',
          ariaLabel: 'Changes saved',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          text: 'Error',
          ariaLabel: `Save error: ${error || 'Unknown error'}`,
        };
      case 'idle':
      default:
        return {
          icon: null,
          text: null,
          ariaLabel: 'No pending changes',
        };
    }
  }, [status, error]);

  // Don't render anything in idle state
  if (status === 'idle') {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs transition-opacity duration-200 ${
        status === 'saving'
          ? 'text-muted-foreground'
          : status === 'saved'
            ? 'text-green-600 dark:text-green-500'
            : 'text-destructive'
      } ${className}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      title={status === 'error' && error ? error : undefined}
    >
      {icon}
      <span>{text}</span>
    </span>
  );
}
