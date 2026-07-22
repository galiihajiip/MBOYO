// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecisionPanel } from "./DecisionPanel";

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

describe("DecisionPanel", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the six decision buttons and no extra fields before a decision is selected", () => {
    render(<DecisionPanel reportId="report-1" />);
    expect(screen.getByRole("button", { name: "Konfirmasi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ganti Klasifikasi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tolak" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minta Informasi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bukti Tidak Cukup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eskalasi" })).toBeInTheDocument();
    expect(screen.queryByText("Klasifikasi Pengganti")).not.toBeInTheDocument();
    expect(screen.queryByText("Kategori Alasan Penolakan")).not.toBeInTheDocument();
    expect(screen.queryByText(/Catatan/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan Keputusan" })).toBeDisabled();
  });

  it("selecting 'Konfirmasi' shows notes as optional and enables submit without notes", async () => {
    const user = userEvent.setup();
    render(<DecisionPanel reportId="report-1" />);
    await user.click(screen.getByRole("button", { name: "Konfirmasi" }));
    expect(screen.getByText("Catatan (opsional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan Keputusan" })).not.toBeDisabled();
  });

  it("submits a 'confirm' decision and shows the success state", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: {} });
    vi.stubGlobal("fetch", fetchMock);

    render(<DecisionPanel reportId="report-1" />);
    await user.click(screen.getByRole("button", { name: "Konfirmasi" }));
    await user.click(screen.getByRole("button", { name: "Simpan Keputusan" }));

    expect(await screen.findByText("Keputusan berhasil disimpan.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reports/report-1/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          decision: "confirm",
          overrideSeverity: undefined,
          rejectReasonCategory: undefined,
          notes: undefined,
        }),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("requires override severity before submit is enabled, and includes it in the payload", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: {} });
    vi.stubGlobal("fetch", fetchMock);

    render(<DecisionPanel reportId="report-1" />);
    await user.click(screen.getByRole("button", { name: "Ganti Klasifikasi" }));

    expect(screen.getByText("Klasifikasi Pengganti")).toBeInTheDocument();
    expect(screen.getByText("Catatan (wajib)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan Keputusan" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Klasifikasi Pengganti" }));
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Hancur Total"));

    // Still disabled — notes are mandatory for override.
    expect(screen.getByRole("button", { name: "Simpan Keputusan" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Jelaskan alasan keputusan ini..."), "Kondisi lebih parah dari perkiraan awal.");
    expect(screen.getByRole("button", { name: "Simpan Keputusan" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Simpan Keputusan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reports/report-1/decision",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            decision: "override",
            overrideSeverity: "destroyed",
            rejectReasonCategory: undefined,
            notes: "Kondisi lebih parah dari perkiraan awal.",
          }),
        }),
      ),
    );
  });

  it("requires reject reason category before submit is enabled", async () => {
    const user = userEvent.setup();
    render(<DecisionPanel reportId="report-1" />);
    await user.click(screen.getByRole("button", { name: "Tolak" }));

    expect(screen.getByText("Kategori Alasan Penolakan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan Keputusan" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Kategori Alasan Penolakan" }));
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Laporan duplikat"));

    // Still disabled — notes are mandatory for reject.
    expect(screen.getByRole("button", { name: "Simpan Keputusan" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Jelaskan alasan keputusan ini..."), "Sudah dilaporkan sebelumnya.");
    expect(screen.getByRole("button", { name: "Simpan Keputusan" })).not.toBeDisabled();
  });

  it("shows an error message and stays on the form when the decision save fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Keputusan tidak valid." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<DecisionPanel reportId="report-1" />);
    await user.click(screen.getByRole("button", { name: "Konfirmasi" }));
    await user.click(screen.getByRole("button", { name: "Simpan Keputusan" }));

    expect(await screen.findByText("Keputusan tidak valid.")).toBeInTheDocument();
    expect(screen.queryByText("Keputusan berhasil disimpan.")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(<DecisionPanel reportId="report-1" />);
    await user.click(screen.getByRole("button", { name: "Konfirmasi" }));
    await user.click(screen.getByRole("button", { name: "Simpan Keputusan" }));

    expect(await screen.findByText("Gagal menghubungi server untuk menyimpan keputusan.")).toBeInTheDocument();
  });

  it("switching decisions resets previously entered notes and selections", async () => {
    const user = userEvent.setup();
    render(<DecisionPanel reportId="report-1" />);

    await user.click(screen.getByRole("button", { name: "Konfirmasi" }));
    await user.type(screen.getByPlaceholderText("Jelaskan alasan keputusan ini..."), "Catatan awal");
    expect(screen.getByPlaceholderText("Jelaskan alasan keputusan ini...")).toHaveValue("Catatan awal");

    await user.click(screen.getByRole("button", { name: "Minta Informasi" }));
    expect(screen.getByPlaceholderText("Jelaskan alasan keputusan ini...")).toHaveValue("");
  });
});
