/**
 * 图标组件 —— 纯 emoji 方案，零依赖
 */
const iconMap = {
  ArrowLeft: '\u2190',
  Trophy: '\uD83C\uDFC6',
  Clock: '\u23F1\uFE0F',
  Users: '\uD83D\uDC65',
  Calendar: '\uD83D\uDCC5',
  Trash2: '\uD83D\uDDD1\uFE0F',
  Activity: '\u25CF',
  Target: '\uD83C\uDFAF',
  Zap: '\u26A1',
  Crown: '\uD83D\uDC51',
  Medal: '\uD83E\uDD48',
  Timer: '\u23F1\uFE0F',
  TrendingUp: '\uD83D\uDCC8',
  Lock: '\uD83D\uDD12',
  Search: '\uD83D\uDD0D',
  BarChart3: '\uD83D\uDCCA',
  BookOpen: '\uD83D\uDCD6',
  Sparkles: '\u2728',
  Star: '\u2B50',
  CheckCircle: '\u2705',
  ChevronRight: '\u25B6',
  Lightbulb: '\uD83D\uDCA1',
  Grid3X3: '\u25A6',
  Unlock: '\uD83D\uDD13',
  Flag: '\uD83D\uDEA9',
  XCircle: '\u274C',
  RotateCcw: '\uD83D\uDD04',
  Circle: '\u26AB',
  Monitor: '\uD83D\uDDA5\uFE0F',
  Play: '\u25B6\uFE0F',
};

export default function Icon({ name, className = '' }) {
  return <span className={className} role="img" aria-label={name}>{iconMap[name] || '\u25CF'}</span>;
}
