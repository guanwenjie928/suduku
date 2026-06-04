import { useState, useEffect } from 'react';
import Icon from './Icon';
import SoundManager from '../hooks/useSound';
import { formatTime } from '../utils/time';
import {
  openRoom,
  startRoom,
  endRoom,
  resetRoom,
  fetchRoomStatus,
  fetchRoomStats,
} from '../api';

const ROOM_TOTAL_SECONDS = 120;
const ROOM_WARNING_SECONDS = 30;
const TIMER_POLL_MS = 1000;
const STATS_POLL_MS = 2000;
const RACE_TOTAL_CELLS = 16;

export default function CompetitionBigScreen({ onBack }) {
  const [room, setRoom] = useState({
    roomStatus: 'idle',
    roomTotalSeconds: ROOM_TOTAL_SECONDS,
    roomRemainingSeconds: ROOM_TOTAL_SECONDS,
  });
  const [roomStats, setRoomStats] = useState({
    totalPlayers: 0,
    completedPlayers: 0,
    averageAccuracy: 0,
    totalCorrectSteps: 0,
    totalIncorrectSteps: 0,
    averageStepAccuracy: 0,
    leaderName: null,
    leaderScore: 0,
    rankings: [],
    joinedPlayers: [],
  });

  // ── 房间状态轮询 ──
  useEffect(() => {
    const pollRoom = async () => {
      try {
        const rs = await fetchRoomStatus();
        setRoom(rs);
      } catch (err) {
        console.error('Room status poll failed:', err);
      }
    };
    pollRoom();
    const timer = setInterval(pollRoom, TIMER_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // ── 统计数据轮询 ──
  useEffect(() => {
    const pollStats = async () => {
      try {
        const stats = await fetchRoomStats();
        setRoomStats(stats);
      } catch (err) {
        console.error('Room stats poll failed:', err);
      }
    };
    pollStats();
    const timer = setInterval(pollStats, STATS_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // ── 背景音乐与音效管理 ──
  useEffect(() => {
    if (room.roomStatus === 'active') {
      SoundManager.playTenseBGM();
    } else if (room.roomStatus === 'ended') {
      SoundManager.stopTenseBGM();
      SoundManager.playTimerEnd();
    }
    return () => {
      SoundManager.stopTenseBGM();
    };
  }, [room.roomStatus]);

  // ── 操作处理 ──
  const handleOpenRoom = async () => {
    SoundManager.playClick();
    try { await openRoom(); } catch (err) { console.error('Open room failed:', err); }
  };
  const handleStartRoom = async () => {
    SoundManager.playClick();
    try { await startRoom(); } catch (err) { console.error('Start room failed:', err); }
  };
  const handleEndRoom = async () => {
    SoundManager.playClick();
    try { await endRoom(); } catch (err) { console.error('End room failed:', err); }
  };
  const handleResetRoom = async () => {
    SoundManager.playClick();
    try { await resetRoom(); } catch (err) { console.error('Reset room failed:', err); }
  };

  // ── 状态徽章 ──
  const statusBadge = () => {
    switch (room.roomStatus) {
      case 'idle':
        return { text: '空闲', cls: 'bg-slate-500/30 text-slate-400', icon: 'Circle' };
      case 'lobby':
        return { text: '等待选手加入', cls: 'bg-yellow-500/20 text-yellow-400', icon: 'Clock' };
      case 'active':
        return { text: '比赛中', cls: 'bg-emerald-500/20 text-emerald-400 animate-pulse', icon: 'Zap' };
      case 'ended':
        return { text: '已结束', cls: 'bg-red-500/20 text-red-400', icon: 'Flag' };
      default:
        return { text: '未知', cls: 'bg-slate-500/30 text-slate-400', icon: 'Circle' };
    }
  };

  const badge = statusBadge();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4">
      <div className="max-w-5xl mx-auto">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm rounded-xl text-white hover:bg-white/20 border border-white/20 transition-all"
          >
            <Icon name="ArrowLeft" className="w-5 h-5" />返回
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <span className="inline-block rounded-full p-1 bg-purple-500/20">
                <Icon name="Zap" className="w-8 h-8 text-purple-400" />
              </span>
              竞技模式大屏
            </h1>
            <p className="text-slate-400 text-xs mt-1">教师控制面板</p>
          </div>
          <div className="w-20" /> {/* 占位，保持居中 */}
        </div>

        {/* 控制面板 */}
        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* 状态信息 */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${badge.cls}`}>
                <Icon name={badge.icon} className="w-5 h-5" />
                <span className="font-bold text-lg">{badge.text}</span>
              </div>
              {room.roomStatus === 'active' && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                  room.roomRemainingSeconds <= ROOM_WARNING_SECONDS
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-purple-500/10 border-purple-500/30'
                }`}>
                  <Icon name="Clock" className={`w-5 h-5 ${
                    room.roomRemainingSeconds <= ROOM_WARNING_SECONDS ? 'text-red-400' : 'text-purple-400'
                  }`} />
                  <span className={`font-mono font-bold text-2xl tabular-nums ${
                    room.roomRemainingSeconds <= ROOM_WARNING_SECONDS ? 'text-red-400' : 'text-white'
                  }`}>
                    {formatTime(room.roomRemainingSeconds)}
                  </span>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-3">
              {room.roomStatus === 'idle' && (
                <button
                  onClick={handleOpenRoom}
                  className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold text-lg transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30 flex items-center gap-2"
                >
                  <Icon name="Zap" className="w-5 h-5" />开启房间
                </button>
              )}
              {room.roomStatus === 'lobby' && (
                <>
                  <button
                    onClick={handleStartRoom}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/30 animate-pulse flex items-center gap-2"
                  >
                    <Icon name="Zap" className="w-5 h-5" />开始比赛
                  </button>
                  <button
                    onClick={handleEndRoom}
                    className="px-4 py-3 bg-red-500/80 hover:bg-red-600 text-white rounded-xl font-medium transition-all duration-300 flex items-center gap-2"
                  >
                    <Icon name="XCircle" className="w-5 h-5" />关闭房间
                  </button>
                </>
              )}
              {room.roomStatus === 'active' && (
                <button
                  onClick={handleEndRoom}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-lg transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 flex items-center gap-2"
                >
                  <Icon name="Flag" className="w-5 h-5" />结束比赛
                </button>
              )}
              {room.roomStatus === 'ended' && (
                <button
                  onClick={handleResetRoom}
                  className="px-6 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-2"
                >
                  <Icon name="RotateCcw" className="w-5 h-5" />重置房间
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
            <Icon name="Users" className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-slate-400 text-xs mb-1">参与小组</p>
            <p className="text-3xl font-bold text-white font-mono tabular-nums">{roomStats.totalPlayers}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
            <Icon name="CheckCircle" className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-slate-400 text-xs mb-1">已完成</p>
            <p className="text-3xl font-bold text-emerald-400 font-mono tabular-nums">
              {roomStats.completedPlayers}
              <span className="text-base text-slate-500">/{roomStats.totalPlayers}</span>
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
            <Icon name="Target" className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-slate-400 text-xs mb-1">格子正确率</p>
            <p className="text-3xl font-bold text-yellow-400 font-mono tabular-nums">{roomStats.averageAccuracy}%</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
            <Icon name="Activity" className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-slate-400 text-xs mb-1">步数正确率</p>
            <p className="text-3xl font-bold text-purple-400 font-mono tabular-nums">{roomStats.averageStepAccuracy}%</p>
          </div>
        </div>

        {/* 步数统计卡片 */}
        {roomStats.totalPlayers > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
              <Icon name="CheckCircle" className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-400 text-xs mb-1">全组正确步数</p>
              <p className="text-3xl font-bold text-emerald-400 font-mono tabular-nums">{roomStats.totalCorrectSteps}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
              <Icon name="XCircle" className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-slate-400 text-xs mb-1">全组错误步数</p>
              <p className="text-3xl font-bold text-red-400 font-mono tabular-nums">{roomStats.totalIncorrectSteps}</p>
            </div>
          </div>
        )}

        {/* 加入小组列表（lobby 阶段） */}
        {room.roomStatus !== 'active' && room.roomStatus !== 'ended' && roomStats.joinedPlayers && roomStats.joinedPlayers.length > 0 && (
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6 mb-6">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Icon name="Users" className="w-5 h-5 text-yellow-400" />已加入小组 ({roomStats.joinedPlayers.length})
            </h2>
            <div className="flex flex-wrap gap-3">
              {roomStats.joinedPlayers.map((name, i) => (
                <div
                  key={name}
                  className="px-5 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-lg"
                  style={{ animation: `toastIn 0.3s ease-out ${i * 0.1}s both` }}
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 排名详情表 */}
        {roomStats.rankings.length > 0 ? (
          <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Icon name="BarChart3" className="w-5 h-5 text-purple-400" />竞技排名
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="px-6 py-3 font-medium">排名</th>
                    <th className="px-6 py-3 font-medium">小组</th>
                    <th className="px-6 py-3 font-medium text-center">积分</th>
                    <th className="px-6 py-3 font-medium text-center">用时</th>
                    <th className="px-6 py-3 font-medium text-center">正确格</th>
                    <th className="px-6 py-3 font-medium text-center">错误格</th>
                    <th className="px-6 py-3 font-medium text-center">未填</th>
                    <th className="px-6 py-3 font-medium text-center">正确步</th>
                    <th className="px-6 py-3 font-medium text-center">错误步</th>
                    <th className="px-6 py-3 font-medium text-center">步准确率</th>
                    <th className="px-6 py-3 font-medium text-center">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {roomStats.rankings.map((r, i) => {
                    const rankBg = i === 0 ? 'bg-yellow-400/20' : i === 1 ? 'bg-slate-300/15' : i === 2 ? 'bg-amber-600/20' : '';
                    const MEDALS = ['&#x1F947;', '&#x1F948;', '&#x1F949;'];
                    const rankNum = MEDALS[i] || i + 1;
                    const correctCells = RACE_TOTAL_CELLS - r.wrongCells - r.emptyCells;
                    return (
                      <tr key={r.name} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${rankBg}`}>
                        <td className="px-6 py-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            i === 0 ? 'text-yellow-400' :
                            i === 1 ? 'text-slate-300' :
                            i === 2 ? 'text-amber-600' :
                            'text-slate-400'
                          }`}>
                            {rankNum}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-white font-bold">{r.name}</span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="font-mono font-bold text-lg text-purple-300">{r.score}</span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="font-mono text-slate-300">{formatTime(r.timeSeconds)}</span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="font-mono font-bold text-emerald-400">{correctCells}</span>
                          <span className="text-slate-500 text-xs">/{RACE_TOTAL_CELLS}</span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`font-mono font-bold ${r.wrongCells > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {r.wrongCells}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`font-mono font-bold ${r.emptyCells > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                            {r.emptyCells}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="font-mono text-emerald-400">{r.correctSteps ?? 0}</span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`font-mono ${(r.incorrectSteps ?? 0) > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {r.incorrectSteps ?? 0}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`font-mono font-bold ${
                            (r.stepAccuracy ?? 0) >= 80 ? 'text-emerald-400' :
                            (r.stepAccuracy ?? 0) >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {r.stepAccuracy ?? 0}%
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          {r.isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                              <Icon name="CheckCircle" className="w-3 h-3" />完成
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                              <Icon name="Clock" className="w-3 h-3" />未完成
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 rounded-3xl border border-white/10 p-12 text-center">
            <div className="text-4xl mb-4">&#x1F3AF;</div>
            <p className="text-slate-400 text-lg mb-2">
              {room.roomStatus === 'idle' ? '点击「开启房间」开始竞技' :
               room.roomStatus === 'lobby' ? '等待选手加入，然后点击「开始比赛」' :
               room.roomStatus === 'active' ? '比赛进行中，等待选手提交...' :
               '比赛已结束'}
            </p>
            <p className="text-slate-500 text-sm">
              {room.roomStatus === 'idle' ? '所有小组将统一时间开始答题' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}