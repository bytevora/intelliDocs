import { describe, it, expect, vi } from "vitest";
import { logger } from "../logger";

describe("logger", () => {
  it("creates a named logger", () => {
    const log = logger.create("test-context");
    expect(log).toHaveProperty("debug");
    expect(log).toHaveProperty("info");
    expect(log).toHaveProperty("warn");
    expect(log).toHaveProperty("error");
  });

  it("logs with correct format", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = logger.create("auth");

    log.error("login failed", { userId: "123" });

    expect(spy).toHaveBeenCalledOnce();
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain("ERROR");
    expect(message).toContain("[auth]");
    expect(message).toContain("login failed");
    expect(message).toContain('"userId":"123"');

    spy.mockRestore();
  });

  it("logger.info works as a shortcut", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.info("server started");

    expect(spy).toHaveBeenCalledOnce();
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain("INFO");
    expect(message).toContain("[app]");
    expect(message).toContain("server started");

    spy.mockRestore();
  });
});
