/**
 * 수입부 source 필드 분석 및 수정 스크립트
 * 실행: npx tsx scripts/analyze-source.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local 로드
config({ path: resolve(process.cwd(), '.env.local') });

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const FINANCE_SHEET_ID = process.env.FINANCE_SHEET_ID!;

function getGoogleSheetsClient() {
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

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

async function main() {
  const sheets = getGoogleSheetsClient();

  console.log('수입부 source 필드 분석 중...\n');

  // 수입부 시트 읽기
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_SHEET_ID,
    range: '수입부!A:K',
  });

  const rows = response.data.values || [];

  if (rows.length <= 1) {
    console.log('수입부 데이터가 없습니다.');
    return;
  }

  // 헤더 확인
  const headers = rows[0];
  const sourceIndex = headers.indexOf('source');
  console.log(`헤더: ${headers.join(', ')}`);
  console.log(`source 컬럼 인덱스: ${sourceIndex}\n`);

  if (sourceIndex === -1) {
    console.error('source 컬럼을 찾을 수 없습니다');
    return;
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
      needsFix.push({ row: i + 1, current: source, fixed });
    }
  }

  console.log('=== 현재 source 값 분포 ===');
  const sortedCounts = Array.from(sourceCount.entries()).sort((a, b) => b[1] - a[1]);
  for (const [value, count] of sortedCounts) {
    const needsChange = transformSource(value) !== value;
    console.log(`  "${value}": ${count}건 ${needsChange ? '→ 변환 필요' : ''}`);
  }

  console.log(`\n총 레코드: ${rows.length - 1}건`);
  console.log(`변환 필요: ${needsFix.length}건`);

  if (needsFix.length > 0) {
    console.log('\n=== 변환 샘플 (최대 20건) ===');
    for (const item of needsFix.slice(0, 20)) {
      console.log(`  행 ${item.row}: "${item.current}" → "${item.fixed}"`);
    }
  }

  // 실행 인자로 --fix가 있으면 실제 수정 수행
  if (process.argv.includes('--fix')) {
    console.log('\n\n=== 실제 수정 수행 중 ===');

    const colLetter = String.fromCharCode(65 + sourceIndex); // 65는 'A'

    // 전체 source 컬럼 데이터 재구성 (효율적인 일괄 업데이트)
    const sourceColumnData: string[][] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const source = String(row[sourceIndex] || '');
      const fixed = transformSource(source);
      sourceColumnData.push([fixed]);
    }

    console.log(`  ${sourceColumnData.length}개 행 업데이트 중...`);

    // 배치로 나누어 업데이트 (한 번에 최대 10000행씩)
    const BATCH_SIZE = 10000;
    let totalUpdated = 0;

    for (let i = 0; i < sourceColumnData.length; i += BATCH_SIZE) {
      const batch = sourceColumnData.slice(i, i + BATCH_SIZE);
      const startRow = i + 2; // 1-indexed, 헤더 스킵
      const endRow = startRow + batch.length - 1;
      const range = `수입부!${colLetter}${startRow}:${colLetter}${endRow}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId: FINANCE_SHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: batch,
        },
      });

      totalUpdated += batch.length;
      console.log(`  배치 업데이트 완료: ${totalUpdated}/${sourceColumnData.length}`);

      // API 제한 방지를 위한 짧은 대기
      if (i + BATCH_SIZE < sourceColumnData.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n수정 완료: ${needsFix.length}건 변환됨`);

    // 변환 결과 통계
    const toTransfer = needsFix.filter(u => u.fixed === '계좌이체').length;
    const toBox = needsFix.filter(u => u.fixed === '헌금함').length;
    console.log(`  - 계좌이체로 변환: ${toTransfer}건`);
    console.log(`  - 헌금함으로 변환: ${toBox}건`);
  } else {
    console.log('\n(실제 수정하려면 --fix 인자를 추가하세요)');
  }
}

main().catch(console.error);
