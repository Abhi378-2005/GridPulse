import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Skeleton loading component with shimmer animation.
 * Use for placeholder content while data is loading.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  )
}

/** Skeleton for a metric card in the sidebar */
function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton for the chart panel */
function ChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card h-full flex flex-col">
      <div className="p-4 pb-2 border-b">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex-1 p-4 flex items-end gap-1">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the order book panel */
function OrderBookSkeleton() {
  return (
    <div className="rounded-xl border bg-card h-full flex flex-col">
      <div className="p-4 pb-2 border-b flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex-1 p-3 space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`ask-${i}`} className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
        <div className="my-2 py-1.5 border-y">
          <Skeleton className="h-4 w-20 mx-auto" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`bid-${i}`} className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the trade ticker */
function TradeTickerSkeleton() {
  return (
    <div className="rounded-xl border bg-card h-full flex flex-col">
      <div className="p-4 pb-2 border-b flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="flex-1 p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border p-2.5 space-y-2">
            <div className="flex justify-between">
              <div className="flex gap-1.5">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export {
  Skeleton,
  MetricCardSkeleton,
  ChartSkeleton,
  OrderBookSkeleton,
  TradeTickerSkeleton,
}
