# Domain 层编码规范

> Harness Engineering - 分层编码规范第四层

## 核心职责

Domain 层负责：领域模型定义、业务规则、领域事件。

## 领域模型设计

值对象：封装校验规则（如 Email）
枚举：有限状态（如 UserStatus）

## 价格处理（Long/分）

价格以"分"为单位，避免浮点精度问题。
Price.fromYuan(99.99) → 9999 分

## 业务规则封装

状态转换规则、可支付条件、可取消条件等在 Domain 层方法中。

## 领域事件

定义业务事实：ORDER_CREATED, ORDER_PAID 等。

## 质量门禁

- [ ] 价格使用 Long/分
- [ ] 值对象封装校验规则
- [ ] 无基础设施依赖
