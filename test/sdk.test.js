import assert from "node:assert/strict";
import test from "node:test";

import { SuperappEmbedSDK } from "../src/index.js";

test("authenticate keeps verifier out of H5 and completes through Partner Backend", async () => {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    if (url === "/bootstrap") {
      return Response.json({
        transaction_id: "tx_1",
        client_id: "embcli_1",
        state: "state-with-enough-entropy",
        code_challenge: "challenge",
        scopes: ["auth_base"]
      });
    }
    return Response.json({ open_id: "eoi_demo" });
  };
  const bridge = {
    invoke: async (method, params) => {
      assert.equal(method, "getAuthCode");
      assert.equal("code_verifier" in params, false);
      return { code: "embcode_demo", state: params.state };
    }
  };
  const sdk = new SuperappEmbedSDK({ bridge, fetch });
  const result = await sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" });

  assert.equal(result.open_id, "eoi_demo");
  assert.deepEqual(requests[1].body, {
    transaction_id: "tx_1",
    code: "embcode_demo",
    state: "state-with-enough-entropy"
  });
});

test("getAuthCode preserves structured native rejection codes", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: {
      invoke: async () => {
        const error = new Error("User declined the requested permission");
        error.code = "user_denied";
        throw error;
      }
    }
  });
  await assert.rejects(
    sdk.getAuthCode({
      transactionId: "tx",
      clientId: "client",
      state: "expected-state",
      codeChallenge: "challenge"
    }),
    { code: "user_denied" }
  );
});

test("getAuthCode rejects a state mismatch", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: { invoke: async () => ({ code: "code", state: "wrong" }) }
  });
  await assert.rejects(
    sdk.getAuthCode({
      transactionId: "tx",
      clientId: "client",
      state: "expected-state",
      codeChallenge: "challenge"
    }),
    { code: "state_mismatch" }
  );
});

test("scanCode forwards params to the host bridge", async () => {
  const params = { scan_type: ["qrCode"] };
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: {
      invoke: async (method, received) => {
        assert.equal(method, "scanCode");
        assert.equal(received, params);
        return { result: "https://example.test" };
      }
    }
  });
  const result = await sdk.scanCode(params);
  assert.deepEqual(result, { result: "https://example.test" });
});

test("scanCode forwards an empty object when params are omitted", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: {
      invoke: async (method, received) => {
        assert.equal(method, "scanCode");
        assert.deepEqual(received, {});
        return {};
      }
    }
  });
  await sdk.scanCode();
});

test("dialPhone forwards params to the host bridge", async () => {
  const params = { phone_number: "+60123456789" };
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: {
      invoke: async (method, received) => {
        assert.equal(method, "dialPhone");
        assert.equal(received, params);
        return {};
      }
    }
  });
  await sdk.dialPhone(params);
});

test("dialPhone forwards an empty object when params are omitted", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: {
      invoke: async (method, received) => {
        assert.equal(method, "dialPhone");
        assert.deepEqual(received, {});
        return {};
      }
    }
  });
  await sdk.dialPhone();
});

test("saveImageToAlbum forwards params to the host bridge", async () => {
  const params = { image_url: "https://example.test/photo.png" };
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: {
      invoke: async (method, received) => {
        assert.equal(method, "saveImageToAlbum");
        assert.equal(received, params);
        return {};
      }
    }
  });
  await sdk.saveImageToAlbum(params);
});

test("saveImageToAlbum forwards an empty object when params are omitted", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: {
      invoke: async (method, received) => {
        assert.equal(method, "saveImageToAlbum");
        assert.deepEqual(received, {});
        return {};
      }
    }
  });
  await sdk.saveImageToAlbum();
});

const noopBridge = { invoke: async () => ({}) };

function authBridge(response) {
  return { invoke: async (method, params) => response(params) };
}

function bootstrapThen(complete) {
  return async (url, init) => {
    if (url === "/bootstrap") {
      return Response.json({
        transaction_id: "tx_1",
        client_id: "embcli_1",
        state: "s",
        code_challenge: "challenge"
      });
    }
    return complete(url, init);
  };
}

test("getAuthCode rejects a native response without code", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: authBridge((params) => ({ state: params.state }))
  });
  await assert.rejects(
    sdk.getAuthCode({ transactionId: "tx", clientId: "c", state: "s", codeChallenge: "x" }),
    { name: "SuperappEmbedError", code: "invalid_bridge_response" }
  );
});

