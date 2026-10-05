// 团团 5×5 数独手机端回归（Pixel 5 视口 + 触摸）。
// 核心用例：填完一格再点下一个空格，下一格必须保持空白、不复制上一个数字、不判错。
import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'tuantuan-55-sudoku-v1';
const N = 5;

const cell = (page, r, c) => page.locator(`#board .cell[data-r="${r}"][data-c="${c}"]`);
const digitKey = (page, d) => page.locator(`#pad button[data-digit="${d}"]`);

async function openGame(page) {
  await page.goto(`./?v=${Date.now()}`);
  await expect(page.locator('#board .cell')).toHaveCount(N * N);
  await expect(page.locator('#pad button')).toHaveCount(N + 1);
}

async function readState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

function emptyCells(state) {
  const out = [];
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) if (state.puzzle[r][c] === 0 && state.grid[r][c] === 0) out.push({ r, c });
  }
  return out;
}

async function newGameWithEmptyFor(page, digit) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await readState(page);
    const target = emptyCells(state).find(({ r, c }) => state.solution[r][c] === digit);
    if (target) return { state, target };
    await page.tap('#btn-new');
    await expect(page.locator('#board .cell')).toHaveCount(N * N);
  }
  throw new Error(`连换 12 局都没有答案为 ${digit} 的空格`);
}

test.describe('点格子只选中，不落子', () => {
  test('填 5 之后点下一个空格：空格保持空白、不复制 5、不判错', async ({ page }) => {
    await openGame(page);
    const { state, target } = await newGameWithEmptyFor(page, 5);
    const others = emptyCells(state).filter(({ r, c }) => r !== target.r || c !== target.c);
    expect(others.length).toBeGreaterThan(1);
    const [next, third] = others;

    await cell(page, target.r, target.c).tap();
    await expect(cell(page, target.r, target.c)).toHaveClass(/selected/);
    await digitKey(page, 5).tap();
    await expect(cell(page, target.r, target.c)).toHaveText('5');
    await expect(page.locator('#hud-mistakes')).toHaveText('失误 0');

    await cell(page, next.r, next.c).tap();
    await page.waitForTimeout(400);
    await expect(cell(page, next.r, next.c)).toHaveClass(/selected/);
    await expect(cell(page, next.r, next.c)).toHaveText('');
    await expect(cell(page, next.r, next.c)).not.toHaveClass(/shake|conflict|checked-wrong/);
    await expect(page.locator('#toast')).not.toContainText('不对');
    await expect(page.locator('#hud-mistakes')).toHaveText('失误 0');
    await expect(cell(page, target.r, target.c)).toHaveText('5');

    await cell(page, third.r, third.c).tap();
    await page.waitForTimeout(300);
    await expect(cell(page, third.r, third.c)).toHaveText('');
    await expect(cell(page, next.r, next.c)).toHaveText('');
    await expect(page.locator('#hud-mistakes')).toHaveText('失误 0');

    const after = await readState(page);
    expect(after.grid[target.r][target.c]).toBe(5);
    expect(after.grid[next.r][next.c]).toBe(0);
    expect(after.grid[third.r][third.c]).toBe(0);
    expect(after.selected).toEqual({ r: third.r, c: third.c });
    expect(after.mistakes).toBe(0);
  });

  test('填错一格报错后，点下一个空格也不会跟着填、不会再报错', async ({ page }) => {
    await openGame(page);
    const state = await readState(page);
    const [first, next] = emptyCells(state);
    const wrongDigit = (state.solution[first.r][first.c] % N) + 1;

    await cell(page, first.r, first.c).tap();
    await digitKey(page, wrongDigit).tap();
    await expect(cell(page, first.r, first.c)).toHaveText(String(wrongDigit));
    await expect(page.locator('#toast')).toHaveClass(/show/);
    await expect(page.locator('#toast')).toContainText('不对');
    await expect(page.locator('#hud-mistakes')).toHaveText('失误 1');

    await cell(page, next.r, next.c).tap();
    await expect(cell(page, next.r, next.c)).toHaveClass(/selected/);
    await expect(cell(page, next.r, next.c)).toHaveText('');
    await expect(page.locator('#hud-mistakes')).toHaveText('失误 1');
    await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 4000 });
    await expect(cell(page, next.r, next.c)).toHaveText('');
    expect((await readState(page)).grid[next.r][next.c]).toBe(0);
  });

  test('点线索格只选中，不改数字', async ({ page }) => {
    await openGame(page);
    const state = await readState(page);
    let clue = null;
    for (let r = 0; r < N && !clue; r += 1) {
      for (let c = 0; c < N && !clue; c += 1) if (state.puzzle[r][c]) clue = { r, c, value: state.puzzle[r][c] };
    }
    await cell(page, clue.r, clue.c).tap();
    await expect(cell(page, clue.r, clue.c)).toHaveClass(/selected/);
    await expect(cell(page, clue.r, clue.c)).toHaveText(String(clue.value));
    await digitKey(page, (clue.value % N) + 1).tap();
    await expect(cell(page, clue.r, clue.c)).toHaveText(String(clue.value));
    await expect(page.locator('#toast')).toContainText('线索不能改');
    await expect(page.locator('#hud-mistakes')).toHaveText('失误 0');
  });
});

