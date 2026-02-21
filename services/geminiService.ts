import { AIAnalysisResult } from "../types";
import { supabase } from "../lib/supabase";

export const analyzeBugReport = async (
  title: string,
  description: string,
  steps: string,
  mcVersions: string[],
  analyzedBy?: 'admin' | 'automated',
  analyzedByUser?: string
): Promise<AIAnalysisResult> => {
  try {
    // Get the current session token to authenticate the request
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title, description, steps, mcVersions }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        qualityScore: 0,
        suggestions: [result.error || 'AI analysis is currently unavailable.'],
        severityAssessment: 'Low',
        summary: result.error || 'AI analysis could not be completed.',
        analyzedBy: analyzedBy || 'automated',
        analyzedByUser,
        analyzedAt: Date.now(),
      };
    }

    return {
      ...result,
      analyzedBy: analyzedBy || 'automated',
      analyzedByUser,
      analyzedAt: Date.now(),
    } as AIAnalysisResult;

  } catch (error) {
    console.error("Error analyzing bug report:", error);
    return {
      qualityScore: 0,
      suggestions: ["Please check your connection and try again."],
      severityAssessment: "Medium",
      summary: "Could not reach the AI service. Please try again.",
      analyzedBy: analyzedBy || 'automated',
      analyzedByUser,
      analyzedAt: Date.now(),
    };
  }
};