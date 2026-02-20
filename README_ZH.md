# OpenClaw Gemini Gateway (gemini-cli-claw) v0.1

这是一个专用的网关（适配器），旨在将 OpenClaw 强大的自主驱动系统与 Google 官方的「[Gemini CLI](https://github.com/google-gemini/gemini-cli)」**直接且安全地**连接起来。

**支持的操作系统: Linux / macOS / Windows**  
*(※ 截至 v0.1，全面验证的测试仅在 Linux 环境中完成。虽然内置了面向 Windows 和 macOS 的运行机制，但可能会出现预期之外的运行情况。)*

## 🌟 开发背景与目的
近年来，未经授权提取 Gemini（或类似服务）内部 Google OAuth 身份验证令牌并随意滥用于其他非官方工具的「身份验证滥用（Token Stealer）」现象曾一度泛滥。然而，Google 已经开始严厉检测这些违规访问模式，**因违规使用令牌而导致用户的 Google 账号直接被 Ban（封禁处理）的案例**正在不断增加。

本项目**彻底抛弃了「盗用身份验证信息」这种极度危险的方法**，而是采用了一种全新的架构：让 OpenClaw 系统直接启动并操控「已安装在用户环境中的真正官方 Gemini CLI 进程」作为其后端。
由于所有的推理和工具调用都只通过安全的官方工具进行，因此您可以在**零账号冻结风险**的前提下，完美结合 OpenClaw 的自主驱动功能与 Gemini 强大的 AI 算力。

## ✨ 主要优势与功能

### 1. 免费构建强大的 AI 助手
完全不需要申请需要按量付费的 API Key。您只需使用个人的 Google 账号登录官方的 Gemini CLI，即可**完全免费**地体验强大的自主型智能代理（Agent）环境。

### 2. 原生支持 Google 搜索网络溯源 (Grounding)
由于直接利用了官方的 Gemini CLI，无需昂贵的付费 API，您就能充分发挥其内置的**Google 搜索（Grounding）**能力。AI 代理可以在完成任务时实时访问最新的网页信息。

### 3. 多模态支持 (Multimodal)
完美继承了 Gemini 强大的多模态能力。它自带支持读取并分析本地图像等复杂的高级推理任务。

### 4. 与 OpenClaw 技能及工具生态完全兼容
在 OpenClaw 中定义的所有自定义技能（`SKILL.md`）和工具集，都会通过本适配器安全且精准地传递给 Gemini CLI。
本项目的存在，将本来只是一个简单聊天工具的 Gemini CLI，硬核升格为了一个能自动修改代码文件、执行命令、并基于心跳（Heartbeat）定期自启执行任务的**「全自动自主驱动型代理（Autonomous Agent）」**。

### 5. 通过虚拟主目录实现的「技能纯净隔离隔离」
由于 Gemini CLI 的原始设计机制缺陷，它通常会无条件跨目录加载本地存在的所有全局技能，从而导致上下文污染。本适配器在每次执行时，会动态生成一个临时的**虚拟主目录（GEMINI_CLI_HOME）**，并仅仅通过符号链接或目录挂载的方式，将成功通过 OpenClaw 沙盒验证的安全技能注入其中。这种极其严苛的物理隔离，实现了极其安全的智能体沙箱控制。

### 6. 由 AI 自身驱动的「提示词自我进化 (Self-Optimization)」
系统核心提示词的框架被分离为一个独立的 Markdown 文件（`adapter-template.md`）。因此，您可以直接向 Gemini CLI 下达这样的指令：“请读取你自己的系统提示词配置文件，分析它并重写保存，以此让你成为一个更优秀的自主智能体”。**让 AI 可以自行分析自我行为准则，无需人类编写任何一行代码，即可完成持续进化的壮举！**

## 🚀 架构原理

```text
OpenClaw 守护进程
    │  (stdin/stdout)
    ▼
adapter.js          ← 将 OpenClaw 的上下文转换为 Gemini CLI 可识别的提示词，并设置环境变量隔离启动
    │  (子进程)
    ▼
Gemini CLI          ← 作为官方工具执行推理及安全调用工具
    │  (MCP stdio)
    ▼
mcp-server.mjs      ← 将 OpenClaw 的原生工具（如发送 Slack、定时任务等）通过 MCP 协议反向提供给的 Gemini CLI
    │  (import)
    ▼
OpenClaw tools
```

## 📁 文件结构

| 文件名 | 职能 |
|---|---|
| `adapter.js` | OpenClaw ↔ Gemini CLI 之间的核心通讯桥梁（CJS 格式） |
| `adapter-template.md` | 发送给 Gemini CLI 的动态提示词模板（AI 可对其进行自我优化） |
| `mcp-server.mjs` | 通过 MCP 暴露 OpenClaw 工具的服务端组件（ESM 格式） |
| `setup.js` | 跨平台的自动化安装脚本 |
| `package.json` | 核心依赖项（`@google/gemini-cli`, `@modelcontextprotocol/sdk`） |

## 📥 极简傻瓜式安装（彻底免除环境依赖）

为了将用户的部署成本降到极致的**绝对零度**，本网关内置了极其强大的全自动构建脚本（`install.sh` / `setup.js`）。
※ 甚至当您的系统中连 Node.js 都没有安装时，`install.sh` 脚本都会自动检测缺失并通过 NVM 自动下载部署。**用户无需进行任何考前准备！**

**自动配置向导**

### 🍏🐧 macOS / Linux 环境

```bash
# 1. 克隆代码库并进入文件夹
git clone <openclaw-repo>
cd openclaw/gemini-cli-claw

# 2. 运行一键全自动安装程序
./install.sh
```

### 🪟 Windows 环境

```cmd
:: 1. 克隆代码库并进入文件夹
git clone <openclaw-repo>
cd openclaw\gemini-cli-claw

:: 2. 运行一键全自动安装程序
install.bat
```

---

执行指令后，安装引导程序将会**全程对话并彻底全自动**地为您打理好下列一切任务：
1. **自动检测并安装 Node.js**（仅当环境缺失时）
2. 多语言选项支持（提供日文 / English 界面）
3. 自动检测并编译构建 OpenClaw 本体
4. 为本适配器（Gemini Backend）安装必要的 npm 依赖
5. 自动探测 `~/.openclaw/openclaw.json` 并注册写入 `gemini-adapter` 后端映射
6. 安全检查 Gemini CLI 登录验证状态，并提供免浏览器扫码授权的支持协助

## ⚙️ 详细的整合规范说明

如果您此时正在准备把本仓库整合进一台**已经自行部署好 OpenClaw**的现有开发机器中，其融合逻辑及影响如下说明。

### 1. 项目文件夹的准确位置
本代码库目录（`gemini-cli-claw`）必须且只能被放置在**与 OpenClaw 根目录平级相邻的地带（其直接下属目录）**中。
一旦放置完毕，安装文件（`setup.js`）在被触发时会智能识别它所处层级的“上一层（`..`）”作为 OpenClaw 服务核心来执行构建检验。

✅ **正确的层级结构示例**:
```text
openclaw/
├── src/
├── package.json
└── gemini-cli-claw/   <-- 放置于此处！
    ├── adapter.js
    ├── install.sh
    └── package.json
```

### 2. 对于全局配置文件 (`openclaw.json`) 的安全调整
当您敲下命令触发安装器时，安装程序会自动解析本网关在您机器上的绝对路径，并安全地在您的 OpenClaw 全局管理文件（`~/.openclaw/openclaw.json`）内自动追加下方提供商设定块。

```json
{
  "agents": {
    "defaults": {
      "cliBackends": {
        "gemini-adapter": {
          "command": "node",
          "input": "stdin",
          "output": "text",
          "systemPromptArg": "--system",
          "args": [
            "/此处为您网关路径的绝对路径/openclaw/gemini-cli-claw/adapter.js",
            "--session-id",
            "{sessionId}",
            "--allowed-skills",
            "{allowedSkillsPaths}"
          ],
          "resumeArgs": [
            /* 同上 */
          ]
        }
      }
    }
  }
}
```

※ 得益于上方模块化且精确无误的 JSON 追加写入设计，OpenClaw 可以由此刻起清晰地知道：“只要我需要呼叫 `gemini-adapter`，我就带着核心参数调用刚才绝对路径下分配的那一个基于 Node.js 承载的 `adapter.js`”。该自动操作具有幂等性保障，绝对不会对您现有的其余定制化配置造成任何穿透性毁坏。

## 🎮 使用方法详情

### 进行一次简单的即装即用测试实验
配置完毕后，要想快速确认其自身通过 Gemini CLI 连接渠道是否健康达标，请返回位于 OpenClaw 的基础根文件夹下（`openclaw/`），并通过提供 `--local` 临时标志启动命令来进行快速小样检验。

```bash
node scripts/run-node.mjs agent -m "你好" --local
```

### 将其全面设置为常驻的深度推理引擎
如果想彻底切断与昂贵 API 提供商的链路绑定，并全局无缝切换将 Gemini 设置为所有渠道的供能基础，只需找到配置文件 `~/.openclaw/openclaw.json` 里的根选项，补充如下属性。

```json
{
  "agents": {
    "defaults": {
      "provider": "gemini-adapter"
    }
  }
}
```

一旦重启 OpenClaw 后台守护进程，一切包括从即时消息平台接入点（Telegram, Signal）、自动化 Cron 系统监控定时器或者是其内部独立的自持续链思考（Session）动作的底层动力 —— **都会被彻底地、免费地永久切换为以我们打造的，极为强悍健硕的 `Gemini CLI` 为唯一思考基座来驱动运行！**

## 内置提供 MCP 扩充组件 (Tools) 解析参考

Gemini CLI 底座引擎启动期间，经由核心服务器代理提供（`mcp-server.mjs`）可以完美互通唤醒并使用的 OpenClaw 高级专属定制化动作套件组:

| 工具名称标识 | 发动机指令说明 |
|---|---|
| `message` | 下发通知警报，送达跨平台渠道 (如 Discord / Telegram) |
| `cron` | 编排登记日历自动执行脚本与持久化长效提醒 |
| `sessions_send` | 实现不同平行隔离空间执行单元下的定向消息输送与协作通联 |
| `sessions_spawn` | 下达最高级别命令裂变孵化全新的常驻脱管后台（下属探员/执行子任务特供隔离槽） |
| `subagents` | 上位监控监管模式启动管理收容旗下所有执行子生命周期 |
| `web_search` | 内服嵌入式集成对接 Brave Search API 的顶级高速无头（Headless）内容精准情报搜索 |
| `web_fetch` | 脱壳拉取纯净化远程目标 URL 的干预式访问阅读内容收集 |
| `memory_search` | 自治体长链知识与片段情感库深度矢量词法映射查找与调用召回提取 |
| `gateway` | 安全层级网关接口调整并重新自律发包刷新自重启系统服务 |

*(注：鉴于部分套件重叠原因，Gemini CLI 原厂本身就已经能实现甚至做得很逆天的文件原生写读，和终端本地 CLI 指令触发动作诸如 (`read`, `write`, `exec`) ，已在网关连接端实施动态主动脱敏截断。由此，双通道环境互撕，相互冲突争夺的覆辙也随之得到了干净地断绝隔离)*

## 特色高阶微调化设置 (Customization)

### 深层改写原始控制系统核心底层指示
你只要简简单单地修改下同处于代码库中的 `adapter-template.md`，就能毫不费力，一键随心所欲自由调整更替 Gemini CLI 本体展现出来的角色情感性格偏好以及响应倾向特征。
它最具灵魂价值的设计甚至允许：由于核心代码架构的物理分离特性，你完全可以大方地请 Gemini CLI 它自己通过内网扫描自身文件内容机制，通过解析 `adapter-template.md` 进而自行完善迭代它本源最核心的智能中枢行为逻辑体系。（极客俗称这种方式为：“左脚踩右脚上天的”「系统模块的无缝自动对撞和繁华自己自足进化式升华 (Auto-Self-Optimization)」）

### 动态可变的环境提示词占位符预留位解析表

| 占位符引用记法 | 后端核心最终会实时覆盖嵌入替换的模块内容 |
|---|---|
| `{{PROVIDED_SYSTEM_PROMPT}}` | 由 OpenClaw 视当下执行情况实时热重载下发填充的心智驱动上下文内容流 |
| `{{WORKSPACE}}` | 运行期绝对追踪锁定的物理执行磁盘落脚定标点工作目录 |
| `{{HEARTBEAT_PROMPT}}` | 映射心跳系统指令时赋予它的执行任务及动作偏好的宏命令 |
| `{{HEARTBEAT_CONTENT}}` | 在本机文件夹侦测读取上浮供他消费吸收的 HEARTBEAT.md 生物质上下文文本体 |
