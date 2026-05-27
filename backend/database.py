"""
MySQL 数据库连接配置
通过环境变量或 .env 文件读取连接参数
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 数据库连接参数 —— 部署时通过 .env 覆盖
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_USER = os.getenv("MYSQL_USER", "sudoku")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "sudoku123")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "sudoku_detective")

DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}?charset=utf8mb4"

# 引擎 —— 连接池大小根据轻量服务器设为 5
engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,       # 1 小时回收，避免 MySQL 8 小时断连
    pool_pre_ping=True,      # 每次取连接前 ping 一下
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 依赖注入：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
