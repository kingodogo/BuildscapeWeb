
import { corsResponse } from './lib/supabaseHelpers';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return corsResponse(405, { error: 'Method not allowed' });
  }

  try {
    const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';
    if (!IMGBB_API_KEY) {
      return corsResponse(500, { error: 'Image upload service not configured.' });
    }

    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {}
    
    const { image, name } = body;
    if (!image) {
      return corsResponse(400, { error: 'No image provided' });
    }

    let base64Data = image;
    if (image.includes(',')) {
      base64Data = image.split(',')[1];
    }

    const formData = new URLSearchParams();
    formData.append('image', base64Data);
    if (name) formData.append('name', name);

    const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!imgbbResponse.ok) {
        return corsResponse(imgbbResponse.status, { error: 'ImgBB upload failed' });
    }

    const imgbbData = await imgbbResponse.json();
    if (!imgbbData.success || !imgbbData.data) {
        return corsResponse(500, { error: 'ImgBB error: ' + (imgbbData.error?.message || 'Unknown') });
    }

    return corsResponse(200, {
      url: imgbbData.data.url,
      deleteUrl: imgbbData.data.delete_url,
      thumb: imgbbData.data.thumb?.url || imgbbData.data.url,
    });

  } catch (error: any) {
    console.error('Upload Error:', error);
    return corsResponse(500, { error: error.message });
  }
};
