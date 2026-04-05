# 🎯 量表服务 MCP 接入指南

## 📋 概述

本系统提供**量表评估服务 MCP 接口**，支持外部智能体通过标准化API调用平台上的所有量表。

---

## 🚀 快速开始

### 三步接入

1. **获取API密钥** → 登录管理后台创建密钥
2. **配置智能体** → 在智能体平台配置HTTP插件
3. **调用接口** → 使用MCP协议调用量表服务

---

## 📡 接口信息

### 基础配置

| 项目 | 信息 |
|------|------|
| 端点地址 | `http://your-domain.com/api/mcp/scale` |
| 协议标准 | MCP JSON-RPC 2.0 |
| 认证方式 | Bearer Token (API Key) |
| 响应格式 | JSON |

### 认证方式

```http
Authorization: Bearer sk-your-api-key-here
```

---

## 🛠️ 可用工具

### 1. `list_scales` - 获取量表列表

获取平台所有可用量表信息。

**请求示例：**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "list_scales",
    "arguments": {}
  }
}
```

**响应示例：**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"success\":true,\"totalCount\":4,\"scales\":[{\"id\":\"SRS\",\"title\":\"社交反应量表\",\"description\":\"...\",\"questionCount\":65,\"estimatedTime\":\"15分钟\"},{\"id\":\"ABC\",\"title\":\"孤独症行为评定量表\",\"description\":\"...\",\"questionCount\":57,\"estimatedTime\":\"12分钟\"}]}"
    }]
  }
}
```

---

### 2. `get_scale_questions` - 获取量表问题

获取指定量表的详细问题列表。

**请求示例：**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/call",
  "params": {
    "name": "get_scale_questions",
    "arguments": {
      "scaleId": "ABC"
    }
  }
}
```

**响应示例：**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"scaleId\":\"ABC\",\"scaleTitle\":\"孤独症行为评定量表\",\"questionCount\":57,\"questions\":[{\"index\":1,\"question\":\"...\",\"options\":[\"从不\",\"偶尔\",\"经常\",\"总是\"]},{\"index\":2,\"question\":\"...\",\"options\":[\"从不\",\"偶尔\",\"经常\",\"总是\"]}]}"
    }]
  }
}
```

---

### 3. `submit_assessment` - 提交评估答案

提交用户的答案并获取评估结果。

**请求示例：**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/call",
  "params": {
    "name": "submit_assessment",
    "arguments": {
      "deviceId": "user-device-123",
      "scaleId": "ABC",
      "answers": [0, 1, 2, 1, 0, 2, 1, 3, 0, 1]
    }
  }
}
```

**响应示例：**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"success\":true,\"assessmentId\":\"abc123\",\"scaleId\":\"ABC\",\"totalScore\":15,\"conclusion\":\"风险较低，建议持续观察\",\"evaluatedAt\":\"2024-01-15T10:30:00Z\",\"message\":\"评估已完成并保存\"}"
    }]
  }
}
```

**答案格式说明：**
- `answers` 是一个数字数组
- 每个数字代表该题的选项索引（0-3）
- 顺序与问题列表一致

---

## 💻 接入示例

### Python 示例

```python
import requests
import json

class ScaleServiceClient:
    def __init__(self, endpoint, api_key):
        self.endpoint = endpoint
        self.api_key = api_key
        self.request_id = 0
    
    def call_tool(self, tool_name, arguments):
        self.request_id += 1
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        
        payload = {
            'jsonrpc': '2.0',
            'id': str(self.request_id),
            'method': 'tools/call',
            'params': {
                'name': tool_name,
                'arguments': arguments
            }
        }
        
        response = requests.post(self.endpoint, json=payload, headers=headers)
        result = response.json()
        
        if 'result' in result:
            return json.loads(result['result']['content'][0]['text'])
        else:
            raise Exception(result.get('error', {}).get('message', 'Unknown error'))
    
    def list_scales(self):
        return self.call_tool('list_scales', {})
    
    def get_questions(self, scale_id):
        return self.call_tool('get_scale_questions', {'scaleId': scale_id})
    
    def submit_assessment(self, device_id, scale_id, answers):
        return self.call_tool('submit_assessment', {
            'deviceId': device_id,
            'scaleId': scale_id,
            'answers': answers
        })

# 使用示例
client = ScaleServiceClient(
    endpoint='http://your-domain.com/api/mcp/scale',
    api_key='sk-your-api-key'
)

# 1. 获取量表列表
scales = client.list_scales()
print(f"可用量表：{scales['totalCount']}个")

# 2. 获取ABC量表问题
questions = client.get_questions('ABC')
print(f"ABC量表题目：{questions['questionCount']}题")

# 3. 提交评估
result = client.submit_assessment(
    device_id='user-123',
    scale_id='ABC',
    answers=[0, 1, 2, 1, 0, 2, 1, 3, 0, 1]  # 用户答案
)
print(f"评估结果：{result['conclusion']}")
```

---

### JavaScript 示例

