# private-domain-drive-server

私域网盘一期轻后端服务，部署在阿里云函数计算（FC，国内地域默认 `cn-hangzhou`）。

服务端只负责控制面能力，不中转文件流量：

- 健康检查
- 会话初始化 / 获取 STS 临时凭证
- 刷新 STS 临时凭证
- 当前用户能力查询

客户端拿到 STS 后，直接访问 OSS 完成文件列表、上传、下载、删除与预览。

## 接口一览

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /api/v1/health | 健康检查 |
| POST | /api/v1/session/bootstrap | 初始化会话并签发 STS |
| POST | /api/v1/session/refresh | 刷新 STS |
| GET | /api/v1/me/capabilities | 查询当前用户能力 |

本地默认地址：

```text
http://127.0.0.1:9000
```

## 需要配置什么

一期要跑通 bootstrap / refresh，必须先准备阿里云 RAM + STS + OSS 相关配置。

### 1. 阿里云侧前置条件

在开始填环境变量前，先确认云账号侧已经具备：

1. 一个 OSS Bucket（例如 `private-domain-drive`）
2. 一个可被 AssumeRole 的 RAM 角色，角色需具备该 Bucket 指定前缀的访问权限
3. 一个用于调用 STS 的 RAM 用户（不要用主账号）
4. 该 RAM 用户具备 `AliyunSTSAssumeRoleAccess`
5. 目标 RAM 角色的信任策略允许上述 RAM 用户 AssumeRole
6. 一个 FC 函数角色（用于日志等基础能力），通常可使用 `AliyunFCDefaultRole` 或自定义角色

建议权限边界：

- 仅授权到目标 Bucket
- 仅授权到业务前缀，例如 `shared/`
- 不要给客户端长期高权限 AccessKey

### 2. 本地 / 运行时环境变量

| 变量名 | 是否必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| ALIBABA_CLOUD_ACCESS_KEY_ID | 是 | 调用 STS 的 RAM 用户 AccessKeyId | LTAI5txxxxxxxx |
| ALIBABA_CLOUD_ACCESS_KEY_SECRET | 是 | 调用 STS 的 RAM 用户 AccessKeySecret | xxxxxxxxxxxxxxxx |
| STS_ASSUME_ROLE_ARN | 是 | 要扮演的 RAM 角色 ARN | acs:ram::1234567890123456:role/private-domain-drive-oss |
| STS_ROLE_SESSION_NAME | 否 | STS 会话名 | private-domain-drive-session |
| STS_DURATION_SECONDS | 否 | STS 有效期（秒） | 3600 |
| STS_ENDPOINT | 否 | STS Endpoint | sts.cn-hangzhou.aliyuncs.com |
| OSS_BUCKET | 否 | 下发给客户端的 Bucket | private-domain-drive |
| OSS_REGION | 否 | OSS 地域 | cn-hangzhou |
| OSS_ENDPOINT | 否 | OSS Endpoint | oss-cn-hangzhou.aliyuncs.com |
| OSS_ROOT_PREFIX | 否 | 允许访问的根前缀 | shared/ |
| MULTIPART_UPLOAD_THRESHOLD_BYTES | 否 | 超过该大小建议分片上传 | 10485760 |
| TEXT_PREVIEW_MAX_BYTES | 否 | 文本预览最大字节数 | 524288 |
| ALLOWED_PREVIEW_EXTENSIONS | 否 | 预览扩展名白名单 | jpg,jpeg,png,gif,pdf,txt,md |
| PORT | 否 | 仅本地调试使用 | 9000 |

未配置 STS 三项必填项时：

- `/api/v1/health`、`/api/v1/me/capabilities` 仍可正常返回
- `/api/v1/session/bootstrap`、`/api/v1/session/refresh` 会返回 `503 SERVICE_UNAVAILABLE`

### 3. 本地配置方式

```bash
cp .env.example .env
```

编辑 `.env`，至少填好：

```bash
ALIBABA_CLOUD_ACCESS_KEY_ID=your_ram_user_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_ram_user_access_key_secret
STS_ASSUME_ROLE_ARN=acs:ram::1234567890123456:role/your-oss-role
```

当前本地入口不会自动加载 `.env`，启动前请先导出：

```bash
set -a
source .env
set +a
npm run dev
```

## GitHub Actions CI/CD 发布到国内 FC

仓库已内置 GitHub Actions 流水线：

- 文件：`.github/workflows/deploy-fc.yml`
- 触发：
  - 仅支持 `workflow_dispatch` 手动触发
  - 手动触发后先跑测试，测试通过后再部署

部署工具：

- Serverless Devs（`@serverless-devs/s`）
- 配置文件：`s.yaml`
- 默认地域：`cn-hangzhou`
- 函数名：`private-domain-drive`

### 1. 先在 GitHub 配置 Secrets

进入仓库：

`Settings → Secrets and variables → Actions → New repository secret`

