import { AIAnalysisResult } from "../types";

export const analyzeBugReport = async (
  title: string,
  description: string,
  steps: string,
  mcVersions: string[],
  analyzedBy?: 'admin' | 'automated',
  analyzedByUser?: string
): Promise<AIAnalysisResult> => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        description,
        steps,
        mcVersions,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error && !result.qualityScore) {
      return {
        qualityScore: 0,
        suggestions: [result.suggestions?.[0] || "System configuration missing. Analysis unavailable."],
        severityAssessment: result.severityAssessment || "Low",
        summary: result.summary || "System analysis is currently disabled.",
        analyzedBy: analyzedBy || 'automated',
        analyzedByUser: analyzedByUser,
        analyzedAt: Date.now(),
      };
    }

    return {
      ...result,
      analyzedBy: analyzedBy || 'automated',
      analyzedByUser: analyzedByUser,
      analyzedAt: Date.now(),
    } as AIAnalysisResult;
  } catch (error) {
    console.error("Error analyzing bug report:", error);
    return {
      qualityScore: 0,
      suggestions: ["Connection error. Please try again later."],
      severityAssessment: "Medium",
      summary: "Analysis failed due to a connection error.",
      analyzedBy: analyzedBy || 'automated',
      analyzedByUser: analyzedByUser,
      analyzedAt: Date.now(),
    };
  }
};