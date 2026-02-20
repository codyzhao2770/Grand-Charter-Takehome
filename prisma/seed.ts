import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

async function main() {
  // Create default user
  const user = await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: {
      id: DEFAULT_USER_ID,
      email: "default@datavault.local",
      name: "Default User",
    },
  });
  console.log("Created user:", user.name);

  // Create sample folders
  const documents = await prisma.folder.upsert({
    where: { id: "10000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "10000000-0000-0000-0000-000000000001",
      name: "Documents",
      userId: DEFAULT_USER_ID,
    },
  });

  await prisma.folder.upsert({
    where: { id: "10000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "10000000-0000-0000-0000-000000000002",
      name: "Reports",
      parentId: documents.id,
      userId: DEFAULT_USER_ID,
    },
  });

  await prisma.folder.upsert({
    where: { id: "10000000-0000-0000-0000-000000000003" },
    update: {},
    create: {
      id: "10000000-0000-0000-0000-000000000003",
      name: "Images",
      userId: DEFAULT_USER_ID,
    },
  });

  await prisma.folder.upsert({
    where: { id: "10000000-0000-0000-0000-000000000004" },
    update: {},
    create: {
      id: "10000000-0000-0000-0000-000000000004",
      name: "Projects",
      userId: DEFAULT_USER_ID,
    },
  });

  console.log("Created sample folders: Documents, Documents/Reports, Images, Projects");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
