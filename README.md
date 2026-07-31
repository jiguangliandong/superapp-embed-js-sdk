# Superapp Embed JS SDK

面向嵌入 Superapp APP 受信 WebView 的第三方 H5。SDK 将 Partner Backend
bootstrap、宿主授权和服务端完成动作封装为一次调用；PKCE verifier 和
Superapp Token 不会进入浏览器。

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
