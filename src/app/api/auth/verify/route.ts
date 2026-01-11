import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { FinanceSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth/finance-permissions';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      );
    }

    // Supabase가 설정되지 않은 경우
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: '데이터베이스 연결이 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    // 사용자 조회 (finance_role은 없을 수 있으므로 permission_level도 조회)
    const { data: user, error: queryError } = await supabaseAdmin
      .from('users')
      .select('user_id, email, password_hash, name, member_id, permission_level, is_approved')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (queryError) {
      console.error('User query error:', queryError);
      return NextResponse.json(
        { success: false, error: '사용자 조회 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: '등록되지 않은 이메일입니다' },
        { status: 401 }
      );
    }

    // 승인 확인
    if (!user.is_approved) {
      return NextResponse.json(
        { success: false, error: '계정 승인 대기 중입니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    // 비밀번호 검증
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: '비밀번호가 일치하지 않습니다' },
        { status: 401 }
      );
    }

    // permission_level을 finance_role로 매핑
    // saint-record-v2의 permission_level: 'super_admin' | 'admin' | 'shepherd' | 'member'
    // finance_role: 'super_admin' | 'admin' | 'deacon' | 'member'
    const mapPermissionToRole = (permissionLevel: string): 'super_admin' | 'admin' | 'deacon' | 'member' => {
      switch (permissionLevel) {
        case 'super_admin': return 'super_admin';
        case 'admin': return 'admin';
        case 'shepherd': return 'deacon'; // 목자 → 제직
        default: return 'member';
      }
    };

    // 세션 데이터 생성
    const sessionData: FinanceSession = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      member_id: user.member_id,
      finance_role: mapPermissionToRole(user.permission_level || 'member'),
    };

    const response = NextResponse.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        role: sessionData.finance_role,
      }
    });

    // 세션 쿠키 설정
    response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

    // 기존 auth-token도 설정 (기존 미들웨어 호환)
    response.cookies.set('auth-token', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Auth verify error:', error);
    return NextResponse.json(
      { success: false, error: '인증 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 로그아웃
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
