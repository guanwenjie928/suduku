"""
比赛计时 API —— 统一倒计时管理 + 竞技房间
数据库中只保留 1 条 competition 记录
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import Competition, Player, LevelDetail
from schemas import CompetitionStart, RaceSubmit, RoomJoin
from config.constants import LEVEL_WEIGHT, WRONG_WEIGHT, EMPTY_WEIGHT, TIME_DIVISOR, RACE_LEVEL_ID

router = APIRouter(prefix="/api/v1/competition", tags=["competition"])

# ── 常量 ──
RANKING_TOTAL_SECONDS = 180   # 排名模式倒计时（秒）
ROOM_TOTAL_SECONDS = 120      # 竞技房间倒计时（秒）
RACE_PUZZLE = [[1, 0, 0, 0], [0, 0, 0, 4], [3, 0, 0, 0], [0, 0, 0, 2]]
RACE_SOLUTION = [[1, 4, 2, 3], [2, 3, 1, 4], [3, 2, 4, 1], [4, 1, 3, 2]]
RACE_TOTAL_CELLS = 16  # 4×4


def _get_or_create_competition(db: Session) -> Competition:
    comp = db.query(Competition).first()
    if not comp:
        comp = Competition(is_active=0, total_seconds=RANKING_TOTAL_SECONDS, prep_phase=0)
        db.add(comp)
        db.commit()
        db.refresh(comp)
    return comp


def _calc_score(empty_cells: int, wrong_cells: int, time_seconds: int) -> int:
    """统一积分计算 —— 后端唯一计分入口（与 leaderboard.py 公式一致）"""
    return (
        LEVEL_WEIGHT  # 提交即计 1 关完成分
        - wrong_cells * WRONG_WEIGHT
        - empty_cells * EMPTY_WEIGHT
        - time_seconds // TIME_DIVISOR
    )


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
    comp.total_seconds = RANKING_TOTAL_SECONDS
    comp.started_at = None
    db.commit()
    return {"message": "比赛已重置"}


# ══════════════════════════════════════════════
# 竞技房间 API
# ══════════════════════════════════════════════


@router.get("/room/status")
def get_room_status(db: Session = Depends(get_db)):
    """
    获取竞技房间状态（玩家端每 1 秒轮询）
    返回房间状态、倒计时、题目数据
    """
    comp = _get_or_create_competition(db)
    data = comp.to_dict()

    # 计算竞技房间实际剩余时间
    if comp.room_status == 'active' and comp.room_started_at:
        elapsed = (datetime.utcnow() - comp.room_started_at).total_seconds()
        remaining = max(0, comp.room_total_seconds - int(elapsed))
        data["roomRemainingSeconds"] = remaining

        # 时间到了自动结束
        if remaining <= 0:
            comp.room_status = 'ended'
            data["roomStatus"] = 'ended'
            data["roomRemainingSeconds"] = 0
            db.commit()

    # 仅在 active 状态时下发题目（防止提前偷看）
    if comp.room_status == 'active':
        data["puzzle"] = RACE_PUZZLE
        data["solution"] = RACE_SOLUTION

    return data


@router.post("/room/open")
def open_room(db: Session = Depends(get_db)):
    """教师开启竞技房间 → 进入 lobby 状态"""
    comp = _get_or_create_competition(db)
    comp.room_status = 'lobby'
    comp.room_started_at = None
    comp.joined_players = '[]'
    db.commit()
    return {"message": "竞技房间已开启，等待选手加入", "roomStatus": "lobby", "joinedPlayers": []}


@router.post("/room/join")
def join_room(body: RoomJoin, db: Session = Depends(get_db)):
    """选手加入竞技房间"""
    comp = _get_or_create_competition(db)
    if comp.room_status not in ('lobby', 'idle'):
        raise HTTPException(status_code=400, detail="房间未开放加入")
    joined = json.loads(comp.joined_players or '[]')
    if body.player_name not in joined:
        joined.append(body.player_name)
        comp.joined_players = json.dumps(joined, ensure_ascii=False)
        db.commit()
    return {"message": f"{body.player_name} 已加入房间", "joinedPlayers": joined}


@router.post("/room/start")
def start_room(db: Session = Depends(get_db)):
    """教师启动比赛 → 进入 active 状态，2 分钟倒计时开始"""
    comp = _get_or_create_competition(db)
    comp.room_status = 'active'
    comp.room_total_seconds = ROOM_TOTAL_SECONDS
    comp.room_started_at = datetime.utcnow()
    db.commit()
    return {
        "message": f"竞技比赛开始！倒计时 {ROOM_TOTAL_SECONDS} 秒",
        "roomStatus": "active",
        "roomTotalSeconds": ROOM_TOTAL_SECONDS,
        "roomRemainingSeconds": ROOM_TOTAL_SECONDS,
    }


@router.post("/room/end")
def end_room(db: Session = Depends(get_db)):
    """强制结束比赛"""
    comp = _get_or_create_competition(db)
    comp.room_status = 'ended'
    db.commit()
    return {"message": "比赛已结束", "roomStatus": "ended"}


@router.post("/room/submit")
def submit_race(body: RaceSubmit, db: Session = Depends(get_db)):
    """
    竞技模式提交答案（幂等：同一选手多次提交只保留最新）
    使用 level=5 标识竞技模式关卡，与练习模式 1-4 区分
    """
    comp = _get_or_create_competition(db)

    # 比赛已结束则拒绝提交
    if comp.room_status == 'ended':
        raise HTTPException(status_code=400, detail="比赛已结束，无法提交")
    if comp.room_status != 'active':
        raise HTTPException(status_code=400, detail="比赛尚未开始")

    # 计算实际用时（服务端权威时间，防止客户端篡改）
    time_seconds = body.time_seconds
    if comp.room_started_at:
        time_seconds = int((datetime.utcnow() - comp.room_started_at).total_seconds())

    # 自动创建/查找选手（处理并发 TOCTOU）
    player = db.query(Player).filter(Player.name == body.player_name).first()
    if not player:
        player = Player(name=body.player_name)
        db.add(player)
        try:
            db.commit()
            db.refresh(player)
        except IntegrityError:
            db.rollback()
            player = db.query(Player).filter(Player.name == body.player_name).first()

    # 同一选手的 level=5 记录唯一（幂等：多次提交只保留最新）
    existing = (
        db.query(LevelDetail)
        .filter(LevelDetail.player_id == player.id, LevelDetail.level == RACE_LEVEL_ID)
        .first()
    )
    if existing:
        existing.time_seconds = time_seconds
        existing.empty_cells = body.empty_cells
        existing.wrong_cells = body.wrong_cells
        existing.correct_steps = body.correct_steps
        existing.incorrect_steps = body.incorrect_steps
    else:
        detail = LevelDetail(
            player_id=player.id,
            level=RACE_LEVEL_ID,
            time_seconds=time_seconds,
            empty_cells=body.empty_cells,
            wrong_cells=body.wrong_cells,
            correct_steps=body.correct_steps,
            incorrect_steps=body.incorrect_steps,
        )
        db.add(detail)

    # 更新选手进度
    player.current_level = RACE_LEVEL_ID
    player.progress = 100
    player.total_time = time_seconds

    db.commit()

    # 计算积分
    score = _calc_score(body.empty_cells, body.wrong_cells, time_seconds)

    return {
        "message": f"{body.player_name} 竞技成绩已记录",
        "success": True,
        "score": score,
    }


@router.post("/room/reset")
def reset_room(db: Session = Depends(get_db)):
    """重置竞技房间 —— 同时清除所有竞技历史数据（level=5 的提交记录 & 选手进度）"""
    comp = _get_or_create_competition(db)
    comp.room_status = 'idle'
    comp.room_started_at = None
    comp.joined_players = '[]'

    # 清除所有竞技关卡的提交记录
    race_details = db.query(LevelDetail).filter(LevelDetail.level == RACE_LEVEL_ID).all()
    player_ids = set()
    for detail in race_details:
        player_ids.add(detail.player_id)
        db.delete(detail)

    # 重置相关选手的进度
    if player_ids:
        players = db.query(Player).filter(Player.id.in_(player_ids)).all()
        for p in players:
            practice_count = db.query(LevelDetail).filter(LevelDetail.player_id == p.id, LevelDetail.level != RACE_LEVEL_ID).count()
            if practice_count == 0:
                p.current_level = 0
            p.progress = 0

    db.commit()
    return {
        "message": "竞技房间已重置，历史数据已清空",
        "roomStatus": "idle",
        "clearedPlayers": len(player_ids),
    }


@router.get("/room/stats")
def get_room_stats(db: Session = Depends(get_db)):
    """
    获取竞技房间统计数据（教师大屏用）
    返回：参与人数、已完成人数、平均正确率、步数统计、当前领先
    """
    comp = _get_or_create_competition(db)

    # 查询所有 level=5 的提交（含步数统计）
    submissions = (
        db.query(LevelDetail, Player.name)
        .join(Player, LevelDetail.player_id == Player.id)
        .filter(LevelDetail.level == RACE_LEVEL_ID)
        .all()
    )

    total_players = len(submissions)
    if total_players == 0:
        return {
            "totalPlayers": 0,
            "completedPlayers": 0,
            "averageAccuracy": 0,
            "totalCorrectSteps": 0,
            "totalIncorrectSteps": 0,
            "averageStepAccuracy": 0,
            "leaderName": None,
            "leaderScore": 0,
            "rankings": [],
            "joinedPlayers": json.loads(comp.joined_players or '[]'),
        }

    # 已完成：全对且无未填
    completed_players = sum(
        1 for s, _ in submissions
        if s.empty_cells == 0 and s.wrong_cells == 0
    )

    # 平均正确率：正确格子 / 总格子
    total_correct = sum(
        RACE_TOTAL_CELLS - s.empty_cells - s.wrong_cells
        for s, _ in submissions
    )
    avg_accuracy = round(total_correct / (total_players * RACE_TOTAL_CELLS) * 100, 1)

    # 步数统计
    total_correct_steps = sum(s.correct_steps or 0 for s, _ in submissions)
    total_incorrect_steps = sum(s.incorrect_steps or 0 for s, _ in submissions)
    total_steps = total_correct_steps + total_incorrect_steps
    avg_step_accuracy = round(total_correct_steps / total_steps * 100, 1) if total_steps > 0 else 0

    # 积分排名
    rankings = []
    for s, name in submissions:
        score = _calc_score(s.empty_cells, s.wrong_cells, s.time_seconds)
        cs = s.correct_steps or 0
        ics = s.incorrect_steps or 0
        total_s = cs + ics
        rankings.append({
            "name": name,
            "score": score,
            "timeSeconds": s.time_seconds,
            "correctCells": RACE_TOTAL_CELLS - s.empty_cells - s.wrong_cells,
            "wrongCells": s.wrong_cells,
            "emptyCells": s.empty_cells,
            "correctSteps": cs,
            "incorrectSteps": ics,
            "stepAccuracy": round(cs / total_s * 100, 1) if total_s > 0 else 0,
            "isCompleted": s.empty_cells == 0 and s.wrong_cells == 0,
        })
    rankings.sort(key=lambda x: x["score"], reverse=True)

    leader = rankings[0] if rankings else None

    return {
        "totalPlayers": total_players,
        "completedPlayers": completed_players,
        "averageAccuracy": avg_accuracy,
        "totalCorrectSteps": total_correct_steps,
        "totalIncorrectSteps": total_incorrect_steps,
        "averageStepAccuracy": avg_step_accuracy,
        "leaderName": leader["name"] if leader else None,
        "leaderScore": leader["score"] if leader else 0,
        "rankings": rankings,
        "joinedPlayers": json.loads(comp.joined_players or '[]'),
    }
