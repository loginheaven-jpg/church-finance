import { NextRequest, NextResponse } from 'next/server';
import {
  addManualReceiptHistory,
  getAllIssueNumbers,
  getKSTDateTime,
  getManualReceiptHistory,
  deleteManualReceiptHistory,
} from '@/lib/google-sheets';
import type { ManualReceiptHistory } from '@/types';

// POST: 수작업 발급 이력 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, representative, address, resident_id, amount, issue_number, original_issue_number, note } = body;

    // 필수 필드 검증
    if (!year || !representative || !amount || !issue_number) {
      return NextResponse.json(
        { success: false, error: '필수 항목이 누락되었습니다 (연도, 대표자명, 금액, 발급번호)' },
        { status: 400 }
      );
    }

    // 발급번호 중복 체크
    const existingNumbers = await getAllIssueNumbers(year);
    if (existingNumbers.includes(issue_number)) {
      return NextResponse.json(
        { success: false, error: `발급번호 ${issue_number}이(가) 이미 사용 중입니다` },
        { status: 409 }
      );
    }

    // 발급 이력 저장
    const record: ManualReceiptHistory = {
      issue_number,
      year: parseInt(year),
      representative,
      address: address || '',
      resident_id: resident_id || '',
      amount: parseInt(amount),
      issued_at: getKSTDateTime(),
      original_issue_number: original_issue_number || '',
      note: note || '수작업',
    };

    await addManualReceiptHistory(record);

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('Manual receipt save error:', error);
    return NextResponse.json(
      { success: false, error: '발급 이력 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// GET: 발급번호 정보 조회 (다음 발급번호 제안)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const baseNumber = searchParams.get('base_number'); // 분할 발급용

    if (!yearParam) {
      return NextResponse.json(
        { success: false, error: '연도를 입력해주세요' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);
    const existingNumbers = await getAllIssueNumbers(year);

    let nextIssueNumber: string;

    if (baseNumber) {
      // 분할 발급: 기존 번호에 -2, -3, ... 추가
      let suffix = 2;
      while (existingNumbers.includes(`${baseNumber}-${suffix}`)) {
        suffix++;
      }
      nextIssueNumber = `${baseNumber}-${suffix}`;
    } else {
      // 신규 발급: 마지막 번호 +1
      const yearPrefix = String(year + 1);
      const numbersForYear = existingNumbers
        .filter(n => n.startsWith(yearPrefix) && !n.includes('-'))
        .map(n => parseInt(n.slice(4)) || 0);

      const maxSeq = numbersForYear.length > 0 ? Math.max(...numbersForYear) : 0;
      nextIssueNumber = `${yearPrefix}${String(maxSeq + 1).padStart(3, '0')}`;
    }

    // mode=history인 경우 발행이력 반환
    const mode = searchParams.get('mode');
    if (mode === 'history') {
      const history = await getManualReceiptHistory(year);
      return NextResponse.json({
        success: true,
        data: history,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        existingNumbers,
        nextIssueNumber,
        year,
      },
    });
  } catch (error) {
    console.error('Issue number query error:', error);
    return NextResponse.json(
      { success: false, error: '발급번호 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// DELETE: 발행이력 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const issueNumber = searchParams.get('issue_number');

    if (!yearParam || !issueNumber) {
      return NextResponse.json(
        { success: false, error: '연도와 발급번호가 필요합니다' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);
    const deleted = await deleteManualReceiptHistory(year, issueNumber);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '해당 발급번호를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `발급번호 ${issueNumber} 삭제 완료`,
    });
  } catch (error) {
    console.error('Delete receipt history error:', error);
    return NextResponse.json(
      { success: false, error: '삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
