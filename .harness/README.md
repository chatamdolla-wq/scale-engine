# .harness Directory

> Harness Engineering 配置目录

## 目录结构

```
.harness/
├── SKILL.md              # Skill 定义文件
├── skills/
│   └── coding-specs/     # 分层编码规范
│       ├── controller-spec.md
│       ├── service-interface-spec.md
│       ├── service-impl-spec.md
│       ├── domain-spec.md
│       ├── dao-spec.md
│       ├── adapter-spec.md
│       └── doc-spec.md
├── gates/                # 质量门禁配置
│   └── default.json
├── templates/            # 变更管理模板
│   └── change-template.md
└── state/                # 运行状态
│   └── progress.json
```

## 使用方式

1. **编码规范**：阅读 coding-specs/ 对应层级的规范
2. **质量门禁**：配置 gates/default.json 定义项目门禁
3. **变更管理**：使用 templates/ 创建变更文档

## 集成

SCALE Engine 自动加载 .harness/：
- GateEvaluator 读取 gates/ 配置
- SessionStartSequence 读取 state/progress.json
- SkillDiscovery 扫描 skills/ 目录
