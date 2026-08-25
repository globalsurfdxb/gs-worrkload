import { PrismaClient, SystemRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "GlobalSurf",
    },
  });

  const superAdminPasswordHash = await bcrypt.hash("ChangeMe123!", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@globalsurf.ae" },
    update: {},
    create: {
      fullName: "Super Admin",
      email: "admin@globalsurf.ae",
      passwordHash: superAdminPasswordHash,
      role: SystemRole.SUPER_ADMIN,
      designation: "System Administrator",
    },
  });

  const digital = await prisma.department.upsert({
    where: { code: "DIGITAL" },
    update: {},
    create: {
      organizationId: org.id,
      name: "Digital Department",
      code: "DIGITAL",
      description: "Development, QA, SEO, Content, Design and Marketing teams.",
      managerId: superAdmin.id,
    },
  });

  const it = await prisma.department.upsert({
    where: { code: "IT" },
    update: {},
    create: {
      organizationId: org.id,
      name: "IT Department",
      code: "IT",
      description: "IT Projects and IT Solutions teams.",
      managerId: superAdmin.id,
    },
  });

  const digitalTeams = [
    ["Development Team", "DIGITAL-DEV"],
    ["QA Team", "DIGITAL-QA"],
    ["SEO Team", "DIGITAL-SEO"],
    ["Content Team", "DIGITAL-CONTENT"],
    ["Design Team", "DIGITAL-DESIGN"],
    ["Marketing Team", "DIGITAL-MKT"],
    ["In-House Marketing Team", "DIGITAL-INHOUSE-MKT"],
  ] as const;

  for (const [name, code] of digitalTeams) {
    await prisma.team.upsert({
      where: { code },
      update: {},
      create: { departmentId: digital.id, name, code, teamLeadId: superAdmin.id },
    });
  }

  const itTeams = [
    ["IT Projects", "IT-PROJECTS"],
    ["IT Solutions", "IT-SOLUTIONS"],
  ] as const;

  for (const [name, code] of itTeams) {
    await prisma.team.upsert({
      where: { code },
      update: {},
      create: { departmentId: it.id, name, code, teamLeadId: superAdmin.id },
    });
  }

  console.log("Seed complete:");
  console.log(`  Organization: ${org.name}`);
  console.log(`  Departments: Digital Department, IT Department`);
  console.log(`  Teams: ${digitalTeams.length + itTeams.length}`);
  console.log(`  Super Admin login: admin@globalsurf.ae / ChangeMe123! (change immediately)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
