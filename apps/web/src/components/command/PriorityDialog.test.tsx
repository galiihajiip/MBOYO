// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriorityDialog } from "./PriorityDialog";

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

async function selectPriority(user: ReturnType<typeof userEvent.setup>, optionText: string) {
  await user.click(screen.getByRole("combobox", { name: "Prioritas" }));
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByText(optionText));
}

describe("PriorityDialog", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not render dialog content until the trigger is clicked", () => {
    render(
      <PriorityDialog
        trigger={<button type="button">Ubah Prioritas</button>}
        title="Ubah Prioritas Klaster"
        currentPriority="medium"
        endpoint="/api/command/clusters/cluster-1/priority"
      />,
    );
    expect(screen.queryByText("Ubah Prioritas Klaster")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ubah Prioritas" })).toBeInTheDocument();
  });

  it("opening the dialog shows the title, current priority selected, and optional reason label", async () => {
    const user = userEvent.setup();
    render(
      <PriorityDialog
        trigger={<button type="button">Ubah Prioritas</button>}
        title="Ubah Prioritas Klaster"
        currentPriority="medium"
        endpoint="/api/command/clusters/cluster-1/priority"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ubah Prioritas" }));

    expect(await screen.findByText("Ubah Prioritas Klaster")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Prioritas" })).toHaveTextContent("Sedang");
    expect(screen.getByText("Alasan (opsional)")).toBeInTheDocument();
  });

  it("selecting 'Kritis' makes the reason field required, shown via the label text and disabled submit", async () => {
    const user = userEvent.setup();
    render(
      <PriorityDialog
        trigger={<button type="button">Ubah Prioritas</button>}
        title="Ubah Prioritas Klaster"
        currentPriority="medium"
        endpoint="/api/command/clusters/cluster-1/priority"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ubah Prioritas" }));
    await selectPriority(user, "Kritis");

    expect(screen.getByText("Alasan (wajib untuk prioritas kritis)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan Prioritas" })).toBeDisabled();
  });

  it("entering a reason for critical priority enables submit and submits both fields", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PriorityDialog
        trigger={<button type="button">Ubah Prioritas</button>}
        title="Ubah Prioritas Klaster"
        currentPriority="medium"
        endpoint="/api/command/clusters/cluster-1/priority"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ubah Prioritas" }));
    await selectPriority(user, "Kritis");
    await user.type(screen.getByPlaceholderText("Jelaskan alasan perubahan prioritas..."), "  Ancaman jiwa mendesak  ");
    await user.click(screen.getByRole("button", { name: "Simpan Prioritas" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/command/clusters/cluster-1/priority",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ priority: "critical", reason: "Ancaman jiwa mendesak" }),
        }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("submitting a non-critical priority without a reason omits reason from the payload and closes the dialog", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PriorityDialog
        trigger={<button type="button">Ubah Prioritas</button>}
        title="Ubah Prioritas Klaster"
        currentPriority="medium"
        endpoint="/api/command/clusters/cluster-1/priority"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ubah Prioritas" }));
    await user.click(screen.getByRole("button", { name: "Simpan Prioritas" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/command/clusters/cluster-1/priority",
        expect.objectContaining({
          body: JSON.stringify({ priority: "medium", reason: undefined }),
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Ubah Prioritas Klaster")).not.toBeInTheDocument());
  });

  it("shows an error message and keeps the dialog open when the save request fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Gagal mengubah prioritas ini." } });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PriorityDialog
        trigger={<button type="button">Ubah Prioritas</button>}
        title="Ubah Prioritas Klaster"
        currentPriority="medium"
        endpoint="/api/command/clusters/cluster-1/priority"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ubah Prioritas" }));
    await user.click(screen.getByRole("button", { name: "Simpan Prioritas" }));

    expect(await screen.findByText("Gagal mengubah prioritas ini.")).toBeInTheDocument();
    expect(screen.getByText("Ubah Prioritas Klaster")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(
      <PriorityDialog
        trigger={<button type="button">Ubah Prioritas</button>}
        title="Ubah Prioritas Klaster"
        currentPriority="medium"
        endpoint="/api/command/clusters/cluster-1/priority"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ubah Prioritas" }));
    await user.click(screen.getByRole("button", { name: "Simpan Prioritas" }));

    expect(await screen.findByText("Gagal menghubungi server untuk mengubah prioritas.")).toBeInTheDocument();
  });

  it("shows 'Menyimpan...' while the request is in flight", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(
      <PriorityDialog
        trigger={<button type="button">Ubah Prioritas</button>}
        title="Ubah Prioritas Klaster"
        currentPriority="medium"
        endpoint="/api/command/clusters/cluster-1/priority"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ubah Prioritas" }));
    await user.click(screen.getByRole("button", { name: "Simpan Prioritas" }));

    expect(screen.getByRole("button", { name: "Menyimpan..." })).toBeDisabled();
  });
});
