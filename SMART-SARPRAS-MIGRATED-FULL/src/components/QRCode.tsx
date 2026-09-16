import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';

interface QRCodeGeneratorProps {
  value: string;
  title?: string;
  size?: number;
}

export default function QRCodeGenerator({ value, title, size = 200 }: QRCodeGeneratorProps) {
  const downloadQR = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    canvas.width = size + 40;
    canvas.height = size + 80;
    img.onload = () => {
      ctx && (ctx.fillStyle = '#ffffff');
      ctx && ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx && ctx.drawImage(img, 20, 20);
      if (title) {
        ctx && (ctx.fillStyle = '#1e293b');
        ctx && (ctx.font = 'bold 14px system-ui');
        ctx && (ctx.textAlign = 'center');
        ctx && ctx.fillText(title, canvas.width / 2, size + 55);
      }
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qr-${value}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
      <div className="p-4 bg-white rounded-2xl shadow-lg">
        <QRCodeSVG id="qr-code" value={value} size={size} level="H" includeMargin bgColor="#ffffff" fgColor="#1e293b" />
      </div>
      {title && <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={downloadQR} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-200 dark:hover:bg-slate-600">
          <Download className="w-4 h-4" />Download
        </button>
      </div>
    </motion.div>
  );
}
