function Bone({ className }: { className?: string }) {
  return (
    <div className={`bg-gray-200 rounded-lg animate-pulse ${className ?? ''}`} />
  );
}

export function SkeletonQuestions() {
  return (
    <div className="space-y-5">
      <Bone className="h-7 w-48" />
      <Bone className="h-4 w-72" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
          <Bone className="h-3 w-20" />
          <Bone className="h-4 w-full" />
          <Bone className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonAnalysis() {
  return (
    <div className="space-y-5">
      <Bone className="h-7 w-56" />
      <Bone className="h-4 w-80" />
      <div className="bg-teal-50 rounded-xl p-4 space-y-2">
        <Bone className="h-3 w-24" />
        <Bone className="h-4 w-full" />
      </div>
      <Bone className="h-12 w-full" />
      <Bone className="h-20 w-full" />
      <Bone className="h-20 w-full" />
    </div>
  );
}

export function SkeletonMVP() {
  return (
    <div className="space-y-5">
      <Bone className="h-7 w-52" />
      <Bone className="h-4 w-72" />
      <div className="bg-teal-50 rounded-xl p-4 flex items-center gap-3">
        <Bone className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Bone className="h-3 w-24" />
          <Bone className="h-4 w-32" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
          <Bone className="h-6 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-4 w-40" />
            <Bone className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonSummary() {
  return (
    <div className="space-y-5">
      <Bone className="h-7 w-60" />
      <Bone className="h-4 w-72" />
      <div className="border rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
        <Bone className="w-36 h-36 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 w-full">
          <Bone className="h-3 w-24" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-5/6" />
          <Bone className="h-4 w-4/6" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 space-y-2 border">
          <Bone className="h-4 w-24" />
          {[1, 2, 3].map((i) => <Bone key={i} className="h-3 w-full" />)}
        </div>
        <div className="rounded-2xl p-5 space-y-2 border">
          <Bone className="h-4 w-28" />
          {[1, 2, 3].map((i) => <Bone key={i} className="h-3 w-full" />)}
        </div>
      </div>
    </div>
  );
}
