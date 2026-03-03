import { supabase } from '@/db/supabase';

const BUCKET_NAME = 'app-a01l6cjlhwjl_product_images';
const MAX_FILE_SIZE = 1048576; // 1MB

interface CompressionResult {
  blob: Blob;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
}

async function compressImage(file: File): Promise<CompressionResult> {
  const originalSize = file.size;

  // If file is already under 1MB, no compression needed
  if (originalSize <= MAX_FILE_SIZE) {
    return {
      blob: file,
      compressed: false,
      originalSize,
      finalSize: originalSize
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Calculate new dimensions (max 1080p)
      let width = img.width;
      let height = img.height;
      const maxDimension = 1920;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels
      const tryCompress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            if (blob.size <= MAX_FILE_SIZE || quality <= 0.5) {
              resolve({
                blob,
                compressed: true,
                originalSize,
                finalSize: blob.size
              });
            } else {
              // Try lower quality
              tryCompress(quality - 0.1);
            }
          },
          'image/webp',
          quality
        );
      };

      tryCompress(0.8);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

function sanitizeFilename(filename: string): string {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  // Keep only alphanumeric characters and replace others with underscore
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
  return sanitized || 'image';
}

export async function uploadProductImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; compressed: boolean; originalSize: number; finalSize: number }> {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload JPEG, PNG, GIF, WEBP, or AVIF images.');
  }

  // Compress if needed
  onProgress?.(10);
  const { blob, compressed, originalSize, finalSize } = await compressImage(file);
  onProgress?.(40);

  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const sanitizedName = sanitizeFilename(file.name);
  const extension = compressed ? 'webp' : file.name.split('.').pop();
  const filename = `${sanitizedName}_${timestamp}_${randomStr}.${extension}`;

  onProgress?.(50);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, blob, {
      contentType: compressed ? 'image/webp' : file.type,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  onProgress?.(90);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  onProgress?.(100);

  return {
    url: urlData.publicUrl,
    compressed,
    originalSize,
    finalSize
  };
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  // Extract filename from URL
  const urlParts = imageUrl.split('/');
  const filename = urlParts[urlParts.length - 1];

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filename]);

  if (error) {
    console.error('Failed to delete image:', error);
    // Don't throw error as the image might already be deleted
  }
}
