// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportForm } from "./ExportForm";

function mockFetchOnce(response: unknown) {
  return vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve(response) });
}

// jsdom doesn't implement these, but Radix UI's Select relies on them for
// its pointer-based interactions — without stubs, opening/selecting throws.
beforeEach(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const EVENTS = [
  { id: "event-1", name: "Gempa Cianjur" },
  { id: "event-2", name: "Banjir Jakarta" },
];

describe("ExportForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the fallback message when there are no disaster events", () => {
    render(<ExportForm events={[]} />);
    expect(screen.getByText("Belum ada event bencana untuk diekspor.")).toBeInTheDocument();
  });

  it("renders the event select defaulted to the first event and the format select defaulted to CSV", () => {
    render(<ExportForm events={EVENTS} />);
    expect(screen.getByRole("combobox", { name: "Event Bencana" })).toHaveTextContent("Gempa Cianjur");
    expect(screen.getByRole("combobox", { name: "Format ekspor" })).toHaveTextContent("CSV");
    expect(screen.getByRole("button", { name: "Buat Ekspor" })).toBeInTheDocument();
  });

  it("submits the default endpoint with the default event and format", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: { job: { signedUrl: "https://example.test/export.csv" } } });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExportForm events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Buat Ekspor" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/command/exports",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ disasterEventId: "event-1", format: "csv" }),
        }),
      ),
    );
    expect(await screen.findByRole("link", { name: "Unduh Berkas Ekspor" })).toHaveAttribute("href", "https://example.test/export.csv");
  });

  it("uses a custom endpoint prop when provided (e.g. Auditor compliance export)", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: { job: { signedUrl: "https://example.test/export.csv" } } });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExportForm events={EVENTS} endpoint="/api/audit/exports" />);
    await user.click(screen.getByRole("button", { name: "Buat Ekspor" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/audit/exports", expect.objectContaining({ method: "POST" })),
    );
  });

  it("changing the event and format selects sends the new values", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true, data: { job: { signedUrl: "https://example.test/export.geojson" } } });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExportForm events={EVENTS} />);

    await user.click(screen.getByRole("combobox", { name: "Event Bencana" }));
    let listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Banjir Jakarta"));

    await user.click(screen.getByRole("combobox", { name: "Format ekspor" }));
    listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("GEOJSON"));

    await user.click(screen.getByRole("button", { name: "Buat Ekspor" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/command/exports",
        expect.objectContaining({
          body: JSON.stringify({ disasterEventId: "event-2", format: "geojson" }),
        }),
      ),
    );
  });

  it("shows an error message and no download link when the export request fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Gagal membuat ekspor ini." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExportForm events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Buat Ekspor" }));

    expect(await screen.findByText("Gagal membuat ekspor ini.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unduh Berkas Ekspor" })).not.toBeInTheDocument();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(<ExportForm events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Buat Ekspor" }));

    expect(await screen.findByText("Gagal menghubungi server untuk membuat ekspor.")).toBeInTheDocument();
  });

  it("shows 'Membuat ekspor...' and disables the button while the request is in flight", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<ExportForm events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Buat Ekspor" }));

    expect(screen.getByRole("button", { name: "Membuat ekspor..." })).toBeDisabled();
  });

  it("clears a previous download link when a new export request is submitted", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true, data: { job: { signedUrl: "https://example.test/first.csv" } } }) })
      .mockReturnValueOnce(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<ExportForm events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Buat Ekspor" }));
    expect(await screen.findByRole("link", { name: "Unduh Berkas Ekspor" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buat Ekspor" }));
    expect(screen.queryByRole("link", { name: "Unduh Berkas Ekspor" })).not.toBeInTheDocument();
  });
});
