import { useState, useEffect } from 'react';
import Icon from './Icon';

export default function Home({ onNavigate }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    setParticles(Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${3 + Math.random() * 4}s`,
      size: 4 + Math.random() * 8,
    })));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* 背景粒子 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map(p => (
          <div key={p.id}
            className="absolute rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 opacity-60"
            style={{
              left: p.left, width: p.size, height: p.size,
              animation: `float ${p.duration} ease-in-out infinite`,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* 标题区 */}
      <div className="text-center mb-10 relative z-10">
        <div className="inline-flex items-center gap-2 mb-3 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full">
          <Icon name="Star" className="w-5 h-5 text-yellow-500" />
          <span className="text-slate-600 text-sm font-medium">王牌侦探版</span>
          <Icon name="Star" className="w-5 h-5 text-yellow-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight mb-3">
          四宫格数独
        </h1>
      </div>

      {/* 主按钮 */}
      <div className="w-full max-w-sm relative z-10 mb-6">
        <button
          onClick={() => onNavigate('detective')}
          className="w-full py-8 px-8 rounded-3xl font-bold text-2xl bg-gradient-to-br from-teal-400 via-cyan-400 to-blue-400 text-white shadow-2xl hover:shadow-teal-300/50 transform transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] flex flex-col items-center justify-center gap-3 border-4 border-white/30"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Icon name="Search" className="w-10 h-10" />
          </div>
          <span>开始挑战</span>
          <span className="text-sm font-normal opacity-80">王牌侦探模式</span>
        </button>
      </div>

      {/* 次要按钮 */}
      <div className="w-full max-w-sm grid grid-cols-3 gap-3 relative z-10">
        <button
          onClick={() => onNavigate('competition')}
          className="py-4 px-2 rounded-2xl font-semibold text-sm bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center gap-2"
        >
          <Icon name="Zap" className="w-6 h-6" />
          竞技模式
        </button>
        <button
          onClick={() => onNavigate('ranking')}
          className="py-4 px-2 rounded-2xl font-semibold text-sm bg-gradient-to-r from-sky-400 to-blue-400 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center gap-2"
        >
          <Icon name="BarChart3" className="w-6 h-6" />
          实时排名
        </button>
        <button
          onClick={() => onNavigate('tutorial')}
          className="py-4 px-2 rounded-2xl font-semibold text-sm bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center gap-2"
        >
          <Icon name="BookOpen" className="w-6 h-6" />
          玩法说明
        </button>
      </div>

      <div className="absolute bottom-4 text-slate-400 text-xs">v2.0 · 王牌侦探版 · 全栈联网版</div>
    </div>
  );
}
