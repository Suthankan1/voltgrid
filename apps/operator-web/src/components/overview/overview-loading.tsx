import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * Overview loading skeleton preserving layout structure and dimensions while streaming.
 */
export function OverviewLoading() {
  return (
    <SkeletonGroup label="Loading network overview" className="space-y-6">
      <div className="border-b border-[color:var(--vg-border)] pb-5">
        <Skeleton variant="heading" className="h-9 w-40" />
        <Skeleton variant="text" className="mt-2 h-5 w-64" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(item => (
          <Card key={item} padding="md">
            <Skeleton variant="text" className="h-4 w-28" />
            <Skeleton variant="heading" className="mt-3 h-10 w-20" />
            <Skeleton variant="text" className="mt-2 h-4 w-40" />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map(item => (
          <Card key={item} padding="md">
            <Skeleton variant="text" className="h-5 w-44" />
            <Skeleton variant="text" className="mt-2 h-4 w-64" />
            <Skeleton variant="block" className="mt-4 h-3 w-full rounded-full" />
            <Skeleton variant="text" className="mt-3 h-4 w-56" />
          </Card>
        ))}
      </div>

      <Card padding="md">
        <Skeleton variant="text" className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map(row => (
            <Skeleton key={row} variant="text" className="h-11 w-full" />
          ))}
        </div>
      </Card>
    </SkeletonGroup>
  );
}
