#!/usr/bin/env node
/**
 * Metro/Expo can hang indefinitely when the project path contains non-ASCII
 * characters (e.g. Korean folder names). Fail fast with a clear message.
 */
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const ascii = /^[\x00-\x7F]*$/;

if (!ascii.test(projectRoot)) {
  console.error('');
  console.error('  [RegretWallet] Metro cannot bundle from a non-ASCII project path.');
  console.error(`  Current path: ${projectRoot}`);
  console.error('');
  console.error('  Fix (recommended): rename the project folder to ASCII only, e.g.');
  console.error('    ~/Desktop/regret-wallet');
  console.error('');
  console.error('  Then reopen the folder in Cursor and run: npm start');
  console.error('');
  process.exit(1);
}
