"""
排行榜 API —— 实时竞技排行（计分制）
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Player, LevelDetail
from config.constants import LEVEL_WEIGHT, WRONG_WEIGHT, EMPTY_WEIGHT, TIME_DIVISOR

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


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
    # 使用 joinedload 一次性加载所有 LevelDetail，避免 N+1 查询
    players = db.query(Player).options(joinedload(Player.level_details)).all()
    result = []
    for p in players:
        details = p.level_details  # 已通过 joinedload 预加载，不会触发额外查询

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
