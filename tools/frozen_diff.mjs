// Compare layout exports with a git reference before sample/building migrations.
// Usage: node tools/frozen_diff.mjs <ref> [--allow plots,samples,buildings,structures]
// The migration-related exports may change by default; road geometry and derived
// street infrastructure are always frozen.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.argv[2];
if (!ref) {
  console.error('Usage: node tools/frozen_diff.mjs <ref> [--allow key1,key2,...]');
  process.exit(2);
}
const allowArg = process.argv.find(a => a.startsWith('--allow='))?.slice('--allow='.length)
  ?? (process.argv.includes('--allow') ? process.argv[process.argv.indexOf('--allow') + 1] : 'plots,samples,buildings,structures');
const allowed = new Set(allowArg.split(',').map(s => s.trim()).filter(Boolean));
const migrationKeys = new Set(['plots', 'samples', 'buildings', 'structures']);
for (const key of allowed) if (!migrationKeys.has(key)) {
  console.error(`Refusing to allow non-migration layout key: ${key}`);
  process.exit(2);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frozen-layout-'));
try {
  const oldFile = path.join(tempDir, 'layout.cjs');
  fs.writeFileSync(oldFile, execFileSync('git', ['show', `${ref}:layout.js`], { cwd: root, encoding: 'utf8' }));
  const before = createRequire(import.meta.url)(oldFile);
  const after = createRequire(import.meta.url)(path.join(root, 'layout.js'));
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changed = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.push(key);
  }
  const denied = changed.filter(key => !allowed.has(key));
  const frozen = ['roads', 'furniture', 'poleLines', 'puddles', 'legacyFurniture', 'grates'];
  const frozenChanged = changed.filter(key => frozen.includes(key));
  if (denied.length || frozenChanged.length) {
    console.error(`FAIL layout differs from ${ref}`);
    if (denied.length) console.error(`unexpected changed exports: ${denied.join(', ')}`);
    if (frozenChanged.length) console.error(`frozen exports changed: ${frozenChanged.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS layout matches ${ref}; allowed migration exports changed: ${changed.length ? changed.join(', ') : 'none'}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
