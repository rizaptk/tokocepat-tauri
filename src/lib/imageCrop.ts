export async function cropImage(
  imageSrc: string,
  pixelCrop: { width: number; height: number; x: number; y: number },
  maxSize = 512
): Promise<string> {

  const image = new Image()
  image.src = imageSrc

  await new Promise((resolve) => (image.onload = resolve))

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  const scale = Math.min(
    maxSize / pixelCrop.width,
    maxSize / pixelCrop.height,
    1
  )

  const width = pixelCrop.width * scale
  const height = pixelCrop.height * scale

  canvas.width = width
  canvas.height = height

  ctx?.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height
  )

  return canvas.toDataURL("image/webp", 0.9)
}