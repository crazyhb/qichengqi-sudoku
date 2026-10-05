// 拉丁方数独引擎：棋盘尺寸参数化（size），可选宫格（boxRows × boxCols）。
// 与线上 7×7 版本逻辑一致，只是把写死的 7 改成了参数。

export function shuffle(list, rng = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

export function createEngine({ size, boxRows = 0, boxCols = 0, difficulties, attempts = 24 }) {
  const N = size;
  const hasBoxes = boxRows > 0 && boxCols > 0;
  if (hasBoxes && boxRows * boxCols !== N) {
    throw new Error(`${boxRows}×${boxCols} 宫拼不成 ${N}×${N} 棋盘`);
  }
  const boxesPerRow = hasBoxes ? N / boxCols : 0;
  const DIGITS = Array.from({ length: N }, (_, i) => i + 1);
  const UNITS = buildUnits();

  function boxOf(r, c) {
    return hasBoxes ? Math.floor(r / boxRows) * boxesPerRow + Math.floor(c / boxCols) : -1;
  }

  function buildUnits() {
    const units = [];
    for (let i = 0; i < N; i += 1) {
      units.push(DIGITS.map((_, j) => [i, j]));
      units.push(DIGITS.map((_, j) => [j, i]));
    }
    if (hasBoxes) {
      for (let b = 0; b < N; b += 1) {
        const r0 = Math.floor(b / boxesPerRow) * boxRows;
        const c0 = (b % boxesPerRow) * boxCols;
        const cells = [];
        for (let dr = 0; dr < boxRows; dr += 1) {
          for (let dc = 0; dc < boxCols; dc += 1) cells.push([r0 + dr, c0 + dc]);
        }
        units.push(cells);
      }
    }
    return units;
  }

  function isPeer(r1, c1, r2, c2) {
    if (r1 === r2 && c1 === c2) return false;
    return r1 === r2 || c1 === c2 || (hasBoxes && boxOf(r1, c1) === boxOf(r2, c2));
  }

  function emptyGrid() {
    return Array.from({ length: N }, () => Array(N).fill(0));
  }

  function emptyNotes() {
    return Array.from({ length: N }, () => Array.from({ length: N }, () => []));
  }

  function canPlace(grid, r, c, d) {
    for (let i = 0; i < N; i += 1) {
      if (grid[r][i] === d || grid[i][c] === d) return false;
    }
    if (!hasBoxes) return true;
    const r0 = r - (r % boxRows);
    const c0 = c - (c % boxCols);
    for (let dr = 0; dr < boxRows; dr += 1) {
      for (let dc = 0; dc < boxCols; dc += 1) {
        if (grid[r0 + dr][c0 + dc] === d) return false;
      }
    }
    return true;
  }

  // 无宫格：循环拉丁方 + 随机行列/数字置换，瞬间生成。
  function latinSquare(rng) {
    const rowPerm = shuffle([...Array(N).keys()], rng);
    const colPerm = shuffle([...Array(N).keys()], rng);
    const digitPerm = shuffle(DIGITS, rng);
    const grid = emptyGrid();
    for (let r = 0; r < N; r += 1) {
      for (let c = 0; c < N; c += 1) {
        grid[r][c] = digitPerm[(rowPerm[r] + colPerm[c]) % N];
      }
    }
    return grid;
  }

  // 有宫格：回溯填满。
  function backtrackSolution(rng) {
    const grid = emptyGrid();
    const fill = (idx) => {
      if (idx === N * N) return true;
      const r = (idx / N) | 0;
      const c = idx % N;
      for (const d of shuffle(DIGITS, rng)) {
        if (canPlace(grid, r, c, d)) {
          grid[r][c] = d;
          if (fill(idx + 1)) return true;
          grid[r][c] = 0;
        }
      }
      return false;
    };
    fill(0);
    return grid;
  }

  function generateSolution(rng = Math.random) {
    return hasBoxes ? backtrackSolution(rng) : latinSquare(rng);
  }

  function isValidSolution(grid) {
    if (!grid || grid.length !== N || grid.some((row) => !row || row.length !== N)) return false;
    return UNITS.every((unit) => {
      const seen = new Set(unit.map(([r, c]) => grid[r][c]));
      return seen.size === N && DIGITS.every((d) => seen.has(d));
    });
  }

  function countClues(grid) {
    return grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  }

  // 数解的个数（最多数到 limit）。会就地修改 grid，调用方请先复制。
  function countSolutions(grid, limit = 2) {
    const rowUsed = Array.from({ length: N }, () => new Uint8Array(N + 1));
    const colUsed = Array.from({ length: N }, () => new Uint8Array(N + 1));
    const boxUsed = Array.from({ length: N }, () => new Uint8Array(N + 1));
    const empties = [];
    const free = (r, c, d) => !rowUsed[r][d] && !colUsed[c][d] && !(hasBoxes && boxUsed[boxOf(r, c)][d]);
    const mark = (r, c, d, on) => {
      rowUsed[r][d] = on;
      colUsed[c][d] = on;
      if (hasBoxes) boxUsed[boxOf(r, c)][d] = on;
    };
    for (let r = 0; r < N; r += 1) {
      for (let c = 0; c < N; c += 1) {
        const d = grid[r][c];
        if (!d) {
          empties.push(r * N + c);
          continue;
        }
        if (!free(r, c, d)) return 0;
        mark(r, c, d, 1);
      }
    }
    let found = 0;
    function search() {
      if (found >= limit) return;
      let bestIdx = -1;
      let bestCands = null;
      for (const idx of empties) {
        const r = (idx / N) | 0;
        const c = idx % N;
        if (grid[r][c]) continue;
        const cands = DIGITS.filter((d) => free(r, c, d));
        if (!bestCands || cands.length < bestCands.length) {
          bestIdx = idx;
          bestCands = cands;
          if (cands.length <= 1) break;
        }
      }
      if (bestIdx === -1) {
        found += 1;
        return;
      }
      const r = (bestIdx / N) | 0;
      const c = bestIdx % N;
      for (const d of bestCands) {
        grid[r][c] = d;
        mark(r, c, d, 1);
        search();
        grid[r][c] = 0;
        mark(r, c, d, 0);
        if (found >= limit) return;
      }
    }
    search();
    return found;
  }

  function hasUniqueSolution(grid) {
    return countSolutions(cloneGrid(grid), 2) === 1;
  }

  // 随机顺序挖洞，每挖一格都确认仍是唯一解。
  function digHoles(solution, remove, rng) {
    const puzzle = cloneGrid(solution);
    let removed = 0;
    for (const idx of shuffle([...Array(N * N).keys()], rng)) {
      if (removed >= remove) break;
      const r = (idx / N) | 0;
      const c = idx % N;
      const keep = puzzle[r][c];
      puzzle[r][c] = 0;
      if (hasUniqueSolution(puzzle)) removed += 1;
      else puzzle[r][c] = keep;
    }
    return puzzle;
  }

  // 多试几次，取挖得最多的一盘，保证三档难度的线索数拉得开。
  function generatePuzzle(difficulty = 'easy', rng = Math.random) {
    const spec = difficulties[difficulty] || difficulties.easy;
    let best = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const solution = generateSolution(rng);
      const puzzle = digHoles(solution, spec.remove, rng);
      const removed = N * N - countClues(puzzle);
      if (!best || removed > best.removed) best = { puzzle, solution, removed };
      if (removed >= spec.remove) break;
    }
    return { puzzle: best.puzzle, solution: best.solution, difficulty: spec.id, clues: countClues(best.puzzle) };
  }

  function candidatesAt(grid, r, c) {
    return grid[r][c] ? [] : DIGITS.filter((d) => canPlace(grid, r, c, d));
  }

  // 同一行/列/宫里重复出现的数字所在格。
  function conflictCells(grid) {
    const out = new Set();
    for (const unit of UNITS) {
      const where = new Map();
      for (const [r, c] of unit) {
        const d = grid[r][c];
        if (!d) continue;
        if (!where.has(d)) where.set(d, []);
        where.get(d).push(`${r},${c}`);
      }
      for (const cells of where.values()) {
        if (cells.length > 1) cells.forEach((key) => out.add(key));
      }
    }
    return out;
  }

  function digitCounts(grid) {
    const counts = Array(N + 1).fill(0);
    for (const row of grid) for (const d of row) if (d) counts[d] += 1;
    return counts;
  }

  function isCompleteAndCorrect(grid, solution) {
    return grid.every((row, r) => row.every((d, c) => d === solution[r][c]));
  }

  // 提示：先挑候选最少的空格；没有空格就纠正第一个填错的格。
  function findHintCell(grid, solution, puzzle) {
    const empties = [];
    const wrong = [];
    for (let r = 0; r < N; r += 1) {
      for (let c = 0; c < N; c += 1) {
        if (puzzle[r][c]) continue;
        if (grid[r][c]) {
          if (grid[r][c] !== solution[r][c]) wrong.push([r, c]);
        } else {
          empties.push([r, c, candidatesAt(grid, r, c).length]);
        }
      }
    }
    const pick = empties.sort((a, b) => a[2] - b[2])[0] || wrong[0];
    return pick ? { r: pick[0], c: pick[1], value: solution[pick[0]][pick[1]] } : null;
  }

  function wrongCells(grid, solution, puzzle) {
    const out = new Set();
    for (let r = 0; r < N; r += 1) {
      for (let c = 0; c < N; c += 1) {
        if (!puzzle[r][c] && grid[r][c] && grid[r][c] !== solution[r][c]) out.add(`${r},${c}`);
      }
    }
    return out;
  }

  return {
    N,
    boxRows,
    boxCols,
    hasBoxes,
    DIFFICULTIES: difficulties,
    boxOf,
    isPeer,
    cloneGrid,
    emptyNotes,
    generateSolution,
    isValidSolution,
    countClues,
    countSolutions,
    hasUniqueSolution,
    generatePuzzle,
    candidatesAt,
    conflictCells,
    digitCounts,
    isCompleteAndCorrect,
    findHintCell,
    wrongCells,
  };
}

