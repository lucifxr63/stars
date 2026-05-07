import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatRUT(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '')
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv.toUpperCase()}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getRiskColor(score: number): string {
  if (score <= 30) return '#22c55e'
  if (score <= 60) return '#f59e0b'
  return '#ef4444'
}

export function getRiskLabel(score: number): string {
  if (score <= 30) return 'Bajo'
  if (score <= 60) return 'Medio'
  return 'Alto'
}

// Commission: 1.5% flat
export const COMMISSION_RATE = 0.015

export function calcularLiquidez(montoTotal: number) {
  const comision = montoTotal * COMMISSION_RATE
  const montoATransferir = montoTotal - comision
  return { comision, montoATransferir }
}
