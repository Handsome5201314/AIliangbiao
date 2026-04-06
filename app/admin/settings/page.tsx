'use client';

import { useState, useEffect } from 'react';
import { Save, Key, Globe, Shield, Bell, Database, Trash2, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    siteName: 'AI 临床辅助评估系统',
    siteDescription: '基于 MCP 协议的 AI 驱动临床量表评估系统',
    defaultDailyLimit: '1',
    enableGuestMode: true,
    enableAPIKeyManagement: true,
    requireLogin: false,
    enableNotifications: true,
    enableDataExport: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingQuota, setIsUpdatingQuota] = useState(false);

  // 加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            siteName: data.settings.siteName || prev.siteName,
            siteDescription: data.settings.siteDescription || prev.siteDescription,
            defaultDailyLimit: data.settings.defaultDailyLimit || prev.defaultDailyLimit,
            enableGuestMode: data.settings.enableGuestMode === 'true',
            enableAPIKeyManagement: data.settings.enableAPIKeyManagement === 'true',
            requireLogin: data.settings.requireLogin === 'true',
            enableNotifications: data.settings.enableNotifications === 'true',
            enableDataExport: data.settings.enableDataExport === 'true'
          }));
        }
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        alert('设置已保存成功！');
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 批量更新游客配额
  const handleUpdateQuota = async () => {
    const newLimit = parseInt(settings.defaultDailyLimit);
    
    if (isNaN(newLimit) || newLimit < 0) {
      alert('请输入有效的配额值');
      return;
    }

    if (!confirm(`确认将所有游客的配额更新为 ${newLimit} 次？\n\n注意：这将同时保存系统设置。`)) {
      return;
    }

    setIsUpdatingQuota(true);
    try {
      const response = await fetch('/api/admin/settings/update-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: newLimit })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        // 重新加载设置以确保同步
        await loadSettings();
      } else {
        throw new Error('更新失败');
      }
    } catch (error) {
      console.error('更新配额失败:', error);
      alert('更新失败，请重试');
    } finally {
      setIsUpdatingQuota(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">系统设置</h2>
        <p className="text-sm text-slate-500 mt-1">管理系统全局配置和参数</p>
      </div>

      {/* 基本设置 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-slate-600" />
          基本设置
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">站点名称</label>
            <input
              type="text"
              value={settings.siteName}
              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">站点描述</label>
            <textarea
              value={settings.siteDescription}
              onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 额度管理 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-600" />
          额度管理
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">游客每日限额</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={settings.defaultDailyLimit}
                onChange={(e) => setSettings({ ...settings, defaultDailyLimit: e.target.value })}
                className="w-32 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleUpdateQuota}
                disabled={isUpdatingQuota}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUpdatingQuota ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '立即应用到所有游客'
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              💡 点击"立即应用"会同时保存设置并更新所有游客账户的配额
            </p>
          </div>
        </div>
      </div>

      {/* 功能开关 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-slate-600" />
          功能开关
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">游客模式</p>
              <p className="text-sm text-slate-500">允许用户无需注册即可使用</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableGuestMode}
                onChange={(e) => setSettings({ ...settings, enableGuestMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">API Key 管理</p>
              <p className="text-sm text-slate-500">允许用户配置自己的 API 密钥</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableAPIKeyManagement}
                onChange={(e) => setSettings({ ...settings, enableAPIKeyManagement: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">要求登录</p>
              <p className="text-sm text-slate-500">用户必须登录后才能使用系统</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireLogin}
                onChange={(e) => setSettings({ ...settings, requireLogin: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 数据管理 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-slate-600" />
          数据管理
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">数据导出</p>
              <p className="text-sm text-slate-500">允许用户导出评估历史数据</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableDataExport}
                onChange={(e) => setSettings({ ...settings, enableDataExport: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <div className="pt-4 border-t border-slate-200">
            <button className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
              <Trash2 className="w-4 h-4" />
              <span>清空所有数据</span>
            </button>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>保存中...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>保存设置</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
