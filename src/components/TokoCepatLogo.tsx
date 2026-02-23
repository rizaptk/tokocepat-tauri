import { Package } from 'lucide-react';

export function TokoCepatLogo() {
  return (
    <div className="flex items-center gap-2">
      <Package className="h-7 w-7 text-primary" />
      <h1 className="text-xl font-bold text-foreground">
        TokoCepat
      </h1>
    </div>
  );
}