test("authenticate does not call complete when native response lacks code", async () => {
  const urls = [];
  const sdk = new SuperappEmbedSDK({
    fetch: bootstrapThen(async (url) => {
      urls.push(url);
      return Response.json({});
    }),
    bridge: authBridge((params) => ({ state: params.state }))
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" }),
    { code: "invalid_bridge_response" }
  );
  assert.deepEqual(urls, []);
});

test("authenticate validates options before any request", async () => {
  let called = false;
  const sdk = new SuperappEmbedSDK({
    bridge: noopBridge,
    fetch: async () => {
      called = true;
      return Response.json({});
    }
  });
  await assert.rejects(sdk.authenticate(), { name: "SuperappEmbedError", code: "invalid_argument" });
  await assert.rejects(sdk.authenticate(null), { code: "invalid_argument" });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap" }),
    { code: "invalid_argument", message: "completeURL is required" }
  );
  assert.equal(called, false);
});

test("non-OK response with null body keeps HTTP status", async () => {
  const sdk = new SuperappEmbedSDK({
    bridge: noopBridge,
    fetch: async () => new Response("null", { status: 500 })
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" }),
    { name: "SuperappEmbedError", code: "partner_request_failed", status: 500 }
  );
});

test("non-OK response passes through partner error code and message", async () => {
  const sdk = new SuperappEmbedSDK({
    bridge: noopBridge,
    fetch: async () => Response.json({ code: "session_expired", message: "Login again" }, { status: 401 })
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" }),
    { code: "session_expired", message: "Login again", status: 401 }
  );
});

test("OK response with non-JSON body is reported as invalid_response", async () => {
  const sdk = new SuperappEmbedSDK({
    bridge: noopBridge,
    fetch: async () => new Response("<html>login</html>", { status: 200 })
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" }),
    { code: "invalid_response", status: 200 }
  );
});

test("OK response with JSON null or array is reported as invalid_response", async () => {
  for (const text of ["null", "[]", "\"text\""]) {
    const sdk = new SuperappEmbedSDK({
      bridge: noopBridge,
      fetch: async () => new Response(text, { status: 200 })
    });
    await assert.rejects(
      sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" }),
      { code: "invalid_response" }
    );
  }
});

test("bootstrap response missing required fields is reported before bridge call", async () => {
  let bridgeCalled = false;
  const sdk = new SuperappEmbedSDK({
    bridge: {
      invoke: async () => {
        bridgeCalled = true;
        return {};
      }
    },
    fetch: async () => Response.json({ transaction_id: "tx", client_id: "c", state: "s" })
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" }),
    { code: "invalid_response", message: "Partner Backend bootstrap response is missing code_challenge" }
  );
  assert.equal(bridgeCalled, false);
});

test("bootstrap response with invalid scopes is rejected", async () => {
  const sdk = new SuperappEmbedSDK({
    bridge: noopBridge,
    fetch: async () =>
      Response.json({ transaction_id: "tx", client_id: "c", state: "s", code_challenge: "x", scopes: "auth_base" })
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" }),
    { code: "invalid_response" }
  );
});

test("empty complete response body resolves to an empty object", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: bootstrapThen(async () => new Response(null, { status: 204 })),
    bridge: authBridge((params) => ({ code: "code", state: params.state }))
  });
  const result = await sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" });
  assert.deepEqual(result, {});
});

test("partner request times out with request_timeout", async () => {
  const sdk = new SuperappEmbedSDK({
    bridge: noopBridge,
    requestTimeoutMs: 20,
    fetch: (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      })
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" }),
    { code: "request_timeout" }
  );
});

test("caller signal aborts an in-flight partner request", async () => {
  const controller = new AbortController();
  const sdk = new SuperappEmbedSDK({
    bridge: noopBridge,
    fetch: (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
        setTimeout(() => controller.abort(), 5);
      })
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete", signal: controller.signal }),
    { code: "aborted" }
  );
});

test("already aborted signal skips the request entirely", async () => {
  let called = false;
  const sdk = new SuperappEmbedSDK({
    bridge: noopBridge,
    fetch: async () => {
      called = true;
      return Response.json({});
    }
  });
  await assert.rejects(
    sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete", signal: AbortSignal.abort() }),
    { code: "aborted" }
  );
  assert.equal(called, false);
});

test("constructor rejects invalid requestTimeoutMs", () => {
  for (const requestTimeoutMs of [0, -1, Number.NaN, Infinity]) {
    assert.throws(
      () => new SuperappEmbedSDK({ bridge: noopBridge, fetch: async () => Response.json({}), requestTimeoutMs }),
      { code: "invalid_argument" }
    );
  }
});

test("bridge string rejection keeps its message", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: { invoke: () => Promise.reject("user cancelled") }
  });
  await assert.rejects(sdk.scanCode(), { code: "bridge_error", message: "user cancelled" });
});