```javascript
class ScaleServiceClient {
  constructor(endpoint, apiKey) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.requestId = 0;
  }

  async callTool(toolName, arguments) {
    this.requestId++;
    
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: String(this.requestId),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: arguments
        }
      })
    });

    const result = await response.json();
    
    if (result.result) {
      return JSON.parse(result.result.content[0].text);
    } else {
      throw new Error(result.error?.message || 'Unknown error');
    }
  }

  async listScales() {
    return this.callTool('list_scales', {});
  }

  async getQuestions(scaleId) {
    return this.callTool('get_scale_questions', { scaleId });
  }

  async submitAssessment(deviceId, scaleId, answers) {
    return this.callTool('submit_assessment', {
      deviceId,
      scaleId,
      answers
    });
  }
}

// 使用示例
const client = new ScaleServiceClient(
  'http://your-domain.com/api/mcp/scale',
  'sk-your-api-key'
);

// 获取量表列表
const scales = await client.listScales();
console.log(`可用量表：${scales.totalCount}个`);

// 提交评估
const result = await client.submitAssessment(
  'user-123',
  'ABC',
  [0, 1, 2, 1, 0, 2, 1, 3, 0, 1]
);
console.log(`评估结果：${result.conclusion}`);
```

---

### curl 测试

```bash
# 1. 获取量表列表
curl -X POST http://localhost:3000/api/mcp/scale \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "list_scales",
      "arguments": {}
    }
  }'

# 2. 获取量表问题
curl -X POST http://localhost:3000/api/mcp/scale \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/call",
    "params": {
      "name": "get_scale_questions",
      "arguments": {
        "scaleId": "ABC"
      }
    }
  }'

# 3. 提交评估
curl -X POST http://localhost:3000/api/mcp/scale \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "tools/call",
    "params": {
      "name": "submit_assessment",
      "arguments": {
        "deviceId": "user-123",
        "scaleId": "ABC",
        "answers": [0, 1, 2, 1, 0, 2, 1, 3, 0, 1]
      }
    }
  }'
```

---

## 🎯 典型应用场景

### 场景1：智能健康助手

```
用户：我想评估一下孩子是否有自闭症倾向
Agent：
  1. 调用 list_scales 获取可用量表
  2. 推荐 ABC 量表
  3. 调用 get_scale_questions 获取问题
  4. 逐题询问用户
  5. 收集完答案后调用 submit_assessment
  6. 返回评估结果和建议
```

### 场景2：批量评估系统

```
系统：
  1. 获取用户历史数据
  2. 批量调用 submit_assessment
  3. 生成评估报告
  4. 发送给医疗机构
```

### 场景3：远程医疗平台

```
医生：
  1. 选择合适的量表
  2. 患者通过智能体回答
  3. 自动生成评估结果
  4. 医生查看并诊断
```

---

## 📊 支持的量表

| 量表ID | 名称 | 题目数 | 用途 |
|--------|------|--------|------|
| SRS | 社交反应量表 | 65题 | 社交能力评估 |
| ABC | 孤独症行为评定量表 | 57题 | 自闭症筛查 |
| CARS | 卡氏儿童孤独症评定量表 | 15题 | 自闭症诊断 |
| SNAP-IV | 注意力量表 | 18题 | 多动症评估 |

---

## ⚠️ 注意事项

### 1. API密钥安全
- ✅ 妥善保管API密钥，不要泄露
- ✅ 定期更换密钥
- ❌ 不要在客户端代码中暴露密钥
- ❌ 不要提交到代码仓库

### 2. 频率限制
- 建议调用间隔：≥ 1秒
- 单次请求超时：30秒
- 每日调用上限：根据套餐配置

### 3. 数据隐私
- 用户数据严格保密
- 评估结果仅用于医疗参考
- 遵守《个人信息保护法》

---

## 🔧 错误处理

### 常见错误码

| 错误码 | 说明 | 解决方法 |
|--------|------|----------|
| -32600 | Invalid Request | 检查请求格式 |
| -32601 | Method not found | 检查方法名 |
| -32602 | Invalid params | 检查参数 |
| -32603 | Internal error | 联系技术支持 |
| 401 | Unauthorized | 检查API密钥 |

### 错误处理示例

```python
try:
    result = client.submit_assessment(...)
except Exception as e:
    print(f"评估失败: {e}")
    # 优雅降级或重试
```

---

## 📞 技术支持

- **完整文档**：查看 `AGENT_INTEGRATION_GUIDE.md`
- **API文档**：查看 `/api/mcp/scale` (GET请求)
- **管理后台**：`http://your-domain.com/admin/mcpkeys`

---

## 🚀 开始使用

### 步骤1：获取API密钥
```
1. 访问管理后台
2. 登录：admin / admin123
3. 进入"量表API密钥"页面
4. 点击"创建密钥"
5. 复制密钥并妥善保管
```

### 步骤2：测试接口
```bash
curl -X POST http://localhost:3000/api/mcp/scale \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```

### 步骤3：集成到智能体
- FastGPT：添加HTTP插件
- Coze：添加自定义工具
- 自定义：使用Python/JS SDK

---

**🎉 现在您的智能体可以调用量表服务了！**
