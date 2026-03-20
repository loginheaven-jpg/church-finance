/**
 * 클라이언트 이미지 압축 유틸
 * 영수증 촬영 이미지를 800px + JPEG 80%로 리사이즈
 */

const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const JPEG_QUALITY = 0.8;
const TARGET_SIZE = 500 * 1024; // 500KB 목표

export async function compressImage(file: File): Promise<File> {
  // 이미지가 아닌 파일(PDF 등)은 그대로 반환
  if (!file.type.startsWith('image/')) return file;

  // 이미 충분히 작으면 그대로 반환
  if (file.size <= TARGET_SIZE) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // 리사이즈 비율 계산
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // canvas 리사이즈
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // 원본 확장자 유지하되 실제는 JPEG
          const ext = file.name.split('.').pop()?.toLowerCase();
          const name = ext === 'jpg' || ext === 'jpeg'
            ? file.name
            : file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // 실패 시 원본 반환
    };

    img.src = url;
  });
}
