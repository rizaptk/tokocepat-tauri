/**
 * WebUSBPrinter.ts
 * Fixes for TypeScript 5.7+ ArrayBufferLike and Null/Undefined mapping
 */

/// <reference types="w3c-web-usb" />

export interface PrinterInfo {
  vendorId: number;
  productId: number;
  // Changed to allow null or undefined to match WebUSB spec
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
}

export class WebUSBPrinter {
  private device: USBDevice | null = null;
  private endpointNumber: number | null = null;

  async request(): Promise<PrinterInfo | null> {
    try {
      this.device = await navigator.usb.requestDevice({ filters: [] });
      return this.mapDeviceInfo(this.device);
    } catch (err) {
      console.error("User cancelled or WebUSB error:", err);
      return null;
    }
  }

  async getPairedDevices(): Promise<PrinterInfo[]> {
    const devices = await navigator.usb.getDevices();
    return devices.map((d: USBDevice) => this.mapDeviceInfo(d));
  }

  async connect(vendorId?: number, productId?: number): Promise<boolean> {
    if (!this.device && vendorId !== undefined && productId !== undefined) {
      const devices = await navigator.usb.getDevices();
      this.device = devices.find((d: USBDevice) => 
        d.vendorId === vendorId && d.productId === productId
      ) || null;
    }

    if (!this.device) throw new Error("No device selected.");

    await this.device.open();
    await this.device.selectConfiguration(1);

    const iface = this.device.configuration?.interfaces[0];
    if (!iface) throw new Error("No USB interface found.");
    await this.device.claimInterface(iface.interfaceNumber);

    const endpoint = iface.alternate.endpoints.find((e: USBEndpoint) => e.direction === 'out');
    
    if (!endpoint) throw new Error("No OUT endpoint found on printer.");
    
    this.endpointNumber = endpoint.endpointNumber;
    return true;
  }

  /**
   * Fixes the 'Uint8Array<ArrayBufferLike>' error
   */
  async print(data: Uint8Array): Promise<void> {
    if (!this.device || this.endpointNumber === null) {
      throw new Error("Printer not connected.");
    }
    
    // THE FIX: Cast the data to BufferSource or specifically Uint8Array<ArrayBuffer>
    // This tells TS that the buffer is definitely a standard ArrayBuffer, not a Shared one.
    await this.device.transferOut(this.endpointNumber, data as Uint8Array<ArrayBuffer>);
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close();
      } catch (e) {
        // Ignore if already closed
      }
      this.device = null;
      this.endpointNumber = null;
    }
  }

  private mapDeviceInfo(device: USBDevice): PrinterInfo {
    return {
      vendorId: device.vendorId,
      productId: device.productId,
      // Fixes 'string | null' is not assignable to 'string | undefined'
      // By using '?? undefined', we convert null to undefined
      manufacturerName: device.manufacturerName ?? undefined,
      productName: device.productName ?? undefined,
      serialNumber: device.serialNumber ?? undefined
    };
  }
}

export const printerManager = new WebUSBPrinter();