import { MonitorIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceScope, DeviceInfo } from "@/hooks/useDeviceScope";

interface DeviceScopeFilterProps {
  className?: string;
}

export function DeviceScopeFilter({ className }: DeviceScopeFilterProps) {
    const { scope, setScope, devices, currentDeviceId } = useDeviceScope();

    const sorted: DeviceInfo[] = [...devices].sort((a, b) => {
        if (a.id === currentDeviceId) return -1;
        if (b.id === currentDeviceId) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className={className}>
            <Select value={scope} onValueChange={(v) => setScope(v)}>
                <SelectTrigger className="w-full sm:w-52">
                    <span className="flex items-center gap-2">
                        <MonitorIcon className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Perangkat" />
                    </span>
                </SelectTrigger>
                <SelectContent align="end">
                    <SelectItem value="current">Perangkat Ini</SelectItem>
                    <SelectItem value="all">Semua Perangkat</SelectItem>
                    {sorted.length > 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">Perangkat lain</div>
                    )}
                    {sorted.filter(d => d.id !== currentDeviceId).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}