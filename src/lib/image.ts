// Client-side image compression to a JPEG data URL under a size cap.
// @ts-nocheck
export function compressImage(file, maxKB = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height, maxDim = 640
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
        else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        let q = 0.8, out = c.toDataURL('image/jpeg', q)
        while (out.length > maxKB * 1024 * 1.37 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q) }
        resolve(out)
      }
      img.onerror = reject; img.src = e.target.result
    }
    reader.onerror = reject; reader.readAsDataURL(file)
  })
}

