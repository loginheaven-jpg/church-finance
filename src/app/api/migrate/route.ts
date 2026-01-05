import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { addIncomeRecords, addExpenseRecords, generateId, getKSTDateTime } from '@/lib/google-sheets';
import type { IncomeRecord, ExpenseRecord } from '@/types';

const BATCH_SIZE = 500;

export async function POST() {
  try {
    // Excel 파일 읽기
    const excelPath = path.join(process.cwd(), '..', '2025결산.xlsm');

    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({
        success: false,
        error: `Excel 파일을 찾을 수 없습니다: ${excelPath}`,
      }, { status: 400 });
    }

    const workbook = XLSX.readFile(excelPath);
    const now = getKSTDateTime();

    // 수입부 마이그레이션
    const incomeResult = await migrateIncome(workbook, now);

    // 지출부 마이그레이션
    const expenseResult = await migrateExpense(workbook, now);

    return NextResponse.json({
      success: true,
      message: '마이그레이션이 완료되었습니다',
      income: incomeResult,
      expense: expenseResult,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: `마이그레이션 중 오류가 발생했습니다: ${error}`,
    }, { status: 500 });
  }
}

async function migrateIncome(workbook: XLSX.WorkBook, now: string) {
  const sheet = workbook.Sheets['수입부'];
  if (!sheet) {
    return { processed: 0, error: '수입부 시트를 찾을 수 없습니다' };
  }

  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  // 첫 번째 행은 헤더
  // 날짜, 경로, 성명, 금액, 비고, 소코드, 소항목, 대코드, 대항목, 대표
  const dataRows = rawData.slice(1).filter(row => row[0] && row[2] && row[3]);

  const records: IncomeRecord[] = [];

  for (const row of dataRows) {
    const date = excelDateToString(row[0]);
    if (!date) continue;

    const record: IncomeRecord = {
      id: generateId('INC'),
      date,
      source: String(row[1] || '헌금함'),
      offering_code: Number(row[5]) || 11,
      donor_name: String(row[2] || ''),
      representative: String(row[9] || row[2] || ''),
      amount: Number(row[3]) || 0,
      note: String(row[4] || ''),
      input_method: 'Excel마이그레이션',
      created_at: now,
      created_by: 'migrate',
    };

    records.push(record);
  }

  // 배치 처리
  let processed = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await addIncomeRecords(batch);
    processed += batch.length;
    console.log(`수입부 진행: ${processed}/${records.length}`);
  }

  return { processed, total: records.length };
}

async function migrateExpense(workbook: XLSX.WorkBook, now: string) {
  const sheet = workbook.Sheets['지출부'];
  if (!sheet) {
    return { processed: 0, error: '지출부 시트를 찾을 수 없습니다' };
  }

  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  // 첫 번째 행은 헤더
  // 열2, 날짜, 경로, 청구자, 금액, 비고, 소코드, 소항목, 대코드, 대항목
  const dataRows = rawData.slice(1).filter(row => row[1] && row[4]);

  const records: ExpenseRecord[] = [];

  for (const row of dataRows) {
    const date = excelDateToString(row[1]);
    if (!date) continue;

    const record: ExpenseRecord = {
      id: generateId('EXP'),
      date,
      payment_method: String(row[2] || '계좌이체'),
      vendor: String(row[3] || ''),
      description: String(row[5] || ''),
      amount: Number(row[4]) || 0,
      account_code: Number(row[6]) || 0,
      category_code: Number(row[8]) || 0,
      note: '',
      created_at: now,
      created_by: 'migrate',
    };

    records.push(record);
  }

  // 배치 처리
  let processed = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await addExpenseRecords(batch);
    processed += batch.length;
    console.log(`지출부 진행: ${processed}/${records.length}`);
  }

  return { processed, total: records.length };
}

function excelDateToString(value: unknown): string {
  if (!value) return '';

  // Excel serial number to date
  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
    }
  }

  // Already a string date
  if (typeof value === 'string') {
    return value.replace(/\//g, '-').split(' ')[0];
  }

  return '';
}
