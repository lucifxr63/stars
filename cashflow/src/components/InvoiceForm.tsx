import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileUp, Sparkles, Loader2, AlertTriangle, ShieldX, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_PDF_BYTES, type InvoiceType, type SourceSystem, type ParsedInvoice } from '@/lib/queries';

const schema = z
  .object({
    type: z.enum(['AR', 'AP']),
    total_amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
    contact_name: z.string().max(120).optional(),
    issue_date: z.string().min(1, 'Requerida'),
    due_date: z.string().min(1, 'Requerida'),
  })
  .refine((d) => d.due_date >= d.issue_date, {
    path: ['due_date'],
    message: 'El vencimiento no puede ser anterior a la emisión',
  });

type FormValues = z.input<typeof schema>;

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';
const labelCls = 'mb-1.5 block text-xs font-medium text-muted-foreground';

interface Props {
  onSubmit: (values: {
    type: InvoiceType;
    total_amount: number;
    contact_name: string | null;
    issue_date: string;
    due_date: string;
    source_system: SourceSystem;
  }) => Promise<void>;
  onParse: (file: File) => Promise<ParsedInvoice>;
  pdfUsed: number;
  pdfLimit: number;
}

export function InvoiceForm({ onSubmit, onParse, pdfUsed, pdfLimit }: Props) {
  const pdfRemaining = Math.max(0, pdfLimit - pdfUsed);
  const quotaExhausted = pdfRemaining <= 0;
  const today = new Date().toISOString().slice(0, 10);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [aiInfo, setAiInfo] = useState<{ confidence: string; warnings: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [source, setSource] = useState<SourceSystem>('MANUAL');

  function resetUpload() {
    setRejection(null);
    setParseError(null);
    setAiInfo(null);
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'AR', issue_date: today, due_date: today },
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setParseError('Solo se aceptan archivos PDF.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setParseError('El archivo supera los 2MB. Sube solo la factura, no un reporte pesado.');
      return;
    }
    if (quotaExhausted) {
      setParseError(`Alcanzaste el límite Beta de ${pdfLimit} lecturas de PDF este mes.`);
      return;
    }
    setParseError(null);
    setAiInfo(null);
    setRejection(null);
    setParsing(true);
    try {
      const result = await onParse(file);
      // Escudo anti-basura: cotización/presupuesto → bloqueo duro, no se pre-llena.
      if (!result.is_valid_invoice) {
        setRejection(result.rejection_reason ?? 'El documento no es una factura válida.');
        setSource('MANUAL');
        return;
      }
      const { extracted_fields: f, confidence, warnings } = result;
      if (f.type) setValue('type', f.type);
      if (f.total_amount != null) setValue('total_amount', f.total_amount);
      if (f.contact_name) setValue('contact_name', f.contact_name);
      if (f.issue_date) setValue('issue_date', f.issue_date);
      if (f.due_date) setValue('due_date', f.due_date);
      setSource('PDF_AI');
      setAiInfo({ confidence, warnings });
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'No se pudo leer el PDF.');
    } finally {
      setParsing(false);
    }
  }

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({
        type: values.type as InvoiceType,
        total_amount: Number(values.total_amount),
        contact_name: values.contact_name?.trim() ? values.contact_name.trim() : null,
        issue_date: values.issue_date,
        due_date: values.due_date,
        source_system: source,
      });
      reset({ type: values.type, issue_date: today, due_date: today, total_amount: undefined, contact_name: '' });
      setSource('MANUAL');
      setAiInfo(null);
      setRejection(null);
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'No se pudo crear la factura' });
    }
  });

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <h3 className="mb-1 font-semibold">Nueva factura</h3>
      <p className="mb-4 text-xs text-muted-foreground">Cuentas por cobrar (A/R) o por pagar (A/P)</p>

      {/* Dropzone IA */}
      <div
        onClick={() => !parsing && !quotaExhausted && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!parsing && !quotaExhausted) void handleFile(e.dataTransfer.files?.[0]);
        }}
        aria-disabled={quotaExhausted}
        className={`mb-4 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
          quotaExhausted
            ? 'cursor-not-allowed border-border bg-muted/30 opacity-60'
            : 'cursor-pointer border-accent/50 bg-accent/5 hover:border-accent'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={quotaExhausted}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {parsing ? (
          <span className="flex items-center gap-2 text-sm text-accent">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Leyendo documento con IA…
          </span>
        ) : quotaExhausted ? (
          <span className="text-sm text-muted-foreground">Límite Beta de {pdfLimit} PDFs alcanzado este mes.</span>
        ) : (
          <>
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileUp className="size-4 text-accent" aria-hidden="true" />
              Arrastra el PDF de tu factura aquí
            </span>
            <span className="text-xs text-muted-foreground">o haz clic para subir — la IA pre-llena el formulario</span>
          </>
        )}
      </div>
      <p className="mb-4 -mt-2 text-center text-[11px] text-muted-foreground">
        Máx 2MB · solo se procesa la primera página · {pdfRemaining}/{pdfLimit} lecturas IA restantes este mes
      </p>

      {parseError && <p className="mb-3 text-sm text-danger">{parseError}</p>}

      {/* Bloqueo duro: documento no vinculante (cotización/presupuesto) */}
      {rejection && (
        <div className="mb-4 rounded-lg border border-danger/50 bg-danger/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <ShieldX className="size-4 shrink-0" aria-hidden="true" />
            Documento no aceptado
          </p>
          <p className="mt-1.5 text-sm text-foreground/90">{rejection}</p>
          <button
            type="button"
            onClick={() => { resetUpload(); fileRef.current?.click(); }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted cursor-pointer"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Subir otro documento
          </button>
        </div>
      )}

      {aiInfo && !rejection && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-accent">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Pre-llenado desde PDF · confianza {aiInfo.confidence}
          </p>
          {aiInfo.warnings.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {aiInfo.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-1">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber" aria-hidden="true" />
                  {w}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-muted-foreground">Revisa los campos antes de guardar.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="inv-type">Tipo</label>
          <select id="inv-type" className={inputCls} {...register('type')}>
            <option value="AR">Por cobrar (A/R)</option>
            <option value="AP">Por pagar (A/P)</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="inv-amount">Monto (CLP)</label>
          <input id="inv-amount" type="number" min="0" step="1" placeholder="0" className={inputCls} {...register('total_amount')} />
          {errors.total_amount && <p className="mt-1 text-xs text-danger">{errors.total_amount.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="inv-issue">Emisión</label>
          <input id="inv-issue" type="date" className={inputCls} {...register('issue_date')} />
        </div>
        <div>
          <label className={labelCls} htmlFor="inv-due">Vencimiento</label>
          <input id="inv-due" type="date" className={inputCls} {...register('due_date')} />
          {errors.due_date && <p className="mt-1 text-xs text-danger">{errors.due_date.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="inv-contact">Cliente / Proveedor (opcional)</label>
          <input id="inv-contact" type="text" placeholder="Ej: Comercial Andes Ltda." className={inputCls} {...register('contact_name')} />
        </div>
      </div>

      {errors.root && <p role="alert" className="mt-3 text-sm text-danger">{errors.root.message}</p>}

      <div className="mt-4">
        <Button type="submit" disabled={isSubmitting || parsing || rejection !== null}>
          {isSubmitting ? 'Guardando…' : 'Agregar factura'}
        </Button>
      </div>
    </form>
  );
}
