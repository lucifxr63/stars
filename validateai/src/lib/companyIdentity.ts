// Identidad de empresa compartida del ecosistema (tabla `company_identity` en el
// Supabase compartido). Una fila por usuario, RLS por `auth.uid()`. Mismo patrón
// en todas las apps del ecosistema.

import { supabase } from '@/lib/supabase';

export interface CompanyIdentity {
  company_rut: string;
  company_name: string;
}

// Devuelve:
//   objeto → identidad existente
//   null   → sesión OK, sin identidad aún → mostrar el gate
//   false  → feature no disponible (tabla inexistente / error) → NO bloquear
export async function getCompanyIdentity(): Promise<CompanyIdentity | null | false> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('company_identity')
    .select('company_rut, company_name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    console.error('[company_identity] lectura falló:', error.message);
    return false;
  }
  return (data as CompanyIdentity) ?? null;
}

export async function saveCompanyIdentity(identity: CompanyIdentity): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sin sesión');
  const { error } = await supabase
    .from('company_identity')
    .upsert({ user_id: user.id, ...identity }, { onConflict: 'user_id' });
  if (error) throw error;
}
