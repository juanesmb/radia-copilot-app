'use client';

import { useEffect, useRef } from 'react';

/**
 * Options for the useAutoHideScrollbar hook
 */
interface UseAutoHideScrollbarOptions {
  /** Delay in milliseconds before hiding scrollbar after scrolling stops (default: 1000) */
  hideDelay?: number;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Custom hook that automatically hides scrollbars after scrolling stops
 * 
 * Adds a "scrolling" class to the element while scrolling, which is removed
 * after the specified delay. This works with the scrollbar-transparent CSS class.
 * 
 * @param options - Configuration options
 * @returns Ref to attach to the scrollable element
 */
export function useAutoHideScrollbar({
  hideDelay = 1000,
  enabled = true,
}: UseAutoHideScrollbarOptions = {}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const element = elementRef.current;
    if (!element) {
      return;
    }

    const handleScroll = () => {
      // Add scrolling class
      element.classList.add('scrolling');

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Remove scrolling class after delay
      timeoutRef.current = setTimeout(() => {
        element.classList.remove('scrolling');
        timeoutRef.current = null;
      }, hideDelay);
    };

    // Also show scrollbar on hover
    const handleMouseEnter = () => {
      element.classList.add('scrolling');
    };

    const handleMouseLeave = () => {
      // Only remove if not actively scrolling
      if (timeoutRef.current) {
        return; // Will be removed by scroll timeout
      }
      element.classList.remove('scrolling');
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hideDelay, enabled]);

  return elementRef;
}
