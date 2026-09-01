# Superapp Embed JS SDK

版本：`0.0.2`

面向嵌入 Superapp APP 受信 WebView 的第三方 H5。SDK 将 Partner Backend
bootstrap、宿主授权和服务端完成动作封装为一次调用；PKCE verifier 和
Superapp Token 不会进入浏览器。本 SDK 不调用 User Center HTTP；Token Endpoint
以 `{USER_CENTER}/.well-known/superapp-embed-configuration` 为准。

宿主 Bridge 若以带稳定 `code` 的对象拒绝 Promise（例如 `user_denied`、
`client_unavailable`），SDK 会原样透传到 `SuperappEmbedError.code`，不再一律
包装为 `bridge_error`。

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
