import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Copy, Check, Code, FileText, Tag } from 'lucide-react';

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
  const [showHtmlTemplateModal, setShowHtmlTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showJurisdictionModal, setShowJurisdictionModal] = useState(false);
  const [jurisdictionInfo, setJurisdictionInfo] = useState({
    jurisdiction: '',
    caseType: '',
    legalCode: '',
    applicableLaw: '',
    enforcementAgency: ''
  });

  // HTML templates with Legal Aid DAO focused designs
  const htmlTemplates = {
    basic: `<div class="modern-template">
  <h1>Legal Aid Proposal</h1>
  <div class="template-subtitle">A proposal to fund legal aid for community members</div>
  
  <div class="template-section">
    <h2>Case Background</h2>
    <p>Provide context about the legal issue requiring funding. Include details about the client's situation, the legal challenge they're facing, and why DAO assistance is needed.</p>
  </div>
  
  <div class="template-section">
    <h2>Legal Strategy</h2>
    <p>Describe the proposed legal approach, including key legal arguments, relevant precedents, and expected timeline for the case. Be specific about legal actions that will be taken.</p>
  </div>
  
  <div class="template-section">
    <h2>Resource Requirements</h2>
    <p>Detail the specific resources needed to provide this legal assistance.</p>
    
    <h3>Budget</h3>
    <p>Provide an itemized budget including attorney fees, court costs, filing fees, and any other anticipated expenses.</p>
    
    <h3>Timeline</h3>
    <p>Outline key legal milestones and when you expect them to occur.</p>
  </div>
  
  <div class="template-section">
    <h2>Community Benefit</h2>
    <p>Explain how this case aligns with the DAO's mission and how it will benefit both the client and the broader community. Will this case establish important precedent or protect consumer rights?</p>
  </div>
  
  <div class="template-section">
    <h2>Reporting Plan</h2>
    <p>Describe how you will provide updates to the DAO community through the companion forum, including frequency and types of information that will be shared.</p>
  </div>
</div>`,
    
    treasuryAllocation: `<div class="funds-template">
  <h1>Legal Aid Treasury Allocation Request</h1>
  <div class="template-subtitle">Request for DAO funds to support legal representation</div>
  
  <div class="funds-header">
    <p><b>Amount Requested:</b> [Amount] [Currency]</p>
    <p><b>Recipient Attorney/Firm:</b> [Name]</p>
    <p><b>Wallet Address:</b> [Wallet address]</p>
    <p><b>Case Type:</b> [Consumer Protection/Foreclosure Defense/Bankruptcy/Debt Issues/Other]</p>
  </div>
  
  <div class="template-section">
    <h2>Client Needs & Legal Context</h2>
    <p>Describe the specific legal challenge facing the client and why legal assistance is necessary. Explain the potential consequences if legal aid is not provided.</p>
  </div>
  
  <div class="template-section">
    <h2>Alignment with DAO Mission</h2>
    <p>Explain how this funding request aligns with the DAO's mission to provide access to justice in a fair and transparent way. How does this case serve the public interest?</p>
  </div>
  
  <div class="template-section">
    <h2>Budget Breakdown</h2>
    <p>Provide a detailed breakdown of how the funds will be spent:</p>
    <ul>
      <li><b>Attorney Hours:</b> [Hours] at [Rate] = [Amount]</li>
      <li><b>Court Filing Fees:</b> [Amount]</li>
      <li><b>Expert Witnesses/Consultants:</b> [Amount]</li>
      <li><b>Administrative Costs:</b> [Amount]</li>
      <li><b>Contingency (10%):</b> [Amount]</li>
    </ul>
  </div>
  
  <div class="template-section">
    <h2>Expected Outcomes</h2>
    <p>Describe the specific outcomes and benefits that will result from this legal representation. Include both client-specific outcomes and any broader impacts.</p>
  </div>
  
  <div class="template-section">
    <h2>Progress Reporting</h2>
    <p>Detail how and when you will provide updates to the DAO through the companion forum. Specify milestone reports and final case resolution reporting.</p>
  </div>
</div>`,
    
    legalAid: `<div class="legal-aid-template">
  
</div>`
  };

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

  const toggleHtmlTemplateModal = () => {
    setShowHtmlTemplateModal(!showHtmlTemplateModal);
  };

  const toggleJurisdictionModal = () => {
    setShowJurisdictionModal(!showJurisdictionModal);
  };
  
  const insertCustomHtml = () => {
    // Validate HTML to only include allowed tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = customHtml;
    
    // Filter out disallowed elements
    const allowedTags = ['H1', 'H2', 'H3', 'P', 'B', 'I', 'A', 'UL', 'OL', 'LI'];
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

  const insertHtmlTemplate = () => {
    if (!selectedTemplate || !htmlTemplates[selectedTemplate]) {
      return;
    }

    // Get the selected template
    const templateHtml = htmlTemplates[selectedTemplate];
    
    // Insert the template HTML at the current cursor position or at the beginning
    const editor = quillRef.current.getEditor();
    const range = editor.getSelection();
    const index = range ? range.index : 0;
    
    editor.clipboard.dangerouslyPasteHTML(index, templateHtml);
    
    // Close the modal and reset selection
    setShowHtmlTemplateModal(false);
    setSelectedTemplate('');
  };

  const addJurisdictionMetadata = () => {
    // Skip if jurisdiction is empty
    if (!jurisdictionInfo.jurisdiction.trim()) {
      alert('Jurisdiction is required');
      return;
    }

    // Format the jurisdiction metadata with improved styling
    const metadataHtml = `
<div class="legal-metadata">
  <div class="legal-metadata-header">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="legal-icon" width="16" height="16"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
    Legal Aid Case Information
  </div>
  <div class="legal-metadata-content">
    <p><b>Jurisdiction:</b> ${jurisdictionInfo.jurisdiction}</p>
    ${jurisdictionInfo.caseType ? `<p><b>Case Type:</b> ${jurisdictionInfo.caseType}</p>` : ''}
    ${jurisdictionInfo.legalCode ? `<p><b>Legal Code Reference:</b> ${jurisdictionInfo.legalCode}</p>` : ''}
    ${jurisdictionInfo.applicableLaw ? `<p><b>Applicable Law:</b> ${jurisdictionInfo.applicableLaw}</p>` : ''}
    ${jurisdictionInfo.enforcementAgency ? `<p><b>Enforcement Agency:</b> ${jurisdictionInfo.enforcementAgency}</p>` : ''}
  </div>
</div>
`;

    // Insert the metadata HTML into the editor
    const editor = quillRef.current.getEditor();
    const range = editor.getSelection();
    const index = range ? range.index : 0; // Insert at current position or beginning
    
    editor.clipboard.dangerouslyPasteHTML(index, metadataHtml);
    
    // Close the modal and reset form
    setShowJurisdictionModal(false);
    setJurisdictionInfo({
      jurisdiction: '',
      caseType: '',
      legalCode: '',
      applicableLaw: '',
      enforcementAgency: ''
    });
  };

  // Special placeholder for signaling proposals
  const signalingPlaceholder = isSignalingProposal 
    ? "Describe your community vote proposal in detail, please include:\n• The specific question or topic for community consideration\n• Background information and context\n• Options or perspectives to consider\n• Expected outcome of this signaling proposal"
    : placeholder;

  // Quill editor modules configuration with built-in list tools added
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }], // Added direct list buttons here
      ['link'],
      ['clean']
    ]
  };

  // Quill editor formats configuration - updated to include lists
  const formats = [
    'header',
    'bold', 'italic',
    'list', 'bullet',
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
            {/* HTML Templates button */}
            <button
              type="button"
              onClick={toggleHtmlTemplateModal}
              className={`p-1 rounded-full transition-colors ${darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title="Insert Template"
              disabled={readOnly}
            >
              <FileText className="h-4 w-4" />
            </button>
            
            {/* Jurisdiction button */}
            <button
              type="button"
              onClick={toggleJurisdictionModal}
              className={`p-1 rounded-full transition-colors ${darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title="Add Legal Jurisdiction"
              disabled={readOnly}
            >
              <Tag className="h-4 w-4" />
            </button>
            
            {/* Copy button */}
            <button
              type="button"
              onClick={copyToClipboard}
              className={`p-1 rounded-full transition-colors ${darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title="Copy content"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            
            {/* Custom HTML button */}
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
            {/* Updated allowed tags text to include lists */}
            <div className="p-2 text-xs text-gray-500 border-t border-gray-200">
              Allowed HTML tags: <b>h1-h3</b> (headings), <b>p</b> (paragraphs), <b>b</b> (bold), <b>i</b> (italic), <b>a</b> (links), <b>ul/ol/li</b> (lists)
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
              {/* Updated allowed tags message to include lists */}
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                Only allowed tags (h1-h3, p, b, i, a, ul, ol, li) will be inserted.
              </p>
            </div>
            
            <textarea
              value={customHtml}
              onChange={(e) => setCustomHtml(e.target.value)}
              className={`w-full h-40 p-2 mb-4 border rounded-md ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
              placeholder="<h1>Title</h1><p>Content with <b>bold</b> text</p><ul><li>List item 1</li><li>List item 2</li></ul>"
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

      {/* HTML Template Modal - Updated with modern designs */}
      {showHtmlTemplateModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${darkMode ? 'bg-black bg-opacity-70' : 'bg-gray-500 bg-opacity-50'}`}>
          <div className={`relative w-full max-w-md p-4 mx-auto rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="mb-4">
              <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Insert Template
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                Choose a template for your proposal
              </p>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className={`p-3 border rounded-md cursor-pointer transition-all ${selectedTemplate === 'basic' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-300'} ${darkMode && selectedTemplate === 'basic' ? 'bg-blue-900 border-blue-500' : darkMode ? 'border-gray-600 hover:border-blue-700' : ''}`}
                  onClick={() => setSelectedTemplate('basic')}>
                <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Basic Legal Aid Proposal</div>
                <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Standard structure for legal aid requests</div>
              </div>
              
              <div className={`p-3 border rounded-md cursor-pointer transition-all ${selectedTemplate === 'treasuryAllocation' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-300'} ${darkMode && selectedTemplate === 'treasuryAllocation' ? 'bg-blue-900 border-blue-500' : darkMode ? 'border-gray-600 hover:border-blue-700' : ''}`}
                  onClick={() => setSelectedTemplate('treasuryAllocation')}>
                <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Treasury Allocation</div>
                <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Request for DAO funds with detailed legal budget</div>
              </div>
              
             
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowHtmlTemplateModal(false)}
                className={`px-3 py-1.5 text-sm rounded-md ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertHtmlTemplate}
                disabled={!selectedTemplate}
                className={`px-3 py-1.5 text-sm text-white rounded-md ${selectedTemplate ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-400 cursor-not-allowed'}`}
              >
                Insert Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal Jurisdiction Modal - IMPROVED FORMATTING */}
      {showJurisdictionModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${darkMode ? 'bg-black bg-opacity-70' : 'bg-gray-500 bg-opacity-50'}`}>
          <div className={`relative w-full max-w-md p-4 mx-auto rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="mb-4">
              <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Add Legal Jurisdiction Metadata
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                Add jurisdiction information relevant to this legal aid case.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Jurisdiction *
                </label>
                <input
                  type="text"
                  value={jurisdictionInfo.jurisdiction}
                  onChange={(e) => setJurisdictionInfo({...jurisdictionInfo, jurisdiction: e.target.value})}
                  className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                  placeholder="e.g., California, Federal, International"
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Case Type
                </label>
                <select
                  value={jurisdictionInfo.caseType || ''}
                  onChange={(e) => setJurisdictionInfo({...jurisdictionInfo, caseType: e.target.value})}
                  className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                >
                  <option value="">Select Case Type</option>
                  <option value="Consumer Protection">Consumer Protection</option>
                  <option value="Foreclosure Defense">Foreclosure Defense</option>
                  <option value="Bankruptcy">Bankruptcy</option>
                  <option value="Debt Collection Defense">Debt Collection Defense</option>
                  <option value="Housing Rights">Housing Rights</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Legal Code Reference
                </label>
                <input
                  type="text"
                  value={jurisdictionInfo.legalCode}
                  onChange={(e) => setJurisdictionInfo({...jurisdictionInfo, legalCode: e.target.value})}
                  className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                  placeholder="e.g., 15 U.S.C. § 1692 (FDCPA), 12 CFR § 1024 (RESPA)"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Applicable Law/Precedent
                </label>
                <textarea
                  value={jurisdictionInfo.applicableLaw}
                  onChange={(e) => setJurisdictionInfo({...jurisdictionInfo, applicableLaw: e.target.value})}
                  className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                  placeholder="Brief description of relevant laws, cases, or precedents"
                  rows={3}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Enforcement Agency (if applicable)
                </label>
                <input
                  type="text"
                  value={jurisdictionInfo.enforcementAgency || ''}
                  onChange={(e) => setJurisdictionInfo({...jurisdictionInfo, enforcementAgency: e.target.value})}
                  className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                  placeholder="e.g., CFPB, FTC, State Attorney General"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-4">
              <button
                type="button"
                onClick={() => setShowJurisdictionModal(false)}
                className={`px-3 py-1.5 text-sm rounded-md ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addJurisdictionMetadata}
                className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Add Metadata
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add custom styles for dark mode and editor */}
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

        /* Improved legal metadata styling */
        .legal-metadata {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin: 16px 0;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .legal-metadata-header {
          background-color: #f0f9ff;
          padding: 12px 16px;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
          color: #0369a1;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .legal-icon {
          color: #0369a1;
        }
        
        .legal-metadata-content {
          padding: 12px 16px;
          background-color: #f9fafb;
        }
        
        .legal-metadata-content p {
          margin-bottom: 8px;
          color: #4b5563;
        }
        
        /* Dark mode for legal metadata */
        .quill-editor-dark .legal-metadata {
          border-color: #374151;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .quill-editor-dark .legal-metadata-header {
          background-color: #075985;
          color: #e0f2fe;
          border-bottom-color: #0c4a6e;
        }
        
        .quill-editor-dark .legal-icon {
          color: #e0f2fe;
        }
        
        .quill-editor-dark .legal-metadata-content {
          background-color: #0f172a;
        }
        
        .quill-editor-dark .legal-metadata-content p {
          color: #e2e8f0;
        }
        
        /* Modern Template Styles */
        .modern-template {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
        }
        
        .template-subtitle {
          font-size: 16px;
          color: #6b7280;
          margin-bottom: 24px;
          font-style: italic;
        }
        
        .template-section {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .template-section:last-child {
          border-bottom: none;
        }
        
        .funds-template {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
        }
        
        .funds-header {
          background-color: #f0f9ff;
          border-left: 4px solid #0369a1;
          padding: 12px 16px;
          margin: 16px 0;
          border-radius: 4px;
        }
        
        .legal-aid-template {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
        }
      `}</style>
    </div>
  );
};

// Modified helper function to include jurisdiction metadata in blockchain format
const createProposalWithHtml = (description, proposalType, target, callData, amount, recipient, externalToken, newThreshold, newQuorum, newVotingDuration, newTimelockDelay) => {
  // Parse the description to extract legal jurisdiction metadata
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = description;
  
  // Extract legal metadata for blockchain storage
  const legalMetadataEl = tempDiv.querySelector('.legal-metadata');
  let legalMetadata = {};
  
  if (legalMetadataEl) {
    // Extract jurisdiction info from the improved format
    const jurisdictionEl = legalMetadataEl.querySelector('.legal-metadata-content p:nth-child(1)');
    const caseTypeEl = legalMetadataEl.querySelector('.legal-metadata-content p:nth-child(2)');
    const legalCodeEl = legalMetadataEl.querySelector('.legal-metadata-content p:nth-child(3)');
    const applicableLawEl = legalMetadataEl.querySelector('.legal-metadata-content p:nth-child(4)');
    const enforcementAgencyEl = legalMetadataEl.querySelector('.legal-metadata-content p:nth-child(5)');
    
    if (jurisdictionEl) {
      const jurisdictionText = jurisdictionEl.textContent.replace('Jurisdiction:', '').trim();
      legalMetadata.jurisdiction = jurisdictionText;
    }
    
    if (caseTypeEl) {
      const caseTypeText = caseTypeEl.textContent.replace('Case Type:', '').trim();
      legalMetadata.caseType = caseTypeText;
    }
    
    if (legalCodeEl) {
      const legalCodeText = legalCodeEl.textContent.replace('Legal Code Reference:', '').trim();
      legalMetadata.legalCode = legalCodeText;
    }
    
    if (applicableLawEl) {
      const applicableLawText = applicableLawEl.textContent.replace('Applicable Law:', '').trim();
      legalMetadata.applicableLaw = applicableLawText;
    }
    
    if (enforcementAgencyEl) {
      const enforcementAgencyText = enforcementAgencyEl.textContent.replace('Enforcement Agency:', '').trim();
      legalMetadata.enforcementAgency = enforcementAgencyText;
    }
  }
  
  // Generate a blockchain-compatible metadata string
  const metadataStr = legalMetadata.jurisdiction 
    ? `LEGAL:${legalMetadata.jurisdiction}:${legalMetadata.caseType || ''}:${legalMetadata.legalCode || ''}:${legalMetadata.applicableLaw || ''}:${legalMetadata.enforcementAgency || ''}`
    : '';
  
  // Inject proposal metadata as HTML
  const timestamp = new Date().toISOString();
  const proposalTypeNames = [
    'General Legal Aid', 'Legal Fund Transfer', 'External Legal Service', 'DAO Governance Change'
  ];
  
  const metadataHtml = `
<div class="proposal-metadata">
  <h2>Legal Aid Proposal Metadata</h2>
  <p><b>Type:</b> ${proposalTypeNames[proposalType] || 'Unknown'}</p>
  <p><b>Created:</b> ${timestamp}</p>
  ${metadataStr ? `<p><b>Legal Metadata:</b> <code>${metadataStr}</code></p>` : ''}
</div>
`;

  // Combine with original description
  const enhancedDescription = metadataHtml + description;
  
  // Return the enhanced description with blockchain metadata
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
    newTimelockDelay,
    // Add blockchain-compatible metadata string
    legalMetadata: metadataStr
  };
};

export default ProposalQuillEditor;