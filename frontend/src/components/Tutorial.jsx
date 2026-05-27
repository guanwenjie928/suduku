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

          {/* 计分说明 */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Icon name="Trophy" className="w-5 h-5 text-yellow-500" />
              排名规则
            </h2>
            <ul className="space-y-2 text-slate-600 text-sm">
              <li className="flex gap-2">
                <span className="text-yellow-500 font-bold mt-0.5">1.</span>
                排名优先比较错误格子数（越少越好）
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-500 font-bold mt-0.5">2.</span>
                错误数相同则比较未填格子数（越少越好）
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-500 font-bold mt-0.5">3.</span>
                都相同时比较总用时（越短越好）
              </li>
            </ul>
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
