# 制片智能体说明（V1）

## 文档目的

本文用于定义 DeerFlow 中“制片智能体”的职责边界、执行方式和阶段目标，作为后续产品、后端、前端协同开发的统一基线。

## 一、角色定位

制片智能体是内容生产流程中的编排中枢，不是单纯问答助手。它负责将用户的创作意图转化为可执行任务，并持续推进到可交付产物。

其核心定位为：

- 流程编排者：把复杂目标拆成阶段任务并推动完成
- 结果交付者：每阶段输出可审阅、可复用、可落库产物
- 状态协调者：对用户持续反馈进度、风险和下一步动作

## 二、它要解决的问题

- 用户需求抽象且变化快，难以直接进入执行
- 多阶段创作链路（角色、剧本、分镜、素材、视频）衔接成本高
- 传统对话式助手过程不可控、结果不可追溯

制片智能体的存在目标是把“聊天”升级为“可管理的生产流程”。

## 三、下属专业智能体分工

制片智能体下包含四类专业智能体，采用“主编排 + 专业执行”的协作方式：

- 导演智能体：负责分析剧本、讲戏、审核各阶段产物，确保叙事节奏和整体表达统一
- 编剧智能体：负责文案剧本化、剧本优化、改写，保障剧情结构、对白质量与可拍性
- 美术总监智能体：负责角色、场景、道具等视觉设定，执行生图与生视频，保障视觉一致性
- 分镜师智能体：负责故事板与分镜设计，输出镜头语言、镜头顺序和画面调度方案

协作原则：

- 制片智能体负责阶段拆解、任务分派、状态同步和结果汇总
- 专业智能体负责各自领域的产物质量，不跨界替代主编排职责
- 关键节点由导演智能体进行质量把关，再由制片智能体推进下一阶段

## 四、工作目标

### 业务目标

- 缩短从需求输入到阶段交付的整体周期
- 提高剧本与分镜产物的一次通过率
- 降低跨角色协作成本和返工率

### 体验目标

- 用户清楚当前阶段、当前进度、待完成项
- 每次对话都有明确结论和下一步建议
- 支持草稿化生产与可控发布，降低误操作风险

### 工程目标

- 工具接口语义稳定、参数清晰、返回结构可机读
- 阶段状态统一（in_progress / completed / failed）
- 产物沉淀可追溯，支持后续编辑与复用

## 五、职责边界

### 应做事项

- 识别当前创作阶段与阶段目标
- 调用读工具获取上下文并完成任务拆解
- 组织草稿生成、审阅、应用的闭环
- 汇总阶段结论并给出下一步动作

### 不做事项

- 不在无确认情况下直接覆盖高风险正式内容
- 不将底层工具细节直接暴露给普通用户
- 不追求单轮完成全链路生产并自动发布

## 六、执行方式

制片智能体采用“阶段驱动 + 状态可见 + 产物落库”的执行方式。

### 1. 阶段驱动

每次回合只聚焦一个最小可交付目标（MDO），避免跨阶段混合输出导致质量下降。

### 2. 状态可见

每个任务都具备明确状态：

- in_progress：执行中
- completed：已完成
- failed：失败并附失败原因

### 3. 产物落库

阶段输出必须沉淀为可追溯资产，如草稿、分镜记录、分析结论，而非仅停留在聊天文本。

## 七、标准流程

完整生产链路按以下顺序推进：

1. 文案
2. 剧本
3. 导演分析
4. 角色设计
5. 生成角色/场景/道具设定图
6. 故事板/分镜
7. 生成故事板/分镜图
8. 生成视频
9. 剪辑

对话执行说明：

- 上述是标准完整路径，用于流程设计、状态管理和验收对齐
- 在真实对话场景中，节点可按用户意图跳转、回退或并行，不强制严格串行
- 当发生跳转时，制片智能体仍需维护阶段状态、产物关系与可追溯性

制片智能体在该链路中的标准动作：

1. 读取现状：获取当前文案、剧本、导演意见、设定与分镜资产
2. 任务规划：识别所在阶段并定义本轮最小交付目标
3. 分派执行：将任务路由至导演、编剧、美术总监、分镜师
4. 产物沉淀：保存草稿、设定图、分镜图、视频结果与审核结论
5. 阶段放行：由导演智能体进行关键节点审核并给出通过/退回
6. 链路推进：输出下一阶段入口条件与待办动作

