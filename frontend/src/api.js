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
export function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
export function lsSet(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ══════════════════════════════════════════════
// 选手 API
// ══════════════════════════════════════════════

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

// ══════════════════════════════════════════════
// 游戏 API
// ══════════════════════════════════════════════

export async function submitLevel({ player_name, level, time_seconds, empty_cells, wrong_cells, correct_steps = 0, incorrect_steps = 0 }) {
  try {
    const data = await request(`${BASE}/games/submit`, {
      method: 'POST',
      body: JSON.stringify({ player_name, level, time_seconds, empty_cells, wrong_cells, correct_steps, incorrect_steps }),
    });
    // 更新本地缓存中的选手数据
    const players = lsGet('sudoku_activePlayers') || [];
    const idx = players.findIndex(p => p.name === player_name);
    if (idx >= 0) {
      players[idx].currentLevel = level;
      players[idx].progress = level === 5 ? 100 : Math.round((level / 4) * 100);
      players[idx].totalTime = (players[idx].totalTime || 0) + time_seconds; // 本地也累加
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
      players[idx].progress = level === 5 ? 100 : Math.round((level / 4) * 100);
      players[idx].totalTime = (players[idx].totalTime || 0) + time_seconds;
      players[idx].levelDetails = players[idx].levelDetails || [];
      players[idx].levelDetails.push({ level, time: time_seconds, emptyCells: empty_cells, wrongCells: wrong_cells, completedAt: new Date().toISOString() });
      lsSet('sudoku_activePlayers', players);
    }
    return { message: '离线模式：成绩已本地保存', success: true };
  }
}

export async function completeGame({ player_name, completed_levels }) {
  try {
    const data = await request(`${BASE}/games/complete`, {
      method: 'POST',
      body: JSON.stringify({ player_name, completed_levels }),
    });
    return data;
  } catch {
    return { message: '离线模式：通关状态已更新', success: true };
  }
}

// ══════════════════════════════════════════════
// 排行榜 API（仅实时排行）
// ══════════════════════════════════════════════

export async function fetchActiveLeaderboard(mode = 'all') {
  try {
    const data = await request(`${BASE}/leaderboard/active?mode=${mode}`);
    lsSet('sudoku_activePlayers', data);
    return data;
  } catch {
    return lsGet('sudoku_activePlayers') || [];
  }
}

// ══════════════════════════════════════════════
// 比赛计时 API
// ══════════════════════════════════════════════

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
    return local || { isActive: false, totalSeconds: 180, remainingSeconds: 180, prepPhase: false };
  }
}

export async function startCompetition(totalSeconds = 180) {
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
    const local = { isActive: false, totalSeconds: 180, remainingSeconds: 180, prepPhase: true };
    lsSet('sudoku_competition', local);
    return { message: '离线模式：预备开始', prepPhase: true };
  }
}

export async function resetCompetition() {
  try {
    return await request(`${BASE}/competition/reset`, { method: 'POST' });
  } catch {
    lsSet('sudoku_competition', { isActive: false, totalSeconds: 180, remainingSeconds: 180, prepPhase: false });
    return { message: '离线模式：已重置' };
  }
}

// ══════════════════════════════════════════════
// 竞技房间 API
// ══════════════════════════════════════════════

export async function fetchRoomStatus() {
  try {
    return await request(`${BASE}/competition/room/status`);
  } catch {
    // 降级：用 localStorage 模拟
    const local = lsGet('sudoku_room');
    if (local && local.roomStatus === 'active' && local.roomStartedAt) {
      const elapsed = Math.floor((Date.now() - local.roomStartedAt) / 1000);
      local.roomRemainingSeconds = Math.max(0, local.roomTotalSeconds - elapsed);
      if (local.roomRemainingSeconds <= 0) {
        local.roomStatus = 'ended';
      }
    }
    return local || { roomStatus: 'idle', roomTotalSeconds: 120, roomRemainingSeconds: 120 };
  }
}

export async function openRoom() {
  try {
    return await request(`${BASE}/competition/room/open`, { method: 'POST' });
  } catch {
    const local = { roomStatus: 'lobby', roomTotalSeconds: 120, roomRemainingSeconds: 120 };
    lsSet('sudoku_room', local);
    return { message: '离线模式：房间已开启', roomStatus: 'lobby' };
  }
}

export async function startRoom() {
  try {
    return await request(`${BASE}/competition/room/start`, { method: 'POST' });
  } catch {
    const local = { roomStatus: 'active', roomTotalSeconds: 120, roomRemainingSeconds: 120, roomStartedAt: Date.now() };
    lsSet('sudoku_room', local);
    return { message: '离线模式：比赛已开始', roomStatus: 'active', roomTotalSeconds: 120, roomRemainingSeconds: 120 };
  }
}

