import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  validationId: string;
  ideaName: string | null;
  currentVersion: number;
  onClose: () => void;
}

export function PivotModal({ validationId, ideaName, currentVersion, onClose }: Props) {
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreatePivot = async () => {
    if (!reason.trim()) return;
    setLoading(true);

    try {
      // Obtener los datos de la validación actual para pre-cargar el wizard
      const { data: current, error } = await supabase
        .from('validations')
        .select('*')
        .eq('id', validationId)
        .single();

      if (error || !current) throw error;

      // Crear nueva validación como pivote (hijo)
      const { data: newValidation, error: createError } = await supabase
        .from('validations')
        .insert({
          user_id:          current.user_id,
          status:           'in_progress',
          current_step:     1,
          // Copiar datos base del padre
          idea_name:        current.idea_name,
          idea_description: current.idea_description,
          idea_industry:    current.idea_industry,
          target_country:   current.target_country,
          target_region:    current.target_region,
          business_model:   current.business_model,
          business_stage:   current.business_stage,
          pricing_range:    current.pricing_range,
          known_competitors: current.known_competitors,
          customer_segment:  current.customer_segment,
          customer_pain_points: current.customer_pain_points,
          customer_context:  current.customer_context,
          value_proposition: current.value_proposition,
          differentiator:    current.differentiator,
          mvp_type:          current.mvp_type,
          mvp_features:      current.mvp_features,
          mvp_user_flow:     current.mvp_user_flow,
          questions_answers: current.questions_answers,
          // Metadatos de pivote
          parent_id:    validationId,
          version:      currentVersion + 1,
          pivot_reason: reason.trim(),
        })
        .select('id')
        .single();

      if (createError || !newValidation) throw createError;

      toast.success(`Pivote v${currentVersion + 1} iniciado`);
      navigate(`/validate?pivot=${newValidation.id}`);
    } catch {
      toast.error('No se pudo crear el pivote. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#12121A] rounded-3xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-lg shrink-0">
            🔀
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-[#F0EFF8] text-sm">Pivotar idea</h2>
            <p className="text-xs text-gray-400">
              {ideaName ? `"${ideaName}"` : 'Tu idea'} · Versión {currentVersion} → {currentVersion + 1}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 dark:bg-white/5 transition text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Razón del pivote */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-gray-700 dark:text-[#C4C4D4] mb-2">
            ¿Por qué pivotás? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: El mercado B2C es muy difícil de monetizar. Voy a enfocarme en ventas B2B al sector salud."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-white/10 rounded-2xl text-sm resize-none
                       outline-none focus:border-amber-400 transition placeholder:text-gray-300"
          />
          <p className="text-xs text-gray-400 mt-1">
            Esta razón quedará en el historial y la IA la usará para evaluar si el pivote mejora los puntos débiles anteriores.
          </p>
        </div>

        {/* Info de qué se copiará */}
        <div className="bg-gray-50 dark:bg-[#0A0A0F] rounded-xl px-4 py-3 mb-5 border border-gray-100 dark:border-white/5">
          <p className="text-xs font-semibold text-gray-600 dark:text-[#8B8AA0] mb-1.5">Se copiará de la versión anterior:</p>
          <div className="flex flex-wrap gap-1.5">
            {['Nombre de idea', 'Industria', 'Segmento', 'MVP', 'Respuestas previas'].map((item) => (
              <span key={item} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 text-gray-500 dark:text-[#8B8AA0]">
                {item}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Podrás editar todo en el wizard antes de volver a analizar.</p>
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border-2 border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold text-gray-500 dark:text-[#8B8AA0] hover:border-gray-300 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreatePivot}
            disabled={!reason.trim() || loading}
            className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold
                       hover:bg-amber-600 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>🔀 Iniciar pivote</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
