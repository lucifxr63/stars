import { getSupabase } from '../middleware/auth.ts'

export const economicDataHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    
    // Fetch economic data from the knowledge table (or temp_context as planned)
    const { data: indicators, error } = await supabase
      .from('economic_knowledge')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Economic data fetch error:', error)
      // fallback to temp_context if economic_knowledge fails or is not populated
      const { data: tempCtx, error: tempErr } = await supabase
        .from('temp_context')
        .select('*')
        .limit(10)
      
      if (!tempErr && tempCtx) {
        c.set('tokens_used', 20)
        return c.json({ data: tempCtx })
      }

      return c.json({ error: 'Failed to retrieve economic data' }, 500)
    }

    c.set('tokens_used', 50)
    return c.json({ data: indicators })

  } catch (err) {
    console.error('Economic data handler error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}
