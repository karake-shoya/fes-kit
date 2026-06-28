import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2b1a0d',
        }}
      >
        <div
          style={{
            fontSize: 108,
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
            fontSize: 26,
            fontWeight: 700,
            color: '#c89830',
            letterSpacing: 4,
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
