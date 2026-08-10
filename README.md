# private-domain-drive-server

私域网盘一期轻后端服务，部署在阿里云函数计算（FC）。

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

建议权限边界：

- 仅授权到目标 Bucket
- 仅授权到业务前缀，例如 `shared/`
- 不要给客户端长期高权限 AccessKey

### 2. 必填环境变量

| 变量名 | 是否必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| ALIBABA_CLOUD_ACCESS_KEY_ID | 是 | 调用 STS 的 RAM 用户 AccessKeyId | LTAI5txxxxxxxx |
| ALIBABA_CLOUD_ACCESS_KEY_SECRET | 是 | 调用 STS 的 RAM 用户 AccessKeySecret | xxxxxxxxxxxxxxxx |
| STS_ASSUME_ROLE_ARN | 是 | 要扮演的 RAM 角色 ARN | acs:ram::1234567890123456:role/private-domain-drive-oss |

未配置以上三项时：

- `/api/v1/health`、`/api/v1/me/capabilities` 仍可正常返回
- `/api/v1/session/bootstrap`、`/api/v1/session/refresh` 会返回 `503 SERVICE_UNAVAILABLE`

### 3. 推荐配置项

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| STS_ROLE_SESSION_NAME | private-domain-drive-session | STS 会话名 |
| STS_DURATION_SECONDS | 3600 | STS 有效期（秒） |
| STS_ENDPOINT | sts.cn-hangzhou.aliyuncs.com | STS Endpoint |
| OSS_BUCKET | private-domain-drive | 下发给客户端的 Bucket |
| OSS_REGION | cn-hangzhou | OSS 地域 |
| OSS_ENDPOINT | oss-cn-hangzhou.aliyuncs.com | OSS Endpoint |
| OSS_ROOT_PREFIX | shared/ | 允许访问的根前缀 |
| MULTIPART_UPLOAD_THRESHOLD_BYTES | 10485760 | 超过该大小建议分片上传（10MB） |
| TEXT_PREVIEW_MAX_BYTES | 524288 | 文本预览最大字节数（512KB） |
| ALLOWED_PREVIEW_EXTENSIONS | jpg,jpeg,png,gif,pdf,txt,md | 预览扩展名白名单 |
| PORT | 9000 | 仅本地调试使用 |

### 4. 本地配置方式

仓库已提供 `.env.example`。可按下面步骤配置：

```bash
cp .env.example .env
```

然后编辑 `.env`，至少填好：

```bash
ALIBABA_CLOUD_ACCESS_KEY_ID=your_ram_user_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_ram_user_access_key_secret
STS_ASSUME_ROLE_ARN=acs:ram::1234567890123456:role/your-oss-role
```

当前本地入口不会自动加载 `.env`，启动前请先导出环境变量，例如：

```bash
set -a
source .env
set +a
npm run dev
```

也可以直接在 shell 中 export：

```bash
export ALIBABA_CLOUD_ACCESS_KEY_ID=...
export ALIBABA_CLOUD_ACCESS_KEY_SECRET=...
export STS_ASSUME_ROLE_ARN=...
npm run dev
```

### 5. 部署到 FC 时要配置什么

使用 Serverless Devs 部署：

```bash
s deploy
```

部署前请在以下位置补齐配置：

1. `s.yaml` 的 `environmentVariables`
2. 或函数控制台环境变量

至少需要配置：

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `STS_ASSUME_ROLE_ARN`

并确认 OSS 相关变量与真实资源一致：

- `OSS_BUCKET`
- `OSS_REGION`
- `OSS_ENDPOINT`
- `OSS_ROOT_PREFIX`

> 注意：不要把真实 AccessKey 提交进 Git。密钥只放在本地环境变量、FC 环境变量或密钥管理系统中。

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
├── index.js                 # FC 入口
├── local.js                 # 本地 HTTP 调试入口
├── s.yaml                   # Serverless Devs 部署配置
├── .env.example             # 环境变量示例
├── src
│   ├── handler.js           # 统一请求入口
│   ├── routes/              # 路由
│   ├── handlers/            # 接口实现
│   ├── services/            # STS 服务
│   ├── config/              # 配置与演示身份
│   └── utils/               # 请求/响应/时间工具
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
