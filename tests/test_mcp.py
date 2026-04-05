"""
MCP 服务自动化测试脚本

用途：
1. 验证 MCP 服务是否正常运行
2. 测试所有 MCP 工具功能
3. 诊断常见问题

使用方法：
    python test_mcp.py
"""

import requests
import json
import sys
import time
from typing import Optional, Dict, Any

# 配置
MCP_URL = "http://localhost:3000/api/mcp"
HOME_URL = "http://localhost:3000"

class MCPTester:
    def __init__(self):
        self.session_id: Optional[str] = None
        self.request_id = 0
        
    def print_section(self, title: str):
        """打印章节标题"""
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
    
    def print_result(self, success: bool, message: str):
        """打印结果"""
        symbol = "✅" if success else "❌"
        print(f"{symbol} {message}")
        
    def test_home_page(self) -> bool:
        """测试主页是否可访问"""
        self.print_section("测试 1: 检查服务运行状态")
        
        try:
            response = requests.get(HOME_URL, timeout=5)
            if response.status_code == 200:
                self.print_result(True, f"服务正在运行 (状态码: {response.status_code})")
                return True
            else:
                self.print_result(False, f"服务响应异常 (状态码: {response.status_code})")
                return False
        except requests.exceptions.ConnectionError:
            self.print_result(False, "无法连接到服务，请确认服务是否已启动")
            self.print_result(False, "运行命令: npm run dev")
            return False
        except Exception as e:
            self.print_result(False, f"测试失败: {str(e)}")
            return False
    
    def test_sse_connection(self) -> bool:
        """测试 SSE 连接"""
        self.print_section("测试 2: 建立 SSE 连接")
        
        try:
            response = requests.get(MCP_URL, stream=True, timeout=5)
            self.session_id = response.headers.get("X-Session-Id")
            
            if self.session_id:
                self.print_result(True, f"Session ID 已获取: {self.session_id}")
                return True
            else:
                self.print_result(False, "响应头中缺少 X-Session-Id")
                return False
                
        except Exception as e:
            self.print_result(False, f"SSE 连接失败: {str(e)}")
            return False
    
    def send_request(self, method: str, params: Dict[str, Any] = None) -> Dict:
        """发送 MCP 请求"""
        self.request_id += 1
        
        payload = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params or {}
        }
        
        headers = {
            "Content-Type": "application/json",
            "X-Session-Id": self.session_id
        }
        
        response = requests.post(MCP_URL, json=payload, headers=headers, timeout=10)
        return response.json()
    
    def test_initialize(self) -> bool:
        """测试初始化"""
        self.print_section("测试 3: 初始化 MCP 会话")
        
        try:
            result = self.send_request("initialize")
            
            if "result" in result:
                server_info = result["result"].get("serverInfo", {})
                self.print_result(True, f"服务器名称: {server_info.get('name')}")
                self.print_result(True, f"服务器版本: {server_info.get('version')}")
                self.print_result(True, f"协议版本: {result['result'].get('protocolVersion')}")
                return True
            elif "error" in result:
                self.print_result(False, f"初始化失败: {result['error']}")
                return False
            else:
                self.print_result(False, f"响应格式异常: {result}")
                return False
                
        except Exception as e:
            self.print_result(False, f"初始化失败: {str(e)}")
            return False
    
    def test_list_tools(self) -> bool:
        """测试工具列表"""
        self.print_section("测试 4: 获取工具列表")
        
        try:
            result = self.send_request("tools/list")
            
            if "result" in result:
                tools = result["result"].get("tools", [])
                self.print_result(True, f"共找到 {len(tools)} 个工具")
                
                for tool in tools:
                    print(f"  - {tool['name']}: {tool['description']}")
                
                return len(tools) == 3  # 应该有 3 个工具
            else:
                self.print_result(False, f"获取工具列表失败: {result}")
                return False
                
        except Exception as e:
            self.print_result(False, f"测试失败: {str(e)}")
            return False
    
    def test_recommend_scale(self) -> bool:
        """测试推荐量表"""
        self.print_section("测试 5: 调用 recommend_scale 工具")
        
        try:
            result = self.send_request("tools/call", {
                "name": "recommend_scale",
                "arguments": {"symptoms": "转圈 不理人 自闭"}
            })
            
            if "result" in result:
                content = result["result"].get("content", [])
                if content and len(content) > 0:
                    text = content[0].get("text", "")
                    self.print_result(True, "工具调用成功")
                    print(f"  响应内容: {text[:100]}...")
                    return True
            
            self.print_result(False, f"工具调用失败: {result}")
            return False
                
        except Exception as e:
            self.print_result(False, f"测试失败: {str(e)}")
            return False
    
    def test_get_questions(self) -> bool:
        """测试获取题目"""
        self.print_section("测试 6: 调用 get_scale_questions 工具")
        
        try:
            result = self.send_request("tools/call", {
                "name": "get_scale_questions",
                "arguments": {
                    "scaleId": "ABC",
                    "offset": 0,
                    "limit": 3
                }
            })
            
            if "result" in result:
                content = result["result"].get("content", [])
                if content and len(content) > 0:
                    text = content[0].get("text", "")
                    data = json.loads(text)
                    
                    self.print_result(True, f"工具调用成功")
                    print(f"  题目数量: {data.get('total')}")
                    print(f"  返回题目: {len(data.get('questions', []))}")
                    print(f"  是否有更多: {data.get('hasMore')}")
                    return True
            
            self.print_result(False, f"工具调用失败: {result}")
            return False
                
        except Exception as e:
            self.print_result(False, f"测试失败: {str(e)}")
            return False
    
    def test_submit_evaluate(self) -> bool:
        """测试提交评分"""
        self.print_section("测试 7: 调用 submit_and_evaluate 工具")
        
        try:
            # 模拟答案（前 3 题）
            result = self.send_request("tools/call", {
                "name": "submit_and_evaluate",
                "arguments": {
                    "scaleId": "ABC",
                    "answers": [4, 2, 4]  # 模拟前 3 题的答案
                }
            })
            
            if "result" in result:
                content = result["result"].get("content", [])
                if content and len(content) > 0:
                    text = content[0].get("text", "")
                    data = json.loads(text)
                    
                    self.print_result(True, f"工具调用成功")
                    print(f"  总分: {data.get('totalScore')}")
                    print(f"  结论: {data.get('conclusion')}")
                    return True
            
            self.print_result(False, f"工具调用失败: {result}")
            return False
                
        except Exception as e:
            self.print_result(False, f"测试失败: {str(e)}")
            return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("  AI 量表系统 - MCP 服务自动化测试")
        print("="*60)
        print(f"测试地址: {MCP_URL}")
        print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        results = []
        
        # 运行所有测试
        results.append(("主页访问", self.test_home_page()))
        
        if not results[0][1]:
            print("\n❌ 服务未运行，请先启动服务: npm run dev")
            return
        
        results.append(("SSE 连接", self.test_sse_connection()))
        
        if not results[1][1]:
            print("\n❌ SSE 连接失败，请检查 MCP 端点配置")
            return
        
        results.append(("初始化", self.test_initialize()))
        results.append(("工具列表", self.test_list_tools()))
        results.append(("推荐量表", self.test_recommend_scale()))
        results.append(("获取题目", self.test_get_questions()))
        results.append(("提交评分", self.test_submit_evaluate()))
        
        # 打印总结
        self.print_section("测试总结")
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for name, result in results:
            self.print_result(result, name)
        
        print(f"\n总计: {passed}/{total} 测试通过")
        
        if passed == total:
            print("\n✅ 恭喜！所有测试通过，MCP 服务已就绪！")
            print("\n📝 下一步:")
            print("  1. 配置 qclaw 环境（参考 MCP_SETUP_GUIDE.md）")
            print("  2. 在 qclaw 中调用 MCP 工具")
        else:
            print("\n❌ 部分测试失败，请检查上述错误信息")

def main():
    try:
        tester = MCPTester()
        tester.run_all_tests()
    except KeyboardInterrupt:
        print("\n\n测试已取消")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 发生错误: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
