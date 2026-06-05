import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import SoundManager from '../hooks/useSound';
import { fetchActiveLeaderboard, fetchRoomStatus, joinRoom, submitRace } from '../api';
import { formatTime } from '../utils/time';

const DEFAULT_GROUPS = ['第一小组', '第二小组', '第三小组', '第四小组', '第五小组', '第六小组', '第七小组', '第八小组', '第九小组'];

// 竞技题目（4x4 数独）—— 与后端 competition.py 保持一致
const RACE_PUZZLE = [[1, 0, 0, 0], [0, 0, 0, 4], [3, 0, 0, 0], [0, 0, 0, 2]];
const RACE_SOLUTION = [[1, 4, 2, 3], [2, 3, 1, 4], [3, 2, 4, 1], [4, 1, 3, 2]];
const RACE_LEVEL_ID = 5;
const ROOM_TOTAL_SECONDS = 120;
const RACE_TOTAL_CELLS = 16;

// 步骤常量 —— 避免字符串硬编码
const STEP = {
  SELECT: 'select',
  LOBBY: 'lobby',
  PLAYING: 'playing',
  SUBMITTED: 'submitted',
  ENDED: 'ended'
};

const LS_KEY = 'sudoku_race_state';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function savePersistedState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function clearPersistedState() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

