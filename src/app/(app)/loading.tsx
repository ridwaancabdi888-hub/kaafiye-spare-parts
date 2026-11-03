// Skeleton shown while a page's data loads.
export default function Loading() {
  const bar = "animate-pulse rounded-xl bg-slate-200/70";
  return (
    <div aria-busy="true" aria-live="polite">
      <div className={`${bar} h-8 w-48`} />
      <div className={`${bar} mt-2 h-4 w-64`} />
      <div className={`${bar} mt-6 h-36 w-full rounded-2xl`} />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${bar} h-28 rounded-2xl`} />)}
      </div>
      <div className={`${bar} mt-6 h-64 w-full rounded-2xl`} />
    </div>
  );
}
