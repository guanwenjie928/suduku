"""
选手管理 API —— 创建、查询、模式隔离重置
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Player, LevelDetail
from schemas import PlayerCreate
from config.constants import RACE_LEVEL_ID

router = APIRouter(prefix="/api/v1/players", tags=["players"])


@router.get("")
def list_players(db: Session = Depends(get_db)):
    """获取所有活跃选手列表（含关卡详情）"""
    players = db.query(Player).all()
    result = []
    for p in players:
        d = p.to_dict()
        details = db.query(LevelDetail).filter(
            LevelDetail.player_id == p.id
        ).order_by(LevelDetail.level).all()
        d["levelDetails"] = [ld.to_dict() for ld in details]
        result.append(d)
    return result


@router.post("")
def create_or_join(body: PlayerCreate, db: Session = Depends(get_db)):
    """
    创建新选手 或 已有选手直接返回（幂等）
    不再清除已有数据 —— 各模式独立管理自己的进度
    """
    name = body.name.strip()
    existing = db.query(Player).filter(Player.name == name).first()
    if existing:
        return {
            "message": f"欢迎回来，{name}！",
            "player": existing.to_dict(),
            "isNew": False,
        }

    player = Player(name=name)
    db.add(player)
    db.commit()
    db.refresh(player)
    return {
        "message": f"选手 {name} 加入挑战！",
        "player": player.to_dict(),
        "isNew": True,
    }


@router.delete("/{player_name}/progress")
def clear_player_progress(
    player_name: str,
    mode: str = Query("all", description="清除模式: practice(关卡1-4), competition(关卡5), all(全部)"),
    db: Session = Depends(get_db),
):
    """
    按模式清除选手进度 + 自动清理无数据选手
    - mode=practice: 清除关卡 1-4，若无竞技数据则删除选手
    - mode=competition: 清除关卡 5，若无练习数据则删除选手
    - mode=all: 清除全部记录并删除选手
    """
    player = db.query(Player).filter(Player.name == player_name).first()
    if not player:
        raise HTTPException(status_code=404, detail="选手不存在")

    delete_player = False

    if mode == "competition":
        db.query(LevelDetail).filter(
            LevelDetail.player_id == player.id,
            LevelDetail.level == RACE_LEVEL_ID
        ).delete()
        # 检查是否还有练习数据
        practice_remaining = db.query(LevelDetail).filter(
            LevelDetail.player_id == player.id,
            LevelDetail.level != RACE_LEVEL_ID
        ).count()
        if practice_remaining == 0:
            delete_player = True
        else:
            if player.current_level == RACE_LEVEL_ID - 1 or player.current_level == RACE_LEVEL_ID:
                player.current_level = 0
                player.progress = 0
    elif mode == "practice":
        db.query(LevelDetail).filter(
            LevelDetail.player_id == player.id,
            LevelDetail.level != RACE_LEVEL_ID
        ).delete()
        # 检查是否还有竞技数据
        comp_remaining = db.query(LevelDetail).filter(
            LevelDetail.player_id == player.id,
            LevelDetail.level == RACE_LEVEL_ID
        ).count()
        if comp_remaining == 0:
            delete_player = True
        else:
            player.current_level = 0
            player.progress = 0
            player.total_time = 0
    else:  # all
        db.query(LevelDetail).filter(
            LevelDetail.player_id == player.id
        ).delete()
        delete_player = True

    if delete_player:
        db.query(LevelDetail).filter(
            LevelDetail.player_id == player.id
        ).delete()
        db.delete(player)
        db.commit()
        return {
            "message": f"选手 {player_name} 已删除",
            "success": True,
            "deleted": True,
        }

    db.commit()
    return {
        "message": f"{player_name} 的 {mode} 模式进度已清除",
        "success": True,
    }


@router.get("/{player_name}")
def get_player(player_name: str, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.name == player_name).first()
    if not player:
        raise HTTPException(status_code=404, detail="选手不存在")
    d = player.to_dict()
    details = db.query(LevelDetail).filter(
        LevelDetail.player_id == player.id
    ).order_by(LevelDetail.level).all()
    d["levelDetails"] = [ld.to_dict() for ld in details]
    return d