test.describe('输入与编辑', () => {
  test('数字键盘：填入、再点同数擦除、擦键、撤销', async ({ page }) => {
    await openGame(page);
    const state = await readState(page);
    const [a] = emptyCells(state);
    const right = state.solution[a.r][a.c];

    await cell(page, a.r, a.c).tap();
    await digitKey(page, right).tap();
    await expect(cell(page, a.r, a.c)).toHaveText(String(right));
    await digitKey(page, right).tap();
    await expect(cell(page, a.r, a.c)).toHaveText('');
    await digitKey(page, right).tap();
    await expect(cell(page, a.r, a.c)).toHaveText(String(right));
    await page.tap('#pad button.erase');
    await expect(cell(page, a.r, a.c)).toHaveText('');
    await page.tap('#btn-undo');
    await expect(cell(page, a.r, a.c)).toHaveText(String(right));
    await page.tap('#btn-undo');
    await expect(cell(page, a.r, a.c)).toHaveText('');
    await expect(page.locator('#hud-mistakes')).toHaveText('失误 0');
  });

  test('物理键盘：数字键填入，Backspace 擦除，方向键移动选中', async ({ page }) => {
    await openGame(page);
    const state = await readState(page);
    const [a] = emptyCells(state);
    await cell(page, a.r, a.c).tap();
    await page.keyboard.press('3');
    await expect(cell(page, a.r, a.c)).toHaveText('3');
    await page.keyboard.press('Backspace');
    await expect(cell(page, a.r, a.c)).toHaveText('');
    await page.keyboard.press('ArrowRight');
    const expectedC = (a.c + 1) % N;
    await expect(cell(page, a.r, expectedC)).toHaveClass(/selected/);
    await expect(cell(page, a.r, a.c)).not.toHaveClass(/selected/);
  });

  test('笔记模式只标候选，不落子', async ({ page }) => {
    await openGame(page);
    const state = await readState(page);
    const [a] = emptyCells(state);
    await cell(page, a.r, a.c).tap();
    await page.tap('#btn-notes');
    await expect(page.locator('#btn-notes')).toHaveAttribute('aria-pressed', 'true');
    await digitKey(page, 2).tap();
    await digitKey(page, 4).tap();
    await expect(cell(page, a.r, a.c).locator('.notes span.on')).toHaveText(['2', '4']);
    await digitKey(page, 2).tap();
    await expect(cell(page, a.r, a.c).locator('.notes span.on')).toHaveText(['4']);
    expect((await readState(page)).grid[a.r][a.c]).toBe(0);
    await page.tap('#btn-notes');
    await expect(page.locator('#btn-notes')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('提示、检查、难度与完成', () => {
  test('提示填对一格并标色；检查能标出错格', async ({ page }) => {
    await openGame(page);
    const before = await readState(page);
    await page.tap('#btn-hint');
    const after = await readState(page);
    const hinted = emptyCells(before).find(({ r, c }) => after.grid[r][c] !== 0);
    expect(hinted).toBeTruthy();
    expect(after.grid[hinted.r][hinted.c]).toBe(after.solution[hinted.r][hinted.c]);
    await expect(cell(page, hinted.r, hinted.c)).toHaveClass(/hinted/);

    await page.tap('#btn-check');
    await expect(page.locator('#toast')).toContainText('没发现问题');

    const [a] = emptyCells(after);
    await cell(page, a.r, a.c).tap();
    await digitKey(page, (after.solution[a.r][a.c] % N) + 1).tap();
    await page.tap('#btn-check');
    await expect(page.locator('#toast')).toContainText('1 处问题');
    await expect(cell(page, a.r, a.c)).toHaveClass(/checked-wrong/);
  });

  test('三档难度线索数明显不同：简单 17、中等 13、困难 9', async ({ page }) => {
    await openGame(page);
    for (const [value, label, clues] of [
      ['hard', '困难', 9],
      ['medium', '中等', 13],
      ['easy', '简单', 17],
    ]) {
      await page.tap('#btn-diff');
      await expect(page.locator('#dlg-new')).toHaveAttribute('open', '');
      await page.tap(`#dlg-new button[value="${value}"]`);
      await expect(page.locator('#hud-diff')).toHaveText(label);
      const state = await readState(page);
      expect(state.puzzle.flat().filter(Boolean).length).toBe(clues);
      await expect(page.locator('#hud-left')).toHaveText(`剩 ${N * N - clues} 格`);
    }
  });

  test('全部填对后弹出完成，再来一局开新盘', async ({ page }) => {
    await openGame(page);
    const state = await readState(page);
    for (const { r, c } of emptyCells(state)) {
      await cell(page, r, c).tap();
      await digitKey(page, state.solution[r][c]).tap();
    }
    await expect(page.locator('#dlg-win')).toHaveAttribute('open', '');
    await expect(page.locator('#dlg-win h2')).toHaveText('团团鼓掌！');
    await expect(page.locator('#win-copy')).toContainText('一次都没填错');
    await expect(page.locator('#win-stats')).toContainText('难度');
    await expect(page.locator('#hud-left')).toHaveText('剩 0 格');

    await page.tap('#btn-again');
    await expect(page.locator('#dlg-win')).not.toHaveAttribute('open', '');
    await expect(page.locator('#board .cell')).toHaveCount(N * N);
    await expect(page.locator('#hud-left')).not.toHaveText('剩 0 格');
  });
});