export async function endRoom() {
  try {
    return await request(`${BASE}/competition/room/end`, { method: 'POST' });
  } catch {
    lsSet('sudoku_room', { roomStatus: 'ended', roomTotalSeconds: 120, roomRemainingSeconds: 0 });
    return { message: '离线模式：比赛已结束', roomStatus: 'ended' };
  }
}

export async function submitRace({ player_name, time_seconds, empty_cells, wrong_cells, correct_steps = 0, incorrect_steps = 0 }) {
  try {
    return await request(`${BASE}/competition/room/submit`, {
      method: 'POST',
      body: JSON.stringify({ player_name, time_seconds, empty_cells, wrong_cells, correct_steps, incorrect_steps }),
    });
  } catch {
    // 降级：写入本地 level=5 记录，并计算离线积分
    const players = lsGet('sudoku_activePlayers') || [];
    const idx = players.findIndex(p => p.name === player_name);
    if (idx >= 0) {
      players[idx].currentLevel = 5;
      players[idx].progress = 100;
      players[idx].totalTime = time_seconds;
      players[idx].levelDetails = players[idx].levelDetails || [];
      const existIdx = players[idx].levelDetails.findIndex(d => d.level === 5);
      if (existIdx >= 0) {
        players[idx].levelDetails[existIdx] = { level: 5, time: time_seconds, emptyCells: empty_cells, wrongCells: wrong_cells, correctSteps: correct_steps, incorrectSteps: incorrect_steps, completedAt: new Date().toISOString() };
      } else {
        players[idx].levelDetails.push({ level: 5, time: time_seconds, emptyCells: empty_cells, wrongCells: wrong_cells, correctSteps: correct_steps, incorrectSteps: incorrect_steps, completedAt: new Date().toISOString() });
      }
      lsSet('sudoku_activePlayers', players);
    }
    // 离线计算积分
    const score = 1000 - wrong_cells * 10 - empty_cells * 5 - Math.floor(time_seconds / 10);
    return { message: '离线模式：竞技成绩已本地保存', success: true, score };
  }
}

export async function resetRoom() {
  try {
    return await request(`${BASE}/competition/room/reset`, { method: 'POST' });
  } catch {
    lsSet('sudoku_room', { roomStatus: 'idle', roomTotalSeconds: 120, roomRemainingSeconds: 120 });
    return { message: '离线模式：房间已重置', roomStatus: 'idle' };
  }
}

export async function joinRoom(playerName) {
  try {
    return await request(`${BASE}/competition/room/join`, {
      method: 'POST',
      body: JSON.stringify({ player_name: playerName }),
    });
  } catch {
    return { message: '离线模式：加入失败', joinedPlayers: [playerName] };
  }
}

export async function fetchRoomStats() {
  try {
    return await request(`${BASE}/competition/room/stats`);
  } catch {
    // 降级：从本地 activePlayers 计算统计
    const players = lsGet('sudoku_activePlayers') || [];
    const racePlayers = players.filter(p => {
      const details = p.levelDetails || [];
      return details.some(d => d.level === 5);
    });
    const totalCells = 16; // 4x4
    const totalPlayers = racePlayers.length;
    if (totalPlayers === 0) {
      return {
        totalPlayers: 0, completedPlayers: 0, averageAccuracy: 0,
        totalCorrectSteps: 0, totalIncorrectSteps: 0, averageStepAccuracy: 0,
        leaderName: null, leaderScore: 0, rankings: [], joinedPlayers: [],
      };
    }
    const completedPlayers = racePlayers.filter(p => {
      const d = (p.levelDetails || []).find(d => d.level === 5);
      return d && d.emptyCells === 0 && d.wrongCells === 0;
    }).length;
    let totalCorrect = 0;
    let totalCorrectSteps = 0;
    let totalIncorrectSteps = 0;
    const rankings = racePlayers.map(p => {
      const d = (p.levelDetails || []).find(d => d.level === 5) || {};
      const empty = d.emptyCells || 0;
      const wrong = d.wrongCells || 0;
      const time = d.time || 0;
      const cs = d.correctSteps || 0;
      const ics = d.incorrectSteps || 0;
      const correct = totalCells - empty - wrong;
      totalCorrect += correct;
      totalCorrectSteps += cs;
      totalIncorrectSteps += ics;
      const totalS = cs + ics;
      const score = 1000 - wrong * 10 - empty * 5 - Math.floor(time / 10);
      return {
        name: p.name, score, timeSeconds: time, correctCells: correct, wrongCells: wrong,
        emptyCells: empty, correctSteps: cs, incorrectSteps: ics,
        stepAccuracy: totalS > 0 ? Math.round((cs / totalS) * 1000) / 10 : 0,
        isCompleted: empty === 0 && wrong === 0,
      };
    });
    rankings.sort((a, b) => b.score - a.score);
    const avgAccuracy = Math.round((totalCorrect / (totalPlayers * totalCells)) * 1000) / 10;
    const totalSteps = totalCorrectSteps + totalIncorrectSteps;
    const avgStepAccuracy = totalSteps > 0 ? Math.round((totalCorrectSteps / totalSteps) * 1000) / 10 : 0;
    return {
      totalPlayers,
      completedPlayers,
      averageAccuracy: avgAccuracy,
      totalCorrectSteps,
      totalIncorrectSteps,
      averageStepAccuracy: avgStepAccuracy,
      leaderName: rankings[0]?.name || null,
      leaderScore: rankings[0]?.score || 0,
      rankings,
      joinedPlayers: [],
    };
  }
}

