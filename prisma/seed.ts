import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function seedAdmin() {
  const adminEmail = "anfaskaloor@gmail.com";
  const username = "anfaskaloor";

  try {
    // Check if user already exists in Clerk
    const existingUsers = await clerk.users.getUserList({ emailAddress: adminEmail });

    let clerkUser;
    if (existingUsers.length === 0) {
      // Create user in Clerk
      clerkUser = await clerk.users.createUser({
        emailAddress: [adminEmail],
        firstName: "Anfas",
        lastName: "Kaloor",
        username,
      });
      console.log(`✅ Clerk user created: ${adminEmail}`);
    } else {
      clerkUser = existingUsers[0];
      console.log(`ℹ️ Clerk user already exists: ${adminEmail}`);
    }

    // Create user in your local database
    const existingAdmin = await prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
    });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          name: "Anfas Kaloor",
          email: adminEmail,
          clerkId: clerkUser.id,
          role: "ADMIN", // Adjust if using enum
        },
      });
      console.log("✅ Admin user created in database");
    } else {
      console.log("ℹ️ Admin user already exists in database");
    }

  } catch (error) {
    console.error("❌ Error in seedAdmin:", error);
  }
}

async function main() {
  console.log("🌱 Starting seed...");
  await seedAdmin();
  console.log("✅ Seed completed.");
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
