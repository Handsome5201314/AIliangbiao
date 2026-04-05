import React from 'react';
import type { AvatarState } from '@/contexts/ProfileContext';

interface AvatarProps {
  state: AvatarState;
  gender: 'boy' | 'girl';
  className?: string;
}

export default function Avatar({ state, gender, className = "w-24 h-24" }: AvatarProps) {
  const { mood, clothing, headwear } = state;

  // 颜色定义 (国风色系)
  const colors = {
    skin: '#FFE4E1',      // 粉白肤色
    hair: '#2C3E50',      // 黛黑
    tangSuit: '#E74C3C',  // 朱砂红 (唐装)
    tangTrim: '#F1C40F',  // 明黄 (唐装镶边)
    hanfu: '#3498DB',     // 靛蓝 (汉服)
    hanfuTrim: '#ECF0F1', // 月白 (汉服镶边)
    tigerHat: '#E67E22',  // 橘黄 (虎头帽)
  };

  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* 1. 背景光晕 (可选，增加科技/仙气感) */}
      <circle cx="50" cy="50" r="48" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
      
      {/* 2. 身体与服装 */}
      <g transform="translate(0, 10)">
        {clothing === 'tang_suit' ? (
          // 唐装 (红色为主，黄色盘扣)
          <g>
            <path d="M25 80 Q50 45 75 80 L80 100 L20 100 Z" fill={colors.tangSuit} />
            <path d="M40 60 L60 60" stroke={colors.tangTrim} strokeWidth="2" strokeLinecap="round" />
            <path d="M45 70 L55 70" stroke={colors.tangTrim} strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : (
          // 汉服 (蓝色交领右衽)
          <g>
            <path d="M25 80 Q50 45 75 80 L80 100 L20 100 Z" fill={colors.hanfu} />
            <path d="M30 65 L70 90" stroke={colors.hanfuTrim} strokeWidth="4" />
            <path d="M70 65 L45 80" stroke={colors.hanfuTrim} strokeWidth="4" />
          </g>
        )}
      </g>

      {/* 3. 头部与肤色 */}
      <circle cx="50" cy="45" r="22" fill={colors.skin} />
      
      {/* 4. 发型 (根据性别) */}
      {gender === 'boy' ? (
        // 男孩短发
        <path d="M 28 40 Q 50 15 72 40 Q 50 25 28 40 Z" fill={colors.hair} />
      ) : (
        // 女孩双丫髻
        <g>
          <path d="M 28 40 Q 50 15 72 40 Q 50 25 28 40 Z" fill={colors.hair} />
          <circle cx="30" cy="25" r="8" fill={colors.hair} />
          <circle cx="70" cy="25" r="8" fill={colors.hair} />
        </g>
      )}

      {/* 5. 动态表情 (Mood) */}
      <g>
        {mood === 'happy' && (
          <>
            {/* 弯弯的笑眼 */}
            <path d="M 38 42 Q 42 38 46 42" stroke="#4A5568" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 54 42 Q 58 38 62 42" stroke="#4A5568" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* 开心大笑嘴 */}
            <path d="M 45 52 Q 50 58 55 52 Z" fill="#E74C3C" />
            {/* 脸颊红晕 */}
            <circle cx="35" cy="48" r="4" fill="#FFB6C1" opacity="0.6" />
            <circle cx="65" cy="48" r="4" fill="#FFB6C1" opacity="0.6" />
          </>
        )}
        
        {mood === 'nervous' && (
          <>
            {/* 担忧的眼睛 */}
            <circle cx="42" cy="42" r="2.5" fill="#4A5568" />
            <circle cx="58" cy="42" r="2.5" fill="#4A5568" />
            {/* 倒八字眉 */}
            <path d="M 38 38 L 44 36" stroke="#4A5568" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 62 38 L 56 36" stroke="#4A5568" strokeWidth="1.5" strokeLinecap="round" />
            {/* 紧张抿嘴 */}
            <path d="M 46 54 Q 50 52 54 54" stroke="#4A5568" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* 汗滴 */}
            <path d="M 70 35 Q 72 40 70 42 Q 68 40 70 35 Z" fill="#85C1E9" />
          </>
        )}

        {mood === 'curious' && (
          <>
            {/* 睁大的圆眼 */}
            <circle cx="42" cy="42" r="3.5" fill="#4A5568" />
            <circle cx="58" cy="42" r="3.5" fill="#4A5568" />
            {/* 挑高的眉毛 */}
            <path d="M 38 35 Q 42 33 46 35" stroke="#4A5568" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 54 35 Q 58 33 62 35" stroke="#4A5568" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            {/* "O"型嘴 */}
            <circle cx="50" cy="54" r="3" fill="#E74C3C" />
          </>
        )}

        {mood === 'normal' && (
          <>
            {/* 正常眼睛 */}
            <circle cx="42" cy="42" r="2.5" fill="#4A5568" />
            <circle cx="58" cy="42" r="2.5" fill="#4A5568" />
            {/* 淡淡微笑 */}
            <path d="M 46 52 Q 50 55 54 52" stroke="#4A5568" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        )}
      </g>

      {/* 6. 特殊头饰 */}
      {headwear === 'hu_tou_mao' && (
        <g transform="translate(0, -5)">
          {/* 虎头帽主体 */}
          <path d="M 26 40 Q 50 5 74 40 Q 50 15 26 40 Z" fill={colors.tigerHat} />
          {/* 老虎耳朵 */}
          <circle cx="32" cy="22" r="6" fill={colors.tangTrim} />
          <circle cx="68" cy="22" r="6" fill={colors.tangTrim} />
          {/* "王"字印记 */}
          <path d="M 46 22 L 54 22 M 46 25 L 54 25 M 44 28 L 56 28 M 50 20 L 50 28" stroke="#D35400" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {headwear === 'flower' && (
        <g transform="translate(65, 25)">
          {/* 小红花头饰 */}
          <circle cx="0" cy="-5" r="3" fill="#E74C3C" />
          <circle cx="5" cy="0" r="3" fill="#E74C3C" />
          <circle cx="-5" cy="0" r="3" fill="#E74C3C" />
          <circle cx="0" cy="5" r="3" fill="#E74C3C" />
          <circle cx="0" cy="0" r="2" fill="#F1C40F" />
        </g>
      )}
    </svg>
  );
}
