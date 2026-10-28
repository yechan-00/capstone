#!/usr/bin/env node
/**
 * Print Expo Go URL, QR code, and deployed web link before Metro starts.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const qrcode = require('qrcode-terminal');

const WEB_APP_URL = (
  process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://regret-wallet-3db60.web.app'
).replace(/\/$/, '');

const port = process.env.EXPO_DEV_SERVER_PORT ?? process.env.RCT_METRO_PORT ?? '8081';

function detectLanIp() {
  if (process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    return process.env.REACT_NATIVE_PACKAGER_HOSTNAME;
  }
  try {
    return execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
  } catch {
    return 'localhost';
  }
}

const lanIp = detectLanIp();
const expoGoUrl = `exp://${lanIp}:${port}`;

console.log('');
console.log('  ── Expo Go (휴대폰) ──');
console.log(`  ${expoGoUrl}`);
console.log('');
console.log('  Expo Go 앱에서 QR 스캔 (또는 아래 QR):');
qrcode.generate(expoGoUrl, { small: true });
console.log('');
console.log('  ── 웹 ──');
console.log(`  배포 사이트: ${WEB_APP_URL}`);
console.log(`  로컬 웹: 서버 시작 후 터미널에서 w 키 (또는 npm run web)`);
console.log('');
console.log('  Safari/Chrome에서 exp:// 링크를 열면 expo-platform 오류가 날 수 있어요.');
console.log('');
