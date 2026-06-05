"""
排行榜 API —— 实时竞技排行（计分制），支持模式隔离
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Player, LevelDetail
from config.constants import LEVEL_WEIGHT, WRONG_WEIGHT, EMPTY_WEIGHT, TIME_DIVISOR, RACE_LEVEL_ID

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("/active")
def active_leaderboard(
    mode: str = Query("all", description="排行模式: practice(练习关卡1-4), competition(竞技关卡5), all(全部)"),
    db: Session = Depends(get_db),
):
    """
    实时排行榜 —— 计分制排序，按 mode 隔离数据

    积分公式:
      score = 完成关卡数 × 1000 - 错误格子 × 10 - 未填格子 × 5 - 用时(秒) ÷ 10

    mode 说明:
      - practice: 仅统计关卡 1-4 的数据（练习模式）
      - competition: 仅统计关卡 5 的数据（竞技模式）
      - all: 统计全部关卡（向后兼容）
    """
    players = db.query(Player).options(joinedload(Player.level_details)).all()
    result = []
    for p in players:
        all_details = p.level_details

        if mode == "competition":
            details = [d for d in all_details if d.level == RACE_LEVEL_ID]
        elif mode == "practice":
            details = [d for d in all_details if d.level != RACE_LEVEL_ID]
        else:
            details = list(all_details)

        # 练习模式显示所有选手（选择小组后立即可见），竞技模式仅显示有竞技数据的选手
        # 竞技模式：仅显示有竞技数据的选手
        if mode == "competition" and not details:
            continue

        # 练习模式：排除纯竞技选手（只有level=5数据，无练习数据）
        if mode == "practice":
            all_comp = [d for d in all_details if d.level == RACE_LEVEL_ID]
            all_practice = [d for d in all_details if d.level != RACE_LEVEL_ID]
            if all_comp and not all_practice:
                continue  # 纯竞技选手，不显示在练习排行榜

        completed_count = len(details)
        total_wrong = sum(d.wrong_cells for d in details)
        total_empty = sum(d.empty_cells for d in details)
        total_time = sum(d.time_seconds for d in details)

        score = (
            completed_count * LEVEL_WEIGHT
            - total_wrong * WRONG_WEIGHT
            - total_empty * EMPTY_WEIGHT
            - total_time // TIME_DIVISOR
        )

        result.append({
            "id": p.id,
            "name": p.name,
            "currentLevel": p.current_level if mode == "all" else (
                max(d.level for d in details) if details else 0
            ),
            "progress": p.progress if mode == "all" else (
                100 if details and all(d.empty_cells == 0 and d.wrong_cells == 0 for d in details) else 0
            ),
            "totalTime": total_time,
            "isCompleted": bool(p.is_completed) if mode == "all" else (
                all(d.empty_cells == 0 and d.wrong_cells == 0 for d in details) if details else False
            ),
            "lastUpdate": p.updated_at.isoformat() if p.updated_at else None,
            "levelDetails": [d.to_dict() for d in details],
            "wrongCells": total_wrong,
            "emptyCells": total_empty,
            "score": score,
        })

    result.sort(key=lambda x: x["score"], reverse=True)
    return result