export default function CompetitionMode({ onBack, showToast }) {
  const persisted = loadPersistedState();

  // 步骤：SELECT → LOBBY → PLAYING → SUBMITTED → ENDED
  const [step, setStep] = useState(persisted?.step || STEP.SELECT);
  const [playerName, setPlayerName] = useState(persisted?.playerName || '');
  const [room, setRoom] = useState({ roomStatus: 'idle', roomTotalSeconds: ROOM_TOTAL_SECONDS, roomRemainingSeconds: ROOM_TOTAL_SECONDS });
  const [board, setBoard] = useState(persisted?.board || RACE_PUZZLE.map(r => [...r]));
  const [selectedCell, setSelectedCell] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myScore, setMyScore] = useState(persisted?.myScore ?? null);
  const [submitted, setSubmitted] = useState(persisted?.submitted || false);

  // 步数追踪：正确步/错误步
  const [correctSteps, setCorrectSteps] = useState(persisted?.correctSteps || 0);
  const [incorrectSteps, setIncorrectSteps] = useState(persisted?.incorrectSteps || 0);
  // 计时器（本地独立计算，配合服务端轮询修正）
  const [localRemaining, setLocalRemaining] = useState(ROOM_TOTAL_SECONDS);
  const localTimerRef = useRef(null);
  const persistedLoadedRef = useRef(false);

  // 自动提交所需的 refs（供 handleAutoSubmit 中读取最新值，避免闭包陷阱）
  const boardRef = useRef(board);
  const correctStepsRef = useRef(correctSteps);
  const incorrectStepsRef = useRef(incorrectSteps);
  const localRemainingRef = useRef(localRemaining);
  const submittedRef = useRef(submitted);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { correctStepsRef.current = correctSteps; }, [correctSteps]);
  useEffect(() => { incorrectStepsRef.current = incorrectSteps; }, [incorrectSteps]);
  useEffect(() => { localRemainingRef.current = localRemaining; }, [localRemaining]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);

  // ── 持久化关键状态到 localStorage（页面刷新恢复）──
  useEffect(() => {
    // 首次挂载时跳过（已从 persisted 恢复），标记后后续变更才写入
    if (!persistedLoadedRef.current) {
      persistedLoadedRef.current = true;
      return;
    }
    savePersistedState({
      step, playerName, board, myScore, submitted, correctSteps, incorrectSteps,
    });
  }, [step, playerName, board, myScore, submitted, correctSteps, incorrectSteps]);

  // 如果从 localStorage 恢复了非初始状态，标记已加载以启用持久化
  useEffect(() => {
    if (persisted?.step && persisted.step !== STEP.SELECT) {
      persistedLoadedRef.current = true;
    }
  }, []);

  // ── 加入竞技房间 ──
  const handleJoinRoom = async (name) => {
    if (!name || !name.trim()) return;
    SoundManager.playClick();
    const trimmed = name.trim();
    setPlayerName(trimmed);

    // 仅加入房间，不在 players 表创建记录（提交成绩时才创建，确保练习/竞技隔离）
    try { await joinRoom(trimmed); } catch { /* 降级 */ }

    setStep(STEP.LOBBY);
  };


  // ── 房间状态轮询 ──
  useEffect(() => {
    if (step === STEP.SELECT) return;

    const pollRoom = async () => {
      try {
        const rs = await fetchRoomStatus();
        setRoom(prev => {
          if (prev?.roomStatus === rs.roomStatus && prev?.remainingSeconds === rs.remainingSeconds) {
            return prev;
          }
          return rs;
        });

        if (rs.roomStatus === 'active' && step === STEP.LOBBY) {
          // 比赛开始！
          setStep(STEP.PLAYING);
          setBoard(RACE_PUZZLE.map(r => [...r]));
          setSelectedCell(null);
          setSubmitted(false);
          setMyScore(null);
          SoundManager.playGo();
        } else if (rs.roomStatus === 'ended' && step === STEP.PLAYING) {
          // 时间到，自动提交再强制结束
          await handleAutoSubmit();
          setStep(STEP.ENDED);
          SoundManager.playDing();
        } else if (rs.roomStatus === 'ended' && step === STEP.SUBMITTED) {
          setStep(STEP.ENDED);
        } else if (rs.roomStatus === 'idle' && (step === STEP.PLAYING || step === STEP.SUBMITTED || step === STEP.ENDED)) {
          // 房间已被重置，回到选择页面
          clearPersistedState();
          setStep(STEP.SELECT);
          setPlayerName('');
          setMyScore(null);
          setSubmitted(false);
          setCorrectSteps(0);
          setIncorrectSteps(0);
        }
      } catch { /* 降级 */ }
    };

    pollRoom();
    const timer = setInterval(pollRoom, 1000);
    return () => clearInterval(timer);
  }, [step]);

  // ── 排行榜轮询 ──
  useEffect(() => {
    if (step === STEP.SELECT || step === STEP.LOBBY) return;

    const pollLB = async () => {
      try {
        const lb = await fetchActiveLeaderboard('competition');
        setLeaderboard(lb);
      } catch { /* 降级 */ }
    };

    pollLB();
    const timer = setInterval(pollLB, 2000);
    return () => clearInterval(timer);
  }, [step]);

  // ── 本地倒计时 ──
  useEffect(() => {
    if (step !== 'playing') {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      return;
    }

    // 用服务端时间初始化本地倒计时
    setLocalRemaining(room.roomRemainingSeconds);

    localTimerRef.current = setInterval(() => {
      setLocalRemaining(prev => {
        if (prev <= 1) {
          clearInterval(localTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (localTimerRef.current) clearInterval(localTimerRef.current); };
  }, [step, room.roomStartedAt]);

  // ── 紧张 BGM（比赛进行中）──
  useEffect(() => {
    if (step === STEP.PLAYING) {
      SoundManager.playTenseBGM();
      return () => SoundManager.stopTenseBGM();
    }
  }, [step]);

  // ── 倒数音效（最后 10 秒 beep，最后 3 秒更急促）──
  useEffect(() => {
    if (step !== STEP.PLAYING || localRemaining <= 0 || localRemaining > 10) return;
    if (localRemaining <= 3) {
      SoundManager.playCountdown();
    } else {
      SoundManager.playCountdownBeep();
    }
  }, [localRemaining, step]);

  // ── 点击数字填入 ──
  const handleNumberClick = (num) => {
    if (!selectedCell || submitted || step !== 'playing') return;
    SoundManager.playClick();
    const { row, col } = selectedCell;
    const nb = board.map(r => [...r]);
    nb[row][col] = num;
    setBoard(nb);
    // 步数追踪：比对答案
    if (num === RACE_SOLUTION[row][col]) {
      setCorrectSteps(c => c + 1);
    } else {
      setIncorrectSteps(c => c + 1);
    }
  };

  // ── 自动提交（时间到/强制结束，保留步数数据）──
  const handleAutoSubmit = async () => {
    if (submittedRef.current) return;
    const b = boardRef.current;
    const cs = correctStepsRef.current;
    const ics = incorrectStepsRef.current;
    const lr = localRemainingRef.current;

    let ec = 0, wc = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === 0) ec++;
        else if (b[r][c] !== RACE_SOLUTION[r][c]) wc++;
      }
    }

    const timeUsed = ROOM_TOTAL_SECONDS - lr;

    let backendScore = null;
    try {
      const res = await submitRace({
        player_name: playerName,
        time_seconds: timeUsed,
        empty_cells: ec,
        wrong_cells: wc,
        correct_steps: cs,
        incorrect_steps: ics,
      });
      if (res && typeof res.score === 'number') {
        backendScore = res.score;
      }
    } catch { /* 降级 */ }

    const score = backendScore ?? (1000 - wc * 10 - ec * 5 - Math.floor(timeUsed / 10));
    setMyScore(score);
    setSubmitted(true);
  };

  // ── 提交答案 ──
  const handleSubmit = async () => {
    if (submitted || step !== 'playing') return;
    SoundManager.playClick();

    // 计算错误和未填
    let ec = 0, wc = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === 0) ec++;
        else if (board[r][c] !== RACE_SOLUTION[r][c]) wc++;
      }
    }

    const timeUsed = ROOM_TOTAL_SECONDS - localRemaining;

    // 提交到后端（后端返回权威积分，服务端计时）
    let backendScore = null;
    try {
      const res = await submitRace({
        player_name: playerName,
        time_seconds: timeUsed,
        empty_cells: ec,
        wrong_cells: wc,
        correct_steps: correctSteps,
        incorrect_steps: incorrectSteps,
      });
      // 使用后端权威积分
      if (res && typeof res.score === 'number') {
        backendScore = res.score;
      }
    } catch { /* 降级：使用本地计算 */ }

    // 积分：优先使用后端返回值，降级时本地计算
    const score = backendScore ?? (1000 - wc * 10 - ec * 5 - Math.floor(timeUsed / 10));
    setMyScore(score);
    setSubmitted(true);
    setStep(STEP.SUBMITTED);

    SoundManager.playDing();
    showToast(ec === 0 && wc === 0 ? '完美提交！' : `已提交！未填:${ec} 错误:${wc}`, 'success', 1500);
  };

  // ── 积分计算（仅离线降级用，在线时直接用 p.score）──
  const calcScoreFallback = (player) => {
    const details = player.levelDetails || [];
    const raceDetail = details.find(d => d.level === RACE_LEVEL_ID);
    if (!raceDetail) return 0;
    return 1000 - raceDetail.wrongCells * 10 - raceDetail.emptyCells * 5 - Math.floor(raceDetail.time / 10);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-rose-100 p-4">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { SoundManager.playClick(); clearPersistedState(); onBack(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md text-slate-600 hover:bg-slate-50"
        >
          <Icon name="ArrowLeft" className="w-5 h-5" />返回
        </button>
        <h1 className="text-xl font-bold text-slate-700 flex items-center gap-2">
          <Icon name="Zap" className="w-6 h-6 text-purple-500" />竞技模式
        </h1>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md">
          <Icon name="Clock" className={`w-5 h-5 ${localRemaining <= 30 && step === STEP.PLAYING ? 'text-red-500' : 'text-purple-500'}`} />
          <span className={`font-mono font-bold text-lg tabular-nums ${localRemaining <= 30 && step === STEP.PLAYING ? 'text-red-500' : 'text-slate-700'}`}>
            {step === STEP.PLAYING ? formatTime(localRemaining) : formatTime(ROOM_TOTAL_SECONDS)}
          </span>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex flex-col lg:flex-row gap-4 max-w-5xl mx-auto">
        {/* 左侧：主操作区 */}
        <div className="flex-1">
          {/* Step 1: 选择小组 */}
          {step === STEP.SELECT && (
            <div className="bg-white rounded-3xl p-8 shadow-xl text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                <Icon name="Zap" className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-700 mb-2">竞技模式</h2>
              <p className="text-slate-500 mb-6">选择你的小组，与其他小组同台竞技！</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {DEFAULT_GROUPS.map(g => (
                  <button
                    key={g}
                    onClick={() => handleJoinRoom(g)}
                    className="py-4 px-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-purple-50 to-pink-50 text-slate-700 hover:from-purple-100 hover:to-pink-100 border border-purple-200 hover:border-purple-400 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {g}
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-400">题目将在教师开启比赛后统一发放</p>
            </div>
          )}

          {/* Step 2: 等待大厅 */}
          {step === STEP.LOBBY && (
            <div className="bg-white rounded-3xl p-8 shadow-xl text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-400 flex items-center justify-center animate-pulse">
                <Icon name="Clock" className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-700 mb-2">等待教师开始比赛</h2>
              <p className="text-slate-500 mb-2">你选择的是：<span className="font-bold text-purple-600">{playerName}</span></p>
              <p className="text-slate-400 text-sm">请等待教师在六屏幕上点击「开始比赛」...</p>
              <div className="mt-6 flex justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-3 h-3 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* Step 3 & 4: 比赛进行中 / 已提交 */}
          {(step === STEP.PLAYING || step === STEP.SUBMITTED) && (
            <>
              {/* 数独棋盘 */}
              <div className="flex justify-center mb-4">
                <div className={`inline-grid grid-cols-4 gap-1 p-3 rounded-2xl shadow-2xl ${submitted ? 'bg-slate-600' : 'bg-slate-800'}`}>
                  {board.map((row, r) =>
                    row.map((cell, c) => {
                      const isFixed = RACE_PUZZLE[r][c] !== 0;
                      const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                      const isCorrect = submitted && cell !== 0 && cell === RACE_SOLUTION[r][c];
                      const isWrong = submitted && cell !== 0 && cell !== RACE_SOLUTION[r][c];
                      const isMissing = submitted && cell === 0;
                      return (
                        <button
                          key={`${r}-${c}`}
                          onClick={() => {
                            if (!isFixed && !submitted) { SoundManager.playClick(); setSelectedCell({ row: r, col: c }); }
                          }}
                          disabled={submitted}
                          className={`w-14 h-14 md:w-16 md:h-16 rounded-xl font-bold text-xl flex items-center justify-center transition-all ${
                            isFixed
                              ? 'bg-slate-200 text-slate-700 cursor-default'
                              : isCorrect
                                ? 'bg-emerald-200 text-emerald-700'
                                : isWrong
                                  ? 'bg-red-200 text-red-700'
                                  : isMissing
                                    ? 'bg-amber-100 text-amber-400'
                                    : isSelected
                                      ? 'bg-purple-200 text-purple-600 ring-4 ring-purple-400'
                                      : 'bg-slate-100 text-purple-600 hover:scale-105'
                          }`}
                        >
                          {cell !== 0 ? cell : (isMissing ? '?' : '')}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 数字键盘 */}
              {!submitted && (
                <div className="flex justify-center gap-3 mb-4">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      onClick={() => handleNumberClick(num)}
                      className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-purple-400 to-pink-400 text-white rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}

              {/* 提交按钮 / 已提交状态 */}
              {!submitted ? (
                <button
                  onClick={handleSubmit}
                  className="w-full py-4 bg-gradient-to-r from-emerald-400 to-teal-400 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <Icon name="CheckCircle" className="w-6 h-6" />提交答案
                </button>
              ) : (
                <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
                  <div className="text-4xl mb-2">&#x2705;</div>
                  <h3 className="text-xl font-bold text-slate-700 mb-1">已提交！</h3>
                  <p className="text-3xl font-bold text-purple-600 mb-2">{myScore} 分</p>
                  <p className="text-slate-400 text-sm">等待比赛结束查看最终排名...</p>
                </div>
              )}
            </>
          )}

          {/* Step 5: 比赛结束 */}
          {step === STEP.ENDED && (
            <div className="bg-white rounded-3xl p-8 shadow-xl text-center">
              <div className="text-5xl mb-3">&#x1F3C1;</div>
              <h2 className="text-2xl font-bold text-slate-700 mb-2">比赛结束！</h2>
              {myScore !== null ? (
                <div className="mb-4">
                  <p className="text-slate-500">你的得分</p>
                  <p className="text-4xl font-bold text-purple-600">{myScore}</p>
                </div>
              ) : (
                <p className="text-red-400 mb-4">未提交答案</p>
              )}
              <button
                onClick={() => { SoundManager.playClick(); clearPersistedState(); onBack(); }}
                className="px-6 py-3 bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                返回首页
              </button>
            </div>
          )}
        </div>

        {/* 右侧：迷你排行榜 */}
        {(step === STEP.PLAYING || step === STEP.SUBMITTED || step === STEP.ENDED) && (
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
              <h3 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                <Icon name="Trophy" className="w-4 h-4 text-yellow-400" />实时排行
              </h3>
              {leaderboard.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 9).map((p, i) => {
                    const s = p.score ?? calcScoreFallback(p);
                    const isMe = p.name === playerName;
                    return (
                      <div
                        key={p.id || p.name}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                          isMe ? 'bg-purple-100 border border-purple-300' : 'bg-slate-50'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-yellow-400 text-white' :
                          i === 1 ? 'bg-slate-300 text-slate-700' :
                          i === 2 ? 'bg-amber-600 text-white' :
                          'bg-slate-200 text-slate-500'
                        }`}>
                          {i + 1}
                        </span>
                        <span className={`flex-1 truncate font-medium ${isMe ? 'text-purple-700' : 'text-slate-700'}`}>
                          {p.name}
                        </span>
                        <span className={`font-mono font-bold tabular-nums ${isMe ? 'text-purple-600' : 'text-slate-500'}`}>
                          {s}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}