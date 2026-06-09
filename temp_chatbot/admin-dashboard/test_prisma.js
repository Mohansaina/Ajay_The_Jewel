const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Testing Prisma connection with port 6543 pooler...");
  try {
    const userCount = await prisma.user.count();
    console.log(`Prisma successfully connected! Found ${userCount} user(s) in Supabase.`);
  } catch (err) {
    console.error("Prisma Connection Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
