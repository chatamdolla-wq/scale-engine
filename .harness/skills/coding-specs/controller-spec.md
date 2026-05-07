# Controller 层编码规范

> Harness Engineering - 分层编码规范第一层

## 核心职责

Controller 层负责：接收请求、参数校验、调用 Service、返回响应。**不包含业务逻辑。**

## RPC Provider 模式

```typescript
interface UserController {
  createUser(request: CreateUserRequest): Promise<CreateUserResponse>
  getUser(id: string): Promise<UserResponse>
  updateUser(id: string, request: UpdateUserRequest): Promise<UserResponse>
  deleteUser(id: string): Promise<void>
}
```

## 参数校验

所有入参必须校验：必填校验、格式校验、业务校验委托给 Service。

## 异常处理

Controller 不捕获业务异常，让全局异常处理器统一处理。

## 返回值约定

成功：`{ success: true, data: userDTO }`
失败：`{ success: false, error: { code, message } }`

## 质量门禁

- [ ] 所有入参有校验
- [ ] 无 try-catch 包裹业务逻辑
- [ ] 返回值统一格式
