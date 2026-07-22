import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { grantRole, listUsersWithRoles, revokeRole } from "./users";

const PROFILE_ROW = { id: "profile-1", display_name: "Budi", phone: null, created_at: "2026-07-26T00:00:00.000Z" };
const ROLE_ROW = { id: "ra-1", profile_id: "profile-1", role: "verifier" as const, granted_by: null, granted_at: "2026-07-26T00:00:00.000Z", revoked_at: null };

describe("listUsersWithRoles", () => {
  it("joins profiles with their active role assignments", async () => {
    const fakeDb = createFakeDb({
      from: {
        profiles: () => ({ data: [PROFILE_ROW], error: null }),
        role_assignments: () => ({ data: [ROLE_ROW], error: null }),
      },
    });

    const result = await listUsersWithRoles(fakeDb as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.roles).toEqual(["verifier"]);
  });

  it("returns an empty roles array for a profile with none", async () => {
    const fakeDb = createFakeDb({
      from: {
        profiles: () => ({ data: [PROFILE_ROW], error: null }),
        role_assignments: () => ({ data: [], error: null }),
      },
    });

    const result = await listUsersWithRoles(fakeDb as never);
    expect(result[0]?.roles).toEqual([]);
  });

  it("throws ApiError('internal_error') when the profiles query errors", async () => {
    const fakeDb = createFakeDb({
      from: { profiles: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listUsersWithRoles(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("grantRole", () => {
  it("resolves without error on success", async () => {
    const fakeDb = createFakeDb({ rpc: { grant_role: () => ({ data: ROLE_ROW, error: null }) } });

    await expect(grantRole(fakeDb as never, { profileId: "profile-1", role: "verifier" })).resolves.toBeUndefined();
  });

  it("maps a 42501 error to ApiError('forbidden')", async () => {
    const fakeDb = createFakeDb({
      rpc: { grant_role: () => ({ data: null, error: { code: "42501", message: "no role" } }) },
    });

    await expect(grantRole(fakeDb as never, { profileId: "profile-1", role: "verifier" })).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("revokeRole", () => {
  it("resolves without error on success", async () => {
    const fakeDb = createFakeDb({ rpc: { revoke_role: () => ({ data: ROLE_ROW, error: null }) } });

    await expect(revokeRole(fakeDb as never, { profileId: "profile-1", role: "verifier" })).resolves.toBeUndefined();
  });

  it("maps a P0002 error to ApiError('not_found')", async () => {
    const fakeDb = createFakeDb({
      rpc: { revoke_role: () => ({ data: null, error: { code: "P0002", message: "not found" } }) },
    });

    await expect(revokeRole(fakeDb as never, { profileId: "profile-1", role: "verifier" })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
