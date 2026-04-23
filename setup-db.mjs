import pg from 'pg'; import { readFileSync } from 'fs'; import { fileURLToPath } from 'url'; import path from 'path'; import dotenv from 'dotenv';
  dotenv.config();
  if (!process.env.DATABASE_URL) { console.error('ERROR: DATABASE_URL is not set.'); process.exit(1); }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');
  console.log('Creating database tables...');
  try { await pool.query(sql); console.log('\u2705  Database ready.'); } catch (err) { console.error('\u274c  Failed:', err.message); process.exit(1); } finally { await pool.end(); }
  