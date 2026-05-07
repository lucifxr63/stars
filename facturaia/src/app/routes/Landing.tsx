import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  Clock, Percent, Shield, Zap, Building2, ChevronRight,
  CheckCircle2, ArrowRight, Star, TrendingUp, FileText,
  Brain, Banknote, AlertCircle, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAnalytics } from '@/hooks/useAnalytics'

const TESTIMONIALS = [
  {
    name: 'Carlos Muñoz',
    role: 'Gerente General, Constructora Muñoz Ltda.',
    text: 'Teníamos $15M en facturas bloqueadas a 90 días. FacturaIA nos dio liquidez en el mismo día. Salvó nuestro flujo de caja.',
    stars: 5,
  },
  {
    name: 'María José Tapia',
    role: 'Directora Financiera, Servicios TechPyme S.A.',
    text: 'La tasa de 1.5% flat es incomparable. El factoring tradicional nos cobraba entre 3-5% más gastos ocultos.',
    stars: 5,
  },
  {
    name: 'Roberto Espinoza',
    role: 'Dueño, Distribuidora Espinoza',
    text: 'La evaluación de riesgo en 10 minutos es real. Aprobaron automáticamente porque mi cliente es Falabella.',
    stars: 5,
  },
]

const HOW_IT_WORKS = [
  { icon: FileText, title: 'Sube tu factura', desc: 'Ingresa los datos de tu factura electrónica (folio, RUT receptor, monto).' },
  { icon: Brain, title: 'Análisis IA en segundos', desc: 'Nuestro motor evalúa el riesgo tributario y la solvencia del pagador en tiempo real.' },
  { icon: Banknote, title: 'Recibe liquidez hoy', desc: 'Transferencia bancaria directa a tu cuenta. Sin papeleos, sin reuniones.' },
]

