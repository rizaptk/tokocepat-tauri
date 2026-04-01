export function resizeImageWorker(
  file: File,
  maxSize: number
): Promise<string> {

  return new Promise((resolve, reject) => {

    const worker = new Worker(
      new URL("../workers/imageWorker.ts", import.meta.url),
      { type: "module" }
    )

    worker.postMessage({ file, maxSize })

    worker.onmessage = (e) => {

      if (e.data?.error) {
        reject(new Error("Image processing failed"))
      } else {
        resolve(e.data)
      }

      worker.terminate()
    }

    worker.onerror = reject

  })
}