test("bridge errCode/errMsg rejection is mapped to code and message", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: { invoke: () => Promise.reject({ errCode: "user_denied", errMsg: "denied by user" }) }
  });
  await assert.rejects(sdk.scanCode(), { code: "user_denied", message: "denied by user" });
});

test("bridge numeric errCode is stringified", async () => {
  const sdk = new SuperappEmbedSDK({
    fetch: async () => Response.json({}),
    bridge: { invoke: () => Promise.reject({ errCode: 1001 }) }
  });
  await assert.rejects(sdk.dialPhone(), { code: "1001", message: "Host bridge method dialPhone failed" });
});

function countingAuth({ failBootstrapOnce = false } = {}) {
  const counts = { bootstrap: 0, complete: 0, bridge: 0 };
  let failed = false;
  const fetch = async (url) => {
    if (url === "/bootstrap") {
      counts.bootstrap += 1;
      if (failBootstrapOnce && !failed) {
        failed = true;
        return Response.json({ code: "temporarily_unavailable" }, { status: 503 });
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Response.json({
        transaction_id: `tx_${counts.bootstrap}`,
        client_id: "embcli_1",
        state: "s",
        code_challenge: "challenge"
      });
    }
    counts.complete += 1;
    return Response.json({ open_id: `eoi_${counts.complete}` });
  };
  const bridge = {
    invoke: async (method, params) => {
      counts.bridge += 1;
      return { code: "code", state: params.state };
    }
  };
  return { counts, sdk: new SuperappEmbedSDK({ bridge, fetch }) };
}

const authOptions = { bootstrapURL: "/bootstrap", completeURL: "/complete" };

test("concurrent identical authenticate calls share one flow", async () => {
  const { counts, sdk } = countingAuth();
  const results = await Promise.all([
    sdk.authenticate({ ...authOptions }),
    sdk.authenticate({ ...authOptions }),
    sdk.authenticate({ ...authOptions })
  ]);
  assert.deepEqual(counts, { bootstrap: 1, complete: 1, bridge: 1 });
  assert.deepEqual(results, [{ open_id: "eoi_1" }, { open_id: "eoi_1" }, { open_id: "eoi_1" }]);
});

test("authenticate runs a new flow once the previous one settles", async () => {
  const { counts, sdk } = countingAuth();
  await sdk.authenticate(authOptions);
  const second = await sdk.authenticate(authOptions);
  assert.equal(counts.bootstrap, 2);
  assert.deepEqual(second, { open_id: "eoi_2" });
});

test("concurrent authenticate calls with different options are not shared", async () => {
  const { counts, sdk } = countingAuth();
  await Promise.all([
    sdk.authenticate(authOptions),
    sdk.authenticate({ ...authOptions, scopes: ["auth_base", "profile.name"] })
  ]);
  assert.equal(counts.bootstrap, 2);
});

test("concurrent authenticate calls with different signals are not shared", async () => {
  const { counts, sdk } = countingAuth();
  await Promise.all([
    sdk.authenticate({ ...authOptions, signal: new AbortController().signal }),
    sdk.authenticate({ ...authOptions, signal: new AbortController().signal })
  ]);
  assert.equal(counts.bootstrap, 2);
});

test("a failed authenticate flow is not reused by the next call", async () => {
  const { counts, sdk } = countingAuth({ failBootstrapOnce: true });
  const [first, second] = await Promise.allSettled([
    sdk.authenticate(authOptions),
    sdk.authenticate(authOptions)
  ]);
  assert.equal(first.reason.code, "temporarily_unavailable");
  assert.equal(second.reason.code, "temporarily_unavailable");
  const retry = await sdk.authenticate(authOptions);
  assert.deepEqual(retry, { open_id: "eoi_1" });
  assert.equal(counts.bootstrap, 2);
});
