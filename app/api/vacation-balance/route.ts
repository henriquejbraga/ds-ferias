import { NextResponse } from "next/server";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { calculateVacationBalance } from "@/lib/vacationRules";
import { findUserWithBalance } from "@/repositories/userRepository";
import { findAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(session)) {
    return NextResponse.json({ error: "Você precisa trocar a senha antes de continuar." }, { status: 403 });
  }

  const [user, acquisitionPeriods] = await Promise.all([
    findUserWithBalance(session.id),
    findAcquisitionPeriodsForUser(session.id),
  ]);

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const balance = calculateVacationBalance(
    user.hireDate,
    user.vacationRequests,
    acquisitionPeriods,
  );

  return NextResponse.json({ balance });
}
