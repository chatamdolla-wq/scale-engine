# DAO 层编码规范

> Harness Engineering - 分层编码规范第五层

## 核心职责

DAO 层负责：数据持久化、查询封装、乐观锁。

## DDL 设计原则

主键：UUID 或自增
价格字段：BIGINT（分）
乐观锁：version 字段

## Mapper 模式

Dao Interface 抽象数据访问
Mapper 实现 SQL 映射

## 乐观锁实现

UPDATE 时检查版本号，版本不匹配抛出 OptimisticLockException。

## 批量查询优化

避免 N+1 查询，使用 JOIN 或 IN 查询。

## 质量门禁

- [ ] 价格字段使用 BIGINT
- [ ] 乐观锁版本号
- [ ] 无 N+1 查询
