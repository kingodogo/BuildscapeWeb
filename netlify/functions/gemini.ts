import { corsResponse } from './lib/supabaseHelpers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') return corsResponse(200, {});
  if (event.httpMethod !== 'POST') return corsResponse(405, { error: 'Method not allowed' });

  // 🔒 Admin/owner only — anonymous users cannot trigger AI calls
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!authHeader) return corsResponse(401, { error: 'You must be logged in to use AI analysis.' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return corsResponse(401, { error: 'Invalid session. Please log in again.' });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return corsResponse(403, { error: 'Only admins can run AI analysis.' });
  }

  const API_KEY = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  
  if (!API_KEY) {
    return corsResponse(503, { error: 'AI API Key not found in environment variables.' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { title, description, steps, mcVersions, expected, actual } = body;
    
    if (!title || !description) return corsResponse(400, { error: 'Title and description are required.' });

    const { GoogleGenAI } = await import('@google/genai');
    const client = new (GoogleGenAI as any)({ apiKey: API_KEY });
    
    const prompt = `You are a senior QA engineer for the Minecraft mod "Buildscape".
Analyze this bug report:
Title: ${title}
Description: ${description}
Steps: ${steps || 'Not provided'}
Expected: ${expected || 'Not provided'}
Actual: ${actual || 'Not provided'}
Versions: ${mcVersions?.join(', ') || 'Unknown'}

Provide a JSON response with:
- summary: 1-sentence summary
- qualityScore: 1-10
- severityAssessment: Low, Medium, High, or Critical
- suggestions: List of 3-4 items (causes, fixes, or reporter advice)

Output ONLY valid JSON.`;

    // ⚡ Using Gemini 2.0 Flash - the fastest and most reliable for JSON
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const text = response.text;
    if (!text) throw new Error('AI returned an empty response.');

    // Direct parse and return
    const aiData = JSON.parse(text.replace(/```json|```/g, '').trim());
    
    return corsResponse(200, {
      summary: aiData.summary || 'No summary.',
      qualityScore: aiData.qualityScore || 5,
      severityAssessment: aiData.severityAssessment || 'Medium',
      suggestions: aiData.suggestions || []
    });

  } catch (error: any) {
    console.error('Gemini System Error:', error);
    
    // Return the RAW error from Google so the user can see exactly why it fails
    // No more "Rate Limit" masks unless Google specifically sends a 429
    return corsResponse(error.status || 500, {
      error: error.message || 'An unexpected error occurred in the AI service.',
      code: error.status || 'AI_ERROR',
      details: error.details || error.stack
    });
  }
};
