# Service Implementation 层编码规范

> Harness Engineering - 分层编码规范第三层

## 核心职责

Service Impl 层负责：业务逻辑实现、事务管理、异常封装。

## 事务管理

事务边界在 Service 层，使用 TransactionManager.runInTransaction。

## 业务逻辑封装

复杂业务逻辑封装为私有方法，单一职责。

## 异常封装

只抛出 BusinessException，不抛出技术异常。

## DTO 转换

Entity → DTO 转换在 Service 层完成。

## 质量门禁

- [ ] 事务边界在 Service 层
- [ ] 业务逻辑封装为私有方法
- [ ] 只抛出 BusinessException
- [ ] 测试覆盖所有业务分支
