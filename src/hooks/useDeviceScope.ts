import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';
import { useSyncStore } from '@/lib/sync-store';
import { useLicense } from '@/hooks/useLicense';
import { generateDeviceFingerprint } from '@/lib/security';

export type DeviceScopeValue = 'current' | 'all' | string;

export interface DeviceInfo {
    id: string;
    name: string;
}

interface DeviceNameMap {
    [id: string]: string;
}

/**
 * Global device filter scope.
 * - 'current' = only this device (default, resets on every app start)
 * - 'all' = all devices
 * - <deviceId> = a specific synced device
 *
 * The scope only applies when the user has a sync-enabled license AND the
 * sync mode is switched on. Otherwise the scope is forced to 'current' so
 * every report/dashboard is always filtered to this device.
 */
export function useDeviceScope() {
    const { db, firesqlite, isInitialized } = useDbStore();
    const { shifts, activeShift } = useStore();
    const { status, licenseDetails } = useLicense();
    const isNetworkEnable = useSyncStore((s) => s.isNetworkEnable);

    const [scope, setScope] = useState<DeviceScopeValue>('current');
    const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(undefined);
    const [deviceNames, setDeviceNames] = useState<DeviceNameMap>({});

    const isLicensed = status === 'VALID' || status === 'EXPIRES_SOON';
    const syncAllowed = isLicensed && licenseDetails?.isSyncAvailable === true && isNetworkEnable === true;

    // Fall back to "this device" whenever sync is disabled or the license is lost.
    useEffect(() => {
        if (!syncAllowed) setScope('current');
    }, [syncAllowed]);

    useEffect(() => {
        generateDeviceFingerprint().then(setCurrentDeviceId).catch(() => setCurrentDeviceId(undefined));
    }, []);

    // Fetch friendly names from the synced __firelite_security collection
    useEffect(() => {
        if (!isInitialized || !firesqlite || !db) return;
        const { collection, onSnapshot } = firesqlite;
        const unsubscribe = onSnapshot(collection(db, '__firelite_security'), (snap: any) => {
            const map: DeviceNameMap = {};
            snap.docs.forEach((d: any) => {
                const data = d.data();
                if (d.id && data?.name) map[d.id] = data.name;
            });
            setDeviceNames(map);
        });
        return () => { if (unsubscribe) unsubscribe(); };
    }, [isInitialized, firesqlite, db]);

    // Derive the list of known devices from shifts (every device opens shifts),
    // joined with friendly names.
    const devices = useMemo<DeviceInfo[]>(() => {
        const ids = new Set<string>([...(currentDeviceId ? [currentDeviceId] : [])]);
        shifts?.forEach((s) => { if (s.device) ids.add(s.device); });
        return Array.from(ids).map((id) => ({
            id,
            name: deviceNames[id] || (id === currentDeviceId ? 'Perangkat Ini' : id),
        }));
    }, [shifts, currentDeviceId, deviceNames]);

    const effectiveScope: DeviceScopeValue = syncAllowed ? scope : 'current';

    const activeDeviceId = useMemo<string | undefined>(() => {
        if (effectiveScope === 'all') return undefined;
        if (effectiveScope === 'current') return currentDeviceId ?? activeShift?.device;
        return effectiveScope;
    }, [effectiveScope, currentDeviceId, activeShift?.device]);

    const setScopeSafe = useCallback((value: DeviceScopeValue) => {
        if (!syncAllowed && value !== 'current') return;
        setScope(value);
    }, [syncAllowed]);

    const resolveScope = useCallback((id?: string): string | undefined => {
        if (!id || id === 'all') return undefined;
        return id;
    }, []);

    return {
        scope: effectiveScope,
        setScope: setScopeSafe,
        currentDeviceId,
        activeDeviceId,
        devices,
        resolveScope,
        syncAllowed,
    };
}