import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, LogOut, Plus, FileText,
  TrendingUp, Clock, CheckCircle2, XCircle,
  ChevronRight, Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { FacturaWizard } from '@/components/wizard/FacturaWizard'
import { formatCLP, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type Company = Database['public']['Tables']['companies']['Row']
type Invoice = Database['public']['Tables']['invoices']['Row']

export default function Dashboard() {
  const { user, setSession } = useAuthStore()
  const [company, setCompany] = useState<Company | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [showWizard, setShowWizard] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    setLoadingData(true)
    try {
      const { data: co } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()

      if (!co) {
        setShowOnboarding(true)
      } else {
        setCompany(co)
        const { data: inv } = await supabase
          .from('invoices')
          .select('*')
          .eq('company_id', co.id)
          .order('created_at', { ascending: false })
          .limit(20)
        setInvoices(inv ?? [])
      }
    } finally {
      setLoadingData(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setSession(null)
  }

  // Métricas rápidas
  const totalLiquidado = invoices
    .filter((i) => i.estado === 'liquidada')
    .reduce((sum, i) => sum + i.monto_total, 0)
  const facturasPendientes = invoices.filter((i) => i.estado === 'pendiente' || i.estado === 'en_evaluacion').length
  const facturasAprobadas = invoices.filter((i) => i.estado === 'aprobada' || i.estado === 'liquidada').length

  if (loadingData) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0d1426]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">FacturaIA</span>
            {company && (
              <>
                <span className="text-slate-700">/</span>
                <span className="text-slate-400 text-sm">{company.razon_social}</span>
              </>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Onboarding: registrar empresa */}
        {showOnboarding && (
          <OnboardingForm userId={user.id} onComplete={(co) => { setCompany(co); setShowOnboarding(false) }} />
        )}

        {company && !showWizard && (
          <>
            {/* Bienvenida + CTA */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-white">Bienvenido, {company.razon_social}</h1>
                <p className="text-slate-400 text-sm mt-1">RUT: {company.rut}</p>
              </div>
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
                Liquidar Factura
              </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <MetricCard
                label="Total Liquidado"
                value={formatCLP(totalLiquidado)}
                icon={Wallet}
                color="text-green-400"
                bg="bg-green-500/10"
              />
              <MetricCard
                label="Facturas Aprobadas"
                value={String(facturasAprobadas)}
                icon={CheckCircle2}
                color="text-blue-400"
                bg="bg-blue-500/10"
              />
              <MetricCard
                label="En Evaluación"
                value={String(facturasPendientes)}
                icon={Clock}
                color="text-yellow-400"
                bg="bg-yellow-500/10"
              />
            </div>

            {/* Lista de facturas */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Mis Facturas</h2>
              </div>
              {invoices.length === 0 ? (
                <div className="p-12 flex flex-col items-center text-center">
                  <FileText className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="text-slate-500">Aún no tienes facturas.</p>
                  <button
                    onClick={() => setShowWizard(true)}
                    className="mt-3 text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                  >
                    Sube tu primera factura <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {invoices.map((inv) => (
                    <InvoiceRow key={inv.id} invoice={inv} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Wizard */}
        {company && showWizard && (
          <div>
            <button
              onClick={() => setShowWizard(false)}
              className="text-slate-400 hover:text-slate-300 text-sm mb-6 flex items-center gap-1"
            >
              ← Volver al dashboard
            </button>
            <h2 className="text-2xl font-bold text-white mb-6">Nueva Solicitud de Liquidez</h2>
            <FacturaWizard
              companyId={company.id}
              rutEmisor={company.rut}
              onComplete={() => { setShowWizard(false); loadData() }}
            />
          </div>
        )}
      </main>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: string; icon: React.ElementType; color: string; bg: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm">{label}</p>
          <p className={cn('text-2xl font-black mt-1', color)}>{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bg)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
      </div>
    </motion.div>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const statusConfig: Record<Invoice['estado'], { label: string; color: string; icon: React.ElementType }> = {
    pendiente: { label: 'Pendiente', color: 'text-slate-400', icon: Clock },
    en_evaluacion: { label: 'En Evaluación', color: 'text-yellow-400', icon: Clock },
    aprobada: { label: 'Aprobada', color: 'text-blue-400', icon: CheckCircle2 },
    rechazada: { label: 'Rechazada', color: 'text-red-400', icon: XCircle },
    liquidada: { label: 'Liquidada', color: 'text-green-400', icon: CheckCircle2 },
  }
  const { label, color, icon: Icon } = statusConfig[invoice.estado]

  return (
    <div className="flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
          <FileText className="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <p className="text-white text-sm font-medium">Folio #{invoice.folio}</p>
          <p className="text-slate-500 text-xs">{invoice.razon_social_receptor} · {formatDate(invoice.fecha_emision)}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-white font-semibold text-sm">{formatCLP(invoice.monto_total)}</p>
          <p className="text-slate-500 text-xs">Vence: {formatDate(invoice.fecha_vencimiento)}</p>
        </div>
        <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
      </div>
    </div>
  )
}

function OnboardingForm({ userId, onComplete }: { userId: string; onComplete: (co: Company) => void }) {
  const [rut, setRut] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [giro, setGiro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.from('companies').insert({
      user_id: userId,
      rut: rut.replace(/[^0-9kK]/g, ''),
      razon_social: razonSocial,
      giro,
    }).select().single()
    setLoading(false)
    if (!error && data) onComplete(data)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto glass rounded-2xl p-8"
    >
      <Building2 className="w-10 h-10 text-blue-400 mb-4" />
      <h2 className="text-xl font-bold text-white mb-1">Registra tu empresa</h2>
      <p className="text-slate-400 text-sm mb-6">Necesitamos estos datos para verificar tu identidad tributaria</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">RUT Empresa *</label>
          <input
            type="text" value={rut} onChange={(e) => setRut(e.target.value)}
            placeholder="12.345.678-9" required className="input-base w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Razón Social *</label>
          <input
            type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)}
            placeholder="Mi Empresa S.A." required className="input-base w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Giro Comercial</label>
          <input
            type="text" value={giro} onChange={(e) => setGiro(e.target.value)}
            placeholder="ej: Construcción y obras civiles" className="input-base w-full"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Registrando...' : 'Registrar Empresa'}
        </button>
      </form>
    </motion.div>
  )
}
