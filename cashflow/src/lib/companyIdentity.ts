// Identidad de empresa compartida del ecosistema (tabla `company_identity` en el
// schema `public` del Supabase compartido). Ojo: el cliente de cashflow usa el
// schema `cashflow` por defecto, así que acá forzamos `.schema('public')`.

import { supabase } from '@/lib/supabase';

export interface CompanyIdentity {
  company_rut: string;
  company_name: string;
}

// El cliente de cashflow está tipado al schema `cashflow`; la tabla compartida
// vive en `public` y no está en los tipos generados → acceso sin tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).schema('public').from('company_identity');

// objeto → identidad · null → falta (gate) · false → no disponible (no bloquear)
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
