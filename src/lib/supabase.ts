import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 교적부 Supabase 클라이언트 (읽기 전용 - 클라이언트 사이드)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 환경변수가 설정된 경우에만 클라이언트 생성 (Anonymous)
let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// 서버 사이드용 Supabase 클라이언트 (Service Role - 인증/사용자 관리용)
let supabaseAdmin: SupabaseClient | null = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { supabase, supabaseAdmin };

// 교인 정보 타입
export interface MemberInfo {
  name: string;
  address: string | null;
  resident_id: string | null;  // 주민번호 앞 7자리 (YYMMDD-S 형식)
}

// 이름으로 교인 정보 조회
export async function getMemberByName(name: string): Promise<MemberInfo | null> {
  // Supabase가 설정되지 않은 경우 null 반환
  if (!supabase) {
    console.warn('Supabase not configured - skipping member lookup');
    return null;
  }

  const { data, error } = await supabase
    .from('members')
    .select('name, address, resident_id')
    .eq('name', name)
    .in('status', ['재적', '휴적'])
    .single();

  if (error || !data) {
    // 정확히 일치하는 결과가 없으면 부분 일치로 검색
    const { data: partialData } = await supabase
      .from('members')
      .select('name, address, resident_id')
      .ilike('name', `%${name}%`)
      .in('status', ['재적', '휴적'])
      .limit(1)
      .single();

    return partialData || null;
  }

  return data;
}

// 여러 이름으로 교인 정보 조회
export async function getMembersByNames(names: string[]): Promise<Map<string, MemberInfo>> {
  const result = new Map<string, MemberInfo>();

  // Supabase가 설정되지 않은 경우 빈 Map 반환
  if (!supabase) {
    console.warn('Supabase not configured - skipping members lookup');
    return result;
  }

  if (names.length === 0) return result;

  const { data, error } = await supabase
    .from('members')
    .select('name, address, resident_id')
    .in('name', names)
    .in('status', ['재적', '휴적']);

  if (!error && data) {
    for (const member of data) {
      result.set(member.name, member);
    }
  }

  return result;
}
