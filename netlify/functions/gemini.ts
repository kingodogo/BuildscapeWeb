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

  // Check both possible names for the API key
  const API_KEY = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  
  if (!API_KEY) {
    return corsResponse(503, {
      error: 'AI analysis is not enabled on this server. (Missing API Key)'
    });
  }

  try {
    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) { /* ignore */ }

    const { title, description, steps, mcVersions, expected, actual } = body;
    if (!title || !description) return corsResponse(400, { error: 'Title and description are required.' });

    // 🚀 EXACT syntax from Google AI Studio SDK (@google/genai)
    const { GoogleGenAI } = await import('@google/genai');
    
    // The user's snippet showed: new GoogleGenAI({ apiKey: ... })
    const ai = new (GoogleGenAI as any)({ apiKey: API_KEY });
    
    const prompt = `You are a senior QA engineer for the Minecraft mod "Buildscape" (Authors: DGA, kingodogo).
Analyze the following bug report for Minecraft Versions: ${mcVersions?.join(', ') || 'Unknown'}.

Title: ${title}
Description: ${description}
Steps to Reproduce: ${steps || 'Not provided'}
Expected Behavior: ${expected || 'Not provided'}
Actual Behavior: ${actual || 'Not provided'}

Please provide a structured analysis in JSON format with the following fields:
- summary: A concise 1-sentence summary of the issue.
- qualityScore: A number (1-10) representing the clarity and completeness of the report.
- severityAssessment: Your recommended severity (Low, Medium, High, Critical) based on the impact described.
- suggestions: A list of 3-4 items including potential technical causes (e.g., mod conflicts, rendering pipeline) and advice for the reporter.

Output ONLY valid JSON.`;

    // ⚡ Using Gemini 2.0 Flash as it's the current state-of-the-art for fast JSON tasks
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    // In the new unified SDK, 'text' is a property.
    const text = response.text;
    
    if (!text) {
        throw new Error('AI service returned a success status but empty content.');
    }

    let aiData;
    try {
      // Clean potential markdown blocks just in case
      const cleaned = text.replace(/```json|```/g, '').trim();
      aiData = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON Parse Error. Raw text:', text);
      throw new Error(`The AI provided a non-JSON response: ${text.substring(0, 100)}...`);
    }

    // Gracefully map any field name variations (e.g. priority vs severity)
    return corsResponse(200, {
      summary: aiData.summary || 'Bug report analyzed.',
      qualityScore: aiData.qualityScore || 5,
      severityAssessment: aiData.severityAssessment || aiData.suggestedPriority || 'Medium',
      suggestions: aiData.suggestions || aiData.potentialCauses || ['Review report for missing logs or version info.']
    });

  } catch (error: any) {
    console.error('Gemini System Error:', error);
    
    // Only return "Rate Limited" if it's actually a 429
    if (error.status === 429 || error.message?.includes('429')) {
      return corsResponse(429, {
        error: 'Rate Limit reached. Please wait a moment.',
        details: error.message
      });
    }

    // Otherwise, return the REAL error so we know what's wrong
    return corsResponse(500, {
      error: 'The AI service encountered an error.',
      message: error.message,
      code: error.status || 'UNKNOWN'
    });
  }
};
