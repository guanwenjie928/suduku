import Icon from './Icon';
import SoundManager from '../hooks/useSound';

export default function Tutorial({ onBack }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => { SoundManager.playClick(); onBack(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md text-slate-600 hover:bg-slate-50"
          >
            <Icon name="ArrowLeft" className="w-5 h-5" />返回
          </button>
          <h1 className="text-2xl font-bold text-slate-700 flex items-center gap-2">
            <Icon name="BookOpen" className="w-6 h-6 text-emerald-500" />
            玩法说明
          </h1>
          <div className="w-16" />
        </div>

        {/* 内容 */}
        <div className="space-y-4">
          {/* 基本规则 */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Icon name="Grid3X3" className="w-5 h-5 text-teal-500" />
              基本规则
            </h2>
            <ul className="space-y-2 text-slate-600 text-sm">
              <li className="flex gap-2">
                <span className="text-teal-400 font-bold mt-0.5">1.</span>
                在 4x4 的方格中填入数字 1-4
              </li>
              <li className="flex gap-2">
                <span className="text-teal-400 font-bold mt-0.5">2.</span>
                每行、每列的数字不能重复
              </li>
              <li className="flex gap-2">
                <span className="text-teal-400 font-bold mt-0.5">3.</span>
                每个 2x2 宫格内的数字也不能重复
              </li>
              <li className="flex gap-2">
                <span className="text-teal-400 font-bold mt-0.5">4.</span>
                灰色格子是已固定的初始数字，不可更改
              </li>
            </ul>
          </div>

          {/* 操作说明 */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Icon name="Target" className="w-5 h-5 text-cyan-500" />
              操作说明
            </h2>
            <ul className="space-y-2 text-slate-600 text-sm">
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold mt-0.5">1.</span>
                选择一个小组名称开始挑战
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold mt-0.5">2.</span>
                点击空白格子选中它，再点击数字按钮填入
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold mt-0.5">3.</span>
                完成当前关卡后点击提交，自动进入下一关
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold mt-0.5">4.</span>
                全部 4 关通关后成绩写入历史排行榜
              </li>
            </ul>
          </div>

          {/* 计分规则 */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Icon name="Trophy" className="w-5 h-5 text-yellow-500" />
              计分规则（排行榜排名依据）
            </h2>
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-4 mb-4 border border-yellow-200">
              <p className="text-lg font-mono font-bold text-amber-700 text-center">
                积分 = 完成关卡 × 1000 − 错误 × 10 − 未填 × 5 − 用时 ÷ 10
              </p>
            </div>
            <div className="space-y-3 text-slate-600 text-sm">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-emerald-500 font-bold text-lg w-16 text-center">+1000</span>
                <div>
                  <span className="font-semibold text-slate-700">每完成 1 关</span>
                  <p className="text-slate-500 text-xs">多完成一关的奖励远大于扣分上限，确保进度领先的永远排在前面</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <span className="text-red-500 font-bold text-lg w-16 text-center">-10</span>
                <div>
                  <span className="font-semibold text-slate-700">每个错误格子</span>
                  <p className="text-slate-500 text-xs">准确性比速度重要 100 倍，一个错误等于 100 秒的用时</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <span className="text-orange-500 font-bold text-lg w-16 text-center">-5</span>
                <div>
                  <span className="font-semibold text-slate-700">每个未填格子</span>
                  <p className="text-slate-500 text-xs">没填比填错扣分少一半，鼓励尽量填写</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-blue-500 font-bold text-lg w-16 text-center">-1</span>
                <div>
                  <span className="font-semibold text-slate-700">每 10 秒用时</span>
                  <p className="text-slate-500 text-xs">速度作为辅助排序因子，不影响关卡数和准确性的主导地位</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
              <p className="font-semibold mb-1">举例</p>
              <p>麒麟组完成 4 关、0 错、用时 180 秒 = 4×1000 − 0 − 0 − 18 = <span className="font-bold text-slate-700">3982 分</span></p>
              <p>闪电组完成 4 关、1 错、用时 240 秒 = 4×1000 − 10 − 0 − 24 = <span className="font-bold text-slate-700">3966 分</span></p>
              <p>青云组完成 2 关、0 错、用时 120 秒 = 2×1000 − 0 − 0 − 12 = <span className="font-bold text-slate-700">1988 分</span></p>
            </div>
          </div>

          {/* 比赛模式 */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Icon name="Zap" className="w-5 h-5 text-amber-500" />
              比赛模式
            </h2>
            <ul className="space-y-2 text-slate-600 text-sm">
              <li className="flex gap-2">
                <span className="text-amber-400 font-bold mt-0.5">1.</span>
                在排行榜页面可以启动统一倒计时
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 font-bold mt-0.5">2.</span>
                所有设备上的计时器通过服务器同步
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 font-bold mt-0.5">3.</span>
                倒计时归零后比赛结束，排名不再更新
              </li>
            </ul>
          </div>

          {/* 联网提示 */}
          <div className="bg-gradient-to-r from-teal-400/10 to-cyan-400/10 rounded-2xl p-6 border border-teal-400/30">
            <h2 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Icon name="Sparkles" className="w-5 h-5 text-teal-500" />
              多设备联机
            </h2>
            <p className="text-slate-600 text-sm">
              本版本支持多设备联网使用。所有数据存储在服务器数据库中，排行榜实时同步。
              如果网络断开，游戏会自动切换到离线模式，数据暂存于浏览器本地，
              网络恢复后可以继续使用。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