// 只记"看过规则"这类开关的小存储。
export function flagStore(key) {
  return {
    get() {
      try {
        return localStorage.getItem(key) === '1';
      } catch {
        return false;
      }
    },
    set() {
      try {
        localStorage.setItem(key, '1');
      } catch {
        // 隐私模式下 localStorage 不可用，忽略即可
      }
    },
  };
}

// 一盘棋的状态：填数、笔记、撤销、提示、检查、存档。
// 注意：select() 只改选中格，绝不落子；数字只经 inputDigit() 进入。
export function createGameClass(engine, { storageKey }) {
  const {
    N,
    DIFFICULTIES,
    cloneGrid: copy,
    emptyNotes,
    generatePuzzle,
    isCompleteAndCorrect,
    conflictCells,
    findHintCell,
    wrongCells,
    isPeer,
  } = engine;

  function firstEmpty(puzzle) {
    for (let r = 0; r < N; r += 1) {
      for (let c = 0; c < N; c += 1) if (!puzzle[r][c]) return { r, c };
    }
    return { r: 0, c: 0 };
  }

  return class Game {
    constructor(data) {
      this.puzzle = data.puzzle;
      this.solution = data.solution;
      this.grid = data.grid;
      this.notes = data.notes;
      this.difficulty = data.difficulty;
      this.elapsed = data.elapsed ?? 0;
      this.mistakes = data.mistakes ?? 0;
      this.completed = !!data.completed;
      this.hints = data.hints ?? 0;
      this.undoStack = data.undoStack ?? [];
      this.noteMode = !!data.noteMode;
      this.selected = data.selected ?? null;
      this.hinted = new Set(data.hinted ?? []);
      this.checkedWrong = new Set();
    }

    static fromGenerated(gen) {
      return new Game({
        puzzle: gen.puzzle,
        solution: gen.solution,
        grid: copy(gen.puzzle),
        notes: emptyNotes(),
        difficulty: gen.difficulty,
        selected: firstEmpty(gen.puzzle),
      });
    }

    static create(difficulty = 'easy') {
      return Game.fromGenerated(generatePuzzle(difficulty));
    }

    static load() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const data = JSON.parse(raw);
        const bad =
          !data?.puzzle || !data?.solution || !data?.grid || !data?.notes || data.puzzle.length !== N || data.grid.length !== N;
        return bad ? null : new Game(data);
      } catch {
        return null;
      }
    }

    save() {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            puzzle: this.puzzle,
            solution: this.solution,
            grid: this.grid,
            notes: this.notes,
            difficulty: this.difficulty,
            elapsed: this.elapsed,
            mistakes: this.mistakes,
            completed: this.completed,
            hints: this.hints,
            undoStack: this.undoStack.slice(-80),
            noteMode: this.noteMode,
            selected: this.selected,
            hinted: [...this.hinted],
          }),
        );
      } catch {
        // 存不进去就算了，不影响玩
      }
    }

    difficultyLabel() {
      return (DIFFICULTIES[this.difficulty] ?? DIFFICULTIES.easy).label;
    }

    canEdit(r, c) {
      return this.puzzle[r][c] === 0 && !this.completed;
    }

    select(r, c) {
      this.selected = { r, c };
      this.checkedWrong = new Set();
    }

    toggleNoteMode() {
      this.noteMode = !this.noteMode;
    }

    pushUndo(entry) {
      this.undoStack.push(entry);
      if (this.undoStack.length > 80) this.undoStack.shift();
    }

    inputDigit(d) {
      if (this.completed || !this.selected) return { ok: false, reason: 'noselect' };
      const { r, c } = this.selected;
      if (!this.canEdit(r, c)) return { ok: false, reason: 'clue' };

      if (this.noteMode) {
        if (this.grid[r][c]) return { ok: false, reason: 'filled' };
        const prevNotes = this.notes[r][c].slice();
        const nextNotes = prevNotes.includes(d)
          ? prevNotes.filter((x) => x !== d)
          : [...prevNotes, d].sort((a, b) => a - b);
        this.pushUndo({ type: 'notes', r, c, prevNotes, nextNotes, prevValue: 0, nextValue: 0, mistakeDelta: 0 });
        this.notes[r][c] = nextNotes;
        return { ok: true, kind: 'note' };
      }

      const prevValue = this.grid[r][c];
      const prevNotes = this.notes[r][c].slice();
      // 再点一次同一个数字 = 擦掉
      if (prevValue === d) {
        this.grid[r][c] = 0;
        this.pushUndo({
          type: 'value',
          r,
          c,
          prevValue,
          nextValue: 0,
          prevNotes,
          nextNotes: prevNotes,
          mistakeDelta: 0,
          hinted: this.hinted.has(`${r},${c}`),
        });
        this.hinted.delete(`${r},${c}`);
        return { ok: true, kind: 'erase' };
      }

      const mistakeDelta = d === this.solution[r][c] ? 0 : 1;
      this.grid[r][c] = d;
      this.notes[r][c] = [];
      this.clearPeerNotes(r, c, d);
      this.hinted.delete(`${r},${c}`);
      this.mistakes += mistakeDelta;
      this.pushUndo({ type: 'value', r, c, prevValue, nextValue: d, prevNotes, nextNotes: [], mistakeDelta, hinted: false });
      const won = isCompleteAndCorrect(this.grid, this.solution);
      if (won) this.completed = true;
      return { ok: true, kind: 'value', wrong: mistakeDelta === 1, won, softLimit: this.mistakes >= 5 && mistakeDelta === 1 };
    }

    clearPeerNotes(r, c, d) {
      for (let i = 0; i < N; i += 1) {
        for (let j = 0; j < N; j += 1) {
          if (isPeer(r, c, i, j)) this.notes[i][j] = this.notes[i][j].filter((x) => x !== d);
        }
      }
    }

    erase() {
      if (this.completed || !this.selected) return { ok: false, reason: 'noselect' };
      const { r, c } = this.selected;
      if (!this.canEdit(r, c)) return { ok: false, reason: 'clue' };
      const prevValue = this.grid[r][c];
      const prevNotes = this.notes[r][c].slice();
      if (!prevValue && prevNotes.length === 0) return { ok: false, reason: 'empty' };
      this.grid[r][c] = 0;
      this.notes[r][c] = [];
      this.hinted.delete(`${r},${c}`);
      this.pushUndo({ type: 'erase', r, c, prevValue, nextValue: 0, prevNotes, nextNotes: [], mistakeDelta: 0, hinted: false });
      return { ok: true, kind: 'erase' };
    }

    undo() {
      if (this.completed) return { ok: false, reason: 'done' };
      const entry = this.undoStack.pop();
      if (!entry) return { ok: false, reason: 'empty' };
      const { r, c } = entry;
      this.grid[r][c] = entry.prevValue;
      this.notes[r][c] = entry.prevNotes.slice();
      this.mistakes = Math.max(0, this.mistakes - (entry.mistakeDelta || 0));
      if (entry.hinted) this.hinted.add(`${r},${c}`);
      else this.hinted.delete(`${r},${c}`);
      this.selected = { r, c };
      this.checkedWrong = new Set();
      return { ok: true };
    }

    hint() {
      if (this.completed) return { ok: false, reason: 'done' };
      const pick = findHintCell(this.grid, this.solution, this.puzzle);
      if (!pick) return { ok: false, reason: 'none' };
      const { r, c, value } = pick;
      const prevValue = this.grid[r][c];
      const prevNotes = this.notes[r][c].slice();
      this.grid[r][c] = value;
      this.notes[r][c] = [];
      this.clearPeerNotes(r, c, value);
      this.hinted.add(`${r},${c}`);
      this.hints += 1;
      this.selected = { r, c };
      this.pushUndo({ type: 'hint', r, c, prevValue, nextValue: value, prevNotes, nextNotes: [], mistakeDelta: 0, hinted: true });
      const won = isCompleteAndCorrect(this.grid, this.solution);
      if (won) this.completed = true;
      return { ok: true, won, r, c };
    }

    check() {
      const conflicts = conflictCells(this.grid);
      const wrong = wrongCells(this.grid, this.solution, this.puzzle);
      this.checkedWrong = wrong;
      if (this.completed || isCompleteAndCorrect(this.grid, this.solution)) {
        this.completed = true;
        return { status: 'win', conflicts, wrong };
      }
      if (wrong.size === 0 && conflicts.size === 0) return { status: 'ok', conflicts, wrong };
      return { status: 'issues', conflicts, wrong };
    }

    restart() {
      this.grid = copy(this.puzzle);
      this.notes = emptyNotes();
      this.elapsed = 0;
      this.mistakes = 0;
      this.completed = false;
      this.hints = 0;
      this.undoStack = [];
      this.hinted = new Set();
      this.checkedWrong = new Set();
      this.selected = firstEmpty(this.puzzle);
      this.noteMode = false;
    }

    view() {
      return {
        puzzle: this.puzzle,
        grid: this.grid,
        notes: this.notes,
        selected: this.selected,
        noteMode: this.noteMode,
        completed: this.completed,
        elapsed: this.elapsed,
        mistakes: this.mistakes,
        hints: this.hints,
        difficulty: this.difficulty,
        difficultyLabel: this.difficultyLabel(),
        conflicts: conflictCells(this.grid),
        checkedWrong: this.checkedWrong,
        hinted: this.hinted,
        wrong: wrongCells(this.grid, this.solution, this.puzzle),
        canUndo: this.undoStack.length > 0 && !this.completed,
      };
    }
  };
}
