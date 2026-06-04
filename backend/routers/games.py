"""
游戏提交 API —— 关卡成绩提交、全部通关
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Player, LevelDetail
from schemas import LevelDetailSubmit, GameCompleteRequest

router = APIRouter(prefix="/api/v1/games", tags=["games"])


@router.post("/submit")
def submit_level(body: LevelDetailSubmit, db: Session = Depends(get_db)):
    """
    提交单关成绩 —— 每完成一关立即调用
    仅接受练习模式关卡（level 1-4），竞技模式请使用 /competition/room/submit
    total_time 累加计算
    """
    # 拒绝竞技模式关卡
    if body.level == 5:
        raise HTTPException(status_code=400, detail="竞技模式请使用 /competition/room/submit 接口")

    player = db.query(Player).filter(Player.name == body.player_name).first()
    if not player:
        # 自动创建选手（防御性处理）
        player = Player(name=body.player_name)
        db.add(player)
        db.commit()
        db.refresh(player)

    # 写入关卡详情（允许同一关重复提交，保留最新记录）
    existing = db.query(LevelDetail).filter(
        LevelDetail.player_id == player.id,
        LevelDetail.level == body.level
    ).first()
    if existing:
        existing.time_seconds = body.time_seconds
        existing.empty_cells = body.empty_cells
        existing.wrong_cells = body.wrong_cells
        existing.correct_steps = body.correct_steps
        existing.incorrect_steps = body.incorrect_steps
    else:
        detail = LevelDetail(
            player_id=player.id,
            level=body.level,
            time_seconds=body.time_seconds,
            empty_cells=body.empty_cells,
            wrong_cells=body.wrong_cells,
            correct_steps=body.correct_steps,
            incorrect_steps=body.incorrect_steps,
        )
        db.add(detail)

    # 更新选手进度（total_time 累加）
    player.current_level = body.level - 1  # 转成 0-based 下标
    # level=5 竞技模式：进度直接 100%；否则按比例计算
    if body.level == 5:
        player.progress = 100
    else:
        player.progress = int((body.level / 4) * 100)
    player.total_time = player.total_time + body.time_seconds  # 累加，而非覆盖
    player.is_completed = 0  # 还没完全通关

    db.commit()

    return {
        "message": f"第{body.level}关成绩已记录",
        "success": True,
    }


@router.post("/complete")
def complete_game(body: GameCompleteRequest, db: Session = Depends(get_db)):
    """
    全部通关 —— 更新选手状态为已完成
    """
    player = db.query(Player).filter(Player.name == body.player_name).first()
    if not player:
        raise HTTPException(status_code=404, detail="选手不存在")

    # 更新选手为已完成
    player.is_completed = 1
    player.progress = 100
    player.current_level = body.completed_levels  # 已完成的总关数（1-based）

    db.commit()

    return {
        "message": f"🎉 {body.player_name} 全部通关！",
        "success": True,
    }
