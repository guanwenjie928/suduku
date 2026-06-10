"""
数独侦探 —— FastAPI 应用入口
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from routers import players, games, leaderboard, competition

app = FastAPI(
    title="数独侦探 API",
    description="四宫格数独·王牌侦探版 后端服务",
    version="2.0.0",
)

# ── CORS 配置 ──
# 允许所有来源访问（课堂/局域网内多设备场景）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 注册路由 ──
app.include_router(players.router)
app.include_router(games.router)
app.include_router(leaderboard.router)
app.include_router(competition.router)

# ── 前端静态文件 ──
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
FRONTEND_DIR = os.path.abspath(FRONTEND_DIR)
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

# ── 健康检查 ──
@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "sudoku-detective", "version": "2.0.0"}


# ══════════════════════════════════════════════
# 数据管理 —— 分模式清空端点
# ══════════════════════════════════════════════

@app.delete("/api/v1/admin/clear-ranking")
def clear_ranking_data():
    """
    清空王牌侦探模式数据：
    - 删除所有练习关卡记录（level 1-4）
    - 重置排名计时器
    - 注意：保留选手记录（仅清除练习进度），不触碰竞技模式（level=5）数据
    """
    from database import SessionLocal
    from models import Player, LevelDetail, Competition
    from sqlalchemy import delete

    db = SessionLocal()
    try:
        # 仅删除练习关卡记录（level 1-4），不动竞技模式 level=5
        db.execute(delete(LevelDetail).where(LevelDetail.level < 5))

        # 重置所有选手的练习进度（但保留竞技进度不受影响）
        players = db.query(Player).all()
        for p in players:
            # 检查是否还有竞技记录（level=5），有则保留竞技进度
            has_race = any(d.level == 5 for d in p.level_details)
            if not has_race:
                p.current_level = 0
                p.progress = 0
                p.total_time = 0
                p.is_completed = 0

        # 重置排名计时器字段（不动竞技房间字段）
        comp = db.query(Competition).first()
        if comp:
            comp.is_active = 0
            comp.prep_phase = 0
            comp.total_seconds = 180
            comp.started_at = None

        db.commit()
        return {"message": "王牌侦探模式数据已清空", "success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")
    finally:
        db.close()


@app.delete("/api/v1/admin/clear-race")
def clear_race_data():
    """
    清空竞技模式数据：
    - 删除所有竞技关卡记录（level=5）
    - 重置竞技房间状态
    - 注意：不触碰练习模式（level 1-4）数据
    """
    from database import SessionLocal
    from models import Player, LevelDetail, Competition
    from sqlalchemy import delete

    db = SessionLocal()
    try:
        # 仅删除竞技关卡记录（level=5）
        race_details = db.query(LevelDetail).filter(LevelDetail.level == 5).all()
        player_ids = set()
        for detail in race_details:
            player_ids.add(detail.player_id)
            db.delete(detail)

        # 重置相关选手的竞技进度
        if player_ids:
            players = db.query(Player).filter(Player.id.in_(player_ids)).all()
            for p in players:
                # 检查是否还有练习记录（level 1-4），有则保留练习进度
                has_practice = any(d.level < 5 for d in p.level_details)
                if has_practice:
                    # 保留练习进度，不清零
                    pass
                else:
                    p.current_level = 0
                    p.progress = 0
                    p.total_time = 0
                    p.is_completed = 0

        # 重置竞技房间字段（不动排名计时器字段）
        comp = db.query(Competition).first()
        if comp:
            comp.room_status = 'idle'
            comp.room_started_at = None
            comp.room_total_seconds = 120
            comp.joined_players = '[]'

        db.commit()
        return {"message": "竞技模式数据已清空", "success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")
    finally:
        db.close()


@app.delete("/api/v1/admin/clear")
def clear_all_data():
    """
    清空所有数据（王牌侦探 + 竞技模式，谨慎使用）
    """
    from database import SessionLocal
    from models import Player, LevelDetail, Competition
    from sqlalchemy import delete

    db = SessionLocal()
    try:
        # 按依赖顺序删除（先子表再父表）
        db.execute(delete(LevelDetail))
        db.execute(delete(Player))
        db.execute(delete(Competition))
        db.commit()
        return {"message": "所有数据已清空", "success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")
    finally:
        db.close()


# ── SPA 回退 ──
if os.path.isdir(FRONTEND_DIR):

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """SPA 回退 —— 所有非 API 路径返回 index.html"""
        # 跳过 API 路径
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        file_path = os.path.abspath(os.path.join(FRONTEND_DIR, full_path))
        # 防止路径遍历攻击
        if not file_path.startswith(FRONTEND_DIR):
            raise HTTPException(status_code=404)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
