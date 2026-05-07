# 文档规范

> Harness Engineering - 分层编码规范第七层

## 核心职责

文档层负责：API 文档、接口说明、变更日志。

## API 文档格式

@api POST /api/v1/users
@description 创建新用户
@request CreateUserRequest
@response UserDTO
@error MISSING_EMAIL - 邮箱必填

## Interface 说明文档

业务领域、负责人、版本、变更历史、依赖服务。

## DTO 说明文档

用途、必填/可选、校验规则、示例。

## 变更日志

CHANGELOG.md 记录所有版本变更。

## 质量门禁

- [ ] 所有公开 API 有文档注释
- [ ] 变更日志记录所有版本变更
- [ ] Swagger/OpenAPI 文档自动生成
