/**
 * @vitest-environment node
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

// Set env before any imports
const TEST_SECRET = "test-jwt-secret-key";
process.env.JWT_SECRET = TEST_SECRET;

// Mock server-only (it throws when imported in non-server context)
vi.mock("server-only", () => ({}));

// Mock cookie store
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Import after mocks and env are set up
const { createSession, getSession } = await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode(TEST_SECRET);

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates a JWT token and sets httpOnly cookie", async () => {
    await createSession("user-123", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
    const [cookieName, token, options] = mockCookieStore.set.mock.calls[0];

    expect(cookieName).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("sets cookie expiration to 7 days", async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    await createSession("user-123", "test@example.com");

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const expectedExpiry = new Date(now + 7 * 24 * 60 * 60 * 1000);

    expect(options.expires.getTime()).toBe(expectedExpiry.getTime());

    vi.useRealTimers();
  });

  test("creates valid JWT with correct payload", async () => {
    await createSession("user-123", "test@example.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("test@example.com");
    expect(payload.expiresAt).toBeDefined();
  });
});

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when no cookie exists", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns null when cookie value is empty", async () => {
    mockCookieStore.get.mockReturnValue({ value: "" });

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns session payload for valid token", async () => {
    const token = await new SignJWT({
      userId: "user-456",
      email: "valid@example.com",
      expiresAt: new Date(Date.now() + 86400000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-456");
    expect(session?.email).toBe("valid@example.com");
  });

  test("returns null for invalid token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "invalid-token" });

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns null for expired token", async () => {
    const token = await new SignJWT({
      userId: "user-789",
      email: "expired@example.com",
      expiresAt: new Date(Date.now() - 86400000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("0s")
      .sign(JWT_SECRET);

    await new Promise((resolve) => setTimeout(resolve, 10));

    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns null for token signed with wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({
      userId: "user-wrong",
      email: "wrong@example.com",
      expiresAt: new Date(Date.now() + 86400000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);

    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session).toBeNull();
  });
});
