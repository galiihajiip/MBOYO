import { describe, expect, it } from "vitest";
import type { Role } from "@mboyo/domain";
import { roleHasPermission } from "./permissions";

const ALL_ROLES: Role[] = [
  "reporter",
  "verifier",
  "response_coordinator",
  "system_administrator",
  "auditor",
];

function otherRoles(role: Role): Role[] {
  return ALL_ROLES.filter((r) => r !== role);
}

describe("roleHasPermission — cross-role denial", () => {
  it("only Reporter can create a report", () => {
    expect(roleHasPermission("reporter", "report", "create")).toBe(true);
    for (const role of otherRoles("reporter")) {
      expect(roleHasPermission(role, "report", "create")).toBe(false);
    }
  });

  it("only Verifier can approve (confirm/override/reject) a report", () => {
    expect(roleHasPermission("verifier", "report", "approve")).toBe(true);
    for (const role of otherRoles("verifier")) {
      expect(roleHasPermission(role, "report", "approve")).toBe(false);
    }
  });

  it("only Response Coordinator can create/assign response_tasks", () => {
    expect(roleHasPermission("response_coordinator", "response_task", "create")).toBe(true);
    expect(roleHasPermission("response_coordinator", "response_task", "assign")).toBe(true);
    for (const role of otherRoles("response_coordinator")) {
      expect(roleHasPermission(role, "response_task", "create")).toBe(false);
      expect(roleHasPermission(role, "response_task", "assign")).toBe(false);
    }
  });

  it("only System Administrator can manage role_assignments", () => {
    expect(roleHasPermission("system_administrator", "role_assignment", "create")).toBe(true);
    expect(roleHasPermission("system_administrator", "role_assignment", "update")).toBe(true);
    expect(roleHasPermission("system_administrator", "role_assignment", "delete")).toBe(true);
    for (const role of otherRoles("system_administrator")) {
      expect(roleHasPermission(role, "role_assignment", "create")).toBe(false);
      expect(roleHasPermission(role, "role_assignment", "update")).toBe(false);
      expect(roleHasPermission(role, "role_assignment", "delete")).toBe(false);
    }
  });

  it("only Verifier and Response Coordinator can read verification_reviews (plus Auditor)", () => {
    expect(roleHasPermission("verifier", "verification_review", "read")).toBe(true);
    expect(roleHasPermission("response_coordinator", "verification_review", "read")).toBe(true);
    expect(roleHasPermission("auditor", "verification_review", "read")).toBe(true);
    expect(roleHasPermission("reporter", "verification_review", "read")).toBe(false);
    expect(roleHasPermission("system_administrator", "verification_review", "read")).toBe(false);
  });

  it("only Verifier can create a gemini_advisory_request; Verifier and Auditor can read it", () => {
    expect(roleHasPermission("verifier", "gemini_advisory_request", "create")).toBe(true);
    for (const role of otherRoles("verifier")) {
      expect(roleHasPermission(role, "gemini_advisory_request", "create")).toBe(false);
    }
    expect(roleHasPermission("verifier", "gemini_advisory_request", "read")).toBe(true);
    expect(roleHasPermission("auditor", "gemini_advisory_request", "read")).toBe(true);
    expect(roleHasPermission("reporter", "gemini_advisory_request", "read")).toBe(false);
    expect(roleHasPermission("response_coordinator", "gemini_advisory_request", "read")).toBe(false);
    expect(roleHasPermission("system_administrator", "gemini_advisory_request", "read")).toBe(false);
  });
});

describe("roleHasPermission — Auditor cannot mutate", () => {
  const mutatingActions = ["create", "update", "delete", "approve", "assign", "configure"] as const;
  const entitiesAuditorCanRead = [
    "report",
    "report_evidence",
    "verification_review",
    "response_task",
    "model_registry_entry",
    "audit_event",
  ];

  it("Auditor has zero mutating permission on any entity in the permission table", () => {
    for (const entity of entitiesAuditorCanRead) {
      for (const action of mutatingActions) {
        expect(
          roleHasPermission("auditor", entity, action),
          `auditor should not have ${action} on ${entity}`,
        ).toBe(false);
      }
    }
  });

  it("no role — including Auditor and System Administrator — can update or delete audit_event", () => {
    for (const role of ALL_ROLES) {
      expect(roleHasPermission(role, "audit_event", "update")).toBe(false);
      expect(roleHasPermission(role, "audit_event", "delete")).toBe(false);
    }
  });
});

describe("roleHasPermission — Admin cannot validate or dispatch without a separately assigned role", () => {
  it("System Administrator cannot approve (validate) a report", () => {
    expect(roleHasPermission("system_administrator", "report", "approve")).toBe(false);
  });

  it("System Administrator cannot create a verification_review", () => {
    expect(roleHasPermission("system_administrator", "verification_review", "create")).toBe(false);
  });

  it("System Administrator cannot create, update, or assign response_tasks (dispatch)", () => {
    expect(roleHasPermission("system_administrator", "response_task", "create")).toBe(false);
    expect(roleHasPermission("system_administrator", "response_task", "update")).toBe(false);
    expect(roleHasPermission("system_administrator", "response_task", "assign")).toBe(false);
  });

  it("System Administrator cannot create or update incident_clusters", () => {
    expect(roleHasPermission("system_administrator", "incident_cluster", "create")).toBe(false);
    expect(roleHasPermission("system_administrator", "incident_cluster", "update")).toBe(false);
  });

  it("System Administrator retains its own configuration-domain permissions", () => {
    expect(roleHasPermission("system_administrator", "role_assignment", "create")).toBe(true);
    expect(roleHasPermission("system_administrator", "system_setting", "configure")).toBe(true);
    expect(roleHasPermission("system_administrator", "model_registry_entry", "approve")).toBe(true);
  });
});

describe("roleHasPermission — only System Administrator can archive a report (report:configure), and it is not validation", () => {
  it("only System Administrator holds report:configure", () => {
    expect(roleHasPermission("system_administrator", "report", "configure")).toBe(true);
    for (const role of otherRoles("system_administrator")) {
      expect(roleHasPermission(role, "report", "configure")).toBe(false);
    }
  });

  it("report:configure and report:approve are held by disjoint roles — archiving is never validation", () => {
    expect(roleHasPermission("system_administrator", "report", "approve")).toBe(false);
    expect(roleHasPermission("verifier", "report", "configure")).toBe(false);
  });
});

describe("roleHasPermission — fails closed for unknown entity/action pairs", () => {
  it("returns false for an (entity, action) pair not present in the table, for every role", () => {
    for (const role of ALL_ROLES) {
      expect(roleHasPermission(role, "nonexistent_entity", "create")).toBe(false);
    }
  });
});
