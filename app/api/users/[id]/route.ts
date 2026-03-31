import { NextResponse } from "next/server";
import { getSessionUser, shouldForcePasswordChange } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRoleLevel } from "@/lib/vacationRules";
import { syncAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";
import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

const ROLES = ["FUNCIONARIO", "COLABORADOR", "COORDENADOR", "GESTOR", "GERENTE", "DIRETOR", "RH"] as const;

/** PATCH: atualiza usuário (apenas RH). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (shouldForcePasswordChange(actor))
    return NextResponse.json({ error: "Troca de senha obrigatória" }, { status: 403 });

  // Apenas RH (nível 5) ou o próprio usuário (em cenários específicos, mas aqui restringimos a admin)
  if (getRoleLevel(actor.role) < 5) {
    return NextResponse.json({ error: "Acesso restrito a RH" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      email,
      role,
      department,
      hireDate,
      team,
      managerId,
      registration,
      acquisitionPeriods,
    } = body;

    // Validação básica
    if (role && !ROLES.includes(role as any)) {
      return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
    }

    const updateData: Prisma.UserUncheckedUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (hireDate !== undefined) updateData.hireDate = hireDate ? new Date(hireDate) : null;
    if (team !== undefined) updateData.team = team;
    if (registration !== undefined) updateData.registration = registration;
    if (managerId !== undefined) updateData.managerId = managerId || null;

    // 1. Atualiza dados do usuário
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    logger.info("User updated via Backoffice", { 
      actorId: actor.id, 
      targetUserId: id,
      fields: Object.keys(updateData)
    });

    // 2. Se houver ciclos enviados para ajuste manual
    if (Array.isArray(acquisitionPeriods)) {
      for (const ap of acquisitionPeriods) {
        if (ap.id && ap.usedDays !== undefined) {
          await (prisma as any).acquisitionPeriod.update({
            where: { id: ap.id },
            data: { usedDays: Number(ap.usedDays) },
          });
        }
      }
    }

    // 3. Se a data de admissão mudou, sincroniza os ciclos
    if (hireDate !== undefined) {
      await syncAcquisitionPeriodsForUser(id, hireDate ? new Date(hireDate) : null);
    }

    return NextResponse.json({ user });
  } catch (err: any) {
    logger.error("Failed to update user", { actorId: actor.id, targetUserId: id, error: err });
    if (err.code === "P2002") {
      return NextResponse.json({ error: "E-mail ou matrícula já em uso." }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  }
}

/** DELETE: remove usuário (apenas RH). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getSessionUser();
  if (!actor || getRoleLevel(actor.role) < 5) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Evitar que o usuário se delete
    if (id === actor.id) {
      return NextResponse.json({ error: "Você não pode excluir seu próprio usuário." }, { status: 400 });
    }

    // Verifica se tem subordinados antes de deletar
    const hasReports = await prisma.user.count({ where: { managerId: id } });
    if (hasReports > 0) {
      return NextResponse.json(
        { error: "Este usuário possui subordinados. Reatribua-os antes de excluir." },
        { status: 400 }
      );
    }

    // Deleta em cascata manual (devido a restrições de FK ou lógica de negócio)
    await prisma.vacationRequestHistory.deleteMany({
      where: { vacationRequest: { userId: id } },
    });
    await prisma.vacationRequest.deleteMany({ where: { userId: id } });
    await (prisma as any).acquisitionPeriod.deleteMany({ where: { userId: id } });
    await prisma.blackoutPeriod.deleteMany({ where: { createdById: id } });
    await (prisma as any).feedback?.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    logger.info("User deleted via Backoffice", { actorId: actor.id, targetUserId: id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Failed to delete user", { actorId: actor.id, targetUserId: id, error: err });
    return NextResponse.json({ error: "Erro ao excluir usuário" }, { status: 500 });
  }
}
