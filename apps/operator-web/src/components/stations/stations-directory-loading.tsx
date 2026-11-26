import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * Stations directory loading skeleton preserving layout dimensions while
 * scoped inside page Suspense so child missing routes still return HTTP 404.
 */
export function StationsDirectoryLoading() {
  return (
    <SkeletonGroup label="Loading charging stations directory" className="space-y-6">
      <div className="border-b border-[color:var(--vg-border)] pb-5">
        <Skeleton variant="heading" className="h-9 w-56" />
        <Skeleton variant="text" className="mt-2 h-5 w-72" />
      </div>

      <Card padding="sm">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(item => (
            <div key={item}>
              <Skeleton variant="text" className="h-3 w-24" />
              <Skeleton variant="heading" className="mt-2 h-7 w-14" />
            </div>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <Skeleton variant="text" className="h-5 w-40" />
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
          <Skeleton variant="block" className="h-11 w-full" />
          <Skeleton variant="block" className="h-11 w-full" />
          <Skeleton variant="block" className="h-11 w-28" />
        </div>
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3, 4].map(row => (
            <Skeleton key={row} variant="text" className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </SkeletonGroup>
  );
}
