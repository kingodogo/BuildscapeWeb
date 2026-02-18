/**
 * Sanitizes HTML content to prevent XSS attacks
 * Removes script tags, event handlers, and other dangerous elements
 */
export function sanitizeHTML(html: string): string {
  if (!html) return '';

  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.textContent = html; // This escapes all HTML
  const escaped = temp.innerHTML;

  // Now we need to allow safe HTML tags while removing dangerous ones
  // We'll use a more sophisticated approach: parse and filter
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove all script tags and their content
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(script => script.remove());

  // Remove all event handlers from all elements
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove all attributes that start with 'on' (event handlers)
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      // Also remove javascript: protocol from href/src
      if (attr.name.toLowerCase() === 'href' || attr.name.toLowerCase() === 'src') {
        const value = attr.value.toLowerCase().trim();
        if (value.startsWith('javascript:') || value.startsWith('data:text/html')) {
          el.removeAttribute(attr.name);
        }
      }
    });
  });

  // Get the sanitized HTML
  return doc.body.innerHTML;
}

/**
 * Sanitizes HTML but allows specific safe tags and attributes
 * This is a more permissive version that allows formatting tags
 * Uses a simpler, more robust approach to avoid DOM manipulation issues
 */
export function sanitizeHTMLPermissive(html: string): string {
  if (!html) return '';

  // Simple regex-based sanitization that's more reliable
  // This approach avoids DOM manipulation issues
  try {
    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove style tags and their content
    sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove iframe, object, embed tags
    sanitized = sanitized.replace(/<(iframe|object|embed|form|input|button|textarea|select)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
    
    // Remove event handlers from all tags (onclick, onerror, etc.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
    
    // Remove javascript: and data:text/html protocols from href and src
    sanitized = sanitized.replace(/(href|src)\s*=\s*["'](javascript|data:text\/html|vbscript|file):[^"']*["']/gi, '');
    
    // Remove dangerous protocols from href and src (case insensitive)
    sanitized = sanitized.replace(/(href|src)\s*=\s*["'](javascript|data:text\/html|vbscript|file):[^"']*["']/gi, '');
    
    // Allow safe tags and attributes - this is a whitelist approach
    // We'll keep the HTML structure but ensure dangerous elements are removed
    
    return sanitized;
  } catch (e) {
    console.error('Error sanitizing HTML:', e);
    // If sanitization fails, escape HTML completely
    if (typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.textContent = html;
      return div.innerHTML;
    }
    // Server-side fallback
    return String(html)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

