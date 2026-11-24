import { PrismaClient } from "@prisma/client";
import { resetDemoData } from "../lib/seed";

const prisma = new PrismaClient();

resetDemoData(prisma, (m) => console.log(`[seed] ${m}`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
