"""
选手管理 API —— 创建、查询、删除
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Player, LevelDetail
from schemas import PlayerCreate

router = APIRouter(prefix="/api/v1/players", tags=["players"])


@router.get("")
def list_players(db: Session = Depends(get_db)):
    """
    获取所有活跃选手列表（含关卡详情），
    按 wrong_cells → empty_cells → total_time 排序
    """
    players = db.query(Player).all()
    result = []
    for p in players:
        d = p.to_dict()
        details = db.query(LevelDetail).filter(LevelDetail.player_id == p.id).order_by(LevelDetail.level).all()
        d["levelDetails"] = [ld.to_dict() for ld in details]
        result.append(d)
    return result


@router.post("")
def create_or_join(body: PlayerCreate, db: Session = Depends(get_db)):
    """
    创建新选手 或 已有选手直接返回（幂等）
    如果有同名选手就返回已有记录，否则创建新的
    """
    name = body.name.strip()
    existing = db.query(Player).filter(Player.name == name).first()
    if existing:
        # 已有 —— 重置进度（重新开始）
        existing.current_level = 0
        existing.progress = 0
        existing.total_time = 0
        existing.is_completed = 0
        # 清除旧的关卡详情
        db.query(LevelDetail).filter(LevelDetail.player_id == existing.id).delete()
        db.commit()
        db.refresh(existing)
        return {
            "message": f"欢迎回来，{name}！进度已重置",
            "player": existing.to_dict(),
            "isNew": False,
        }

    # 新建
    player = Player(name=name)
    db.add(player)
    db.commit()
    db.refresh(player)
    return {
        "message": f"选手 {name} 加入挑战！",
        "player": player.to_dict(),
        "isNew": True,
    }


@router.get("/{player_name}")
def get_player(player_name: str, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.name == player_name).first()
    if not player:
        raise HTTPException(status_code=404, detail="选手不存在")
    d = player.to_dict()
    details = db.query(LevelDetail).filter(LevelDetail.player_id == player.id).order_by(LevelDetail.level).all()
    d["levelDetails"] = [ld.to_dict() for ld in details]
    return d
