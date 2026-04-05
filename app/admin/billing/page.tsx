'use client';

import { useState } from 'react';
import { CreditCard, TrendingUp, DollarSign, Calendar, Download, Filter } from 'lucide-react';

export default function BillingPage() {
  const [timeRange, setTimeRange] = useState('7d');

  const billingData = [
    { date: '2024-03-01', calls: 234, cost: 2.34, provider: 'siliconflow' },
    { date: '2024-03-02', calls: 189, cost: 1.89, provider: 'siliconflow' },
    { date: '2024-03-03', calls: 312, cost: 3.12, provider: 'siliconflow' },
    { date: '2024-03-04', calls: 156, cost: 1.56, provider: 'sophon' },
    { date: '2024-03-05', calls: 287, cost: 2.87, provider: 'siliconflow' },
    { date: '2024-03-06', calls: 203, cost: 2.03, provider: 'sophon' },
    { date: '2024-03-07', calls: 245, cost: 2.45, provider: 'siliconflow' },
  ];

  const totalCost = billingData.reduce((acc, item) => acc + item.cost, 0);
  const totalCalls = billingData.reduce((acc, item) => acc + item.calls, 0);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">大模型与计费</h2>
        <p className="text-sm text-slate-500 mt-1">查看 API 调用量和费用明细</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">¥{totalCost.toFixed(2)}</p>
              <p className="text-sm text-slate-500">本周消费</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalCalls}</p>
              <p className="text-sm text-slate-500">总调用次数</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">¥0.01</p>
              <p className="text-sm text-slate-500">平均单价</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">2</p>
              <p className="text-sm text-slate-500">活跃服务商</p>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === '7d' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              近7天
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === '30d' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              近30天
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === '90d' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              近90天
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            <span>导出报表</span>
          </button>
        </div>
      </div>

      {/* 费用明细表 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">日期</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">服务商</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">调用次数</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">费用 (¥)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {billingData.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-900">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {item.date}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.provider === 'siliconflow' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {item.provider === 'siliconflow' ? '硅基流动' : '算能'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-900">{item.calls}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-slate-900">¥{item.cost.toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
