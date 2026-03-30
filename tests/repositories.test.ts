import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  findUserWithBalance, 
  findManagersForAdmin, 
  findTeamMembersByManager, 
  findTeamMembersByGerente,
  findCoordinatorsByGerente,
  findAllEmployees,
  findAllCoordinatorsForRh,
  findAllGerentesForTimes,
  findUserWithTimesVacations,
  findAllUsersForAdmin,
  findUserDepartment,
  findAllGerentes,
  findUsersWithTimesVacationsByIds,
  findUsersWithVacationForBalance
} from "@/repositories/userRepository";
import { findManagedRequests, findMyRequests, findManagedRequestsLean } from "@/repositories/vacationRepository";
import { findBlackouts } from "@/repositories/blackoutRepository";
import { findAcquisitionPeriodsForUser } from "@/repositories/acquisitionRepository";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vacationRequest: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    blackoutPeriod: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    acquisitionPeriod: {
      findMany: vi.fn().mockResolvedValue([]),
    }
  },
}));

describe("repositories", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("userRepository helper functions call prisma correctly", async () => {
    const { prisma } = await import("@/lib/prisma");
    
    await findManagersForAdmin();
    expect(prisma.user.findMany).toHaveBeenCalled();

    await findTeamMembersByManager("m1");
    expect(prisma.user.findMany).toHaveBeenCalled();

    await findTeamMembersByGerente("g1");
    expect(prisma.user.findMany).toHaveBeenCalled();

    await findCoordinatorsByGerente("g1");
    expect(prisma.user.findMany).toHaveBeenCalled();

    await findAllEmployees();
    expect(prisma.user.findMany).toHaveBeenCalled();

    await findAllCoordinatorsForRh();
    expect(prisma.user.findMany).toHaveBeenCalled();

    await findAllGerentesForTimes();
    expect(prisma.user.findMany).toHaveBeenCalled();

    await findUserWithTimesVacations("u1");
    expect(prisma.user.findUnique).toHaveBeenCalled();

    await findUserDepartment("u1");
    expect(prisma.user.findUnique).toHaveBeenCalled();

    await findAllGerentes();
    expect(prisma.user.findMany).toHaveBeenCalled();

    await findUsersWithTimesVacationsByIds(["u1", "u2"]);
    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(await findUsersWithTimesVacationsByIds([])).toEqual([]);

    await findUsersWithVacationForBalance();
    expect(prisma.user.findMany).toHaveBeenCalled();

    // Test findAllUsersForAdmin logic
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { hireDate: new Date(), acquisitionPeriods: [{ usedDays: 10 }] },
      { hireDate: new Date(), acquisitionPeriods: [] },
      { hireDate: null, acquisitionPeriods: [] }
    ] as any);
    const adminUsers = await findAllUsersForAdmin();
    expect(adminUsers[0].tookVacationInCurrentCycle).toBe(true);
    expect(adminUsers[1].tookVacationInCurrentCycle).toBe(false);
    expect(adminUsers[2].tookVacationInCurrentCycle).toBe(null);
  });

  it("findUserWithBalance returns null if prisma returns null", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    const res = await findUserWithBalance("u-none");
    expect(res).toBeNull();
  });

  it("vacationRepository functions call prisma correctly", async () => {
    const { prisma } = await import("@/lib/prisma");
    
    await findMyRequests("u1");
    expect(prisma.vacationRequest.findMany).toHaveBeenCalled();

    await findManagedRequests({ status: "PENDENTE" });
    expect(prisma.vacationRequest.findMany).toHaveBeenCalled();

    await findManagedRequestsLean({ team: "Alpha" });
    expect(prisma.vacationRequest.findMany).toHaveBeenCalled();
  });

  it("blackoutRepository calls prisma correctly", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findBlackouts();
    expect(prisma.blackoutPeriod.findMany).toHaveBeenCalled();
  });

  it("acquisitionRepository calls prisma correctly", async () => {
    const { prisma } = await import("@/lib/prisma");
    await findAcquisitionPeriodsForUser("u1");
    expect(prisma.acquisitionPeriod.findMany).toHaveBeenCalled();
  });
});
