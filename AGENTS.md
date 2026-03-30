<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# DeerFlow (超级智能体框架)

## Purpose
DeerFlow（Deep Exploration and Efficient Research Flow）是一个开源超级智能体编排框架，基于 LangGraph 构建。提供沙箱执行、持久化记忆、子智能体委派、可扩展工具集成、技能系统和 IM 通道集成。运行在隔离的线程环境中。

**架构**：
- **LangGraph Server**（端口 2024）— 智能体运行时
- **Gateway API**（端口 8001）— REST API（模型、MCP、技能、记忆等）
- **Frontend**（端口 3000）— Next.js Web 界面
- **Nginx**（端口 2026）— 统一反向代理入口

## Key Files
| File | Description |
|------|-------------|
| `config.yaml` | 主应用配置（模型、工具、沙箱、技能、记忆等） |
| `config.example.yaml` | 配置模板（含 config_version 字段） |
| `extensions_config.json` | MCP 服务器和技能配置 |
| `Makefile` | 开发命令（check, install, dev, stop） |
| `README.md` | 框架完整文档 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `backend/` | Python 后端（Gateway + LangGraph）（见 `backend/AGENTS.md`） |
| `frontend/` | Next.js 前端（见 `frontend/AGENTS.md`） |
| `skills/` | 智能体技能目录 |
| `docker/` | Docker 配置（nginx, provisioner） |
| `scripts/` | 部署和工具脚本 |
| `docs/` | 框架文档 |

## For AI Agents

### Working In This Directory
- 使用 `make dev` 启动所有服务，`make stop` 停止
- **Harness/App 分层**：`packages/harness/`（可发布包）不依赖 `app/`（应用层）
- 配置优先级：显式参数 > 环境变量 > 当前目录 config.yaml > 父目录 config.yaml
- 环境变量引用：配置值以 `$` 开头解析为环境变量

### Testing Requirements
- `make test` 运行后端测试
- 关键测试：`test_harness_boundary.py`（导入边界）、`test_docker_sandbox_mode_detection.py`

### Common Patterns
- **中间件链**：11 个中间件按严格顺序执行（ThreadData → Uploads → Sandbox → ... → Clarification）
- **子智能体**：最多 3 个并发，15 分钟超时
- **沙箱系统**：本地或 Docker 隔离，虚拟路径映射
- **MCP 集成**：懒加载、缓存失效、支持 OAuth

## Dependencies

### Internal
- `../backend/` — 布丁创作后端调用 DeerFlow Gateway
- `../frontend/` — 布丁创作前端通过代理连接 Gateway

### External
- LangGraph SDK, LangChain, FastAPI, Next.js 16, Docker

<!-- MANUAL: -->
