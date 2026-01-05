import { NextResponse } from 'next/server';
import { initializeSheets, readSheet } from '@/lib/google-sheets';

export async function POST() {
  try {
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

export async function GET() {
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
      sample: response.data.values,
      env: {
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.substring(0, 30) + '...',
        keyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
        keyHasEscapedNewlines,
        sheetId: process.env.FINANCE_SHEET_ID,
      }
    });
  } catch (error) {
    console.error('Sheet read test error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      env: {
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.substring(0, 30) + '...',
        keyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
        sheetId: process.env.FINANCE_SHEET_ID,
      }
    }, { status: 500 });
  }
}
