import { supabase } from "../lib/supabase";

/**
 * Service to handle media uploads, optimization, and URL generation
 * using Supabase Storage as the "pure" multi-media infra.
 */

export type StorageBucket = 'avatars' | 'reports' | 'wiki' | 'suggestions';

export const MediaService = {
  /**
   * Uploads an image to Supabase and returns the public URL.
   * Includes client-side compression before uploading to save bandwidth.
   */
  uploadImage: async (
    file: File, 
    bucket: StorageBucket, 
    path: string, 
    options: { maxWidth?: number; quality?: number } = {}
  ): Promise<string> => {
    const { maxWidth = 1200, quality = 0.8 } = options;
    
    // 1. Client-side compression using Canvas
    const optimizedFile = await optimizeImage(file, maxWidth, quality);
    
    // 2. Upload to Supabase Storage
    const fileName = `${path}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, optimizedFile, {
        cacheControl: '31536000', // 1 year cache
        upsert: true
      });

    if (error) throw error;

    // 3. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  },

  /**
   * Returns an optimized URL for an image.
   * Uses Supabase image transformation if available (requires Pro/Dedicated),
   * otherwise returns the standard URL with aggressive caching hints.
   */
  getOptimizedUrl: (url: string, width?: number, height?: number): string => {
    if (!url) return '';
    
    // If it's a Supabase URL, we can append transformation params
    // Note: This requires Supabase Image Transformation to be enabled in your project
    if (url.includes('supabase.co/storage/v1/render/image')) {
       return url; // Already a transformed URL
    }
    
    if (url.includes('supabase.co/storage/v1/object/public')) {
      const baseUrl = url.split('/object/public/')[0];
      const bucketAndPath = url.split('/object/public/')[1];
      
      // Syntax for Supabase transformation (requires Pro tier or self-hosting with ImgProxy)
      // return `${baseUrl}/render/image/public/${bucketAndPath}?width=${width || 800}&quality=80`;
    }

    return url;
  },

  /**
   * Deletes a file from storage
   */
  deleteFile: async (bucket: StorageBucket, path: string) => {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  }
};

/**
 * Compresses and resizes an image File into a JPEG Blob.
 *
 * The image is resized proportionally if its width exceeds `maxWidth`, then encoded as a JPEG
 * with the given `quality`.
 *
 * @param file - The source image File to compress
 * @param maxWidth - Maximum width in pixels; the image is scaled down proportionally if wider
 * @param quality - JPEG quality between 0 and 1
 * @returns A `Blob` containing the compressed JPEG image
 * @throws If reading the file fails or the canvas conversion does not produce a Blob
 */
async function optimizeImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
          },
          'image/jpeg',
          quality
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
}