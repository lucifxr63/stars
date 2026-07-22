-- Allow any authenticated user to read knowledge graph (public reference data)
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_nodes_select_authenticated"
  ON public.knowledge_nodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "knowledge_edges_select_authenticated"
  ON public.knowledge_edges FOR SELECT
  TO authenticated
  USING (true);
