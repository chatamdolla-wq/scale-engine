# Service Interface 层编码规范

> Harness Engineering - 分层编码规范第二层

## 核心职责

Service Interface 层负责：定义业务契约、DTO 设计、版本控制。

## DTO 设计原则

Request DTO：入参约束（必填/可选标注）
Response DTO：返回数据结构
Internal DTO：Service 间传递

## Interface 命名约定

方法名 = 业务动作（语义化）
避免泛化命名：getData, processData

## 版本控制

版本化接口向下兼容，DTO 新增字段使用可选参数。

## 质量门禁

- [ ] 所有 DTO 有明确的必填/可选标注
- [ ] Interface 方法名语义化
- [ ] 版本化接口向下兼容
