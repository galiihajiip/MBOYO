import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { ApiError } from "./errors";

const getUser = vi.fn();

vi.mock("../supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "../supabase/server";
import { requireApiActor, requireApiRole, requireApiPermission } from "./authorize";

function mockSupabase(db: ReturnType<typeof createFakeDb>) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser },
    from: db.from.bind(db),
    rpc: db.rpc.bind(db),
  } as never);
}

describe("requireApiActor", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it("throws ApiError('unauthenticated') when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    mockSupabase(createFakeDb({}));

    await expect(requireApiActor()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws ApiError('unauthenticated') when no profile row is found for the user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSupabase(
      createFakeDb({
        from: { profiles: () => ({ data: null, error: null }) },
      }),
    );

    await expect(requireApiActor()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("returns the actor with userId, profileId, organizationId, and active roles", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", organization_id: "org-1" }, error: null }),
          role_assignments: () => ({ data: [{ role: "verifier" }, { role: "auditor" }], error: null }),
        },
      }),
    );

    const actor = await requireApiActor();
    expect(actor).toEqual({
      userId: "user-1",
      profileId: "profile-1",
      organizationId: "org-1",
      roles: ["verifier", "auditor"],
    });
  });

  it("returns an empty roles array when the profile has no active role_assignments", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", organization_id: "org-1" }, error: null }),
          role_assignments: () => ({ data: null, error: null }),
        },
      }),
    );

    const actor = await requireApiActor();
    expect(actor.roles).toEqual([]);
  });
});

describe("requireApiRole", () => {
  beforeEach(() => {
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns the actor when they hold one of the required roles", async () => {
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", organization_id: "org-1" }, error: null }),
          role_assignments: () => ({ data: [{ role: "verifier" }], error: null }),
        },
      }),
    );

    const actor = await requireApiRole("verifier", "auditor");
    expect(actor.roles).toEqual(["verifier"]);
  });

  it("throws ApiError('forbidden') when the actor holds none of the required roles", async () => {
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", organization_id: "org-1" }, error: null }),
          role_assignments: () => ({ data: [{ role: "reporter" }], error: null }),
        },
      }),
    );

    await expect(requireApiRole("verifier", "auditor")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("propagates ApiError('unauthenticated') from requireApiActor when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    mockSupabase(createFakeDb({}));

    await expect(requireApiRole("verifier")).rejects.toThrow(ApiError);
  });
});

describe("requireApiPermission", () => {
  beforeEach(() => {
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns the actor when one of their roles is permitted to perform (entity, action)", async () => {
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", organization_id: "org-1" }, error: null }),
          role_assignments: () => ({ data: [{ role: "reporter" }], error: null }),
        },
      }),
    );

    const actor = await requireApiPermission("report", "create");
    expect(actor.roles).toEqual(["reporter"]);
  });

  it("throws ApiError('forbidden') when no held role is permitted to perform (entity, action)", async () => {
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", organization_id: "org-1" }, error: null }),
          role_assignments: () => ({ data: [{ role: "auditor" }], error: null }),
        },
      }),
    );

    await expect(requireApiPermission("report", "create")).rejects.toMatchObject({ code: "forbidden" });
  });
});