请配置以下 Secrets：

| Secret 名称 | 用途 | 说明 |
| --- | --- | --- |
| ALIYUN_ACCESS_KEY_ID | 部署 | 有 FC 部署权限的 RAM 用户 AK |
| ALIYUN_ACCESS_KEY_SECRET | 部署 | 对应 SK |
| ALIYUN_ACCOUNT_ID | 部署 | 阿里云主账号 ID（纯数字） |
| ALIYUN_FC_ROLE_ARN | 部署 | FC 函数角色 ARN，例如 `acs:ram::1234567890123456:role/AliyunFCDefaultRole` |
| ALIBABA_CLOUD_ACCESS_KEY_ID | 运行时 | 写入 FC 环境变量，用于 AssumeRole |
| ALIBABA_CLOUD_ACCESS_KEY_SECRET | 运行时 | 写入 FC 环境变量 |
| STS_ASSUME_ROLE_ARN | 运行时 | 写入 FC 环境变量，OSS 访问角色 ARN |

说明：

1. **部署凭证** 和 **运行时凭证** 可以是同一个 RAM 用户，也可以拆分。
2. 若拆分，建议：
   - 部署账号：具备 FC 发布权限
   - 运行时账号：仅具备 `sts:AssumeRole`
3. `ALIYUN_ACCOUNT_ID` 可在阿里云控制台右上角账号中心查看。
4. 不要把真实 AccessKey 写进代码或提交到 Git。

### 2. 部署 RAM 用户最小权限建议

部署用 RAM 用户建议至少具备：

- 函数计算 FC 的创建 / 更新 / 查询权限
- 如使用 `logConfig: auto`，还需允许 FC 关联日志相关资源

可先用较宽的 `AliyunFCFullAccess` 打通流程，后续再收敛到自定义策略。

运行时 RAM 用户建议：

- `AliyunSTSAssumeRoleAccess`
- 目标角色信任策略允许该用户 AssumeRole

### 3. 打通后如何发布

1. 在 GitHub 配好上述 Secrets
2. 在 Actions 页打开 `Deploy FC`，点击 `Run workflow`
3. 流水线会执行：
   - `npm ci`
   - `npm test`
   - `npm ci --omit=dev`
   - 配置 Serverless Devs
   - `s deploy -y --use-local`
4. 部署成功后，到阿里云 FC 控制台查看函数与 HTTP 触发器地址

### 4. 本地手动部署（可选）

先安装 Serverless Devs：

```bash
npm install -g @serverless-devs/s
```

配置密钥：

```bash
s config add \
  --AccessKeyID "$ALIYUN_ACCESS_KEY_ID" \
  --AccessKeySecret "$ALIYUN_ACCESS_KEY_SECRET" \
  --AccountID "$ALIYUN_ACCOUNT_ID" \
  --access default \
  -f
```

导出运行时环境变量后部署：

```bash
export ALIYUN_FC_ROLE_ARN=acs:ram::1234567890123456:role/AliyunFCDefaultRole
export ALIBABA_CLOUD_ACCESS_KEY_ID=...
export ALIBABA_CLOUD_ACCESS_KEY_SECRET=...
export STS_ASSUME_ROLE_ARN=...
npm ci --omit=dev
npm run deploy
```

## 本地开发

```bash
npm install
npm run dev
```

探活：

```bash
curl http://127.0.0.1:9000/api/v1/health
```

初始化会话：

```bash
curl -X POST http://127.0.0.1:9000/api/v1/session/bootstrap \
  -H 'content-type: application/json' \
  -d '{"platform":"macos","appVersion":"0.1.0"}'
```

## 测试

```bash
npm test
```

测试行为：

- 未配置 STS 密钥时：health / capabilities 成功，bootstrap / refresh 期望 503
- 配置完整 STS 密钥后：bootstrap / refresh 会走真实 AssumeRole

## 目录结构

```text
.
├── .github/workflows/deploy-fc.yml  # GitHub Actions 发布流水线
├── index.js                         # FC 入口
├── local.js                         # 本地 HTTP 调试入口
├── s.yaml                           # Serverless Devs 部署配置
├── .fcignore                        # 上传 FC 时忽略文件
├── .env.example                     # 环境变量示例
├── src
│   ├── handler.js
│   ├── routes/
│   ├── handlers/
│   ├── services/
│   ├── config/
│   └── utils/
└── test/
    └── handler.test.js
```

## 实现备注

- 一期不强制登录态 Header，默认返回演示用户 `demo-user` / `member`
- 普通成员默认能力：list / download / upload / preview 开启，delete 关闭
- STS 会尽量附带最小化 Policy，限制到指定 bucket + rootPrefix
- STS 过期时间统一格式化为 `yyyy-MM-dd HH:mm:ss`（UTC）
- 文件上传下载不经本服务中转

## 接口契约

完整请求/响应字段定义见主仓库：

`docs/接口.md`
