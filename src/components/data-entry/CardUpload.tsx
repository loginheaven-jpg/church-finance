'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function CardUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<{ uploaded: number; message: string } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.xlsx'))) {
      setFile(droppedFile);
    } else {
      toast.error('XLS 또는 XLSX 파일만 업로드 가능합니다');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/card', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setResult(data);
        setFile(null);
        toast.success(data.message);
      } else {
        toast.error(data.error || '업로드 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('업로드 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>카드내역 업로드</CardTitle>
        <CardDescription>
          농협 법인카드 결제내역 XLSX 파일을 업로드하세요.
          자동으로 파싱되어 카드원본 시트에 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400',
          )}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onClick={() => document.getElementById('card-file-input')?.click()}
        >
          <input
            id="card-file-input"
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            onChange={handleFileSelect}
          />

          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="h-10 w-10 text-blue-600" />
              <div className="text-left">
                <div className="font-medium text-slate-900">{file.name}</div>
                <div className="text-base text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto h-12 w-12 text-slate-400" />
              <div className="mt-4 font-medium text-slate-700">
                파일을 드래그하거나 클릭하여 선택
              </div>
              <div className="text-base text-slate-500 mt-1">
                XLSX 파일
              </div>
            </div>
          )}
        </div>

        {file && (
          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                업로드 중...
              </>
            ) : (
              '업로드'
            )}
          </Button>
        )}

        {result && (
          <Alert className="border-green-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>업로드 완료</AlertTitle>
            <AlertDescription>
              {result.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
