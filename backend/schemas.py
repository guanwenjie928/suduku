"""
Pydantic 请求/响应模型 —— FastAPI 自动校验与文档生成
"""
from pydantic import BaseModel, Field
from typing import Optional, List


# ── Player ──
class PlayerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="选手/小组名称")

class PlayerResponse(BaseModel):
    id: int
    name: str
    currentLevel: int = 0
    progress: int = 0
    totalTime: int = 0
    isCompleted: bool = False
    lastUpdate: Optional[str] = None
    levelDetails: Optional[List["LevelDetailResponse"]] = None

    class Config:
        from_attributes = True


# ── LevelDetail ──
class LevelDetailSubmit(BaseModel):
    player_name: str = Field(..., description="选手名称")
    level: int = Field(..., ge=1, le=5, description="关卡编号 1-5（5=竞技模式）")
    time_seconds: int = Field(..., ge=0, description="该关用时（秒）")
    empty_cells: int = Field(0, ge=0, description="未填格子数")
    wrong_cells: int = Field(0, ge=0, description="错误格子数")

class LevelDetailResponse(BaseModel):
    level: int
    time: int
    emptyCells: int = 0
    wrongCells: int = 0
    completedAt: Optional[str] = None


# ── Game Complete ──
class GameCompleteRequest(BaseModel):
    player_name: str = Field(..., description="选手名称")
    completed_levels: int = Field(..., description="完成的关卡总数")
    total_time: int = Field(..., description="总用时（秒）")
    wrong_cells: int = Field(0, description="总错误格子数")
    empty_cells: int = Field(0, description="总未填格子数")


# ── Leaderboard ──
class ActivePlayerRank(BaseModel):
    id: int
    name: str
    currentLevel: int
    progress: int
    totalTime: int
    isCompleted: bool
    levelDetails: List[LevelDetailResponse] = []
    wrongCells: int = 0
    emptyCells: int = 0

class HistoryRecordResponse(BaseModel):
    id: int
    name: str
    completedLevels: int
    totalTime: int
    wrongCells: int = 0
    emptyCells: int = 0
    date: Optional[str] = None


# ── Competition ──
class CompetitionStart(BaseModel):
    total_seconds: int = Field(default=180, ge=10, le=3600, description="倒计时总秒数")


class RaceSubmit(BaseModel):
    """竞技模式提交"""
    player_name: str = Field(..., description="选手名称")
    time_seconds: int = Field(..., ge=0, description="用时（秒）")
    empty_cells: int = Field(0, ge=0, description="未填格子数")
    wrong_cells: int = Field(0, ge=0, description="错误格子数")


class CompetitionResponse(BaseModel):
    isActive: bool
    totalSeconds: int
    remainingSeconds: int
    prepPhase: bool
    roomStatus: str = "idle"
    roomTotalSeconds: int = 120
    roomRemainingSeconds: int = 120


# ── Generic ──
class MessageResponse(BaseModel):
    message: str
    success: bool = True
