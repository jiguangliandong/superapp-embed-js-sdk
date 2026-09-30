# Superapp Embed JS SDK

版本：`0.0.6`

面向嵌入 Superapp APP 受信 WebView 的第三方 H5。SDK 将 Partner Backend
bootstrap、宿主授权和服务端完成动作封装为一次调用；PKCE verifier 和
Superapp Token 不会进入浏览器。本 SDK 不调用 User Center HTTP；Token Endpoint
以 `{USER_CENTER}/.well-known/superapp-embed-configuration` 为准。

宿主 Bridge 若以带稳定 `code` 的对象拒绝 Promise（例如 `user_denied`、
`client_unavailable`），SDK 会原样透传到 `SuperappEmbedError.code`，不再一律
包装为 `bridge_error`。也兼容字符串拒绝和 `{ errCode, errMsg }` 形式。

Partner Backend 请求默认 15 秒超时（`requestTimeoutMs` 可调，超时报
`request_timeout`），`authenticate` 可传 `signal` 取消（报 `aborted`）。非 2xx
响应报 `partner_request_failed`（或透传响应体中的 `code`/`message`），并在
`SuperappEmbedError.status` 带上 HTTP 状态码；2xx 但响应体不是 JSON 对象、或
bootstrap 缺少必需字段时报 `invalid_response`；宿主授权结果缺少 `code` 时报
`invalid_bridge_response`。

`authenticate` 进行中时，参数（`bootstrapURL`、`completeURL`、`scopes`、`signal`）
相同的重复调用会复用同一次流程，避免重复点击产生多次 bootstrap 和多个授权弹窗；
流程结束（成功或失败）后再调用会重新发起。

```js
import { createSuperappEmbedSDK } from "@superapp/embed-sdk";

const superapp = createSuperappEmbedSDK();
const session = await superapp.authenticate({
  bootstrapURL: "/api/sso/bootstrap",
  completeURL: "/api/sso/complete",
  scopes: ["auth_base", "profile.name"]
});
```

运行检查：

```bash
npm test
npm run check
```