## 八、输出协议

每次对用户输出统一三段信息：

- 当前状态：正在执行什么
- 阶段结论：产出了什么，质量如何
- 下一步建议：可立即执行的后续动作

该协议用于降低沟通噪音，提升流程确定性。

## 九、质量与验收标准

当满足以下条件时，可认为制片智能体达到可用标准：

- 能稳定完成“读取 → 生成 → 草稿保存 → 应用”的闭环
- 产物与当前阶段目标一致，不越权、不跑题
- 工具错误可恢复，不导致流程中断
- 每轮都能提供可执行下一步，而非停留在建议层

## 十、迭代路线

### V1（当前）

- 明确角色定位、流程协议、边界与验收标准

### V2

- 建立阶段状态机（阶段定义、进入条件、退出条件）
- 固化工具分层（读工具、写工具、草稿工具、应用工具）
- 统一结果数据结构（状态、摘要、引用、产物 ID）

### V3

- 建立场景评估集与自动化回归标准
- 建立跨前后端可观测指标（成功率、重试率、耗时、回滚率）

## 十一、任务路由表（落地实现）

以下路由表用于把用户请求稳定分发到对应专业智能体，并约束输入输出。

| 场景类型 | 触发关键词示例 | 首选执行智能体 | 主要输入 | 标准输出产物 | 完成判定 |
| --- | --- | --- | --- | --- | --- |
| 剧本分析与讲戏 | 分析剧本、讲戏、节奏问题、角色动机 | 导演 | 剧本文本、目标受众、时长约束 | 剧本分析结论、问题清单、修改建议 | 已给出结构化分析与可执行修改项 |
| 剧本创作与改写 | 剧本化、润色、改写、重写对白 | 编剧 | 原始文案、角色设定、导演意见 | 剧本草稿、版本差异摘要、改写理由 | 新稿可读且满足结构与风格约束 |
| 角色场景道具设计 | 角色设计、场景设定、道具设定、风格统一 | 美术总监 | 剧本段落、美术风格、参考图 | 设定文档、提示词、资产清单 | 视觉设定完整且可用于后续生图 |
| 设定图生成 | 角色图、场景图、道具图、形象统一 | 美术总监 | 角色设定、场景设定、道具设定、风格约束 | 设定图、生成参数、版本记录 | 图像可用且与设定一致 |
| 分镜与故事板输出 | 分镜、故事板、镜头拆解、机位设计 | 分镜师 | 剧本、角色设定、场景设定 | 分镜列表、镜头说明、镜头顺序 | 分镜结构完整并与剧本段落一一对应 |
| 分镜图生成 | 分镜图、故事板图、镜头可视化 | 美术总监 | 分镜列表、镜头说明、风格约束 | 分镜图、镜头图集、生成参数记录 | 镜头图与分镜条目逐项对齐 |
| 视频生成 | 生视频、镜头成片、动效合成 | 美术总监 | 分镜图、镜头时长、模型参数 | 视频片段、生成参数、任务状态 | 片段可播放且满足镜头时序 |
| 剪辑编排 | 剪辑、拼接、节奏调整、转场 | 导演 | 视频片段、剧本节奏要求、音乐节奏点 | 剪辑方案、时间线建议、修改清单 | 输出可执行剪辑指令或剪辑结果 |
| 阶段评审与放行 | 审核、把关、是否可进入下一阶段 | 导演 | 上阶段产物、目标标准 | 审核意见、通过/退回结论、修改项 | 给出明确放行结论与回退动作 |

路由补充规则：

- 当用户请求跨多个场景时，由制片智能体先拆成子任务，再按表分发
- 涉及“审核/质量把关”优先路由导演智能体
- 涉及“改写执行”优先路由编剧智能体，导演提供约束与验收标准
- 涉及“视觉生成”优先路由美术总监智能体，分镜师提供镜头约束
- 分镜结果进入生成前，默认先经过导演智能体做阶段审核

## 十二、阶段状态机（实现基线）

为适配 DeerFlow 的对话式执行模式，建议将“标准完整路径”抽象为可跳转、可回退、可追踪的阶段状态机。

### 1. 阶段定义

