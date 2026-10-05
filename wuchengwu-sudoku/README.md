# 团团 5×5 数独（wuchengwu-sudoku）

7×7 版的 5×5 变体：每行、每列填入 1–5 各一次，没有宫格。玩法、界面、三档难度、计时、判错、撤销、擦除、笔记、提示、检查、完成判定与 7×7 一致，只是棋盘尺寸参数化为 5，格子和数字键更大，方便小朋友点按。

**线上地址：** <https://crazyhb.github.io/wuchengwu-sudoku/>

## 目录

| 路径 | 说明 |
| --- | --- |
| `index.html` | 构建产物：单文件，可直接打开或部署（`build.mjs` 生成，请勿手改） |
| `src/engine.js` | 拉丁方生成、唯一解挖洞、游戏状态（尺寸参数化，支持可选宫格） |
| `src/app.js` | 页面绑定：棋盘、数字键盘、工具栏、对话框、键盘快捷键 |
| `src/styles.css` | 样式（蓝色系，手机竖屏优先） |
| `src/index.html` | 页面模板，开发时可直接用静态服务器打开 `src/` |
| `tests/next-cell.spec.mjs` | Playwright 手机端回归（Pixel 5 视口 + 触摸） |
| `favicon.svg` / `manifest.webmanifest` | 图标与 PWA 清单 |

## 难度

| 难度 | 挖掉 | 线索 |
| --- | --- | --- |
| 简单 | 8 格 | 17 |
| 中等 | 12 格 | 13 |
| 困难 | 16 格 | 9 |

每盘都经唯一解校验；挖不到目标数量时会换一盘重挖，取挖得最多的一盘。

## 输入规则（回归保护）

- 点格子**只选中**，不落子、不判错；没有"激活数字"状态。
- 数字只经下方数字键盘或物理键盘 1–5 输入；再点同一个数字即擦除。
- 填完一格再点另一格时，那一格保持空白。`tests/next-cell.spec.mjs` 的第一个用例专门守这一条。

## 构建与测试

```bash
cd wuchengwu-sudoku
npm install                 # 只装 @playwright/test
npx playwright install chromium
npm run build               # 生成 index.html
npm test                    # 构建 + 本地静态服务器 + 手机端回归
npm run test:live           # 对线上地址跑同一套回归
```
