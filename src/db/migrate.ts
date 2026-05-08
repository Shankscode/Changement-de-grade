import { configDotenv } from 'dotenv';
configDotenv({ override: true });

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const sqlPath = join(__dirname, 'migrations', '0000_initial.sql');
const sql = readFileSync(sqlPath, 'utf-8');

console.log('Applying migration 0000_initial.sql…');
await client.query(sql);
console.log('Migration complete.');

await client.end();
