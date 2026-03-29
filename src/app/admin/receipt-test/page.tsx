'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Trash2, Check, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-compress';

interface AnalysisResult {
  id: string;
  fileName: string;
  imagePreview: string;
  // 사용자 입력 (비교용)
  userAmount: string;
  userStore: string;
  // AI 결과
  loading: boolean;
  raw?: string;
  parsed?: {
    amount: number | null;
    store: string | null;
    date: string | null;
    items: string[];
    confidence: string;
  };
  parseError?: string;
  error?: string;
  elapsed?: number;
  model?: string;
  provider?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export default function ReceiptTestPage() {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newResults: AnalysisResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // 미리보기 생성
      const preview = URL.createObjectURL(file);
      const id = `${Date.now()}_${i}`;
      newResults.push({
        id,
        fileName: file.name,
        imagePreview: preview,
        userAmount: '',
        userStore: '',
        loading: true,
      });
    }

    setResults(prev => [...newResults, ...prev]);

    // 각 파일을 순차적으로 분석
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = newResults[i].id;

      try {
        // 압축
        const compressed = await compressImage(file);

        // base64 변환
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // data:image/jpeg;base64, 부분 제거
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(compressed);
        });

        // API 호출
        const res = await fetch('/api/admin/receipt-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64,
            image_media_type: compressed.type || 'image/jpeg',
          }),
        });

        const data = await res.json();

        setResults(prev => prev.map(r =>
          r.id === id ? {
            ...r,
            loading: false,
            raw: data.raw,
            parsed: data.parsed,
            parseError: data.parseError,
            error: data.error,
            elapsed: data.elapsed,
            model: data.model,
            provider: data.provider,
            usage: data.usage,
          } : r
        ));
      } catch (err) {
        setResults(prev => prev.map(r =>
          r.id === id ? {
            ...r,
            loading: false,
            error: err instanceof Error ? err.message : '분석 실패',
          } : r
        ));
      }
    }

    // input 초기화
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeResult = (id: string) => {
    setResults(prev => prev.filter(r => r.id !== id));
  };

  const updateUserInput = (id: string, field: 'userAmount' | 'userStore', value: string) => {
    setResults(prev => prev.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const amountMatch = (parsed: AnalysisResult['parsed'], userAmount: string) => {
    if (!parsed?.amount || !userAmount) return null;
    const user = parseInt(userAmount.replace(/[^0-9]/g, ''));
    if (!user) return null;
    return parsed.amount === user;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">영수증 AI 분석 테스트</h1>
        <Badge variant="outline" className="text-orange-600 border-orange-300">super_admin 전용</Badge>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate-500">
              영수증 이미지를 업로드하면 AI(Claude Haiku)가 금액, 가맹점, 날짜, 품목을 추출합니다.
            </p>
            <Button onClick={() => fileInputRef.current?.click()} size="lg">
              <Upload className="h-5 w-5 mr-2" />
              영수증 업로드 (복수 가능)
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map(result => (
            <Card key={result.id} className={result.error ? 'border-red-200' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{result.fileName}</CardTitle>
                  <div className="flex items-center gap-2">
                    {result.loading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {result.elapsed && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {(result.elapsed / 1000).toFixed(1)}s
                      </Badge>
                    )}
                    {result.model && (
                      <Badge variant="outline" className="text-xs">{result.provider}</Badge>
                    )}
                    {result.usage && (
                      <Badge variant="outline" className="text-xs">
                        {result.usage.input_tokens + result.usage.output_tokens} tokens
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => removeResult(result.id)}>
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
                  {/* 이미지 미리보기 */}
                  <div className="flex-shrink-0">
                    <img
                      src={result.imagePreview}
                      alt={result.fileName}
                      className="w-full max-w-[200px] rounded-lg border object-contain max-h-[250px]"
                    />
                  </div>

                  {/* 분석 결과 */}
                  <div className="space-y-3">
                    {result.loading && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI 분석 중...
                      </div>
                    )}

                    {result.error && (
                      <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
                        {result.error}
                        {result.raw && <pre className="mt-2 text-xs whitespace-pre-wrap">{result.raw}</pre>}
                      </div>
                    )}

                    {result.parsed && (
                      <div className="space-y-2">
                        {/* AI 추출 결과 */}
                        <div className="p-3 bg-slate-50 rounded-lg space-y-1.5">
                          <div className="text-xs font-semibold text-slate-500 mb-2">AI 추출 결과</div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500 w-16">금액:</span>
                            <span className="font-bold text-lg">
                              {result.parsed.amount?.toLocaleString() ?? '인식불가'}원
                            </span>
                            {result.parsed.confidence && (
                              <Badge variant="outline" className={
                                result.parsed.confidence === 'high' ? 'text-green-600 border-green-300' :
                                result.parsed.confidence === 'medium' ? 'text-yellow-600 border-yellow-300' :
                                'text-red-600 border-red-300'
                              }>
                                {result.parsed.confidence}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500 w-16">가맹점:</span>
                            <span>{result.parsed.store ?? '인식불가'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500 w-16">날짜:</span>
                            <span>{result.parsed.date ?? '인식불가'}</span>
                          </div>
                          {result.parsed.items && result.parsed.items.length > 0 && (
                            <div className="flex items-start gap-2 text-sm">
                              <span className="text-slate-500 w-16">품목:</span>
                              <span>{result.parsed.items.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        {/* 대조 입력 */}
                        <div className="p-3 bg-blue-50 rounded-lg space-y-2">
                          <div className="text-xs font-semibold text-blue-600">대조 테스트 (수동 입력)</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-500">청구 금액</label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="금액 입력"
                                className="h-8 text-sm"
                                value={result.userAmount}
                                onChange={e => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  updateUserInput(result.id, 'userAmount', v ? Number(v).toLocaleString() : '');
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">가맹점</label>
                              <Input
                                placeholder="가맹점 입력"
                                className="h-8 text-sm"
                                value={result.userStore}
                                onChange={e => updateUserInput(result.id, 'userStore', e.target.value)}
                              />
                            </div>
                          </div>
                          {result.userAmount && (
                            <div className="flex items-center gap-2 text-sm">
                              {amountMatch(result.parsed, result.userAmount) === true ? (
                                <><Check className="h-4 w-4 text-green-600" /><span className="text-green-700 font-medium">금액 일치</span></>
                              ) : amountMatch(result.parsed, result.userAmount) === false ? (
                                <><AlertTriangle className="h-4 w-4 text-red-500" /><span className="text-red-600 font-medium">
                                  금액 불일치: AI {result.parsed.amount?.toLocaleString()}원 vs 입력 {result.userAmount}원
                                  (차이 {Math.abs((result.parsed.amount || 0) - parseInt(result.userAmount.replace(/[^0-9]/g, ''))).toLocaleString()}원)
                                </span></>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {result.parseError && (
                      <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                        <AlertTriangle className="h-4 w-4 inline mr-1" />
                        {result.parseError}
                        {result.raw && (
                          <pre className="mt-2 text-xs whitespace-pre-wrap bg-white p-2 rounded">{result.raw}</pre>
                        )}
                      </div>
                    )}

                    {/* AI Raw 응답 (접기) */}
                    {result.raw && !result.error && (
                      <details className="text-xs">
                        <summary className="text-slate-400 cursor-pointer hover:text-slate-600">AI 원본 응답 보기</summary>
                        <pre className="mt-1 p-2 bg-slate-100 rounded whitespace-pre-wrap">{result.raw}</pre>
                      </details>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
