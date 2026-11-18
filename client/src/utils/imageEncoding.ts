export const MAX_ENCODED_IMAGE_BYTES = 7 * 1024 * 1024;

export function isEncodedImageDataUrl(value?: string | null): boolean {
  return Boolean(value?.trim().startsWith('data:image/'));
}

export function formatEncodedSizeKb(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  const base64Length = commaIdx >= 0 ? dataUrl.length - commaIdx - 1 : dataUrl.length;
  const approxBytes = Math.max(0, Math.round((base64Length * 3) / 4));
  const kb = Math.max(1, Math.round(approxBytes / 1024));
  return `${kb} KB`;
}

export function isImageTransfer(dataTransfer: DataTransfer): boolean {
  const types = Array.from(dataTransfer.types);
  if (types.includes('Files')) return true;
  if (types.includes('text/html')) return true;
  if (types.includes('text/uri-list')) return true;
  return false;
}

export async function extractImageFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<{ dataUrl: string; defaultLabel: string } | null> {
  // 1. Check for files
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    const file = Array.from(dataTransfer.files).find(
      (f) =>
        f.type.startsWith('image/') ||
        /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(f.name),
    );
    if (file) {
      return encodeImageFile(file);
    }
  }

  // 2. Check items for files
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (
          file &&
          (file.type.startsWith('image/') ||
            /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(file.name))
        ) {
          return encodeImageFile(file);
        }
      }
    }
  }

  // 3. Check for HTML <img> tag (e.g. dragged from another web page)
  const html = dataTransfer.getData('text/html');
  if (html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const img = doc.querySelector('img');
      if (img && img.src) {
        const src = img.src.trim();
        if (/^(https?:\/\/|data:image\/)/i.test(src)) {
          const altOrTitle = img.alt || img.title || '';
          return {
            dataUrl: src,
            defaultLabel: altOrTitle.trim() || 'Dropped Image',
          };
        }
      }
    } catch {
      // Ignore html parsing errors
    }
  }

  // 4. Check for direct URL in uri-list or plain text
  const uriList = dataTransfer.getData('text/uri-list')?.trim();
  const plainText = dataTransfer.getData('text/plain')?.trim();
  const candidate = uriList || plainText;
  if (candidate && candidate !== 'brainflow-new-box') {
    if (
      candidate.startsWith('data:image/') ||
      (/^(https?:\/\/)/i.test(candidate) &&
        (/\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(candidate) ||
          /(images\.|(\/|\?|&)image|photo-|avatar|\.svg)/i.test(candidate)))
    ) {
      const lastSegment = candidate.split('/').pop()?.split('?')[0] || '';
      const cleanLabel = lastSegment.replace(/\.[^/.]+$/, '').trim();
      return {
        dataUrl: candidate,
        defaultLabel: cleanLabel || 'Dropped Image',
      };
    }
  }

  return null;
}

export function encodeImageFile(
  file: File,
): Promise<{ dataUrl: string; defaultLabel: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file (PNG, JPG, GIF, WebP, SVG).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
        reject(new Error('Failed to encode image as a Data URL.'));
        return;
      }
      if (reader.result.length > MAX_ENCODED_IMAGE_BYTES) {
        reject(new Error('Encoded image exceeds the 7 MB limit. Please choose a smaller image.'));
        return;
      }
      const strippedName = file.name.replace(/\.[^/.]+$/, '').trim();
      resolve({
        dataUrl: reader.result,
        defaultLabel: strippedName || 'Embedded Image',
      });
    };
    reader.onerror = () => {
      reject(new Error('Could not read the selected image file.'));
    };
    reader.readAsDataURL(file);
  });
}
