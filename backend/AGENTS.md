<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# DeerFlow Backend

## Purpose
DeerFlow 后端，包含 LangGraph 智能体运行时（端口 2024）和 FastAPI Gateway API（端口 8001）。分为 Harness 层（可发布包）和 App 层（应用代码）。

> 架构和设计模式详见 [CLAUDE.md](CLAUDE.md)

## Key Files
| File | Description |
|------|-------------|
| `langgraph.json` | LangGraph Server 配置 |
| `Makefile` | 后端开发命令（dev, gateway, test, lint） |
| `CLAUDE.md` | 完整架构文档（必读） |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `packages/harness/` | deerflow-harness 包（智能体、工具、沙箱、MCP、技能） |
| `app/` | 应用层（Gateway API、IM 通道集成） |
| `tests/` | 测试套件 |
| `docs/` | 后端文档 |

## For AI Agents

### Working In This Directory
- `make dev` 启动 LangGraph Server，`make gateway` 启动 Gateway API
- **Harness/App 分层**：`packages/harness/` 不依赖 `app/`（CI 强制检查）
- 11 个中间件按严格顺序执行
- 配置文件：`config.yaml`（主配置）、`extensions_config.json`（MCP/技能）

### Testing Requirements
- `make test` 运行测试
- 关键：`test_harness_boundary.py` 确保导入方向正确

<!-- MANUAL: -->