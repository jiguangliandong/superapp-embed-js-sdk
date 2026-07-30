import assert from "node:assert/strict";
import test from "node:test";

import { SupperappEmbedSDK } from "../src/index.js";

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
  const sdk = new SupperappEmbedSDK({ bridge, fetch });
  const result = await sdk.authenticate({ bootstrapURL: "/bootstrap", completeURL: "/complete" });

  assert.equal(result.open_id, "eoi_demo");
  assert.deepEqual(requests[1].body, {
    transaction_id: "tx_1",
    code: "embcode_demo",
    state: "state-with-enough-entropy"
  });
});

test("getAuthCode rejects a state mismatch", async () => {
  const sdk = new SupperappEmbedSDK({
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
