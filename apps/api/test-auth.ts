import { syncUserByCognitoSub } from "./src/modules/user/service.js";
import { getDb, sql } from "@smartbin/db";

async function runTest() {
  console.log("🚀 Starting Auth Logic Test...\n");

  try {
    // 1. Check Database connection
    console.log("Testing database connection...");
    const db = getDb();
    await db.execute(sql`SELECT 1;`);
    console.log("✅ Database connection successful.\n");

    // 2. Simulate AWS Cognito Token Payload
    const mockCognitoSub = "user-uuid-1234-abcd-5678";
    const mockEmail = "testuser@example.com";
    
    console.log(`Simulating login for Cognito Sub: ${mockCognitoSub}...`);

    // 3. Test New User Registration (First Login)
    console.log("Attempting to sync (register) user in database...");
    const user = await syncUserByCognitoSub(mockCognitoSub, mockEmail, "USER");
    
    console.log("✅ User synchronized successfully:");
    console.log(`   Internal DB ID: ${user.id}`);
    console.log(`   Cognito Sub:    ${user.cognitoSub}`);
    console.log(`   Email:          ${user.email}`);
    console.log(`   Role:           ${user.role}`);
    console.log(`   Points:         ${user.points}`);
    
    // 4. Test Existing User (Second Login)
    console.log("\nAttempting to sync the exact same user again (simulating returning login)...");
    const returningUser = await syncUserByCognitoSub(mockCognitoSub, mockEmail, "USER");
    
    if (returningUser.id === user.id) {
      console.log("✅ Successfully retrieved existing user without creating duplicates.");
    } else {
      console.error("❌ Duplicate user was created!");
    }

  } catch (error: any) {
    console.error("\n❌ Test Failed!");
    if (error.code === 'ECONNREFUSED' || error.message.includes("database")) {
      console.error("Error: Could not connect to the PostgreSQL database.");
      console.error("Please ensure PostgreSQL is running at postgresql://postgres:postgres@localhost:15432/smartbin");
    } else {
      console.error("Error Details:", error.message);
    }
  } finally {
    process.exit(0);
  }
}

runTest();
