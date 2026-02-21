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
      qualityScore: 0,
      suggestions: ['AI analysis is currently unavailable.'],
      severityAssessment: 'Low',
      summary: 'AI analysis is not enabled on this server.',
    });
  }

  try {
    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) { /* ignore */ }

    const { title, description, steps, mcVersions } = body;
    if (!title || !description) return corsResponse(400, { error: 'Title and description are required.' });

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `You are a QA Engineer for the Minecraft mod "Buildscape" (Authors: DGA, kingodogo).
Analyze the following bug report for Minecraft Versions: ${mcVersions?.join(', ') || 'Unknown'}.

Title: ${title}
Description: ${description}
Steps to Reproduce: ${steps || 'Not provided'}

Provide a JSON response with the following schema:
{
  "qualityScore": number (1-10),
  "suggestions": [string],
  "severityAssessment": "Low" | "Medium" | "High" | "Critical",
  "summary": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    // response.text is a getter (string property), not a function
    const text = response.text;
    if (!text) throw new Error('No response from AI');

    const result = JSON.parse(text);
    return corsResponse(200, result);

  } catch (error: any) {
    console.error('Gemini Error:', error);
    return corsResponse(500, {
      qualityScore: 0,
      suggestions: ['Please try again in a moment.'],
      severityAssessment: 'Medium',
      summary: 'The AI analysis could not be completed. Please try again.',
    });
  }
};