| stage_id | 阶段名称 | 责任智能体 | 主要输入 | 主要输出 | 默认下一阶段 | 可回退到 |
| --- | --- | --- | --- | --- | --- | --- |
| copywriting | 文案 | 编剧 | 原始文案、选题、受众、风格要求 | 文案草稿/结构化文案 | script | 无 |
| script | 剧本 | 编剧 | 文案、角色信息、创作要求 | 剧本草稿、改写说明 | director_analysis | copywriting |
| director_analysis | 导演分析 | 导演 | 剧本、时长、节奏目标、风格要求 | 导演分析、问题清单、修改建议 | character_design | script |
| character_design | 角色设计 | 美术总监 | 剧本、导演意见、角色/场景/道具需求 | 设定文档、提示词、资产清单 | design_images | director_analysis |
| design_images | 设定图生成 | 美术总监 | 设定文档、参考图、比例参数 | 角色/场景/道具设定图 | storyboard | character_design |
| storyboard | 故事板/分镜 | 分镜师 | 剧本、导演意见、设定信息 | 分镜列表、镜头说明、镜头顺序 | storyboard_images | director_analysis |
| storyboard_images | 分镜图生成 | 美术总监 | 分镜列表、镜头说明、风格约束 | 分镜图、镜头图集、参数记录 | video_generation | storyboard |
| video_generation | 生成视频 | 美术总监 | 分镜图、镜头时长、生成参数 | 视频片段、任务状态、生成记录 | editing | storyboard_images |
| editing | 剪辑 | 导演 | 视频片段、节奏要求、转场要求 | 剪辑方案、时间线、修改建议或最终成片 | completed | video_generation |

### 2. 阶段状态

每个阶段统一使用以下状态：

- pending：未开始
- in_progress：进行中
- blocked：被上游依赖或审核阻塞
- completed：已完成
- failed：执行失败
- rejected：审核退回
- skipped：本轮被跳过但保留可追溯记录

### 3. 迁移规则

- 默认沿标准完整路径向前推进
- 用户明确要求跳转时，可直接进入目标阶段，但必须记录 `transition_reason`
- 任何写入正式内容前，必须存在当前阶段的最新有效产物
- 被导演审核退回时，阶段状态改为 `rejected`，并写明 `rollback_stage_id`
- 支持并行产物生成，但必须绑定所属主阶段

### 4. 关键门禁

- `script -> director_analysis`：必须存在非空剧本内容
- `director_analysis -> character_design/storyboard`：必须存在导演分析结论或显式豁免
- `character_design -> design_images`：必须存在结构化设定
- `storyboard -> storyboard_images`：必须存在结构化分镜条目
- `storyboard_images -> video_generation`：必须存在可用分镜图或显式降级说明
- `video_generation -> editing`：必须存在至少一个可播放视频片段

## 十三、后端数据结构与 API 草案

结合 DeerFlow 现有线程上下文、工具调用和 Gateway 业务层，建议先补一层“制片流程状态”数据模型，而不是把流程状态隐含在聊天消息里。

### 1. 核心数据结构

#### ProducerWorkflowState

```json
{
  "project_code": "demo",
  "episode_id": 1001,
  "current_stage": "storyboard",
  "overall_status": "in_progress",
  "active_run_id": "run_xxx",
  "last_decision": "continue",
  "next_stage": "storyboard_images",
  "updated_at": "2026-03-28T12:00:00Z"
}
```

#### ProducerStageRun

```json
{
  "run_id": "run_xxx",
  "project_code": "demo",
  "episode_id": 1001,
  "stage_id": "storyboard",
  "status": "completed",
  "owner_agent": "storyboard-artist",
  "input_snapshot": {},
  "output_summary": "已生成 12 条分镜",
  "rollback_stage_id": "director_analysis",
  "transition_reason": "normal_progression",
  "started_at": "2026-03-28T11:50:00Z",
  "finished_at": "2026-03-28T11:58:00Z"
}
```

#### ProducerArtifactRef

```json
{
  "id": "artifact_xxx",
  "stage_id": "storyboard_images",
  "type": "file",
  "target_id": "storyboard:3001",
  "title": "分镜图 #1",
  "excerpt": "女主进入房间的广角镜头",
  "meta": {
    "project_code": "demo",
    "episode_id": 1001,
    "url": "https://..."
  }
}
```

