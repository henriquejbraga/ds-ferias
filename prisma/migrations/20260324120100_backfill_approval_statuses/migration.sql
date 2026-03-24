-- Depende de 20260324120000 (valor APROVADO_DIRETOR já commitado em outra transação Prisma)

WITH last_final AS (
  SELECT DISTINCT ON (h."vacationRequestId")
    h."vacationRequestId" AS vid,
    u.role AS approver_role
  FROM "VacationRequestHistory" h
  JOIN "User" u ON u.id = h."changedByUserId"
  WHERE h."newStatus" = 'APROVADO_GERENTE'::"VacationStatus"
  ORDER BY h."vacationRequestId", h."changedAt" DESC
)
UPDATE "VacationRequest" vr
SET status = CASE lf.approver_role
  WHEN 'COORDENADOR' THEN 'APROVADO_COORDENADOR'::"VacationStatus"
  WHEN 'GESTOR' THEN 'APROVADO_COORDENADOR'::"VacationStatus"
  WHEN 'DIRETOR' THEN 'APROVADO_DIRETOR'::"VacationStatus"
  ELSE vr.status
END
FROM last_final lf
WHERE vr.id = lf.vid
  AND vr.status = 'APROVADO_GERENTE'::"VacationStatus"
  AND lf.approver_role IN ('COORDENADOR', 'GESTOR', 'DIRETOR');

UPDATE "VacationRequestHistory" h
SET "newStatus" = 'APROVADO_COORDENADOR'::"VacationStatus"
FROM "User" u
WHERE h."changedByUserId" = u.id
  AND h."newStatus" = 'APROVADO_GERENTE'::"VacationStatus"
  AND u.role IN ('COORDENADOR', 'GESTOR');

UPDATE "VacationRequestHistory" h
SET "newStatus" = 'APROVADO_DIRETOR'::"VacationStatus"
FROM "User" u
WHERE h."changedByUserId" = u.id
  AND h."newStatus" = 'APROVADO_GERENTE'::"VacationStatus"
  AND u.role = 'DIRETOR';
