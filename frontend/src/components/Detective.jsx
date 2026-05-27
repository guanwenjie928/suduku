import { useState, useEffect } from 'react';
import Icon from './Icon';
import SoundManager from '../hooks/useSound';
import { createPlayer, submitLevel, completeGame } from '../api';

const DEFAULT_GROUPS = ['第一小组', '第二小组', '第三小组', '第四小组', '第五小组', '第六小组', '第七小组'];

const LEVELS = [
  { id: 1, title: '第一关', description: '基础数独练习',
    puzzle: [[0, 2, 4, 3], [3, 4, 2, 0], [2, 1, 0, 4], [4, 0, 1, 2]],
    solution: [[1, 2, 4, 3], [3, 4, 2, 1], [2, 1, 3, 4], [4, 3, 1, 2]] },
  { id: 2, title: '第二关', description: '基础数独练习',
    puzzle: [[1, 4, 2, 0], [2, 0, 1, 4], [0, 2, 4, 1], [4, 1, 0, 2]],
    solution: [[1, 4, 2, 3], [2, 3, 1, 4], [3, 2, 4, 1], [4, 1, 3, 2]] },
  { id: 3, title: '第三关', description: '基础数独练习',
    puzzle: [[4, 0, 0, 0], [0, 3, 4, 2], [0, 0, 0, 0], [2, 0, 3, 4]],
    solution: [[4, 2, 1, 3], [1, 3, 4, 2], [3, 4, 2, 1], [2, 1, 3, 4]] },
  { id: 4, title: '第四关', description: '根据数排除方格的高级技巧',
    puzzle: [[0, 0, 0, 3], [0, 0, 0, 1], [4, 0, 0, 0], [1, 0, 0, 0]],
    solution: [[2, 1, 4, 3], [3, 4, 2, 1], [4, 3, 1, 2], [1, 2, 3, 4]] },
];

