import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';

export function getLocalIp(): string {
  const ifaces = networkInterfaces();
  const candidates: string[] = [];
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] ?? []) {
      if (info.family === 'IPv4' && !info.internal) candidates.push(info.address);
    }
  }
  return candidates.find((ip) => ip.startsWith('192.168.'))
    ?? candidates.find((ip) => ip.startsWith('10.'))
    ?? candidates.find((ip) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip))
    ?? candidates[0] ?? '127.0.0.1';
}

export const qrDataUrl = (url: string) => QRCode.toDataURL(url, { margin: 1, width: 320 });
export const qrTerminal = (url: string) => QRCode.toString(url, { type: 'terminal', small: true });
