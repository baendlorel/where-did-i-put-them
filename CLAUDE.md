# CLAUDE.md

## 项目

**拾间 / Who Did I Put Them（命令 `wdipt`）**：Vue 3 + Three.js 的居家平面建模、多层 3D 自动建模与物品记忆工作台。Fastify 后端通过 WebSocket 同步整个 workspace。

- monorepo：pnpm workspace
- 前端：`apps/web`（Vue 3、Canvas 2D、Three.js）
- 后端：`apps/server`（Fastify、`@fastify/websocket`、`better-sqlite3`、CLI `wdipt`）
- 共享层：`packages/shared`（类型、几何、搜索、演示数据）
- 构建：根目录 `tsdown` + Vite；脚本统一放在 `scripts/`，使用 TypeScript，不写 shell 脚本
- 运行时：Node.js >= 22（`better-sqlite3` 13 的要求）

## 版本基线与兼容策略

**当前基线：**

| 项目 | 版本 |
| --- | --- |
| 根 `package.json` | `0.1.0` |
| 发布包 `apps/server` / `wdipt` | `0.1.0` |
| Workspace schema | `1` |
| SQLite | `better-sqlite3` 13 / SQLite 3.53.4 |
| 发布状态 | 尚未发布到 npm |

**每次开始任务先检查版本：** 读取根 `package.json` 和 `apps/server/package.json`，与上面的基线比较 `major.minor`。

- 如果 `major.minor` **发生变化**（例如 `0.1.0 → 0.2.0` 或 `1.0.0`），**先询问用户是否需要兼容旧版本**，在得到答复前不要自行加入兼容层或破坏性 schema/API 变更。
- 如果只有 patch 变化（例如 `0.1.0 → 0.1.1`）或版本没变，按“未发布项目”处理：直接改到最新设计，不做运行时兼容。
- 用户明确要求“别做兼容层”时，只允许一次性数据迁移脚本，不允许运行时同时接受新旧 schema。
- 发布或用户做出兼容决策后，更新本文件的“版本基线与兼容策略”。

**硬规则：**

1. 不做运行时双格式兼容。旧 schema 请求直接拒绝，旧文件通过一次性脚本迁移后归档。
2. 当前 `Workspace.schemaVersion` 固定为 `1`。未发布阶段的 breaking 改动继续使用 `1` 并写一次性迁移，不要为了“看起来正式”随意升 schema。
3. 如果 package 的 `major.minor` 变了但用户没有明确说兼容，**不要猜**，先问。

## 常用命令

```bash
pnpm install
pnpm dev                  # 先构建 shared，再用 pnpm --parallel 启动 server + web
pnpm build                # shared -> web -> wdipt(tsdown) -> 装配 dist/web
pnpm start                # node apps/server/dist/cli.js
pnpm typecheck            # 3 个 workspace 包 + scripts
pnpm test                 # shared 11 项 + server 10 项
pnpm migrate:legacy       # project.json 一次性迁移到 workspace.json
pnpm migrate:json         # workspace.json 一次性迁移到 wdipt.db
pnpm pack:npm             # 构建、校验并生成 release/wdipt-0.1.0.tgz
pnpm publish:npm          # 发布 tarball 到 npm（需要 npm 登录）
```

- 开发前端：<http://localhost:5173>
- 开发后端：<http://127.0.0.1:8787>
- 发布 CLI：`npx wdipt` / `wdipt`
- 仓库内数据：`apps/server/data/wdipt.db`
- npm CLI 数据：`~/.wdipt/wdipt.db`
- 旧 JSON：`workspace.json` / `project.json`，只用于迁移，不参与运行时
- 发布 tarball：`release/wdipt-0.1.0.tgz`

## 数据模型

```ts
Workspace {
  schemaVersion: 1
  id, revision, updatedAt
  houses: House[]
}

House {
  id, name
  floors: FloorPlan[]
}

FloorPlan {
  id, name, level
  shapes, walls, openings
  furniture, stairs
}
```

