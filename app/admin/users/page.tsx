'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, MoreVertical, User, Mail, Calendar, Activity } from 'lucide-react';

interface UserProfile {
  id: string;
  deviceId: string;
  isGuest: boolean;
  phone?: string;
  createdAt: string;
  profile?: {
    nickname: string;
    gender: string;
    ageMonths: number;
    interests: string[];
  };
  stats: {
    assessments: number;
    lastActive: string;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      setUsers([
        {
          id: '1',
          deviceId: 'abc123...',
          isGuest: true,
          createdAt: '2024-01-15',
          profile: {
            nickname: '明明',
            gender: 'boy',
            ageMonths: 36,
            interests: ['恐龙', '汽车']
          },
          stats: {
            assessments: 5,
            lastActive: '2小时前'
          }
        },
        {
          id: '2',
          deviceId: 'def456...',
          isGuest: true,
          createdAt: '2024-02-20',
          profile: {
            nickname: '小红',
            gender: 'girl',
            ageMonths: 48,
            interests: ['画画', '唱歌']
          },
          stats: {
            assessments: 3,
            lastActive: '1天前'
          }
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const filteredUsers = users.filter(user => 
    user.profile?.nickname.includes(searchQuery) ||
    user.deviceId.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">用户与画像管理</h2>
        <p className="text-sm text-slate-500 mt-1">查看和管理系统用户及其画像信息</p>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索用户昵称或设备ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>筛选</span>
          </button>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">用户信息</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">设备ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">类型</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">评估次数</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">最后活跃</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">注册时间</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    暂无用户数据
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold">
                          {user.profile?.nickname?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.profile?.nickname || '未命名'}</p>
                          <p className="text-xs text-slate-500">
                            {user.profile?.gender === 'boy' ? '男' : '女'} · {user.profile?.ageMonths}个月
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">{user.deviceId}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isGuest 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {user.isGuest ? '游客' : '注册用户'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{user.stats.assessments}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{user.stats.lastActive}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4" />
                        <span>{user.createdAt}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{users.length}</p>
              <p className="text-sm text-slate-500">总用户数</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <Activity className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{users.reduce((acc, u) => acc + u.stats.assessments, 0)}</p>
              <p className="text-sm text-slate-500">总评估次数</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">23</p>
              <p className="text-sm text-slate-500">今日新增</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
