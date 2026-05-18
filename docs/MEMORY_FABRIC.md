# Memory Fabric

Memory Fabric 是 SCALE 用来降低长会话 token 消耗、提升 Agent 记忆质量的上下文压缩层。它不会把所有历史文档都塞回提示词，而是按任务范围生成一个可审计的 context pack。

它聚合四类信息：

- Runtime Evidence：真实运行过的命令、工具、浏览器、skill、MCP 和人工验证证据。
- Session Events：当前会话的阶段、工具使用和证据写入事件。
- Knowledge Recall：从项目知识库召回已验证经验、规则和历史教训。
- Project Graph：检测 `graphify-out/GRAPH_REPORT.md` 或 `.scale/graph/manifest.json`，只引用图谱状态和摘要，不把大型图谱全文塞进上下文。

## 基本命令

生成上下文包：

```bash
scale memory pack \
  --task-id 2026-05-18-runtime-evidence \
  --session-id 2026-05-18-runtime-evidence \
  --task "继续实现 runtime evidence 与最终交付检查" \
  --level M \
  --files src/runtime,src/api/cli.ts \
  --budget 4000
```

输出 JSON，便于其他 Agent、CLI 或评审工具读取：

```bash
scale memory pack \
  --task "修复 OAuth callback state 过期处理" \
  --level M \
  --budget 4000 \
  --json
```

检查上下文预算：

```bash
scale memory doctor \
  --task "跨模块权限重构" \
  --level L \
  --budget 3000
```

## 预算策略

Memory Fabric 使用估算 token 预算控制上下文规模。优先级从高到低：

1. Runtime Evidence：失败证据和通过证据优先保留。
2. Session Events：最近会话事件优先保留。
3. Knowledge Recall：按任务描述和文件范围召回 Top K 知识。
4. Project Graph：只保留图谱报告路径和短摘要。

当预算不足时，低优先级 section 会被标记为 omitted，并写入原因。这样 Agent 能知道哪些上下文被刻意裁剪，而不是误以为项目没有相关信息。

## 与知识库和自我进化的关系

Memory Fabric 不替代知识库。它是知识库、运行证据和图谱之间的读取层：

- Runtime Evidence 记录“这次实际做过什么”。
- Knowledge Base 记录“长期可复用的经验和规则”。
- Graphify 或项目图谱记录“模块之间的结构关系”。
- Memory Fabric 在每次任务开始、恢复、评审或发版前，生成本次最相关的上下文包。

任务完成后，应该把真正稳定的经验沉淀到知识库或长期维护文档中；`.scale/events/` 和 `.scale/evidence/` 仍然是本地运行时产物，不应默认提交到 Git。

## 推荐使用场景

- 长会话恢复前：先生成 context pack，避免重复读大量文档。
- 多 Agent 协作前：把 context pack 交给审查 Agent 或测试 Agent。
- 发版前：用 runtime evidence 和 session events 检查是否存在未闭环失败。
- 大型项目治理：结合 service matrix、resource governance 和 engineering standards，生成任务相关而不是全仓库噪声上下文。

## 当前边界

- 当前版本不内置向量数据库；如果项目配置了 SQLite knowledge base，会使用现有召回接口。
- 当前版本只检测 Graphify 产物是否存在并生成摘要，不主动运行 Graphify。
- HTML 可视化报告适合后续加在 context pack 之上；Memory Fabric 的核心产物先保持 JSON/Markdown，方便 diff、测试和 CLI 集成。
