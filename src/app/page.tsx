'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const PosApp = dynamic(() => import('@/components/PosApp'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full bg-muted/40 p-4 gap-4 md:p-6">
      <div className="flex flex-col flex-1 gap-4 md:gap-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 18 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="hidden md:flex h-full w-full max-w-sm rounded-lg" />
    </div>
  )
});

export default function PosPage() {
  return <PosApp />;
}
