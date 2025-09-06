import fs from 'fs'

const MAX_BYTES = 512

function isBinaryBuffer(buffer, bytesRead) {
  if (bytesRead === 0) return false
  const totalBytes = Math.min(bytesRead, MAX_BYTES)
  if (bytesRead >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return false
  if (
    bytesRead >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0xfe &&
    buffer[3] === 0xff
  ) {
    return false
  }
  if (
    bytesRead >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xfe &&
    buffer[2] === 0x00 &&
    buffer[3] === 0x00
  ) {
    return false
  }
  if (
    bytesRead >= 4 &&
    buffer[0] === 0x84 &&
    buffer[1] === 0x31 &&
    buffer[2] === 0x95 &&
    buffer[3] === 0x33
  ) {
    return false
  }
  if (totalBytes >= 5 && buffer.slice(0, 5).toString() === '%PDF-') return true
  if (bytesRead >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return false
  if (bytesRead >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return false
  let suspiciousBytes = 0
  for (let i = 0; i < totalBytes; i += 1) {
    const byte = buffer[i]
    if (byte === 0) return true
    if ((byte < 7 || byte > 14) && (byte < 32 || byte > 127)) {
      if (byte >= 0xc0 && byte <= 0xdf && i + 1 < totalBytes) {
        const next = buffer[i + 1]
        if (next >= 0x80 && next <= 0xbf) {
          i += 1
          continue
        }
      } else if (byte >= 0xe0 && byte <= 0xef && i + 2 < totalBytes) {
        const next = buffer[i + 1]
        const next2 = buffer[i + 2]
        if (next >= 0x80 && next <= 0xbf && next2 >= 0x80 && next2 <= 0xbf) {
          i += 2
          continue
        }
      } else if (byte >= 0xf0 && byte <= 0xf7 && i + 3 < totalBytes) {
        const next = buffer[i + 1]
        const next2 = buffer[i + 2]
        const next3 = buffer[i + 3]
        if (
          next >= 0x80 &&
          next <= 0xbf &&
          next2 >= 0x80 &&
          next2 <= 0xbf &&
          next3 >= 0x80 &&
          next3 <= 0xbf
        ) {
          i += 3
          continue
        }
      }
      suspiciousBytes += 1
      if (i >= 32 && (suspiciousBytes * 100) / totalBytes > 10) return true
    }
  }
  if ((suspiciousBytes * 100) / totalBytes > 10) return true
  return false
}

export async function isBinaryFile(filePath) {
  const handle = await fs.promises.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(MAX_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, MAX_BYTES, 0)
    return isBinaryBuffer(buffer, bytesRead)
  } finally {
    await handle.close()
  }
}

export function isBinaryFileSync(filePath) {
  const handle = fs.openSync(filePath, 'r')
  try {
    const buffer = Buffer.alloc(MAX_BYTES)
    const bytesRead = fs.readSync(handle, buffer, 0, MAX_BYTES, 0)
    return isBinaryBuffer(buffer, bytesRead)
  } finally {
    fs.closeSync(handle)
  }
}
