/** Comprime uma foto no telemóvel para cerca de 200 KB (JPEG, lado maior 1080 px). */
export async function compressImage(source: Blob | HTMLCanvasElement, maxSide = 1080, targetBytes = 200_000): Promise<Blob> {
  let canvas: HTMLCanvasElement
  if (source instanceof HTMLCanvasElement) canvas = source
  else {
    const bmp = await createImageBitmap(source)
    canvas = document.createElement('canvas')
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  }
  if (Math.max(canvas.width, canvas.height) > maxSide) {
    const c = document.createElement('canvas')
    const scale = maxSide / Math.max(canvas.width, canvas.height)
    c.width = Math.round(canvas.width * scale)
    c.height = Math.round(canvas.height * scale)
    c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height)
    canvas = c
  }
  let q = 0.82
  let blob = await toBlob(canvas, q)
  while (blob.size > targetBytes && q > 0.4) {
    q -= 0.1
    blob = await toBlob(canvas, q)
  }
  return blob
}

function toBlob(c: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falhou a compressão'))), 'image/jpeg', q))
}
