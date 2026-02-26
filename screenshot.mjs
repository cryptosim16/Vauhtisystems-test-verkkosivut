import { mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const url   = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

const screenshotsDir = join(__dirname, 'temporary screenshots');

async function getNextN() {
  try {
    const files = await readdir(screenshotsDir);
    const nums  = files
      .map(f => f.match(/^screenshot-(\d+)/))
      .filter(Boolean)
      .map(m => parseInt(m[1]));
    return nums.length ? Math.max(...nums) + 1 : 1;
  } catch { return 1; }
}

async function tryImport(p) {
  // Puppeteer ships both CJS and ESM; import the ESM entry directly
  const esmEntry = join(p, 'lib', 'esm', 'puppeteer', 'puppeteer.js');
  const fileUrl  = pathToFileURL(resolve(esmEntry)).href;
  const mod = await import(fileUrl);
  return mod.default ?? mod;
}

async function main() {
  await mkdir(screenshotsDir, { recursive: true });

  const username = process.env.USERNAME || process.env.USER || 'user';
  const puppeteerPaths = [
    `C:\\Users\\sisum\\AppData\\Local\\Temp\\puppeteer-test\\node_modules\\puppeteer`,
    `C:\\Users\\${username}\\AppData\\Local\\Temp\\puppeteer-test\\node_modules\\puppeteer`,
    `C:\\Users\\nateh\\AppData\\Local\\Temp\\puppeteer-test\\node_modules\\puppeteer`,
  ];

  let puppeteer;
  for (const p of puppeteerPaths) {
    try {
      puppeteer = await tryImport(p);
      console.log(`Using puppeteer from: ${p}`);
      break;
    } catch (e) {
      // try next
    }
  }

  // Fallback: try bare specifier
  if (!puppeteer) {
    try {
      const mod = await import('puppeteer');
      puppeteer = mod.default ?? mod;
    } catch {}
  }

  if (!puppeteer) {
    console.error('Puppeteer not found. Paths tried:\n' + puppeteerPaths.join('\n'));
    process.exit(1);
  }

  const n = await getNextN();
  const filename = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
  const outputPath = join(screenshotsDir, filename);

  const chromePaths = [
    `C:\\Users\\${username}\\.cache\\puppeteer`,
    `C:\\Users\\nateh\\.cache\\puppeteer`,
    undefined,
  ];

  let browser;
  for (const cacheDir of chromePaths) {
    try {
      const opts = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      };
      if (cacheDir) {
        // Let puppeteer find chrome in that cache dir by setting env
        process.env.PUPPETEER_CACHE_DIR = cacheDir;
      }
      browser = await puppeteer.launch(opts);
      break;
    } catch {}
  }

  if (!browser) {
    console.error('Could not launch browser.');
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));

  // Trigger all scroll-animation elements so the full page is visible in screenshot
  await page.evaluate(() => {
    document.querySelectorAll('.anim').forEach(el => {
      el.classList.add('visible');
    });
  });
  await new Promise(r => setTimeout(r, 700));

  await page.screenshot({ path: outputPath, fullPage: true });
  await browser.close();

  console.log(`Screenshot saved → ${outputPath}`);
}

main().catch(err => {
  console.error('Screenshot failed:', err.message);
  process.exit(1);
});
