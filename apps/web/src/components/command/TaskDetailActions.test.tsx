// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDetailActions } from "./TaskDetailActions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function mockFetchOnce(response: unknown) {
  return vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve(response) });
}

describe("TaskDetailActions", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("status 'draft' shows the assignment form (Tugaskan Kepada) and a disabled cancel-less layout", () => {
    render(<TaskDetailActions taskId="task-1" status="draft" />);
    expect(screen.getByText("Tugaskan Kepada (Profile ID)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("UUID profil penerima tugas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tugaskan" })).toBeDisabled();
    // draft has no NEXT_STATUS entry and canCancel is true for draft.
    expect(screen.getByText("Batalkan Tugas (wajib alasan)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batalkan Tugas" })).toBeDisabled();
  });

  it("status 'assigned' shows 'Tugaskan Ulang Kepada' and the 'Konfirmasi Diterima' transition", () => {
    render(<TaskDetailActions taskId="task-1" status="assigned" />);
    expect(screen.getByText("Tugaskan Ulang Kepada (Profile ID)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Konfirmasi Diterima" })).toBeInTheDocument();
  });

  it("typing an assignee profile ID enables the 'Tugaskan' button and submits the correct payload", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskDetailActions taskId="task-1" status="draft" />);
    await user.type(screen.getByPlaceholderText("UUID profil penerima tugas"), "profile-abc");
    expect(screen.getByRole("button", { name: "Tugaskan" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Tugaskan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/command/tasks/task-1/assign",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ assigneeProfileId: "profile-abc" }),
        }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("status 'acknowledged' shows only the 'Mulai Kerjakan' transition (no assignment form)", () => {
    render(<TaskDetailActions taskId="task-1" status="acknowledged" />);
    expect(screen.queryByText(/Tugaskan/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mulai Kerjakan" })).toBeInTheDocument();
  });

  it("status 'in_progress' shows both 'Tandai Terkendala' and 'Tandai Selesai' transitions", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskDetailActions taskId="task-1" status="in_progress" />);
    expect(screen.getByRole("button", { name: "Tandai Terkendala" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tandai Selesai" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tandai Selesai" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/command/tasks/task-1/status",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ newStatus: "completed" }) }),
      ),
    );
  });

  it("status 'blocked' shows the 'Lanjutkan Kembali' transition", () => {
    render(<TaskDetailActions taskId="task-1" status="blocked" />);
    expect(screen.getByRole("button", { name: "Lanjutkan Kembali" })).toBeInTheDocument();
  });

  it("status 'completed' shows no transitions and no cancel section", () => {
    render(<TaskDetailActions taskId="task-1" status="completed" />);
    expect(screen.queryByText("Batalkan Tugas (wajib alasan)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /./ })).not.toBeInTheDocument();
  });

  it("status 'cancelled' shows no transitions and no cancel section", () => {
    render(<TaskDetailActions taskId="task-1" status="cancelled" />);
    expect(screen.queryByText("Batalkan Tugas (wajib alasan)")).not.toBeInTheDocument();
  });

  it("the cancel button stays disabled until a reason is entered, then submits with the reason", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskDetailActions taskId="task-1" status="in_progress" />);
    expect(screen.getByRole("button", { name: "Batalkan Tugas" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Alasan pembatalan..."), "Sumber daya tidak tersedia.");
    expect(screen.getByRole("button", { name: "Batalkan Tugas" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Batalkan Tugas" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/command/tasks/task-1/status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ newStatus: "cancelled", reason: "Sumber daya tidak tersedia." }),
        }),
      ),
    );
  });

  it("shows an error message and does not refresh when the status transition fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Anda bukan penerima tugas ini." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskDetailActions taskId="task-1" status="acknowledged" />);
    await user.click(screen.getByRole("button", { name: "Mulai Kerjakan" }));

    expect(await screen.findByText("Anda bukan penerima tugas ini.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(<TaskDetailActions taskId="task-1" status="acknowledged" />);
    await user.click(screen.getByRole("button", { name: "Mulai Kerjakan" }));

    expect(await screen.findByText("Gagal menghubungi server.")).toBeInTheDocument();
  });
});
