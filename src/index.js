const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_TIMER_MS = 2_147_483_647;
const BOOTSTRAP_FIELDS = ["transaction_id", "client_id", "state", "code_challenge"];

export class SuperappEmbedError extends Error {
  constructor(code, message, cause, status) {
    super(message, cause ? { cause } : undefined);
    this.name = "SuperappEmbedError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

export class SuperappEmbedSDK {
  #pendingAuthentication;

  constructor(options = {}) {
    this.bridge = options.bridge ?? globalThis.SuperappNativeBridge;
    this.fetch = options.fetch ?? globalThis.fetch?.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!this.bridge || typeof this.bridge.invoke !== "function") {
      throw new SuperappEmbedError("bridge_unavailable", "Superapp host bridge is unavailable");
    }
    if (!this.fetch) {
      throw new SuperappEmbedError("fetch_unavailable", "Fetch API is unavailable");
    }
    if (
      !Number.isFinite(this.requestTimeoutMs) ||
      this.requestTimeoutMs <= 0 ||
      this.requestTimeoutMs > MAX_TIMER_MS
    ) {
      throw new SuperappEmbedError("invalid_argument", "requestTimeoutMs must be a positive finite number");
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
    if (!isText(response.code)) {
      throw new SuperappEmbedError("invalid_bridge_response", "Native authorization response is missing code");
    }
    return response;
  }

  // Combines Partner Backend bootstrap, host authorization and completion into one call.
  // code_verifier never reaches the browser; Partner Backend looks it up by transaction_id.
  async authenticate(options) {
    if (options === null || typeof options !== "object") {
      throw new SuperappEmbedError("invalid_argument", "options is required");
    }
    requireText(options.bootstrapURL, "bootstrapURL");
    requireText(options.completeURL, "completeURL");

    // Identical concurrent calls (e.g. a double-tapped login button) share one flow,
    // so only one bootstrap transaction and one native consent prompt are created.
    const key = JSON.stringify([options.bootstrapURL, options.completeURL, options.scopes ?? null]);
    const pending = this.#pendingAuthentication;
    if (pending && pending.key === key && pending.signal === options.signal) {
      return pending.promise;
    }
    const promise = this.#authenticate(options);
    this.#pendingAuthentication = { key, signal: options.signal, promise };
    try {
      return await promise;
    } finally {
      if (this.#pendingAuthentication?.promise === promise) {
        this.#pendingAuthentication = undefined;
      }
    }
  }

  async #authenticate(options) {
    const { signal } = options;
    const bootstrap = await this.#json(options.bootstrapURL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scopes: options.scopes ?? ["auth_base"] }),
      credentials: "include"
    }, signal);
    validateBootstrap(bootstrap);
    throwIfAborted(signal);
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
    }, signal);
  }

  openPrivacySettings() {
    return this.#invoke("openPrivacySettings", {});
  }

  scanCode(params = {}) {
    return this.#invoke("scanCode", params ?? {});
  }

  dialPhone(params = {}) {
    return this.#invoke("dialPhone", params ?? {});
  }

  saveImageToAlbum(params = {}) {
    return this.#invoke("saveImageToAlbum", params ?? {});
  }

  close() {
    return this.#invoke("close", {});
  }

  async #json(url, init, signal) {
    throwIfAborted(signal);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.requestTimeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    let response;
    let text;
    try {
      response = await this.fetch(url, { ...init, signal: controller.signal });
      text = await response.text();
    } catch (error) {
      if (timedOut) {
        throw new SuperappEmbedError("request_timeout", "Partner Backend request timed out", error);
      }
      if (signal?.aborted) throw abortError(signal);
      throw new SuperappEmbedError("network_error", "Partner Backend request failed", error);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }

    const body = parseJSONObject(text);
    if (!response.ok) {
      throw new SuperappEmbedError(
        pickCode(body?.code) ?? "partner_request_failed",
        pickText(body?.message) ?? `Partner Backend returned HTTP ${response.status}`,
        undefined,
        response.status
      );
    }
    // An empty body (e.g. 204) is a valid success; a non-JSON body (gateway page, login redirect) is not.
    if (text.trim() === "") return {};
    if (!body) {
      throw new SuperappEmbedError(
        "invalid_response",
        `Partner Backend returned a non-JSON-object response (HTTP ${response.status})`,
        undefined,
        response.status
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
      throw new SuperappEmbedError(
        structuredBridgeCode(error),
        structuredBridgeMessage(error, method),
        error
      );
    }
  }
}

export function createSuperappEmbedSDK(options) {
  return new SuperappEmbedSDK(options);
}

function structuredBridgeCode(error) {
  return pickCode(error?.code) ?? pickCode(error?.errCode) ?? "bridge_error";
}

function structuredBridgeMessage(error, method) {
  return (
    pickText(error) ??
    pickText(error?.message) ??
    pickText(error?.errMsg) ??
    `Host bridge method ${method} failed`
  );
}

function validateBootstrap(body) {
  for (const field of BOOTSTRAP_FIELDS) {
    if (!isText(body[field])) {
      throw new SuperappEmbedError("invalid_response", `Partner Backend bootstrap response is missing ${field}`);
    }
  }
  if (body.scopes != null && !(Array.isArray(body.scopes) && body.scopes.every(isText))) {
    throw new SuperappEmbedError("invalid_response", "Partner Backend bootstrap response has invalid scopes");
  }
}

function parseJSONObject(text) {
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(signal);
}

function abortError(signal) {
  return new SuperappEmbedError("aborted", "Request was aborted", signal.reason);
}

function pickCode(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return pickText(value);
}

function pickText(value) {
  return isText(value) ? value.trim() : undefined;
}

function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function requireText(value, field) {
  if (!isText(value)) {
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
