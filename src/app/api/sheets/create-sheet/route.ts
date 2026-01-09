import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// 특정 시트만 생성하는 간단한 API
export async function POST(request: NextRequest) {
  try {
    const { sheetName } = await request.json();

    if (!sheetName) {
      return NextResponse.json(
        { success: false, error: '시트 이름이 필요합니다' },
        { status: 400 }
      );
    }

    // 시트 헤더 정의
    const sheetHeaders: Record<string, string[]> = {
      '이월잔액': ['year', 'balance', 'construction_balance', 'note', 'updated_at', 'updated_by'],
      '작정헌금': ['id', 'year', 'donor_name', 'representative', 'pledged_amount', 'fulfilled_amount', 'note', 'created_at', 'updated_at'],
      '예산': ['year', 'account_code', 'budget_amount', 'note', 'created_at', 'updated_by'],
    };

    const headers = sheetHeaders[sheetName];
    if (!headers) {
      return NextResponse.json(
        { success: false, error: `지원하지 않는 시트: ${sheetName}` },
        { status: 400 }
      );
    }

    // Google Sheets 클라이언트 설정
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.FINANCE_SHEET_ID!;

    // 1. 시트 생성 시도
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: sheetName }
            }
          }]
        }
      });
      console.log(`Sheet "${sheetName}" created`);
    } catch (err) {
      // 시트가 이미 존재하면 무시
      console.log(`Sheet "${sheetName}" already exists or error:`, err);
    }

    // 2. 헤더 설정
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers]
      }
    });

    return NextResponse.json({
      success: true,
      message: `시트 "${sheetName}"가 생성되었습니다`,
      headers,
    });
  } catch (error) {
    console.error('Sheet creation error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// GET: 시트 존재 여부 확인
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get('name') || '이월잔액';

    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.FINANCE_SHEET_ID!;

    // 시트 목록 조회
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const sheetNames = response.data.sheets?.map(s => s.properties?.title) || [];
    const exists = sheetNames.includes(sheetName);

    return NextResponse.json({
      success: true,
      sheetName,
      exists,
      allSheets: sheetNames,
    });
  } catch (error) {
    console.error('Sheet check error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
