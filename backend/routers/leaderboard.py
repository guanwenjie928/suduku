"""
排行榜 API —— 实时竞技排行 & 历史排行
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Player, LevelDetail, HistoryRecord

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("/active")
def active_leaderboard(db: Session = Depends(get_db)):
    """
    实时竞技排行榜 ——
    排序规则：wrong_cells 少 → empty_cells 少 → total_time 少
    """
    players = db.query(Player).all()
    result = []
    for p in players:
        details = db.query(LevelDetail).filter(
            LevelDetail.player_id == p.id
        ).order_by(LevelDetail.level).all()

        total_wrong = sum(d.wrong_cells for d in details)
        total_empty = sum(d.empty_cells for d in details)

        result.append({
            "id": p.id,
            "name": p.name,
            "currentLevel": p.current_level,
            "progress": p.progress,
            "totalTime": p.total_time,
            "isCompleted": bool(p.is_completed),
            "lastUpdate": p.updated_at.isoformat() if p.updated_at else None,
            "levelDetails": [d.to_dict() for d in details],
            "wrongCells": total_wrong,
            "emptyCells": total_empty,
        })

    # 排序：错误少 → 未填少 → 用时少
    result.sort(key=lambda x: (x["wrongCells"], x["emptyCells"], x["totalTime"]))
    return result


@router.get("/history")
def history_leaderboard(db: Session = Depends(get_db)):
    """
    历史排行榜 —— 所有通关记录，按 total_time 升序
    """
    records = db.query(HistoryRecord).order_by(
        HistoryRecord.wrong_cells.asc(),
        HistoryRecord.empty_cells.asc(),
        HistoryRecord.total_time.asc(),
    ).all()
    return [r.to_dict() for r in records]
