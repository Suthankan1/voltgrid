import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * Station-detail skeleton layout used when loading equipment/detail views cleanly.
 */
export function StationDetailLoading() {
  return (
    <SkeletonGroup label="Loading charging station details" className="space-y-6">
      <div className="space-y-3 border-b border-[color:var(--vg-border)] pb-5">
        <Skeleton variant="text" className="h-5 w-44" />
        <Skeleton variant="heading" className="h-9 w-64" />
        <Skeleton variant="text" className="h-4 w-48" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map(item => (
          <Card key={item} padding="md">
            <Skeleton variant="text" className="h-4 w-24" />
            <Skeleton variant="heading" className="mt-3 h-9 w-16" />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map(item => (
          <Card key={item} padding="sm">
            <div className="flex gap-4">
              <Skeleton variant="block" className="h-28 w-24 shrink-0" />
              <div className="flex-1 space-y-2.5">
                <Skeleton variant="text" className="h-5 w-28" />
                <Skeleton variant="text" className="h-4 w-36" />
                <Skeleton variant="text" className="h-6 w-24" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </SkeletonGroup>
  );
}
