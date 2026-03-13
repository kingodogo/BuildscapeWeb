import { corsResponse, requireAdmin } from './lib/supabaseHelpers';

export const handler = async (event: any, context: any) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return corsResponse(405, { error: 'Method not allowed' });
  }

  try {
    const { authorized, response, profile } = await requireAdmin(event);
    if (!authorized) return response;
    
    const role = profile?.role?.toLowerCase();
    if (role !== 'admin' && role !== 'owner') {
        return corsResponse(403, { error: 'Administrative privileges required for AI features.' });
    }

    const API_KEY = process.env.GEMINI_API_KEY || '';
  
    if (!API_KEY) {
        return corsResponse(503, { error: "Gemini API key not configured" });
    }

    const jsonBody = JSON.parse(event.body || '{}');
    const { title, description, descriptionType, categories, subcategories, mcVersions, modVersions, details } = jsonBody;

    if (!title || !description) {
      return corsResponse(400, { error: 'Title and description are required' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const categoryInfo = categories && categories.length > 0 ? `Categories: ${categories.join(', ')}` : '';
    const subcategoryInfo = subcategories && subcategories.length > 0 ? `Subcategories: ${subcategories.join(', ')}` : '';
    const mcVersionInfo = mcVersions && mcVersions.length > 0 ? `Minecraft Versions: ${mcVersions.join(', ')}` : '';
    const modVersionInfo = modVersions && modVersions.length > 0 ? `Mod Versions: ${modVersions.join(', ')}` : '';
    const existingDetails = details && Array.isArray(details) && details.length > 0 ? `Existing detail points:\n${details.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}` : '';

    const prompt = `You are a technical writer for the Minecraft mod "Buildscape" (Authors: DGA, kingodogo).

Review and improve the following wiki feature entry. Be conservative - only fix errors, improve formatting, and add essential information when needed.

Current Information:
${categoryInfo ? `- ${categoryInfo}\n` : ''}${subcategoryInfo ? `- ${subcategoryInfo}\n` : ''}${mcVersionInfo ? `- ${mcVersionInfo}\n` : ''}${modVersionInfo ? `- ${modVersionInfo}\n` : ''}

Current Title: ${title}
Current Description (${descriptionType || 'markdown'} format): ${description}
${existingDetails ? `\n${existingDetails}\n` : ''}

Requirements:
1. Enhanced Title: Only improve if there are grammatical errors or clarity issues. Keep it concise (max 60 characters). If the title is already good, keep it mostly the same with minor improvements only.
2. Enhanced Description: 
   - Fix formatting errors, grammar, and spelling mistakes
   - Improve markdown/HTML structure if needed (proper headers, lists, bold text)
   - Keep the same overall structure and content
   - Only add essential information if something is clearly missing
3. Enhanced Details: If detail points are provided, improve them similarly - fix grammar, improve clarity, but keep the same information.

Return a JSON object with:
{
  "enhancedTitle": "improved title",
  "enhancedDescription": "improved description",
  "enhancedDetails": ["improved detail 1", "improved detail 2", ...],
  "suggestedType": "text" | "html" | "markdown" (recommend the best format)
}`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt
    });

    const responseText = result.text || '{}';
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    return corsResponse(200, {
      enhancedTitle: parsedResponse.enhancedTitle || title,
      enhancedDescription: parsedResponse.enhancedDescription || description,
      enhancedDetails: parsedResponse.enhancedDetails || details || [],
      suggestedType: parsedResponse.suggestedType || descriptionType || 'markdown'
    });
  } catch (error: any) {
    console.error('Wiki enhancement error:', error);
    return corsResponse(500, {
      error: error.message || 'Failed to enhance wiki entry'
    });
  }
};

