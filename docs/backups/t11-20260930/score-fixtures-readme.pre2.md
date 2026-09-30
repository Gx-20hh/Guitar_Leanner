# tests/score-fixtures — GP 谱例与生成器（T11）

## 当前状态（如实）

**真实 GP5 二进制谱例：阻塞。** 本环境无法取得可被 alphaTab 解析的真实 GP5 样本：

- 网络：`pip` 各镜像（官方/清华/阿里/豆瓣）均无 `guitarpro` 包；`git` 直连 github/gitee 被墙；
  GitHub API 遇未认证限额；raw 探测 alphaTab 仓库的测试谱路径均 404。
- 本目录 `out.gp5` 为自产、未知内容已知的 GP5 二进制（`gen_fixtures.py` 生成），
  **但尚未通过 alphaTab 解析**（GP5 头/结构存在偏移问题未收敛），因此不能作为验证用谱例。

`frontend/src/parser/import-from-file.test.ts` 中"二进制谱例 → ISR"测试因此以 `it.skip` 保留并注明原因，
取消跳过即执行真实谱例验证。

## 生成器

- `gen_fixtures.py`：按 alphaTab 1.8.4 `Gp3To5Importer`（alphaTab.core.mjs）字节布局手写 GP5 写出；
  用于产出内容已知、自产无许可问题的谱例。**目前产物未通过 alphaTab 解析，属未收敛草稿，勿作验收依据。**

## 如何提供一个真实谱例以解除阻塞（给负责人/用户）

放一份受授权/自制的 `.gp5`（及可选 `.gp`）到本目录，并在 `import-from-file.test.ts` 把 `it.skip` 改为 `it`，
再按 pi 规则记录：来源、授权、格式、哈希、解析器版本、适配器版本（框架 §6.1）。

## Git 忽略

根 `.gitignore` 忽略 `*.gp*`，但对 `tests/score-fixtures/*.gp5`、`*.gp3/4/5/gpx/gp` 放行（授权测试目录例外），
与用户曲库隔离（不回放用户文件）。
