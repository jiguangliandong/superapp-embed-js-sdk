export interface NativeBridge {
  invoke(method: string, params: Record<string, unknown>): Promise<unknown> | unknown;
}

export interface SDKOptions {
  bridge?: NativeBridge;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  requestTimeoutMs?: number;
}

export interface AuthenticationOptions {
  bootstrapURL: string;
  completeURL: string;
  scopes?: string[];
  signal?: AbortSignal;
}

export interface AuthorizationCodeResponse {
  code: string;
  state: string;
  expires_at?: string;
}

export declare class SuperappEmbedError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, cause?: unknown, status?: number);
}

export declare class SuperappEmbedSDK {
  bridge: NativeBridge;
  fetch: typeof globalThis.fetch;
  timeoutMs: number;
  requestTimeoutMs: number;
  constructor(options?: SDKOptions);
  getContext(): Promise<unknown>;
  getAuthCode(request: {
    transactionId: string;
    clientId: string;
    state: string;
    codeChallenge: string;
    scopes?: string[];
  }): Promise<AuthorizationCodeResponse>;
  authenticate(options: AuthenticationOptions): Promise<unknown>;
  openPrivacySettings(): Promise<unknown>;
  scanCode(params?: Record<string, unknown>): Promise<unknown>;
  dialPhone(params?: Record<string, unknown>): Promise<unknown>;
  saveImageToAlbum(params?: Record<string, unknown>): Promise<unknown>;
  close(): Promise<unknown>;
}

export declare function createSuperappEmbedSDK(options?: SDKOptions): SuperappEmbedSDK;
