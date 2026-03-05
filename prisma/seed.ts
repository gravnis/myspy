import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const verticals = [
    { name: "Gambling", slug: "gambling" },
    { name: "Nutra", slug: "nutra" },
    { name: "Crypto", slug: "crypto" },
    { name: "Dating", slug: "dating" },
    { name: "E-commerce", slug: "ecom" },
    { name: "Finance", slug: "finance" },
    { name: "Other", slug: "other" },
  ];

  for (const v of verticals) {
    await prisma.vertical.upsert({
      where: { slug: v.slug },
      update: {},
      create: v,
    });
  }
  console.log("Verticals seeded");

  const hash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@myspy.com" },
    update: {},
    create: {
      email: "admin@myspy.com",
      passwordHash: hash,
      name: "Admin",
      role: "ADMIN",
      plan: "BUSINESS",
    },
  });
  console.log("Admin user created: admin@myspy.com / admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
