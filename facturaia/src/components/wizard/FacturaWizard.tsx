import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Brain, Banknote, CheckCircle2,
  FileText, AlertCircle, Loader2, X,
  TrendingUp, TrendingDown, Shield,
} from 'lucide-react'
import { useRiskEvaluator } from '@/hooks/useRiskEvaluator'
import { supabase } from '@/lib/supabase'
import { formatCLP, formatRUT, calcularLiquidez, getRiskColor, getRiskLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface WizardProps {
  companyId: string
  rutEmisor: string
  onComplete?: () => void
}

type WizardStep = 1 | 2 | 3 | 4

const STEPS = [
  { id: 1, label: 'Sube Factura', icon: Upload },
  { id: 2, label: 'Análisis IA', icon: Brain },
  { id: 3, label: 'Oferta', icon: Banknote },
  { id: 4, label: 'Confirmado', icon: CheckCircle2 },
]

interface InvoiceForm {
  folio: string
  rut_receptor: string
  razon_social_receptor: string
  monto_neto: string
  monto_iva: string
  fecha_emision: string
  fecha_vencimiento: string
}

const INITIAL_FORM: InvoiceForm = {
  folio: '',
  rut_receptor: '',
  razon_social_receptor: '',
  monto_neto: '',
  monto_iva: '',
  fecha_emision: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '',
}

export function FacturaWizard({ companyId, rutEmisor, onComplete }: WizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [form, setForm] = useState<InvoiceForm>(INITIAL_FORM)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [transferConfirmed, setTransferConfirmed] = useState(false)
  const { evaluate, assessment, loading: evaluating, error: evalError } = useRiskEvaluator()

  const montoNeto = parseInt(form.monto_neto) || 0
  const montoIva = parseInt(form.monto_iva) || Math.round(montoNeto * 0.19)
  const montoTotal = montoNeto + montoIva
  const { comision, montoATransferir } = calcularLiquidez(montoTotal)

  function updateField(field: keyof InvoiceForm, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }
      // Auto-calcular IVA al cambiar monto neto
      if (field === 'monto_neto') {
        const neto = parseInt(value) || 0
        updated.monto_iva = String(Math.round(neto * 0.19))
      }
      return updated
    })
  }

  async function handleSubmitFactura(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { data, error } = await supabase.from('invoices').insert({
        company_id: companyId,
        folio: form.folio,
        rut_emisor: rutEmisor,
        rut_receptor: form.rut_receptor.replace(/[^0-9kK]/g, ''),
        razon_social_receptor: form.razon_social_receptor,
        monto_neto: montoNeto,
        monto_iva: montoIva,
        monto_total: montoTotal,
        fecha_emision: form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento,
        estado: 'pendiente',
      }).select().single()

      if (error) throw error
      setInvoiceId(data.id)
      setStep(2)

      // Disparar evaluación IA
      const result = await evaluate({
        invoice_id: data.id,
        rut_emisor: rutEmisor,
        rut_receptor: form.rut_receptor.replace(/[^0-9kK]/g, ''),
        razon_social_receptor: form.razon_social_receptor,
        monto_total: montoTotal,
        fecha_emision: form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento,
      })

      if (result) {
        setTimeout(() => setStep(3), 1000)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la factura')
    }
  }

  async function handleAceptarOferta() {
    if (!invoiceId) return
    try {
      await supabase.from('invoices').update({ estado: 'liquidada' }).eq('id', invoiceId)
      setTransferConfirmed(true)
      setStep(4)
      onComplete?.()
    } catch {
      toast.error('Error al confirmar la transferencia')
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Steps indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, idx) => {
          const Icon = s.icon
          const isActive = step === s.id
          const isDone = step > s.id
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300',
                  isDone ? 'bg-green-500' : isActive ? 'bg-blue-600' : 'bg-slate-800 border border-slate-700'
                )}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className={cn(
                  'text-xs whitespace-nowrap',
                  isActive ? 'text-blue-400' : isDone ? 'text-green-400' : 'text-slate-600'
                )}>{s.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-px mx-2 mt-[-16px] transition-colors duration-500',
                  step > s.id ? 'bg-green-500' : 'bg-slate-700'
                )} />
              )}
            </div>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* PASO 1: Subir Factura */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-2xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-1">Datos de la Factura</h2>
            <p className="text-slate-400 text-sm mb-6">Ingresa los datos de la factura que deseas liquidar</p>

            <form onSubmit={handleSubmitFactura} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="N° Folio" required>
                  <input
                    type="text"
                    value={form.folio}
                    onChange={(e) => updateField('folio', e.target.value)}
                    placeholder="ej: 12345"
                    required
                    className="input-base"
                  />
                </FormField>
                <FormField label="RUT Receptor" required>
                  <input
                    type="text"
                    value={form.rut_receptor}
                    onChange={(e) => updateField('rut_receptor', e.target.value)}
                    placeholder="ej: 96.806.980-2"
                    required
                    className="input-base"
                  />
                </FormField>
              </div>

              <FormField label="Razón Social Receptor" required>
                <input
                  type="text"
                  value={form.razon_social_receptor}
                  onChange={(e) => updateField('razon_social_receptor', e.target.value)}
                  placeholder="ej: Falabella Retail S.A."
                  required
                  className="input-base"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Monto Neto (CLP)" required>
                  <input
                    type="number"
                    value={form.monto_neto}
                    onChange={(e) => updateField('monto_neto', e.target.value)}
                    placeholder="ej: 1000000"
                    required
                    min="1"
                    className="input-base"
                  />
                </FormField>
                <FormField label="IVA (19% auto-calculado)">
                  <input
                    type="number"
                    value={form.monto_iva}
                    onChange={(e) => updateField('monto_iva', e.target.value)}
                    className="input-base opacity-70"
                  />
                </FormField>
              </div>

              {montoTotal > 0 && (
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Monto Total Factura</span>
                  <span className="text-white font-bold text-lg">{formatCLP(montoTotal)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Fecha Emisión" required>
                  <input
                    type="date"
                    value={form.fecha_emision}
                    onChange={(e) => updateField('fecha_emision', e.target.value)}
                    required
                    className="input-base"
                  />
                </FormField>
                <FormField label="Fecha Vencimiento" required>
                  <input
                    type="date"
                    value={form.fecha_vencimiento}
                    onChange={(e) => updateField('fecha_vencimiento', e.target.value)}
                    required
                    min={form.fecha_emision}
                    className="input-base"
                  />
                </FormField>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Enviar a Análisis IA
              </button>
            </form>
          </motion.div>
        )}

        {/* PASO 2: Análisis IA */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-2xl p-8 flex flex-col items-center text-center"
          >
            {evaluating ? (
              <>
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <Brain className="w-10 h-10 text-blue-400" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/40 animate-ping" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Analizando factura...</h2>
                <p className="text-slate-400 mb-6">Nuestro motor IA está evaluando el riesgo tributario en tiempo real</p>

                {/* Skeleton loader pasos IA */}
                <div className="w-full space-y-3">
                  {['Verificando RUT en SII...', 'Calculando Tax Risk Score...', 'Consultando historial pagador...', 'Generando recomendación...'].map((label, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.8 }}
                      className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3"
                    >
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                      <span className="text-slate-300 text-sm">{label}</span>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : evalError ? (
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <h2 className="text-xl font-bold text-white">Error en la evaluación</h2>
                <p className="text-slate-400 text-sm">{evalError}</p>
                <button onClick={() => setStep(1)} className="text-blue-400 hover:text-blue-300 text-sm">
                  ← Volver e intentar de nuevo
                </button>
              </div>
            ) : null}
          </motion.div>
        )}

        {/* PASO 3: Oferta de Liquidez */}
        {step === 3 && assessment && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* Risk Score Card */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Resultado del Análisis IA</h2>
                  <p className="text-slate-400 text-sm">Tax Risk Score</p>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" style={{ color: getRiskColor(assessment.tax_risk_score) }} />
                  <span className="text-2xl font-black" style={{ color: getRiskColor(assessment.tax_risk_score) }}>
                    {assessment.tax_risk_score}/100
                  </span>
                </div>
              </div>

              {/* Barra de riesgo */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${assessment.tax_risk_score}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: getRiskColor(assessment.tax_risk_score) }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Bajo riesgo</span>
                <span className="font-medium" style={{ color: getRiskColor(assessment.tax_risk_score) }}>
                  Riesgo {getRiskLabel(assessment.tax_risk_score)}
                </span>
                <span>Alto riesgo</span>
              </div>

              <div className={cn(
                'mt-4 rounded-lg p-3 text-sm',
                assessment.recomendacion === 'aprobar' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                assessment.recomendacion === 'revisar' ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400' :
                'bg-red-500/10 border border-red-500/20 text-red-400'
              )}>
                {assessment.razon}
              </div>

              {assessment.aprobacion_automatica && (
                <div className="mt-2 flex items-center gap-2 text-xs text-blue-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aprobación automática por Gran Empresa verificada
                </div>
              )}
            </div>

            {/* Desglose financiero */}
            {assessment.recomendacion !== 'rechazar' && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Oferta de Liquidez</h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Monto Factura
                    </span>
                    <span className="text-white font-semibold">{formatCLP(montoTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-slate-800">
                    <span className="text-slate-400 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-orange-400" />
                      Comisión Flat (1.5%)
                    </span>
                    <span className="text-orange-400 font-semibold">- {formatCLP(assessment.comision_flat)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-slate-700 bg-green-500/5 rounded-lg px-3">
                    <span className="text-white font-bold text-lg">Recibirás HOY</span>
                    <span className="text-green-400 font-black text-2xl">{formatCLP(assessment.monto_a_transferir)}</span>
                  </div>
                </div>

                <p className="text-slate-500 text-xs mt-3">
                  * Transferencia bancaria en un plazo máximo de 2 horas hábiles. Sin costos ocultos.
                </p>

                <button
                  onClick={handleAceptarOferta}
                  className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-lg"
                >
                  <Banknote className="w-5 h-5" />
                  Aceptar y Recibir {formatCLP(assessment.monto_a_transferir)}
                </button>
              </div>
            )}

            {assessment.recomendacion === 'rechazar' && (
              <div className="glass rounded-2xl p-6 text-center">
                <X className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Factura No Aprobada</h3>
                <p className="text-slate-400 text-sm mb-4">
                  El riesgo tributario detectado supera nuestros límites operativos.
                  Puedes contactar a nuestro equipo para una revisión manual.
                </p>
                <button
                  onClick={() => { setStep(1); setForm(INITIAL_FORM) }}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  ← Subir otra factura
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* PASO 4: Confirmado */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4"
            >
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Liquidez Aprobada!</h2>
            {assessment && (
              <p className="text-3xl font-black text-green-400 mb-2">
                {formatCLP(assessment.monto_a_transferir)}
              </p>
            )}
            <p className="text-slate-400 text-sm mb-6">
              La transferencia será procesada en un máximo de 2 horas hábiles a tu cuenta bancaria registrada.
            </p>
            <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-500 w-full">
              ID Transacción: {invoiceId?.slice(0, 8).toUpperCase() ?? 'N/A'}
            </div>
            <button
              onClick={() => { setStep(1); setForm(INITIAL_FORM) }}
              className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
            >
              + Liquidar otra factura
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
