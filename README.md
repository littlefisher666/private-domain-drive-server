# private-domain-drive-server

私域网盘一期控制面服务，运行在阿里云函数计算 FC 3.0（Node.js 20）。服务端仅校验登录、签发 / 下发 STS 与 OSS 配置、提供探活；文件列表、上传、下载、删除、缩略图和图片预览均由客户端持 STS 凭证直连 OSS，不经过本服务中转。

## 当前能力

- `GET /api/v1/health`：返回服务状态、版本和运行时，不依赖 STS 配置。
- `POST /api/v1/session/bootstrap`：从 OSS 用户 JSON 校验账号口令，调用阿里云 STS `AssumeRole`，下发临时凭证、受限 OSS 配置、能力与客户端约束，并下发 `stsBroker`。
- `POST /api/v1/session/refresh`：通过服务端运行时凭证签发新的 STS 临时凭证，作为备用刷新接口。
- STS Policy 限制到配置的 Bucket 和 `OSS_ROOT_PREFIX`，授权对象列举、读写、删除、分片上传及 OSS 图片处理所需操作。

用户信息固定从 OSS 对象 `config/users.json` 读取。该对象位于网盘展示目录之外。JSON 可以是用户数组，也可以是 `{ "users": [...] }`，每个用户至少包含 `account`、`password`、`userId`，可选 `displayName`、`mustResetPassword`。`password` 字段保存 Node.js `scrypt` 哈希值，不保存明文密码。当前权限不按用户角色区分，因此不再设置 `role` 字段。`/api/v1/session/refresh` 当前不校验登录态；在接入完整会话系统前，不应把它作为用户级授权边界。最终的对象访问权限仍以 RAM / STS Policy 为准。

例如 `config/users.json`：

```json
{
  "users": [
    {
      "account": "admin",
      "password": "scrypt$a147b817c517af25a4de0bdc1dd1cd5f$90070882bf4ea983e4a6a21d66aa48f157b741737b359c0f6418007c8c1d6b87419bb8df2fc1b91c853511a31f38b9fa3f162f6653d401abfc76dff189d005e4",
      "userId": "admin",
      "displayName": "管理员",
      "mustResetPassword": true
    }
  ]
}
```

如果 `mustResetPassword` 为 `true`，bootstrap 会返回该状态，客户端应调用 `POST /api/v1/session/password`，提交 `account`、`currentPassword` 和 `newPassword`。新密码至少 8 个字符，修改成功后服务端会把该字段改为 `false` 并回写 OSS 文件。

迁移旧用户目录时，必须离线为每个明文密码生成 `scrypt$<salt>$<derivedKey>` 哈希后再上传；服务端会拒绝明文或格式非法的 `password`。FC 运行时 RAM 角色只需对 `config/users.json` 授予 `GetObject` / `PutObject`，客户端下发的 STS Policy 仍仅包含 `shared/` 前缀。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/health` | 探活与基础运行时信息 |
| POST | `/api/v1/session/bootstrap` | 登录并初始化会话 |
| POST | `/api/v1/session/refresh` | 服务端备用 STS 刷新 |
| POST | `/api/v1/session/password` | 修改用户密码 |

所有响应使用统一信封：成功为 `{ "code": "OK", "message": "success", "requestId", "data" }`；错误包含 `code`、`message` 与 `requestId`。路由接受末尾带 `/` 的路径。完整字段、错误码和会话流程见主仓库 [docs/接口.md](../docs/接口.md)。

## 前置条件

运行 bootstrap / refresh 前，阿里云侧需要准备：

1. 目标 OSS Bucket，以及建议限制到业务前缀（默认 `shared/`）的访问策略。
2. 可被 `AssumeRole` 的 RAM 角色；其信任策略允许 STS 调用方扮演。
3. 用于调用 STS 的 RAM 用户或专用 STS Broker RAM 用户，具备 `AliyunSTSAssumeRoleAccess`。
4. FC 函数角色（部署配置中由 `ALIYUN_FC_ROLE_ARN` 提供），用于 FC 基础运行和日志能力。

不要使用主账号 AccessKey，也不要将真实密钥写入代码或提交到 Git。

## 运行时配置

服务端环境变量统一存放在主仓库 `secrets/server/.env`（经 git-crypt 加密后随主仓库提交）。首次配置从示例复制：

```bash
cp .env.example ../secrets/server/.env
```

`node local.js` 会自动从 `../secrets/server/.env` 加载变量；本地执行 `pnpm deploy` 前需先导出：

```bash
set -a
source ../secrets/server/.env
set +a
```

关键变量如下：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PDD_SERVER_OSS_ACCESS_KEY_ID` / `PDD_SERVER_OSS_ACCESS_KEY_SECRET` | 是 | 服务端 OSS AK，读写 `config/users.json` |
| `PDD_CLIENT_OSS_ACCESS_KEY_ID` / `PDD_CLIENT_OSS_ACCESS_KEY_SECRET` | 是 | 客户端 OSS AK，登录校验通过后随 bootstrap 下发 |
| `PDD_OSS_BUCKET` / `PDD_OSS_REGION` / `PDD_OSS_ENDPOINT` | 是 | OSS 连接信息 |
| `PDD_OSS_ROOT_PREFIX` | 否 | 受限对象前缀，默认 `shared/` |
| `PDD_MULTIPART_UPLOAD_THRESHOLD_BYTES` | 否 | 分片上传建议阈值，默认 10 MiB |
| `PDD_TEXT_PREVIEW_MAX_BYTES` | 否 | 文本预览上限，默认 512 KiB |
| `PDD_ALLOWED_PREVIEW_EXTENSIONS` | 否 | 预览扩展名白名单 |
| `PORT` | 否 | 本地 HTTP 端口，默认 `9000` |

