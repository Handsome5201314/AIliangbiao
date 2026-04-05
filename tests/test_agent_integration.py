"""
智能体接入测试示例
演示如何通过MCP协议调用AI量表系统
"""

import requests
import json

class AIScaleClient:
    """AI量表系统MCP客户端"""
    
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.request_id = 0
    
    def call_tool(self, endpoint, tool_name, arguments):
        """调用MCP工具"""
        self.request_id += 1
        
        url = f"{self.base_url}/api/mcp/{endpoint}"
        payload = {
            "jsonrpc": "2.0",
            "id": str(self.request_id),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            result = response.json()
            
            # 解析结果
            if "result" in result:
                content = result["result"]["content"][0]["text"]
                return json.loads(content)
            else:
                return {"error": result.get("error", {}).get("message", "Unknown error")}
        except Exception as e:
            return {"error": str(e)}
    
    def get_tools_list(self, endpoint):
        """获取工具列表"""
        url = f"{self.base_url}/api/mcp/{endpoint}"
        payload = {
            "jsonrpc": "2.0",
            "id": "tools-list",
            "method": "tools/list"
        }
        
        response = requests.post(url, json=payload)
        return response.json()


def test_memory_skill():
    """测试Memory Skill"""
    print("\n" + "="*50)
    print("测试 Memory Skill")
    print("="*50)
    
    client = AIScaleClient()
    test_device_id = "test-agent-001"
    
    # 1. 获取工具列表
    print("\n1. 获取工具列表...")
    tools = client.get_tools_list("memory")
    print(f"可用工具：")
    for tool in tools.get("result", {}).get("tools", []):
        print(f"  - {tool['name']}: {tool['description']}")
    
    # 2. 获取用户记忆
    print(f"\n2. 获取用户记忆 (deviceId: {test_device_id})...")
    memory = client.get_user_memory(test_device_id)
    print(f"结果: {json.dumps(memory, ensure_ascii=False, indent=2)}")
    
    # 3. 保存用户记忆
    print(f"\n3. 保存用户记忆...")
    result = client.save_user_memory(
        test_device_id,
        interest="喜欢看旋转的东西",
        fear="害怕大声音"
    )
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_growth_skill():
    """测试Growth Curve Skill"""
    print("\n" + "="*50)
    print("测试 Growth Curve Skill")
    print("="*50)
    
    client = AIScaleClient()
    test_device_id = "test-agent-001"
    
    # 1. 获取工具列表
    print("\n1. 获取工具列表...")
    tools = client.get_tools_list("growth")
    print(f"可用工具：")
    for tool in tools.get("result", {}).get("tools", []):
        print(f"  - {tool['name']}: {tool['description']}")
    
    # 2. 添加生长记录
    print(f"\n2. 添加生长记录...")
    record = client.add_growth_record(
        test_device_id,
        age_months=6,
        weight=7.5,
        height=65,
        head_circumference=42
    )
    print(f"结果: {json.dumps(record, ensure_ascii=False, indent=2)}")
    
    # 3. 获取生长历史
    print(f"\n3. 获取生长历史...")
    history = client.get_growth_history(test_device_id, limit=5)
    print(f"结果: {json.dumps(history, ensure_ascii=False, indent=2)}")
    
    # 4. 综合评估
    print(f"\n4. 综合评估...")
    evaluation = client.evaluate_growth(test_device_id)
    print(f"结果: {json.dumps(evaluation, ensure_ascii=False, indent=2)}")


# 扩展客户端方法
AIScaleClient.get_user_memory = lambda self, device_id: \
    self.call_tool("memory", "get_user_memory", {"deviceId": device_id})

AIScaleClient.save_user_memory = lambda self, device_id, interest=None, fear=None: \
    self.call_tool("memory", "save_user_memory", {
        "deviceId": device_id,
        **({"interest": interest} if interest else {}),
        **({"fear": fear} if fear else {})
    })

AIScaleClient.add_growth_record = lambda self, device_id, age_months, weight=None, height=None, head_circumference=None: \
    self.call_tool("growth", "add_growth_record", {
        "deviceId": device_id,
        "ageMonths": age_months,
        **({"weight": weight} if weight else {}),
        **({"height": height} if height else {}),
        **({"headCircumference": head_circumference} if head_circumference else {})
    })

AIScaleClient.get_growth_history = lambda self, device_id, limit=10: \
    self.call_tool("growth", "get_growth_history", {
        "deviceId": device_id,
        "limit": limit
    })

AIScaleClient.evaluate_growth = lambda self, device_id: \
    self.call_tool("growth", "evaluate_growth", {
        "deviceId": device_id
    })


if __name__ == "__main__":
    print("🤖 AI量表系统 - 智能体接入测试")
    print("="*50)
    
    try:
        test_memory_skill()
        test_growth_skill()
        
        print("\n" + "="*50)
        print("✅ 所有测试完成！")
        print("="*50)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
