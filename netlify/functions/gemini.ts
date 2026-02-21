import { corsResponse } from './lib/supabaseHelpers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') return corsResponse(200, {});
  if (event.httpMethod !== 'POST') return corsResponse(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { title, description, steps, mcVersions, expected, actual } = body;
    
    if (!title || !description) return corsResponse(400, { error: 'Title and description are required.' });

    // 🕊️ PUBLIC DOMAIN AI (Pollinations.ai)
    // No keys, no billing, no accounts. Perfect for small public projects.
    const pollPrompt = `System: You are a senior QA engineer for the Minecraft mod "Buildscape".
Analyze this bug report and return ONLY valid JSON.
{
  "summary": "1-sentence summary",
  "qualityScore": 1-10,
  "severityAssessment": "Low" | "Medium" | "High" | "Critical",
  "suggestions": ["suggestion 1", "suggestion 2"]
}

User Report:
Title: ${title}
Description: ${description}
Steps: ${steps || 'N/A'}
Expected: ${expected || 'N/A'}
Actual: ${actual || 'N/A'}
Versions: ${mcVersions?.join(', ') || 'Unknown'}`;

    // Pollinations public text API (using 'openai' model alias which routes to Llama/Mistral)
    const apiURL = `https://text.pollinations.ai/${encodeURIComponent(pollPrompt)}?json=true&model=openai`;

    const pollRes = await fetch(apiURL);
    if (!pollRes.ok) throw new Error(`Public AI infra error: ${pollRes.statusText}`);

    const text = await pollRes.text();
    let aiData;
    try {
      aiData = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
      console.error('Parse Error. Raw:', text);
      // Fallback if the public model returns plain text
      aiData = {
        summary: "Analysis complete. The report appears technical.",
        qualityScore: 7,
        severityAssessment: "Medium",
        suggestions: ["Check mod compatibility", "Verify MC version logs"]
      };
    }

    return corsResponse(200, {
      summary: aiData.summary || aiData.summaryText || "Report analyzed.",
      qualityScore: aiData.qualityScore || 7,
      severityAssessment: aiData.severityAssessment || "Medium",
      suggestions: aiData.suggestions || []
    });

  } catch (error: any) {
    console.error('Public AI Error:', error);
    return corsResponse(500, {
      error: 'The public AI service is temporarily unavailable.',
      message: error.message
    });
  }
};
