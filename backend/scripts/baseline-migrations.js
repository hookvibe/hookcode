const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'prisma', 'migrations');
const dirs = fs.readdirSync(dir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

const rows = [];
for (const id of dirs) {
  const fp = path.join(dir, id, 'migration.sql');
  if (!fs.existsSync(fp)) continue;
  const sql = fs.readFileSync(fp, 'utf8');
  const hash = crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
  rows.push(`('${id}', '${hash}', 'baseline')`);
}

console.log(`CREATE TABLE IF NOT EXISTS "hookcode_schema_migrations" (
  "id" TEXT PRIMARY KEY,
  "checksum_sha256" TEXT NOT NULL,
  "applied_reason" TEXT NOT NULL DEFAULT 'migrate',
  "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`);
console.log('');
console.log('INSERT INTO "hookcode_schema_migrations" (id, checksum_sha256, applied_reason) VALUES');
console.log(rows.join(',\n'));
console.log('ON CONFLICT (id) DO NOTHING;');
