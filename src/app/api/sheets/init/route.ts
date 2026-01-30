import { NextRequest, NextResponse } from 'next/server';
import { initializeSheets, resetCodeTables } from '@/lib/google-sheets';
import { getServerSession } from '@/lib/auth/finance-permissions';

// POST: 시트 초기화 (super_admin만)
export async function POST(request: NextRequest) {
  try {
    // 권한 확인 (super_admin만)
    const session = await getServerSession();
    if (!session || session.finance_role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    if (force) {
      // 코드 테이블 강제 교체 모드
      const result = await resetCodeTables();
      return NextResponse.json({
        success: true,
        message: '코드 테이블이 교체되었습니다',
        data: {
          incomeCodes: result.income,
          expenseCodes: result.expense,
        }
      });
    }

    await initializeSheets();

    return NextResponse.json({
      success: true,
      message: '시트가 초기화되었습니다',
    });
  } catch (error) {
    console.error('Sheets init error:', error);
    return NextResponse.json(
      { success: false, error: '시트 초기화 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// GET: 시트 연결 테스트 (super_admin만)
export async function GET() {
  // 권한 확인 (super_admin만)
  const session = await getServerSession();
  if (!session || session.finance_role !== 'super_admin') {
    return NextResponse.json(
      { success: false, error: '권한이 없습니다' },
      { status: 403 }
    );
  }

  const { google } = await import('googleapis');
  const { JWT } = await import('google-auth-library');

  try {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const keyHasEscapedNewlines = privateKey.includes('\\n');
    if (keyHasEscapedNewlines) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.FINANCE_SHEET_ID,
      range: '수입부!A1:K5',
    });

    return NextResponse.json({
      success: true,
      rowCount: response.data.values?.length || 0,
      message: '시트 연결 정상',
    });
  } catch (error) {
    console.error('Sheet read test error:', error);
    return NextResponse.json({
      success: false,
      error: '시트 연결 실패',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
