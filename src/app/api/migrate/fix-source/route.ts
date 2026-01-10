import { NextRequest, NextResponse } from 'next/server';
import { readSheet, updateSheet } from '@/lib/google-sheets';

/**
 * 수입부 source 필드 정리
 *
 * 규칙:
 * 1. '계좌이체' 또는 '헌금함' → 유지
 * 2. '통장' 또는 '계좌' 포함 → '계좌이체'
 * 3. 8글자 이상 → '헌금함'
 * 4. 나머지 → '계좌이체'
 */

function transformSource(source: string): string {
  // 이미 정상 값인 경우
  if (source === '계좌이체' || source === '헌금함') {
    return source;
  }

  // '통장' 또는 '계좌' 포함 시 계좌이체
  if (source.includes('통장') || source.includes('계좌')) {
    return '계좌이체';
  }

  // 8글자 이상이면 헌금함
  if (source.length >= 8) {
    return '헌금함';
  }

  // 나머지는 계좌이체
  return '계좌이체';
}

// GET: 분석만 수행
export async function GET() {
  try {
    const rows = await readSheet('수입부', 'A:K');

    if (!rows || rows.length <= 1) {
      return NextResponse.json({
        success: true,
        message: '수입부 데이터가 없습니다',
        analysis: {},
      });
    }

    // 헤더 확인
    const headers = rows[0];
    const sourceIndex = headers.indexOf('source');
    if (sourceIndex === -1) {
      return NextResponse.json({
        success: false,
        error: 'source 컬럼을 찾을 수 없습니다',
      }, { status: 400 });
    }

    // 현재 source 값 분석
    const sourceCount = new Map<string, number>();
    const needsFix: Array<{ row: number; current: string; fixed: string }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const source = String(row[sourceIndex] || '');

      // 카운트
      sourceCount.set(source, (sourceCount.get(source) || 0) + 1);

      // 변환 필요 여부 확인
      const fixed = transformSource(source);
      if (source !== fixed) {
        needsFix.push({ row: i + 1, current: source, fixed }); // row is 1-indexed for Sheet
      }
    }

    // 분석 결과 정리
    const analysis = {
      totalRecords: rows.length - 1,
      uniqueSourceValues: Object.fromEntries(sourceCount),
      needsFixCount: needsFix.length,
      sampleFixes: needsFix.slice(0, 20), // 최대 20개 샘플
    };

    return NextResponse.json({
      success: true,
      message: `분석 완료: ${needsFix.length}개 레코드 수정 필요`,
      analysis,
    });
  } catch (error) {
    console.error('Source analysis error:', error);
    return NextResponse.json({
      success: false,
      error: `분석 중 오류: ${error}`,
    }, { status: 500 });
  }
}

// POST: 실제 수정 수행
export async function POST(request: NextRequest) {
  try {
    const { dryRun = false } = await request.json().catch(() => ({}));

    const rows = await readSheet('수입부', 'A:K');

    if (!rows || rows.length <= 1) {
      return NextResponse.json({
        success: true,
        message: '수입부 데이터가 없습니다',
      });
    }

    // 헤더 확인
    const headers = rows[0];
    const sourceIndex = headers.indexOf('source');
    if (sourceIndex === -1) {
      return NextResponse.json({
        success: false,
        error: 'source 컬럼을 찾을 수 없습니다',
      }, { status: 400 });
    }

    // 변환이 필요한 행 수집
    const updates: Array<{ rowIndex: number; oldValue: string; newValue: string }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const source = String(row[sourceIndex] || '');
      const fixed = transformSource(source);

      if (source !== fixed) {
        updates.push({
          rowIndex: i + 1, // Sheet는 1-indexed
          oldValue: source,
          newValue: fixed,
        });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        message: '수정이 필요한 레코드가 없습니다',
        fixedCount: 0,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: `Dry run: ${updates.length}개 레코드 수정 예정`,
        dryRun: true,
        updates: updates.slice(0, 50), // 최대 50개 샘플
      });
    }

    // 실제 업데이트 수행 - 배치로 처리
    // source 컬럼은 C열 (sourceIndex가 2일 경우)
    const colLetter = String.fromCharCode(65 + sourceIndex); // 65는 'A'

    // 배치 업데이트 (각 행별로 업데이트)
    let fixedCount = 0;
    for (const update of updates) {
      const range = `${colLetter}${update.rowIndex}`;
      await updateSheet('수입부', range, [[update.newValue]]);
      fixedCount++;

      // 진행 상황 로그 (100건마다)
      if (fixedCount % 100 === 0) {
        console.log(`Source fix progress: ${fixedCount}/${updates.length}`);
      }
    }

    // 변환 결과 통계
    const toTransfer = updates.filter(u => u.newValue === '계좌이체').length;
    const toBox = updates.filter(u => u.newValue === '헌금함').length;

    return NextResponse.json({
      success: true,
      message: `${fixedCount}개 레코드 수정 완료`,
      fixedCount,
      summary: {
        계좌이체로변환: toTransfer,
        헌금함으로변환: toBox,
      },
      sampleUpdates: updates.slice(0, 20),
    });
  } catch (error) {
    console.error('Source fix error:', error);
    return NextResponse.json({
      success: false,
      error: `수정 중 오류: ${error}`,
    }, { status: 500 });
  }
}
