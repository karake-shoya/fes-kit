import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FesKit',
    short_name: 'FesKit',
    description: '模擬店出店管理アプリ',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#2b1a0d',
    theme_color: '#2b1a0d',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
