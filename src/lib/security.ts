
import { invoke } from "@tauri-apps/api/core";

export async function generateDeviceFingerprint(): Promise<string> {
    return new Promise( async(resolve, reject) => {

        try {
            const onSession = window.sessionStorage.getItem('hwid');
            if (onSession) {
                resolve(onSession);
                return;
            }
            const hwid = await invoke("get_license_hwid");
            window.sessionStorage.setItem('hwid', hwid as string);
            resolve(hwid as string);
        } catch (error) {
            console.error("Failed to get HWID", error);
            reject(error);
        }
    })
}