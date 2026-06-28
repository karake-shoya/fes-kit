import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2b1a0d',
        }}
      >
        <div
          style={{
            fontSize: 300,
            fontWeight: 900,
            color: '#e8b440',
            lineHeight: 1,
            fontFamily: 'Georgia, serif',
          }}
        >
          F
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#c89830',
            letterSpacing: 12,
            lineHeight: 1,
            fontFamily: 'Georgia, serif',
          }}
        >
          ESKIT
        </div>
      </div>
    ),
    { ...size }
  )
}