export default function Detective({ onBack, showToast }) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [board, setBoard] = useState(LEVELS[0].puzzle.map(r => [...r]));
  const [selectedCell, setSelectedCell] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [customGroups, setCustomGroups] = useState([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customGroupName, setCustomGroupName] = useState('');
  const [levelDetails, setLevelDetails] = useState([]);
  const [totalWrongCells, setTotalWrongCells] = useState(0);
  const [totalEmptyCells, setTotalEmptyCells] = useState(0);

  // 计时器
  useEffect(() => {
    if (isPlaying) {
      const i = setInterval(() => setSeconds(s => s + 1), 1000);
      return () => clearInterval(i);
    }
  }, [isPlaying]);

  // 切关时加载棋盘
  useEffect(() => {
    setBoard(LEVELS[currentLevel].puzzle.map(r => [...r]));
    setSelectedCell(null);
  }, [currentLevel]);

  const formatTime = secs => {
    const m = Math.floor(secs / 60), r = secs % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  };

  // 点击数字填入
  const handleNumberClick = num => {
    if (!selectedCell || completedLevels.includes(currentLevel)) return;
    SoundManager.playClick();
    const { row, col } = selectedCell;
    const nb = board.map(r => [...r]);
    nb[row][col] = num;
    setBoard(nb);
  };

  // 提交答案
  const handleSubmit = async () => {
    const cs = LEVELS[currentLevel].solution;
    let ec = 0, wc = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === 0) ec++;
        else if (board[r][c] !== cs[r][c]) wc++;
      }
    }

    // 记录本关详情
    const ld = { level: currentLevel + 1, time: seconds, emptyCells: ec, wrongCells: wc, completedAt: new Date().toISOString() };
    const nld = [...levelDetails, ld];
    setLevelDetails(nld);
    setTotalWrongCells(prev => prev + wc);
    setTotalEmptyCells(prev => prev + ec);

    // 标记本关完成
    const nc = [...completedLevels, currentLevel];
    setCompletedLevels(nc);

    // 调用 API 提交关卡成绩
    if (playerName) {
      try {
        await submitLevel({
          player_name: playerName,
          level: currentLevel + 1,
          time_seconds: seconds,
          empty_cells: ec,
          wrong_cells: wc,
        });
      } catch { /* 降级已在 api.js 处理 */ }
    }

    // 音效
    const isLast = currentLevel >= LEVELS.length - 1;
    if (isLast) {
      SoundManager.playVictory();
      SoundManager.stopBGM();

      // 全部通关 —— 标记玩家完成状态
      if (playerName) {
        try {
          await completeGame({
            player_name: playerName,
            completed_levels: LEVELS.length,
          });
        } catch { /* 降级已在 api.js 处理 */ }
      }
    } else {
      SoundManager.playDing();
    }

    showToast(
      isLast
        ? `🎉 全部通关！未填:${ec}个 错误:${wc}个`
        : `第${currentLevel + 1}关完成！未填:${ec}个 错误:${wc}个`,
      'success',
      1500
    );

    if (currentLevel < LEVELS.length - 1) {
      setTimeout(() => setCurrentLevel(currentLevel + 1), 500);
    } else {
      setTimeout(onBack, 800);
    }
  };

  // 开始游戏 —— 弹出名称选择
  const startGame = () => setShowNameInput(true);

  // 选手名确认
  const handleStartWithName = async (name) => {
    if (!name || !name.trim()) return;
    SoundManager.playClick();
    SoundManager.init();
    SoundManager.playBGM();

    const trimmedName = name.trim();
    setPlayerName(trimmedName);
    setShowNameInput(false);
    setIsPlaying(true);
    setSeconds(0);
    setCompletedLevels([]);
    setCurrentLevel(0);
    setLevelDetails([]);
    setTotalWrongCells(0);
    setTotalEmptyCells(0);

    // 调用 API 创建/加入选手
    try {
      await createPlayer(trimmedName);
    } catch { /* 降级处理 */ }
  };

  // 添加自定义小组
  const handleAddCustomGroup = () => {
    if (!customGroupName.trim()) return;
    const tn = customGroupName.trim();
    if (DEFAULT_GROUPS.includes(tn) || customGroups.includes(tn)) return;
    setCustomGroups([...customGroups, tn]);
    setShowCustomInput(false);
    setCustomGroupName('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-100 via-cyan-50 to-pink-100 p-4">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { SoundManager.playClick(); onBack(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md text-slate-600 hover:bg-slate-50"
        >
          <Icon name="ArrowLeft" className="w-5 h-5" />返回
        </button>
        <h1 className="text-xl font-bold text-slate-700">王牌侦探</h1>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md">
          <Icon name="Clock" className="w-5 h-5 text-teal-500" />
          <span className="font-mono font-bold text-slate-700">{formatTime(seconds)}</span>
        </div>
      </div>

      {/* 关卡 Tab */}
      <div className="flex justify-center gap-2 mb-4">
        {LEVELS.map((lv, i) => (
          <button
            key={lv.id}
            onClick={() => { SoundManager.playClick(); setCurrentLevel(i); }}
            disabled={!isPlaying}
            className={`flex-1 py-3 px-2 rounded-xl font-semibold text-sm transition-all ${
              currentLevel === i
                ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-white shadow-lg scale-105'
                : completedLevels.includes(i)
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-white text-slate-400'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <Icon name={completedLevels.includes(i) ? 'CheckCircle' : 'Lock'} className="w-5 h-5" />
              <span>第{i + 1}关</span>
            </div>
          </button>
        ))}
      </div>

      {/* 开始按钮 / 游戏界面 */}
      {!isPlaying ? (
        <div className="text-center mb-6">
          <button
            onClick={() => { SoundManager.playClick(); startGame(); }}
            className="px-8 py-4 bg-gradient-to-r from-teal-400 to-cyan-400 text-white rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            开始挑战
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
            <h2 className="text-lg font-bold text-slate-700 mb-2">{LEVELS[currentLevel].title}</h2>
            <p className="text-slate-500 text-sm">{LEVELS[currentLevel].description}</p>
          </div>

          {/* 数独棋盘 */}
          <div className="flex justify-center mb-4">
            <div className="inline-grid grid-cols-4 gap-1 p-3 bg-slate-800 rounded-2xl shadow-2xl">
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const isFixed = LEVELS[currentLevel].puzzle[r][c] !== 0;
                  const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                  return (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => {
                        if (!isFixed) { SoundManager.playClick(); setSelectedCell({ row: r, col: c }); }
                      }}
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-xl font-bold text-xl flex items-center justify-center transition-all ${
                        isFixed
                          ? 'bg-slate-200 text-slate-700 cursor-default'
                          : isSelected
                            ? 'bg-sky-200 text-teal-600 ring-4 ring-teal-400'
                            : 'bg-slate-100 text-teal-600 hover:scale-105'
                      }`}
                    >
                      {cell !== 0 ? cell : ''}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 数字按钮 */}
          <div className="flex justify-center gap-3 mb-4">
            {[1, 2, 3, 4].map(num => (
              <button
                key={num}
                onClick={() => { SoundManager.playClick(); handleNumberClick(num); }}
                className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-teal-400 to-cyan-400 text-white rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
          </div>

          <button
            onClick={() => { SoundManager.playClick(); handleSubmit(); }}
            className="w-full py-4 bg-gradient-to-r from-emerald-400 to-teal-400 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Icon name="CheckCircle" className="w-6 h-6" />提交答案
          </button>
        </>
      )}

      {/* 选名弹窗 */}
      {showNameInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-center text-slate-700 mb-2">
              {!isPlaying ? '准备好了吗？' : '恭喜通关！'}
            </h3>
            <p className="text-slate-500 text-center mb-4">
              {!isPlaying ? '选择你的小组开始挑战' : '选择你的小组保存成绩'}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {DEFAULT_GROUPS.map(g => (
                <button
                  key={g}
                  onClick={() => { SoundManager.playClick(); handleStartWithName(g); }}
                  className={`py-3 px-4 rounded-xl font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                    playerName === g
                      ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {customGroups.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2 text-center">自定义小组</p>
                <div className="grid grid-cols-2 gap-3">
                  {customGroups.map(g => (
                    <button
                      key={g}
                      onClick={() => { SoundManager.playClick(); handleStartWithName(g); }}
                      className={`py-3 px-4 rounded-xl font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                        playerName === g
                          ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-white shadow-lg'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!showCustomInput ? (
              <button
                onClick={() => { SoundManager.playClick(); setShowCustomInput(true); }}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-teal-400 hover:text-teal-500 transition-all flex items-center justify-center gap-2"
              >
                <span className="text-xl">+</span>添加自定义小组
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customGroupName}
                  onChange={e => setCustomGroupName(e.target.value)}
                  placeholder="输入小组名称"
                  className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl text-center focus:border-teal-400 focus:outline-none"
                  maxLength={10}
                  onKeyDown={e => e.key === 'Enter' && handleAddCustomGroup()}
                  autoFocus
                />
                <button
                  onClick={() => { SoundManager.playClick(); handleAddCustomGroup(); }}
                  className="px-4 py-3 bg-teal-400 text-white rounded-xl font-semibold hover:bg-teal-500 transition-all"
                >
                  添加
                </button>
                <button
                  onClick={() => { SoundManager.playClick(); setShowCustomInput(false); setCustomGroupName(''); }}
                  className="px-4 py-3 bg-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-300 transition-all"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
