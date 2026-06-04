/**
 * 时间格式化工具函数
 */

/**
 * 将秒数格式化为 MM:SS 格式
 * @param {number} secs - 秒数
 * @returns {string} 格式化后的时间字符串 (如 "05:30")
 */
export function formatTime(secs) {
  if (secs == null || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 将秒数格式化为 SS 格式（仅秒数）
 * @param {number} secs - 秒数
 * @returns {string} 格式化后的秒数字符串 (如 "30")
 */
export function formatSeconds(secs) {
  if (secs == null || secs < 0) secs = 0;
  return secs.toString().padStart(2, '0');
}
