self.onmessage = async (event: MessageEvent) => {
  const { file, maxSize } = event.data

  try {

    const bitmap = await createImageBitmap(file)

    let { width, height } = bitmap

    if (width > height) {
      if (width > maxSize) {
        height = height * (maxSize / width)
        width = maxSize
      }
    } else {
      if (height > maxSize) {
        width = width * (maxSize / height)
        height = maxSize
      }
    }

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")

    if (!ctx) throw new Error("Canvas context failed")

    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await canvas.convertToBlob({
      type: "image/webp",
      quality: 0.9
    })

    const base64 = await blobToBase64(blob)

    postMessage(base64)

  } catch (err) {

    postMessage({ error: true })

  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}