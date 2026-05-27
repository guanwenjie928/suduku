"""
数据库初始化脚本
用法：
  python seed.py          # 创建表 + 填充初始数据
  python seed.py --reset  # 删除所有表并重建
  python seed.py --drop   # 仅删除所有表
"""
import sys
import os

# 添加当前目录到 sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal, Base, MYSQL_DATABASE
from models import Player, LevelDetail, Competition, HistoryRecord
from sqlalchemy import text


def init_database():
    """创建数据库（如果不存在）"""
    from sqlalchemy import create_engine
    from database import MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD

    temp_engine = create_engine(
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}?charset=utf8mb4"
    )
    with temp_engine.connect() as conn:
        conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
        conn.execute(text("COMMIT"))
    temp_engine.dispose()
    print(f"✓ 数据库 '{MYSQL_DATABASE}' 已就绪")


def create_tables():
    """创建所有表"""
    Base.metadata.create_all(bind=engine)
    print("✓ 所有表已创建")


def seed_data():
    """填充初始种子数据"""
    db = SessionLocal()
    try:
        if db.query(Player).count() > 0:
            print("→ 数据库中已有数据，跳过种子填充")
            return

        # 创建默认比赛计时器
        comp = Competition(is_active=0, total_seconds=300, prep_phase=0)
        db.add(comp)

        # 创建示例选手
        demo_players = [
            {"name": "第一小组", "current_level": 2, "progress": 50, "total_time": 189},
            {"name": "第二小组", "current_level": 3, "progress": 100, "total_time": 312, "is_completed": 1},
            {"name": "第三小组", "current_level": 1, "progress": 25, "total_time": 120},
        ]

        for pd in demo_players:
            p = Player(**pd)
            db.add(p)
            db.flush()

            # 给第二小组加上关卡详情
            if pd["name"] == "第二小组":
                for lv in range(1, 5):
                    db.add(LevelDetail(
                        player_id=p.id,
                        level=lv,
                        time_seconds=60 + lv * 18,
                        empty_cells=lv % 2,
                        wrong_cells=1 if lv == 3 else 0,
                    ))

        # 历史记录
        db.add(HistoryRecord(
            player_name="第二小组",
            completed_levels=4,
            total_time=312,
            wrong_cells=1,
            empty_cells=2,
        ))
        db.add(HistoryRecord(
            player_name="第五小组",
            completed_levels=4,
            total_time=425,
            wrong_cells=2,
            empty_cells=3,
        ))

        db.commit()
        print("✓ 种子数据已填充")

    finally:
        db.close()


def drop_all():
    """删除所有表"""
    Base.metadata.drop_all(bind=engine)
    print("✓ 所有表已删除")


if __name__ == "__main__":
    if "--drop" in sys.argv:
        drop_all()
    elif "--reset" in sys.argv:
        drop_all()
        init_database()
        create_tables()
        seed_data()
    else:
        init_database()
        create_tables()
        seed_data()

    print("\n数据库初始化完成！")
