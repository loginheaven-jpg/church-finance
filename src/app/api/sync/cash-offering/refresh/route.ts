import { NextResponse } from 'next/server';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9sjxdbGVWdtrAEpOkBhUlsvmy7iQYad3hyCY96V3j2rCFw-49dly5ke3tCxlvmBsvLQ/exec';

export async function POST() {
  try {
    // Google Apps Script Web App 호출 (mergeFromB 실행)
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'mergeFromB' }),
    });

    if (!response.ok) {
      // Apps Script는 redirect를 반환할 수 있음
      if (response.status === 302 || response.status === 301) {
        // redirect 따라가기
        const redirectUrl = response.headers.get('location');
        if (redirectUrl) {
          const redirectResponse = await fetch(redirectUrl);
          const result = await redirectResponse.text();
          return NextResponse.json({
            success: true,
            message: '헌금함 데이터가 갱신되었습니다',
            result,
          });
        }
      }
      throw new Error(`Apps Script 호출 실패: ${response.status}`);
    }

    const result = await response.text();

    return NextResponse.json({
      success: true,
      message: '헌금함 데이터가 갱신되었습니다',
      result,
    });
  } catch (error) {
    console.error('Apps Script 호출 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '헌금함 갱신 중 오류가 발생했습니다'
      },
      { status: 500 }
    );
  }
}
