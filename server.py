"""
数独侦探 - 一体化服务器
========================
适用场景: 容器/K8s 环境，nginx 反向代理 + FastAPI + React SPA

功能:
- 原有后端 API（MySQL 数据库）
- 前端静态文件服务
- SPA fallback
- 自动剥离 UUID/路径前缀

启动:
  python3 server.py
或:
  uvicorn server:app --host 0.0.0.0 --port 9080
"""

import re
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# ─── 导入原有后端 ──────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent / "backend"))
from database import engine, Base
from routers import players, games, leaderboard, competition, admin

# ─── 项目配置 ──────────────────────────────────────────────
ROOT = Path(__file__).parent
DIST_DIR = ROOT / "frontend" / "dist"
SERVER_PORT = 9080

# ─── 路径前缀剥离中间件 ────────────────────────────────────
UUID_PATTERN = re.compile(
    r'^/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
)
CUSTOM_PREFIX = "/sudoku/"


class StripPathPrefixMiddleware(BaseHTTPMiddleware):
    """自动剥离路径前缀，支持 UUID 和自定义前缀两种模式"""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 1) 剥离远程浏览器 UUID 前缀
        m = UUID_PATTERN.match(path)
        if m:
            new_path = path[m.end() - 1:]
            request.scope["path"] = new_path
            request.scope["raw_path"] = new_path.encode()
            return await call_next(request)

        # 2) 剥离自定义路径前缀（如 /sudoku/）
        if CUSTOM_PREFIX and CUSTOM_PREFIX != "/" and path.startswith(CUSTOM_PREFIX):
            new_path = path[len(CUSTOM_PREFIX) - 1:]
            request.scope["path"] = new_path
            request.scope["raw_path"] = new_path.encode()

        return await call_next(request)


# ─── FastAPI 应用 ──────────────────────────────────────────
app = FastAPI(title="数独侦探", version="2.0.0")

app.add_middleware(StripPathPrefixMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 注册原有路由 ──────────────────────────────────────────
app.include_router(players.router)
app.include_router(games.router)
app.include_router(leaderboard.router)
app.include_router(competition.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return JSONResponse({"status": "ok", "app": "sudoku", "version": "2.0.0"})


# ─── 前端静态文件 & SPA fallback ───────────────────────────
@app.get("/{path:path}")
async def serve_frontend(path: str):
    """服务前端静态文件，非 API 路径回退到 SPA index.html"""

    if path.startswith("api/"):
        return JSONResponse({"detail": "API endpoint not found"}, status_code=404)

    file_path = DIST_DIR / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)

    index_path = DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    return JSONResponse(
        {"message": "前端文件未找到，请先构建: cd frontend && npm run build"},
        status_code=404,
    )


# ─── 启动入口 ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=SERVER_PORT)
