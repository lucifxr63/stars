import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier } from '@/hooks/useUserTier';
import { DD_TASK_CARDS, type ExtractedProjectData, type PendingQuestion, type DueDiligenceScore } from '@/types/validation';
import { TaskCardStream } from './TaskCardStream';
import { LockedSection } from '@/components/shared/LockedSection';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches backend hard limit
const ACCEPTED_MIME = ['application/pdf', 'application/json'] as const;
type AcceptedMime = typeof ACCEPTED_MIME[number];

// ── Phase machine ─────────────────────────────────────────────────────────────
type Phase =
  | 'idle'       // waiting for file
  | 'error'      // file validation failed (before upload)
  | 'uploading'  // file accepted, API call in flight
  | 'streaming'  // API done, task card animation playing
  | 'success'    // all cards done → micro-copy shown
  | 'done';      // transition to next wizard step

interface ParseResponse {
  extractedData:     ExtractedProjectData;
  pendingQuestions:  PendingQuestion[];
  dueDiligenceScore: DueDiligenceScore;
  _extractionWarning?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function FileIcon({ mime }: { mime: AcceptedMime }) {
  return mime === 'application/pdf' ? (
    <svg className="w-6 h-6 text-[#7C6FF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ) : (
    <svg className="w-6 h-6 text-[#7C6FF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StepUpload() {
  const { tier, loading: tierLoading } = useUserTier();
  const {
    validationId,
    setExtractedData,
    setPendingQuestions,
    setDueDiligenceScore,
    setUploadStatus,
    nextStep,
  } = useValidationStore();

  const [phase, setPhase]           = useState<Phase>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [fileName, setFileName]     = useState<string | null>(null);
  const [fileMime, setFileMime]     = useState<AcceptedMime | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Holds resolved API data until the stream animation finishes
  const resolvedData = useRef<ParseResponse | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── File validation ─────────────────────────────────────────────────────────
  function validateFile(file: File): string | null {
    if (!ACCEPTED_MIME.includes(file.type as AcceptedMime)) {
      return 'Formato no soportado. Sube un PDF o un JSON estructurado del proyecto.';
    }
    if (file.size > MAX_BYTES) {
      return 'Tu documento supera los 10 MB. Los mejores pitch decks van directo al grano. Por favor comprime el archivo o sube una versión resumida para un análisis óptimo.';
    }
    return null;
  }

  // ── File → base64 ───────────────────────────────────────────────────────────
  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Upload + parse ──────────────────────────────────────────────────────────
  async function processFile(file: File) {
    const err = validateFile(file);
    if (err) { setErrorMsg(err); setPhase('error'); return; }

    setErrorMsg(null);
    setFileName(file.name);
    setFileMime(file.type as AcceptedMime);
    setPhase('uploading');
    setUploadStatus('uploading');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      setUploadStatus('parsing');
      const fileBase64 = await toBase64(file);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-project`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            fileBase64,
            mimeType:      file.type,
            fileName:      file.name,
            validation_id: validationId ?? undefined,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Error ${res.status} al procesar el documento.`);
      }

      const parsed: ParseResponse = await res.json();
      resolvedData.current = parsed;
      setPendingCount(parsed.pendingQuestions.length);

      // API done → let task card animation take over; it will call onStreamComplete
      setPhase('streaming');
      setUploadStatus('gap-analysis');

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido al procesar el documento.';
      setErrorMsg(msg);
      setPhase('error');
      setUploadStatus('error');
    }
  }

  // ── Stream animation completed ──────────────────────────────────────────────
  function onStreamComplete() {
    setPhase('success');
    setUploadStatus('done');

    // Commit results to store
    if (resolvedData.current) {
      const { extractedData, pendingQuestions, dueDiligenceScore } = resolvedData.current;
      setExtractedData(extractedData);
      setPendingQuestions(pendingQuestions);
      setDueDiligenceScore(dueDiligenceScore);
    }

    // After 2.5s of success micro-copy, advance to next wizard step
    setTimeout(() => {
      setPhase('done');
      nextStep();
    }, 2500);
  }

  // ── Drag & Drop handlers ────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── Guard: tier ─────────────────────────────────────────────────────────────
  if (tierLoading) {
    return (
      <div className="py-10 flex justify-center">
        <div className="w-7 h-7 border-2 border-[#7C6FF7]/30 border-t-[#7C6FF7] rounded-full animate-spin" />
      </div>
    );
  }

  if (tier === 'free' || tier === 'basic') {
    return (
      <div className="space-y-4">
        <SectionHeader />
        <LockedSection
          title="Auditoría de Documentos"
          description="Sube tu Pitch Deck o Business Plan y deja que la IA extraiga automáticamente todos los datos para tu Due Diligence Score."
          requiredTier="pro"
          hint="Arrastra tu PDF y listo — sin formularios."
        />
      </div>
    );
  }

  // ── Phase: Uploading / Streaming ────────────────────────────────────────────
  if (phase === 'uploading') {
    return (
      <div className="space-y-6">
        <SectionHeader />
        <UploadingIndicator fileName={fileName} fileMime={fileMime} />
      </div>
    );
  }

  if (phase === 'streaming') {
    return (
      <div className="space-y-6">
        <SectionHeader />
        <UploadingIndicator fileName={fileName} fileMime={fileMime} compact />
        <TaskCardStream
          cards={DD_TASK_CARDS}
          cadenceMs={950}
          onComplete={onStreamComplete}
        />
      </div>
    );
  }

  // ── Phase: Success micro-copy ───────────────────────────────────────────────
  if (phase === 'success' || phase === 'done') {
    const count = pendingCount ?? 0;
    return (
      <div className="space-y-6">
        <SectionHeader />
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-[#F0EFF8] mb-2">
              ¡Documento mapeado con éxito!
            </h3>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] max-w-sm leading-relaxed">
              {count > 0
                ? `Hemos mapeado tu modelo de negocio base. Para generar tu Due Diligence Score final, necesitamos afinar ${count} detalle${count > 1 ? 's' : ''} clave que los inversores exigirán.`
                : 'Tu documento contiene toda la información necesaria para generar tu Due Diligence Score. Preparando el reporte final…'}
            </p>
          </div>
          <div className="w-6 h-6 border-2 border-[#7C6FF7]/30 border-t-[#7C6FF7] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ── Phase: Idle / Error ─────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <SectionHeader />

      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de documentos"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-8
          flex flex-col items-center gap-4 text-center select-none
          ${isDragOver
            ? 'border-[#7C6FF7] bg-[#7C6FF7]/5 dark:bg-[#7C6FF7]/8 scale-[1.01]'
            : phase === 'error'
            ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
            : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0A0A0F] hover:border-[#7C6FF7]/50 hover:bg-[#7C6FF7]/3'
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.json,application/pdf,application/json"
          className="hidden"
          onChange={onInputChange}
        />

        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-colors duration-200
          ${isDragOver
            ? 'bg-[#7C6FF7]/15 border-[#7C6FF7]/40'
            : phase === 'error'
            ? 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'
            : 'bg-white dark:bg-[#12121A] border-gray-200 dark:border-white/8'
          }`}
        >
          <UploadIcon className={`w-7 h-7 ${isDragOver ? 'text-[#7C6FF7]' : phase === 'error' ? 'text-red-500' : 'text-gray-400 dark:text-[#4A495E]'}`} />
        </div>

        {/* Copy */}
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-[#F0EFF8] mb-1">
            {isDragOver ? 'Suelta el archivo aquí' : 'Arrastra tu Pitch Deck o Business Plan'}
          </p>
          <p className="text-xs text-gray-400 dark:text-[#4A495E]">
            PDF o JSON · Máximo 10 MB
          </p>
        </div>

        {/* Browse button */}
        {!isDragOver && (
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
            bg-[#7C6FF7]/10 text-[#7C6FF7] dark:text-[#A78BFA] border border-[#7C6FF7]/20
            hover:bg-[#7C6FF7]/15 transition-colors duration-150">
            Explorar archivos
          </span>
        )}
      </div>

      {/* Consultive error message (Mandato 2) */}
      {phase === 'error' && errorMsg && (
        <div className="flex gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-0.5">No pudimos procesar ese archivo</p>
            <p className="text-xs text-red-600 dark:text-red-400/80 leading-relaxed">{errorMsg}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setPhase('idle'); setErrorMsg(null); }}
              className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 underline underline-offset-2 hover:no-underline"
            >
              Intentar con otro archivo
            </button>
          </div>
        </div>
      )}

      {/* Skip option */}
      <div className="text-center pt-1">
        <button
          onClick={nextStep}
          className="text-xs text-gray-400 dark:text-[#4A495E] hover:text-gray-600 dark:hover:text-[#8B8AA0] underline underline-offset-2 transition-colors"
        >
          Prefiero llenar el formulario manualmente →
        </button>
      </div>

      {/* Accepted formats */}
      <div className="flex items-center justify-center gap-4 pt-1">
        {(['application/pdf', 'application/json'] as AcceptedMime[]).map((mime) => (
          <div key={mime} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-[#4A495E]">
            <FileIcon mime={mime} />
            <span className="font-medium">{mime === 'application/pdf' ? 'Pitch Deck PDF' : 'JSON estructurado'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionHeader() {
  return (
    <div className="text-center space-y-1">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 text-xs font-bold text-[#7C6FF7] dark:text-[#A78BFA] mb-3">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        Auditoría Due Diligence
      </div>
      <h2 className="text-xl font-black text-gray-900 dark:text-[#F0EFF8]">
        Sube tu Pitch Deck
      </h2>
      <p className="text-sm text-gray-500 dark:text-[#8B8AA0] max-w-sm mx-auto leading-relaxed">
        La IA extrae automáticamente todos los datos de tu documento y calcula tu Due Diligence Score como lo haría un fondo de VC.
      </p>
    </div>
  );
}

function UploadingIndicator({ fileName, fileMime, compact = false }: { fileName: string | null; fileMime: AcceptedMime | null; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-[#7C6FF7]/20 bg-[#7C6FF7]/5 dark:bg-[#7C6FF7]/8 ${compact ? '' : 'mb-2'}`}>
      {fileMime && <FileIcon mime={fileMime} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#7C6FF7] dark:text-[#A78BFA] truncate">
          {fileName ?? 'documento'}
        </p>
        <p className="text-xs text-[#7C6FF7]/60 dark:text-[#A78BFA]/60">Procesando con IA…</p>
      </div>
      <div className="w-4 h-4 border-2 border-[#7C6FF7]/30 border-t-[#7C6FF7] rounded-full animate-spin shrink-0" />
    </div>
  );
}
