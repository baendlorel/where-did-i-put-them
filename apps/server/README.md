# wdipt

**拾间 · Where Did I Put Them** — 用平面图搭建住宅、自动生成 3D 模型，并记住每件物品放在哪里。

一条命令启动完整应用（Fastify 后端 + Vue / Three.js 前端静态资源）。

## 使用

```bash
# 不安装，直接运行
npx wdipt

# 或全局安装
npm install -g wdipt
wdipt
```

启动后打开 <http://127.0.0.1:8787>。默认监听 `0.0.0.0`（局域网可访问）；只在本机使用可加 `--host 127.0.0.1`。

```bash
wdipt --port 9000
wdipt --host 127.0.0.1
wdipt --data-dir ./my-home-data
wdipt --help
wdipt --version
```

| 参数 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--port` | `PORT` | `8787` | HTTP 端口 |
| `--host` | `HOST` | `0.0.0.0` | 监听地址 |
| `--data-dir` | `DATA_DIR` | `~/.wdipt` | 项目 JSON 持久化目录 |
| `--web-dist` | `WEB_DIST` | 包内 `dist/web` | 自定义前端目录 |

首次运行会在数据目录生成一套「梧桐宅 · 85㎡」示例住宅。数据通过 `project.json` 保存；WebSocket 实时同步多个窗口。

## 功能

- 平面模式：矩形 / 椭圆地面的融合与挖除、墙体、门窗、家具
- 立体模式：根据平面自动生成墙体、门窗洞口、地板与程序化家具
- 每件家具拥有独立物品数组，可记录名称、数量、备注
- `Ctrl / ⌘ + K` 全局查找物品，平面 / 立体视图同步高亮
- WebSocket 自动保存与多窗口协同

完整文档、开发方式和架构说明见仓库根目录的 `README.md`。