### 2. 建议接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/producer-workflow/{project_code}/{episode_id}` | 获取当前流程总状态 |
| POST | `/api/producer-workflow/{project_code}/{episode_id}/transition` | 发起阶段迁移 |
| POST | `/api/producer-workflow/{project_code}/{episode_id}/runs` | 创建阶段运行记录 |
| PATCH | `/api/producer-workflow/runs/{run_id}` | 更新运行状态、总结、回退信息 |
| POST | `/api/producer-workflow/runs/{run_id}/artifacts` | 绑定阶段产物 |
| POST | `/api/producer-workflow/{project_code}/{episode_id}/review` | 提交导演审核结论 |

### 3. 与 DeerFlow 的结合方式

- 对话线程继续由 DeerFlow thread 承载
- 制片流程状态、阶段运行记录、产物关系由外部业务编排层独立承载
- DeerFlow 只负责对话编排、工具调用和结果呈现，不承载业务域核心状态
- 工具调用结果写入外部流程记录，再同步回聊天区
- 引用统一使用结构化 `references`，不要只拼纯文本

### 4. 代码落点建议

- 不新增 DeerFlow harness 内业务工具，不把制片域逻辑放入 `packages/harness`
- 尽量不改 `deer-flow/backend` 现有目录结构和代码，只做配置式接入
- 新增外部业务编排层，项目名称固定为 `deerflow-producer`
- 建议路径：`c:\Work\pudding.v2\deerflow-producer\`
- 外部编排层内部再拆：
  - `api/`：给前端或业务侧调用的 HTTP 接口
  - `services/`：流程状态机、审核门禁、产物绑定
  - `mcp_server/`：暴露给 DeerFlow 的工具接口
  - `clients/`：访问业务系统、素材服务、生成服务
- 当前已按“现有工具方法外置化”开始落骨架：
-  - `clients/business_gateway.py`：统一承接对业务 backend `/api/v1/*` 与 `/api/v1/external/*` 的直接调用
  - `services/episode_tools.py`：承接剧本/灵感读取与保存方法
  - `services/subject_tools.py`：承接主体与主体变体方法
  - `services/storyboard_tools.py`：承接分镜 CRUD 方法
  - `services/generation_tools.py`：承接设定图/分镜图生成与按名称解析方法
  - `services/business_tools.py`：作为统一 façade，供后续 MCP/HTTP 适配层复用
- 原 `agent_business_tools.py` 中 21 个业务工具方法，现已全部在 `deerflow-producer` 中完成对应承载与 MCP 暴露
- DeerFlow 内置 `agent_business_tools.py` 已从配置与代码库中退场，主链路仅保留外置 `deerflow-producer` 版本
- `deerflow-producer` 已不再经过 DeerFlow gateway 的 `/api/agent-tools/*` 代理层，改为直连业务 backend API
- DeerFlow 与外部编排层优先通过 MCP 对接，避免把业务工具塞进 DeerFlow 后端
- 主智能体上下文注入继续沿用 `project_code`、`episode_id`、`scene`，必要时补 `current_stage`

对应参考：

- [HARNESS_APP_SPLIT.md](file:///c:/Work/pudding.v2/deer-flow/backend/docs/HARNESS_APP_SPLIT.md)
- [test_harness_boundary.py](file:///c:/Work/pudding.v2/deer-flow/backend/tests/test_harness_boundary.py)
- [producer_lead_agent/agent.py](file:///c:/Work/pudding.v2/deer-flow/backend/packages/harness/deerflow/agents/producer_lead_agent/agent.py)

### 5. 推荐接入方式

按侵入性从低到高排序：

1. **MCP 接入（推荐）**
   - 外部编排层提供 MCP server
   - DeerFlow 通过 `extensions_config` / MCP 配置接入工具
   - 优点：几乎不改 DeerFlow 后端代码，边界最清晰

2. **外部 HTTP API + 轻量工具适配**
   - 外部编排层提供 HTTP API
   - DeerFlow 仅保留极薄的一层工具声明或通过 MCP 包装
   - 适合 MCP 工具定义需要额外控制时使用

3. **直接写入 DeerFlow Gateway**
   - 仅在无法使用 MCP 且必须与 DeerFlow 网关统一鉴权时考虑
   - 该方案不作为默认推荐

## 十四、前端状态组件与交互契约

前端建议在导演工作台基础上，补一层“流程状态 UI”，而不是只保留编辑器和助手对话。

### 1. 页面最小组成

- 阶段条：展示 9 个阶段的当前状态
- 阶段面板：展示当前阶段输入、输出、审核结论、待办动作
- 对话面板：承载 DeerFlow 主智能体与专业智能体协作结果
- 产物面板：展示设定图、分镜图、视频片段和剪辑结果

### 2. 前端状态契约

```ts
type WorkflowStageStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "completed"
  | "failed"
  | "rejected"
  | "skipped";

type WorkflowStageItem = {
  stageId: string;
  title: string;
  status: WorkflowStageStatus;
  ownerAgent: string;
  canEnter: boolean;
  canRollback: boolean;
  summary?: string;
};
```

### 3. 关键交互

- 点击阶段：查看该阶段历史运行记录与产物
- 发起阶段：由制片智能体或人工触发阶段执行
- 审核放行：导演智能体给出通过/退回结论
- 回退重做：选择目标阶段并保留历史记录
- 打开引用：从聊天消息跳转到对应主体、分镜、文件或任务

### 4. 第一批 UI 改造建议

- 在导演页顶部增加阶段条与当前阶段摘要
- 在角色页、分镜页、视频页补充“所属阶段”和“阶段状态”
- 将现在的拼接式助手 prompt 逐步替换为结构化阶段动作
- 在消息渲染中展示 `references`，支持点击跳转

### 5. 前端代码落点建议

- 类型定义：新增 `frontend/src/core/producer-workflow/types.ts`
- API 封装：新增 `frontend/src/core/producer-workflow/api.ts`
- 阶段条组件：新增 `frontend/src/components/project-workflow/stage-bar.tsx`
- 阶段摘要组件：新增 `frontend/src/components/project-workflow/stage-summary.tsx`
- 首批接入页面：导演工作台页，在现有顶部区域上方插入阶段条
- 前端优先直连外部编排层的流程接口，不强依赖 DeerFlow backend gateway

对应参考：

- [types.ts](file:///c:/Work/pudding.v2/deer-flow/frontend/src/core/agents/types.ts)
- [api-client.ts](file:///c:/Work/pudding.v2/deer-flow/frontend/src/core/api/api-client.ts)
- [director page](file:///c:/Work/pudding.v2/deer-flow/frontend/src/app/projects/[projectCode]/director/[episodeId]/page.tsx)

## 十五、建议的实施顺序

为了降低改动风险，建议按“三步走”推进：

### 第一步：只加状态，不改主链路

- 在外部编排层新增流程状态对象与读取接口
- 前端先展示阶段条，不改原有生成按钮
- DeerFlow 主智能体先输出结构化阶段结论，但仍兼容现有对话方式

第一批代码任务：

1. 外部编排层新增流程状态查询接口
2. 外部编排层提供最小 MCP 工具：读取流程状态、写入阶段运行记录
3. 前端导演页加载并展示阶段条
4. 主智能体输出 `current_stage / next_stage / references`
5. 消息区先兼容展示结构化引用

### 第二步：把关键阶段接入门禁

- 接入导演审核与退回机制
- 将设定图、分镜图、视频生成结果写入阶段产物
- 把阶段跳转和回退变成显式操作

第二批代码任务：

1. 外部编排层新增审核提交接口与退回原因字段
2. 将设定图、分镜图、视频结果绑定到 `ProducerArtifactRef`
3. MCP 工具补充审核、阶段迁移、产物绑定能力
4. 在前端增加“通过/退回/重做”按钮

### 第三步：统一结构化编排

- 用结构化任务对象替代字符串拼 prompt
- 将角色、分镜、视频生成都接入统一阶段运行记录
- 让前端、后端、智能体共享同一套阶段状态定义

第三批代码任务：

1. 替换 `@美术设计师` 这类拼接式 prompt 触发
2. 将阶段动作改为显式 `action_type + payload`
3. 统一产物引用、任务状态、阶段推进日志
4. 将 DeerFlow 侧业务依赖收敛到 MCP 配置，不继续扩展 DeerFlow backend 业务代码

## 十六、冻结实施计划

本节用于冻结后续实现方向，避免开发过程中边做边改、职责漂移。

### 1. 最终架构结论

- `producer_lead_agent` 保留在 DeerFlow 内，作为制片对话编排入口
- 制片流程状态机、业务规则、审核门禁、产物绑定全部外置
- 外置业务编排层通过 MCP 接入 DeerFlow
- 前端流程状态优先读取外部编排层，不依赖 DeerFlow backend 承载业务状态
- `deerflow-producer` 的定位是“业务编排核心”，不是必须永久独立部署的第三个服务
- 未来若收敛为“一个前端 + 一个后端”，`deerflow-producer` 应作为后端内嵌模块复用，而不是推倒重做

### 2. 明确保留在 DeerFlow 内的内容

- `producer_lead_agent` 本体
- DeerFlow 通用 middleware、model factory、thread runtime
- MCP 接入配置与工具发现能力
- 主智能体上下文注入与结构化输出能力

### 3. 明确外置到业务编排层的内容

- `ProducerWorkflowState`
- `ProducerStageRun`
- `ProducerArtifactRef`
- 阶段迁移规则
- 审核通过/退回逻辑
- 角色/分镜/视频等业务工具
- 业务 API 聚合与外部服务 client
- 可嵌入后端复用的核心 service / contracts / state machine

### 4. 明确不做的事情

- 不把新的制片域工具继续写进 `packages/harness`
- 不继续扩展 DeerFlow backend 为制片业务中台
- 不把流程状态继续塞在聊天文本里隐式维护
- 不在没有外部编排层的前提下直接做完整前端流程改造
- 不把 `deerflow-producer` 设计成只能独立部署、无法嵌入业务后端的形态

### 5. 固定阶段计划

#### Phase 1：外部编排层最小可用

目标：

- 建立外部 `deerflow-producer`
- 提供流程状态读取接口
- 提供最小 MCP 工具

交付物：

- `GET /producer-workflow/{project_code}/{episode_id}`
- MCP 工具：`get_producer_workflow_state`
- MCP 工具：`create_stage_run`
- MCP 工具：`update_stage_run`
- `deerflow-producer` 代码结构拆分为 core + adapters
- DeerFlow 通过 `extensions_config.json` 注册 `deerflow-producer` MCP server

验收标准：

- DeerFlow 不新增业务工具文件
- 主智能体可以读取外部流程状态
- 前端可以独立读取阶段条数据
- 业务核心逻辑不写死在 FastAPI 或 MCP 适配层中

#### Phase 2：门禁与产物接入

目标：

- 接入导演审核
- 接入产物绑定
- 支持回退与重做

交付物：

- 审核接口
- 产物绑定接口
- MCP 工具：`submit_stage_review`
- MCP 工具：`bind_stage_artifact`
- MCP 工具：`transition_workflow_stage`

验收标准：

- 阶段放行有明确通过/退回结果
- 设定图、分镜图、视频片段可挂载到阶段记录
- 回退动作具备 `rollback_stage_id`

#### Phase 3：结构化动作替换

目标：

- 替换字符串拼接 prompt
- 统一阶段动作协议
- 统一引用与日志

交付物：

- 结构化 `action_type + payload`
- 结构化 `references`
- 前端支持从消息跳转到阶段产物与业务对象

验收标准：

- 不再依赖 `@美术设计师` 这类自由文本触发核心业务动作
- 前后端、外部编排层、主智能体使用统一阶段定义

### 6. 变更控制规则

- 若某项需求需要把制片域逻辑写回 DeerFlow backend，默认视为偏离方案
- 若某项需求无法通过 MCP 或外部编排层完成，先记录问题，再单独评审
- 若需要调整阶段模型，先改文档，再改代码，不允许先实现后补文档
- 每一阶段完成后，先做验收，再进入下一阶段

### 7. 下一步唯一开工项

从现在开始，唯一默认开工项为：

- 创建外部 `deerflow-producer` 最小骨架
- 定义流程状态接口
- 定义第一批 MCP 工具
- 保持 `deerflow-producer` 可独立部署，也可被未来业务后端直接嵌入

在这三项完成前，不启动第二批或第三批改造。

### 8. 当前已落地的 Phase 1 / Phase 2 形态

- 外部项目路径固定为 `c:\Work\pudding.v2\deerflow-producer\`
- 项目结构已按 `core + adapters` 组织
- DeerFlow MCP 配置文件已预留/接入 `deerflow-producer`
- 当前实际生效的 DeerFlow MCP 配置路径为 `c:\Work\pudding.v2\deer-flow\backend\extensions_config.json`
- `producer_lead_agent` prompt 已补充 workflow 工具使用规则，并明确了 artifact / review / transition 的调用顺序
- 当前 MCP server 启动方式固定为：
  - `python -m deerflow_producer.mcp_server`
  - `PYTHONPATH=c:\Work\pudding.v2\deerflow-producer\src`
- 当前已补充 Phase 2 工具：
  - `deerflow-producer_bind_stage_artifact`
  - `deerflow-producer_submit_stage_review`
  - `deerflow-producer_transition_workflow_stage`
- 当前已补充第一批“现有业务工具外置 MCP 映射”：
  - `deerflow-producer_get_episode_script`
  - `deerflow-producer_get_episode_idea`
  - `deerflow-producer_get_episode_director_analysis`
  - `deerflow-producer_get_project_subjects`
  - `deerflow-producer_get_episode_storyboards`
  - `deerflow-producer_save_episode_script_draft`
  - `deerflow-producer_apply_episode_script_draft`
  - `deerflow-producer_save_episode_script`
  - `deerflow-producer_save_episode_director_analysis`
  - `deerflow-producer_create_subject`
  - `deerflow-producer_update_subject`
  - `deerflow-producer_delete_subject`
  - `deerflow-producer_create_subject_variant`
  - `deerflow-producer_update_subject_variant`
  - `deerflow-producer_delete_subject_variant`
  - `deerflow-producer_create_storyboard`
  - `deerflow-producer_update_storyboard`
  - `deerflow-producer_insert_storyboard`
  - `deerflow-producer_delete_storyboard`
  - `deerflow-producer_generate_subject_image`
  - `deerflow-producer_generate_storyboard_image`
  - `deerflow-producer_generate_image_by_name`
- `producer_lead_agent` 已开始在工具装配阶段使用通用规则：若存在同名 `deerflow-producer_*` 外置 MCP 工具，则自动移除内部同名工具，不再维护硬编码业务工具名单
- 导演页发送消息时，已通过前端 `context` 透传基础运行上下文与业务环境快照，包括：
  - `project_code / episode_id / scene / active_tab`
  - `project_settings`
  - `project_subjects`
- 兼容层与 embedded client 已把上述 context 继续写入 `RunnableConfig.configurable`，供 `producer_lead_agent` system prompt 注入运行环境
- 已开始执行 Phase 3 首批替换：
  - 导演页“生成设定图”从 `@美术设计师` 文本拼接改为结构化 `action_type + payload`
  - 导演页“生成分镜图”从自由文本触发改为结构化阶段动作消息
  - 助手面板统一把 queued action 序列化为结构化 JSON 消息再发送给 `producer_lead_agent`
  - 结构化消息已补充 `workflow` 与 `tool_hints`，减少自然语言猜测
  - `producer_lead_agent` 已明确约定优先按 `action_type / workflow / references / payload` 解析动作
  - 消息列表已开始把结构化动作渲染为可识别卡片，并支持点击 `references` 切换到对应导演页 tab
- 已验证 Phase 2 最小链路：
  - 创建 `script` 阶段 run
  - 绑定剧本草稿 artifact
  - 提交导演审核通过
  - 显式迁移到 `director_analysis`
- 已验证 DeerFlow backend 能发现 3 个 Phase 1 工具：
  - `deerflow-producer_get_producer_workflow_state`
  - `deerflow-producer_create_stage_run`
  - `deerflow-producer_update_stage_run`
- 当前 DeerFlow backend 总计可发现 27 个 `deerflow-producer` MCP 工具
- 该形态既支持当前独立部署，也支持未来作为业务后端内嵌模块复用

## 十七、结论

制片智能体的核心价值不是“回答得像人”，而是“把创作流程稳定推进到可交付结果”。  
后续开发应始终围绕“阶段、状态、产物”三件事展开，避免退化为纯对话助手。
