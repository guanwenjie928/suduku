-- Migration: 002_add_step_tracking_and_joined_players.sql
-- 为竞技模式添加步数追踪和已加入选手记录
-- 运行：mysql -u sudoku -p sudoku_detective < 002_add_step_tracking_and_joined_players.sql

ALTER TABLE level_details
  ADD COLUMN correct_steps INT DEFAULT 0 COMMENT '正确步数（填入正确数字的次数）';

ALTER TABLE level_details
  ADD COLUMN incorrect_steps INT DEFAULT 0 COMMENT '错误步数（填入错误数字的次数）';

ALTER TABLE competition
  ADD COLUMN joined_players TEXT COMMENT '已加入房间的选手名列表(JSON数组)';
