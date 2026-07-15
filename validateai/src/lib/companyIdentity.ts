// Identidad de empresa compartida del ecosistema (tabla `company_identity` en el
// Supabase compartido). Una fila por usuario, RLS por `auth.uid()`. Mismo patrón
// en todas las apps del ecosistema.

import { supabase } from '@/lib/supabase';

export interface CompanyIdentity {
  company_rut: string;
  company_name: string;
}

// El cliente de Validus está tipado con el Database generado, que NO incluye la
// tabla compartida company_identity → accedemos sin tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from('company_identity');

// Devuelve:
//   objeto → identidad existente
//   null   → sesión OK, sin identidad aún → mostrar el gate
//   false  → feature no disponible (tabla inexistente / error) → NO bloquear
export async function getCompanyIdentity(): Promise<CompanyIdentity | null | false> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await table()
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
  const { error } = await table().upsert(
    { user_id: user.id, ...identity },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
