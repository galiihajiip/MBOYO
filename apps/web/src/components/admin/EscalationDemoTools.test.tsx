// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscalationDemoTools } from "./EscalationDemoTools";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

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

describe("EscalationDemoTools", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the fallback message when there are no disaster events", () => {
    render(<EscalationDemoTools events={[]} />);
    expect(screen.getByText("Belum ada event bencana untuk disimulasikan.")).toBeInTheDocument();
  });

  it("renders the heading, select defaulted to the first event, and both simulation buttons", () => {
    render(<EscalationDemoTools events={EVENTS} />);
    expect(screen.getByText("Demo: Uji Aturan Eskalasi")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Event Bencana untuk simulasi" })).toHaveTextContent("Gempa Cianjur");
    expect(screen.getByRole("button", { name: "Simulasikan Laporan Kerusakan Parah" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulasikan Eskalasi Klaster" })).toBeInTheDocument();
  });

  it("clicking 'Simulasikan Laporan Kerusakan Parah' posts to the destroyed-report endpoint with the selected event and coordinates", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<EscalationDemoTools events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Simulasikan Laporan Kerusakan Parah" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/demo/simulate-destroyed-report",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ disasterEventId: "event-1", longitude: 106.827, latitude: -6.175 }),
        }),
      ),
    );
    expect(await screen.findByText("Simulasi berhasil — periksa Notifikasi untuk melihat peringatan eskalasi.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("clicking 'Simulasikan Eskalasi Klaster' posts to the cluster-escalation endpoint with center coordinates", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<EscalationDemoTools events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Simulasikan Eskalasi Klaster" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/demo/simulate-cluster-escalation",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ disasterEventId: "event-1", centerLongitude: 106.827, centerLatitude: -6.175 }),
        }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("changing the selected event then simulating sends the newly selected event id", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<EscalationDemoTools events={EVENTS} />);
    await user.click(screen.getByRole("combobox", { name: "Event Bencana untuk simulasi" }));
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Banjir Jakarta"));

    await user.click(screen.getByRole("button", { name: "Simulasikan Laporan Kerusakan Parah" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/demo/simulate-destroyed-report",
        expect.objectContaining({
          body: JSON.stringify({ disasterEventId: "event-2", longitude: 106.827, latitude: -6.175 }),
        }),
      ),
    );
  });

  it("shows an error message when the simulation request fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Gagal menjalankan simulasi ini." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<EscalationDemoTools events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Simulasikan Laporan Kerusakan Parah" }));

    expect(await screen.findByText("Gagal menjalankan simulasi ini.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(<EscalationDemoTools events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Simulasikan Eskalasi Klaster" }));

    expect(await screen.findByText("Gagal menghubungi server untuk menjalankan simulasi.")).toBeInTheDocument();
  });

  it("disables both simulation buttons while a request is in flight", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<EscalationDemoTools events={EVENTS} />);
    await user.click(screen.getByRole("button", { name: "Simulasikan Laporan Kerusakan Parah" }));

    expect(screen.getByRole("button", { name: "Simulasikan Laporan Kerusakan Parah" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Simulasikan Eskalasi Klaster" })).toBeDisabled();
  });
});
