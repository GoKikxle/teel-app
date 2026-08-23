import qrcode from 'qrcode-generator';

// Pure client-side SVG QR encoding — no canvas, no network call, no backend
// dependency. Kept plain black-on-white regardless of theme/category color:
// a low-contrast QR code is a QR code that fails to scan, so this
// deliberately doesn't try to match the app's palette.
export function QRCode({ value, size = 160 }: { value: string; size?: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const svg = qr.createSvgTag({ scalable: true });

  return (
    <div
      style={{
        width: size,
        height: size,
        background: '#fff',
        borderRadius: 4,
        padding: 10,
        display: 'inline-block',
        lineHeight: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
