-- Migration: 001_add_room_fields.sql
-- 为 competition 表添加竞技房间字段（新版代码需要）
-- 运行：mysql -u sudoku -p sudoku_detective < 001_add_room_fields.sql

ALTER TABLE competition
  ADD COLUMN room_status VARCHAR(20) DEFAULT 'idle' COMMENT '竞技房间状态: idle/lobby/active/ended';

ALTER TABLE competition
  ADD COLUMN room_total_seconds INT DEFAULT 120 COMMENT '竞技倒计时总秒数';

ALTER TABLE competition
  ADD COLUMN room_started_at DATETIME DEFAULT NULL COMMENT '竞技开始时间';
