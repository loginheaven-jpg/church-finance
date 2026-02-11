import * as XLSX from 'xlsx';
import { createBankBudgetSheet, BankBudgetExcelData } from './bank-budget-excel';
import { createBankAnnualSheet, BankAnnualExcelData } from './bank-annual-excel';

export function generateCombinedBankExcel(
  year: number,
  budgetData: BankBudgetExcelData,
  annualData: BankAnnualExcelData,
): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, createBankBudgetSheet(budgetData), '예산안');
  XLSX.utils.book_append_sheet(wb, createBankAnnualSheet(annualData), '연간보고');
  XLSX.writeFile(wb, `은행제출용_${year}년.xlsx`);
}
