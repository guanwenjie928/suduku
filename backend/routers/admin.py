from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Player, LevelDetail, Competition

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

@router.delete("/clear")
def clear_all_data(db: Session = Depends(get_db)):
    """清除所有数据（练习 + 竞技）"""
    db.query(LevelDetail).delete()
    db.query(Player).delete()
    db.query(Competition).delete()
    db.commit()
    return {"message": "所有数据已清除", "success": True}
