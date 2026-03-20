import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { addExpenseClaim } from '@/lib/google-sheets';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET = 'expense-receipts';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const formData = await request.formData();

    const claimDate = (formData.get('claimDate') as string || '').trim();
    const accountCode = (formData.get('accountCode') as string || '').trim();
    const amountStr = (formData.get('amount') as string || '0').replace(/,/g, '');
    const description = (formData.get('description') as string || '').trim();
    const accountNumber = (formData.get('accountNumber') as string || '').replace(/[^0-9]/g, '');
    const bankName = (formData.get('bankName') as string || '').trim();
    const accountHolder = (formData.get('accountHolder') as string || session.name).trim();
    const receiptFile = formData.get('receipt') as File | null;

    // 필수 필드 검증
    if (!claimDate || !accountCode || !description || !accountNumber || !bankName) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요' }, { status: 400 });
    }
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '금액을 올바르게 입력해주세요' }, { status: 400 });
    }

    // 고유 청구 ID 생성
    const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 영수증 파일 업로드 (Supabase Storage)
    let receiptUrl: string | undefined;
    if (receiptFile && receiptFile.size > 0) {
      if (receiptFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다' }, { status: 400 });
      }
      if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Storage가 설정되지 않았습니다' }, { status: 500 });
      }

      const year = claimDate.substring(0, 4);
      const ext = receiptFile.name.split('.').pop() || 'jpg';
      const filePath = `${session.name}/${year}/${claimId}.${ext}`;

      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
          contentType: receiptFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Receipt upload error:', uploadError);
        return NextResponse.json({ error: '영수증 업로드 중 오류가 발생했습니다' }, { status: 500 });
      }

      // signed URL (1시간)
      const { data: signedData } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 3600);

      receiptUrl = filePath; // 경로만 저장 (다운로드 시 signed URL 재생성)
      void signedData; // signed URL은 조회 시 생성
    }

    await addExpenseClaim({
      claimId,
      claimDate,
      claimant: session.name,
      accountCode,
      amount,
      description,
      accountNumber,
      accountHolder,
      bankName,
      receiptUrl,
    });

    return NextResponse.json({ success: true, claimId });
  } catch (error) {
    console.error('Expense claim submit API error:', error);
    return NextResponse.json(
      { error: '지출청구 등록 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