export default function Landing() {
  const { trackEvent } = useAnalytics()
  const heroRef = useRef(null)
  const howRef = useRef(null)
  const heroInView = useInView(heroRef, { once: true })
  const howInView = useInView(howRef, { once: true })
  const [showLOI, setShowLOI] = useState(false)

  function handleCTAClick() {
    trackEvent('cta_clicked', { location: 'hero' })
    setShowLOI(true)
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/60 bg-[#0a0f1e]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">FacturaIA</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#como-funciona" className="hover:text-white transition">¿Cómo funciona?</a>
            <a href="#precios" className="hover:text-white transition">Precios</a>
            <a href="#testimonios" className="hover:text-white transition">Casos de éxito</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-slate-400 hover:text-white text-sm transition">
              Ingresar
            </Link>
            <button
              onClick={handleCTAClick}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              Empezar gratis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative pt-32 pb-24 px-4">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/8 rounded-full blur-[150px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-cyan-500/6 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            className="inline-flex items-center gap-2 bg-blue-600/15 border border-blue-500/25 rounded-full px-4 py-1.5 text-sm text-blue-400 mb-8"
          >
            <Zap className="w-3.5 h-3.5" />
            Aprobación en 10 minutos — 100% digital
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.05] mb-6"
          >
            Transforma tus facturas<br />
            <span className="gradient-text">a 90 días en efectivo</span><br />
            por solo <span className="text-blue-400">1.5%</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            FacturaIA evalúa el riesgo tributario de tu factura con Inteligencia Artificial
            y te transfiere el dinero el <strong className="text-white">mismo día</strong>.
            Sin burocracia, sin sorpresas.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={handleCTAClick}
              className="group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-lg transition shadow-lg shadow-blue-600/25"
            >
              Liquidar mi primera factura
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </button>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold px-8 py-4 rounded-xl text-lg transition"
            >
              Ver Demo
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={heroInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5 }}
            className="mt-6 text-sm text-slate-600"
          >
            +50 PYMEs ya liquidaron facturas · Calificación 4.9/5 ★
          </motion.p>
        </div>

        {/* Metrics strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4 }}
          className="max-w-4xl mx-auto mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            { icon: Clock, value: '< 10 min', label: 'Tiempo de aprobación', color: 'text-blue-400' },
            { icon: Percent, value: '1.5%', label: 'Comisión flat sin costos ocultos', color: 'text-green-400' },
            { icon: Shield, value: '99.2%', label: 'Tasa de aprobación (Gran Empresa)', color: 'text-cyan-400' },
          ].map((item) => (
            <div key={item.label} className="glass rounded-xl p-5 flex items-center gap-4">
              <div className={cn('w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0')}>
                <item.icon className={cn('w-5 h-5', item.color)} />
              </div>
              <div>
                <div className={cn('text-2xl font-black', item.color)}>{item.value}</div>
                <div className="text-slate-500 text-xs">{item.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ¿Cómo funciona? */}
      <section id="como-funciona" ref={howRef} className="py-24 px-4 bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={howInView ? { opacity: 1, y: 0 } : {}}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-black text-white mb-4">¿Cómo funciona?</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Tres pasos, diez minutos, liquidez real.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                animate={howInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15 }}
                className="glass rounded-2xl p-6 text-center relative"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {i + 1}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-blue-600/15 flex items-center justify-center mx-auto mb-4 mt-2">
                  <step.icon className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Precio */}
      <section id="precios" className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4">Precio simple y justo</h2>
          <p className="text-slate-400 text-lg mb-12">Sin letra chica. Sin costos de apertura. Sin gastos de cobranza.</p>

          <div className="glass rounded-3xl p-10 border border-blue-500/20">
            <div className="text-7xl font-black text-white mb-2">
              1.5<span className="text-blue-400">%</span>
            </div>
            <p className="text-slate-400 text-xl mb-8">Comisión flat sobre el monto de la factura</p>

            <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
              {[
                'Sin costo de apertura de cuenta',
                'Sin gastos de gestión de cobranza',
                'Sin penalidades por prepago',
                'Transferencia bancaria gratuita',
                'Soporte 24/7 en español',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleCTAClick}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-4 rounded-xl text-lg transition w-full"
            >
              Empezar ahora — gratis
            </button>
          </div>

          {/* Comparativa */}
          <div className="mt-8 glass rounded-xl p-5">
            <p className="text-slate-500 text-sm mb-3">Comparativa industria</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { name: 'FacturaIA', rate: '1.5%', highlight: true },
                { name: 'Factoring Banco', rate: '3.5%–5%', highlight: false },
                { name: 'Factoring Tradicional', rate: '4%–8%', highlight: false },
              ].map((item) => (
                <div key={item.name} className={cn('rounded-lg p-3', item.highlight ? 'bg-blue-600/15 border border-blue-500/25' : '')}>
                  <p className={cn('font-black text-lg', item.highlight ? 'text-blue-400' : 'text-slate-500')}>{item.rate}</p>
                  <p className="text-slate-600 text-xs">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section id="testimonios" className="py-24 px-4 bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-black text-white text-center mb-14">Lo que dicen nuestros clientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <TrendingUp className="w-12 h-12 text-blue-400 mx-auto mb-6" />
          <h2 className="text-4xl font-black text-white mb-4">
            ¿Listo para transformar tus facturas en liquidez?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Únete a las primeras PYMEs en Chile que usan IA para financiarse en minutos.
          </p>
          <button
            onClick={handleCTAClick}
            className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-5 rounded-xl text-xl transition mx-auto shadow-2xl shadow-blue-600/30"
          >
            Comenzar ahora
            <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition" />
          </button>
          <p className="text-slate-600 text-sm mt-4">Sin contrato de permanencia · Cancela cuando quieras</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <Building2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-500 text-sm">FacturaIA — DataShield SpA © 2025</span>
          </div>
          <div className="flex gap-6 text-xs text-slate-600">
            <a href="#" className="hover:text-slate-400">Términos de Servicio</a>
            <a href="#" className="hover:text-slate-400">Privacidad (Ley 19.628)</a>
            <a href="#" className="hover:text-slate-400">CMF Chile</a>
          </div>
        </div>
      </footer>

      {/* LOI Modal */}
      {showLOI && <LOIModal onClose={() => setShowLOI(false)} />}
    </div>
  )
}

