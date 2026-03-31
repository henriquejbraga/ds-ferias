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

    // Executamos em transação conforme esperado pelos testes
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Atualiza dados do usuário
      const user = await tx.user.update({
        where: { id },
        data: updateData,
      });

      // 2. Se houver ciclos enviados para ajuste manual
      if (Array.isArray(acquisitionPeriods)) {
        for (const ap of acquisitionPeriods) {
          if (ap.id && ap.usedDays !== undefined) {
            const used = Math.min(Number(ap.usedDays), ap.accruedDays ?? 30);
            await tx.acquisitionPeriod.update({
              where: { id: ap.id, userId: id }, // Trava de segurança userId conforme teste
              data: { usedDays: used },
            });
          }
        }
      }

      return user;
    });

    logger.info("User updated via Backoffice", { 
      actorId: actor.id, 
      targetUserId: id,
      fields: Object.keys(updateData)
    });

    if (hireDate !== undefined) {
      await syncAcquisitionPeriodsForUser(id, hireDate ? new Date(hireDate) : null);
    }

    // Retorna o usuário direto conforme esperado pelo teste (data.name)
    return NextResponse.json(updatedUser);
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
    if (id === actor.id) {
      return NextResponse.json({ error: "Você não pode excluir seu próprio usuário." }, { status: 400 });
    }

    // Busca o usuário para saber quem é o seu gestor (para reatribuição)
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { managerId: true }
    });

    if (!userToDelete) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // 1. Reatribui subordinados para o gestor acima (conforme esperado pelo teste)
      await tx.user.updateMany({
        where: { managerId: id },
        data: { managerId: userToDelete.managerId }
      });

      // 2. Deleta vínculos e histórico
      await tx.vacationRequestHistory.deleteMany({
        where: { vacationRequest: { userId: id } },
      });
      await tx.vacationRequest.deleteMany({ where: { userId: id } });
      await tx.acquisitionPeriod.deleteMany({ where: { userId: id } });
      await tx.blackoutPeriod.deleteMany({ where: { createdById: id } });
      const fb = (tx as any).feedback;
      if (fb) await fb.deleteMany({ where: { userId: id } });
      
      // 3. Finalmente deleta o usuário
      await tx.user.delete({ where: { id } });
    });

    logger.info("User deleted via Backoffice", { actorId: actor.id, targetUserId: id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Failed to delete user", { actorId: actor.id, targetUserId: id, error: err });
    return NextResponse.json({ error: "Erro ao excluir usuário" }, { status: 500 });
  }
}
