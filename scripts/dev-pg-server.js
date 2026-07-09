// Local Postgres-compatible server for development/testing only.
// Lets the app run against real Postgres SQL semantics without needing
// a Supabase account yet. NOT used in production - Render will connect
// to the real Supabase Postgres via DATABASE_URL instead.
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');

const PORT = process.env.LOCAL_PG_PORT || 55432;

async function main() {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: Number(PORT), host: '127.0.0.1' });
  await server.start();
  console.log(`[dev-pg] Local test Postgres server dang chay tai 127.0.0.1:${PORT}`);
  console.log(`[dev-pg] DATABASE_URL=postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);

  process.on('SIGINT', async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[dev-pg] Loi khoi dong:', err);
  process.exit(1);
});
