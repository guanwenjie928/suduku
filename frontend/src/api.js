/**
 * API 封装层 —— 优先调用后端 API，失败时降级到 localStorage
 *
 * 架构：
 *   API 正常 → 服务端读写 + localStorage 留缓存
 *   API 异常 → localStorage 降级，并在控制台 warn
 *
 * 轮询策略：
 *   排行榜：每 2 秒
 *   比赛计时：每 1 秒
 */

const BASE = '/sudoku/api/v1';

// ── 离线标记 ──
let isOffline = false;
export function getIsOffline() { return isOffline; }

async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    isOffline = false;
    return await res.json();
  } catch (e) {
    if (!isOffline) {
      console.warn('[API] 后端不可用，降级到 localStorage:', e.message);
      isOffline = true;
    }
    throw e;
  }
}

// ── localStorage 辅助 ──
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ═══════════════════════════════════════════════
// 选手 API
// ═══════════════════════════════════════════════

export async function fetchPlayers() {
  try {
    const data = await request(`${BASE}/players`);
    lsSet('sudoku_activePlayers', data);
    return data;
  } catch {
    return lsGet('sudoku_activePlayers') || [];
  }
}

export async function createPlayer(name) {
  try {
    const data = await request(`${BASE}/players`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    // 同时更新本地缓存
    const players = lsGet('sudoku_activePlayers') || [];
    const idx = players.findIndex(p => p.name === name);
    if (idx >= 0) players[idx] = data.player;
    else players.push(data.player);
    lsSet('sudoku_activePlayers', players);
    return data;
  } catch {
    // 降级：直接写 localStorage
    const players = lsGet('sudoku_activePlayers') || [];
    let player = players.find(p => p.name === name);
    const isNew = !player;
    if (isNew) {
      player = { id: Date.now(), name, currentLevel: 0, progress: 0, totalTime: 0, isCompleted: false, lastUpdate: new Date().toISOString(), levelDetails: [] };
      players.push(player);
    } else {
      player.currentLevel = 0;
      player.progress = 0;
      player.totalTime = 0;
      player.isCompleted = false;
      player.levelDetails = [];
    }
    lsSet('sudoku_activePlayers', players);
    return { message: `离线模式：${name}`, player, isNew };
  }
}

// ═══════════════════════════════════════════════
// 游戏 API
// ═══════════════════════════════════════════════

export async function submitLevel({ player_name, level, time_seconds, empty_cells, wrong_cells }) {
  try {
    const data = await request(`${BASE}/games/submit`, {
      method: 'POST',
      body: JSON.stringify({ player_name, level, time_seconds, empty_cells, wrong_cells }),
    });
    // 更新本地缓存中的选手数据
    const players = lsGet('sudoku_activePlayers') || [];
    const idx = players.findIndex(p => p.name === player_name);
    if (idx >= 0) {
      players[idx].currentLevel = level;
      players[idx].progress = Math.round((level / 4) * 100);
      players[idx].totalTime = time_seconds;
      players[idx].levelDetails = players[idx].levelDetails || [];
      const detailIdx = players[idx].levelDetails.findIndex(d => d.level === level);
      if (detailIdx >= 0) {
        players[idx].levelDetails[detailIdx] = { level, time: time_seconds, emptyCells: empty_cells, wrongCells: wrong_cells, completedAt: new Date().toISOString() };
      } else {
        players[idx].levelDetails.push({ level, time: time_seconds, emptyCells: empty_cells, wrongCells: wrong_cells, completedAt: new Date().toISOString() });
      }
      lsSet('sudoku_activePlayers', players);
    }
    return data;
  } catch {
    const players = lsGet('sudoku_activePlayers') || [];
    const idx = players.findIndex(p => p.name === player_name);
    if (idx >= 0) {
      players[idx].currentLevel = level;
      players[idx].progress = Math.round((level / 4) * 100);
      players[idx].totalTime = time_seconds;
      players[idx].levelDetails = players[idx].levelDetails || [];
      players[idx].levelDetails.push({ level, time: time_seconds, emptyCells: empty_cells, wrongCells: wrong_cells, completedAt: new Date().toISOString() });
      lsSet('sudoku_activePlayers', players);
    }
    return { message: '离线模式：成绩已本地保存', success: true };
  }
}

export async function completeGame({ player_name, completed_levels, total_time, wrong_cells, empty_cells }) {
  try {
    const data = await request(`${BASE}/games/complete`, {
      method: 'POST',
      body: JSON.stringify({ player_name, completed_levels, total_time, wrong_cells, empty_cells }),
    });
    // 同时更新本地历史记录
    const records = lsGet('sudoku_historyRecords') || [];
    records.unshift({
      id: Date.now(),
      name: player_name,
      completedLevels: completed_levels,
      totalTime: total_time,
      wrongCells: wrong_cells,
      emptyCells: empty_cells,
      date: new Date().toISOString(),
    });
    lsSet('sudoku_historyRecords', records);
    return data;
  } catch {
    const records = lsGet('sudoku_historyRecords') || [];
    records.unshift({
      id: Date.now(),
      name: player_name,
      completedLevels: completed_levels,
      totalTime: total_time,
      wrongCells: wrong_cells,
      emptyCells: empty_cells,
      date: new Date().toISOString(),
    });
    lsSet('sudoku_historyRecords', records);
    return { message: '离线模式：通关记录已本地保存', success: true };
  }
}

// ═══════════════════════════════════════════════
// 排行榜 API
// ═══════════════════════════════════════════════

export async function fetchActiveLeaderboard() {
  try {
    const data = await request(`${BASE}/leaderboard/active`);
    lsSet('sudoku_activePlayers', data);
    return data;
  } catch {
    return lsGet('sudoku_activePlayers') || [];
  }
}

export async function fetchHistoryLeaderboard() {
  try {
    const data = await request(`${BASE}/leaderboard/history`);
    lsSet('sudoku_historyRecords', data);
    return data;
  } catch {
    return lsGet('sudoku_historyRecords') || [];
  }
}

// ═══════════════════════════════════════════════
// 比赛计时 API
// ═══════════════════════════════════════════════

export async function fetchCompetitionStatus() {
  try {
    return await request(`${BASE}/competition`);
  } catch {
    // 降级：用 localStorage 模拟
    const local = lsGet('sudoku_competition');
    if (local && local.isActive) {
      const elapsed = Math.floor((Date.now() - local.startedAt) / 1000);
      local.remainingSeconds = Math.max(0, local.totalSeconds - elapsed);
      if (local.remainingSeconds <= 0) {
        local.isActive = false;
        local.prepPhase = false;
      }
    }
    return local || { isActive: false, totalSeconds: 300, remainingSeconds: 300, prepPhase: false };
  }
}

export async function startCompetition(totalSeconds = 300) {
  try {
    const data = await request(`${BASE}/competition/start`, {
      method: 'POST',
      body: JSON.stringify({ total_seconds: totalSeconds }),
    });
    return data;
  } catch {
    const local = { isActive: true, totalSeconds, remainingSeconds: totalSeconds, prepPhase: false, startedAt: Date.now() };
    lsSet('sudoku_competition', local);
    return { message: '离线模式：计时器已启动', status: local };
  }
}

export async function startPrepPhase() {
  try {
    return await request(`${BASE}/competition/prep`, { method: 'POST' });
  } catch {
    const local = { isActive: false, totalSeconds: 300, remainingSeconds: 300, prepPhase: true };
    lsSet('sudoku_competition', local);
    return { message: '离线模式：预备开始', prepPhase: true };
  }
}

export async function resetCompetition() {
  try {
    return await request(`${BASE}/competition/reset`, { method: 'POST' });
  } catch {
    lsSet('sudoku_competition', { isActive: false, totalSeconds: 300, remainingSeconds: 300, prepPhase: false });
    return { message: '离线模式：已重置' };
  }
}

// ═══════════════════════════════════════════════
// 数据清理
// ═══════════════════════════════════════════════

export async function clearAllData() {
  try {
    // 先调后端清空
    const res = await request(`${BASE}/admin/clear`, { method: 'DELETE' });
    // 再清本地
    localStorage.removeItem('sudoku_activePlayers');
    localStorage.removeItem('sudoku_historyRecords');
    localStorage.removeItem('sudoku_competition');
    localStorage.removeItem('sudoku_hasCleared');
    return res;
  } catch (e) {
    console.warn('[API] 后端清空失败，仅清本地:', e.message);
    localStorage.removeItem('sudoku_activePlayers');
    localStorage.removeItem('sudoku_historyRecords');
    localStorage.removeItem('sudoku_competition');
    localStorage.removeItem('sudoku_hasCleared');
    return { message: '本地数据已清除（后端不可用）', success: true };
  }
}
