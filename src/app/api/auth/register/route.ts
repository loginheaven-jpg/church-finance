import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // 유효성 검사
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: '모든 필드를 입력해주세요' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 6자 이상이어야 합니다' },
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

    // 이메일 중복 확인
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('user_id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: '이미 가입된 이메일입니다' },
        { status: 400 }
      );
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, 10);

    // 사용자 등록 (승인 대기 상태, finance_role은 null)
    const { error: insertError } = await supabaseAdmin.from('users').insert({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      name: name.trim(),
      permission_level: 'member',
      is_approved: false,
      // finance_role은 관리자가 승인 시 설정
    });

    if (insertError) {
      console.error('Registration error:', insertError);

      // 컬럼 관련 에러 처리
      if (insertError.message?.includes('finance_role')) {
        // finance_role 컬럼 없이 재시도
        const { error: retryError } = await supabaseAdmin.from('users').insert({
          email: email.toLowerCase().trim(),
          password_hash: passwordHash,
          name: name.trim(),
          permission_level: 'member',
          is_approved: false,
        });

        if (retryError) {
          return NextResponse.json(
            { success: false, error: '가입 신청 중 오류가 발생했습니다' },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: '가입 신청 중 오류가 발생했습니다' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.',
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
