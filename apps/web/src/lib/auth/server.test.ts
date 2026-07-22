import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";

const getUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("../supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

import { createServerSupabaseClient } from "../supabase/server";
import { getCurrentUser, requireAuthenticated, requireRole, requirePermission } from "./server";

function mockSupabase(db: ReturnType<typeof createFakeDb>) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser },
    from: db.from.bind(db),
  } as never);
}

describe("getCurrentUser", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
  });

  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    mockSupabase(createFakeDb({}));

    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when no profile row is found for the user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.com" } } });
    mockSupabase(
      createFakeDb({
        from: { profiles: () => ({ data: null, error: null }) },
      }),
    );

    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the current user with roles when session + profile exist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.com" } } });
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", display_name: "Budi" }, error: null }),
          role_assignments: () => ({ data: [{ role: "verifier" }], error: null }),
        },
      }),
    );

    const user = await getCurrentUser();
    expect(user).toEqual({
      userId: "user-1",
      profileId: "profile-1",
      email: "a@b.com",
      displayName: "Budi",
      roles: ["verifier"],
    });
  });

  it("defaults email to null when the auth user has none", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: undefined } } });
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", display_name: "Budi" }, error: null }),
          role_assignments: () => ({ data: [], error: null }),
        },
      }),
    );

    const user = await getCurrentUser();
    expect(user?.email).toBeNull();
  });
});

describe("requireAuthenticated", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
  });

  it("redirects to /sesi-berakhir when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    mockSupabase(createFakeDb({}));

    await expect(requireAuthenticated()).rejects.toThrow("NEXT_REDIRECT:/sesi-berakhir");
    expect(redirect).toHaveBeenCalledWith("/sesi-berakhir");
  });

  it("returns the current user when a session exists", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.com" } } });
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", display_name: "Budi" }, error: null }),
          role_assignments: () => ({ data: [], error: null }),
        },
      }),
    );

    const user = await requireAuthenticated();
    expect(user.userId).toBe("user-1");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.com" } } });
  });

  it("returns the user when they hold one of the required roles", async () => {
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", display_name: "Budi" }, error: null }),
          role_assignments: () => ({ data: [{ role: "verifier" }], error: null }),
        },
      }),
    );

    const user = await requireRole("verifier", "auditor");
    expect(user.roles).toEqual(["verifier"]);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /tidak-diizinkan when the user holds none of the required roles", async () => {
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", display_name: "Budi" }, error: null }),
          role_assignments: () => ({ data: [{ role: "reporter" }], error: null }),
        },
      }),
    );

    await expect(requireRole("verifier", "auditor")).rejects.toThrow("NEXT_REDIRECT:/tidak-diizinkan");
    expect(redirect).toHaveBeenCalledWith("/tidak-diizinkan");
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.com" } } });
  });

  it("returns the user when one of their roles is permitted to perform (entity, action)", async () => {
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", display_name: "Budi" }, error: null }),
          role_assignments: () => ({ data: [{ role: "reporter" }], error: null }),
        },
      }),
    );

    const user = await requirePermission("report", "create");
    expect(user.roles).toEqual(["reporter"]);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /tidak-diizinkan when no held role is permitted", async () => {
    mockSupabase(
      createFakeDb({
        from: {
          profiles: () => ({ data: { id: "profile-1", display_name: "Budi" }, error: null }),
          role_assignments: () => ({ data: [{ role: "auditor" }], error: null }),
        },
      }),
    );

    await expect(requirePermission("report", "create")).rejects.toThrow("NEXT_REDIRECT:/tidak-diizinkan");
    expect(redirect).toHaveBeenCalledWith("/tidak-diizinkan");
  });
});
