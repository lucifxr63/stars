interface Props {
  page:    number;
  pages:   number;
  total:   number;
  onPage:  (p: number) => void;
  pageSize?: number;
}

export function Pagination({ page, pages, total, onPage, pageSize = 20 }: Props) {
  if (pages <= 1) return null;

  const from  = page * pageSize + 1;
  const to    = Math.min((page + 1) * pageSize, total);
  const range = Math.min(pages, 5);
  const start = Math.max(0, Math.min(page - Math.floor(range / 2), pages - range));
  const pageNums = Array.from({ length: range }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs text-gray-400">
      <span>{from}–{to} de {total}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          ‹
        </button>
        {pageNums.map(p => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`px-2.5 py-1.5 rounded-lg border transition ${
              p === page
                ? 'border-[#0EB5C6] bg-[#0EB5C6]/10 text-[#38D5E3] font-semibold'
                : 'border-white/10 hover:bg-white/5'
            }`}
          >
            {p + 1}
          </button>
        ))}
        <button
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
          className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          ›
        </button>
      </div>
    </div>
  );
}
