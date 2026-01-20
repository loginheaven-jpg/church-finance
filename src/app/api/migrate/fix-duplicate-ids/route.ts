import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const FINANCE_CONFIG = {
  spreadsheetId: process.env.FINANCE_SHEET_ID!,
  sheets: {
    income: '수입부',
    expense: '지출부',
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

function generateUniqueId(prefix: string): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = kst.getTime().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}${dateStr}${timeStr}${random}`;
}

async function fixDuplicateIds(sheetName: string, prefix: string): Promise<{ fixed: number; details: string[] }> {
  const sheets = getGoogleSheetsClient();

  // 전체 데이터 읽기
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A:A`,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) {
    return { fixed: 0, details: [] };
  }

  // ID별 행 번호 수집 (1-indexed, 헤더 제외)
  const idToRows = new Map<string, number[]>();
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][0];
    if (!id) continue;

    const existing = idToRows.get(id) || [];
    existing.push(i + 1); // 시트는 1-indexed
    idToRows.set(id, existing);
  }

  // 중복 ID 찾기
  const duplicates: Array<{ id: string; rows: number[] }> = [];
  idToRows.forEach((rowNums, id) => {
    if (rowNums.length > 1) {
      duplicates.push({ id, rows: rowNums });
    }
  });

  if (duplicates.length === 0) {
    return { fixed: 0, details: [] };
  }

  // 중복 ID 수정 (첫 번째는 유지, 나머지는 새 ID 부여)
  const details: string[] = [];
  let fixed = 0;

  for (const dup of duplicates) {
    // 첫 번째 행은 유지, 나머지 행에 새 ID 부여
    for (let i = 1; i < dup.rows.length; i++) {
      const rowNum = dup.rows[i];
      const newId = generateUniqueId(prefix);

      // 해당 셀 업데이트
      await sheets.spreadsheets.values.update({
        spreadsheetId: FINANCE_CONFIG.spreadsheetId,
        range: `${sheetName}!A${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[newId]],
        },
      });

      details.push(`${sheetName} 행${rowNum}: ${dup.id} → ${newId}`);
      fixed++;

      // API 속도 제한 방지
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { fixed, details };
}

export async function POST() {
  try {
    console.log('[fix-duplicate-ids] 중복 ID 수정 시작');

    // 수입부 중복 ID 수정
    const incomeResult = await fixDuplicateIds(FINANCE_CONFIG.sheets.income, 'INC');
    console.log('[fix-duplicate-ids] 수입부:', incomeResult);

    // 지출부 중복 ID 수정
    const expenseResult = await fixDuplicateIds(FINANCE_CONFIG.sheets.expense, 'EXP');
    console.log('[fix-duplicate-ids] 지출부:', expenseResult);

    const totalFixed = incomeResult.fixed + expenseResult.fixed;
    const allDetails = [...incomeResult.details, ...expenseResult.details];

    return NextResponse.json({
      success: true,
      message: `중복 ID ${totalFixed}건 수정 완료`,
      incomeFixed: incomeResult.fixed,
      expenseFixed: expenseResult.fixed,
      details: allDetails,
    });
  } catch (error) {
    console.error('[fix-duplicate-ids] 에러:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `중복 ID 수정 실패: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// GET으로 현재 중복 상태만 확인
export async function GET() {
  try {
    const sheets = getGoogleSheetsClient();
    const results: Record<string, { duplicates: Array<{ id: string; count: number }> }> = {};

    for (const [name, sheetName] of Object.entries(FINANCE_CONFIG.sheets)) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: FINANCE_CONFIG.spreadsheetId,
        range: `${sheetName}!A:A`,
      });

      const rows = response.data.values || [];
      const idCount = new Map<string, number>();

      for (let i = 1; i < rows.length; i++) {
        const id = rows[i][0];
        if (!id) continue;
        idCount.set(id, (idCount.get(id) || 0) + 1);
      }

      const duplicates: Array<{ id: string; count: number }> = [];
      idCount.forEach((count, id) => {
        if (count > 1) {
          duplicates.push({ id, count });
        }
      });

      results[name] = { duplicates };
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[fix-duplicate-ids] GET 에러:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
