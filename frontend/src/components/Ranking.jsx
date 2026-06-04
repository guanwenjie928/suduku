import { useState, useEffect, useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import Icon from './Icon';
import SoundManager from '../hooks/useSound';
import RankingFire from './RankingFire';
import { formatTime } from '../utils/time';
import './ranking-fire.css';
import {
  fetchActiveLeaderboard,
  fetchCompetitionStatus,
  startCompetition,
  startPrepPhase,
  resetCompetition,
  clearAllData,
  clearRankingData,
  lsGet,
} from '../api';

// ── 常量 ──
const PREP_COUNTDOWN_SECONDS = 3;
const DEFAULT_TOTAL_SECONDS = 180;
const LAVA_MODE_THRESHOLD_SECONDS = 60;
const LEADERBOARD_POLL_MS = 2000;
const TIMER_POLL_MS = 1000;
const RANK_ANIMATION_DURATION_MS = 500;

export default function Ranking({ onBack }) {
  const [activePlayers, setActivePlayers] = useState([]);
  const [competition, setCompetition] = useState({
    isActive: false, totalSeconds: DEFAULT_TOTAL_SECONDS, remainingSeconds: DEFAULT_TOTAL_SECONDS, prepPhase: false,
  });
  const [prepCountdown, setPrepCountdown] = useState(PREP_COUNTDOWN_SECONDS);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // 用于动画：记录上一次排名顺序
  const prevOrderRef = useRef([]);
  const [rankAnim, setRankAnim] = useState({}); // { playerId: { fromRank, toRank } }
  const timerEndPlayedRef = useRef(false); // 防止重复播放计时结束音效

  // ── 火焰效果专用 refs ──
  const cardRefs = useRef({});       // 小组卡片 DOM 引用
  const prevScoresRef = useRef({});   // 上一次分数快照
  const scoreElRefs = useRef({});     // 积分数字 DOM 引用
  const newPlayerIdsRef = useRef(new Set()); // 新加入的小组
  const playerListRef = useRef(null); // 排名列表容器

  // ── 数据轮询 ──
  const loadAll = useCallback(async () => {
    try {
      try {
        const active = await fetchActiveLeaderboard();
        // 预计算每个玩家的合计值，避免每次渲染时重复 reduce
        active.forEach(p => {
          const details = p.levelDetails || [];
          if (p.wrongCells == null) {
            p.wrongCells = details.reduce((s, d) => s + (d.wrongCells || 0), 0);
          }
          if (p.emptyCells == null) {
            p.emptyCells = details.reduce((s, d) => s + (d.emptyCells || 0), 0);
          }
        });
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
            setTimeout(() => setRankAnim({}), RANK_ANIMATION_DURATION_MS); // 动画持续 500ms
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
            setTimeout(() => setRankAnim({}), RANK_ANIMATION_DURATION_MS);
          }
        }
        prevOrderRef.current = newOrder;
        // 预计算每个玩家的合计值
        activeRes.forEach(p => {
          const details = p.levelDetails || [];
          if (p.wrongCells == null) {
            p.wrongCells = details.reduce((s, d) => s + (d.wrongCells || 0), 0);
          }
          if (p.emptyCells == null) {
            p.emptyCells = details.reduce((s, d) => s + (d.emptyCells || 0), 0);
          }
        });
        setActivePlayers(activeRes);
      } catch {
        setActivePlayers(lsGet('sudoku_activePlayers') || []);
      }
    }, LEADERBOARD_POLL_MS);

    const compTimer = setInterval(async () => {
      try {
        const comp = await fetchCompetitionStatus();
        setCompetition(prev => {
          if (prev?.remainingSeconds === comp.remainingSeconds && prev?.isActive === comp.isActive) {
            return prev;
          }
          return comp;
        });
      } catch { /* 降级 */ }
    }, TIMER_POLL_MS);

    return () => {
      clearInterval(leaderboardTimer);
      clearInterval(compTimer);
    };
  }, [loadAll]);

  // ── 预备倒计时 ──
  const [isPrepPhase, setIsPrepPhase] = useState(false);
  const [localPrepCountdown, setLocalPrepCountdown] = useState(3);

  useEffect(() => {
    if (competition.prepPhase && !isPrepPhase) {
      setIsPrepPhase(true);
      setLocalPrepCountdown(3);
    }
  }, [competition.prepPhase]);

  useEffect(() => {
    let i;
    if (isPrepPhase && localPrepCountdown > 0) {
      i = setInterval(() => setLocalPrepCountdown(c => c - 1), TIMER_POLL_MS);
    } else if (isPrepPhase && localPrepCountdown === 0) {
      setIsPrepPhase(false);
      setLocalPrepCountdown(3);
      startCompetition(180);
    }
    return () => clearInterval(i);
  }, [isPrepPhase, localPrepCountdown]);

  // ── 倒计时音效：每次递减 beep，归零 Go! ──
  useEffect(() => {
    if (!isPrepPhase) return;
    if (localPrepCountdown === 2 || localPrepCountdown === 1) {
      SoundManager.playCountdownBeep();
    } else if (localPrepCountdown === 0) {
      SoundManager.playGo();
    }
  }, [localPrepCountdown, isPrepPhase]);

  // ── GSAP 火焰动画层 ──

  // 1. 积分变化 → 火焰爆发
  useGSAP(() => {
    activePlayers.forEach(player => {
      const id = player.id || player.name;
      const prev = prevScoresRef.current[id];
      if (prev !== undefined && prev !== player.score) {
        // 积分变化 → 积分数字弹跳
        const el = scoreElRefs.current[id];
        if (el) {
          gsap.fromTo(el,
            { scale: 1, textShadow: '0 0 0px rgba(251,191,36,0)' },
            { scale: 1.4, textShadow: '0 0 30px rgba(251,191,36,0.8)', duration: 0.25, ease: 'power2.out',
              onComplete: () => {
                gsap.to(el, { scale: 1, textShadow: '0 0 0px rgba(251,191,36,0)', duration: 0.3, ease: 'power2.in' });
              }
            }
          );
        }

        // 卡片光晕爆发
        const card = cardRefs.current[id];
        if (card) {
          const delta = player.score - prev;
          const glowColor = delta > 0 ? 'rgba(74,222,128,0.7)' : 'rgba(239,68,68,0.7)';
          gsap.fromTo(card,
            { boxShadow: `0 0 0px ${glowColor.replace('0.7', '0')}` },
            { boxShadow: `0 0 60px ${glowColor}`, duration: 0.25, ease: 'power2.out',
              onComplete: () => {
                gsap.to(card, { boxShadow: '0 0 20px rgba(251,146,60,0.3)', duration: 0.5, ease: 'power2.in' });
              }
            }
          );
        }
      }
      prevScoresRef.current[id] = player.score;
    });
  }, [activePlayers]);

  // 2. 排名变化动画 (FLIP 风格换位)
  useGSAP(() => {
    const cards = Object.values(cardRefs.current).filter(Boolean);
    if (cards.length < 2) return;

    cards.forEach(card => {
      const playerId = Object.keys(cardRefs.current).find(k => cardRefs.current[k] === card);
      const anim = rankAnim[playerId];
      if (!anim) return;

      const delta = anim.toRank - anim.fromRank;
      if (delta < 0) {
        // 排名上升 → 绿焰 + 上飘
        gsap.fromTo(card,
          { boxShadow: '0 0 0px rgba(74,222,128,0)', borderColor: 'rgba(255,255,255,0.1)' },
          { boxShadow: '0 0 60px rgba(74,222,128,0.8)', borderColor: 'rgba(74,222,128,0.8)', duration: 0.4, ease: 'power2.out',
            onComplete: () => {
              gsap.to(card, { boxShadow: '0 0 20px rgba(251,146,60,0.3)', borderColor: 'rgba(255,255,255,0.15)', duration: 0.6 });
            }
          }
        );
      } else if (delta > 0) {
        // 排名下降 → 红闪抖动
        gsap.to(card, {
          x: [-4, 4, -3, 3, -1, 0],
          boxShadow: ['0 0 30px rgba(239,68,68,0.5)', '0 0 20px rgba(251,146,60,0.3)'],
          duration: 0.5,
          ease: 'power2.out',
        });
      }
    });
  }, [rankAnim]);

  // 3. 新小组点火动画
  useEffect(() => {
    const currentIds = new Set(activePlayers.map(p => p.id || p.name));
    activePlayers.forEach(player => {
      const id = player.id || player.name;
      if (!newPlayerIdsRef.current.has(id) && id) {
        // 新小组 → 标记并在下次渲染后触发点火
        newPlayerIdsRef.current.add(id);
        setTimeout(() => {
          const card = cardRefs.current[id];
          if (card) {
            gsap.fromTo(card,
              { scale: 0.8, opacity: 0, filter: 'brightness(0.3) blur(4px)' },
              { scale: 1, opacity: 1, filter: 'brightness(1) blur(0px)', duration: 0.7, ease: 'back.out(1.5)' }
            );
          }
        }, 50);
      }
    });
    // 清理已不在列表中的小组
    newPlayerIdsRef.current.forEach(id => {
      if (!currentIds.has(id)) newPlayerIdsRef.current.delete(id);
    });
  }, [activePlayers]);

  // 4. 计时器熔岩模式
  useGSAP(() => {
    if (competition.remainingSeconds <= LAVA_MODE_THRESHOLD_SECONDS && competition.remainingSeconds > 0 && competition.isActive) {
      const timer = document.querySelector('.timer-lava-target');
      if (timer) {
        gsap.to(timer, {
          color: '#ef4444',
          textShadow: '0 0 20px #ef4444, 0 0 40px #dc2626',
          duration: 0.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }
    }
  }, [competition.remainingSeconds]);

  // ── 计时结束音效 ──
  useEffect(() => {
    // 计时器归零 → 播放计时结束警报
    if (competition.remainingSeconds === 0 && competition.isActive === false && !timerEndPlayedRef.current) {
      timerEndPlayedRef.current = true;
      SoundManager.stopBGM();
      SoundManager.playTimerEnd();
    }
    // 计时器重新开始 → 重置标记
    if (competition.remainingSeconds > 0 || competition.isActive) {
      timerEndPlayedRef.current = false;
    }
  }, [competition.remainingSeconds, competition.isActive]);

  // ── 操作 ──
  const handleStartPrep = async () => {
    SoundManager.playClick();
    try {
      await startPrepPhase();
      setIsPrepPhase(true);
      setLocalPrepCountdown(3);
    } catch { /* 降级 */ }
    await loadAll();
  };

  const handleReset = async () => {
    SoundManager.playClick();
    try {
      await resetCompetition();
      setIsPrepPhase(false);
      setLocalPrepCountdown(3);
    } catch { /* 降级 */ }
    await loadAll();
  };

  const handleClear = async () => {
    SoundManager.playClick();
    await clearRankingData();
    await loadAll();
    setShowConfirmClear(false);
  };

  // 排名图标/颜色
  const rankConfig = [
    { bg: 'from-yellow-400 to-amber-500', icon: 'Crown', text: 'text-yellow-100' },
    { bg: 'from-slate-300 to-slate-400', icon: 'Medal', text: 'text-slate-800' },
    { bg: 'from-amber-600 to-orange-700', icon: 'Star', text: 'text-amber-100' },
  ];

  // 火焰等级计算 (纯渲染辅助，不改变任何数据)
  const getFireLevel = (score, index) => {
    if (score >= 3000) return 'inferno';
    if (score >= 2000) return 'blazing';
    if (score >= 1000) return 'burning';
    if (score > 0) return 'warm';
    return 'cold';
  };

  const fireGlowClass = (level) => {
    const map = { cold: '', warm: 'glow-warm', burning: 'glow-burning', blazing: 'glow-blazing', inferno: 'glow-inferno fire-pulse' };
    return map[level] || '';
  };

  const scoreCardClass = (level) => {
    const map = { cold: 'score-cold', warm: 'score-warm', burning: 'score-burning', blazing: 'score-blazing', inferno: 'score-inferno' };
    return map[level] || 'score-cold';
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 transition-all duration-1000 ${competition.remainingSeconds <= LAVA_MODE_THRESHOLD_SECONDS && competition.isActive ? 'vignette-danger' : ''}`}>
      {/* 火焰粒子 Canvas 层 */}
      <RankingFire activePlayers={activePlayers} topCardRefs={cardRefs} />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-xl text-white hover:bg-white/20 border border-white/20 transition-all duration-300"
          >
            <Icon name="ArrowLeft" className="w-5 h-5" />返回
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <span className="crown-blaze inline-block rounded-full p-1">
                <Icon name="Crown" className="w-10 h-10 text-yellow-400" />
              </span>
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
            <span className={competition.remainingSeconds <= LAVA_MODE_THRESHOLD_SECONDS && competition.isActive ? 'timer-lava-mode' : ''}>
              <Icon name="Trophy" className={`w-6 h-6 ${competition.remainingSeconds <= LAVA_MODE_THRESHOLD_SECONDS && competition.isActive ? 'text-red-400' : 'text-yellow-400'}`} />
            </span>
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
              <span className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all duration-500 ${
                competition.isActive
                  ? 'bg-emerald-500/20 border-emerald-500/30'
                  : 'bg-slate-500/20 border-slate-500/30'
              }`}>
                <Icon name="Clock" className={`w-4 h-4 ${competition.remainingSeconds <= LAVA_MODE_THRESHOLD_SECONDS && competition.isActive ? 'text-red-400' : 'text-white'}`} />
                <span className={`font-mono font-bold text-white transition-all duration-300 ${competition.remainingSeconds <= LAVA_MODE_THRESHOLD_SECONDS && competition.isActive ? 'timer-lava-target' : ''}`}>
                  {competition.isActive
                    ? formatTime(competition.remainingSeconds)
                    : formatTime(competition.totalSeconds)}
                </span>
              </span>
            )}
            {!competition.isActive && !isPrepPhase && (
              <button
                onClick={handleStartPrep}
                className="px-4 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/30"
              >
                开始倒计时
              </button>
            )}
            {(competition.isActive || isPrepPhase) && (
              <button
                onClick={handleReset}
                className="px-4 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium transition-all duration-300"
              >
                重置
              </button>
            )}
          </div>
        </div>

        {/* 垂直排名列表 */}
        <div className="space-y-4" ref={playerListRef}>
          {activePlayers.length === 0 && (
            <div className="text-center text-slate-500 py-12 text-lg">
              🔥 暂无选手数据，开始挑战后这里会燃起来！
            </div>
          )}
          {activePlayers.map((player, index) => {
            const rc = rankConfig[index] || { bg: 'from-slate-600 to-slate-700', icon: 'User', text: 'text-white' };
            const details = player.levelDetails || [];
            const totalW = player.wrongCells ?? details.reduce((s, d) => s + (d.wrongCells || 0), 0);
            const totalE = player.emptyCells ?? details.reduce((s, d) => s + (d.emptyCells || 0), 0);
            const anim = rankAnim[player.id || player.name];
            const playerId = player.id || player.name;
            const score = player.score ?? 0;
            const fireLv = getFireLevel(score, index);

            // 火焰边框特效
            let fireBorderClass = '';
            if (index === 0) fireBorderClass = 'crown-blaze';
            else if (index === 1) fireBorderClass = 'silver-blaze';
            else if (index === 2) fireBorderClass = 'bronze-blaze';

            // 卡片注册回调
            const setCardRef = (el) => {
              if (el && playerId) cardRefs.current[playerId] = el;
            };

            return (
              <div
                key={playerId}
                ref={setCardRef}
                className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-white/10 to-white/5 border border-white/20
                  transition-all duration-500 ease-in-out
                  ${anim ? 'translate-y-0 opacity-100' : ''}
                  ${fireGlowClass(fireLv)}
                  ${fireBorderClass}
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
                {/* 热力背景叠加层 */}
                {fireLv !== 'cold' && (
                  <div
                    className="absolute inset-0 pointer-events-none opacity-30"
                    style={{
                      background: fireLv === 'inferno'
                        ? 'radial-gradient(ellipse at center, rgba(251,191,36,0.2) 0%, rgba(239,68,68,0.1) 50%, transparent 70%)'
                        : fireLv === 'blazing'
                        ? 'radial-gradient(ellipse at center, rgba(251,146,60,0.15) 0%, transparent 60%)'
                        : 'radial-gradient(ellipse at center, rgba(251,146,60,0.08) 0%, transparent 50%)',
                    }}
                  />
                )}

                <div className="flex items-center gap-4 relative z-10">
                  {/* 排名圆标 */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br ${rc.bg} flex items-center justify-center shadow-lg ${index === 0 ? 'crown-blaze' : ''}`}>
                    {index < 3 ? (
                      <Icon name={rc.icon} className={`w-7 h-7 ${rc.text}`} />
                    ) : (
                      <span className="text-white font-bold text-lg">{index + 1}</span>
                    )}
                  </div>

                  {/* 选手信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-white truncate">{player.name}</h3>
                      {player.isCompleted && (
                        <span className="inline-block px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-xs rounded-full flex-shrink-0">
                          已通关
                        </span>
                      )}
                    </div>
                    {/* 火焰进度条 */}
                    <div className="mt-1 w-full h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${fireLv !== 'cold' ? 'progress-lava' : 'bg-gradient-to-r from-teal-400 to-emerald-400'}`}
                        style={{ width: `${player.progress ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* 数据指标 */}
                  <div className="flex gap-3 flex-shrink-0 items-center">
                    {/* 积分（主排名依据）— 热力强化 */}
                    <div className={`text-center rounded-lg px-3 py-1.5 border transition-all duration-500 ${scoreCardClass(fireLv)}`}>
                      <p className={`text-xs font-medium ${fireLv === 'inferno' ? 'text-yellow-300' : fireLv === 'cold' ? 'text-slate-400' : 'text-emerald-300'}`}>积分</p>
                      <p
                        ref={el => { if (el && playerId) scoreElRefs.current[playerId] = el; }}
                        className={`font-mono font-bold text-xl tabular-nums transition-all duration-300 ${fireLv === 'inferno' ? 'text-yellow-300' : fireLv === 'cold' ? 'text-slate-400' : 'text-emerald-300'}`}
                      >
                        {score}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">用时</p>
                      <p className="text-white font-mono font-bold text-sm tabular-nums">{formatTime(player.totalTime || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">错误</p>
                      <p className={`font-mono font-bold text-sm tabular-nums ${totalW > 0 ? 'text-red-400' : 'text-slate-400'}`}>{totalW}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs">未填</p>
                      <p className={`font-mono font-bold text-sm tabular-nums ${totalE > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{totalE}</p>
                    </div>
                  </div>

                  {/* 关卡进度小点 */}
                  <div className="flex gap-1 flex-shrink-0">
                    {[1, 2, 3, 4].map(lv => {
                      const done = details.some(d => d.level === lv);
                      return (
                        <div
                          key={lv}
                          className={`w-3 h-3 rounded-full transition-all duration-300 ${done ? `bg-gradient-to-br from-emerald-400 to-teal-500 ${fireLv !== 'cold' ? 'shadow-md shadow-emerald-400/50' : ''}` : 'bg-slate-600'}`}
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
            <p className="text-slate-400 text-center mb-6">此操作将清空所有王牌侦探模式数据（练习关卡 + 排名），不影晌竞技模式！</p>
            <div className="flex gap-3">
              <button
                onClick={() => { SoundManager.playClick(); setShowConfirmClear(false); }}
                className="flex-1 py-3 bg-slate-600 text-white rounded-xl font-semibold hover:bg-slate-500 transition-all duration-300"
              >
                取消
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all duration-300"
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
