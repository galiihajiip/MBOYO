// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscalationRuleForm } from "./EscalationRuleForm";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function mockFetchOnce(response: unknown) {
  return vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve(response) });
}

// jsdom doesn't implement these, but Radix UI's Select relies on them for
// its pointer-based interactions — without stubs, opening/selecting throws.
// Assigned unconditionally (not `??=`) to avoid referencing the DOM lib's
// method type, which trips @typescript-eslint/unbound-method.
beforeEach(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

async function selectOption(user: ReturnType<typeof userEvent.setup>, triggerName: string, optionText: string) {
  await user.click(screen.getByRole("combobox", { name: triggerName }));
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByText(optionText));
}

describe("EscalationRuleForm", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders title, description, enabled checkbox state, and numeric fields for a threshold-type rule", () => {
    render(
      <EscalationRuleForm
        ruleType="verified_destroyed_threshold"
        title="Ambang Kehancuran Terverifikasi"
        description="Memicu eskalasi saat probabilitas kehancuran melewati ambang."
        value={{ enabled: true, level: "high", minProbability: 0.8 }}
      />,
    );

    expect(screen.getByText("Ambang Kehancuran Terverifikasi")).toBeInTheDocument();
    expect(screen.getByText("Memicu eskalasi saat probabilitas kehancuran melewati ambang.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Aktifkan Ambang Kehancuran Terverifikasi" })).toBeChecked();
    expect(screen.getByText("Probabilitas minimum (0-1)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.8")).toBeInTheDocument();
  });

  it("renders no numeric fields for 'task_overdue' rule type", () => {
    render(
      <EscalationRuleForm
        ruleType="task_overdue"
        title="Tugas Terlambat"
        description="Memicu eskalasi saat tugas melewati tenggat."
        value={{ enabled: false, level: "warning" }}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Aktifkan Tugas Terlambat" })).not.toBeChecked();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("renders multiple numeric fields in order for 'cluster_destroyed_radius'", () => {
    render(
      <EscalationRuleForm
        ruleType="cluster_destroyed_radius"
        title="Radius Klaster Hancur"
        description="Memicu eskalasi saat klaster laporan kehancuran padat."
        value={{ enabled: true, level: "critical", minCount: 5, radiusMeters: 500, windowHours: 6 }}
      />,
    );
    expect(screen.getByText("Jumlah laporan minimum")).toBeInTheDocument();
    expect(screen.getByText("Radius (meter)")).toBeInTheDocument();
    expect(screen.getByText("Jendela waktu (jam)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500")).toBeInTheDocument();
    expect(screen.getByDisplayValue("6")).toBeInTheDocument();
  });

  it("toggling the checkbox and saving submits the updated enabled value", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: {} });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EscalationRuleForm
        ruleType="task_overdue"
        title="Tugas Terlambat"
        description="Memicu eskalasi saat tugas melewati tenggat."
        value={{ enabled: false, level: "warning" }}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Aktifkan Tugas Terlambat" }));
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/escalation-settings",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ ruleType: "task_overdue", value: { enabled: true, level: "warning" } }),
        }),
      ),
    );
    expect(await screen.findByText("Tersimpan.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("changing the notification level select changes the saved payload", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: {} });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EscalationRuleForm
        ruleType="task_overdue"
        title="Tugas Terlambat"
        description="Memicu eskalasi saat tugas melewati tenggat."
        value={{ enabled: true, level: "warning" }}
      />,
    );

    await selectOption(user, "Tingkat notifikasi Tugas Terlambat", "critical");
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/escalation-settings",
        expect.objectContaining({
          body: JSON.stringify({ ruleType: "task_overdue", value: { enabled: true, level: "critical" } }),
        }),
      ),
    );
  });

  it("editing a numeric field and saving sends the parsed number in the payload", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: {} });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EscalationRuleForm
        ruleType="verified_destroyed_threshold"
        title="Ambang Kehancuran Terverifikasi"
        description="Memicu eskalasi saat probabilitas kehancuran melewati ambang."
        value={{ enabled: true, level: "high", minProbability: 0.8 }}
      />,
    );

    const input = screen.getByDisplayValue("0.8");
    await user.clear(input);
    await user.type(input, "0.95");
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/escalation-settings",
        expect.objectContaining({
          body: JSON.stringify({
            ruleType: "verified_destroyed_threshold",
            value: { enabled: true, level: "high", minProbability: 0.95 },
          }),
        }),
      ),
    );
  });

  // Note: <input type="number"> refuses non-numeric keystrokes in both real
  // browsers and jsdom, so a user can never actually get the field into a
  // Number.isNaN state through typing — Number("") is 0, not NaN. That makes
  // handleSave's `if (Number.isNaN(parsed))` guard effectively unreachable
  // via normal user interaction for this field type (clearing the input and
  // saving silently sends 0, not a validation error). Documented here as an
  // observation rather than "fixed" per instructions not to touch component
  // source.
  it("clearing a numeric field and saving sends 0 (Number('') is 0, not NaN) rather than showing a validation error", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: {} });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EscalationRuleForm
        ruleType="verified_destroyed_threshold"
        title="Ambang Kehancuran Terverifikasi"
        description="Memicu eskalasi saat probabilitas kehancuran melewati ambang."
        value={{ enabled: true, level: "high", minProbability: 0.8 }}
      />,
    );

    const input = screen.getByDisplayValue("0.8");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/escalation-settings",
        expect.objectContaining({
          body: JSON.stringify({
            ruleType: "verified_destroyed_threshold",
            value: { enabled: true, level: "high", minProbability: 0 },
          }),
        }),
      ),
    );
    expect(screen.queryByText("Probabilitas minimum (0-1) harus berupa angka.")).not.toBeInTheDocument();
  });

  it("shows an error message and does not mark as saved when the save request fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Nilai tidak valid." } });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EscalationRuleForm
        ruleType="task_overdue"
        title="Tugas Terlambat"
        description="Memicu eskalasi saat tugas melewati tenggat."
        value={{ enabled: true, level: "warning" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(await screen.findByText("Nilai tidak valid.")).toBeInTheDocument();
    expect(screen.queryByText("Tersimpan.")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(
      <EscalationRuleForm
        ruleType="task_overdue"
        title="Tugas Terlambat"
        description="Memicu eskalasi saat tugas melewati tenggat."
        value={{ enabled: true, level: "warning" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(await screen.findByText("Gagal menghubungi server untuk menyimpan aturan eskalasi.")).toBeInTheDocument();
  });
});
