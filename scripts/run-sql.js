const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const sqlFiles = process.argv.slice(2);
if (sqlFiles.length === 0) {
  console.error('Usage: node scripts/run-sql.js <sql-file> [<sql-file>...]');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL. Set it in .env or the environment.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function runSqlFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`SQL file not found: ${absolutePath}`);
  }

  const sql = fs.readFileSync(absolutePath, 'utf8');
  console.log(`\nRunning ${filePath}...`);
  await pool.query(sql);
  console.log(`Finished ${filePath}`);
}

async function main() {
  try {
    for (const file of sqlFiles) {
      await runSqlFile(file);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('\nMigration failed:', error.message || error);
  process.exit(1);
});
