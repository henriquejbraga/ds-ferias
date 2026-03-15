/**
 * Seed com hierarquia correta para a aba Times:
 * RH → Gerente → Coordenador → Colaborador (FUNCIONARIO)
 *
 * Senha para todos: senha123
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida. Configure o .env e rode: npx prisma db seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  const senhaHash = hashPassword("senha123");

  // ---- RH (topo da hierarquia para aprovação; sem manager ou reporta a gerente) ----
  const rh1 = await prisma.user.upsert({
    where: { email: "rh1@empresa.com" },
    update: { name: "RH Um", role: "RH", passwordHash: senhaHash },
    create: {
      id: "rh1",
      name: "RH Um",
      email: "rh1@empresa.com",
      passwordHash: senhaHash,
      role: "RH",
    },
  });

  // ---- GERENTES (reportam ao RH) ----
  const gerente1 = await prisma.user.upsert({
    where: { email: "gerente1@empresa.com" },
    update: { name: "Gerente Um", role: "GERENTE", passwordHash: senhaHash, managerId: rh1.id },
    create: {
      id: "gerente1",
      name: "Gerente Um",
      email: "gerente1@empresa.com",
      passwordHash: senhaHash,
      role: "GERENTE",
      managerId: rh1.id,
    },
  });

  const gerente2 = await prisma.user.upsert({
    where: { email: "gerente2@empresa.com" },
    update: { name: "Gerente Dois", role: "GERENTE", passwordHash: senhaHash, managerId: rh1.id },
    create: {
      id: "gerente2",
      name: "Gerente Dois",
      email: "gerente2@empresa.com",
      passwordHash: senhaHash,
      role: "GERENTE",
      managerId: rh1.id,
    },
  });

  // ---- COORDENADORES (reportam ao Gerente) ----
  const gestor1 = await prisma.user.upsert({
    where: { email: "gestor1@empresa.com" },
    update: { name: "Gestor Um", role: "COORDENADOR", passwordHash: senhaHash, managerId: gerente1.id },
    create: {
      id: "gestor1",
      name: "Gestor Um",
      email: "gestor1@empresa.com",
      passwordHash: senhaHash,
      role: "COORDENADOR",
      managerId: gerente1.id,
    },
  });

  const gestor2 = await prisma.user.upsert({
    where: { email: "gestor2@empresa.com" },
    update: { name: "Gestor Dois", role: "COORDENADOR", passwordHash: senhaHash, managerId: gerente1.id },
    create: {
      id: "gestor2",
      name: "Gestor Dois",
      email: "gestor2@empresa.com",
      passwordHash: senhaHash,
      role: "COORDENADOR",
      managerId: gerente1.id,
    },
  });

  // ---- COLABORADORES / FUNCIONÁRIOS (reportam ao Coordenador) ----
  await prisma.user.upsert({
    where: { email: "colaborador1@empresa.com" },
    update: { name: "Colaborador Um", role: "FUNCIONARIO", passwordHash: senhaHash, managerId: gestor1.id, department: "Engenharia" },
    create: {
      id: "colab1",
      name: "Colaborador Um",
      email: "colaborador1@empresa.com",
      passwordHash: senhaHash,
      role: "FUNCIONARIO",
      managerId: gestor1.id,
      department: "Engenharia",
      hireDate: new Date("2023-06-01"),
    },
  });

  const hireDateColab2 = new Date("2024-02-14");
  await prisma.user.upsert({
    where: { email: "colaborador2@empresa.com" },
    update: {
      name: "Colaborador Dois",
      role: "FUNCIONARIO",
      passwordHash: senhaHash,
      managerId: gestor2.id,
      department: "Comercial",
      hireDate: hireDateColab2,
    },
    create: {
      id: "colab2",
      name: "Colaborador Dois",
      email: "colaborador2@empresa.com",
      passwordHash: senhaHash,
      role: "FUNCIONARIO",
      managerId: gestor2.id,
      department: "Comercial",
      hireDate: hireDateColab2,
    },
  });

  // Colaborador 3 no time do Gestor 1 (para ter mais de um no time)
  await prisma.user.upsert({
    where: { email: "colaborador3@empresa.com" },
    update: { name: "Colaboradora Três", role: "FUNCIONARIO", passwordHash: senhaHash, managerId: gestor1.id, department: "Engenharia" },
    create: {
      id: "colab3",
      name: "Colaboradora Três",
      email: "colaborador3@empresa.com",
      passwordHash: senhaHash,
      role: "FUNCIONARIO",
      managerId: gestor1.id,
      department: "Engenharia",
      hireDate: new Date("2024-01-10"),
    },
  });

  // RH Dois (opcional, para testes)
  await prisma.user.upsert({
    where: { email: "rh2@empresa.com" },
    update: { name: "RH Dois", role: "RH", passwordHash: senhaHash },
    create: {
      id: "rh2",
      name: "RH Dois",
      email: "rh2@empresa.com",
      passwordHash: senhaHash,
      role: "RH",
    },
  });

  console.log("Seed concluído. Senha para todos: senha123");
  console.log("");
  console.log("Hierarquia (para a aba Times):");
  console.log("  RH → Gerente → Coordenador → Colaborador");
  console.log("  rh1 (RH)");
  console.log("  ├── gerente1 (GERENTE)");
  console.log("  │   ├── gestor1 (COORDENADOR) → colab1, colab3");
  console.log("  │   └── gestor2 (COORDENADOR) → colab2");
  console.log("  └── gerente2 (GERENTE)");
  console.log("");
  console.log("Logins para testar Times:");
  console.log("  Coordenador (vê seu time):     gestor1@empresa.com  ou  gestor2@empresa.com");
  console.log("  Gerente (vê times dos coords): gerente1@empresa.com");
  console.log("  RH (vê todos):                rh1@empresa.com");
  console.log("  Colaborador:                   colaborador1@empresa.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
