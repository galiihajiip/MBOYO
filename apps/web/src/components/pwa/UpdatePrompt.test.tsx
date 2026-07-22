// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdatePrompt } from "./UpdatePrompt";

/**
 * Minimal fake EventTarget-based service worker registration/container —
 * real ServiceWorkerRegistration and ServiceWorker aren't implemented by
 * jsdom, so we build just enough of the addEventListener/removeEventListener
 * + waiting/installing/postMessage surface that UpdatePrompt actually uses.
 */
function makeFakeServiceWorker(): { postMessage: ReturnType<typeof vi.fn>; state: string } & EventTarget {
  const target = new EventTarget() as EventTarget & { postMessage: ReturnType<typeof vi.fn>; state: string };
  target.postMessage = vi.fn();
  target.state = "installed";
  return target;
}

function makeFakeRegistration(options: { waiting?: ReturnType<typeof makeFakeServiceWorker> | null } = {}) {
  const target = new EventTarget() as EventTarget & {
    waiting: ReturnType<typeof makeFakeServiceWorker> | null;
    installing: ReturnType<typeof makeFakeServiceWorker> | null;
  };
  target.waiting = options.waiting ?? null;
  target.installing = null;
  return target;
}

function stubServiceWorkerContainer(registration: ReturnType<typeof makeFakeRegistration>, controller: object | null = {}) {
  const container = new EventTarget() as EventTarget & { ready: Promise<typeof registration>; controller: object | null };
  container.ready = Promise.resolve(registration);
  container.controller = controller;

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });

  return container;
}

describe("UpdatePrompt", () => {
  // Deleting navigator.serviceWorker in beforeEach (rather than afterEach)
  // ensures the shared setup file's afterEach(cleanup) — which unmounts the
  // previous test's tree and runs UpdatePrompt's effect cleanup — still
  // sees a defined navigator.serviceWorker to call removeEventListener on.
  // Setup-file afterEach hooks run AFTER hooks registered in the test file
  // itself (registration order across files), so deleting in this file's
  // own afterEach would race the previous test's unmount.
  beforeEach(() => {
    // @ts-expect-error -- test cleanup of a property we defined via defineProperty
    delete navigator.serviceWorker;
  });

  afterAll(() => {
    // @ts-expect-error -- final cleanup of a property we defined via defineProperty
    delete navigator.serviceWorker;
  });

  it("renders nothing when service workers aren't supported", async () => {
    render(<UpdatePrompt />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no waiting worker", async () => {
    const registration = makeFakeRegistration({ waiting: null });
    stubServiceWorkerContainer(registration);

    render(<UpdatePrompt />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the update prompt when a waiting worker already exists on mount", async () => {
    const waiting = makeFakeServiceWorker();
    const registration = makeFakeRegistration({ waiting });
    stubServiceWorkerContainer(registration);

    render(<UpdatePrompt />);

    expect(await screen.findByText("Pembaruan aplikasi tersedia.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nanti" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Perbarui Sekarang" })).toBeInTheDocument();
  });

  it("shows the update prompt once an installing worker transitions to 'installed' while there is a controller", async () => {
    const registration = makeFakeRegistration({ waiting: null });
    stubServiceWorkerContainer(registration, {});

    render(<UpdatePrompt />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    const installing = makeFakeServiceWorker();
    installing.state = "installing";
    registration.installing = installing;
    registration.dispatchEvent(new Event("updatefound"));

    installing.state = "installed";
    installing.dispatchEvent(new Event("statechange"));

    expect(await screen.findByText("Pembaruan aplikasi tersedia.")).toBeInTheDocument();
  });

  it("does not show the prompt when the installing worker becomes 'installed' but there is no existing controller (first install, not an update)", async () => {
    const registration = makeFakeRegistration({ waiting: null });
    stubServiceWorkerContainer(registration, null);

    render(<UpdatePrompt />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    const installing = makeFakeServiceWorker();
    installing.state = "installing";
    registration.installing = installing;
    registration.dispatchEvent(new Event("updatefound"));

    installing.state = "installed";
    installing.dispatchEvent(new Event("statechange"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismissing via 'Nanti' hides the prompt without posting a message to the worker", async () => {
    const user = userEvent.setup();
    const waiting = makeFakeServiceWorker();
    const registration = makeFakeRegistration({ waiting });
    stubServiceWorkerContainer(registration);

    render(<UpdatePrompt />);
    await screen.findByText("Pembaruan aplikasi tersedia.");
    await user.click(screen.getByRole("button", { name: "Nanti" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(waiting.postMessage).not.toHaveBeenCalled();
  });

  it("clicking 'Perbarui Sekarang' posts the MBOYO_SKIP_WAITING message to the waiting worker", async () => {
    const user = userEvent.setup();
    const waiting = makeFakeServiceWorker();
    const registration = makeFakeRegistration({ waiting });
    stubServiceWorkerContainer(registration);

    render(<UpdatePrompt />);
    await screen.findByText("Pembaruan aplikasi tersedia.");
    await user.click(screen.getByRole("button", { name: "Perbarui Sekarang" }));

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "MBOYO_SKIP_WAITING" });
  });

  it("reloads the page exactly once when a controllerchange event fires", async () => {
    const waiting = makeFakeServiceWorker();
    const registration = makeFakeRegistration({ waiting });
    const container = stubServiceWorkerContainer(registration);

    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    render(<UpdatePrompt />);
    await screen.findByText("Pembaruan aplikasi tersedia.");

    container.dispatchEvent(new Event("controllerchange"));
    container.dispatchEvent(new Event("controllerchange"));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
