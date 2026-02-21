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

  const API_KEY = process.env.GEMINI_API_KEY || '';
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

    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new (GoogleGenAI as any)({ apiKey: API_KEY });
    
    // Using 1.5 Flash for best reliability and quota on Free Tier. 
    // It supports JSON mode and is very fast.
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text) throw new Error('Empty response from AI service');

    let aiData;
    try {
      aiData = JSON.parse(text);
    } catch (e) {
      // Small fallback if JSON is wrapped in code blocks
      const cleaned = text.replace(/```json|```/g, '').trim();
      aiData = JSON.parse(cleaned);
    }

    return corsResponse(200, aiData);

  } catch (error: any) {
    console.error('Gemini Error:', error);
    
    const errorMessage = error.message?.toLowerCase() || '';
    const isRateLimit = errorMessage.includes('429') || 
                        errorMessage.includes('too many requests') || 
                        errorMessage.includes('quota exceeded') ||
                        errorMessage.includes('overloaded') ||
                        error.status === 429;

    if (isRateLimit) {
      return corsResponse(429, {
        error: 'The AI service is currently at its limit (Rate Limited). Please wait 1-2 minutes for the quota to reset.',
        isRateLimit: true
      });
    }

    return corsResponse(500, {
      error: 'The AI service encountered an unexpected error.',
      details: error.message
    });
  }
};
