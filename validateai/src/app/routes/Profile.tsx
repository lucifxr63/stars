import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { FounderProfileTab } from '@/components/shared/FounderProfileTab';
import type { User } from '@supabase/supabase-js';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ProfileRow {
  full_name:            string | null;
  avatar_url:           string | null;
  tier:                 string;
  tier_expires_at:      string | null;
  kyc_status:           string | null;
  rut_hash:             string | null;
  training_consent:     boolean | null;
  created_at:           string;
}

interface ValidationStat {
  id:                string;
  idea_name:         string | null;
  idea_industry:     string | null;
  validation_score:  number | null;
  status:            string;
  created_at:        string;
}

// ── Helpers visuales ──────────────────────────────────────────────────────────
const TIER_LABEL: Record<string, { label: string; color: string }> = {
  free:    { label: 'Free',    color: 'bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-[#8B8AA0]' },
  basic:   { label: 'Basic',   color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
  pro:     { label: 'Pro',     color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' },
  premium: { label: 'Premium', color: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400' },
};

const INDUSTRY_LABEL: Record<string, string> = {
  fintech: 'Fintech', edtech: 'Edtech', healthtech: 'Healthtech',
  ecommerce: 'E-commerce', saas: 'SaaS', marketplace: 'Marketplace',
  social: 'Social', logistics: 'Logística', foodtech: 'Foodtech',
  proptech: 'Proptech', other: 'Otro',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-400">—</span>;
  const color = score >= 70 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400'
    : score >= 40 ? 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400'
    : 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}/100</span>
  );
}

// ── Sección: Cuenta ───────────────────────────────────────────────────────────
function AccountSection({ user, profile }: { user: User; profile: ProfileRow | null }) {
  const [editing, setEditing]     = useState(false);
  const [fullName, setFullName]   = useState(profile?.full_name ?? '');
  const [rutInput, setRutInput]   = useState('');
  const [saving, setSaving]       = useState(false);

  const initials = (fullName || user.email || '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const tierInfo = TIER_LABEL[profile?.tier ?? 'free'] ?? TIER_LABEL.free;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', user.id);
    if (error) { setSaving(false); toast.error('Error al guardar'); return; }

    if (rutInput.trim()) {
      const { error: rutError } = await supabase
        .rpc('update_my_rut_hash', { plain_rut: rutInput.trim() });
      if (rutError) { setSaving(false); toast.error('Error al guardar RUT'); return; }
    }

    setSaving(false);
    toast.success('Perfil actualizado');
    setRutInput('');
    setEditing(false);
  };

  return (
    <section className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Cuenta</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold px-3 py-1.5 border border-gray-200 dark:border-white/8 rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition-all"
          >
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 border border-gray-200 dark:border-white/8 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="text-xs font-semibold px-3 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} className="w-full h-full rounded-2xl object-cover" alt="" />
            : initials}
        </div>
        <div className="min-w-0">
          {editing ? (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre completo"
              className="text-lg font-bold bg-transparent border-b-2 border-indigo-400 outline-none w-full pb-0.5 text-gray-900 dark:text-[#F0EFF8]"
            />
          ) : (
            <p className="text-lg font-bold text-gray-900 dark:text-[#F0EFF8] truncate">
              {fullName || <span className="text-gray-400 font-normal italic">Sin nombre</span>}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-0.5">{user.email}</p>
          <span className={`inline-block mt-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${tierInfo.color}`}>
            {tierInfo.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* RUT */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-gray-100 dark:border-white/8 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">RUT</p>
          {editing ? (
            <input
              value={rutInput}
              onChange={(e) => setRutInput(e.target.value)}
              placeholder={profile?.rut_hash ? 'Ingresar nuevo RUT' : '12.345.678-9'}
              className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8] bg-transparent border-b border-indigo-300 outline-none w-full pb-0.5"
            />
          ) : (
            <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8]">
              {profile?.rut_hash
                ? <span className="text-emerald-600 dark:text-emerald-400">✓ Registrado</span>
                : <span className="text-gray-400 italic">No registrado</span>}
            </p>
          )}
        </div>

        {/* Plan */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/8 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Plan</p>
          <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8] capitalize">{profile?.tier ?? 'Free'}</p>
          {profile?.tier_expires_at && (
            <p className="text-[10px] text-gray-400 mt-0.5">Vence {fmtDate(profile.tier_expires_at)}</p>
          )}
        </div>

        {/* KYC */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/8 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">KYC</p>
          <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8] capitalize">
            {profile?.kyc_status === 'approved' ? '✓ Verificado'
              : profile?.kyc_status === 'pending' ? 'Pendiente'
              : 'No iniciado'}
          </p>
        </div>

        {/* Miembro desde */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/8 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Miembro desde</p>
          <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8]">
            {profile?.created_at ? fmtDate(profile.created_at) : '—'}
          </p>
        </div>

        {/* Última sesión */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-gray-100 dark:border-white/8 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Última sesión</p>
          <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8]">
            {user.last_sign_in_at ? fmtDate(user.last_sign_in_at) : '—'}
          </p>
        </div>

        {/* Upgrade CTA si es free */}
        {(!profile?.tier || profile.tier === 'free') && (
          <div className="col-span-2 rounded-2xl border border-dashed border-indigo-300 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Desbloquea análisis avanzados</p>
              <p className="text-[10px] text-indigo-500 mt-0.5">Founder Fit, Unit Economics, Gobernanza y más</p>
            </div>
            <Link to="/pricing" className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
              Ver planes
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Sección: Suscripción ──────────────────────────────────────────────────────
function SubscriptionSection({ profile }: { profile: ProfileRow | null }) {
  const tier = profile?.tier ?? 'free';
  const tierInfo = TIER_LABEL[tier] ?? TIER_LABEL.free;
  const isPaid = tier !== 'free';

  return (
    <section className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
      <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] mb-5">Suscripción</h2>

      <div className="space-y-3">
        {/* Plan actual */}
        <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-white/8">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Plan actual</p>
            <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${tierInfo.color}`}>
              {tierInfo.label}
            </span>
          </div>
          {profile?.tier_expires_at && (
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Vence</p>
              <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8]">
                {fmtDate(profile.tier_expires_at)}
              </p>
            </div>
          )}
        </div>

        {isPaid ? (
          <div className="p-4 rounded-2xl border border-gray-100 dark:border-white/8">
            <p className="text-xs font-semibold text-gray-700 dark:text-[#C4C4D4] mb-1">Gestionar suscripción</p>
            <p className="text-xs text-gray-400 dark:text-[#8B8AA0] leading-relaxed">
              Para cambios de plan, cancelación o facturación contacta a{' '}
              <a href="mailto:contacto@validus.scouttech.lat" className="text-indigo-500 hover:underline">
                contacto@validus.scouttech.lat
              </a>
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl border border-dashed border-indigo-300 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1">
              Desbloquea el análisis completo
            </p>
            <p className="text-[11px] text-indigo-500 mb-3 leading-relaxed">
              Gobernanza, Fundraising, Unit Economics, Founder Fit y exportación PDF investor-ready.
            </p>
            <Link
              to="/pricing"
              className="inline-block px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Ver planes →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Sección: Actividad ────────────────────────────────────────────────────────
function ActivitySection({ userId }: { userId: string }) {
  const [stats, setStats]               = useState<ValidationStat[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    supabase
      .from('validations')
      .select('id, idea_name, idea_industry, validation_score, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setStats((data as ValidationStat[]) ?? []);
        setLoading(false);
      });
  }, [userId]);

  const completed  = stats.filter((v) => v.status === 'completed');
  const avgScore   = completed.length
    ? Math.round(completed.filter((v) => v.validation_score !== null)
        .reduce((s, v) => s + (v.validation_score ?? 0), 0) /
        (completed.filter((v) => v.validation_score !== null).length || 1))
    : null;

  const industryCounts = stats.reduce<Record<string, number>>((acc, v) => {
    if (v.idea_industry) acc[v.idea_industry] = (acc[v.idea_industry] ?? 0) + 1;
    return acc;
  }, {});
  const topIndustry = Object.entries(industryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <section className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
      <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] mb-5">Actividad de Validaciones</h2>

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-2xl border border-gray-100 dark:border-white/8 p-3 text-center">
              <p className="text-2xl font-black text-indigo-600">{stats.length}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Validaciones</p>
            </div>
            <div className="rounded-2xl border border-gray-100 dark:border-white/8 p-3 text-center">
              <p className="text-2xl font-black text-indigo-600">{completed.length}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Completadas</p>
            </div>
            <div className="rounded-2xl border border-gray-100 dark:border-white/8 p-3 text-center">
              <p className="text-2xl font-black text-indigo-600">{avgScore ?? '—'}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Score promedio</p>
            </div>
          </div>

          {/* Industria más explorada */}
          {topIndustry && (
            <div className="rounded-2xl border border-gray-100 dark:border-white/8 p-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Industria más validada</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mt-0.5">
                  {INDUSTRY_LABEL[topIndustry] ?? topIndustry}
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-full">
                {industryCounts[topIndustry]}x
              </span>
            </div>
          )}

          {/* Últimas validaciones */}
          {stats.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">Aún no tienes validaciones</p>
              <Link to="/validate" className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline">
                Crear primera validación →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Últimas validaciones</p>
              {stats.slice(0, 5).map((v) => (
                <Link
                  key={v.id}
                  to={`/results/${v.id}`}
                  className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-white/8 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8] truncate group-hover:text-indigo-600 transition-colors">
                      {v.idea_name ?? 'Sin nombre'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {INDUSTRY_LABEL[v.idea_industry ?? ''] ?? v.idea_industry ?? '—'} · {fmtDate(v.created_at)}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0">
                    <ScoreChip score={v.validation_score} />
                  </div>
                </Link>
              ))}
              {stats.length > 5 && (
                <Link to="/results" className="block text-center text-xs font-semibold text-indigo-600 hover:underline pt-1">
                  Ver todas ({stats.length}) →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Sección: Privacidad ───────────────────────────────────────────────────────
function PrivacySection({ userId, initialConsent }: { userId: string; initialConsent: boolean | null }) {
  const [consent, setConsent] = useState(initialConsent ?? false);
  const [saving, setSaving]   = useState(false);

  const toggle = async () => {
    const next = !consent;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ training_consent: next, training_consent_at: new Date().toISOString() })
      .eq('id', userId);
    setSaving(false);
    if (error) { toast.error('Error al actualizar'); return; }
    setConsent(next);
    toast.success(next ? 'Consentimiento activado' : 'Consentimiento revocado');
  };

  return (
    <section className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
      <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] mb-5">Privacidad y Datos</h2>

      <div className="space-y-3">
        {/* Training consent */}
        <div className="flex items-start justify-between p-4 rounded-2xl border border-gray-100 dark:border-white/8">
          <div className="flex-1 min-w-0 mr-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">
              Contribuir al entrenamiento del modelo
            </p>
            <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-1 leading-relaxed">
              Tus validaciones anonimizadas pueden usarse para mejorar Validus.
              Datos sensibles son removidos antes del procesamiento.
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={saving}
            className={`shrink-0 w-11 h-6 rounded-full transition-all relative ${consent ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-white/10'}`}
            aria-label="Toggle consentimiento"
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${consent ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Ley 21.719 */}
        <div className="p-4 rounded-2xl border border-gray-100 dark:border-white/8">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Marco legal</p>
          <p className="text-xs text-gray-600 dark:text-[#8B8AA0] leading-relaxed">
            Tus datos se tratan bajo la{' '}
            <span className="font-semibold text-gray-900 dark:text-[#F0EFF8]">Ley 21.719</span>{' '}
            de Protección de Datos Personales de Chile. Tienes derecho a acceso,
            rectificación, cancelación y oposición de tus datos en cualquier momento.
          </p>
        </div>

        {/* Cambiar contraseña */}
        <button
          onClick={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user?.email) return;
            await supabase.auth.resetPasswordForEmail(user.email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            toast.success('Revisa tu email para cambiar la contraseña');
          }}
          className="w-full text-left p-4 rounded-2xl border border-gray-100 dark:border-white/8 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all group"
        >
          <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] group-hover:text-indigo-600 transition-colors">
            Cambiar contraseña →
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Te enviaremos un email con el enlace de reseteo</p>
        </button>
      </div>
    </section>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export function Profile() {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user;
      if (!u) { setLoading(false); return; }
      setUser(u);
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, tier, tier_expires_at, kyc_status, rut_hash, training_consent, created_at')
        .eq('id', u.id)
        .single();
      setProfile(data as ProfileRow | null);
      setLoading(false);
    }
    load();
  }, []);

  // Deep-link: si la URL trae #founder-profile (CTA desde el reporte), hace
  // scroll a la sección una vez que el contenido terminó de cargar.
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [loading]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0A0A0F]">
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 space-y-4">

        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F0EFF8]">Mi Perfil</h1>
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-1">
            Gestiona tu cuenta, experiencia como fundador y preferencias.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[200, 280, 160, 140].map((h, i) => (
              <div key={i} style={{ height: h }} className="rounded-3xl bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5 animate-pulse" />
            ))}
          </div>
        ) : user ? (
          <>
            <AccountSection user={user} profile={profile} />

            <SubscriptionSection profile={profile} />

            <ActivitySection userId={user.id} />

            {/* Perfil del Fundador */}
            <section id="founder-profile" className="scroll-mt-24 bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Perfil del Fundador</h2>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-1">
                  Tu experiencia enriquece el análisis de Founder-Market Fit en cada validación.
                </p>
              </div>
              <FounderProfileTab />
            </section>

            <PrivacySection userId={user.id} initialConsent={profile?.training_consent ?? null} />
          </>
        ) : (
          <p className="text-center text-gray-400 py-20">Sesión no encontrada</p>
        )}

      </main>
    </div>
  );
}
