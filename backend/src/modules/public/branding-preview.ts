import { deflateSync } from 'zlib'

const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111']
}

function crc32(data: Buffer) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function parseColor(value?: string | null): [number, number, number] {
  const match = value?.trim().match(/^#([\da-f]{6})$/i)
  if (!match) return [37, 99, 235]
  const hex = match[1]
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)]
}

function initials(name: string) {
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .match(/[A-Z]+/g) || ['C']
  return (words.length === 1 ? words[0][0] : words.slice(0, 2).map(word => word[0]).join('')) || 'C'
}

/** PNG quadrado e leve, usado quando a clínica ainda não cadastrou uma imagem de logo. */
export function createClinicMonogram(name: string, primaryColor?: string | null) {
  const size = 512
  const [red, green, blue] = parseColor(primaryColor)
  const pixels = Buffer.alloc(size * size * 4)

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = red
    pixels[i + 1] = green
    pixels[i + 2] = blue
    pixels[i + 3] = 255
  }

  const letters = initials(name)
  const scale = letters.length > 1 ? 34 : 44
  const gap = Math.round(scale * 0.65)
  const glyphWidth = scale * 5
  const totalWidth = glyphWidth * letters.length + gap * (letters.length - 1)
  const startX = Math.round((size - totalWidth) / 2)
  const startY = Math.round((size - scale * 7) / 2)

  for (let letterIndex = 0; letterIndex < letters.length; letterIndex++) {
    const glyph = GLYPHS[letters[letterIndex]] || GLYPHS.C
    const offsetX = startX + letterIndex * (glyphWidth + gap)
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] !== '1') continue
        for (let y = 0; y < scale; y++) {
          for (let x = 0; x < scale; x++) {
            const px = offsetX + col * scale + x
            const py = startY + row * scale + y
            const index = (py * size + px) * 4
            pixels[index] = 255
            pixels[index + 1] = 255
            pixels[index + 2] = 255
          }
        }
      }
    }
  }

  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const outputRow = y * (size * 4 + 1)
    raw[outputRow] = 0
    pixels.copy(raw, outputRow + 1, y * size * 4, (y + 1) * size * 4)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}
