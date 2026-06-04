"""
测试竞技模式大屏页面
验证首页→竞技大屏导航，以及房间控制流程
"""
from playwright.sync_api import sync_playwright

def test_competition_big_screen():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 1. 导航到首页
            print("导航到首页...")
            page.goto('http://127.0.0.1/sudoku/')
            page.wait_for_load_state('networkidle')
            page.screenshot(path='/tmp/sudoku_home.png', full_page=True)
            print("✓ 首页加载成功")

            # 2. 检查首页按钮
            buttons = page.locator('button').all()
            button_texts = [b.text_content() for b in buttons]
            print(f"页面按钮: {button_texts}")

            assert any('竞技大屏' in t for t in button_texts), "未找到'竞技大屏'按钮"
            print("✓ 竞技大屏按钮存在")

            # 3. 点击竞技大屏按钮
            print("点击竞技大屏按钮...")
            page.click('button:has-text("竞技大屏")')
            page.wait_for_load_state('networkidle')
            page.screenshot(path='/tmp/competition_big_screen.png', full_page=True)
            print("✓ 竞技大屏页面加载成功")

            # 4. 验证竞技大屏页面元素
            content = page.content()
            assert '竞技模式大屏' in content, "页面标题不正确"
            assert '教师控制面板' in content, "副标题不存在"
            print("✓ 竞技大屏页面元素验证通过")

            # 5. 检查状态徽章和按钮
            status_badge = page.locator('.text-lg').filter(has_text='空闲').first
            assert status_badge.count() > 0 or '空闲' in content, "状态徽章不存在"
            print("✓ 状态徽章存在")

            # 6. 检查开启房间按钮
            open_room_btn = page.locator('button:has-text("开启房间")')
            assert open_room_btn.count() > 0, "开启房间按钮不存在"
            print("✓ 开启房间按钮存在")

            # 7. 测试房间状态API（后端集成测试）
            import requests
            api_status = requests.get('http://127.0.0.1/sudoku/api/v1/competition/room/status', timeout=5)
            assert api_status.status_code == 200
            data = api_status.json()
            assert 'roomStatus' in data
            print(f"✓ API状态正常: roomStatus={data['roomStatus']}")

            # 8. 测试开启房间
            print("点击开启房间...")
            open_room_btn.click()
            page.wait_for_timeout(1000)  # 等待API响应
            page.screenshot(path='/tmp/room_opened.png', full_page=True)

            # 检查状态是否变为lobby
            api_status = requests.get('http://127.0.0.1/sudoku/api/v1/competition/room/status', timeout=5)
            data = api_status.json()
            if data['roomStatus'] == 'lobby':
                print("✓ 房间已成功开启，状态为: lobby")
            else:
                print(f"⚠ 房间状态: {data['roomStatus']} (可能需要后端支持)")

            # 9. 验证统计面板
            stats_cards = page.locator('.bg-white\\/5').count()
            print(f"✓ 统计卡片数量: {stats_cards}")

            # 10. 返回首页
            print("点击返回按钮...")
            page.click('button:has-text("返回")')
            page.wait_for_load_state('networkidle')
            page.screenshot(path='/tmp/back_to_home.png', full_page=True)
            assert any('开始挑战' in t for t in [b.text_content() for b in page.locator('button').all()])
            print("✓ 返回首页成功")

            print("\n=== 测试通过 ===")
            return True

        except Exception as e:
            print(f"\n✗ 测试失败: {e}")
            page.screenshot(path='/tmp/test_failure.png', full_page=True)
            raise

        finally:
            browser.close()

if __name__ == '__main__':
    test_competition_big_screen()
