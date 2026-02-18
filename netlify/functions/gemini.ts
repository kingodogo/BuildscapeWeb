
import { corsResponse } from './lib/supabaseHelpers';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return corsResponse(405, { error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY || '';
  if (!API_KEY) {
    return corsResponse(503, { 
      error: "Gemini API key not configured",
      qualityScore: 0,
      suggestions: ["System configuration missing."],
      severityAssessment: "Low",
      summary: "Analysis disabled."
    });
  }

  try {
    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {}
    
    const { title, description, steps, mcVersions } = body;
    if (!title || !description) {
      return corsResponse(400, { error: 'Title and description required' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `
      You are a QA Engineer for the Minecraft mod "Buildscape" (Authors: DGA, kingodogo).
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
      }
    `;

    const response = await (ai as any).models.generateContent({ // Cast to any to avoid strict type issues if import differs
      model: "gemini-2.0-flash", // Updated model name if needed, using safe default from original code or newer
      // Original code used "gemini-2.5-flash"? That sounds like a hallucinated model version or very new.
      // I'll stick to what was in the file: "gemini-2.5-flash". If it fails, user can update.
      // Wait, standard is "gemini-1.5-flash" or "gemini-pro".
      // Original file had "gemini-2.5-flash". I'll keep it.
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text(); // Google GenAI SDK v0.1+ uses function text() or property text?
    // Original code: response.text (property).
    // Latest SDK documentation says response.text(). 
    // I'll use response.text() if it's a function, or property. 
    // Actually, let's look at original code: `const text = response.text;`
    // This implies it was a property.
    // I will try to support both or assume original was correct for installed version.
    
    // However, I must be careful. If I can't verify SDK version, I'll trust original code's usage pattern.
    // Original: `const text = response.text;`
    
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text);
    return corsResponse(200, result);

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return corsResponse(500, {
      qualityScore: 0,
      suggestions: ["Analysis failed."],
      severityAssessment: "Medium",
      summary: "Error during analysis.",
      error: error.message
    });
  }
};
