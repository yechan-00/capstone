const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const htmlPath = path.join(distDir, 'index.html');
const baseUrl = 'https://regret-wallet-3db60.web.app';
const invite = '놀러오셔서 추억을 기록해봐요!';
const MATERIAL_ICONS_URL = '/MaterialIcons.ttf';

if (!fs.existsSync(htmlPath)) {
  console.warn('[patch-index-html] dist/index.html not found, skip');
  process.exit(0);
}

function buildWebStyles() {
  return `
<style id="regret-wallet-web">
  html, body {
    height: 100%;
    width: 100%;
    margin: 0;
    background: #f5f6f8;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      'Noto Sans KR', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', sans-serif;
  }
  #root {
    display: flex;
    flex: 1;
    width: 100%;
    min-height: 100%;
  }
  @font-face {
    font-family: "material";
    src: url('${MATERIAL_ICONS_URL}') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
</style>
<link rel="preload" href="${MATERIAL_ICONS_URL}" as="font" type="font/ttf" crossorigin="anonymous" />
`;
}

function buildOgBlock() {
  return `
<meta property="og:type" content="website" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:site_name" content="후회가계부" />
<meta property="og:title" content="후회가계부 · RegretWallet" />
<meta property="og:description" content="${invite}" />
<meta property="og:image" content="${baseUrl}/og-brand.png" />
<meta property="og:url" content="${baseUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${baseUrl}/og-brand.png" />
<link rel="icon" href="/og-brand.png" />
`;
}

function patchJsBundle() {
  const jsDir = path.join(distDir, '_expo/static/js/web');
  if (!fs.existsSync(jsDir)) return;

  for (const file of fs.readdirSync(jsDir)) {
    if (!file.endsWith('.js')) continue;
    const filePath = path.join(jsDir, file);
    const before = fs.readFileSync(filePath, 'utf8');
    const after = before.replace(
      /\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/MaterialIcons\.[a-f0-9]+\.ttf/g,
      MATERIAL_ICONS_URL,
    );
    if (after !== before) {
      fs.writeFileSync(filePath, after);
      console.log(`[patch-index-html] MaterialIcons path → ${MATERIAL_ICONS_URL} in ${file}`);
    }
  }
}

let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace('<html lang="en">', '<html lang="ko">');
html = html.replace(/<style id="regret-wallet-web">[\s\S]*?<\/style>\s*/g, '');
html = html.replace(/<link rel="preload" href="[^"]*MaterialIcons[^"]*"[^>]*>\s*/g, '');
html = html.replace('</head>', `${buildWebStyles()}</head>`);

if (!html.includes('og:image')) {
  html = html.replace('</head>', `${buildOgBlock()}</head>`);
}

fs.writeFileSync(htmlPath, html);
patchJsBundle();
console.log(`[patch-index-html] web styles + ${MATERIAL_ICONS_URL} injected`);
