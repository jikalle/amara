import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const COLORS = {
  earth:  '#1A1208',
  blue:   '#3B5BDB',
  purple: '#7B3FB5',
  gold:   '#F0A500',
  black:  '#1A1208',
  white:  '#FFFFFF',
}

function hexToRgba(hex, alpha = 255) {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return [r, g, b, alpha]
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
    }
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcBuf), 0)
  return Buffer.concat([len, t, data, crc])
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0
    pixels.copy(raw, rowStart + 1, y * stride, y * stride + stride)
  }

  const compressed = deflateSync(raw)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function createCanvas(width, height, color) {
  const pixels = Buffer.alloc(width * height * 4)
  const [r,g,b,a] = hexToRgba(color, 255)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4
    pixels[idx] = r
    pixels[idx + 1] = g
    pixels[idx + 2] = b
    pixels[idx + 3] = a
  }
  return pixels
}

function clearCanvas(width, height) {
  return Buffer.alloc(width * height * 4)
}

function fillRect(pixels, width, height, x, y, w, h, color) {
  const [r,g,b,a] = hexToRgba(color)
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(width, x + w)
  const y1 = Math.min(height, y + h)
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const idx = (yy * width + xx) * 4
      pixels[idx] = r
      pixels[idx + 1] = g
      pixels[idx + 2] = b
      pixels[idx + 3] = a
    }
  }
}

function fillDiamond(pixels, width, height, cx, cy, size, color) {
  const [r,g,b,a] = hexToRgba(color)
  const half = size / 2
  const x0 = Math.max(0, Math.floor(cx - half))
  const x1 = Math.min(width - 1, Math.ceil(cx + half))
  const y0 = Math.max(0, Math.floor(cy - half))
  const y1 = Math.min(height - 1, Math.ceil(cy + half))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = Math.abs(x + 0.5 - cx)
      const dy = Math.abs(y + 0.5 - cy)
      if (dx + dy <= half) {
        const idx = (y * width + x) * 4
        pixels[idx] = r
        pixels[idx + 1] = g
        pixels[idx + 2] = b
        pixels[idx + 3] = a
      }
    }
  }
}

function drawRectStroke(pixels, width, height, x, y, size, stroke, color) {
  fillRect(pixels, width, height, x, y, size, stroke, color)
  fillRect(pixels, width, height, x, y + size - stroke, size, stroke, color)
  fillRect(pixels, width, height, x, y, stroke, size, color)
  fillRect(pixels, width, height, x + size - stroke, y, stroke, size, color)
}

function buildIcon(path, size) {
  const px = createCanvas(size, size, COLORS.blue)
  const cx = size / 2
  const diamondSize = size
  const innerSize = Math.floor(size * 0.7)
  const squareSize = Math.floor(size * 0.22)
  const stroke = Math.floor(size * 0.035)

  fillDiamond(px, size, size, cx, cx, diamondSize, COLORS.purple)
  fillDiamond(px, size, size, cx, cx, innerSize, COLORS.gold)

  const sqX = Math.floor(cx - squareSize / 2)
  const sqY = Math.floor(cx - squareSize / 2)
  drawRectStroke(px, size, size, sqX, sqY, squareSize, stroke, COLORS.black)

  writeFileSync(path, encodePng(size, size, px))
}

function buildAdaptive(path, size) {
  const px = clearCanvas(size, size)
  const cx = size / 2
  const base = Math.floor(size * 0.78)
  const inner = Math.floor(size * 0.55)
  const squareSize = Math.floor(size * 0.18)
  const stroke = Math.floor(size * 0.03)

  fillRect(px, size, size, Math.floor(cx - base / 2), Math.floor(cx - base / 2), base, base, COLORS.blue)
  fillDiamond(px, size, size, cx, cx, base, COLORS.purple)
  fillDiamond(px, size, size, cx, cx, inner, COLORS.gold)

  const sqX = Math.floor(cx - squareSize / 2)
  const sqY = Math.floor(cx - squareSize / 2)
  drawRectStroke(px, size, size, sqX, sqY, squareSize, stroke, COLORS.black)

  writeFileSync(path, encodePng(size, size, px))
}

function buildSplash(path, width, height) {
  const px = createCanvas(width, height, COLORS.earth)
  const size = Math.floor(Math.min(width, height) * 0.38)
  const cx = Math.floor(width / 2)
  const cy = Math.floor(height * 0.42)

  fillRect(px, width, height, cx - size / 2, cy - size / 2, size, size, COLORS.blue)
  fillDiamond(px, width, height, cx, cy, size, COLORS.purple)
  fillDiamond(px, width, height, cx, cy, Math.floor(size * 0.72), COLORS.gold)

  const squareSize = Math.floor(size * 0.22)
  const stroke = Math.floor(size * 0.035)
  drawRectStroke(px, width, height, Math.floor(cx - squareSize / 2), Math.floor(cy - squareSize / 2), squareSize, stroke, COLORS.black)

  writeFileSync(path, encodePng(width, height, px))
}

function buildNotification(path, size) {
  const px = clearCanvas(size, size)
  const cx = size / 2
  const diamondSize = Math.floor(size * 0.78)
  fillDiamond(px, size, size, cx, cx, diamondSize, COLORS.white)
  writeFileSync(path, encodePng(size, size, px))
}

mkdirSync('apps/mobile/assets', { recursive: true })

buildIcon('apps/mobile/assets/icon.png', 1024)
buildAdaptive('apps/mobile/assets/adaptive-icon.png', 1024)
buildSplash('apps/mobile/assets/splash.png', 1242, 2436)
buildNotification('apps/mobile/assets/notification-icon.png', 256)

console.log('Generated mobile assets.')
