import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from './Icon';
import SoundManager from '../hooks/useSound';
import {
  fetchActiveLeaderboard,
  fetchCompetitionStatus,
  startCompetition,
  startPrepPhase,
  resetCompetition,
  clearAllData,
} from '../api';

export default function Ranking({ onBack }) {
  const [activePlayers, setActivePlayers] = useState([]);
  const [competition, setCompetition] = useState({
    isActive: false, totalSeconds: 300, remainingSeconds: 300, prepPhase: false,
  });
  const [prepCountdown, setPrepCountdown] = useState(5);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // 用于动画：记录上一次排名顺序
  const prevOrderRef = useRef([]);
  const [rankAnim, setRankAnim] = useState({}); // { playerId: { fromRank, toRank } }

  // ── 数据轮询 ──
  const loadAll = useCallback(async () => {
    try {
      try {
        const active = await fetchActiveLeaderboard();
        // 计算排名动画
        const newOrder = active.map(p => p.id || p.name);
        const prevOrder = prevOrderRef.current;
        if (prevOrder.length > 0) {
          const anim = {};
          newOrder.forEach((id, newRank) => {
            const oldRank = prevOrder.indexOf(id);
            if (oldRank >= 0 && oldRank !== newRank) {
              anim[id] = { fromRank: oldRank, toRank: newRank };
            }
          });
          if (Object.keys(anim).length > 0) {
            setRankAnim(anim);
            setTimeout(() => setRankAnim({}), 500); // 动画持续 500ms
          }
        }
        prevOrderRef.current = newOrder;
        setActivePlayers(active);
      } catch {
        setActivePlayers(lsGet('sudoku_activePlayers') || []);
      }
      try {
        const comp = await fetchCompetitionStatus();
        setCompetition(comp);
      } catch { /* 降级 */ }
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    }
  }, []);

  // localStorage 辅助
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }

  // 排行榜每 2 秒、计时器每 1 秒刷新
  useEffect(() => {
    loadAll();
    const leaderboardTimer = setInterval(async () => {
      try {
        const activeRes = await fetchActiveLeaderboard();
        // 排名动画
        const newOrder = activeRes.map(p => p.id || p.name);
        const prevOrder = prevOrderRef.current;
        if (prevOrder.length > 0) {
          const anim = {};
          newOrder.forEach((id, newRank) => {
            const oldRank = prevOrder.indexOf(id);
            if (oldRank >= 0 && oldRank !== newRank) {
              anim[id] = { fromRank: oldRank, toRank: newRank };
            }
          });
          if (Object.keys(anim).length > 0) {
            setRankAnim(anim);
            setTimeout(() => setRankAnim({}), 500);
          }
        }
        prevOrderRef.current = newOrder;
        setActivePlayers(activeRes);
      } catch {
        setActivePlayers(lsGet('sudoku_activePlayers') || []);
      }
    }, 2000);

    const compTimer = setInterval(async () => {
      try {
        const comp = await fetchCompetitionStatus();
        setCompetition(comp);
      } catch { /* 降级 */ }
    }, 1000);

    return () => {
      clearInterval(leaderboardTimer);
      clearInterval(compTimer);
    };
  }, [loadAll]);

  // ── 预备倒计时 ──
  const [isPrepPhase, setIsPrepPhase] = useState(false);
  const [localPrepCountdown, setLocalPrepCountdown] = useState(5);

  useEffect(() => {
    if (competition.prepPhase && !isPrepPhase) {
      setIsPrepPhase(true);
      setLocalPrepCountdown(5);
    }
  }, [competition.prepPhase]);

  useEffect(() => {
    let i;
    if (isPrepPhase && localPrepCountdown > 0) {
      i = setInterval(() => setLocalPrepCountdown(c => c - 1), 1000);
    } else if (isPrepPhase && localPrepCountdown === 0) {
      setIsPrepPhase(false);
      setLocalPrepCountdown(5);
      startCompetition(300);
    }
    return () => clearInterval(i);
  }, [isPrepPhase, localPrepCountdown]);

  // ── 操作 ──
  const handleStartPrep = async () => {
    SoundManager.playClick();
    try {
      await startPrepPhase();
      setIsPrepPhase(true);
      setLocalPrepCountdown(5);
    } catch { /* 降级 */ }
    await loadAll();
  };

  const handleReset = async () => {
    SoundManager.playClick();
    try {
      await resetCompetition();
      setIsPrepPhase(false);
      setLocalPrepCountdown(5);
    } catch { /* 降级 */ }
    await loadAll();
  };

  const handleClear = async () => {
    SoundManager.playClick();
    await clearAllData();
    await loadAll();
    setShowConfirmClear(false);
  };

  // ── 格式化 ──
  const formatTime = secs => {
    const m = Math.floor(secs / 60), r = secs % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  };

  // 排名图标/颜色
  const rankConfig = [
    { bg: 'from-yellow-400 to-amber-500', icon: 'Crown', text: 'text-yellow-100' },
    { bg: 'from-slate-300 to-slate-400', icon: 'Medal', text: 'text-slate-800' },
    { bg: 'from-amber-600 to-orange-700', icon: 'Star', text: 'text-amber-100' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-3xl mx-auto">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-xl text-white hover:bg-white/20 border border-white/20"
          >
            <Icon name="ArrowLeft" className="w-5 h-5" />返回
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <Icon name="Crown" className="w-10 h-10 text-yellow-400" />
              王牌侦探排行榜
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-slate-400 text-sm hidden md:block">
              <div className="flex items-center gap-2">
                <Icon name={isOffline ? 'WifiOff' : 'Activity'} className={`w-4 h-4 ${isOffline ? 'text-red-400' : 'text-emerald-400'}`} />
                {isOffline ? '离线模式' : '实时更新'}
              </div>
            </div>
            <button
              onClick={() => setShowConfirmClear(true)}
              className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all border border-red-500/30"
              title="清空数据"
            >
              <Icon name="Trash2" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 比赛控制栏 */}
        <div className="flex items-center justify-between mb-6 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <Icon name="Trophy" className="w-6 h-6 text-yellow-400" />
            <span className="text-white font-bold">实时竞技</span>
            <span className="text-slate-400 text-sm">({activePlayers.length}人)</span>
          </div>
          <div className="flex items-center gap-4">
            {isPrepPhase ? (
              <span className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg animate-pulse">
                <span className="text-amber-400 font-bold">预备</span>
                <span className="font-mono font-bold text-amber-400 text-xl">{localPrepCountdown}</span>
              </span>
            ) : (
              <span className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${
                competition.isActive
                  ? 'bg-emerald-500/20 border-emerald-500/30'
                  : 'bg-slate-500/20 border-slate-500/30'
              }`}>
                <Icon name="Clock" className="w-4 h-4 text-white" />
                <span className="font-mono font-bold text-white">
                  {competition.isActive
                    ? formatTime(competition.remainingSeconds)
                    : formatTime(competition.totalSeconds)}
                </span>
              </span>
            )}
            {!competition.isActive && !isPrepPhase && (
              <button
                onClick={handleStartPrep}
                className="px-4 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium"
              >
                开始倒计时
              </button>
            )}
            {(competition.isActive || isPrepPhase) && (
              <button
                onClick={handleReset}
                className="px-4 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium"
              >
                重置
              </button>
            )}
          </div>
        </div>

        {/* 垂直排名列表 */}
        <div className="space-y-3">
          {activePlayers.length === 0 && (
            <div className="text-center text-slate-500 py-12 text-lg">
              暂无选手数据，开始挑战后这里会实时显示排名
            </div>
          )}
          {activePlayers.map((player, index) => {
            const rc = rankConfig[index] || { bg: 'from-slate-600 to-slate-700', icon: 'User', text: 'text-white' };
            const details = player.levelDetails || [];
            const totalW = player.wrongCells ?? details.reduce((s, d) => s + (d.wrongCells || 0), 0);
            const totalE = player.emptyCells ?? details.reduce((s, d) => s + (d.emptyCells || 0), 0);
            const anim = rankAnim[player.id || player.name];

            return (
              <div
                key={player.id || player.name}
                className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-white/10 to-white/5 border border-white/20
                  transition-all duration-500 ease-in-out
                  ${anim ? 'translate-y-0 opacity-100' : ''}
                `}
                style={
                  anim
                    ? {
                        transform: `translateY(${(anim.toRank - anim.fromRank) * 80}px)`,
                        transition: 'transform 500ms ease-in-out, opacity 300ms ease-in-out',
                        opacity: 0.7,
                      }
                    : {}
                }
              >
                <div className="flex items-center gap-4">
                  {/* 排名圆标 */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${rc.bg} flex items-center justify-center shadow-lg z-10`}>
                    {index < 3 ? (
                      <Icon name={rc.icon} className={`w-6 h-6 ${rc.text}`} />
                    ) : (
                      <span className="text-white font-bold text-lg">{index + 1}</span>
                    )}
                  </div>

                  {/* 选手信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white truncate">{player.name}</h3>
                      {player.isCompleted && (
                        <span className="inline-block px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-xs rounded-full flex-shrink-0">
                          已通关
                        </span>
                      )}
                    </div>
                    {/* 进度条 */}
                    <div className="mt-1 w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${player.progress ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* 数据指标 */}
                  <div className="flex gap-3 flex-shrink-0 items-center">
                    {/* 积分（主排名依据） */}
                    <div className="text-center bg-emerald-500/10 rounded-lg px-3 py-1.5 border border-emerald-500/20">
                      <p className="text-emerald-400 text-xs font-medium">积分</p>
                      <p className="text-emerald-300 font-mono font-bold text-lg">{player.score ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">用时</p>
                      <p className="text-white font-mono font-bold text-sm">{formatTime(player.totalTime || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">错误</p>
                      <p className="text-red-400 font-mono font-bold text-sm">{totalW}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">未填</p>
                      <p className="text-amber-400 font-mono font-bold text-sm">{totalE}</p>
                    </div>
                  </div>

                  {/* 关卡进度小点 */}
                  <div className="flex gap-1 flex-shrink-0">
                    {[1, 2, 3, 4].map(lv => {
                      const done = details.some(d => d.level === lv);
                      return (
                        <div
                          key={lv}
                          className={`w-3 h-3 rounded-full ${done ? 'bg-emerald-400' : 'bg-slate-600'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 确认清空弹窗 */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-white/20">
            <h3 className="text-xl font-bold text-white text-center mb-2">确认清空</h3>
            <p className="text-slate-400 text-center mb-6">此操作将清空所有选手数据，不可撤销！</p>
            <div className="flex gap-3">
              <button
                onClick={() => { SoundManager.playClick(); setShowConfirmClear(false); }}
                className="flex-1 py-3 bg-slate-600 text-white rounded-xl font-semibold hover:bg-slate-500"
              >
                取消
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
