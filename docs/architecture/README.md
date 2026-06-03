# SCALE Engine Architecture

## System Overview

SCALE Engine is an AI Engineering Operating System that provides governance, workflow automation, and continuous evolution for AI-assisted development.

```mermaid
graph TB
    subgraph "Entry Points"
        CLI[CLI]
        MCP[MCP Server]
        HTTP[HTTP API]
    end

    subgraph "Core Engines"
        Shield[Shield<br/>Security Hooks]
        Orch[Orchestrator<br/>Declarative Workflow]
        Cortex[Cortex<br/>Continuous Evolution]
    end

    subgraph "Intelligence Layer"
        CodeGraph[CodeGraph<br/>AST Analysis]
        Memory[Memory<br/>3-Layer Architecture]
        Skills[Skills<br/>Capability Routing]
    end

    subgraph "Workflow Pipeline"
        Define[Define]
        Plan[Plan]
        Build[Build]
        Verify[Verify]
        Review[Review]
        Ship[Ship]
    end

    subgraph "Storage"
        SQLite[(SQLite)]
        JSON[JSON Files]
        Git[Git]
    end

    CLI --> Shield
    CLI --> Orch
    CLI --> Cortex
    MCP --> CodeGraph
    HTTP --> Memory

    Shield --> Skills
    Orch --> Define
    Cortex --> Memory

    Define --> Plan --> Build --> Verify --> Review --> Ship

    CodeGraph --> SQLite
    Memory --> SQLite
    Skills --> JSON
    Orch --> Git
```

## Core Engines

### Shield

Hook-based security engine that intercepts dangerous commands.

```mermaid
graph LR
    YAML[YAML Policies] --> Compiler[Compiler]
    Compiler --> Hooks[Shell Hooks]
    Hooks --> Intercept[Intercept]
    Intercept --> Block[Block]
    Intercept --> Allow[Allow]
    Intercept --> Warn[Warn]
```

### Orchestrator

Declarative orchestration daemon with git worktree isolation.

```mermaid
graph TB
    Config[Config] --> Engine[Engine]
    Engine --> Tracker[Tracker]
    Engine --> Worktree[Worktree]
    Engine --> Loop[Coordination Loop]
    Loop --> Task[Task]
    Loop --> Evidence[Evidence]
    Loop --> Gate[Gate]
```

### Cortex

Evidence-driven continuous evolution with instinct extraction.

```mermaid
graph LR
    Obs[Observations] --> Extract[Extract]
    Extract --> Instincts[Instincts]
    Instincts --> Inject[Inject]
    Inject --> Session[Session]
    Session --> Metrics[Metrics]
```

## Intelligence Layer

### CodeGraph

AST-based code intelligence using tree-sitter.

```mermaid
graph TB
    Source[Source Code] --> Parser[Tree-sitter]
    Parser --> AST[AST]
    AST --> Graph[Knowledge Graph]
    Graph --> Query[Query Engine]
    Query --> Impact[Impact Analysis]
    Query --> Context[Context Building]
```

### Memory (3-Layer Architecture)

```mermaid
graph TB
    L1[L1: Trace<br/>Raw observations] --> Refine1[Refine]
    Refine1 --> L2[L2: Policy<br/>Extracted patterns]
    L2 --> Refine2[Refine]
    Refine2 --> L3[L3: World Model<br/>Consolidated knowledge]
    L3 --> Crystal[Crystallized<br/>Global wisdom]
```

### Skills

Capability routing with supply chain safety.

```mermaid
graph LR
    Task[Task] --> Recommend[Recommend]
    Recommend --> Skills[Skills]
    Skills --> Safety[Safety Check]
    Safety --> Install[Install]
    Install --> Evidence[Evidence]
```

## Workflow Pipeline

```mermaid
stateDiagram-v2
    [*] --> Define
    Define --> Plan
    Plan --> Build
    Build --> Verify
    Verify --> Review
    Review --> Ship
    Ship --> [*]

    Define --> Define: Scope unclear
    Plan --> Plan: Missing info
    Build --> Build: Tests fail
    Verify --> Verify: Gates fail
    Review --> Review: Issues found
    Ship --> Ship: Checks fail
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Engine
    participant Memory
    participant CodeGraph

    User->>CLI: scale define "task"
    CLI->>Engine: Create artifact
    Engine->>Memory: Query similar
    Memory-->>Engine: Context

    User->>CLI: scale build
    CLI->>Engine: Execute TDD
    Engine->>CodeGraph: Query symbols
    CodeGraph-->>Engine: Impact analysis

    User->>CLI: scale verify
    CLI->>Engine: Run gates
    Engine->>Memory: Record evidence
    Memory-->>Engine: Confirmation
```

## Storage Architecture

```mermaid
graph TB
    subgraph ".scale/"
        SQLite[(brain.sqlite)]
        Instincts[instincts/]
        Evidence[evidence/]
        Specs[specs/]
        Memory[memory/]
    end

    subgraph "Project"
        SRC[src/]
        TESTS[tests/]
        DOCS[docs/]
    end

    SQLite --> Memory
    Instincts --> Cortex
    Evidence --> Runtime
    Specs --> Inject
```

## Integration Points

### MCP Server

Model Context Protocol server over stdio for AI agent integration.

```mermaid
graph LR
    Agent[AI Agent] -->|JSON-RPC| MCP[MCP Server]
    MCP --> Tools[Tools]
    Tools --> Scale[SCALE Engine]
    Scale --> Results[Results]
    Results --> Agent
```

### HTTP API

Hono-based HTTP server for dashboard and external integrations.

```mermaid
graph LR
    Client[Client] -->|HTTP| Hono[Hono Server]
    Hono --> Routes[Routes]
    Routes --> Engine[SCALE Engine]
    Engine --> Response[Response]
    Response --> Client
```

## Key Design Decisions

1. **SQLite over PostgreSQL**: Embedded, zero-config, sufficient for project-scoped data
2. **Functional composition**: Pure functions over classes for testability
3. **Evidence-first**: All decisions backed by observable evidence
4. **Progressive governance**: Gradual adoption of governance practices
5. **Supply chain safety**: Every external dependency verified before use
