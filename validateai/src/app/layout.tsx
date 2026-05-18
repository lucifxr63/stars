import { useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useConsentGuard } from '@/hooks/useConsentGuard';
import { ConsentModal } from '@/components/shared/ConsentModal';
import { KycModal } from '@/components/shared/KycModal';
import type { User } from '@supabase/supabase-js';

export function ProtectedLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const consentStatus = useConsentGuard(user?.id);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [kycAccepted, setKycAccepted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('kyc_status').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) setKycStatus(data.kyc_status);
        });
    }
  }, [user?.id, kycAccepted]);

  const handleConsentAccepted = useCallback(() => {
    setConsentAccepted(true);
  }, []);

  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;

  // Mostrar modal bloqueante si el consentimiento es requerido
  const needsConsent = consentStatus === 'required' && !consentAccepted;
  // Mostrar modal bloqueante si el KYC no está verificado
  const needsKyc = kycStatus !== 'verified' && !kycAccepted;

  return (
    <>
      {needsConsent && (
        <ConsentModal userId={user.id} onAccepted={handleConsentAccepted} />
      )}
      {!needsConsent && needsKyc && (
        <KycModal onSuccess={() => setKycAccepted(true)} />
      )}
      <Outlet />
    </>
  );
}
