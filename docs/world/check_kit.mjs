// Integrity check for the planet reference kit (docs/world).
//   node docs/world/check_kit.mjs          → structure, prompts, links, hidden-clue alignment; references may be pending
//   node docs/world/check_kit.mjs --refs   → additionally require every reference image to exist
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const requireRefs = process.argv.includes('--refs');
const catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
const prompts = JSON.parse(fs.readFileSync(path.join(dir, 'IMAGE_PROMPTS.json'), 'utf8')).prompts;
const errors = [];
const assert = (v, m) => { if (!v) errors.push(m); };

const TYPES = { style: 'ST', biome: 'BI', transition: 'TR', road: 'RD', landmark: 'LM' };
const REF_STATUS = ['pending', 'generated', 'generated-with-issues'];
const ids = catalog.map(r => r.id);
assert(new Set(ids).size === ids.length, 'duplicate card ids');
assert(prompts.length === catalog.length && prompts.every(p => ids.includes(p.id)), 'prompt coverage');
const cardFiles = fs.readdirSync(path.join(dir, 'cards')).filter(f => /^[A-Z]{2}\d{2}\.md$/.test(f));
assert(cardFiles.length === catalog.length, `card files ${cardFiles.length} ≠ catalog ${catalog.length}`);

let refs = 0, pending = 0, bytes = 0;
for (const r of catalog) {
  assert(TYPES[r.type] && r.id.startsWith(TYPES[r.type]), `${r.id} type/prefix mismatch`);
  assert(REF_STATUS.includes(r.referenceStatus), `${r.id} invalid referenceStatus`);
  const card = path.join(dir, r.card);
  assert(fs.existsSync(card), `${r.id} missing card`);
  const p = prompts.find(p => p.id === r.id);
  assert(p && p.prompt.includes(`Card ID: ${r.id}.`), `${r.id} prompt does not name its card`);
  assert(Array.isArray(r.views) && r.views.length > 0, `${r.id} missing view definitions`);
  if (r.type === 'landmark') assert(Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180, `${r.id} anchor out of range`);
  const ref = path.join(dir, r.reference), has = fs.existsSync(ref);
  if (has) {
    const b = fs.readFileSync(ref);
    assert(b[0] === 0xff && b[1] === 0xd8, `${r.id} reference is not a JPEG`);
    bytes += b.length; refs++;
    assert(r.referenceStatus !== 'pending', `${r.id} reference exists but catalog still says pending`);
    if (fs.existsSync(card)) assert(!/referenceStatus: pending/.test(fs.readFileSync(card, 'utf8')), `${r.id} card review record still pending`);
  } else {
    pending++;
    assert(r.referenceStatus === 'pending', `${r.id} catalog says ${r.referenceStatus} but the image is missing`);
    if (requireRefs) errors.push(`${r.id} reference image missing`);
  }
}

// Hidden clues LM05, LM06, LM07 must lie on one great circle (WORLD_PLAN.md WC11), within 0.5°.
{
  const D = Math.PI / 180, v = ({ lat, lon }) => [Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D), Math.cos(lat * D) * Math.cos(lon * D)];
  const [a, b, c] = ['LM05', 'LM06', 'LM07'].map(id => v(catalog.find(r => r.id === id)));
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = Math.hypot(...n);
  const off = Math.abs(Math.asin((n[0] * c[0] + n[1] * c[1] + n[2] * c[2]) / len)) / D;
  assert(off <= 0.5, `LM05/LM06/LM07 are ${off.toFixed(2)}° off a common great circle`);
}

// Local links in docs/world and WORLD_PLAN.md
let links = 0;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of [...walk(dir).filter(f => f.endsWith('.md')), path.join(root, 'WORLD_PLAN.md')]) {
  const s = fs.readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of s.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    if (/^(https?:|#)/.test(m[1])) continue;
    const dest = path.resolve(path.dirname(f), decodeURI(m[1].split('#')[0]));
    assert(fs.existsSync(dest), `broken link ${path.relative(root, f)} -> ${m[1]}`);
    links++;
  }
}

if (errors.length) { console.error('FAIL\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`PASS: ${catalog.length} cards, ${prompts.length} prompts, ${links} local links; references ${refs} generated, ${pending} pending` +
  (refs ? ` (${(bytes / 1048576).toFixed(1)} MiB)` : '') + '; hidden clues aligned');
