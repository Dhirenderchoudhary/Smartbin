import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:15432/smartbin");

async function run() {
  try {
    const res = await sql`SELECT 1`;
    console.log("Success!", res);
  } catch (err: any) {
    console.error("Connection Error:");
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