- 坐标单位：米；平面 `y` 在 Three.js 中对应 `z`；旋转角取反。
- 楼层高度：`FLOOR_HEIGHT = 2.85`。
- `level` 从 0 开始；楼层按 `level` 排序，删除后重新编号。
- 每件家具/房间容器都带 `items: StoredItem[]`。
- 楼梯属于它所在的楼层，默认升向 `level + 1`；上层地板在楼梯足迹处切洞。
- 同一个 workspace 内的家具/墙/开口 ID 应保持唯一；复制楼层时重新生成墙、门窗和图形 ID。

### SQLite 表

- `workspace_meta`：单行，schemaVersion / revision / updatedAt
- `houses`：`deleted_at IS NULL` 为正常，非空为回收站
- `floors`：`data` 列存 shapes/walls/openings/furniture/stairs
- `delete_challenges`：4 位验证码，5 分钟有效

回收站不属于可同步的 `Workspace`，由 server 单独管理。普通 workspace 保存不能删除住宅，必须走 `/api/houses/:id/trash`。

## API 与同步

- `GET /api/workspace`
- `PUT /api/workspace`（只接受 `schemaVersion: 1` + `houses[]`，不能移除住宅）
- `GET /api/health`
- `GET /api/search?q=...`
- `GET /api/trash`
- `POST /api/houses/:id/trash`
- `POST /api/trash/:id/restore`
- `POST /api/trash/:id/challenge`
- `DELETE /api/trash/:id`（body: `challengeId`, `code`）
- WebSocket：`/ws`
  - client → `hello`、`workspace:update`、`ping`
  - server → `welcome`（含 `workspace` + `trash`）、`workspace:ack`、`workspace:updated`、`trash:updated`、`presence`、`pong`、`error`
- 保存采用完整 workspace 快照；前端 450ms 防抖，失败回退 `PUT /api/workspace`。

## 一次性迁移

### 旧单住宅 JSON

`scripts/migrate-legacy.ts` 只处理旧单住宅 `project.json`：

- 读取 `apps/server/data/project.json`
- 生成当前 schema 的 `apps/server/data/workspace.json`
- 旧文件归档为 `project.legacy.json`
- 目标已存在时拒绝覆盖，`--force` 才覆盖
- 支持 `--from` / `--to`

### JSON -> SQLite

`scripts/migrate-json-to-sqlite.ts`：

- 读取当前 schema 的 `workspace.json`
- 写入 `apps/server/data/wdipt.db`
- 默认把 JSON 归档为 `workspace.legacy.json`
- 数据库已有 workspace 时拒绝导入
- 支持 `--from` / `--data-dir` / `--keep-json`

运行时只读取 SQLite。如果只检测到 JSON 而没有数据库，服务器会拒绝启动并提示迁移；不要在 server 里加 JSON 回退。

## 当前功能约定

- 右上角「我的房子」菜单：新建、切换住宅；每栋房子独立。
- 删除当前住宅会进入回收站；回收站可恢复；永久删除必须显示并输入服务端生成的 4 位验证码。
- 至少保留一栋正常住宅；最后一栋不能删除。
- 顶部楼层条：切换、复制当前层、新建空白层、删除当前层。
- 左侧结构工具：墙体、门、窗、楼梯（快捷键 `S`）。
- 3D 支持「整栋 / 当前层」视图；整栋按层高堆叠，当前层只显示活动楼层。
- 搜索跨住宅和楼层；点击结果自动切换住宅/楼层、选中家具、聚焦相机并高亮。
- 2D 上层楼会显示下层楼梯形成的虚线“楼梯洞口”。
- 所有 UI 文案使用中文；代码标识使用英文。

## 已知坑与处理方式

### Vue 响应式对象不能用 structuredClone

`state.workspace` 是 Vue reactive proxy，`structuredClone` 会抛 `DataCloneError`。历史快照使用：

```ts
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
```

### Three.js 必须先更新矩阵再算包围盒

新增楼层组后马上调用 `Box3.setFromObject` / `BoxHelper`，如果父级 `matrixWorld` 没更新，会把高层家具算到 y=0。构建 house 后必须：

```ts
scene.add(house.root);
house.root.updateMatrixWorld(true);
```

再执行选中框、高亮环、标签定位。

### 3D 换房与换层不是同一种更新

