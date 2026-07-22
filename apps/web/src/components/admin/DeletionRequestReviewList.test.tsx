// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeletionRequestReviewList, type DeletionRequestItem } from "./DeletionRequestReviewList";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function mockFetchOnce(response: unknown) {
  return vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve(response) });
}

function makeRequest(overrides: Partial<DeletionRequestItem> = {}): DeletionRequestItem {
  return {
    id: "req-1",
    requestedByProfileId: "profile-1",
    subjectReportId: "report-1",
    reason: "Data pribadi tidak lagi relevan.",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DeletionRequestReviewList", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the empty state when there are no requests", () => {
    render(<DeletionRequestReviewList requests={[]} />);
    expect(screen.getByText("Tidak ada permintaan penghapusan")).toBeInTheDocument();
    expect(screen.getByText("Permintaan penghapusan data akan muncul di sini.")).toBeInTheDocument();
  });

  it("renders a badge, reason, and Setujui/Tolak buttons for a pending request", () => {
    render(<DeletionRequestReviewList requests={[makeRequest()]} />);
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("Data pribadi tidak lagi relevan.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setujui" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tolak" })).toBeInTheDocument();
  });

  it("renders only a 'Tandai Selesai' button for an approved request", () => {
    render(<DeletionRequestReviewList requests={[makeRequest({ status: "approved" })]} />);
    expect(screen.getByRole("button", { name: "Tandai Selesai" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Setujui" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tolak" })).not.toBeInTheDocument();
  });

  it("renders no action buttons for a denied or completed request", () => {
    render(<DeletionRequestReviewList requests={[makeRequest({ status: "denied" }), makeRequest({ id: "req-2", status: "completed" })]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("approving a pending request posts status 'approved', updates the badge, and refreshes", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<DeletionRequestReviewList requests={[makeRequest()]} />);
    await user.click(screen.getByRole("button", { name: "Setujui" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/retention/deletion-requests/req-1",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ status: "approved" }) }),
      ),
    );
    expect(await screen.findByText("approved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tandai Selesai" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("denying a pending request posts status 'denied' and removes action buttons", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<DeletionRequestReviewList requests={[makeRequest()]} />);
    await user.click(screen.getByRole("button", { name: "Tolak" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/retention/deletion-requests/req-1",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ status: "denied" }) }),
      ),
    );
    expect(await screen.findByText("denied")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marking an approved request as completed posts status 'completed'", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<DeletionRequestReviewList requests={[makeRequest({ status: "approved" })]} />);
    await user.click(screen.getByRole("button", { name: "Tandai Selesai" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/retention/deletion-requests/req-1",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ status: "completed" }) }),
      ),
    );
    expect(await screen.findByText("completed")).toBeInTheDocument();
  });

  it("shows an error message and keeps the request pending when the review request fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Gagal meninjau permintaan ini." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<DeletionRequestReviewList requests={[makeRequest()]} />);
    await user.click(screen.getByRole("button", { name: "Setujui" }));

    expect(await screen.findByText("Gagal meninjau permintaan ini.")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(<DeletionRequestReviewList requests={[makeRequest()]} />);
    await user.click(screen.getByRole("button", { name: "Setujui" }));

    expect(await screen.findByText("Gagal menghubungi server.")).toBeInTheDocument();
  });

  it("disables Setujui and Tolak for the in-flight request while it is submitting", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<DeletionRequestReviewList requests={[makeRequest()]} />);
    await user.click(screen.getByRole("button", { name: "Setujui" }));

    expect(screen.getByRole("button", { name: "Setujui" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tolak" })).toBeDisabled();
  });
});
