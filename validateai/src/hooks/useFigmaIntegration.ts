import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface FigmaConnectionStatus {
  connected: boolean;
  figma_handle?: string;
  expires_at?: string;
  created_at?: string;
}

interface FigmaFile {
  key: string;
  name: string;
  last_modified: string;
  thumbnail_url?: string;
}

interface NavigationMap {
  id: string;
  file_key: string;
  file_name: string;
  page_name: string;
  nodes: unknown[];
  edges: unknown[];
  ai_insights: Record<string, unknown> | null;
  updated_at: string;
}

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');
  return `Bearer ${session.access_token}`;
}

export function useFigmaIntegration(validationId?: string) {
  const [status, setStatus] = useState<FigmaConnectionStatus | null>(null);
  const [files, setFiles] = useState<FigmaFile[]>([]);
  const [map, setMap] = useState<NavigationMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Load connection status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  // Load existing map if validationId provided
  useEffect(() => {
    if (validationId) fetchMap(validationId);
  }, [validationId]);

  const fetchStatus = useCallback(async () => {
    try {
      const auth = await getAuthHeader();
      const res = await fetch(`${EDGE_BASE}/figma-oauth-handler/status`, {
        headers: { Authorization: auth },
      });
      if (!res.ok) return;
      const data = await res.json() as FigmaConnectionStatus;
      setStatus(data);
    } catch {
      // Silent — user just isn't connected
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setLoading(true);
      const auth = await getAuthHeader();
      const redirectUri = `${window.location.origin}/figma/callback`;

      // Encode current path so callback can return here
      const state = btoa(JSON.stringify({
        return_to: window.location.pathname,
        ts: Date.now(),
      }));

      const res = await fetch(`${EDGE_BASE}/figma-oauth-handler/connect`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_uri: redirectUri, state }),
      });

      const data = await res.json() as { url?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (data.url) window.location.href = data.url;

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar conexión con Figma');
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      const auth = await getAuthHeader();
      await fetch(`${EDGE_BASE}/figma-oauth-handler/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: auth },
      });
      setStatus({ connected: false });
      setFiles([]);
      toast.success('Cuenta de Figma desvinculada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desconectar Figma');
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveUrl = useCallback(async (figmaUrl: string): Promise<{ file_key: string; file_name: string; pages: { id: string; name: string }[] } | null> => {
    try {
      setLoading(true);
      const auth = await getAuthHeader();
      const res = await fetch(`${EDGE_BASE}/ai-figma-bridge/resolve-url`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ figma_url: figmaUrl }),
      });
      const data = await res.json() as { file_key?: string; file_name?: string; pages?: { id: string; name: string }[]; error?: string };
      if (data.error) throw new Error(data.error);
      return { file_key: data.file_key!, file_name: data.file_name!, pages: data.pages ?? [] };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al resolver la URL de Figma');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // kept for compatibility but no longer used
  const fetchFiles = useCallback(async () => {
    setFiles([]);
  }, []);

  const scanFile = useCallback(async (
    fileKey: string,
    options?: { pageId?: string; appCategory?: string }
  ) => {
    if (!validationId) {
      toast.error('Se necesita una validación activa para escanear Figma');
      return;
    }
    try {
      setScanning(true);
      const auth = await getAuthHeader();
      const res = await fetch(`${EDGE_BASE}/ai-figma-bridge/scan`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_key: fileKey,
          page_id: options?.pageId,
          validation_id: validationId,
          app_category: options?.appCategory,
        }),
      });

      const data = await res.json() as NavigationMap & { error?: string };
      if (data.error) throw new Error(data.error);

      setMap(data);
      toast.success(`Mapa de navegación generado: ${data.nodes?.length ?? 0} pantallas detectadas`);
      return data;

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al escanear archivo de Figma');
    } finally {
      setScanning(false);
    }
  }, [validationId]);

  const fetchMap = useCallback(async (vId: string) => {
    try {
      const auth = await getAuthHeader();
      const res = await fetch(`${EDGE_BASE}/ai-figma-bridge/map?validation_id=${vId}`, {
        headers: { Authorization: auth },
      });
      const data = await res.json() as { map: NavigationMap | null };
      setMap(data.map);
    } catch {
      // Silent
    }
  }, []);

  return {
    status,
    files,
    map,
    loading,
    scanning,
    connect,
    disconnect,
    fetchFiles,
    resolveUrl,
    scanFile,
    refetchStatus: fetchStatus,
  };
}
