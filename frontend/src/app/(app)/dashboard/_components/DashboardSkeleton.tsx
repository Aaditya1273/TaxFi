'use client';

export default function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-10 w-72 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-5 w-48 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div className="h-12 w-40 bg-gray-200 rounded-2xl animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-3xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
