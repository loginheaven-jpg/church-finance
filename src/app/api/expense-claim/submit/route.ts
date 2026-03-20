import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { addExpenseClaim } from '@/lib/google-sheets';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET = 'expense-receipts';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface GroupData {
  accountCode: string;
  amount: number;
  description: string;
  fileCount: number;
  groupIndex: number;
}

async function uploadReceipt(
  file: File,
  userId: string,
  year: string,
  claimId: string,
  suffix: string,
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) throw new Error('파일 크기는 10MB 이하여야 합니다');
  if (!supabaseAdmin) throw new Error('Storage가 설정되지 않았습니다');

  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${year}/${claimId}${suffix}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (error) {
    console.error('Receipt upload error:', error);
    throw new Error('영수증 업로드 실패');
  }
  return filePath;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const formData = await request.formData();
    const claimDate = (formData.get('claimDate') as string || '').trim();
    const bankName = (formData.get('bankName') as string || '').trim();
    const accountNumber = (formData.get('accountNumber') as string || '').replace(/[^0-9]/g, '');
    const accountHolder = (formData.get('accountHolder') as string || session.name).trim();
    const groupsJson = formData.get('groups') as string | null;

    if (!claimDate || !bankName || !accountNumber) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요' }, { status: 400 });
    }

    const year = claimDate.substring(0, 4);
    const userId = session.user_id;

    // 배치 제출 (groups JSON 있음)
    if (groupsJson) {
      const groups: GroupData[] = JSON.parse(groupsJson);
      if (!Array.isArray(groups) || groups.length === 0) {
        return NextResponse.json({ error: '청구 항목이 없습니다' }, { status: 400 });
      }

      const claimIds: string[] = [];

      for (const group of groups) {
        if (!group.accountCode || !group.amount || group.amount <= 0) continue;

        const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const receiptPaths: string[] = [];

        // 그룹별 파일 업로드
        for (let fi = 0; fi < group.fileCount; fi++) {
          const file = formData.get(`receipt_${group.groupIndex}_${fi}`) as File | null;
          if (file && file.size > 0) {
            const suffix = fi === 0 ? '' : `_${fi + 1}`;
            const path = await uploadReceipt(file, userId, year, claimId, suffix);
            receiptPaths.push(path);
          }
        }

        await addExpenseClaim({
          claimId,
          claimDate,
          claimant: session.name,
          accountCode: group.accountCode,
          amount: group.amount,
          description: group.description,
          accountNumber,
          accountHolder,
          bankName,
          receiptUrl: receiptPaths.length > 0 ? receiptPaths.join(',') : undefined,
        });

        claimIds.push(claimId);
      }

      return NextResponse.json({ success: true, claimIds });
    }

    // 단건 제출 (하위 호환)
    const accountCode = (formData.get('accountCode') as string || '').trim();
    const amountStr = (formData.get('amount') as string || '0').replace(/,/g, '');
    const description = (formData.get('description') as string || '').trim();
    const receiptFile = formData.get('receipt') as File | null;

    if (!accountCode || !description) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요' }, { status: 400 });
    }
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '금액을 올바르게 입력해주세요' }, { status: 400 });
    }

    const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let receiptUrl: string | undefined;

    if (receiptFile && receiptFile.size > 0) {
      receiptUrl = await uploadReceipt(receiptFile, userId, year, claimId, '');
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
      { error: error instanceof Error ? error.message : '지출청구 등록 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
