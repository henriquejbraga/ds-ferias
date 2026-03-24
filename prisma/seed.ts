/**
 * Seed com hierarquia personalizada para a aba Times:
 * RH -> Diretor -> Gerente -> Coordenador -> Colaborador (FUNCIONARIO)
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

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Status aprovado coerente com quem costuma aprovar cada papel na hierarquia. */
function seedApprovedStatus(role: string) {
  if (role === "GERENTE") return "APROVADO_DIRETOR" as const;
  if (role === "COORDENADOR" || role === "GESTOR") return "APROVADO_GERENTE" as const;
  if (role === "DIRETOR" || role === "RH") return "APROVADO_RH" as const;
  return "APROVADO_COORDENADOR" as const;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const senhaHash = hashPassword("senha123");
  // Limpa dados para repovoar do zero
  await prisma.vacationRequestHistory.deleteMany();
  await prisma.vacationRequest.deleteMany();
  await prisma.acquisitionPeriod.deleteMany();
  await prisma.blackoutPeriod.deleteMany();
  await prisma.user.deleteMany();

  // RH
  const rh = await prisma.user.create({
    data: {
      id: "rh1",
      name: "RH Um",
      email: "rh1@empresa.com",
      passwordHash: senhaHash,
      role: "RH",
      registration: "REG-RH1",
    },
  });

  // Diretor Santiago
  const diretor = await prisma.user.create({
    data: {
      id: "diretor-santiago",
      name: "Santiago",
      email: "santiago@empresa.com",
      passwordHash: senhaHash,
      role: "DIRETOR",
      managerId: rh.id,
      registration: "REG-DIR-SANTIAGO",
    },
  });

  // Gerentes
  const mendonca = await prisma.user.create({
    data: {
      id: "gerente-mendonca",
      name: "Mendonca",
      email: "mendonca@empresa.com",
      passwordHash: senhaHash,
      role: "GERENTE",
      managerId: diretor.id,
      registration: "REG-GER-MENDONCA",
    },
  });

  const fabricio = await prisma.user.create({
    data: {
      id: "gerente-fabricio",
      name: "Fabricio",
      email: "fabricio@empresa.com",
      passwordHash: senhaHash,
      role: "GERENTE",
      managerId: diretor.id,
      registration: "REG-GER-FABRICIO",
    },
  });

  // Gestores
  const rapha = await prisma.user.create({
    data: {
      id: "gestor-rapha",
      name: "Rapha",
      email: "rapha@empresa.com",
      passwordHash: senhaHash,
      role: "COORDENADOR",
      managerId: mendonca.id,
      registration: "REG-GES-RAPHA",
    },
  });

  const joaozinho = await prisma.user.create({
    data: {
      id: "gestor-joaozinho",
      name: "Joaozinho",
      email: "joaozinho@empresa.com",
      passwordHash: senhaHash,
      role: "COORDENADOR",
      managerId: mendonca.id,
      registration: "REG-GES-JOAOZINHO",
    },
  });

  const loran = await prisma.user.create({
    data: {
      id: "gestor-loran",
      name: "Loran",
      email: "loran@empresa.com",
      passwordHash: senhaHash,
      role: "COORDENADOR",
      managerId: fabricio.id,
      registration: "REG-GES-LORAN",
    },
  });

  // Coordenador Paulo (abaixo do Mendonca)
  const paulo = await prisma.user.create({
    data: {
      id: "coord-paulo",
      name: "Paulo",
      email: "paulo@empresa.com",
      passwordHash: senhaHash,
      role: "COORDENADOR",
      managerId: mendonca.id,
      registration: "REG-COORD-PAULO",
      team: "Inteligencia Artificial",
      department: "Engenharia",
      hireDate: new Date("2024-02-01T00:00:00Z"),
    },
  });

  const colaboradores = [
    // Rapha -> Plataforma (4)
    { id: "colab-p1", nome: "Plataforma Um", email: "p1@empresa.com", gestorId: rapha.id, time: "Plataforma", reg: "REG-P1" },
    { id: "colab-p2", nome: "Plataforma Dois", email: "p2@empresa.com", gestorId: rapha.id, time: "Plataforma", reg: "REG-P2" },
    { id: "colab-p3", nome: "Plataforma Tres", email: "p3@empresa.com", gestorId: rapha.id, time: "Plataforma", reg: "REG-P3" },
    { id: "colab-p4", nome: "Plataforma Quatro", email: "p4@empresa.com", gestorId: rapha.id, time: "Plataforma", reg: "REG-P4" },
    // Rapha -> Design System (5)
    { id: "colab-d1", nome: "Design Um", email: "d1@empresa.com", gestorId: rapha.id, time: "Design System", reg: "REG-D1" },
    { id: "colab-d2", nome: "Design Dois", email: "d2@empresa.com", gestorId: rapha.id, time: "Design System", reg: "REG-D2" },
    { id: "colab-d3", nome: "Design Tres", email: "d3@empresa.com", gestorId: rapha.id, time: "Design System", reg: "REG-D3" },
    { id: "colab-d4", nome: "Design Quatro", email: "d4@empresa.com", gestorId: rapha.id, time: "Design System", reg: "REG-D4" },
    { id: "colab-d5", nome: "Design Cinco", email: "d5@empresa.com", gestorId: rapha.id, time: "Design System", reg: "REG-D5" },
    // Joaozinho -> Inovacao (1)
    { id: "colab-i1", nome: "Inovacao Um", email: "i1@empresa.com", gestorId: joaozinho.id, time: "Inovacao", reg: "REG-I1" },
    // Paulo -> Inteligencia Artificial (1)
    { id: "colab-ia1", nome: "IA Um", email: "ia1@empresa.com", gestorId: paulo.id, time: "Inteligencia Artificial", reg: "REG-IA1", hireDate: "2025-11-01T00:00:00Z" },
    // Loran -> 3 colaboradores
    { id: "colab-l1", nome: "Loran Um", email: "l1@empresa.com", gestorId: loran.id, time: "Squad Loran", reg: "REG-L1" },
    { id: "colab-l2", nome: "Loran Dois", email: "l2@empresa.com", gestorId: loran.id, time: "Squad Loran", reg: "REG-L2" },
    { id: "colab-l3", nome: "Loran Tres", email: "l3@empresa.com", gestorId: loran.id, time: "Squad Loran", reg: "REG-L3" },
  ] as const;

  const createdEmployees = [];
  for (let i = 0; i < colaboradores.length; i += 1) {
    const c = colaboradores[i];
    const customHireDate = "hireDate" in c && c.hireDate ? new Date(c.hireDate) : null;
    const hireDate = customHireDate ?? addDays(new Date("2023-01-01T00:00:00Z"), i * 15);
    const user = await prisma.user.create({
      data: {
        id: c.id,
        name: c.nome,
        email: c.email,
        passwordHash: senhaHash,
        role: "FUNCIONARIO",
        registration: c.reg,
        managerId: c.gestorId,
        team: c.time,
        department: "Engenharia",
        hireDate,
      },
    });
    createdEmployees.push(user);
  }

  const allUsersForVacation = [
    rh,
    diretor,
    mendonca,
    fabricio,
    rapha,
    joaozinho,
    loran,
    paulo,
    ...createdEmployees,
  ];

  // Ferias aleatorias para todos
  const today = new Date();
  for (let i = 0; i < allUsersForVacation.length; i += 1) {
    const u = allUsersForVacation[i];
    if (u.id === paulo.id) continue; // Paulo terá férias fixas abaixo
    const pastStart = addDays(today, -randInt(30, 210));
    const pastEnd = addDays(pastStart, randInt(5, 15));
    const futureStart = addDays(today, randInt(20, 180));
    const futureEnd = addDays(futureStart, randInt(5, 12));

    await prisma.vacationRequest.create({
      data: {
        id: `seed-approved-${u.id}`,
        userId: u.id,
        startDate: pastStart,
        endDate: pastEnd,
        status: seedApprovedStatus(u.role),
        notes: "Seed: ferias aleatorias aprovadas",
        abono: Math.random() < 0.25,
        thirteenth: Math.random() < 0.25,
      },
    });

    await prisma.vacationRequest.create({
      data: {
        id: `seed-pending-${u.id}`,
        userId: u.id,
        startDate: futureStart,
        endDate: futureEnd,
        status: "PENDENTE",
        notes: "Seed: ferias aleatorias pendentes",
        abono: false,
        thirteenth: false,
      },
    });
  }

  // Férias fixas do Paulo: 10/mar -> 08/abr (30 dias corridos)
  await prisma.vacationRequest.create({
    data: {
      id: "seed-approved-coord-paulo-mar-abr",
      userId: paulo.id,
      startDate: new Date("2026-03-10T00:00:00Z"),
      endDate: new Date("2026-04-08T00:00:00Z"),
      status: "APROVADO_GERENTE",
      notes: "Seed: férias fixas do Paulo — aprovado pelo gerente (30 dias)",
      abono: false,
      thirteenth: false,
    },
  });

  console.log("Seed concluido. Senha para todos: senha123");
  console.log("");
  console.log("Hierarquia solicitada:");
  console.log("  Diretor: Santiago");
  console.log("  - Gerente: Mendonca");
  console.log("    - Gestor: Rapha");
  console.log("      - Plataforma: 4 colaboradores");
  console.log("      - Design System: 5 colaboradores");
  console.log("    - Gestor: Joaozinho");
  console.log("      - Inovacao: 1 colaborador");
  console.log("    - Coordenador: Paulo");
  console.log("      - Inteligencia Artificial: 1 colaborador (admissao nov/2025)");
  console.log("  - Gerente: Fabricio");
  console.log("    - Gestor: Loran");
  console.log("      - Squad Loran: 3 colaboradores");
  console.log("");
  console.log("Ferias aleatorias criadas para todos os usuarios (1 aprovada + 1 pendente cada).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
