'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Globe,
  Calendar,
  Flame,
  Trophy,
  Edit,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Pledge, OfferingType, PledgeMilestone, MilestoneType, MILESTONE_INFO } from '@/types';
import { PledgeModal } from './PledgeModal';

// 마일스톤 정보
const MILESTONE_INFO_LOCAL: Record<string, { emoji: string; message: string }> = {
  first_pledge: { emoji: '🌱', message: '작정의 첫 걸음' },
  first_fulfill: { emoji: '✨', message: '첫 달성' },
  progress_25: { emoji: '🌱', message: '25% 달성' },
  progress_50: { emoji: '🌿', message: '50% 달성' },
  progress_75: { emoji: '🌳', message: '75% 달성' },
  progress_100: { emoji: '🎉', message: '완수' },
  streak_4: { emoji: '🔥', message: '4주 연속' },
  streak_12: { emoji: '💪', message: '12주 연속' },
  streak_24: { emoji: '⭐', message: '반년 연속' },
  streak_52: { emoji: '🏆', message: '1년 연속' },
  building_1y: { emoji: '🏛️', message: '성전봉헌 1년' },
  building_3y: { emoji: '🏰', message: '성전봉헌 3년' },
  mission_1y: { emoji: '🌍', message: '선교 1년' },
  all_types: { emoji: '💎', message: '온전한 헌신' },
};

interface PledgeStatusCardProps {
  pledges: Pledge[];
  milestones?: PledgeMilestone[];
  donorName: string;
  representative?: string;
  year: number;
  onRefresh?: () => void;
}

const OFFERING_ICONS: Record<OfferingType, React.ReactNode> = {
  building: <Building2 className="h-5 w-5" />,
  mission: <Globe className="h-5 w-5" />,
  weekly: <Calendar className="h-5 w-5" />,
};

const OFFERING_LABELS: Record<OfferingType, string> = {
  building: '성전봉헌헌금',
  mission: '선교헌금',
  weekly: '주정헌금',
};

const OFFERING_COLORS: Record<OfferingType, { bg: string; text: string; progress: string }> = {
  building: { bg: 'bg-amber-50', text: 'text-amber-700', progress: 'bg-amber-500' },
  mission: { bg: 'bg-blue-50', text: 'text-blue-700', progress: 'bg-blue-500' },
  weekly: { bg: 'bg-green-50', text: 'text-green-700', progress: 'bg-green-500' },
};

const PERIOD_LABELS: Record<string, string> = {
  weekly: '주',
  monthly: '월',
  yearly: '연',
};

