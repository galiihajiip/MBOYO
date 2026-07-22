import { describe, expect, it } from "vitest";
import type { Role } from "@mboyo/domain";
import { MOBILE_BOTTOM_BAR_COUNT, ROLE_NAV_ITEMS } from "./nav-items";

const ALL_ROLES: Role[] = [
  "reporter",
  "verifier",
  "response_coordinator",
  "system_administrator",
  "auditor",
];

/**
 * Expected labels transcribed directly from this block's prompt and
 * docs/product/NAVIGATION_BY_ROLE.md — the test fails if ROLE_NAV_ITEMS
 * ever drifts from that source of truth, whether by adding an item a role
 * shouldn't have or dropping one it should.
 */
const EXPECTED_LABELS: Record<Role, string[]> = {
  reporter: ["Beranda", "Buat Laporan", "Antrean Offline", "Laporan Saya", "Bantuan", "Profil"],
  verifier: [
    "Ringkasan",
    "Antrean Verifikasi",
    "Peta Bukti",
    "Semua Laporan",
    "Permintaan Informasi",
    "Analitik",
    "Notifikasi",
    "Profil",
  ],
  response_coordinator: [
    "Command Center",
    "Peta Krisis",
    "Prioritas",
    "Tugas Respons",
    "Analitik",
    "Ekspor",
    "Notifikasi",
    "Profil",
  ],
  system_administrator: [
    "Administrasi",
    "Pengguna & Role",
    "Event Bencana",
    "Aturan Eskalasi",
    "Integrasi",
    "Kesehatan Sistem",
    "Pengaturan",
    "Profil",
  ],
  auditor: [
    "Audit Trail",
    "Laporan Read-Only",
    "Model Registry",
    "Evaluasi Model",
    "Export Compliance",
    "Retensi Data",
    "Profil",
  ],
};

describe("ROLE_NAV_ITEMS — matches docs/product/NAVIGATION_BY_ROLE.md exactly", () => {
  for (const role of ALL_ROLES) {
    it(`${role} has exactly the specified items, in order`, () => {
      const labels = ROLE_NAV_ITEMS[role].map((item) => item.label);
      expect(labels).toEqual(EXPECTED_LABELS[role]);
    });
  }
});

describe("ROLE_NAV_ITEMS — cross-role isolation (navigation never exposes forbidden actions)", () => {
  it("no role's navigation contains another role's role-specific items", () => {
    // Items unique to one role that must never appear in any other role's nav.
    const roleSpecificLabels: Record<Role, string[]> = {
      reporter: ["Buat Laporan", "Antrean Offline"],
      verifier: ["Antrean Verifikasi", "Permintaan Informasi"],
      response_coordinator: ["Command Center", "Peta Krisis", "Prioritas", "Tugas Respons", "Ekspor"],
      system_administrator: ["Pengguna & Role", "Event Bencana", "Aturan Eskalasi", "Integrasi", "Kesehatan Sistem"],
      auditor: ["Audit Trail", "Laporan Read-Only", "Model Registry", "Evaluasi Model", "Export Compliance", "Retensi Data"],
    };

    for (const owningRole of ALL_ROLES) {
      const otherRoles = ALL_ROLES.filter((r) => r !== owningRole);
      for (const otherRole of otherRoles) {
        const otherLabels = ROLE_NAV_ITEMS[otherRole].map((item) => item.label);
        for (const forbiddenLabel of roleSpecificLabels[owningRole]) {
          expect(
            otherLabels,
            `${otherRole}'s nav must not contain "${forbiddenLabel}" (owned by ${owningRole})`,
          ).not.toContain(forbiddenLabel);
        }
      }
    }
  });

  it("every nav item's href falls under that role's own route prefix", () => {
    const rolePrefix: Record<Role, string> = {
      reporter: "/reporter",
      verifier: "/verifier",
      response_coordinator: "/command",
      system_administrator: "/admin",
      auditor: "/audit",
    };

    for (const role of ALL_ROLES) {
      for (const item of ROLE_NAV_ITEMS[role]) {
        const prefix = rolePrefix[role];
        expect(
          item.href === prefix || item.href.startsWith(`${prefix}/`),
          `${role}'s nav item "${item.label}" (${item.href}) must fall under ${prefix}`,
        ).toBe(true);
      }
    }
  });

  it("System Administrator's navigation contains no report-validation or task-dispatch item", () => {
    const adminLabels = ROLE_NAV_ITEMS.system_administrator.map((item) => item.label);
    const forbiddenForAdmin = ["Antrean Verifikasi", "Tugas Respons", "Command Center", "Prioritas"];
    for (const label of forbiddenForAdmin) {
      expect(adminLabels).not.toContain(label);
    }
  });

  it("Auditor's navigation contains no item named after a mutating action", () => {
    const auditorLabels = ROLE_NAV_ITEMS.auditor.map((item) => item.label);
    // The Auditor's own items are all read/oversight-framed (Trail, Read-Only,
    // Registry, Evaluasi, Compliance, Retensi) plus self-service Profil —
    // none should resemble a creation/dispatch workflow name.
    const mutatingSounding = ["Buat Laporan", "Tugas Respons", "Command Center", "Pengguna & Role"];
    for (const label of mutatingSounding) {
      expect(auditorLabels).not.toContain(label);
    }
  });
});

describe("MOBILE_BOTTOM_BAR_COUNT", () => {
  it("is smaller than every role's total item count, so every role has an overflow sheet", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_NAV_ITEMS[role].length).toBeGreaterThan(MOBILE_BOTTOM_BAR_COUNT);
    }
  });
});
