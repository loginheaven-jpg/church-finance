import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 표시용 이름 변환: 동명이인 구분자(끝 숫자) 제거
 * 예: "김상혁1" → "김상혁", "홍길동2" → "홍길동"
 */
export function getDisplayName(name: string): string {
  return name.replace(/\d+$/, '');
}
