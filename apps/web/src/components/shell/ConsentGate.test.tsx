// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConsentGate } from "./ConsentGate";

function mockFetchOnce(response: unknown) {
  return vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve(response) });
}

describe("ConsentGate", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing while the initial consent-status check is pending", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<ConsentGate />);
    expect(screen.queryByText("Pemberitahuan Privasi")).not.toBeInTheDocument();
  });

  it("renders nothing when every document has already been accepted", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({ ok: true, data: { statuses: [{ documentKey: "privacy_notice", currentVersion: "v2", needsConsent: false }] } }),
    );
    render(<ConsentGate />);
    await waitFor(() => expect(screen.queryByText("Pemberitahuan Privasi")).not.toBeInTheDocument());
  });

  it("renders the blocking overlay when a document still needs consent", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({ ok: true, data: { statuses: [{ documentKey: "privacy_notice", currentVersion: "v2", needsConsent: true }] } }),
    );
    render(<ConsentGate />);
    expect(await screen.findByText("Pemberitahuan Privasi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saya Setuju" })).toBeInTheDocument();
  });

  it("fails open (renders nothing) when the initial fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));
    render(<ConsentGate />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Pemberitahuan Privasi")).not.toBeInTheDocument();
  });

  it("dismisses the overlay after a successful accept", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, data: { statuses: [{ documentKey: "privacy_notice", currentVersion: "v2", needsConsent: true }] } }),
      })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true, data: { record: {} } }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ConsentGate />);
    await screen.findByText("Pemberitahuan Privasi");

    await user.click(screen.getByRole("button", { name: "Saya Setuju" }));

    await waitFor(() => expect(screen.queryByText("Pemberitahuan Privasi")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/consent",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ documentKey: "privacy_notice" }) }),
    );
  });

  it("shows an error message and keeps the overlay open when accept fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, data: { statuses: [{ documentKey: "privacy_notice", currentVersion: "v2", needsConsent: true }] } }),
      })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, error: { message: "Gagal menyimpan." } }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ConsentGate />);
    await screen.findByText("Pemberitahuan Privasi");
    await user.click(screen.getByRole("button", { name: "Saya Setuju" }));

    expect(await screen.findByText("Gagal menyimpan.")).toBeInTheDocument();
    expect(screen.getByText("Pemberitahuan Privasi")).toBeInTheDocument();
  });
});
