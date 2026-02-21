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
        const errorMsg = result.error || 'AI analysis could not be completed.';
        const err = new Error(errorMsg) as any;
        err.status = response.status;
        err.isRateLimit = result.isRateLimit || response.status === 429;
        throw err;
    }

    return {
      ...result,
      analyzedBy: analyzedBy || 'automated',
      analyzedByUser,
      analyzedAt: Date.now(),
    } as AIAnalysisResult;

  } catch (error: any) {
    console.error("Error analyzing bug report:", error);
    // Re-throw so the caller can catch it
    throw error;
  }
};