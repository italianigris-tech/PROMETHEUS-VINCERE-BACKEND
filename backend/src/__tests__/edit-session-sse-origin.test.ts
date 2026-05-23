import {describe, expect, it} from "vitest";

import {resolveSseAccessControlOrigin} from "../edit-sessions/routes";

describe("edit session SSE origin reflection", () => {
  it("reflects the incoming request origin for the hijacked SSE response", () => {
    expect(resolveSseAccessControlOrigin("https://preview.example.com")).toBe("https://preview.example.com");
    expect(resolveSseAccessControlOrigin(" http://127.0.0.1:3010 ")).toBe("http://127.0.0.1:3010");
  });

  it("omits the CORS mirror header when the request origin is blank", () => {
    expect(resolveSseAccessControlOrigin(undefined)).toBeNull();
    expect(resolveSseAccessControlOrigin("   ")).toBeNull();
  });
});
