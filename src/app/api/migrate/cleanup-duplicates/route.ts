import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const FINANCE_CONFIG = {
  spreadsheetId: process.env.FINANCE_SHEET_ID!,
  sheets: {
    income: { name: '수입부', gid: 1311623818 },
    expense: { name: '지출부', gid: 1520948498 },
  },
};

function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

function generateUniqueId(prefix: string, index: number): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = kst.getTime().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6);
  const seq = index.toString().padStart(4, '0');
  return `${prefix}${dateStr}${timeStr}${random}${seq}`;
}

interface CleanupResult {
  sheetName: string;
  originalRows: number;
  duplicatesRemoved: number;
  finalRows: number;
  idsRegenerated: number;
}

async function cleanupSheet(
  sheets: ReturnType<typeof google.sheets>,
  sheetConfig: { name: string; gid: number },
  prefix: string
): Promise<CleanupResult> {
  const { name: sheetName, gid: sheetId } = sheetConfig;

  // 1. 전체 데이터 읽기
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const allRows = response.data.values || [];
  if (allRows.length <= 1) {
    return {
      sheetName,
      originalRows: 0,
      duplicatesRemoved: 0,
      finalRows: 0,
      idsRegenerated: 0,
    };
  }

  const header = allRows[0];
  const dataRows = allRows.slice(1);
  const originalRowCount = dataRows.length;

  console.log(`[cleanup] ${sheetName}: 원본 ${originalRowCount}행`);

  // 2. 중복 제거 (ID 기준, 첫 번째만 유지)
  const seenIds = new Set<string>();
  const uniqueRows: string[][] = [];
  let duplicateCount = 0;

  for (const row of dataRows) {
    const id = row[0];
    if (!id) {
      // ID가 없는 행은 건너뜀
      duplicateCount++;
      continue;
    }

    if (seenIds.has(id)) {
      duplicateCount++;
      continue;
    }

    seenIds.add(id);
    uniqueRows.push(row);
  }

  console.log(`[cleanup] ${sheetName}: 중복 ${duplicateCount}행 제거, 유니크 ${uniqueRows.length}행`);

  // 3. 전체 ID 재생성
  const regeneratedRows = uniqueRows.map((row, index) => {
    const newId = generateUniqueId(prefix, index + 1);
    return [newId, ...row.slice(1)];
  });

  // 4. 기존 데이터 전체 삭제 후 새 데이터 삽입
  // 먼저 데이터 영역만 삭제 (헤더 유지)
  if (originalRowCount > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: 1, // 헤더 다음부터
                endIndex: originalRowCount + 1, // 전체 데이터 행
              },
            },
          },
        ],
      },
    });

    console.log(`[cleanup] ${sheetName}: 기존 데이터 삭제 완료`);
  }

  // 5. 새 데이터 삽입
  if (regeneratedRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      range: `${sheetName}!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: regeneratedRows,
      },
    });

    console.log(`[cleanup] ${sheetName}: 새 데이터 ${regeneratedRows.length}행 삽입 완료`);
  }

  return {
    sheetName,
    originalRows: originalRowCount,
    duplicatesRemoved: duplicateCount,
    finalRows: regeneratedRows.length,
    idsRegenerated: regeneratedRows.length,
  };
}

// POST: 중복 제거 및 전체 ID 재생성 실행
export async function POST() {
  try {
    console.log('[cleanup-duplicates] 중복 정리 시작');
    const sheets = getGoogleSheetsClient();

    const incomeResult = await cleanupSheet(
      sheets,
      FINANCE_CONFIG.sheets.income,
      'INC'
    );

    const expenseResult = await cleanupSheet(
      sheets,
      FINANCE_CONFIG.sheets.expense,
      'EXP'
    );

    const totalRemoved = incomeResult.duplicatesRemoved + expenseResult.duplicatesRemoved;
    const totalRegenerated = incomeResult.idsRegenerated + expenseResult.idsRegenerated;

    return NextResponse.json({
      success: true,
      message: `중복 ${totalRemoved}행 제거, 전체 ${totalRegenerated}건 ID 재생성 완료`,
      income: incomeResult,
      expense: expenseResult,
    });
  } catch (error) {
    console.error('[cleanup-duplicates] 에러:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `정리 실패: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// GET: 현재 상태 확인 (중복 개수, 총 행 수)
export async function GET() {
  try {
    const sheets = getGoogleSheetsClient();
    const results: Record<string, { totalRows: number; uniqueIds: number; duplicateRows: number }> = {};

    for (const [key, config] of Object.entries(FINANCE_CONFIG.sheets)) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: FINANCE_CONFIG.spreadsheetId,
        range: `${config.name}!A:A`,
      });

      const rows = response.data.values || [];
      const dataRows = rows.slice(1); // 헤더 제외

      const idCount = new Map<string, number>();
      for (const row of dataRows) {
        const id = row[0];
        if (!id) continue;
        idCount.set(id, (idCount.get(id) || 0) + 1);
      }

      const uniqueIds = idCount.size;
      const totalRows = dataRows.length;
      const duplicateRows = totalRows - uniqueIds;

      results[key] = { totalRows, uniqueIds, duplicateRows };
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalRows: results.income.totalRows + results.expense.totalRows,
        uniqueRecords: results.income.uniqueIds + results.expense.uniqueIds,
        duplicatesToRemove: results.income.duplicateRows + results.expense.duplicateRows,
      },
    });
  } catch (error) {
    console.error('[cleanup-duplicates] GET 에러:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
