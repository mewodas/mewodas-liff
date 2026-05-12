// クライアント側で画像を圧縮（送信サイズ削減用）
// 長辺1280px / JPEG品質0.85 が目安：スマホ写真の3〜5MBを200〜500KB程度に圧縮できる
export async function compressImage(
  file: File,
  maxDimension = 1024,
  quality = 0.8
): Promise<File> {
  // 画像以外はそのまま返す
  if (!file.type.startsWith('image/')) return file;

  return new Promise<File>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas取得失敗'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('画像の圧縮に失敗しました'));
              return;
            }
            // 圧縮後がオリジナルより大きければオリジナルを返す
            if (blob.size >= file.size) {
              resolve(file);
              return;
            }
            const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([blob], name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('画像のデコードに失敗しました'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
