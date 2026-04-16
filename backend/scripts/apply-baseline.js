const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const dir = path.join(__dirname, '..', 'prisma', 'migrations');
  const dirs = fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const migrations = [];
  for (const id of dirs) {
    const fp = path.join(dir, id, 'migration.sql');
    if (!fs.existsSync(fp)) continue;
    const sql = fs.readFileSync(fp, 'utf8');
    const hash = crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
    migrations.push({ id, hash });
  }

  const client = new Client({
    connectionString: 'postgresql://hookcode_admin:duiasutet1238hzdas@yuhe.space:7214/hookcode?schema=public'
  });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS "hookcode_schema_migrations" (
      "id" TEXT PRIMARY KEY,
      "checksum_sha256" TEXT NOT NULL,
      "applied_reason" TEXT NOT NULL DEFAULT 'migrate',
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const m of migrations) {
    await client.query(
      `INSERT INTO "hookcode_schema_migrations" (id, checksum_sha256, applied_reason) VALUES ($1, $2, 'baseline') ON CONFLICT (id) DO NOTHING`,
      [m.id, m.hash]
    );
    console.log(`  baseline: ${m.id}`);
  }

  const { rows } = await client.query(`SELECT count(*) as cnt FROM "hookcode_schema_migrations"`);
  console.log(`\nTotal records: ${rows[0].cnt}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
