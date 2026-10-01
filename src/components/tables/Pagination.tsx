type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

/**
 * Build the window of page numbers to show.
 *
 * The previous implementation started the window at `currentPage - 1` and took
 * a fixed three, which walked off the end: on page 5 of 5 it offered a page 6.
 * Clamping the *start* so the window always ends at `totalPages` keeps every
 * rendered number reachable, and keeps the window full near the end rather than
 * shrinking to one button.
 */
function pageWindow(currentPage: number, totalPages: number, size = 3): number[] {
  if (totalPages <= 0) return [];
  const span = Math.min(size, totalPages);
  let start = Math.max(1, currentPage - Math.floor(span / 2));
  start = Math.min(start, totalPages - span + 1);
  return Array.from({ length: span }, (_, i) => start + i);
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const pages = pageWindow(currentPage, totalPages);
  const first = pages[0] ?? 1;
  const last = pages[pages.length - 1] ?? 1;

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="mr-2.5 flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
      >
        Previous
      </button>
      <div className="flex items-center gap-2">
        {first > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-500/[0.08] hover:text-brand-500 dark:text-gray-400"
            >
              1
            </button>
            {first > 2 ? <span className="px-1 text-gray-400">…</span> : null}
          </>
        ) : null}

        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-current={currentPage === page ? "page" : undefined}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
              currentPage === page
                ? "bg-brand-500 text-white"
                : "text-gray-700 hover:bg-blue-500/[0.08] hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-500"
            }`}
          >
            {page}
          </button>
        ))}

        {last < totalPages ? (
          <>
            {last < totalPages - 1 ? (
              <span className="px-1 text-gray-400">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-500/[0.08] hover:text-brand-500 dark:text-gray-400"
            >
              {totalPages}
            </button>
          </>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="ml-2.5 flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
      >
        Next
      </button>
    </div>
  );
};

export { pageWindow };
export default Pagination;
