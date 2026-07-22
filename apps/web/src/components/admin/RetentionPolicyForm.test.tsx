// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetentionPolicyForm } from "./RetentionPolicyForm";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function mockFetchOnce(response: unknown) {
  return vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve(response) });
}

describe("RetentionPolicyForm", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the title, checkbox state, and days value", () => {
    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={true} />);
    expect(screen.getByText("Bukti Laporan")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Aktifkan Bukti Laporan" })).toBeChecked();
    expect(screen.getByDisplayValue("90")).toBeInTheDocument();
  });

  it("renders the checkbox unchecked when disabled initially", () => {
    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={false} />);
    expect(screen.getByRole("checkbox", { name: "Aktifkan Bukti Laporan" })).not.toBeChecked();
  });

  it("toggling the checkbox and saving submits the updated enabled value", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={false} />);
    await user.click(screen.getByRole("checkbox", { name: "Aktifkan Bukti Laporan" }));
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/retention/policy",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ key: "report_evidence", value: { enabled: true, days: 90 } }),
        }),
      ),
    );
    expect(await screen.findByText("Tersimpan.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("editing the days field and saving sends the parsed number", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={true} />);
    const input = screen.getByDisplayValue("90");
    await user.clear(input);
    await user.type(input, "180");
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/retention/policy",
        expect.objectContaining({
          body: JSON.stringify({ key: "report_evidence", value: { enabled: true, days: 180 } }),
        }),
      ),
    );
  });

  it("shows a validation error and does not call fetch when days is cleared (empty string)", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={true} />);
    const input = screen.getByDisplayValue("90");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(await screen.findByText("Jumlah hari harus berupa angka positif.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a validation error when days is 0 or negative", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={true} />);
    const input = screen.getByDisplayValue("90");
    await user.clear(input);
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(await screen.findByText("Jumlah hari harus berupa angka positif.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error message and does not mark as saved when the save request fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Gagal menyimpan kebijakan ini." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={true} />);
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(await screen.findByText("Gagal menyimpan kebijakan ini.")).toBeInTheDocument();
    expect(screen.queryByText("Tersimpan.")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={true} />);
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(await screen.findByText("Gagal menghubungi server.")).toBeInTheDocument();
  });

  it("shows 'Menyimpan...' and disables the button while the save request is in flight", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<RetentionPolicyForm policyKey="report_evidence" title="Bukti Laporan" days={90} enabled={true} />);
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(screen.getByRole("button", { name: "Menyimpan..." })).toBeDisabled();
  });
});
