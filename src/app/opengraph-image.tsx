import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '134+ | הכנה לאמירנ"ט';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        }}
      >
        <div style={{ fontSize: 120, marginBottom: 10 }}>🎓</div>
        <div style={{ display: 'flex', fontSize: 130, fontWeight: 900, color: 'white' }}>
          134<span style={{ color: '#60a5fa' }}>+</span>
        </div>
        <div style={{ fontSize: 40, color: '#94a3b8', marginTop: 20 }}>
          AMIRAM / AMIRNET Exam Prep
        </div>
      </div>
    ),
    { ...size }
  );
}
