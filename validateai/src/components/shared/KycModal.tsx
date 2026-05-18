import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface KycModalProps {
  onSuccess: () => void;
}

// Simple RUT formatter
function formatRut(value: string) {
  const clean = value.replace(/[^0-9kK]/g, '');
  if (clean.length === 0) return '';
  if (clean.length <= 1) return clean;
  
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  
  let formattedBody = '';
  for (let i = body.length - 1, j = 0; i >= 0; i--, j++) {
    formattedBody = body[i] + formattedBody;
    if (j % 3 === 2 && i !== 0) formattedBody = '.' + formattedBody;
  }
  
  return `${formattedBody}-${dv}`;
}

export function KycModal({ onSuccess }: KycModalProps) {
  const [rut, setRut] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No estás autenticado.');

      const cleanRut = rut.replace(/[^0-9kK-]/g, '');

      const response = await fetch('https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/validate-rut', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ rut: cleanRut })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'RUT inválido o error de conexión');
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error validando identidad.');
    } finally {
      setLoading(false);
    }
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 dark:border-white/10 relative">
        <div className="h-2 w-full bg-gradient-to-r from-teal-400 via-emerald-500 to-green-500" />
        
        <div className="p-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-500/20 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
            Verificación de Identidad
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
            Para garantizar la seguridad y cumplir con normativas KYC/AML, necesitamos verificar tu identidad antes de continuar a la plataforma.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="rut" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Ingresa tu RUT
              </label>
              <input
                id="rut"
                type="text"
                value={rut}
                onChange={handleRutChange}
                placeholder="12.345.678-9"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all placeholder:font-normal placeholder:text-gray-400"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !rut}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                'Validar Identidad'
              )}
            </button>
          </form>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-6 text-center leading-relaxed">
            Tus datos están protegidos bajo la Ley 21.719. Utilizamos este método para asegurar un entorno libre de bots (Powered by Didit).
          </p>
        </div>
      </div>
    </div>
  );
}
