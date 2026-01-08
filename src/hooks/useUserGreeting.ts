'use client';

import { useMemo } from 'react';
import { useUser } from '@clerk/nextjs';

interface UseUserGreetingReturn {
  firstName: string | null;
  isLoading: boolean;
}

export function useUserGreeting(): UseUserGreetingReturn {
  const { user, isLoaded } = useUser();

  const firstName = useMemo(() => {
    if (!isLoaded || !user) {
      return null;
    }
    return user.firstName || null;
  }, [user, isLoaded]);

  return {
    firstName,
    isLoading: !isLoaded,
  };
}

