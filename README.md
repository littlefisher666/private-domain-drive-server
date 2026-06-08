# private-domain-drive-server

私域网盘服务端仓库。

## 当前状态

当前已完成更接近真实部署形态的 `Node.js + 阿里云 FC` 项目骨架初始化。

## 计划方向

- 阿里云函数计算 FC
- Node.js
- STS 凭证签发
- 配置与能力信息下发

## 当前结构

- `index.js`：FC 入口
- `local.js`：本地 HTTP 调试入口
- `s.yaml`：Serverless Devs 部署描述
- `src/handler.js`：统一请求入口
- `src/routes/`：轻量路由分发
- `src/handlers/`：接口 handler
- `src/services/`：后续 STS、鉴权等服务层
- `src/config/`：环境变量与业务配置读取
- `src/utils/`：请求解析与统一响应

## 已覆盖接口

- `GET /api/v1/health`
- `POST /api/v1/session/bootstrap`
- `POST /api/v1/session/refresh`
- `GET /api/v1/me/capabilities`

其中 `session/bootstrap` 和 `session/refresh` 已接入真实 STS `AssumeRole` 调用。

## 本地调试

```bash
npm run dev
```

默认监听：

```text
http://127.0.0.1:9000
```

## 部署方向

当前默认使用：

- 阿里云函数计算 FC
- Serverless Devs
- `s.yaml` 管理函数配置

后续接入真实 STS 时，优先在现有 `services/` 和 `config/` 上迭代，不再额外平行起一套结构。

## 环境变量

请至少配置以下变量：

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `STS_ASSUME_ROLE_ARN`
- `STS_ROLE_SESSION_NAME`

其他可选项可参考 `.env.example`。

## 阿里云侧前提

根据阿里云官方文档，调用 `AssumeRole` 前至少需要满足：

- 调用方使用 RAM 用户或 RAM 角色，不直接使用主账号
- 调用方具备 `AliyunSTSAssumeRoleAccess`
- 目标角色信任策略允许该调用方

参考：

- [AssumeRole 官方接口说明](https://www.alibabacloud.com/help/id/ram/developer-reference/api-sts-2015-04-01-assumerole)
- [Node.js 凭证与 STS SDK 官方示例](https://www.alibabacloud.com/help/en/sdk/developer-reference/v2-manage-node-js-access-credentials)
