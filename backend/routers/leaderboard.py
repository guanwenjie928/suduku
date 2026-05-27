"""
排行榜 API —— 实时竞技排行（计分制）
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Player, LevelDetail

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])

# 计分权重常量
LEVEL_WEIGHT = 1000   # 每完成一关的奖励分
WRONG_WEIGHT = 10     # 每个错误格子的扣分
EMPTY_WEIGHT = 5      # 每个未填格子的扣分
TIME_DIVISOR = 10     # 每 N 秒扣 1 分


@router.get("/active")
def active_leaderboard(db: Session = Depends(get_db)):
    """
    实时竞技排行榜 —— 计分制排序

    积分公式:
      score = 完成关卡数 × 1000 - 错误格子 × 10 - 未填格子 × 5 - 用时(秒) ÷ 10

    设计保证:
      - 多完成一关 (+1000) 绝对优先于少完成但少扣分 (4关全错也只扣640)
      - 未操作小组 score=0，自然垫底
    """
    players = db.query(Player).all()
    result = []
    for p in players:
        details = db.query(LevelDetail).filter(
            LevelDetail.player_id == p.id
        ).order_by(LevelDetail.level).all()

        completed_count = len(details)
        total_wrong = sum(d.wrong_cells for d in details)
        total_empty = sum(d.empty_cells for d in details)
        total_time = sum(d.time_seconds for d in details)

        # 计分公式
        score = (
            completed_count * LEVEL_WEIGHT
            - total_wrong * WRONG_WEIGHT
            - total_empty * EMPTY_WEIGHT
            - total_time // TIME_DIVISOR
        )

        result.append({
            "id": p.id,
            "name": p.name,
            "currentLevel": p.current_level,
            "progress": p.progress,
            "totalTime": total_time,
            "isCompleted": bool(p.is_completed),
            "lastUpdate": p.updated_at.isoformat() if p.updated_at else None,
            "levelDetails": [d.to_dict() for d in details],
            "wrongCells": total_wrong,
            "emptyCells": total_empty,
            "score": score,
        })

    # 按积分降序排列
    result.sort(key=lambda x: x["score"], reverse=True)
    return result
