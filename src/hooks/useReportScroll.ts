'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to track scroll progress on a report container.
 * Returns true when the user has scrolled past the specified threshold.
 * 
 * @param enabled - Whether scroll tracking is active
 * @param threshold - Scroll percentage threshold (0-1), default 0.3 (30%)
 * @returns boolean indicating if threshold has been reached
 */
export function useReportScroll(
  enabled: boolean,
  threshold: number = 0.3
): boolean {
  const [hasScrolledPastThreshold, setHasScrolledPastThreshold] = useState(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHasScrolledPastThreshold(false);
      return;
    }

    // Find the scrollable container
    const container = document.querySelector('[data-report-container]') as HTMLElement;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      // Clear existing timer
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }

      // Throttle scroll events (100ms debounce)
      scrollTimerRef.current = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        // Calculate scroll percentage
        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll <= 0) {
          // Content fits in container, consider as scrolled
          setHasScrolledPastThreshold(true);
          return;
        }

        const scrollPercentage = scrollTop / maxScroll;

        // Check if threshold has been reached
        if (scrollPercentage >= threshold) {
          setHasScrolledPastThreshold(true);
        }
      }, 100);
    };

    // Initial check in case content is already scrolled
    handleScroll();

    // Add scroll event listener
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, [enabled, threshold]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      setHasScrolledPastThreshold(false);
    }
  }, [enabled]);

  return hasScrolledPastThreshold;
}
