# Agent Governance Demo

这是 SCALE Engine 的最小官方 demo 项目，用来演示 Agent 如何在治理工作流下完成一个安全敏感任务。

业务场景：OAuth callback 必须拒绝过期、已消费或不匹配的 state。

## 运行

```bash
npm install
npm test
```

## 接入 SCALE

```bash
scale init --governance-pack node-library
scale preflight --preflight-profile quick
scale context init --name "Agent Governance Demo"
scale context grill --task-id 2026-05-18-oauth-state --task "加固 OAuth state 校验"
scale diagnose plan --task-id 2026-05-18-oauth-state --symptom "OAuth callback 在 state 过期或不匹配时行为不明确"
scale tdd slice --task-id 2026-05-18-oauth-state --behavior "拒绝过期、已消费或不匹配的 OAuth state" --public-interface "verifyOAuthState(record, providedState, now)" --failing-test "expired, consumed, mismatched state should return ok=false" --test-file tests/oauth-state.test.ts --impl-files src/oauth-state.ts
scale artifact render --task-id 2026-05-18-oauth-state --artifact-dir docs/worklog/tasks/2026-05-18-oauth-state
scale artifact doctor --artifact-dir docs/worklog/tasks/2026-05-18-oauth-state
```

## 看点

- 业务逻辑很小，但风险边界明确。
- 测试覆盖成功、过期、已消费、不匹配和缺失记录。
- SCALE 命令会生成任务证据，避免 Agent 只口头说“已完成”。

