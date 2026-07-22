// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTaskForm } from "./CreateTaskForm";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function mockFetchOnce(response: unknown) {
  return vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve(response) });
}

describe("CreateTaskForm", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a warning and no form fields when neither reportId nor incidentClusterId is provided", () => {
    render(<CreateTaskForm />);
    expect(
      screen.getByText("Tugas harus dibuat dari sebuah laporan atau klaster — buka formulir ini melalui Peta Krisis, Prioritas, atau Semua Laporan."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Kategori")).not.toBeInTheDocument();
  });

  it("renders all form fields when reportId is provided", () => {
    render(<CreateTaskForm reportId="report-1" />);
    expect(screen.getByText("Kategori")).toBeInTheDocument();
    expect(screen.getByText("Deskripsi (opsional)")).toBeInTheDocument();
    expect(screen.getByText("Batas Waktu (opsional)")).toBeInTheDocument();
    expect(screen.getByText("Sumber Daya (opsional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buat Tugas" })).toBeInTheDocument();
  });

  it("renders the form when only incidentClusterId is provided", () => {
    render(<CreateTaskForm incidentClusterId="cluster-1" />);
    expect(screen.getByText("Kategori")).toBeInTheDocument();
  });

  it("disables the submit button until a category is entered", async () => {
    const user = userEvent.setup();
    render(<CreateTaskForm reportId="report-1" />);

    expect(screen.getByRole("button", { name: "Buat Tugas" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Evakuasi, Distribusi Logistik, ..."), "Evakuasi");
    expect(screen.getByRole("button", { name: "Buat Tugas" })).not.toBeDisabled();
  });

  it("submits the minimal payload (category only) trimmed, with optional fields omitted", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: { task: { id: "task-1" } } });
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateTaskForm reportId="report-1" />);
    await user.type(screen.getByPlaceholderText("Evakuasi, Distribusi Logistik, ..."), "  Evakuasi  ");
    await user.click(screen.getByRole("button", { name: "Buat Tugas" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/command/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            reportId: "report-1",
            incidentClusterId: undefined,
            category: "Evakuasi",
            description: undefined,
            dueAt: undefined,
            resources: undefined,
          }),
        }),
      ),
    );
    expect(push).toHaveBeenCalledWith("/command/tugas/task-1");
  });

  it("submits the full payload with description, due date, and resources trimmed", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: { task: { id: "task-2" } } });
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateTaskForm incidentClusterId="cluster-1" />);
    await user.type(screen.getByPlaceholderText("Evakuasi, Distribusi Logistik, ..."), "Distribusi Logistik");
    await user.type(screen.getByPlaceholderText("Detail tugas..."), "  Kirim bantuan  ");
    const dateInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    await user.type(dateInput, "2026-08-01T10:00");
    await user.type(screen.getByPlaceholderText("Personel, peralatan, perbekalan..."), "  5 personel  ");
    await user.click(screen.getByRole("button", { name: "Buat Tugas" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const call = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(call[1].body) as Record<string, unknown>;
    expect(body.incidentClusterId).toBe("cluster-1");
    expect(body.category).toBe("Distribusi Logistik");
    expect(body.description).toBe("Kirim bantuan");
    expect(body.resources).toBe("5 personel");
    expect(typeof body.dueAt).toBe("string");
    expect(push).toHaveBeenCalledWith("/command/tugas/task-2");
  });

  it("shows an error message and does not navigate when the create request fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Gagal membuat tugas ini." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateTaskForm reportId="report-1" />);
    await user.type(screen.getByPlaceholderText("Evakuasi, Distribusi Logistik, ..."), "Evakuasi");
    await user.click(screen.getByRole("button", { name: "Buat Tugas" }));

    expect(await screen.findByText("Gagal membuat tugas ini.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(<CreateTaskForm reportId="report-1" />);
    await user.type(screen.getByPlaceholderText("Evakuasi, Distribusi Logistik, ..."), "Evakuasi");
    await user.click(screen.getByRole("button", { name: "Buat Tugas" }));

    expect(await screen.findByText("Gagal menghubungi server untuk membuat tugas respons.")).toBeInTheDocument();
  });

  it("shows 'Membuat tugas...' and disables the button while the request is in flight", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<CreateTaskForm reportId="report-1" />);
    await user.type(screen.getByPlaceholderText("Evakuasi, Distribusi Logistik, ..."), "Evakuasi");
    await user.click(screen.getByRole("button", { name: "Buat Tugas" }));

    expect(screen.getByRole("button", { name: "Membuat tugas..." })).toBeDisabled();
  });
});