// ══════════════════════════════════════════════
// 数据清理 —— 分模式清空
// ══════════════════════════════════════════════

export async function clearPlayerProgress(playerName, mode = 'all') {
  try {
    return await request(`${BASE}/players/${encodeURIComponent(playerName)}/progress?mode=${mode}`, { method: 'DELETE' });
  } catch {
    const players = lsGet('sudoku_activePlayers') || [];
    if (mode === 'competition') {
      const idx = players.findIndex(p => p.name === playerName);
      if (idx >= 0) {
        players[idx].levelDetails = (players[idx].levelDetails || []).filter(d => d.level !== 5);
        if (players[idx].levelDetails.length === 0) {
          players[idx].currentLevel = 0;
          players[idx].progress = 0;
        }
        lsSet('sudoku_activePlayers', players);
      }
    } else if (mode === 'practice') {
      const idx = players.findIndex(p => p.name === playerName);
      if (idx >= 0) {
        players[idx].levelDetails = (players[idx].levelDetails || []).filter(d => d.level === 5);
        players[idx].currentLevel = 0;
        players[idx].progress = 0;
        players[idx].totalTime = 0;
        lsSet('sudoku_activePlayers', players);
      }
    }
    return { message: '离线模式：本地数据已清除', success: true };
  }
}

/** 清空王牌侦探模式数据（练习关卡 1-4 + 排名计时器），不动竞技模式 */
export async function clearRankingData() {
  try {
    const res = await request(`${BASE}/admin/clear-ranking`, { method: 'DELETE' });
    localStorage.removeItem('sudoku_activePlayers');
    localStorage.removeItem('sudoku_competition');
    localStorage.removeItem('sudoku_hasCleared');
    return res;
  } catch (e) {
    console.warn('[API] 后端清空失败，仅清本地:', e.message);
    localStorage.removeItem('sudoku_activePlayers');
    localStorage.removeItem('sudoku_competition');
    localStorage.removeItem('sudoku_hasCleared');
    return { message: '本地数据已清除（后端不可用）', success: true };
  }
}

/** 清空竞技模式数据（关卡 level=5 + 竞技房间状态），不动练习模式 */
export async function clearRaceData() {
  try {
    const res = await request(`${BASE}/admin/clear-race`, { method: 'DELETE' });
    localStorage.removeItem('sudoku_room');
    return res;
  } catch (e) {
    console.warn('[API] 后端清空失败，仅清本地:', e.message);
    localStorage.removeItem('sudoku_room');
    return { message: '本地竞技数据已清除（后端不可用）', success: true };
  }
}

/** 清空全部数据（练习 + 竞技），谨慎使用 */
export async function clearAllData() {
  try {
    const res = await request(`${BASE}/admin/clear`, { method: 'DELETE' });
    localStorage.removeItem('sudoku_activePlayers');
    localStorage.removeItem('sudoku_competition');
    localStorage.removeItem('sudoku_hasCleared');
    localStorage.removeItem('sudoku_room');
    return res;
  } catch (e) {
    console.warn('[API] 后端清空失败，仅清本地:', e.message);
    localStorage.removeItem('sudoku_activePlayers');
    localStorage.removeItem('sudoku_competition');
    localStorage.removeItem('sudoku_hasCleared');
    localStorage.removeItem('sudoku_room');
    return { message: '本地数据已清除（后端不可用）', success: true };
  }
}
