import React from 'react';
import type { AvatarState } from '@/contexts/ProfileContext';

interface AvatarProps {
  state: AvatarState;
  gender: 'boy' | 'girl';
  className?: string;
}

export default function Avatar({ state, gender, className = "w-24 h-24" }: AvatarProps) {
  const { mood, clothing, headwear } = state;

  const colors = {
    skin: '#FFE4D6',
    blush: '#FFB7B2',
    hair: '#2D3748',
    eye: '#1A202C',
    tangSuit: '#F05252',
    tangTrim: '#FBD38D',
    hanfu: '#63B3ED',
    hanfuTrim: '#F7FAFC',
    tigerHat: '#ED8936',
    tigerStripe: '#C05621',
  };

  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="eyeHighlight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.2" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="48" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5" />

      <g transform="translate(0, 8)">
        {clothing === 'tang_suit' ? (
          <g>
            <path d="M 15 92 Q 25 72 50 72 Q 75 72 85 92 L 85 100 L 15 100 Z" fill={colors.tangSuit} />
            <path d="M 50 72 L 50 100" stroke={colors.tangTrim} strokeWidth="2.5" />
            <circle cx="50" cy="80" r="2" fill={colors.tangTrim} />
            <circle cx="50" cy="90" r="2" fill={colors.tangTrim} />
            <path d="M 35 72 Q 50 82 65 72" stroke={colors.tangTrim} strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <path d="M 12 92 Q 25 72 50 72 Q 75 72 88 92 L 88 100 L 12 100 Z" fill={colors.hanfu} />
            <path d="M 30 72 L 65 95" stroke={colors.hanfuTrim} strokeWidth="4" strokeLinecap="round" />
            <path d="M 70 72 L 45 88" stroke={colors.hanfuTrim} strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
      </g>

      <rect x="42" y="65" width="16" height="12" rx="4" fill="#F5CBB5" />

      <circle cx="25" cy="54" r="5" fill={colors.skin} />
      <circle cx="75" cy="54" r="5" fill={colors.skin} />

      <rect x="25" y="32" width="50" height="42" rx="22" fill={colors.skin} />

      <ellipse cx="34" cy="58" rx="4.5" ry="3" fill={colors.blush} opacity="0.6" />
      <ellipse cx="66" cy="58" rx="4.5" ry="3" fill={colors.blush} opacity="0.6" />

      {gender === 'girl' ? (
        <g>
          <circle cx="22" cy="32" r="11" fill={colors.hair} />
          <circle cx="78" cy="32" r="11" fill={colors.hair} />
          <path d="M 18 36 Q 22 42 26 36" stroke={colors.tangSuit} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 74 36 Q 78 42 82 36" stroke={colors.tangSuit} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 26 40 C 26 25 74 25 74 40 C 74 40 60 32 50 32 C 40 32 26 40 26 40 Z" fill={colors.hair} />
        </g>
      ) : (
        <g>
          <path d="M 26 42 C 26 20 74 20 74 42 C 74 42 65 30 50 30 C 35 30 26 42 26 42 Z" fill={colors.hair} />
          <path d="M 45 26 Q 50 20 52 26" stroke={colors.hair} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )}

      <g>
        {mood === 'happy' && (
          <>
            <path d="M 34 50 Q 38 44 42 50" stroke={colors.eye} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 58 50 Q 62 44 66 50" stroke={colors.eye} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 46 60 Q 50 68 54 60 Z" fill="#F56565" />
            <ellipse cx="34" cy="56" rx="5" ry="3.5" fill={colors.blush} opacity="0.8" />
            <ellipse cx="66" cy="56" rx="5" ry="3.5" fill={colors.blush} opacity="0.8" />
          </>
        )}

        {mood === 'nervous' && (
          <>
            <circle cx="38" cy="50" r="4.5" fill={colors.eye} />
            <circle cx="62" cy="50" r="4.5" fill={colors.eye} />
            <circle cx="39" cy="48" r="1.5" fill="#FFF" />
            <circle cx="63" cy="48" r="1.5" fill="#FFF" />
            <path d="M 34 44 L 42 42" stroke={colors.eye} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <path d="M 66 44 L 58 42" stroke={colors.eye} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <path d="M 46 62 Q 48 60 50 62 T 54 62" stroke={colors.eye} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 72 38 Q 75 44 72 46 Q 69 44 72 38 Z" fill="#90CDF4" opacity="0.8" />
          </>
        )}

        {mood === 'curious' && (
          <>
            <circle cx="38" cy="50" r="5" fill={colors.eye} />
            <circle cx="62" cy="50" r="5" fill={colors.eye} />
            <circle cx="39.5" cy="48.5" r="2" fill="url(#eyeHighlight)" />
            <circle cx="63.5" cy="48.5" r="2" fill="url(#eyeHighlight)" />
            <path d="M 34 42 Q 38 38 42 42" stroke={colors.eye} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 58 42 Q 62 38 66 42" stroke={colors.eye} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <circle cx="50" cy="62" r="2.5" fill="#F56565" />
          </>
        )}

        {mood === 'normal' && (
          <>
            <circle cx="38" cy="50" r="4.5" fill={colors.eye} />
            <circle cx="62" cy="50" r="4.5" fill={colors.eye} />
            <circle cx="39.5" cy="48" r="1.8" fill="#FFF" />
            <circle cx="63.5" cy="48" r="1.8" fill="#FFF" />
            <path d="M 47 61 Q 50 64 53 61" stroke="#F56565" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
          </>
        )}
      </g>

      {headwear === 'hu_tou_mao' && (
        <g transform="translate(0, -2)">
          <path d="M 20 52 C 15 15 85 15 80 52 C 80 55 65 30 50 30 C 35 30 20 55 20 52 Z" fill={colors.tigerHat} />
          <circle cx="28" cy="22" r="8" fill={colors.tigerHat} />
          <circle cx="28" cy="22" r="4" fill="#FFF" opacity="0.8" />
          <circle cx="72" cy="22" r="8" fill={colors.tigerHat} />
          <circle cx="72" cy="22" r="4" fill="#FFF" opacity="0.8" />
          <path d="M 45 22 L 55 22 M 46 26 L 54 26 M 44 30 L 56 30 M 50 22 L 50 30" stroke={colors.tigerStripe} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {headwear === 'flower' && (
        <g transform="translate(68, 28) scale(1.2)">
          <circle cx="0" cy="-4" r="3" fill="#F56565" />
          <circle cx="4" cy="0" r="3" fill="#F56565" />
          <circle cx="-4" cy="0" r="3" fill="#F56565" />
          <circle cx="0" cy="4" r="3" fill="#F56565" />
          <circle cx="0" cy="0" r="2.5" fill={colors.tangTrim} />
        </g>
      )}
    </svg>
  );
}
