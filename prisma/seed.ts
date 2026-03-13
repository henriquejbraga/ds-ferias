/**
 * Seed do banco: cria/atualiza usuários de teste.
 * Colaborador 2: data de admissão ~2 anos atrás, sem férias gozadas → direito a 60 dias (2 períodos aquisitivos).
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

  // Colaborador 2: quase 2 anos de empresa, nunca tirou férias → 2 períodos = 60 dias
  // hireDate = 24 meses atrás a partir de hoje
  const hoje = new Date();
  const doisAnosAtras = new Date(hoje);
  doisAnosAtras.setMonth(doisAnosAtras.getMonth() - 24);

  const colaborador2 = await prisma.user.upsert({
    where: { email: "colaborador2@empresa.com" },
    update: {
      name: "Colaborador Dois",
      role: "FUNCIONARIO",
      hireDate: doisAnosAtras,
      passwordHash: senhaHash,
    },
    create: {
      name: "Colaborador Dois",
      email: "colaborador2@empresa.com",
      passwordHash: senhaHash,
      role: "FUNCIONARIO",
      hireDate: doisAnosAtras,
    },
  });

  console.log("Seed concluído.");
  console.log("Colaborador 2:", colaborador2.email, "| Admissão:", doisAnosAtras.toISOString().slice(0, 10));
  console.log("Com ~24 meses de empresa e 0 férias, o saldo esperado é 60 dias (2 períodos de 30).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
