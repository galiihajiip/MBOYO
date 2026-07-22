// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserRoleManager } from "./UserRoleManager";

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

describe("UserRoleManager", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows 'Belum ada peran.' when the user has no current roles", () => {
    render(<UserRoleManager profileId="profile-1" currentRoles={[]} />);
    expect(screen.getByText("Belum ada peran.")).toBeInTheDocument();
  });

  it("renders a badge and 'Cabut' button for each current role", () => {
    render(<UserRoleManager profileId="profile-1" currentRoles={["verifier", "auditor"]} />);
    const revokeVerifier = screen.getByRole("button", { name: "Cabut peran Verifikator" });
    const revokeAuditor = screen.getByRole("button", { name: "Cabut peran Auditor" });
    expect(within(revokeVerifier.parentElement as HTMLElement).getByText("Verifikator")).toBeInTheDocument();
    expect(within(revokeAuditor.parentElement as HTMLElement).getByText("Auditor")).toBeInTheDocument();
    expect(screen.queryByText("Belum ada peran.")).not.toBeInTheDocument();
  });

  it("granting the default-selected role ('verifier') submits the correct payload", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserRoleManager profileId="profile-1" currentRoles={[]} />);
    await user.click(screen.getByRole("button", { name: "Berikan Peran" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/profile-1/roles",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ role: "verifier" }) }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("changing the role select then granting submits the newly selected role", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserRoleManager profileId="profile-1" currentRoles={[]} />);
    await user.click(screen.getByRole("combobox", { name: "Pilih peran untuk diberikan" }));
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Administrator Sistem"));

    await user.click(screen.getByRole("button", { name: "Berikan Peran" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/profile-1/roles",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ role: "system_administrator" }) }),
      ),
    );
  });

  it("revoking a role calls DELETE with the correct role and refreshes", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserRoleManager profileId="profile-1" currentRoles={["verifier"]} />);
    await user.click(screen.getByRole("button", { name: "Cabut peran Verifikator" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/profile-1/roles",
        expect.objectContaining({ method: "DELETE", body: JSON.stringify({ role: "verifier" }) }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an error message when granting a role fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Peran sudah dimiliki." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserRoleManager profileId="profile-1" currentRoles={[]} />);
    await user.click(screen.getByRole("button", { name: "Berikan Peran" }));

    expect(await screen.findByText("Peran sudah dimiliki.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows an error message when revoking a role fails", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ ok: false, error: { message: "Gagal mencabut peran terakhir." } });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserRoleManager profileId="profile-1" currentRoles={["verifier"]} />);
    await user.click(screen.getByRole("button", { name: "Cabut peran Verifikator" }));

    expect(await screen.findByText("Gagal mencabut peran terakhir.")).toBeInTheDocument();
  });

  it("shows a generic error message when the grant request rejects (network failure)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));

    render(<UserRoleManager profileId="profile-1" currentRoles={[]} />);
    await user.click(screen.getByRole("button", { name: "Berikan Peran" }));

    expect(await screen.findByText("Gagal menghubungi server.")).toBeInTheDocument();
  });

  it("disables both grant and revoke controls while a request is in flight", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<UserRoleManager profileId="profile-1" currentRoles={["verifier"]} />);
    await user.click(screen.getByRole("button", { name: "Berikan Peran" }));

    expect(screen.getByRole("button", { name: "Berikan Peran" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cabut peran Verifikator" })).toBeDisabled();
  });
});
