import { useState, useEffect, useCallback } from 'react';
import Icon from './Icon';
import SoundManager from '../hooks/useSound';
import {
  fetchActiveLeaderboard,
  fetchHistoryLeaderboard,
  fetchCompetitionStatus,
  startCompetition,
  startPrepPhase,
  resetCompetition,
  clearAllData,
} from '../api';

export default function Ranking({ onBack }) {
  const [activePlayers, setActivePlayers] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [competition, setCompetition] = useState({
    isActive: false, totalSeconds: 300, remainingSeconds: 300, prepPhase: false,
  });
  const [prepCountdown, setPrepCountdown] = useState(5);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // ── 数据轮询 ──
  const loadAll = useCallback(async () => {
    try {
      // 逐个请求，互不影响
      try {
        const active = await fetchActiveLeaderboard();
        setActivePlayers(active);
      } catch {
        // 静默失败，保留当前状态
      }
      try {
        const history = await fetchHistoryLeaderboard();
        setHistoryRecords(history);
      } catch {
        // 静默失败，保留当前状态
      }
      try {
        const comp = await fetchCompetitionStatus();
        setCompetition(comp);
      } catch {
        // 静默失败，保留当前状态
      }
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    }
  }, []);

  // 排行榜每 2 秒、计时器每 1 秒刷新
  useEffect(() => {
    loadAll();
    const leaderboardTimer = setInterval(async () => {
      try {
        const activeRes = await fetchActiveLeaderboard();
        setActivePlayers(activeRes);
      } catch {
        setActivePlayers(lsGet('sudoku_activePlayers') || []);
      }
      try {
        const historyRes = await fetchHistoryLeaderboard();
        setHistoryRecords(historyRes);
      } catch {
        setHistoryRecords(lsGet('sudoku_historyRecords') || []);
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

  // 同步服务端的 prepPhase 到本地状态
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
      // 预备结束 -> 开始比赛
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
    // 立刻同步状态
    await loadAll();
  };

  const handleReset = async () => {
    SoundManager.playClick();
    try {
      await resetCompetition();
      setIsPrepPhase(false);
      setLocalPrepCountdown(5);
    } catch { /* 降级 */ }
    // 立刻同步状态
    await loadAll();
  };

  const handleClear = async () => {
    SoundManager.playClick();
    await clearAllData();
    // 立刻重新加载，确保状态同步
    await loadAll();
    setShowConfirmClear(false);
  };

  // ── 格式化 ──
  const formatTime = secs => {
    const m = Math.floor(secs / 60), r = secs % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  };
  const formatDate = d => {
    if (!d) return '--';
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
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
                <Icon name="Activity" className={`w-4 h-4 ${isOffline ? 'text-red-400' : 'text-emerald-400'}`} />
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

        {/* ── 实时竞技 ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full animate-pulse ${isOffline ? 'bg-red-400' : 'bg-emerald-400'}`} />
              实时竞技 ({activePlayers.length}人进行中)
            </h2>
            <div className="flex items-center gap-4">
              {/* 倒计时显示 */}
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
                  <Icon name="Clock" className="w-4 h-4" />
                  <span className="font-mono font-bold">
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

          {/* 选手卡片 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {activePlayers.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-8">
                暂无选手数据，开始挑战后这里会实时显示排名
              </div>
            )}
            {activePlayers.map((player, index) => {
              // 计算排名色
              const rankColors = [
                'from-yellow-400 to-amber-500',
                'from-slate-300 to-slate-400',
                'from-amber-600 to-orange-700',
              ];
              const rankIcons = ['Crown', 'Medal', 'Star'];
              const rankColor = index < 3 ? rankColors[index] : 'from-teal-400 to-cyan-500';

              const details = player.levelDetails || [];
              const totalW = player.wrongCells ?? details.reduce((s, d) => s + (d.wrongCells || 0), 0);
              const totalE = player.emptyCells ?? details.reduce((s, d) => s + (d.emptyCells || 0), 0);

              return (
                <div key={player.id || player.name} className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-white/10 to-white/5 border border-white/20">
                  {/* 排名角标 */}
                  <div className={`absolute -top-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-br ${rankColor} flex items-center justify-center shadow-lg`}>
                    <span className="text-white font-bold text-lg">{index + 1}</span>
                  </div>
                  {index < 3 && (
                    <Icon name={rankIcons[index]} className="absolute top-2 left-3 w-5 h-5 text-yellow-400" />
                  )}

                  <h3 className="text-xl font-bold text-white mb-3 mt-2">{player.name}</h3>

                  {/* 进度条 */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>进度</span><span>{player.progress ?? 0}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all"
                        style={{ width: `${player.progress ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* 数据指标 */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center bg-white/5 rounded-lg p-2">
                      <p className="text-slate-400 text-xs">用时</p>
                      <p className="text-white font-mono font-bold text-sm">{formatTime(player.totalTime || 0)}</p>
                    </div>
                    <div className="text-center bg-white/5 rounded-lg p-2">
                      <p className="text-slate-400 text-xs">错误</p>
                      <p className="text-red-400 font-mono font-bold text-sm">{totalW}</p>
                    </div>
                    <div className="text-center bg-white/5 rounded-lg p-2">
                      <p className="text-slate-400 text-xs">未填</p>
                      <p className="text-amber-400 font-mono font-bold text-sm">{totalE}</p>
                    </div>
                  </div>

                  {/* 关卡状态 */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(lv => {
                      const done = details.some(d => d.level === lv);
                      return (
                        <div
                          key={lv}
                          className={`flex-1 h-1.5 rounded-full ${done ? 'bg-emerald-400' : 'bg-slate-600'}`}
                        />
                      );
                    })}
                  </div>

                  {(player.isCompleted) && (
                    <div className="mt-2 text-center">
                      <span className="inline-block px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-xs rounded-full">
                        已通关
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 历史排行榜 ── */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <Icon name="Trophy" className="w-6 h-6 text-yellow-400" />
            历史排行榜
          </h2>
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-slate-400 text-sm font-medium">排名</th>
                  <th className="px-4 py-3 text-left text-slate-400 text-sm font-medium">小组</th>
                  <th className="px-4 py-3 text-center text-slate-400 text-sm font-medium">关卡</th>
                  <th className="px-4 py-3 text-center text-slate-400 text-sm font-medium">用时</th>
                  <th className="px-4 py-3 text-center text-slate-400 text-sm font-medium">错误</th>
                  <th className="px-4 py-3 text-center text-slate-400 text-sm font-medium">日期</th>
                </tr>
              </thead>
              <tbody>
                {historyRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      暂无通关记录，成为第一个通关的小组吧！
                    </td>
                  </tr>
                )}
                {historyRecords.map((record, index) => (
                  <tr key={record.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index === 0 ? 'bg-yellow-400/5' : ''}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        index === 0 ? 'bg-yellow-400 text-slate-900' :
                        index === 1 ? 'bg-slate-300 text-slate-800' :
                        index === 2 ? 'bg-amber-600 text-white' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold">{record.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-teal-400 font-mono">{record.completedLevels}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-white font-mono">{formatTime(record.totalTime)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-red-400 font-mono">{record.wrongCells || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-slate-400 text-sm">{formatDate(record.date)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 确认清空弹窗 */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-white/20">
            <h3 className="text-xl font-bold text-white text-center mb-2">确认清空</h3>
            <p className="text-slate-400 text-center mb-6">此操作将清空所有选手和排行榜数据，不可撤销！</p>
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
