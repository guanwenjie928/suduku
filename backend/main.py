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


# ── 数据管理 ──
@app.delete("/api/v1/admin/clear")
def clear_all_data():
    """清空所有数据（谨慎使用）"""
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
        return {"message": "✅ 所有数据已清空", "success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")
    finally:
        db.close()


# ── 前端静态文件 ──
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
FRONTEND_DIR = os.path.abspath(FRONTEND_DIR)
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

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


# ── 数据管理 ──
@app.delete("/api/v1/admin/clear")
def clear_all_data():
    """清空所有数据（谨慎使用）"""
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
        return {"message": "✅ 所有数据已清空", "success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")
    finally:
        db.close()