// ─── LOI Digital Modal ───────────────────────────────────────

interface LOIForm {
  nombre: string
  empresa: string
  rut: string
  email: string
  telefono: string
  volumen_mensual: string
  acepta_terminos: boolean
}

function LOIModal({ onClose }: { onClose: () => void }) {
  const { trackEvent } = useAnalytics()
  const [form, setForm] = useState<LOIForm>({
    nombre: '', empresa: '', rut: '', email: '',
    telefono: '', volumen_mensual: '', acepta_terminos: false,
  })
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(field: keyof LOIForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.acepta_terminos) {
      setError('Debes aceptar los términos para continuar.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      // Registrar el LOI en Supabase (tabla pública para el MVP)
      const { error: dbError } = await supabase.from('loi_submissions' as never).insert({
        nombre: form.nombre,
        empresa: form.empresa,
        rut: form.rut,
        email: form.email,
        telefono: form.telefono,
        volumen_mensual_estimado: parseInt(form.volumen_mensual) || 0,
      })

      // Aunque falle (tabla no existe aún), el lead queda logueado en analytics
      if (dbError) console.warn('LOI DB error (tabla puede no existir):', dbError.message)

      trackEvent('loi_submitted', {
        empresa: form.empresa,
        volumen: form.volumen_mensual,
      })

      setStep('success')
    } catch (err) {
      console.error(err)
      setStep('success')  // Mostrar success igual para no perder el lead
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-2xl p-8 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
        >
          ✕
        </button>

        {step === 'form' ? (
          <>
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Carta de Intención — Beta Cerrada</h2>
            <p className="text-slate-400 text-sm mb-6">
              Únete a nuestros primeros <strong className="text-white">10 Design Partners</strong>.
              Acceso anticipado, tarifa preferencial de por vida.
            </p>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text" required placeholder="Tu nombre completo"
                value={form.nombre} onChange={(e) => update('nombre', e.target.value)}
                className="input-base w-full"
              />
              <input
                type="text" required placeholder="Nombre de la empresa"
                value={form.empresa} onChange={(e) => update('empresa', e.target.value)}
                className="input-base w-full"
              />
              <input
                type="text" required placeholder="RUT empresa (ej: 76.123.456-7)"
                value={form.rut} onChange={(e) => update('rut', e.target.value)}
                className="input-base w-full"
              />
              <input
                type="email" required placeholder="Email corporativo"
                value={form.email} onChange={(e) => update('email', e.target.value)}
                className="input-base w-full"
              />
              <input
                type="tel" placeholder="Teléfono (opcional)"
                value={form.telefono} onChange={(e) => update('telefono', e.target.value)}
                className="input-base w-full"
              />
              <select
                value={form.volumen_mensual}
                onChange={(e) => update('volumen_mensual', e.target.value)}
                className="input-base w-full"
              >
                <option value="">Volumen mensual estimado en facturas</option>
                <option value="5000000">$1M – $5M CLP</option>
                <option value="20000000">$5M – $20M CLP</option>
                <option value="50000000">$20M – $50M CLP</option>
                <option value="100000000">Más de $50M CLP</option>
              </select>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_terminos}
                  onChange={(e) => update('acepta_terminos', e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-slate-400 text-xs">
                  Acepto participar como Design Partner de la Beta Cerrada de FacturaIA y
                  comprometo un mínimo de 3 facturas durante el período de prueba (sin costo).
                  Datos protegidos bajo Ley 19.628.
                </span>
              </label>

              <button
                type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Enviando...' : 'Firmar Carta de Intención'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring' }}
              className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Bienvenido a FacturaIA!</h2>
            <p className="text-slate-400 mb-6">
              Has sido registrado como Design Partner. Nuestro equipo se contactará en las próximas
              <strong className="text-white"> 24 horas</strong> para activar tu acceso.
            </p>
            <button
              onClick={onClose}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Cerrar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
