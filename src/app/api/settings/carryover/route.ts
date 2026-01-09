import { NextRequest, NextResponse } from 'next/server';
import {
  getCarryoverBalances,
  getCarryoverBalance,
  setCarryoverBalance,
  getKSTDateTime,
} from '@/lib/google-sheets';

// GET: 이월잔액 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (year) {
      const balance = await getCarryoverBalance(Number(year));
      return NextResponse.json({
        success: true,
        data: balance,
      });
    }

    const balances = await getCarryoverBalances();
    return NextResponse.json({
      success: true,
      data: balances,
    });
  } catch (error) {
    console.error('Carryover balance fetch error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST: 이월잔액 설정/수정
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, balance, construction_balance, note } = body;

    if (!year || balance === undefined) {
      return NextResponse.json(
        { success: false, error: '연도와 잔액은 필수입니다' },
        { status: 400 }
      );
    }

    await setCarryoverBalance({
      year: Number(year),
      balance: Number(balance),
      construction_balance: Number(construction_balance) || 0,
      note: note || '',
      updated_at: getKSTDateTime(),
      updated_by: 'admin',
    });

    return NextResponse.json({
      success: true,
      message: '이월잔액이 저장되었습니다',
    });
  } catch (error) {
    console.error('Carryover balance save error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
