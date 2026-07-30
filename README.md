# Supperapp Embed JS SDK

面向嵌入 Supperapp Wallet Native WebView 的第三方 H5。SDK 将 Partner Backend
bootstrap、Native Bridge 授权和服务端完成动作封装为一次调用；PKCE verifier 和
Supperapp Token 不会进入浏览器。

```js
import { createSupperappEmbedSDK } from "@supperapp/embed-sdk";

const supperapp = createSupperappEmbedSDK();
const session = await supperapp.authenticate({
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
