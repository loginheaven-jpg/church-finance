import { NextRequest, NextResponse } from 'next/server';
import {
  getAllBudgets,
  getBudget,
  addBudget,
  updateBudget,
  deleteBudget,
  getExpenseCodes,
} from '@/lib/google-sheets';

// GET: 예산 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (year) {
      const budgets = await getBudget(Number(year));
      return NextResponse.json({
        success: true,
        data: budgets,
      });
    }

    const allBudgets = await getAllBudgets();
    return NextResponse.json({
      success: true,
      data: allBudgets,
    });
  } catch (error) {
    console.error('Budget fetch error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST: 예산 추가/수정
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, account_code, budgeted_amount, note, action } = body;

    if (!year || !account_code) {
      return NextResponse.json(
        { success: false, error: '연도와 계정과목은 필수입니다' },
        { status: 400 }
      );
    }

    // 지출부코드에서 카테고리 정보 조회
    const expenseCodes = await getExpenseCodes();
    const codeInfo = expenseCodes.find(c => c.code === Number(account_code));

    if (!codeInfo) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 계정과목입니다' },
        { status: 400 }
      );
    }

    if (action === 'update') {
      await updateBudget(Number(year), Number(account_code), {
        budgeted_amount: Number(budgeted_amount) || 0,
        note: note || '',
      });
    } else {
      // 기존 예산 확인
      const existing = await getBudget(Number(year));
      const exists = existing.find(b => b.account_code === Number(account_code));

      if (exists) {
        // 업데이트
        await updateBudget(Number(year), Number(account_code), {
          budgeted_amount: Number(budgeted_amount) || 0,
          note: note || '',
        });
      } else {
        // 추가
        await addBudget({
          year: Number(year),
          category_code: codeInfo.category_code,
          category_item: codeInfo.category_item,
          account_code: Number(account_code),
          account_item: codeInfo.item,
          budgeted_amount: Number(budgeted_amount) || 0,
          note: note || '',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: '예산이 저장되었습니다',
    });
  } catch (error) {
    console.error('Budget save error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: 예산 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const accountCode = searchParams.get('account_code');

    if (!year || !accountCode) {
      return NextResponse.json(
        { success: false, error: '연도와 계정과목은 필수입니다' },
        { status: 400 }
      );
    }

    await deleteBudget(Number(year), Number(accountCode));

    return NextResponse.json({
      success: true,
      message: '예산이 삭제되었습니다',
    });
  } catch (error) {
    console.error('Budget delete error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
