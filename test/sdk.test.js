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
