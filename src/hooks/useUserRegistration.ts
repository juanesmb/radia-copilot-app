'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useLanguage } from '@/contexts/LanguageContext';

interface UserRegistrationResponse {
  user: {
    id: string;
    created_at: string;
    email: string;
    language: string;
  };
  isNewUser: boolean;
  message: string;
}

export function useUserRegistration() {
  const { user, isLoaded } = useUser();
  const { language } = useLanguage();

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    const registerUser = async () => {
      const userEmail = user.primaryEmailAddress?.emailAddress;
      
      if (!userEmail) {
        console.warn('[useUserRegistration] User has no email address');
        return;
      }

      console.log('[useUserRegistration] Attempting to register user:', {
        email: userEmail,
        language: language || 'es',
      });

      try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userEmail,
            language: language || 'es',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[useUserRegistration] Registration failed:', {
            status: response.status,
            error: errorData,
          });
          return;
        }

        const result: UserRegistrationResponse = await response.json();
        console.log('[useUserRegistration] Registration successful:', {
          isNewUser: result.isNewUser,
          email: result.user.email,
          userId: result.user.id,
          message: result.message,
        });
      } catch (error) {
        console.error('[useUserRegistration] Error registering user:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userEmail,
        });
      }
    };

    registerUser();
  }, [isLoaded, user, language]);

  return { isLoaded };
}
