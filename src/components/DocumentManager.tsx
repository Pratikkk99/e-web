/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Trash2, 
  Plus, 
  Sparkles, 
  Search, 
  BookOpen, 
  Code2, 
  Database,
  ArrowRight,
  ShieldCheck,
  Check,
  UploadCloud,
  FileUp,
  FileCheck,
  AlertCircle,
  FileCode2,
  FileSpreadsheet,
  RefreshCw,
  Link,
  Globe
} from 'lucide-react';
import { SourceDoc } from '../types';

interface DocumentManagerProps {
  documents: SourceDoc[];
  onAddDocument: (doc: SourceDoc) => void;
  onRemoveDocument: (id: string) => void;
  onLoadTemplate: (type: 'abap' | 'mm_pdf' | 'fi_doc') => void;
}

export default function DocumentManager({ 
  documents, 
  onAddDocument, 
  onRemoveDocument, 
  onLoadTemplate 
}: DocumentManagerProps) {
  const [activeUploadTab, setActiveUploadTab] = useState<'upload' | 'paste'>('upload');
  const [inputText, setInputText] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [selectedType, setSelectedType] = useState<'text' | 'code' | 'pdf' | 'link'>('text');
  
  // Custom metadata states
  const [linkUrl, setLinkUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [taggedFiles, setTaggedFiles] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState('');
  
  // Drag and Drop states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [isFeederTraining, setIsFeederTraining] = useState(false);

  // Local state for searching/testing RAG retrieval chunks
  const [searchQuery, setSearchQuery] = useState('');
  const [retrievedChunks, setRetrievedChunks] = useState<{ docName: string; passage: string; score: number }[]>([]);

  // Function to load rich dummy data according to selected type
  const injectSample = (type: 'text' | 'code' | 'pdf' | 'link') => {
    if (type === 'text') {
      setInputTitle('Global Procurement Spec 2026');
      setInputText(`[Corporate Purchasing Rules - Direct Procurement]
1. All purchasing entries tagged with Asset Class 'RAW_MAT' (Raw materials) exceeding USD 50,000 must undergo Level-3 management auditing.
2. Direct cost center accounts must balance securely against corporate G/L General ledger 401010.
3. Foreign exchange entries maintain a mandatory tolerance deviation threshold of exactly 1.5% compared to daily federal treasury rate tables.`);
    } else if (type === 'code') {
      setInputTitle('Z_VAL_PURCH_LIMITS');
      setInputText(`*&---------------------------------------------------------------------*
*& Program  Z_VAL_PURCH_LIMITS
*& Purpose: Custom ABAP Procurement invoice clearance auditing module
*&---------------------------------------------------------------------*
REPORT z_val_purch_limits.

DATA: lv_bukrs        TYPE ekko-bukrs,
      lv_netpr        TYPE ekpo-netpr,
      lv_currency     TYPE ekko-waers.

SELECT SINGLE bukrs, waers FROM ekko INTO (lv_bukrs, lv_currency)
  WHERE ebeln = '4500010203'.

IF lv_currency = 'USD' AND lv_netpr > 25000.
  MESSAGE 'CRITICAL WARNING: Entry exceeds procurement compliance clearance limit' TYPE 'E'.
ENDIF.`);
    } else if (type === 'pdf') {
      setInputTitle('SAP HANA Procurement Audit Handbook');
      setInputText(`[SCANNED DOCUMENT PAGE 142 - STANDARD FI/CO GENERAL RECONCILIATION]
Rule mm-903-b: Purchasing Organization Standard Audit Levels:
- All purchase order items billed with Vendor Country outside of Domestic scope must trigger a soft-warning code if total purchase amount exceeds 10,000 EUR.
- Currency verification logic must cross-reference foreign exchange conversion parameters in standard table 'TCURR' (Exchange rates database).
- Any transactions failing this verification lock instantly inside standard transaction code 'F-02'.`);
    } else if (type === 'link') {
      setInputTitle('SAP S/4HANA Material Management Portal Doc');
      setLinkUrl('https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/mm-materials-management');
      setUsername('s4_audit_user');
      setPassword('P@ssw0rd991!');
      setAdditionalContext('Online guide explaining standard SAP Material Master data structure, central MRP setups, and inventory transaction lists.');
      setInputText(`Official SAP S/4HANA Product Documentation guidelines for Material Master configuration, central storage setups (Table MARA/MARC), and automatic MRP runs mapping.`);
    }
    setUploadSuccessMsg(`Injected standard reference template for: ${type === 'code' ? 'ABAP Source Code' : type === 'pdf' ? 'PDF Handbook Extract' : type === 'link' ? 'Web Resource Portal URL' : 'Compliance Guidelines Text'}`);
  };

  // File parsing processor
  const handleFileIngestion = (file: File) => {
    setUploadError(null);
    setUploadSuccessMsg(null);
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Format sizing nicely
    const sizeInKb = file.size / 1024;
    const sizeFormatted = sizeInKb > 1024 
      ? `${(sizeInKb / 1024).toFixed(1)} MB` 
      : `${Math.round(sizeInKb)} KB`;

    // Map extension to SourceDoc type categories
    let detectedType: 'text' | 'code' | 'pdf' | 'image' = 'text';
    if (['abap', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'sh', 'sql', 'html', 'css', 'xml', 'yaml', 'yml'].includes(fileExtension)) {
      detectedType = 'code';
    } else if (fileExtension === 'pdf') {
      detectedType = 'pdf';
    } else if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(fileExtension)) {
      detectedType = 'image';
    }

    if (detectedType === 'pdf') {
      setIsFeederTraining(true);
      setUploadSuccessMsg('System is analyzing RAG page mappings with AI. Performing deep text and table extraction...');
      
      const pdfReader = new FileReader();
      pdfReader.onload = async (e) => {
        const base64Data = e.target?.result as string || '';
        try {
          const res = await fetch('/api/pdf/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfData: base64Data })
          });
          
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Server parsing error.');
          }
          
          const data = await res.json();
          onAddDocument({
            id: 'uploaded-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            name: fileName,
            type: 'pdf',
            content: data.text,
            size: sizeFormatted,
            uploadedAt: new Date().toLocaleDateString()
          });
          setUploadSuccessMsg(`Successfully parsed & AI-indexed: ${fileName} (${sizeFormatted})`);
        } catch (err: any) {
          setUploadError(`Failed to parse PDF document "${fileName}": ${err.message}`);
        } finally {
          setIsFeederTraining(false);
        }
      };
      pdfReader.onerror = () => {
        setUploadError(`Error reading binary stream from "${fileName}".`);
        setIsFeederTraining(false);
      };
      pdfReader.readAsDataURL(file);
    } else if (detectedType === 'image') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string || '';
        
        onAddDocument({
          id: 'uploaded-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          name: fileName,
          type: detectedType,
          content: base64Data,
          size: sizeFormatted,
          uploadedAt: new Date().toLocaleDateString()
        });
        setUploadSuccessMsg(`Successfully ingested visual reference: ${fileName}`);
      };
      reader.onerror = () => {
        setUploadError(`Failed to process visual content in "${fileName}".`);
      };
      reader.readAsDataURL(file);
    } else {
      // General textual or dataset reading
      const reader = new FileReader();
      reader.onload = (e) => {
        let content = e.target?.result as string || '';

        if (fileExtension === 'json') {
          try {
            const parsed = JSON.parse(content);
            content = JSON.stringify(parsed, null, 2);
          } catch (err) {
            // retain raw string if JSON parsing has minor syntax issues
          }
        }

        onAddDocument({
          id: 'uploaded-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          name: fileName,
          type: detectedType,
          content: content,
          size: sizeFormatted,
          uploadedAt: new Date().toLocaleDateString()
        });
        setUploadSuccessMsg(`Uploaded and vectorized: ${fileName} (${sizeFormatted})`);
      };
      reader.onerror = () => {
        setUploadError(`Error reading text buffer from "${fileName}".`);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        handleFileIngestion(files[i]);
      }
    }
  };

  const handleFileSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        handleFileIngestion(files[i]);
      }
    }
  };

  const handleManualAdd = () => {
    // If it's a link, we need a link URL. Otherwise, we need non-empty inputText.
    if (selectedType === 'link' && !linkUrl.trim()) {
      setUploadError('Link Source URL is required for Web Resources.');
      return;
    }
    if (selectedType !== 'link' && !inputText.trim()) {
      setUploadError('Information body content is required.');
      return;
    }
    if (!inputTitle.trim() || isFeederTraining) return;
    
    setIsFeederTraining(true);
    setUploadSuccessMsg(null);
    setUploadError(null);

    setTimeout(() => {
      const isLink = selectedType === 'link';
      let docNameSuffix = '.txt';
      if (selectedType === 'code') docNameSuffix = '.abap';
      else if (selectedType === 'pdf') docNameSuffix = '.pdf';
      else if (selectedType === 'link') docNameSuffix = '.link';

      const actualContent = isLink 
        ? (inputText.trim() || `Web Resource Portal URL: ${linkUrl}\nAdditional Info Context: ${additionalContext || 'None'}`)
        : inputText;

      const sizeCalc = `${Math.round((actualContent.length * 2) / 1024)} KB`;

      const newDoc: SourceDoc = {
        id: 'doc-' + Date.now(),
        name: inputTitle.trim() + docNameSuffix,
        type: selectedType,
        content: actualContent,
        size: sizeCalc === '0 KB' ? '1 KB' : sizeCalc,
        uploadedAt: new Date().toLocaleDateString(),
        url: isLink ? linkUrl.trim() : undefined,
        credentials: isLink && (username.trim() || password.trim()) ? {
          username: username.trim(),
          password: password.trim()
        } : undefined,
        taggedFiles: taggedFiles.length > 0 ? taggedFiles : undefined,
        additionalContext: additionalContext.trim() ? additionalContext.trim() : undefined
      };
      
      onAddDocument(newDoc);
      setInputText('');
      setInputTitle('');
      setLinkUrl('');
      setUsername('');
      setPassword('');
      setTaggedFiles([]);
      setAdditionalContext('');
      setIsFeederTraining(false);
      setUploadSuccessMsg(`Successfully fed & trained memory indexes on: ${newDoc.name}`);
    }, 1200);
  };

  const executeRetrievalTest = () => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.toLowerCase();
    const results: { docName: string; passage: string; score: number }[] = [];

    documents.forEach(doc => {
      const content = doc.content.toLowerCase();
      if (content.includes(query)) {
        // Find surrounding snippet
        const index = content.indexOf(query);
        const start = Math.max(0, index - 100);
        const end = Math.min(doc.content.length, index + query.length + 150);
        const snippet = "..." + doc.content.substring(start, end) + "...";
        results.push({
          docName: doc.name,
          passage: snippet,
          score: 96 // high score for exact keyword hit
        });
      } else {
        // Simple word matches
        const queryWords = query.split(/\s+/).filter(w => w.length >= 2);
        let matchCount = 0;
        queryWords.forEach(w => {
          if (content.includes(w)) matchCount++;
        });
        if (matchCount > 0) {
          const firstWord = queryWords[0];
          const index = content.indexOf(firstWord);
          const start = Math.max(0, index - 80);
          const end = Math.min(doc.content.length, index + 200);
          results.push({
            docName: doc.name,
            passage: "..." + doc.content.substring(start, end) + "...",
            score: Math.min(90, Math.round((matchCount / queryWords.length) * 100))
          });
        }
      }
    });

    setRetrievedChunks(results.sort((a, b) => b.score - a.score));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-full lg:max-h-[calc(100vh-140px)] min-h-0" id="rag_doc_manager">
      {/* Left Column: Input Panel */}
      <div className="lg:col-span-5 p-5 bg-[#0c0d13] border border-zinc-850 rounded-2xl flex flex-col gap-4 lg:h-full lg:overflow-y-auto">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" /> Train / Feed Knowledge Data
          </h3>
          <p className="text-xs text-zinc-500 mt-1">Populate the active RAG Base with standard SAP specs, manual guides, programs, sheets or rulebook assets.</p>
        </div>

        {/* Live One-Click Training Presets */}
        <div className="bg-zinc-950/50 border border-zinc-900 p-3.5 rounded-xl space-y-2">
          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-400 block mb-1">
            ⚡ Quick-Load Reference Presets
          </span>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => onLoadTemplate('abap')}
              className="w-full text-left p-2.5 bg-zinc-900 border border-zinc-800 hover:border-amber-500/20 hover:bg-amber-500/5 rounded-lg flex items-center justify-between text-xs transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Code2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-semibold block text-zinc-200">SAP ABAP Code Program</span>
                  <span className="text-[10px] text-zinc-500 font-mono block">SAP_PurchaseOrders_Validator.abap</span>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-400 transition-all flex-shrink-0" />
            </button>

            <button
              onClick={() => onLoadTemplate('mm_pdf')}
              className="w-full text-left p-2.5 bg-zinc-900 border border-zinc-800 hover:border-amber-500/20 hover:bg-amber-500/5 rounded-lg flex items-center justify-between text-xs transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 truncate">
                <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-semibold block text-zinc-200">SAP HANA Material Management PDF</span>
                  <span className="text-[10px] text-zinc-500 font-mono block">SAP_HANA_MM_Manual_v4.pdf</span>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-400 transition-all flex-shrink-0" />
            </button>

            <button
              onClick={() => onLoadTemplate('fi_doc')}
              className="w-full text-left p-2.5 bg-zinc-900 border border-zinc-800 hover:border-amber-500/20 hover:bg-amber-500/5 rounded-lg flex items-center justify-between text-xs transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Database className="w-4 h-4 text-pink-400 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-semibold block text-zinc-200">SAP Finance CO/PA Schema Doc</span>
                  <span className="text-[10px] text-zinc-500 font-mono block">FI_COPA_Control_Spec.txt</span>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-400 transition-all flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* FEED MODE NAV TABS */}
        <div className="flex border-b border-zinc-900 text-xs font-mono font-semibold" id="feed_tab_nav">
          <button 
            type="button"
            onClick={() => {
              setActiveUploadTab('upload');
              setUploadError(null);
              setUploadSuccessMsg(null);
            }}
            className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${activeUploadTab === 'upload' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            📁 File Drag & Drop
          </button>
          <button 
            type="button"
            onClick={() => {
              setActiveUploadTab('paste');
              setUploadError(null);
              setUploadSuccessMsg(null);
            }}
            className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${activeUploadTab === 'paste' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            ✍️ Manual Paste Form
          </button>
        </div>

        {/* Dynamic content depending on Tab */}
        {activeUploadTab === 'upload' ? (
          <div className="space-y-4">
            {/* DRAG & DROP ZONE SECTION */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative flex flex-col items-center justify-center gap-3.5 min-h-[190px] select-none ${
                isDragging 
                  ? 'border-amber-500 bg-amber-500/5' 
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
              }`}
              id="drag_and_drop_upload_zone"
            >
              <input 
                type="file" 
                id="rag_native_file_picker"
                multiple
                accept=".txt,.pdf,.abap,.csv,.json,.xml,.md,.doc,.docx,.yaml,.yml,.js,.ts,.py,.java,.cpp,.c,.png,.jpg,.jpeg,.svg,.webp,.gif"
                className="hidden"
                onChange={handleFileSelectionChange}
              />

              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                {isDragging ? (
                  <FileUp className="w-6 h-6 text-amber-400 animate-bounce" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-zinc-450" />
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-200 font-semibold">
                  Drag & Drop any document here, or{' '}
                  <label 
                    htmlFor="rag_native_file_picker"
                    className="text-amber-400 hover:text-amber-350 cursor-pointer underline font-bold"
                  >
                    browse computer
                  </label>
                </p>
                <p className="text-[10px] text-zinc-500 mt-1 flex flex-col gap-0.5 items-center">
                  <span>Supports ABAP programs, PDF references, CSV dataset tables, Custom JSON/XML rulebooks, or image guidelines</span>
                  <span className="text-amber-500/80 font-mono text-[9px]">Trained visual layout models will match context with the current conversation</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-[9px] font-mono text-zinc-650">
                <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-900 rounded text-amber-500/70 border-amber-500/10">.PNG/.JPG/.SVG</span>
                <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-900 rounded">.ABAP</span>
                <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-900 rounded">.PDF</span>
                <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-900 rounded">.CSV</span>
                <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-900 rounded">.JSON</span>
                <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-900 rounded">.TXT</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-500">
                🏷️ Document Name or System Tag
              </span>
              <input 
                type="text"
                placeholder={
                  selectedType === 'code' 
                    ? "e.g., Z_VENDOR_BILL_LIMITS" 
                    : selectedType === 'pdf' 
                    ? "e.g., SAP FI HANA Manual Chapter 4" 
                    : selectedType === 'link'
                    ? "e.g., SAP Help Portal MM Guidelines"
                    : "e.g., MM Compliance Guidelines"
                }
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3.5 py-2.5 rounded-xl text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 font-mono transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-500">
                🧬 Document Type Category
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                {(['text', 'code', 'pdf', 'link'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSelectedType(t);
                      setUploadSuccessMsg(null);
                    }}
                    className={`flex-1 min-w-[90px] py-1.5 px-2 rounded-xl border text-[11px] font-mono capitalize transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedType === t 
                        ? t === 'code'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                          : t === 'pdf'
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-bold'
                          : t === 'link'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                          : 'bg-pink-500/10 border-pink-500/30 text-pink-400 font-bold'
                        : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-350 hover:border-zinc-700'
                    }`}
                  >
                    {t === 'code' ? (
                      <>
                        <Code2 className="w-3.5 h-3.5" /> Code snippet
                      </>
                    ) : t === 'pdf' ? (
                      <>
                        <FileText className="w-3.5 h-3.5 text-cyan-400" /> PDF reference
                      </>
                    ) : t === 'link' ? (
                      <>
                        <Link className="w-3.5 h-3.5 text-emerald-400" /> Portal URL / Link
                      </>
                    ) : (
                      <>
                        <Database className="w-3.5 h-3.5 text-pink-400" /> Plain text
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* If link selection, show connection configs */}
            {selectedType === 'link' && (
              <div className="flex flex-col gap-3 p-3.5 bg-[#0a0c10] border border-emerald-500/10 rounded-xl relative overflow-hidden" id="link_configs_panel">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-550/5 rounded-full blur-xl pointer-events-none" />
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" /> Web Link Configuration (e.g. Help.sap.com)
                </span>
                
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase font-mono font-bold text-zinc-500">🔗 Link Reference URL</span>
                  <input 
                    type="text"
                    placeholder="e.g., https://help.sap.com/docs/SAP_HANA_CL/index.html"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 text-xs px-3.5 py-2 rounded-xl text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase font-mono font-bold text-zinc-500 flex items-center gap-15">🔒 Private Portal User ID</span>
                    <input 
                      type="text"
                      placeholder="e.g., business_architect_dev"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-xs px-3.5 py-2 rounded-xl text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase font-mono font-bold text-zinc-500">🔑 Portal Password</span>
                    <input 
                      type="password"
                      placeholder="e.g., •••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-xs px-3.5 py-2 rounded-xl text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tag Existing File + Specific Context Descriptions Section */}
            <div className="flex flex-col gap-3 p-3.5 bg-[#0a0c10] border border-zinc-900 rounded-xl" id="file_tagging_context_editor">
              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-400 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-amber-500" /> Tag Deployed References & Annotate Specific Info
              </span>
              <p className="text-[10px] text-zinc-500">Associate active manual specifications, image layouts, or PDF guides in memory to form unified context packages.</p>

              {documents.length === 0 ? (
                <div className="text-[10px] text-zinc-600 font-mono italic">No existing documents to tag. Upload some files under Train Base first.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto pr-1">
                  {documents.map((doc) => {
                    const isTagged = taggedFiles.includes(doc.name);
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => {
                          setTaggedFiles(prev => 
                            isTagged ? prev.filter(name => name !== doc.name) : [...prev, doc.name]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                          isTagged 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                            : 'bg-zinc-950 border-zinc-855 text-zinc-500 hover:text-zinc-350 hover:bg-zinc-900'
                        }`}
                      >
                        <Check className={`w-2.5 h-2.5 transition-opacity ${isTagged ? 'opacity-100' : 'opacity-20'}`} />
                        {doc.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-[9px] uppercase font-mono font-bold text-zinc-500">📝 Specific Context Info (Description or Annotation Notes)</span>
                <textarea
                  rows={2}
                  placeholder="Describe context: e.g. 'This overrides standard procurement thresholds' or 'Guides credentials setup for private server'"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 text-xs px-3.5 py-2 rounded-xl text-zinc-350 focus:outline-none focus:ring-1 focus:ring-amber-500/40 font-mono transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-500 flex items-center gap-1">
                  ✍️ Input Information Body
                </span>
                
                <button
                  type="button"
                  onClick={() => injectSample(selectedType)}
                  className="text-[10px] text-amber-400 hover:text-amber-350 underline font-mono cursor-pointer flex items-center gap-0.5"
                >
                  ✨ Load Template Sample
                </button>
              </div>

              <textarea
                rows={5}
                placeholder={
                  selectedType === 'code'
                    ? "💻 Paste compliant ABAP source statements, table parameters, or logic structures here...\n\nExample:\nREPORT z_mm_threshold_check.\nIF lv_po_amount > 50000 AND lv_currency = 'USD'..."
                    : selectedType === 'pdf'
                    ? "📖 Paste OCR text contents, training guide chapters, or handbook sections here...\n\nExample:\n[MM MANUAL CH. 12]\n- Tolerances have been established under section code 40-A.\n- Accounts must adhere to domestic verification requirements."
                    : selectedType === 'link'
                    ? "🌐 Paste website notes, article digests, summaries, or leave empty to compose from the URL configuration parameters..."
                    : "📝 Enter textual corporate compliance instructions, guidelines, audit definitions, or manual specifications here...\n\nExample:\nAll procurement invoice requests matching vendor location codes outside regional zones require custom manual authentication limits."
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className={`w-full p-3.5 rounded-xl text-xs font-mono text-zinc-300 leading-relaxed focus:outline-none transition-all resize-none border ${
                  selectedType === 'code'
                    ? 'bg-[#06080c] border-amber-500/15 focus:border-amber-500/45 text-amber-100'
                    : selectedType === 'pdf'
                    ? 'bg-[#080a0f] border-cyan-500/15 focus:border-cyan-500/45 text-cyan-50'
                    : selectedType === 'link'
                    ? 'bg-[#050907] border-emerald-500/15 focus:border-emerald-500/45 text-emerald-50'
                    : 'bg-[#0b0c11] border-zinc-800 focus:border-pink-500/40'
                }`}
              />
            </div>

            <button 
              onClick={handleManualAdd}
              disabled={
                selectedType === 'link'
                  ? !linkUrl.trim() || !inputTitle.trim() || isFeederTraining
                  : !inputText.trim() || !inputTitle.trim() || isFeederTraining
              }
              className={`w-full py-2.5 rounded-xl text-black text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer shadow-md select-none ${
                selectedType === 'code'
                  ? 'bg-amber-400 hover:bg-amber-350'
                  : selectedType === 'pdf'
                  ? 'bg-cyan-400 hover:bg-cyan-350'
                  : selectedType === 'link'
                  ? 'bg-emerald-400 hover:bg-emerald-350'
                  : 'bg-pink-400 hover:bg-pink-350'
              }`}
            >
              {isFeederTraining ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Vectorizing & Training Active RAG Context...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.5]" /> Feed & Train on custom {
                    selectedType === 'code' 
                      ? 'ABAP parameters' 
                      : selectedType === 'pdf' 
                      ? 'PDF guide' 
                      : selectedType === 'link'
                      ? 'Web Knowledge Resource'
                      : 'text parameters'
                  }
                </>
              )}
            </button>
          </div>
        )}

        {/* ERROR / SUCCESS LOG FEEDBACK FEED */}
        {uploadError && (
          <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="font-mono leading-relaxed">{uploadError}</p>
          </div>
        )}

        {uploadSuccessMsg && (
          <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-400 animate-fadeIn">
            <FileCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed font-mono">{uploadSuccessMsg}</p>
          </div>
        )}
      </div>

      {/* Right Column: Matched vectors & current documents (7 columns) */}
      <div className="lg:col-span-7 flex flex-col gap-4 lg:h-full min-h-0" id="rag_knowledge_vector_board">
        {/* Fed Documents Listing */}
        <div className="p-5 bg-[#0c0d13] border border-zinc-850 rounded-2xl flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-900 flex-shrink-0">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" /> Loaded Knowledge Base / Sources
              </h4>
              <p className="text-[11px] text-zinc-500">Currently active documents referenced by the RAG model</p>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {documents.length} Docs
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {documents.map((doc) => (
              <div 
                key={doc.id}
                className="w-full p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {doc.type === 'code' ? (
                    <Code2 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  ) : doc.type === 'pdf' ? (
                    <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  ) : doc.type === 'link' ? (
                    <Link className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : doc.type === 'image' ? (
                    <div className="w-6 h-6 rounded bg-pink-500/10 border border-pink-500/20 overflow-hidden flex items-center justify-center flex-shrink-0 mt-0.5">
                      <img src={doc.content} className="object-cover w-full h-full" referrerPolicy="no-referrer" alt="" />
                    </div>
                  ) : (
                    <Database className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold block text-zinc-200 truncate select-all">{doc.name}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500 font-mono">
                      <span>{doc.size}</span>
                      <span>•</span>
                      <span>Uploaded {doc.uploadedAt}</span>
                      {doc.type === 'link' && doc.url && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 underline truncate max-w-[200px] select-all">{doc.url}</span>
                        </>
                      )}
                      {doc.credentials?.username && (
                        <span className="text-emerald-500/85 bg-emerald-500/5 px-1 py-0.5 rounded border border-emerald-500/10 text-[9px] flex items-center gap-0.5 font-bold">
                          <ShieldCheck className="w-2.5 h-2.5" /> Portal Secure
                        </span>
                      )}
                    </div>
                    {/* Metadata tags */}
                    {doc.taggedFiles && doc.taggedFiles.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[9px] text-amber-400">
                        <span className="text-zinc-650 font-bold">Reference links:</span>
                        {doc.taggedFiles.map((f, i) => (
                          <span key={i} className="bg-amber-500/5 border border-amber-500/10 px-1 py-0.2 rounded font-mono">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                    {doc.additionalContext && (
                      <p className="mt-1.5 text-[10.5px] text-zinc-400 italic bg-zinc-950/40 p-2 rounded border border-zinc-900/40 font-serif leading-tight">
                        "{doc.additionalContext}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3 h-3" /> Vectors Ready
                  </span>
                  
                  <button 
                    onClick={() => onRemoveDocument(doc.id)}
                    className="opacity-40 hover:opacity-100 hover:text-red-400 p-1.5 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="text-center py-6 text-zinc-500 text-xs border border-dashed border-zinc-900 rounded-xl">
                No documents found. Load the pre-configured SAP templates on the left to start!
              </div>
            )}
          </div>
        </div>

        {/* Vector Retrieval Sandbox */}
        <div className="p-5 bg-[#0c0d13] border border-zinc-850 rounded-2xl flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex-shrink-0">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" /> Secure Vector Retrieval Sandbox
            </h4>
            <p className="text-[11px] text-zinc-500">Type a term to simulate semantic parsing and exact RAG mapping of document passages.</p>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <input 
              type="text"
              placeholder="e.g. ABAP Program, material validation, COPA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeRetrievalTest()}
              className="flex-1 bg-zinc-950 border border-zinc-800 text-xs px-3.5 py-2.5 rounded-xl text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            <button 
              onClick={executeRetrievalTest}
              className="px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" /> Retrieve Chunks
            </button>
          </div>

          {/* Retrieved Chunks outputs */}
          <div className="space-y-3 flex-grow flex-1 overflow-y-auto pr-1">
            {retrievedChunks.map((c, i) => (
              <div 
                key={i}
                className="p-3 bg-[#0d0e15] border border-zinc-800 rounded-lg flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-500">Source: <b className="text-zinc-300">{c.docName}</b></span>
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Similarity Score: {c.score}%
                  </span>
                </div>
                <p className="text-xs font-mono text-zinc-300 bg-zinc-950 p-2.5 rounded border border-zinc-900 leading-relaxed whitespace-pre-wrap">{c.passage}</p>
              </div>
            ))}
            {searchQuery.trim() !== '' && retrievedChunks.length === 0 && (
              <div className="text-xs text-zinc-500 text-center py-4">
                No matching passage found. Try typing keywords that match the active templates.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
