'use client';

import { useUserRegistration } from '@/hooks/useUserRegistration';

export function UserRegistrationProvider() {
  useUserRegistration();
  
  // This component doesn't render anything visible
  // It just handles the user registration side effect
  return null;
}
