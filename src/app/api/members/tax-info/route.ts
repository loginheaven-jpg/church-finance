import { NextRequest, NextResponse } from 'next/server';
import { updateMemberTaxInfo, hasMemberTaxInfo } from '@/lib/supabase';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';

// GET: 연말정산 정보 입력 여부 확인
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { success: false, error: '이름을 입력해주세요' },
        { status: 400 }
      );
    }

    const hasTaxInfo = await hasMemberTaxInfo(name);

    return NextResponse.json({
      success: true,
      hasTaxInfo,
    });
  } catch (error) {
    console.error('Check tax info error:', error);
    return NextResponse.json(
      { success: false, error: '조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// POST: 연말정산 정보 저장 (본인은 자기 정보만, admin은 타인 정보도 갱신 가능)
export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다' }, { status: 401 });
    }
    const isAdmin = hasRole(session.finance_role, 'admin');

    const body = await request.json();
    const { name, resident_id, address } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '이름을 입력해주세요' },
        { status: 400 }
      );
    }

    // 본인 정보가 아니면 admin 이상이어야 함
    if (name !== session.name && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '본인 정보만 수정할 수 있습니다' },
        { status: 403 }
      );
    }

    if (!resident_id) {
      return NextResponse.json(
        { success: false, error: '주민등록번호를 입력해주세요' },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { success: false, error: '주소를 입력해주세요' },
        { status: 400 }
      );
    }

    // 주민번호 형식 검증 (13자리 숫자, 하이픈 없음)
    const residentIdPattern = /^\d{13}$/;
    if (!residentIdPattern.test(resident_id)) {
      return NextResponse.json(
        { success: false, error: '주민등록번호 형식이 올바르지 않습니다 (13자리 숫자)' },
        { status: 400 }
      );
    }

    // Supabase 교적부 업데이트 (하이픈 없이 13자리 저장)
    const result = await updateMemberTaxInfo(name, resident_id, address);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '저장 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '연말정산 정보가 저장되었습니다',
    });
  } catch (error) {
    console.error('Save tax info error:', error);
    return NextResponse.json(
      { success: false, error: '저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