- 切换住宅：必须重建场景，否则新房子会叠在旧房子上。
- 切换楼层：只切换 floor group 的 `visible`，不要重建。
- 监听 `state.workspace.houses`，不要监听整个 workspace；revision/updatedAt 变化不应导致重建。

### 楼梯方向

2D 的 `UP` 箭头指向 `-y`（平面上方），3D 踏步也必须朝 `-z` 升；上层地板洞口用 `stairFootprint` 的减法。修改楼梯几何时同时检查 2D 箭头、3D 踏步和洞口方向。

### 删除楼层

删除楼层时，同时清空下一层通往该层的楼梯；删除后重新编号 `level` 和 `name`。

### tsdown 与 dev server

`pnpm build` 会重建 shared 的 `dist`。如果 `pnpm dev` 正在运行，tsx watch 会看到 shared `dist` 被删除并崩溃。不要在 dev server 运行时执行 build；如果不小心执行了，重启 `pnpm dev`。

### 弹层与 headless 截图

Playwright + SwiftShader 下 CSS transition 可能延迟或卡住，导致截图看起来“弹层没打开/没关闭”。关键菜单和搜索层不要依赖离开动画；Vue Transition 只用于装饰性入场。截图脚本必须等待足够时间并检查 console/pageerror。

### 数据和静态资源路径

- 开发/仓库：`WEB_DIST` 回退到 `apps/web/dist`，数据目录 `apps/server/data`。
- npm 包：`webRoot` 为包内 `dist/web`，数据目录回退到 `~/.wdipt`。
- 修改 `apps/server/src/app.ts` 的路径逻辑时同时验证 `pnpm start` 和打包后的 CLI。

### better-sqlite3

- 原生依赖；`pnpm-workspace.yaml` 的 `allowBuilds` 和 `onlyBuiltDependencies` 必须允许 `better-sqlite3`，否则运行时报找不到 binding。
- 已在根 `engines` 和 server `engines` 设为 Node >= 22。
- 数据库文件 `wdipt.db` 使用 WAL，会同时出现 `-wal` / `-shm`，都已 gitignore。
- `tsdown` 必须把 `better-sqlite3` 放在 `neverBundle`，不能打进 ESM bundle。
- 测试或脚本打开 DB 后必须 `close()`，否则 Windows 上删除临时目录可能失败。

### 回收站与永久删除

- 住宅删除只能通过 `POST /api/houses/:id/trash`；不要允许普通 workspace PUT 移除住宅。
- 永久删除挑战由服务端 `crypto.randomInt(1000, 10000)` 生成，存 `delete_challenges`，5 分钟有效；不要把验证码生成搬到客户端，也不要在客户端直接删 DB/数组。
- 至少保留一栋正常住宅。
- 删除住宅后服务端会 bump revision；永久删除只改变回收站，不改 active workspace。
- 前端回收站状态来自 `/api/trash` 和 WS `trash:updated`，不属于 `Workspace` 快照。

## 开发与验证流程

1. 先读 `CLAUDE.md`，检查 package 版本基线。
2. 查看当前数据 schema 与 API；不在未获批准时加兼容层。
3. 修改 shared 类型 → server validation/store → web store/components → tests。
4. 运行：

```bash
pnpm typecheck
pnpm test
pnpm build
```

5. 如果涉及发布/CLI，运行 `pnpm pack:npm`，最好在临时目录安装 tarball 并验证：
   - `wdipt --version`
   - 首页 200
   - `/api/workspace` schema 正确
   - WebSocket welcome
6. 结束时停止所有后台 dev/生产服务，检查 5173/8787 端口无残留。

## 不要做

- 不要为了“兼容”保留双 schema、双 API、双 WS 消息名。
- 不要在未询问用户的情况下为 major/minor 变化添加兼容代码。
- 不要用 shell 脚本承载复杂构建/迁移逻辑；使用 `scripts/*.ts`。
- 不要重新引入 `concurrently`；pnpm 自带 `--parallel`。
- 不要把 tsdown 装到各子包；统一根目录，子包通过 pnpm 解析。
- 不要在 Vue reactive 数据上使用 `structuredClone`。
- 不要把 `project.json` 或 `workspace.json` 的运行时回退重新加回来。
