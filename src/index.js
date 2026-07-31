const DEFAULT_TIMEOUT_MS = 15_000;

export class SuperappEmbedError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "SuperappEmbedError";
    this.code = code;
  }
}

export class SuperappEmbedSDK {
  constructor(options = {}) {
    this.bridge = options.bridge ?? globalThis.SuperappNativeBridge;
    this.fetch = options.fetch ?? globalThis.fetch?.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!this.bridge || typeof this.bridge.invoke !== "function") {
      throw new SuperappEmbedError("bridge_unavailable", "Superapp host bridge is unavailable");
    }
    if (!this.fetch) {
      throw new SuperappEmbedError("fetch_unavailable", "Fetch API is unavailable");
    }
  }

  getContext() {
    return this.#invoke("getContext", {});
  }

  async getAuthCode(request) {
    requireText(request?.transactionId, "transactionId");
    requireText(request?.clientId, "clientId");
    requireText(request?.state, "state");
    requireText(request?.codeChallenge, "codeChallenge");
    const response = await this.#invoke("getAuthCode", {
      transaction_id: request.transactionId,
      client_id: request.clientId,
      scopes: request.scopes ?? ["auth_base"],
      state: request.state,
      code_challenge: request.codeChallenge,
      code_challenge_method: "S256"
    });
    if (response?.state !== request.state) {
      throw new SuperappEmbedError("state_mismatch", "Native authorization response state does not match");
    }
    return response;
  }

  // authenticate 把 bootstrap、宿主授权和服务端完成三个动作合并。
  // code_verifier 从不进入浏览器，它由 Partner Backend 通过 transaction_id 找回。
  async authenticate(options) {
    const bootstrap = await this.#json(options.bootstrapURL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scopes: options.scopes ?? ["auth_base"] }),
      credentials: "include"
    });
    const authorization = await this.getAuthCode({
      transactionId: bootstrap.transaction_id,
      clientId: bootstrap.client_id,
      scopes: bootstrap.scopes,
      state: bootstrap.state,
      codeChallenge: bootstrap.code_challenge
    });
    return this.#json(options.completeURL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transaction_id: bootstrap.transaction_id,
        code: authorization.code,
        state: authorization.state
      }),
      credentials: "include"
    });
  }

  openPrivacySettings() {
    return this.#invoke("openPrivacySettings", {});
  }

  close() {
    return this.#invoke("close", {});
  }

  async #json(url, init) {
    requireText(url, "URL");
    let response;
    try {
      response = await this.fetch(url, init);
    } catch (error) {
      throw new SuperappEmbedError("network_error", "Partner Backend request failed", error);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new SuperappEmbedError(
        body.code ?? "partner_request_failed",
        body.message ?? `Partner Backend returned HTTP ${response.status}`
      );
    }
    return body;
  }

  async #invoke(method, params) {
    try {
      return await withTimeout(
        Promise.resolve(this.bridge.invoke(method, params)),
        this.timeoutMs
      );
    } catch (error) {
      if (error instanceof SuperappEmbedError) throw error;
      throw new SuperappEmbedError("bridge_error", `Host bridge method ${method} failed`, error);
    }
  }
}

export function createSuperappEmbedSDK(options) {
  return new SuperappEmbedSDK(options);
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SuperappEmbedError("invalid_argument", `${field} is required`);
  }
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new SuperappEmbedError("bridge_timeout", "Host bridge request timed out")),
      timeoutMs
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
