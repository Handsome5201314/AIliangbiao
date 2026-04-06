'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import Avatar from './Avatar';
import { Sparkles, User, Calendar, ArrowRight, Check } from 'lucide-react';

export default function ProfileSetupModal() {
  const { profile, updateProfile, updateAvatar } = useProfile();
  
  // 如果名字不是默认的"宝宝"，说明已经建档过了，直接隐藏
  const [isVisible, setIsVisible] = useState(false);

  // 临时表单状态
  const [formData, setFormData] = useState({
    nickname: '',
    gender: 'boy' as 'boy' | 'girl',
    ageMonths: 36
  });

  useEffect(() => {
    // 延迟显示，带有淡入动画
    if (profile.nickname === '宝宝') {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [profile.nickname]);

  if (!isVisible) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.nickname.trim()) return;

    // 1. 保存基础画像
    updateProfile({
      nickname: formData.nickname,
      gender: formData.gender,
      ageMonths: formData.ageMonths,
    });

    // 2. 根据性别初始化一个可爱的国风头像状态
    updateAvatar({
      clothing: formData.gender === 'boy' ? 'tang_suit' : 'hanfu_blue',
      mood: 'happy',
      headwear: 'none'
    });

    // 3. 关闭弹窗
    setIsVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 模糊背景 */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
      
      {/* 弹窗主体 */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* 顶部装饰背景 */}
        <div className="h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-rose-400 relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          {/* 实时预览的国风小人 (绝对定位突破边界) */}
          <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded-full shadow-lg border-4 border-white">
            <Avatar 
              gender={formData.gender} 
              state={{ 
                baseModel: 'default', 
                clothing: formData.gender === 'boy' ? 'tang_suit' : 'hanfu_blue', 
                headwear: 'none', 
                mood: 'happy' 
              }} 
              className="w-20 h-20"
            />
          </div>
        </div>

        {/* 表单区域 */}
        <div className="px-8 pt-16 pb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-slate-800 flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              定制专属小守护者
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              告诉我们宝宝的基本信息，系统将为TA生成专属的陪伴伙伴。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 昵称 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">宝宝小名 / 昵称</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="例如：明明、果果"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {/* 性别选择 (会实时联动上面头像的变化) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">性别</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'boy' })}
                  className={`py-3 px-4 rounded-xl border-2 font-medium flex items-center justify-center gap-2 transition-all ${
                    formData.gender === 'boy' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  👦 男孩
                  {formData.gender === 'boy' && <Check className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'girl' })}
                  className={`py-3 px-4 rounded-xl border-2 font-medium flex items-center justify-center gap-2 transition-all ${
                    formData.gender === 'girl' 
                      ? 'border-rose-400 bg-rose-50 text-rose-600' 
                      : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  👧 女孩
                  {formData.gender === 'girl' && <Check className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 月龄 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">宝宝月龄 (选填)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  max="216"
                  placeholder="例如：36 (代表3岁)"
                  value={formData.ageMonths || ''}
                  onChange={(e) => setFormData({ ...formData, ageMonths: parseInt(e.target.value) || 0 })}
                  className="block w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-medium text-sm">个月</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!formData.nickname.trim()}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3.5 px-4 rounded-xl hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
            >
              生成专属守护者
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
