import type { FC } from 'react';

interface RedditPost {
  subreddit: string;
  title: string;
  upvotes: number;
  sentiment: string;
  snippet: string;
  url: string;
}

interface RedditData {
  status: string;
  source: string;
  top_discussions: RedditPost[];
}

interface TrendsData {
  status: string;
  source: string;
  keyword: string;
  average_interest_last_12_months: number;
  trend_trajectory: string;
  related_breakout_queries: string[];
}

interface AgentLog {
  reddit_data: RedditData | null;
  trends_data: TrendsData | null;
  reddit_status: 'success' | 'error' | 'pending';
  trends_status: 'success' | 'error' | 'pending';
}

interface Props {
  agentLog: AgentLog;
}

const SENTIMENT_CONFIG: Record<string, { label: string; className: string }> = {
  frustration: { label: 'Frustración',  className: 'bg-red-100    text-red-700    dark:bg-red-900/30   dark:text-red-400' },
  curiosity:   { label: 'Curiosidad',   className: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30  dark:text-blue-400' },
  excitement:  { label: 'Entusiasmo',   className: 'bg-green-100  text-green-700  dark:bg-green-900/30 dark:text-green-400' },
  concern:     { label: 'Preocupación', className: 'bg-amber-100  text-amber-700  dark:bg-amber-900/30 dark:text-amber-400' },
};

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const cfg = SENTIMENT_CONFIG[sentiment] ?? {
    label: sentiment,
    className: 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function TrajectoryIcon({ trajectory }: { trajectory: string }) {
  if (trajectory === 'upward')   return <span className="text-emerald-500 font-bold">↑ Al alza</span>;
  if (trajectory === 'downward') return <span className="text-red-500    font-bold">↓ A la baja</span>;
  return <span className="text-gray-400 font-bold">→ Estable</span>;
}

function AgentErrorCard({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-white/[0.02]">
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-500 dark:text-[#8B8AA0]">{label}</p>
        <p className="text-xs text-gray-400 dark:text-[#4A495E] mt-0.5">Datos no disponibles en este análisis.</p>
      </div>
    </div>
  );
}

export const EvidenceWall: FC<Props> = ({ agentLog }) => {
  const { reddit_data, trends_data, reddit_status, trends_status } = agentLog;

  return (
    <div className="space-y-6">
      {/* Reddit */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
          </svg>
          <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Señal Social — Reddit</h3>
          {reddit_status === 'success' && (
            <span className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Conectado</span>
          )}
        </div>

        {reddit_status !== 'success' || !reddit_data ? (
          <AgentErrorCard label="Datos de Reddit" />
        ) : (
          <div className="space-y-3">
            {reddit_data.top_discussions.map((post, i) => (
              <a
                key={i}
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-xl border border-gray-100 dark:border-white/6 bg-white dark:bg-[#12121A] hover:border-[#7C6FF7]/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-[11px] font-bold text-orange-500">{post.subreddit}</span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mt-0.5 group-hover:text-[#7C6FF7] transition-colors">
                      {post.title}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <SentimentBadge sentiment={post.sentiment} />
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                      </svg>
                      <span className="font-medium">{post.upvotes.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] italic leading-relaxed line-clamp-2">
                  {post.snippet}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Google Trends */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Tendencias de Búsqueda</h3>
          {trends_status === 'success' && (
            <span className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Conectado</span>
          )}
        </div>

        {trends_status !== 'success' || !trends_data ? (
          <AgentErrorCard label="Google Trends" />
        ) : (
          <div className="p-4 rounded-xl border border-gray-100 dark:border-white/6 bg-white dark:bg-[#12121A] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">Keyword analizada</p>
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">"{trends_data.keyword}"</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">Tendencia</p>
                <p className="text-sm font-semibold mt-0.5">
                  <TrajectoryIcon trajectory={trends_data.trend_trajectory} />
                </p>
              </div>
            </div>

            {/* Barra de interés */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-[#8B8AA0] mb-1.5">
                <span>Interés promedio últimos 12 meses</span>
                <span className="font-bold text-gray-900 dark:text-[#F0EFF8]">
                  {trends_data.average_interest_last_12_months}/100
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7C6FF7] rounded-full transition-all duration-700"
                  style={{ width: `${trends_data.average_interest_last_12_months}%` }}
                />
              </div>
            </div>

            {/* Queries relacionadas */}
            {trends_data.related_breakout_queries.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-2">Queries en auge</p>
                <div className="flex flex-wrap gap-1.5">
                  {trends_data.related_breakout_queries.map((q, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-[#7C6FF7]/10 text-[#7C6FF7] text-xs font-medium rounded-full"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
