import { Skeleton } from "../ui/skeleton";

export function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <Icon className="size-12 text-muted-foreground" />
      <p className="font-semibold text-base">{title}</p>
      <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">{sub}</p>
    </div>
  );
}
