"""
比赛计时 API —— 统一倒计时管理
数据库中只保留 1 条 competition 记录
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Competition
from schemas import CompetitionStart

router = APIRouter(prefix="/api/v1/competition", tags=["competition"])


def _get_or_create_competition(db: Session) -> Competition:
    comp = db.query(Competition).first()
    if not comp:
        comp = Competition(is_active=0, total_seconds=300, prep_phase=0)
        db.add(comp)
        db.commit()
        db.refresh(comp)
    return comp


@router.get("")
def get_competition_status(db: Session = Depends(get_db)):
    """
    获取比赛计时器状态
    前端每 1 秒轮询此接口
    """
    comp = _get_or_create_competition(db)
    data = comp.to_dict()

    # 计算实际剩余时间
    if comp.is_active and comp.started_at:
        now = datetime.utcnow()
        elapsed = (now - comp.started_at).total_seconds()
        remaining = max(0, comp.total_seconds - int(elapsed))
        data["remainingSeconds"] = remaining

        # 如果时间到了，自动停止
        if remaining <= 0:
            comp.is_active = 0
            comp.prep_phase = 0
            data["isActive"] = False
            data["remainingSeconds"] = 0
            data["prepPhase"] = False
            db.commit()

    return data


@router.post("/start")
def start_competition(body: CompetitionStart, db: Session = Depends(get_db)):
    """
    开始比赛倒计时（经过预备阶段后调用）
    """
    comp = _get_or_create_competition(db)
    comp.is_active = 1
    comp.total_seconds = body.total_seconds
    comp.started_at = datetime.utcnow()
    comp.prep_phase = 0
    db.commit()
    db.refresh(comp)
    return {
        "message": f"比赛开始！倒计时 {body.total_seconds} 秒",
        "status": comp.to_dict(),
    }


@router.post("/prep")
def start_prep(db: Session = Depends(get_db)):
    """
    进入预备阶段（3 秒倒计时）
    """
    comp = _get_or_create_competition(db)
    comp.prep_phase = 1
    comp.is_active = 0
    comp.started_at = None
    db.commit()
    return {"message": "预备阶段", "prepPhase": True}


@router.post("/reset")
def reset_competition(db: Session = Depends(get_db)):
    """
    重置比赛计时器
    """
    comp = _get_or_create_competition(db)
    comp.is_active = 0
    comp.prep_phase = 0
    comp.total_seconds = 300
    comp.started_at = None
    db.commit()
    return {"message": "比赛已重置"}
