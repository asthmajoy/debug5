import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Eye, Edit, Copy, Check } from 'lucide-react';
import hljs from 'highlight.js';


const ProposalQuillEditor = ({ 
  initialValue = '', 
  onChange, 
  height = '300px',
  placeholder = 'Describe your proposal in detail...',
  readOnly = false,
  isSignalingProposal = false,
  darkMode = false
}) => {
  // Add CSS class based on dark mode
  const editorClassName = darkMode 
    ? 'quill-editor-dark' 
    : 'quill-editor-light';

  const [editorValue, setEditorValue] = useState(initialValue);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const togglePreview = () => {
    setIsPreviewMode(!isPreviewMode);
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

  // Special placeholder for signaling proposals
  const signalingPlaceholder = isSignalingProposal 
    ? "Describe your community vote proposal in detail, please include:\n• The specific question or topic for community consideration\n• Background information and context\n• Options or perspectives to consider\n• Expected outcome of this signaling proposal"
    : placeholder;

    const isSyntaxAvailable = typeof window !== 'undefined' && window.hljs;

  // Quill editor modules configuration - UPDATED WITH COLORS
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      [{ 'color': [] }, { 'background': [] }], // Added color options
      ['link'],
      ['clean']
    ]
  };

  // Quill editor formats configuration - UPDATED WITH COLORS
  const formats = [
    'header',
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'color', 'background', // Added color formats
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
              {isPreviewMode ? 'Preview Mode' : 'Edit Mode'}
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
              onClick={togglePreview}
              className={`p-1 rounded-full transition-colors ${darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title={isPreviewMode ? "Switch to edit mode" : "Switch to preview mode"}
            >
              {isPreviewMode ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Editor or Preview - UPDATED WITH OVERFLOW SCROLLING */}
        <div style={{ minHeight: height }}>
          {isPreviewMode ? (
            <div 
              className="p-4 overflow-y-auto preview-content"
              style={{ 
                minHeight: height,
                color: darkMode ? '#e0e0e0' : 'inherit',
                backgroundColor: darkMode ? '#1e1e1e' : 'white'
              }}
              dangerouslySetInnerHTML={{ __html: editorValue }}
            />
          ) : (
            <div className="quill-editor-container" style={{ minHeight: height }}>
              <ReactQuill
                theme="snow"
                value={editorValue}
                onChange={handleEditorChange}
                modules={modules}
                formats={formats}
                placeholder={signalingPlaceholder}
                readOnly={readOnly}
              />
            </div>
          )}
        </div>

        {/* Information footer for signaling proposals */}
        {isSignalingProposal && (
          <div >
           
          </div>
        )}
      </div>
      
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
        
        /* Color picker styles for dark mode */
        .quill-editor-dark .ql-color .ql-picker-label,
        .quill-editor-dark .ql-background .ql-picker-label {
          padding: 0 4px;
        }
        
        .quill-editor-dark .ql-color .ql-picker-options,
        .quill-editor-dark .ql-background .ql-picker-options {
          padding: 3px 5px;
        }
        
        /* Make color swatches more visible in dark mode */
        .quill-editor-dark .ql-color-picker .ql-picker-item,
        .quill-editor-dark .ql-background-picker .ql-picker-item {
          border: 1px solid #444;
        }
      `}</style>
    </div>
  );
};

export default ProposalQuillEditor;