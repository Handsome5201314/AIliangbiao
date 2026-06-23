interface AvatarProps {
  nickname?: string;
  className?: string;
}

/**
 * 首字母头像组件 - 零图片依赖，自动跟随主题色。
 * 取 nickname 首字居中显示，圆形背景使用 primary/15。
 */
export default function Avatar({ nickname, className = 'w-24 h-24' }: AvatarProps) {
  const initial = nickname?.charAt(0) || '?';
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-primary/15 ${className}`}
      aria-label={`头像: ${nickname || '用户'}`}
    >
      <span className="select-none font-bold text-primary" style={{ fontSize: '40%' }}>
        {initial}
      </span>
    </div>
  );
}
