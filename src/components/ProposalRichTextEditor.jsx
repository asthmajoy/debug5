import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Eye, Edit, Copy, Check } from 'lucide-react';

// Your API key
const API_KEY = 'i2s2s44r71l8dnc5seeaz1ipdw1smz5yaq9u2enfl4c4tr38';

const ProposalRichTextEditor = ({ 
  initialValue = '', 
  onChange, 
  height = '300px',
  placeholder = 'Describe your proposal in detail...',
  readOnly = false,
  isSignalingProposal = false,
  darkMode = false // Add this prop with a default value
}) => {
  // Add this CSS class based on dark mode
  const editorClassName = darkMode 
    ? 'rich-text-editor-dark' 
    : 'rich-text-editor-light';
  const [editorValue, setEditorValue] = useState(initialValue);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editorError, setEditorError] = useState(false);
  const editorRef = useRef(null);

  // Update editorValue when initialValue changes from parent
  useEffect(() => {
    setEditorValue(initialValue);
  }, [initialValue]);

  const handleEditorChange = (content, editor) => {
    setEditorValue(content);
    if (onChange) {
      // Extract plain text content for the parent component
      const plainText = editor.getContent({ format: 'text' });
      onChange(content, plainText);
    }
  };

  const togglePreview = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  const copyToClipboard = () => {
    // Get plain text content
    let plainText;
    if (editorRef.current) {
      plainText = editorRef.current.getContent({ format: 'text' });
    } else {
      // Fallback if editor not available
      const tempEl = document.createElement('div');
      tempEl.innerHTML = editorValue;
      plainText = tempEl.textContent || tempEl.innerText || '';
    }
    
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Special placeholder for signaling proposals
  const signalingPlaceholder = isSignalingProposal 
    ? "Describe your signaling proposal in detail. Include:\n• The specific question or topic for community consideration\n• Background information and context\n• Options or perspectives to consider\n• Expected outcome of this signaling proposal"
    : placeholder;

  // Simple TinyMCE editor configuration with heading support
  const editorInit = {
    height,
    menubar: 'format',
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount'
    ],
    toolbar: 'formatselect | bold italic underline | ' +
      'bullist numlist | link | removeformat',
    formats: {
      h1: { block: 'h1' },
      h2: { block: 'h2' },
      h3: { block: 'h3' }
    },
    block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3',
    content_style: `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; }
      h1 { font-size: 2em; font-weight: bold; }
      h2 { font-size: 1.5em; font-weight: bold; }
      h3 { font-size: 1.17em; font-weight: bold; }
    `,
    placeholder: signalingPlaceholder,
    branding: false,
    promotion: false
  };

  // Fallback textarea for when TinyMCE fails to load
  const renderFallbackEditor = () => (
    <div className="p-2">
      <div className="text-sm text-red-600 mb-2">
        Rich text editor failed to load. Using basic text editor instead.
      </div>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-md"
        style={{ 
          minHeight: height, 
          resize: 'vertical'
        }}
        value={editorValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setEditorValue(newValue);
          if (onChange) {
            onChange(newValue, newValue);
          }
        }}
        placeholder={signalingPlaceholder}
        readOnly={readOnly}
      />
    </div>
  );

  return (
    <div className={editorClassName}>

    <div className="proposal-editor-container border border-gray-300 rounded-md overflow-hidden">
      {/* Editor Toolbar */}
      <div className="flex justify-between items-center bg-gray-50 px-3 py-2 border-b border-gray-300">
        <div className="flex items-center space-x-2">
          {isSignalingProposal && (
            <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-md text-xs font-medium">
              Signaling Proposal
            </span>
          )}
          <h3 className="text-sm font-medium text-gray-700">
            {isPreviewMode ? 'Preview Mode' : 'Edit Mode'}
          </h3>
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="Copy content"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={togglePreview}
            className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
            title={isPreviewMode ? "Switch to edit mode" : "Switch to preview mode"}
          >
            {isPreviewMode ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Simple Heading Buttons */}
      {!isPreviewMode && !editorError && (
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-300 flex flex-wrap gap-2">
          <button 
            type="button"
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-base font-bold"
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.execCommand('mceToggleFormat', false, 'h1');
              }
            }}
          >
            Heading 1
          </button>
          <button 
            type="button"
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-base font-semibold"
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.execCommand('mceToggleFormat', false, 'h2');
              }
            }}
          >
            Heading 2
          </button>
          <button 
            type="button"
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-semibold"
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.execCommand('mceToggleFormat', false, 'h3');
              }
            }}
          >
            Heading 3
          </button>
        </div>
      )}

      {/* Editor or Preview */}
      <div style={{ minHeight: height }}>
        {isPreviewMode ? (
          <div 
            className="p-4 overflow-y-auto bg-white prose"
            style={{ minHeight: height }}
            dangerouslySetInnerHTML={{ __html: editorValue }}
          />
        ) : editorError ? (
          renderFallbackEditor()
        ) : (
          <Editor
            tinymceScriptSrc={`https://cdn.tiny.cloud/1/${API_KEY}/tinymce/6/tinymce.min.js`}
            onInit={(evt, editor) => {
              editorRef.current = editor;
            }}
            value={editorValue}
            onEditorChange={handleEditorChange}
            init={editorInit}
            disabled={readOnly}
            onError={(err) => {
              console.error("TinyMCE failed to initialize:", err);
              setEditorError(true);
            }}
          />
        )}
      </div>

      {/* Information footer for signaling proposals */}
      {isSignalingProposal && (
        <div className="bg-indigo-50 p-3 text-sm text-indigo-700 border-t border-indigo-100">
          <p>
            Signaling proposals are used for community discussion and polling without executing on-chain actions.
            Be clear about what you're asking the community to signal on.
          </p>
        </div>
      )}
    </div>
    </div>

  );
};

export default ProposalRichTextEditor;