import { describe, expect, it } from "vitest";
import type { Role } from "@mboyo/domain";
import { findRequiredRolesForPath, isPublicPath, PROTECTED_ROUTE_ROLES, ROLE_HOME_ROUTE } from "./route-map";

const ALL_ROLES: Role[] = [
  "reporter",
  "verifier",
  "response_coordinator",
  "system_administrator",
  "auditor",
];

describe("findRequiredRolesForPath — cross-role route denial", () => {
  it("maps each role's home route to exactly that role", () => {
    for (const role of ALL_ROLES) {
      const roles = findRequiredRolesForPath(ROLE_HOME_ROUTE[role]);
      expect(roles).toEqual([role]);
    }
  });

  it("matches nested paths under a protected prefix", () => {
    expect(findRequiredRolesForPath("/admin/pengguna")).toEqual(["system_administrator"]);
    expect(findRequiredRolesForPath("/verifier/antrean/abc-123")).toEqual(["verifier"]);
  });

  it("does not match a different role's route as a prefix collision", () => {
    // /admin must not match /adminfoo, and /audit must not match /auditor's
    // reporter-adjacent-looking paths — exact segment boundary matters.
    expect(findRequiredRolesForPath("/adminfoo")).toBeNull();
    expect(findRequiredRolesForPath("/auditfoo")).toBeNull();
  });

  it("every protected route requires exactly one role (no accidental cross-role overlap)", () => {
    for (const entry of PROTECTED_ROUTE_ROLES) {
      expect(entry.roles).toHaveLength(1);
    }
  });

  it("returns null for a path with no role requirement", () => {
    expect(findRequiredRolesForPath("/some/unlisted/route")).toBeNull();
  });
});

describe("isPublicPath", () => {
  it("treats /masuk, /, and the design system as public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/masuk")).toBe(true);
    expect(isPublicPath("/design-system")).toBe(true);
  });

  it("treats the four trust pages as public", () => {
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/methodology")).toBe(true);
    expect(isPublicPath("/data-governance")).toBe(true);
    expect(isPublicPath("/accessibility")).toBe(true);
  });

  it("treats every role-protected route as non-public", () => {
    for (const role of ALL_ROLES) {
      expect(isPublicPath(ROLE_HOME_ROUTE[role])).toBe(false);
    }
  });
});
