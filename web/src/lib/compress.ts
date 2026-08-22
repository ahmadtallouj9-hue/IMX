export async function compressImage(file: File, maxWidth = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 100 * 1024) return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  let w = bitmap.width;
  let h = bitmap.height;

  if (w > maxWidth) {
    h = Math.round((h / w) * maxWidth);
    w = maxWidth;
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size < file.size) {
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp', lastModified: Date.now() }));
        } else {
          resolve(file);
        }
      },
      'image/webp',
      quality,
    );
  });
}
