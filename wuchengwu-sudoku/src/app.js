import { createEngine, createGameClass, flagStore } from './engine.js';

// 5×5 拉丁方：每行每列 1–5 各一次，没有宫格。
// 三档难度按 7×7 的比例折算（7×7 挖 16/24/32 格，共 49 格）。
const engine = createEngine({
  size: 5,
  difficulties: {
    easy: { id: 'easy', label: '简单', remove: 8 },
    medium: { id: 'medium', label: '中等', remove: 12 },
    hard: { id: 'hard', label: '困难', remove: 16 },
  },
});

const { N, DIFFICULTIES, digitCounts } = engine;
const Game = createGameClass(engine, { storageKey: 'tuantuan-55-sudoku-v1' });
const rulesSeen = flagStore('tuantuan-55-sudoku-rules-seen');

const boardEl = document.querySelector('#board');
const padEl = document.querySelector('#pad');
const hudDiff = document.querySelector('#hud-diff');
const hudTime = document.querySelector('#hud-time');
const hudLeft = document.querySelector('#hud-left');
const hudMistakes = document.querySelector('#hud-mistakes');
const statusEl = document.querySelector('#status');
const toastEl = document.querySelector('#toast');
const notesBtn = document.querySelector('#btn-notes');
const undoBtn = document.querySelector('#btn-undo');
const dlgRules = document.querySelector('#dlg-rules');
const dlgNew = document.querySelector('#dlg-new');
const dlgWin = document.querySelector('#dlg-win');

let game = null;
let ticker = null;
let toastTimer = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function save() {
  game?.save();
}

function startTicker() {
  stopTicker();
  ticker = setInterval(() => {
    if (!game || game.completed) return;
    game.elapsed += 1;
    hudTime.textContent = formatTime(game.elapsed);
    if (game.elapsed % 5 === 0) save();
  }, 1000);
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

function renderPad(view) {
  const counts = digitCounts(view.grid);
  padEl.innerHTML = '';
  for (let d = 1; d <= N; d += 1) {
    const left = N - counts[d];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.digit = String(d);
    btn.className = left <= 0 ? 'done' : '';
    btn.innerHTML = `${d}<small>${Math.max(0, left)}</small>`;
    btn.setAttribute('aria-label', `填入 ${d}`);
    padEl.appendChild(btn);
  }
  const erase = document.createElement('button');
  erase.type = 'button';
  erase.className = 'erase';
  erase.dataset.erase = '1';
  erase.innerHTML = '擦<small>⌫</small>';
  padEl.appendChild(erase);
}

function renderBoard(view) {
  const sel = view.selected;
  const selValue = sel ? view.grid[sel.r][sel.c] : 0;
  boardEl.innerHTML = '';
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.role = 'gridcell';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      const value = view.grid[r][c];
      const isClue = view.puzzle[r][c] !== 0;
      const key = `${r},${c}`;
      if (isClue) cell.classList.add('clue');
      if (sel && sel.r === r && sel.c === c) cell.classList.add('selected');
      else if (sel && (sel.r === r || sel.c === c)) cell.classList.add('peer');
      if (selValue && value === selValue) cell.classList.add('same');
      if (view.conflicts.has(key)) cell.classList.add('conflict');
      if (view.checkedWrong.has(key)) cell.classList.add('checked-wrong');
      if (view.hinted.has(key)) cell.classList.add('hinted');
      if (view.completed) cell.classList.add('won');
      const kind = isClue ? '线索' : '空格';
      cell.setAttribute(
        'aria-label',
        value ? `第 ${r + 1} 行第 ${c + 1} 列，${kind} ${value}` : `第 ${r + 1} 行第 ${c + 1} 列，空`,
      );
      if (value) {
        cell.textContent = String(value);
      } else if (view.notes[r][c].length) {
        const notes = document.createElement('div');
        notes.className = 'notes';
        for (let d = 1; d <= N; d += 1) {
          const span = document.createElement('span');
          const on = view.notes[r][c].includes(d);
          span.className = on ? 'on' : '';
          span.textContent = on ? String(d) : '';
          notes.appendChild(span);
        }
        cell.appendChild(notes);
      }
      boardEl.appendChild(cell);
    }
  }
}

function render() {
  if (!game) return;
  const view = game.view();
  hudDiff.textContent = view.difficultyLabel;
  hudTime.textContent = formatTime(view.elapsed);
  const filled = view.grid.flat().filter(Boolean).length;
  const left = N * N - filled;
  hudLeft.textContent = `剩 ${left} 格`;
  hudMistakes.textContent = `失误 ${view.mistakes}`;
  notesBtn.setAttribute('aria-pressed', view.noteMode ? 'true' : 'false');
  notesBtn.textContent = view.noteMode ? '笔记中' : '笔记';
  undoBtn.disabled = !view.canUndo;
  renderBoard(view);
  renderPad(view);
  if (view.completed) {
    statusEl.textContent = '团团：这盘收工啦。';
    stopTicker();
  } else if (view.mistakes >= 5) {
    statusEl.textContent = `团团：失误 ${view.mistakes} 次了，用提示或撤销吧。`;
  } else if (view.noteMode) {
    statusEl.textContent = '团团：笔记开着，点数字标候选。';
  } else {
    statusEl.textContent = `团团：还剩 ${left} 格，点格子再点数字。`;
  }
}

