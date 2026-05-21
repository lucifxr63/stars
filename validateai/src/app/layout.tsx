import { useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useConsentGuard } from '@/hooks/useConsentGuard';
import { ConsentModal } from '@/components/shared/ConsentModal';
import type { User } from '@supabase/supabase-js';

export function ProtectedLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const consentStatus = useConsentGuard(user?.id);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleConsentAccepted = useCallback(() => {
    setConsentAccepted(true);
  }, []);

  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;

  const needsConsent = consentStatus === 'required' && !consentAccepted;

  return (
    <>
      {needsConsent && (
        <ConsentModal userId={user.id} onAccepted={handleConsentAccepted} />
      )}
      <Outlet />
    </>
  );
}
