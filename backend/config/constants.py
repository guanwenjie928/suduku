"""
全局常量 —— 积分/竞技/网络等共享配置集中管理
"""
# 积分公式权重
LEVEL_WEIGHT = 1000   # 每完成一关的奖励分
WRONG_WEIGHT = 10     # 每个错误格子的扣分
EMPTY_WEIGHT = 5      # 每个未填格子的扣分
TIME_DIVISOR = 10     # 每 N 秒扣 1 分

# 竞技房间
RACE_LEVEL_ID = 5     # 竞技模式下 LevelDetail.level 固定值（区别于练习模式 1-4）