function celebrate() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti';
  const colors = ['#4f7cff', '#ffba50', '#5ee0b0', '#9fc0ff', '#fff'];
  for (let i = 0; i < 42; i += 1) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    piece.style.transform = `rotate(${Math.random() * 90}deg)`;
    confetti.appendChild(piece);
  }
  document.body.appendChild(confetti);
  setTimeout(() => confetti.remove(), 1800);

  const view = game.view();
  document.querySelector('#win-copy').textContent =
    view.mistakes === 0 ? '团团给你点赞：一次都没填错。' : '行和列都收齐了，团团鼓掌。';
  document.querySelector('#win-stats').innerHTML = `
    <div><dt>用时</dt><dd>${formatTime(view.elapsed)}</dd></div>
    <div><dt>失误</dt><dd>${view.mistakes}</dd></div>
    <div><dt>难度</dt><dd>${view.difficultyLabel}</dd></div>
  `;
  if (!dlgWin.open) dlgWin.showModal();
}

function afterMove(result) {
  render();
  save();
  if (result?.wrong) {
    boardEl.querySelector('.cell.selected')?.classList.add('shake');
    toast('团团：这一格不对');
    if (result.softLimit) statusEl.textContent = `团团：失误较多（${game.mistakes}），试试提示`;
  }
  if (result?.won) celebrate();
}

function newGame(difficulty) {
  game = Game.create(difficulty || 'easy');
  startTicker();
  render();
  save();
  toast(`团团开局：${game.difficultyLabel()}`);
}

function boot() {
  game = Game.load();
  if (!game) {
    newGame('easy');
    return;
  }
  startTicker();
  render();
}

// 点格子只选中，不落子、不判错。数字只从下面的键盘或物理键盘进来。
boardEl.addEventListener('click', (event) => {
  const cell = event.target.closest('.cell');
  if (!cell || !game) return;
  game.select(Number(cell.dataset.r), Number(cell.dataset.c));
  render();
  save();
});

padEl.addEventListener('click', (event) => {
  const btn = event.target.closest('button');
  if (!btn || !game) return;
  if (btn.dataset.erase) {
    afterMove(game.erase());
    return;
  }
  const result = game.inputDigit(Number(btn.dataset.digit));
  if (!result.ok && result.reason === 'noselect') toast('团团：先点一个格子');
  if (!result.ok && result.reason === 'clue') toast('团团：线索不能改');
  if (!result.ok && result.reason === 'filled') toast('团团：先擦掉数字再做笔记');
  afterMove(result);
});

document.querySelector('#btn-new').addEventListener('click', () => {
  newGame(game?.difficulty || 'easy');
});

document.querySelector('#btn-diff').addEventListener('click', () => dlgNew.showModal());

undoBtn.addEventListener('click', () => {
  const result = game.undo();
  if (!result.ok) toast(result.reason === 'empty' ? '团团：没有可撤销的步骤' : '团团：这盘已经完成了');
  afterMove(result);
});

document.querySelector('#btn-hint').addEventListener('click', () => {
  const result = game.hint();
  toast(result.ok ? '团团帮你填了一格' : '团团：没有能提示的空格');
  afterMove(result);
});

document.querySelector('#btn-check').addEventListener('click', () => {
  const result = game.check();
  render();
  save();
  if (result.status === 'win') celebrate();
  else if (result.status === 'ok') toast('团团：目前没发现问题');
  else toast(`团团标出 ${result.wrong.size || result.conflicts.size} 处问题`);
});

notesBtn.addEventListener('click', () => {
  game.toggleNoteMode();
  render();
  save();
});

document.querySelector('#btn-rules').addEventListener('click', () => dlgRules.showModal());

dlgNew.addEventListener('close', () => {
  const choice = dlgNew.returnValue;
  dlgNew.returnValue = '';
  if (!choice || choice === 'cancel') return;
  if (choice === 'restart') {
    game.restart();
    startTicker();
    render();
    save();
    toast('团团：本题重来');
    return;
  }
  if (DIFFICULTIES[choice]) newGame(choice);
});

document.querySelector('#btn-again').addEventListener('click', () => {
  dlgWin.close();
  newGame(game.difficulty);
});

document.querySelector('#btn-win-close').addEventListener('click', () => dlgWin.close());

dlgRules.addEventListener('close', () => rulesSeen.set());

document.addEventListener('keydown', (event) => {
  if (!game || dlgNew.open || dlgRules.open || dlgWin.open) return;
  const digit = Number(event.key);
  if (Number.isInteger(digit) && digit >= 1 && digit <= N) {
    afterMove(game.inputDigit(digit));
  } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
    afterMove(game.erase());
  } else if (event.key === 'n' || event.key === 'N') {
    game.toggleNoteMode();
    render();
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    afterMove(game.undo());
  } else if (event.key.startsWith('Arrow') && game.selected) {
    event.preventDefault();
    let { r, c } = game.selected;
    if (event.key === 'ArrowUp') r = (r + N - 1) % N;
    if (event.key === 'ArrowDown') r = (r + 1) % N;
    if (event.key === 'ArrowLeft') c = (c + N - 1) % N;
    if (event.key === 'ArrowRight') c = (c + 1) % N;
    game.select(r, c);
    render();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});

boot();
if (!rulesSeen.get()) {
  statusEl.textContent = '团团：每行每列 1–5 各一次，没有宫格。点我看规则。';
  rulesSeen.set();
}
