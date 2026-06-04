import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { SurveyForm } from '@/types/survey';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function fetchForms(token: string): Promise<SurveyForm[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/survey-crud`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error al cargar encuestas');
  const data = await res.json();
  return data.forms as SurveyForm[];
}

async function deleteForm(token: string, id: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/survey-crud?id=${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Error al eliminar');
}

async function togglePublish(token: string, id: string, publish: boolean) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/survey-crud?id=${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_published: publish }),
  });
  if (!res.ok) throw new Error('Error al actualizar');
}

export function SurveyList() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<SurveyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    try {
      const data = await fetchForms(t);
      setForms(data);
    } catch {
      toast.error('No se pudieron cargar las encuestas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null;
      setToken(t);
      if (t) load(t);
      else setLoading(false);
    });
  }, [load]);

  const handleDelete = async (id: string, title: string) => {
    if (!token) return;
    if (!confirm(`¿Eliminar la encuesta "${title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteForm(token, id);
      setForms(prev => prev.filter(f => f.id !== id));
      toast.success('Encuesta eliminada.');
    } catch {
      toast.error('No se pudo eliminar.');
    }
  };

  const handleTogglePublish = async (form: SurveyForm) => {
    if (!token) return;
    try {
      await togglePublish(token, form.id, !form.is_published);
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, is_published: !f.is_published } : f));
      toast.success(form.is_published ? 'Encuesta despublicada.' : 'Encuesta publicada y lista para compartir.');
    } catch {
      toast.error('No se pudo actualizar el estado.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0EFF8]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/results" className="text-xs text-[#0EB5C6] hover:underline mb-2 block">← Volver al Dashboard</Link>
            <h1 className="text-2xl font-bold">Mis Encuestas</h1>
            <p className="text-sm text-[#C4C4D4] mt-1">Herramientas de Customer Development basadas en "The Mom Test"</p>
          </div>
          <button
            onClick={() => navigate('/surveys/new')}
            className="bg-[#0EB5C6] hover:bg-[#6B5FE6] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            + Nueva encuesta
          </button>
        </div>

        {/* Callout metodológico */}
        <div className="bg-[#12121A] border border-[#0EB5C6]/30 rounded-2xl p-4 mb-8 flex gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-semibold text-sm text-[#0EB5C6]">Principio Mom Test activo</p>
            <p className="text-xs text-[#C4C4D4] mt-0.5">
              El constructor de encuestas detecta automáticamente preguntas hipotéticas y sesgos de confirmación,
              y sugiere reformulaciones basadas en hechos pasados.
            </p>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#0EB5C6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : forms.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📊</p>
            <p className="font-semibold text-[#F0EFF8] mb-2">Aún no tienes encuestas</p>
            <p className="text-sm text-[#C4C4D4] mb-6">Crea tu primera encuesta de Customer Development para descubrir problemas reales de mercado.</p>
            <button
              onClick={() => navigate('/surveys/new')}
              className="bg-[#0EB5C6] hover:bg-[#6B5FE6] text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              Crear primera encuesta
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {forms.map(form => (
              <div
                key={form.id}
                className="bg-[#12121A] border border-white/5 rounded-2xl p-5 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[#F0EFF8] truncate">{form.title}</h3>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      form.is_published
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-white/10 text-[#C4C4D4]'
                    }`}>
                      {form.is_published ? 'Publicada' : 'Borrador'}
                    </span>
                  </div>
                  {form.description && (
                    <p className="text-xs text-[#C4C4D4] truncate">{form.description}</p>
                  )}
                  <p className="text-xs text-white/30 mt-1">
                    {form.schema_json?.fields?.length ?? 0} preguntas ·
                    Creada {new Date(form.created_at).toLocaleDateString('es-CL')}
                    {form.unique_slug && ` · /s/${form.unique_slug}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {form.is_published && form.unique_slug && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/s/${form.unique_slug}`);
                        toast.success('Enlace copiado');
                      }}
                      className="text-xs text-[#0EB5C6] hover:text-[#9B8FFF] px-3 py-1.5 rounded-lg border border-[#0EB5C6]/40 transition-colors"
                    >
                      Copiar link
                    </button>
                  )}
                  <button
                    onClick={() => handleTogglePublish(form)}
                    className="text-xs text-[#C4C4D4] hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                  >
                    {form.is_published ? 'Despublicar' : 'Publicar'}
                  </button>
                  <Link
                    to={`/surveys/${form.id}/results`}
                    className="text-xs text-[#C4C4D4] hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                  >
                    Resultados
                  </Link>
                  <Link
                    to={`/surveys/${form.id}/edit`}
                    className="text-xs text-[#C4C4D4] hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => handleDelete(form.id, form.title)}
                    className="text-xs text-red-400/70 hover:text-red-400 px-3 py-1.5 rounded-lg border border-red-400/20 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
