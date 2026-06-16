import React from 'react'
import { ClipboardList, ChevronRight } from 'lucide-react'

function groupByMonth(records) {
  const groups = {}
  records.forEach(r => {
    const date = new Date(r.completedAt)
    const key = `${date.getFullYear()}年${date.getMonth() + 1}月`
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function HistoryScreen({ history, onViewReport }) {
  const grouped = groupByMonth(history)

  return (
    <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
      <h1 className="text-xl font-semibold text-foreground mb-4">测评记录</h1>

      {history.length === 0 ? (
        <div className="bg-white rounded-card p-8 border border-cream-200 text-center mt-8">
          <ClipboardList className="w-12 h-12 text-cream-400 mx-auto mb-3" />
          <p className="text-base font-medium text-foreground mb-1">暂无测评记录</p>
          <p className="text-sm text-muted mb-4">完成第一次测评后，记录将显示在这里</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([month, records]) => (
            <div key={month}>
              <h3 className="text-sm font-medium text-muted mb-2">{month}</h3>
              <div className="space-y-2">
                {records.map(record => (
                  <button
                    key={record.id}
                    onClick={() => onViewReport(record)}
                    className="w-full bg-white rounded-card p-4 border border-cream-200 hover:border-sage-200 transition-smooth text-left min-h-touch"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-medium text-foreground truncate">
                            {record.scaleName}
                          </span>
                          <span className={`
                            text-xs px-2 py-0.5 rounded-pill font-medium flex-shrink-0
                            ${record.status === 'completed'
                              ? record.riskLevel === 'low'
                                ? 'bg-green-50 text-green-600'
                                : record.riskLevel === 'moderate'
                                  ? 'bg-yellow-50 text-yellow-700'
                                  : 'bg-red-50 text-red-600'
                              : 'bg-cream-200 text-muted'
                            }
                          `}>
                            {record.status === 'completed' ? record.riskLabel : '未完成'}
                          </span>
                        </div>
                        <p className="text-sm text-muted">
                          {record.childName} · {new Date(record.completedAt).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 ml-2" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