缺少必填配置时 health 仍可用；bootstrap 返回 `503 SERVICE_UNAVAILABLE`。

## 本地开发与验证

要求 Node.js 20 或更高版本：

```bash
npm ci
npm run dev
```

本地地址为 `http://127.0.0.1:9000`。可先验证探活：

```bash
curl http://127.0.0.1:9000/api/v1/health
```

配置完成后可验证会话初始化：

```bash
curl -X POST http://127.0.0.1:9000/api/v1/session/bootstrap \
  -H 'content-type: application/json' \
  -d '{"account":"admin","password":"change-me","platform":"macos","appVersion":"0.1.0"}'
```

运行测试：

```bash
npm test
```

未设置 STS 配置时，测试会断言 bootstrap / refresh 返回 503；设置完整配置后，这两项测试会发起真实 `AssumeRole` 请求。

## 部署到阿里云 FC

部署定义在 `s.yaml`：默认地域 `cn-hangzhou`、函数名 `private-domain-drive`、运行时 `nodejs20`、128 MB 内存、10 秒超时。GitHub Actions 工作流 `.github/workflows/deploy-fc.yml` 仅支持手动触发，并在部署前运行测试。

在 GitHub Actions Secrets 中配置：

| Secret | 用途 |
| --- | --- |
| `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET` / `ALIYUN_ACCOUNT_ID` | Serverless Devs 部署凭证 |
| `ALIYUN_FC_ROLE_ARN` | FC 函数角色 ARN |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | FC 运行时 STS 调用凭证 |
| `STS_ASSUME_ROLE_ARN` | FC 运行时扮演的 OSS 角色 ARN |

工作流会依次执行 `npm ci`、`npm test`、`npm ci --omit=dev` 和 `s deploy -y --use-local`。本地手动部署时先安装并配置 Serverless Devs，再导出上述部署与运行时变量：

```bash
npm install -g @serverless-devs/s
s config add \
  --AccessKeyID "$ALIYUN_ACCESS_KEY_ID" \
  --AccessKeySecret "$ALIYUN_ACCESS_KEY_SECRET" \
  --AccountID "$ALIYUN_ACCOUNT_ID" \
  --access default -f
npm ci --omit=dev
npm run deploy
```

## 目录概览

```text
.
├── index.js                    # FC 入口
├── local.js                    # 本地 HTTP 入口
├── s.yaml                      # Serverless Devs 配置
├── .env.example                # 运行时变量示例
├── .github/workflows/deploy-fc.yml
├── src/
│   ├── handler.js              # FC 事件解析与错误处理
│   ├── routes/                 # 路由
│   ├── handlers/               # health、session
│   ├── services/stsService.js  # STS 与受限 OSS Policy
│   ├── config/                 # 环境配置和演示身份
│   └── utils/                  # 请求与响应工具
└── test/handler.test.js        # 路由、校验与 STS 配置测试
```