export function PledgeStatusCard({
  pledges,
  milestones = [],
  donorName,
  representative,
  year,
  onRefresh,
}: PledgeStatusCardProps) {
  const [showNewPledgeModal, setShowNewPledgeModal] = useState(false);
  const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);
  const [expandedPledge, setExpandedPledge] = useState<string | null>(null);

  const activePledges = pledges.filter(p => p.status === 'active');

  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억`;
    }
    if (amount >= 10000) {
      return `${Math.round(amount / 10000)}만`;
    }
    return amount.toLocaleString();
  };

  const handleDelete = async (pledgeId: string) => {
    if (!confirm('정말 이 작정을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/pledges/${pledgeId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        onRefresh?.();
      }
    } catch (error) {
      console.error('Delete pledge error:', error);
    }
  };

  const getProgressEmoji = (percentage: number) => {
    if (percentage >= 100) return '🎉';
    if (percentage >= 75) return '🌳';
    if (percentage >= 50) return '🌿';
    if (percentage >= 25) return '🌱';
    return '🌱';
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-amber-500" />
            {year}년 작정헌금 현황
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewPledgeModal(true)}
            className="text-green-600 border-green-300 hover:bg-green-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            작정하기
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePledges.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>{year}년 작정헌금이 없습니다</p>
              <Button
                variant="link"
                onClick={() => setShowNewPledgeModal(true)}
                className="text-green-600 mt-2"
              >
                + 새로운 헌금 작정하기
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activePledges.map((pledge) => {
                const percentage = Math.min(
                  (pledge.fulfilled_amount / pledge.yearly_amount) * 100,
                  100
                );
                const colors = OFFERING_COLORS[pledge.offering_type];
                const isExpanded = expandedPledge === pledge.id;

                return (
                  <div
                    key={pledge.id}
                    className={`p-4 rounded-lg border ${colors.bg} border-slate-200`}
                  >
                    {/* 헤더 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={colors.text}>
                          {OFFERING_ICONS[pledge.offering_type]}
                        </span>
                        <span className={`font-semibold ${colors.text}`}>
                          {OFFERING_LABELS[pledge.offering_type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPledge(pledge)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pledge.id)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                      </div>
                    </div>

                    {/* 작정 정보 */}
                    <div className="text-sm text-slate-600 mb-2">
                      <span>
                        작정: {PERIOD_LABELS[pledge.pledge_period]} {formatAmount(pledge.amount)}원
                        {pledge.pledge_period !== 'yearly' && (
                          <span className="text-slate-400">
                            {' '}(연 {formatAmount(pledge.yearly_amount)}원)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* 누계 */}
                    <div className="text-sm mb-2">
                      <span className="font-medium">
                        누계: {formatAmount(pledge.fulfilled_amount)}원
                      </span>
                      <span className="text-slate-400">
                        {' '}({percentage.toFixed(1)}%)
                      </span>
                    </div>

                    {/* 프로그레스바 */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${colors.progress}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-lg">{getProgressEmoji(percentage)}</span>
                    </div>

                    {/* 스트릭 */}
                    {pledge.current_streak > 0 && (
                      <div className="flex items-center gap-1 text-sm text-orange-600">
                        <Flame className="h-4 w-4" />
                        <span className="font-medium">
                          {pledge.current_streak}
                          {pledge.pledge_period === 'weekly' ? '주' : '개월'} 연속 달성 중!
                        </span>
                      </div>
                    )}

                    {/* 월별 현황 (확장) */}
                    {pledge.pledge_period === 'monthly' && (
                      <button
                        onClick={() => setExpandedPledge(isExpanded ? null : pledge.id)}
                        className="flex items-center gap-1 text-xs text-slate-500 mt-2 hover:text-slate-700"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            접기
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            월별 현황 보기
                          </>
                        )}
                      </button>
                    )}

                    {isExpanded && pledge.pledge_period === 'monthly' && (
                      <div className="grid grid-cols-6 gap-1 mt-3 text-xs">
                        {Array.from({ length: 12 }, (_, i) => {
                          const month = i + 1;
                          const isInRange = month >= pledge.start_month && month <= pledge.end_month;
                          const monthlyTarget = pledge.amount;
                          // 실제로는 월별 이력을 조회해야 하지만, 간단히 비율로 계산
                          const estimatedMonthly = (pledge.fulfilled_amount / (pledge.end_month - pledge.start_month + 1));
                          const currentMonth = new Date().getMonth() + 1;
                          const isComplete = month < currentMonth && isInRange;

                          return (
                            <div
                              key={month}
                              className={`p-1.5 rounded text-center ${
                                !isInRange
                                  ? 'bg-slate-100 text-slate-400'
                                  : isComplete
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-50 text-slate-600'
                              }`}
                            >
                              <div className="font-medium">{month}월</div>
                              <div>{isComplete ? '✅' : isInRange ? '⏳' : '-'}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 마일스톤 */}
          {milestones.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-slate-700 mb-2">
                🏆 획득한 마일스톤
              </p>
              <div className="flex flex-wrap gap-2">
                {milestones.map((milestone, idx) => {
                  const info = MILESTONE_INFO_LOCAL[milestone.milestone_type];
                  if (!info) return null;
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs"
                      title={info.message}
                    >
                      {info.emoji} {info.message}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 새 작정 버튼 (빈 상태가 아닐 때) */}
          {activePledges.length > 0 && activePledges.length < 3 && (
            <Button
              variant="outline"
              className="w-full border-dashed border-slate-300 text-slate-500 hover:text-green-600 hover:border-green-300"
              onClick={() => setShowNewPledgeModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              새로운 헌금 작정하기
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 새 작정 모달 */}
      <PledgeModal
        open={showNewPledgeModal}
        onOpenChange={setShowNewPledgeModal}
        donorName={donorName}
        representative={representative}
        onSuccess={onRefresh}
      />

      {/* 수정 모달 */}
      {editingPledge && (
        <PledgeModal
          open={!!editingPledge}
          onOpenChange={(open) => !open && setEditingPledge(null)}
          donorName={donorName}
          representative={representative}
          existingPledge={editingPledge}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}
