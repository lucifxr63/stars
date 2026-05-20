import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Key, Plus, Trash2, Copy, Check, BarChart2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateApiKey, hashApiKey } from '@/utils/crypto';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
}

interface ApiUsageLog {
  id: string;
  endpoint: string;
  requests_count: number;
  tokens_used: number;
  created_at: string;
}

export function Developers() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiUsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [keysRes, logsRes] = await Promise.all([
      supabase.from('api_keys').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }),
      // To get usage logs, we join via api_keys (handled by RLS automatically if we select from logs)
      supabase.from('api_usage_logs').select('id, endpoint, requests_count, tokens_used, created_at, api_key_id').order('created_at', { ascending: true })
    ]);

    if (keysRes.data) setKeys(keysRes.data as ApiKey[]);
    if (logsRes.data) setLogs(logsRes.data as ApiUsageLog[]);
    setLoading(false);
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const plainKey = generateApiKey();
      const hashedKey = await hashApiKey(plainKey);
      const prefix = plainKey.substring(0, 14) + '...'; // val_live_XXXX...

      const { data, error } = await supabase.from('api_keys').insert({
        profile_id: user.id,
        name: keyName.trim(),
        key_prefix: prefix,
        key_hash: hashedKey
      }).select().single();

      if (error) throw error;

      setKeys([data as ApiKey, ...keys]);
      setNewKeySecret(plainKey);
      toast.success('Llave creada exitosamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al crear la llave');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('¿Estás seguro de revocar esta llave? Cualquier aplicación que la use dejará de funcionar inmediatamente.')) return;
    
    try {
      const { error } = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      
      setKeys(keys.map(k => k.id === id ? { ...k, is_active: false, revoked_at: new Date().toISOString() } : k));
      toast.success('Llave revocada');
    } catch (err) {
      toast.error('Error al revocar la llave');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    setShowModal(false);
    setKeyName('');
    setNewKeySecret(null);
  };

  // Chart Data Processing
  const chartData = useMemo(() => {
    const last30Days = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    });

    const dataMap: Record<string, any> = {};
    last30Days.forEach(date => {
      dataMap[date] = { date, '/rag/query': 0, '/data/economy': 0, other: 0, total_tokens: 0 };
    });

    logs.forEach(log => {
      const date = log.created_at.split('T')[0];
      if (dataMap[date]) {
        const ep = log.endpoint;
        const key = (ep.includes('/rag/query') || ep.includes('/data/economy')) ? ep : 'other';
        dataMap[date][key] += log.requests_count || 1;
        dataMap[date].total_tokens += log.tokens_used || 0;
      }
    });

    return Object.values(dataMap);
  }, [logs]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">API & Developers</h1>
            <p className="text-sm text-gray-400 mt-1">
              Gestiona tus llaves y monitorea el consumo de RAG-as-a-Service.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-600 transition shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva Llave
          </button>
        </div>

        {/* Charts Section */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="w-5 h-5 text-teal-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Consumo (Últimos 30 días)</h2>
          </div>
          
          {logs.length === 0 && !loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <p>Aún no hay consumo registrado.</p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#8B8AA0' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 12, fill: '#8B8AA0' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#12121A', borderColor: '#333', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="/rag/query" name="Motor RAG" stackId="a" fill="#7C6FF7" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="/data/economy" name="Datos Económicos" stackId="a" fill="#2DD4BF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="other" name="Otros" stackId="a" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Keys List */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Mis API Keys</h2>
          
          {loading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-20 bg-white dark:bg-[#12121A] rounded-xl animate-pulse" />)}
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5">
              <Key className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No tienes llaves generadas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(key => (
                <div key={key.id} className="bg-white dark:bg-[#12121A] rounded-xl border border-gray-100 dark:border-white/5 p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-[#F0EFF8]">{key.name}</span>
                      {key.is_active ? (
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-bold">ACTIVA</span>
                      ) : (
                        <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">REVOCADA</span>
                      )}
                    </div>
                    <code className="text-xs text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded font-mono">
                      {key.key_prefix}
                    </code>
                    <p className="text-xs text-gray-400 mt-2">
                      Creada: {new Date(key.created_at).toLocaleDateString()} · Último uso: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Nunca'}
                    </p>
                  </div>
                  
                  {key.is_active && (
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                      title="Revocar llave"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Modal Crear Llave */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#12121A] rounded-3xl shadow-2xl w-full max-w-md p-6 relative">
            {!newKeySecret ? (
              <>
                <h3 className="font-black text-gray-900 dark:text-white text-xl mb-2">Nueva API Key</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Esta llave te dará acceso a los endpoints de IA y datos económicos.
                </p>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Ej: Producción - Backend"
                  className="w-full border border-gray-200 dark:border-white/10 bg-transparent rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 mb-6 text-gray-900 dark:text-white"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={closeModal} className="flex-1 py-2.5 font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition">
                    Cancelar
                  </button>
                  <button onClick={handleCreateKey} disabled={creating || !keyName.trim()} className="flex-1 py-2.5 font-semibold bg-teal-500 hover:bg-teal-600 text-white rounded-xl transition disabled:opacity-50">
                    {creating ? 'Generando...' : 'Generar Llave'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-teal-500/10 text-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="font-black text-center text-gray-900 dark:text-white text-xl mb-2">¡Llave Generada!</h3>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2 items-start mb-5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Por tu seguridad, <strong>esta es la única vez</strong> que verás tu API Key completa. Cópiala y guárdala en un lugar seguro (.env).
                  </p>
                </div>
                
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 p-2 rounded-xl mb-6">
                  <code className="text-sm flex-1 overflow-x-auto text-gray-800 dark:text-gray-300 px-2 font-mono whitespace-nowrap">
                    {newKeySecret}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(newKeySecret)}
                    className="shrink-0 p-2 bg-white dark:bg-[#12121A] hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 transition shadow-sm text-gray-700 dark:text-gray-300"
                  >
                    {copied ? <Check className="w-4 h-4 text-teal-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <button onClick={closeModal} className="w-full py-2.5 font-semibold bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 rounded-xl transition">
                  He guardado mi llave
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
