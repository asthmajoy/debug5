import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Copy, Check, Code } from 'lucide-react';

const ProposalQuillEditor = ({ 
  initialValue = '', 
  onChange, 
  height = '300px',
  placeholder = 'Describe your proposal in detail...',
  readOnly = false,
  isSignalingProposal = false,
  darkMode = false,
  onCreateProposal = null
}) => {
  const quillRef = useRef(null);
  
  // Add CSS class based on dark mode
  const editorClassName = darkMode 
    ? 'quill-editor-dark' 
    : 'quill-editor-light';

  const [editorValue, setEditorValue] = useState(initialValue);
  const [copied, setCopied] = useState(false);
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [customHtml, setCustomHtml] = useState('');

  // Update editorValue when initialValue changes from parent
  useEffect(() => {
    setEditorValue(initialValue);
  }, [initialValue]);

  const handleEditorChange = (content) => {
    setEditorValue(content);
    if (onChange) {
      // Extract plain text content for the parent component
      const tempEl = document.createElement('div');
      tempEl.innerHTML = content;
      const plainText = tempEl.textContent || tempEl.innerText || '';
      onChange(content, plainText);
    }
  };

  const copyToClipboard = () => {
    // Get plain text content
    const tempEl = document.createElement('div');
    tempEl.innerHTML = editorValue;
    const plainText = tempEl.textContent || tempEl.innerText || '';
    
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const toggleHtmlModal = () => {
    setShowHtmlModal(!showHtmlModal);
  };
  
  const insertCustomHtml = () => {
    // Validate HTML to only include allowed tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = customHtml;
    
    // Filter out disallowed elements
    const allowedTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'B', 'I', 'A'];
    const nodes = tempDiv.querySelectorAll('*');
    
    Array.from(nodes).forEach(node => {
      if (!allowedTags.includes(node.tagName)) {
        // Replace disallowed element with its text content
        node.outerHTML = node.textContent;
      }
    });
    
    // Get the sanitized HTML
    const sanitizedHtml = tempDiv.innerHTML;
    
    // Insert the sanitized HTML into the editor
    const editor = quillRef.current.getEditor();
    const range = editor.getSelection();
    const index = range ? range.index : editor.getLength();
    
    editor.clipboard.dangerouslyPasteHTML(index, sanitizedHtml);
    
    // Close the modal and clear the input
    setShowHtmlModal(false);
    setCustomHtml('');
  };

  // Special placeholder for signaling proposals
  const signalingPlaceholder = isSignalingProposal 
    ? "Describe your community vote proposal in detail, please include:\n• The specific question or topic for community consideration\n• Background information and context\n• Options or perspectives to consider\n• Expected outcome of this signaling proposal"
    : placeholder;

  // Quill editor modules configuration - UPDATED TO ONLY ALLOW SPECIFIED TAGS
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic'],
      ['link'],
      ['clean']
    ]
  };

  // Quill editor formats configuration - UPDATED TO ONLY ALLOW SPECIFIED TAGS
  const formats = [
    'header',
    'bold', 'italic',
    'link'
  ];

  // Header background and text styles
  const headerBgStyle = darkMode 
    ? { backgroundColor: '#2d2d2d' }  // Dark background for header
    : { backgroundColor: '#f9fafb' }; // Light gray background for header

  // Mode label styles - Invert text color based on dark mode
  const modeLabelStyle = darkMode
    ? { color: '#ffffff', fontWeight: '600' }  // Light text for dark mode
    : { color: '#000000', fontWeight: '600' }; // Dark text for light mode

  return (
    <div className={editorClassName}>
      <div className="proposal-editor-container border border-gray-300 rounded-md overflow-hidden">
        {/* Editor Toolbar - With Dark Background */}
        <div className="flex justify-between items-center px-3 py-2 border-b border-gray-300" 
            style={headerBgStyle}>
          <div className="flex items-center space-x-2">
            {isSignalingProposal && (
              <span className="">
               
              </span>
            )}
            <h3 className="text-sm font-medium editor-mode-label" style={modeLabelStyle}>
              Edit Mode
            </h3>
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={copyToClipboard}
              className={`p-1 rounded-full transition-colors ${darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title="Copy content"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={toggleHtmlModal}
              className={`p-1 rounded-full transition-colors ${darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title="Insert custom HTML"
              disabled={readOnly}
            >
              <Code className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Editor with allowed HTML info */}
        <div style={{ minHeight: height }}>
          <div className="quill-editor-container" style={{ minHeight: height }}>
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={editorValue}
              onChange={handleEditorChange}
              modules={modules}
              formats={formats}
              placeholder={signalingPlaceholder}
              readOnly={readOnly}
            />
            <div className="p-2 text-xs text-gray-500 border-t border-gray-200">
              Allowed HTML tags: <b>h1-h6</b> (headings), <b>p</b> (paragraphs), <b>b</b> (bold), <b>i</b> (italic), <b>a</b> (links)
            </div>
          </div>
        </div>

        {/* Information footer for signaling proposals */}
        {isSignalingProposal && (
          <div>
           
          </div>
        )}
      </div>
      
      {/* HTML Injection Modal */}
      {showHtmlModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${darkMode ? 'bg-black bg-opacity-70' : 'bg-gray-500 bg-opacity-50'}`}>
          <div className={`relative w-full max-w-md p-4 mx-auto rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="mb-4">
              <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Insert Custom HTML
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                Only allowed tags (h1-h6, p, b, i, a) will be inserted.
              </p>
            </div>
            
            <textarea
              value={customHtml}
              onChange={(e) => setCustomHtml(e.target.value)}
              className={`w-full h-40 p-2 mb-4 border rounded-md ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
              placeholder="<h1>Title</h1><p>Content with <b>bold</b> and <i>italic</i> text and <a href='#'>links</a></p>"
            />
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowHtmlModal(false)}
                className={`px-3 py-1.5 text-sm rounded-md ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertCustomHtml}
                className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add custom styles for dark mode, placeholder color, and SCROLLING */}
      <style jsx>{`
        /* Base editor styles */
        .ql-editor p {
          margin-bottom: 10px;
        }
        
        /* Make editor scrollable when content exceeds height */
        .quill-editor-container {
          display: flex;
          flex-direction: column;
        }
        
        .quill-editor-container .ql-container {
          overflow-y: auto;
        }
        
        /* Set the editor to expand normally but scroll when content exceeds */
        .ql-editor {
          min-height: 230px; /* Give enough room for normal editing */
          max-height: 65vh; /* Limit maximum height and enable scrolling */
          overflow-y: auto;
        }
        
        /* Dark mode styles */
        .quill-editor-dark .ql-container {
          background-color: #1e1e1e;
          color: #ffffff;
          border-color: #444;
        }
        
        .quill-editor-dark .ql-toolbar {
          background-color: #2d2d2d;
          border-color: #444;
          color: #ffffff;
        }
        
        .quill-editor-dark .ql-editor {
          color: #ffffff;
        }
        
        /* Invert placeholder text color for dark mode */
        .quill-editor-dark .ql-editor.ql-blank::before {
          color: #cccccc !important;
          font-style: italic;
        }
        
        .quill-editor-dark .ql-stroke {
          stroke: #e0e0e0;
        }
        
        .quill-editor-dark .ql-fill {
          fill: #e0e0e0;
        }
        
        .quill-editor-dark .ql-picker {
          color: #e0e0e0;
        }
        
        .quill-editor-dark .ql-picker-options {
          background-color: #2d2d2d;
          border-color: #444;
        }
        
        .quill-editor-dark .ql-tooltip {
          background-color: #2d2d2d;
          border-color: #444;
          color: #e0e0e0;
        }
        
        /* Footer text color for dark mode */
        .quill-editor-dark .text-gray-500 {
          color: #aaaaaa;
        }
        
        .quill-editor-dark .border-gray-200 {
          border-color: #444;
        }
      `}</style>
    </div>
  );
};

// Helper function for creating a proposal with HTML injection
export const createProposalWithHtml = (description, proposalType, target, callData, amount, recipient, externalToken, newThreshold, newQuorum, newVotingDuration, newTimelockDelay) => {
  // You can modify this function to inject any HTML you want before submitting
  // For example, adding metadata, signature, timestamps, etc.
  
  // Inject proposal metadata as HTML
  const timestamp = new Date().toISOString();
  const proposalTypeNames = [
    'General', 'FundTransfer', 'ExternalERC20Transfer', 'GovernanceChange'
  ];
  
  const metadataHtml = `
<h2>Proposal Metadata</h2>
<p><b>Type:</b> ${proposalTypeNames[proposalType] || 'Unknown'}</p>
<p><b>Created:</b> ${timestamp}</p>
`;

  // Combine with original description
  const enhancedDescription = metadataHtml + description;
  
  // This would call your actual contract function
  // For now, we're just returning the enhanced description
  return {
    description: enhancedDescription,
    proposalType,
    target,
    callData,
    amount,
    recipient,
    externalToken,
    newThreshold,
    newQuorum,
    newVotingDuration,
    newTimelockDelay
  };
};

export default ProposalQuillEditor;