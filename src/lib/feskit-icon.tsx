import { ImageResponse } from 'next/og'

let cachedFont: ArrayBuffer | null = null

async function getPlayfairFont(): Promise<ArrayBuffer | undefined> {
  if (cachedFont) return cachedFont
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const url = css.match(/url\(([^)]+\.woff2[^)]*)\)/)?.[1]
    if (!url) return undefined
    const data = await fetch(url).then(r => r.arrayBuffer())
    cachedFont = data
    return data
  } catch {
    return undefined
  }
}

export async function createFeskitIcon(size: { width: number; height: number }): Promise<ImageResponse> {
  const { width, height } = size
  const s = width / 512
  const font = await getPlayfairFont()
  const serif = font ? { fontFamily: 'Playfair Display' } : {}

  return new ImageResponse(
    (
      <div
        style={{
          ...size,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2b1a0d',
        }}
      >
        <div style={{ fontSize: Math.round(300 * s), fontWeight: 900, color: '#e8b440', lineHeight: 1, ...serif }}>
          F
        </div>
        <div style={{ fontSize: Math.round(72 * s), fontWeight: 700, color: '#c89830', letterSpacing: Math.round(12 * s), lineHeight: 1, ...serif }}>
          ESKIT
        </div>
      </div>
    ),
    {
      ...size,
      ...(font && { fonts: [{ name: 'Playfair Display', data: font, weight: 900, style: 'normal' }] }),
    }
  )
}
