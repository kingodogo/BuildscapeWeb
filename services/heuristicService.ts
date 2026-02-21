import { BugReport, AIAnalysisResult } from "../types";

/**
 * A local, rule-based analysis engine that provides quality feedback 
 * without requiring an external AI API key.
 */
export const performHeuristicAnalysis = (
  title: string,
  description: string,
  steps: string,
  mcVersions: string[],
  expected?: string,
  actual?: string
): AIAnalysisResult => {
  const suggestions: string[] = [];
  let score = 10;

  // 1. Title Check
  if (title.length < 10) {
    suggestions.push("Title is very short. Try adding more detail about the specific issue.");
    score -= 1;
  }
  if (!/(\w+)\s(\w+)/.test(title)) {
    suggestions.push("Title should be a descriptive sentence, not just one or two words.");
    score -= 1;
  }

  // 2. Description Check
  if (description.length < 30) {
    suggestions.push("Description is a bit brief. Adding more context (when/where it happens) helps developers a lot.");
    score -= 2;
  }

  // 3. Steps Check
  const stepLines = (steps || "").split('\n').filter(l => l.trim().length > 0);
  if (stepLines.length < 2) {
    suggestions.push("Providing step-by-step instructions on how to replicate the bug is highly recommended.");
    score -= 2;
  }

  // 4. Advanced Info (Expected/Actual)
  if (!expected || expected.length < 5) {
    suggestions.push("Specifying 'Expected Behavior' helps us understand what is broken.");
    score -= 1;
  }
  if (!actual || actual.length < 5) {
    suggestions.push("Clearly stating the 'Actual Behavior' (what happened instead) is useful.");
    score -= 1;
  }

  // 5. Severity Guess (Keyword-based)
  let severity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  const text = (title + description + actual).toLowerCase();
  if (text.includes('crash') || text.includes('freeze') || text.includes('bsod') || text.includes('corrupt')) {
    severity = 'High';
  } else if (text.includes('broken') || text.includes('gameplay') || text.includes('cannot')) {
    severity = 'Medium';
  }

  // 6. Summary Generation
  const summary = score >= 8 
    ? "This is a well-documented report that provides clear context for troubleshooting." 
    : "This report provides basic information but could be improved with more descriptive details and reproduction steps.";

  if (suggestions.length === 0) {
    suggestions.push("Report looks great. No immediate improvements suggested.");
  }

  return {
    qualityScore: Math.max(1, score),
    suggestions: suggestions.slice(0, 4),
    severityAssessment: severity,
    summary,
    analyzedBy: 'automated',
    analyzedAt: Date.now()
  };
};
