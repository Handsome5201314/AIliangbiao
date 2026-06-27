import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  Search,
} from 'lucide-react';
import { Button } from '@/components/mobile-h5/components/ui/button';
import { cn } from '@/components/mobile-h5/lib/utils';
import type { Scale, ScaleCategory } from '@/components/mobile-h5/types';

interface ScalesScreenProps {
  scales: Scale[];
  onSelectScale: (scale: Scale) => void;
  onBack: () => void;
}

const tabs: { key: ScaleCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部儿童' },
  { key: 'autism', label: '孤独症相关' },
  { key: 'attention_behavior', label: '注意力行为' },
  { key: 'development', label: '发育适应' },
];

const ScalesScreen: React.FC<ScalesScreenProps> = ({
  scales,
  onSelectScale,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<ScaleCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredScales = useMemo(() => {
    let result = scales;
    if (activeTab !== 'all') {
      result = result.filter((s) => s.category === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.shortName.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [scales, activeTab, searchQuery]);

  return (
    <section data-component="scales-screen" className="px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="w-11 h-11 rounded-full -ml-2 min-h-touch"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">选择量表</h1>
      </div>

      {/* Search bar */}
      <div className="mt-4 bg-cream-100 rounded-button px-4 py-2.5 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索量表名称或标签"
          className="flex-1 bg-transparent outline-none text-base text-foreground placeholder:text-muted"
        />
      </div>

      {/* Tab row */}
      <div className="mt-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab) => (
          <Button
            variant="ghost"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'rounded-pill px-4 py-1.5 text-sm whitespace-nowrap min-h-[36px] flex-shrink-0',
              activeTab === tab.key
                ? 'bg-sage-400 text-white font-medium'
                : 'bg-cream-100 text-foreground'
            )}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Scale cards */}
      <div className="mt-4 flex flex-col gap-3">
        {filteredScales.length > 0 ? (
          <>
            {filteredScales.map((scale) => (
              <ScaleCard
                key={scale.id}
                scale={scale}
                onStart={() => onSelectScale(scale)}
              />
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <Search className="w-10 h-10 text-cream-300 mb-3" />
            <p className="text-sm text-muted">未找到匹配的量表</p>
          </div>
        )}
      </div>
    </section>
  );
};

/* ===== ScaleCard sub-component ===== */
interface ScaleCardProps {
  scale: Scale;
  onStart: () => void;
}

const ScaleCard: React.FC<ScaleCardProps> = ({ scale, onStart }) => (
  <div className="bg-white rounded-card p-4">
    {/* Title row */}
    <div className="flex items-center gap-2">
      <span className="text-base font-medium text-foreground flex-1 truncate">
        {scale.name}
      </span>
      <span className="bg-sage-50 text-sage-600 text-xs px-2 py-0.5 rounded-pill flex-shrink-0">
        {scale.shortName}
      </span>
    </div>

    {/* Meta row */}
    <div className="flex gap-3 mt-2 text-xs text-muted">
      <span>{scale.ageRange}</span>
      <span>{scale.duration}</span>
      <span>{scale.questionCount}题</span>
    </div>

    {/* Tags row */}
    {scale.tags.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {scale.tags.map((tag) => (
          <span
            key={tag}
            className="bg-cream-100 text-muted text-xs px-2 py-0.5 rounded-pill"
          >
            {tag}
          </span>
        ))}
      </div>
    )}

    {/* Description */}
    <p className="text-sm text-muted mt-2 line-clamp-2">{scale.description}</p>

    {/* Start button */}
    <div className="flex justify-end mt-3">
      <Button
        onClick={onStart}
        className="bg-sage-400 text-white text-sm font-medium px-5 py-2 rounded-button min-h-touch"
      >
        开始测评
      </Button>
    </div>
  </div>
);

export default ScalesScreen;
