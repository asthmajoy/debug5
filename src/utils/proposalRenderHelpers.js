// src/utils/proposalRenderHelpers.js
// Helper functions for rendering proposal content including HTML

/**
 * Safely truncates HTML content to specified length
 * @param {string} html - HTML content to truncate
 * @param {number} maxLength - Maximum length for truncated content
 * @returns {string} Truncated HTML content
 */
export function safelyTruncateHtml(html, maxLength = 200) {
  if (!html) return '';
  
  try {
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Get the text content
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    // If the text is already short enough, return the original HTML
    if (textContent.length <= maxLength) {
      return html;
    }
    
    // Otherwise return truncated text with ellipsis
    return textContent.substring(0, maxLength) + '...';
  } catch (error) {
    console.warn("Error truncating HTML:", error);
    // Fallback for safety
    return html.substring(0, maxLength) + '...';
  }
}

/**
 * Extracts HTML content from a proposal description
 * @param {string} rawDescription - Raw proposal description text
 * @returns {Object} Object containing parsed title, description, and HTML
 */
export function parseProposalDescription(rawDescription) {
  if (!rawDescription) {
    return { 
      title: '', 
      description: '', 
      descriptionHtml: null,
      hasHtml: false 
    };
  }
  
  // Check for HTML marker
  const htmlMarkerIndex = rawDescription.indexOf('|||HTML:');
  
  if (htmlMarkerIndex !== -1) {
    // Extract HTML content
    const htmlContent = rawDescription.substring(htmlMarkerIndex + 8);
    
    // Extract the plain text portion
    const plainTextPortion = rawDescription.substring(0, htmlMarkerIndex).trim();
    
    // The title is typically the first line
    const firstLineBreak = plainTextPortion.indexOf('\n');
    const title = firstLineBreak !== -1 
      ? plainTextPortion.substring(0, firstLineBreak).trim() 
      : plainTextPortion.trim();
    
    // The description is everything after the first line, but before the HTML marker
    const description = firstLineBreak !== -1 
      ? plainTextPortion.substring(firstLineBreak).trim() 
      : '';
      
    return { 
      title, 
      description, 
      descriptionHtml: htmlContent,
      hasHtml: true 
    };
  }
  
  // If no HTML marker is found, handle it as plain text only
  const lines = rawDescription.split('\n');
  const title = lines[0] || '';
  const description = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';
  
  return { 
    title, 
    description, 
    descriptionHtml: null,
    hasHtml: false 
  };
}

/**
 * Renders proposal content based on type and format
 * @param {Object} proposal - The proposal object
 * @param {boolean} isExpanded - Whether the view is expanded
 * @returns {JSX.Element} Rendered proposal content
 */
export function renderProposalContent(proposal, isExpanded = false) {
  // Check if proposal has HTML content
  if (proposal.descriptionHtml || proposal.hasHtml) {
    if (isExpanded) {
      // Full HTML content for expanded view
      return (
        <div 
          className="prose max-w-none text-sm text-gray-700 mb-4 dark:prose-invert dark:text-gray-200"
          dangerouslySetInnerHTML={{ __html: proposal.descriptionHtml }}
        />
      );
    } else {
      // Truncated for collapsed view
      return (
        <div 
          className="text-sm text-gray-700 dark:text-gray-300 mb-2"
          dangerouslySetInnerHTML={{ __html: safelyTruncateHtml(proposal.descriptionHtml, 200) }}
        />
      );
    }
  }
  
  // For plain text proposals
  if (isExpanded) {
    return (
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
        {proposal.description || "No description available"}
      </p>
    );
  } else {
    const truncatedDesc = proposal.description 
      ? (proposal.description.length > 200 
          ? proposal.description.substring(0, 200) + '...' 
          : proposal.description)
      : "No description available";
    
    return (
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
        {truncatedDesc}
      </p>
    );
  }
}