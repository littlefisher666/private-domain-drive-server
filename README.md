# private-domain-drive-server

私域网盘一期控制面服务，运行在阿里云函数计算 FC 3.0（Node.js 20）。服务端仅校验登录、签发 / 下发 STS 与 OSS 配置、提供探活和能力信息；文件列表、上传、下载、删除、缩略图和图片预览均由客户端持 STS 凭证直连 OSS，不经过本服务中转。

## 当前能力

- `GET /api/v1/health`：返回服务状态、版本和运行时，不依赖 STS 配置。
- `POST /api/v1/session/bootstrap`：校验演示账号口令，调用阿里云 STS `AssumeRole`，下发临时凭证、受限 OSS 配置、能力与客户端约束，并下发 `stsBroker`。
- `POST /api/v1/session/refresh`：通过服务端运行时凭证签发新的 STS 临时凭证，作为备用刷新接口。
- `GET /api/v1/me/capabilities`：返回固定的演示成员与能力信息。
- STS Policy 限制到配置的 Bucket 和 `OSS_ROOT_PREFIX`，授权对象列举、读写、删除、分片上传及 OSS 图片处理所需操作。

当前身份实现是演示用途：`admin/123456` 与 `member/123456` 均可登录，且权限一致（list、download、upload、delete、preview 均为 `true`）。`/api/v1/session/refresh` 和 `/api/v1/me/capabilities` 当前不校验登录态；在接入真实身份系统前，不应把它们作为用户级授权边界。最终的对象访问权限仍以 RAM / STS Policy 为准。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/health` | 探活与基础运行时信息 |
| POST | `/api/v1/session/bootstrap` | 登录并初始化会话 |
| POST | `/api/v1/session/refresh` | 服务端备用 STS 刷新 |
| GET | `/api/v1/me/capabilities` | 演示能力信息 |

所有响应使用统一信封：成功为 `{ "code": "OK", "message": "success", "requestId", "data" }`；错误包含 `code`、`message` 与 `requestId`。路由接受末尾带 `/` 的路径。完整字段、错误码和会话流程见主仓库 [docs/接口.md](../docs/接口.md)。

## 前置条件

运行 bootstrap / refresh 前，阿里云侧需要准备：

1. 目标 OSS Bucket，以及建议限制到业务前缀（默认 `shared/`）的访问策略。
2. 可被 `AssumeRole` 的 RAM 角色；其信任策略允许 STS 调用方扮演。
3. 用于调用 STS 的 RAM 用户或专用 STS Broker RAM 用户，具备 `AliyunSTSAssumeRoleAccess`。
4. FC 函数角色（部署配置中由 `ALIYUN_FC_ROLE_ARN` 提供），用于 FC 基础运行和日志能力。

不要使用主账号 AccessKey，也不要将真实密钥写入代码或提交到 Git。

## 运行时配置

复制示例并导出环境变量：

```bash
cp .env.example .env
set -a
source .env
set +a
```

`.env` 不会被 `node local.js` 自动加载。关键变量如下：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 是 | 服务端调用 STS 的 RAM AccessKeyId |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 是 | 服务端调用 STS 的 RAM AccessKeySecret |
| `STS_ASSUME_ROLE_ARN` | 是 | OSS 业务角色 ARN |
| `STS_BROKER_ACCESS_KEY_ID` / `STS_BROKER_ACCESS_KEY_SECRET` | 否 | 下发给客户端用于直连 STS 的专用受限 AK；留空时回退到服务端 STS AK |
| `STS_ROLE_SESSION_NAME` | 否 | 会话名，默认 `private-domain-drive-session` |
| `STS_DURATION_SECONDS` | 否 | STS 有效期秒数，默认 `3600` |
| `STS_ENDPOINT` | 否 | 默认 `sts.cn-hangzhou.aliyuncs.com` |
| `OSS_BUCKET` / `OSS_REGION` / `OSS_ENDPOINT` | 否 | 下发给客户端的 OSS 连接信息 |
| `OSS_ROOT_PREFIX` | 否 | 受限对象前缀，默认 `shared/` |
| `MULTIPART_UPLOAD_THRESHOLD_BYTES` | 否 | 分片上传建议阈值，默认 10 MiB |
| `TEXT_PREVIEW_MAX_BYTES` | 否 | 文本预览上限，默认 512 KiB |
| `ALLOWED_PREVIEW_EXTENSIONS` | 否 | 逗号分隔的预览扩展名白名单 |
| `PORT` | 否 | 本地 HTTP 端口，默认 `9000` |

缺少 STS 必填配置时，health 和 capabilities 仍可用；bootstrap / refresh 返回 `503 SERVICE_UNAVAILABLE`。STS 过期时间以 `yyyy-MM-dd HH:mm:ss` 的 UTC 时间格式返回。

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

配置 STS 后可验证会话初始化：

```bash
curl -X POST http://127.0.0.1:9000/api/v1/session/bootstrap \
  -H 'content-type: application/json' \
  -d '{"account":"admin","password":"123456","platform":"macos","appVersion":"0.1.0"}'
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
│   ├── handlers/               # health、session、capabilities
│   ├── services/stsService.js  # STS 与受限 OSS Policy
│   ├── config/                 # 环境配置和演示身份
│   └── utils/                  # 请求与响应工具
└── test/handler.test.js        # 路由、校验与 STS 配置测试
```
