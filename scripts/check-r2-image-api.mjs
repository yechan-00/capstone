#!/usr/bin/env node
/**
 * R2 Worker 연결 상태만 확인합니다.
 * 비밀키를 읽거나 출력하지 않습니다. Firestore/R2 객체는 변경하지 않습니다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readPublicApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_R2_IMAGE_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return null;

  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((row) => row.startsWith('EXPO_PUBLIC_R2_IMAGE_API_URL='));
  if (!line) return null;
  const value = line.slice('EXPO_PUBLIC_R2_IMAGE_API_URL='.length).trim().replace(/^["']|["']$/g, '');
  return value ? value.replace(/\/$/, '') : null;
}

const base = readPublicApiUrl();
if (!base) {
  console.log('R2 설정: EXPO_PUBLIC_R2_IMAGE_API_URL 없음 (.env.example 참고)');
  process.exit(1);
}

let host = '';
try {
  host = new URL(base).host;
} catch {
  console.log('R2 설정: Worker URL 형식이 올바르지 않습니다');
  process.exit(1);
}

try {
  const response = await fetch(`${base}/health`, { method: 'GET' });
  const body = await response.json().catch(() => null);
  const ok = response.ok && body && body.ok === true && body.storage === 'r2';
  console.log(`R2 Worker 호스트: ${host}`);
  console.log(`R2 health: ${ok ? 'ok' : `fail (${response.status})`}`);
  process.exit(ok ? 0 : 2);
} catch {
  console.log(`R2 Worker 호스트: ${host}`);
  console.log('R2 health: 네트워크 오류 (배포 여부·도메인을 확인하세요)');
  process.exit(2);
}
