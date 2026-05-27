"""
SQLAlchemy ORM 模型 —— 对应 MySQL 中的 4 张表：
players, level_details, competition, history_records
"""
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    current_level = Column(Integer, default=0, comment="当前所在关卡 (0-based)")
    progress = Column(Integer, default=0, comment="通关进度 0-100")
    total_time = Column(Integer, default=0, comment="总用时（秒）")
    is_completed = Column(Integer, default=0, comment="是否全部通关 0/1")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联关卡详情
    level_details = relationship("LevelDetail", back_populates="player", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "currentLevel": self.current_level,
            "progress": self.progress,
            "totalTime": self.total_time,
            "isCompleted": bool(self.is_completed),
            "lastUpdate": self.updated_at.isoformat() if self.updated_at else None,
        }


class LevelDetail(Base):
    __tablename__ = "level_details"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    player_id = Column(BigInteger, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)
    level = Column(Integer, nullable=False, comment="关卡编号 (1-based)")
    time_seconds = Column(Integer, default=0, comment="该关用时（秒）")
    empty_cells = Column(Integer, default=0, comment="未填格子数")
    wrong_cells = Column(Integer, default=0, comment="错误格子数")
    completed_at = Column(DateTime, server_default=func.now())

    player = relationship("Player", back_populates="level_details")

    def to_dict(self):
        return {
            "level": self.level,
            "time": self.time_seconds,
            "emptyCells": self.empty_cells,
            "wrongCells": self.wrong_cells,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
        }


class Competition(Base):
    """比赛计时器 —— 单例表，只有一行记录"""
    __tablename__ = "competition"

    id = Column(Integer, primary_key=True, autoincrement=True)
    is_active = Column(Integer, default=0, comment="是否正在倒计时 0/1")
    total_seconds = Column(Integer, default=300, comment="倒计时总秒数")
    started_at = Column(DateTime, comment="开始时间")
    prep_phase = Column(Integer, default=0, comment="是否预备阶段 0/1")

    def to_dict(self):
        import math
        now = func.now()
        remaining = self.total_seconds
        if self.is_active and self.started_at:
            # 根据实际流逝时间动态计算剩余秒数
            from datetime import datetime
            elapsed = (datetime.utcnow() - self.started_at).total_seconds()
            remaining = max(0, int(self.total_seconds - elapsed))
        return {
            "isActive": bool(self.is_active),
            "totalSeconds": self.total_seconds,
            "remainingSeconds": remaining,
            "prepPhase": bool(self.prep_phase),
        }


class HistoryRecord(Base):
    """历史通关记录 —— 全部通关后固化到这张表"""
    __tablename__ = "history_records"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    player_name = Column(String(50), nullable=False)
    completed_levels = Column(Integer, nullable=False, comment="完成的关卡数")
    total_time = Column(Integer, nullable=False, comment="总用时（秒）")
    wrong_cells = Column(Integer, default=0)
    empty_cells = Column(Integer, default=0)
    completed_at = Column(DateTime, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.player_name,
            "completedLevels": self.completed_levels,
            "totalTime": self.total_time,
            "wrongCells": self.wrong_cells,
            "emptyCells": self.empty_cells,
            "date": self.completed_at.isoformat() if self.completed_at else None,
        }
