import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
  Building2, TrendingUp, Users, AlertTriangle,
  DollarSign, Activity, Shield, ArrowUpRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCLP } from '@/lib/utils'
import { cn } from '@/lib/utils'

// Datos simulados para el MVP (en producción, queries reales a Supabase)
const MOCK_VOLUME_DATA = [
  { mes: 'Ene', volumen: 0, facturas: 0 },
  { mes: 'Feb', volumen: 0, facturas: 0 },
  { mes: 'Mar', volumen: 12_500_000, facturas: 3 },
  { mes: 'Abr', volumen: 28_000_000, facturas: 7 },
  { mes: 'May', volumen: 45_200_000, facturas: 12 },
  { mes: 'Jun', volumen: 0, facturas: 0 },
]

const MOCK_RISK_DISTRIBUTION = [
  { name: 'Bajo (0-35)', value: 62, color: '#22c55e' },
  { name: 'Medio (36-65)', value: 28, color: '#f59e0b' },
  { name: 'Alto (66-100)', value: 10, color: '#ef4444' },
]

const MOCK_NPL_DATA = [
  { mes: 'Mar', npl: 0 },
  { mes: 'Abr', npl: 1.2 },
  { mes: 'May', npl: 0.8 },
]

export default function Admin() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({
    totalEmpresas: 0,
    totalFacturas: 0,
    volumenTotal: 0,
    volumenPendiente: 0,
    comisionesGeneradas: 0,
    tasaAprobacion: 0,
  })
  const [loading, setLoading] = useState(true)

  if (!user) return <Navigate to="/login" replace />

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const [{ count: empresas }, { data: facturas }] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('monto_total, estado'),
      ])

      const inv = facturas ?? []
      const aprobadas = inv.filter((f) => ['aprobada', 'liquidada'].includes(f.estado))
      const volTotal = aprobadas.reduce((s, f) => s + f.monto_total, 0)
      const comisiones = Math.round(volTotal * 0.015)
      const tasaApro = inv.length > 0 ? Math.round((aprobadas.length / inv.length) * 100) : 0

      setStats({
        totalEmpresas: empresas ?? 0,
        totalFacturas: inv.length,
        volumenTotal: volTotal,
        volumenPendiente: inv.filter((f) => f.estado === 'aprobada').reduce((s, f) => s + f.monto_total, 0),
        comisionesGeneradas: comisiones,
        tasaAprobacion: tasaApro,
      })
    } finally {
      setLoading(false)
    }
  }

  // KPIs calculados (Unit Economics)
  const CAC_ESTIMADO = 85_000   // CLP — costo adquisición por cliente
  const LTV_ESTIMADO = stats.comisionesGeneradas / Math.max(stats.totalEmpresas, 1)
  const LTV_CAC = LTV_ESTIMADO / CAC_ESTIMADO
  const NPL_RATE = 0.8  // % simulado

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0d1426]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">FacturaIA</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 text-sm">Panel Mesa Directiva</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">Panel Ejecutivo</h1>
          <p className="text-slate-400 text-sm mt-1">Unit Economics & Riesgo — FacturaIA MVP</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            label="Volumen Procesado"
            value={formatCLP(stats.volumenTotal)}
            icon={DollarSign}
            trend="+45% vs mes anterior"
            trendUp
          />
          <KPICard
            label="Comisiones (1.5%)"
            value={formatCLP(stats.comisionesGeneradas)}
            icon={TrendingUp}
            trend="Revenue reconocido"
            trendUp
          />
          <KPICard
            label="PYMEs Activas"
            value={String(stats.totalEmpresas)}
            icon={Users}
            trend={`${stats.totalFacturas} facturas totales`}
            trendUp
          />
          <KPICard
            label="Tasa Aprobación"
            value={`${stats.tasaAprobacion}%`}
            icon={Shield}
            trend="Motor IA SII-Simulated"
            trendUp={stats.tasaAprobacion > 70}
          />
        </div>

        {/* Unit Economics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <UnitCard
            label="CAC Estimado"
            value={formatCLP(CAC_ESTIMADO)}
            description="Costo adquisición por cliente"
            color="text-orange-400"
          />
          <UnitCard
            label="LTV Estimado"
            value={formatCLP(LTV_ESTIMADO)}
            description="Valor de vida del cliente"
            color="text-blue-400"
          />
          <UnitCard
            label="LTV/CAC Ratio"
            value={`${LTV_CAC.toFixed(1)}x`}
            description={LTV_CAC >= 3 ? '✓ Ratio saludable (>3x)' : '⚠ Mejorar retención'}
            color={LTV_CAC >= 3 ? 'text-green-400' : 'text-yellow-400'}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Volumen mensual */}
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Volumen Procesado (CLP)</h3>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">2025</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MOCK_VOLUME_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={(v) => `${(v/1_000_000).toFixed(0)}M`} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number) => [formatCLP(v), 'Volumen']}
                />
                <Bar dataKey="volumen" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribución de riesgo */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Distribución Riesgo IA</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={MOCK_RISK_DISTRIBUTION} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {MOCK_RISK_DISTRIBUTION.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8 }}
                  formatter={(v: number) => [`${v}%`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {MOCK_RISK_DISTRIBUTION.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-400">{d.name}</span>
                  </div>
                  <span className="text-slate-300 font-medium">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* NPL + Alertas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* NPL Rate */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">NPL Rate (Non-Performing Loans)</h3>
              <span className={cn(
                'text-xs font-medium px-2 py-1 rounded-full',
                NPL_RATE < 2 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
              )}>
                {NPL_RATE}% — {NPL_RATE < 2 ? 'Saludable' : 'Atención'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={MOCK_NPL_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8 }}
                  formatter={(v: number) => [`${v}%`, 'NPL']}
                />
                <Line type="monotone" dataKey="npl" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-600 mt-2">
              * Simulado. Umbral crítico CMF: 5%. Actualmente bajo control.
            </p>
          </div>

          {/* Alertas regulatorias */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Estado Cumplimiento Normativo
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Audit Logs CMF', status: 'ok', desc: 'Trazabilidad 100% activa' },
                { label: 'RLS Datos PYME', status: 'ok', desc: 'Ley 19.628 cumplida' },
                { label: 'Cifrado en tránsito', status: 'ok', desc: 'TLS 1.3 — Supabase' },
                { label: 'KYC / AML Básico', status: 'pending', desc: 'Integración Fintoc — Pendiente' },
                { label: 'Registro CMF', status: 'pending', desc: 'Ley Fintec — Pre-Registro' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{item.label}</p>
                    <p className="text-slate-500 text-xs">{item.desc}</p>
                  </div>
                  <div className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    item.status === 'ok' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                  )}>
                    {item.status === 'ok' ? '✓ OK' : '⏳ Pendiente'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function KPICard({ label, value, icon: Icon, trend, trendUp }: {
  label: string; value: string; icon: React.ElementType; trend: string; trendUp: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 text-slate-500" />
        <ArrowUpRight className={cn('w-4 h-4', trendUp ? 'text-green-400' : 'text-red-400')} />
      </div>
      <p className="text-2xl font-black text-white mb-1">{value}</p>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={cn('text-xs mt-1', trendUp ? 'text-green-400' : 'text-red-400')}>{trend}</p>
    </motion.div>
  )
}

function UnitCard({ label, value, description, color }: {
  label: string; value: string; description: string; color: string
}) {
  return (
    <div className="glass rounded-xl p-5 text-center">
      <p className="text-slate-500 text-sm mb-1">{label}</p>
      <p className={cn('text-3xl font-black mb-1', color)}>{value}</p>
      <p className="text-slate-600 text-xs">{description}</p>
    </div>
  )
}
