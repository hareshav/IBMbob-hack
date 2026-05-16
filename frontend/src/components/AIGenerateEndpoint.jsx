import { useEffect, useState } from 'react';
import { requestEndpointGeneration } from '../lib/apiClient';

export default function AIGenerateEndpoint({ isOpen, onClose, onGenerated, defaultTargetFile, selectedModelId }) {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/v1/');
  const [description, setDescription] = useState('');
  const [targetFile, setTargetFile] = useState(defaultTargetFile || 'backend/main.py');
  const [includeTests, setIncludeTests] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  useEffect(() => {
    if (!isOpen) return;
    setTargetFile(defaultTargetFile || 'backend/main.py');
  }, [isOpen, defaultTargetFile]);

  const generateEndpoint = async () => {
    if (!path.trim() || !description.trim()) {
      alert('Please provide both path and description');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const data = await requestEndpointGeneration({
        method,
        path: path.trim(),
        description: description.trim(),
        target_file: targetFile.trim() || null,
        include_tests: includeTests,
        model_id: selectedModelId || undefined,
      });
      setResult(data);
      
      if (onGenerated) {
        onGenerated(data);
      }
    } catch (error) {
      setResult({
        success: false,
        explanation: `Error: ${error.message}. Make sure the unified backend is running on port 5000.`,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    const textToCopy = result?.generated_functions?.length
      ? JSON.stringify(result.generated_functions, null, 2)
      : result?.generated_code;

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      alert(result?.generated_functions?.length ? 'JSON copied to clipboard!' : 'Code copied to clipboard!');
    }
  };

  const resetForm = () => {
    setPath('/api/v1/');
    setDescription('');
    setResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="flex h-[700px] w-[900px] flex-col rounded-lg bg-[#1a1d2b] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3a3a4a] p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">AI Endpoint Generator</h2>
              <p className="text-xs text-slate-400">Generate REST API endpoints from natural language</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-[#2a2d3b] hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Input Form */}
          <div className="w-1/2 overflow-y-auto border-r border-[#3a3a4a] p-6">
            <div className="space-y-4">
              {/* HTTP Method */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  HTTP Method
                </label>
                <div className="flex gap-2">
                  {httpMethods.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                        method === m
                          ? 'bg-[#0f62fe] text-white'
                          : 'bg-[#2a2d3b] text-slate-300 hover:bg-[#3a3d4b]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoint Path */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Endpoint Path
                </label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/api/v1/users"
                  className="w-full rounded-lg border border-[#3a3a4a] bg-[#2a2d3b] p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-[#0f62fe] focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Description (Natural Language)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this endpoint should do... For example: 'Fetch all active users with pagination support. Include user profile data and last login timestamp. Return 404 if no users found.'"
                  className="w-full resize-none rounded-lg border border-[#3a3a4a] bg-[#2a2d3b] p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-[#0f62fe] focus:outline-none"
                  rows={6}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Be specific about inputs, outputs, error cases, and business logic
                </p>
              </div>

              {/* Target File */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Target File
                </label>
                <input
                  type="text"
                  value={targetFile}
                  onChange={(e) => setTargetFile(e.target.value)}
                  placeholder="backend/main.py"
                  className="w-full rounded-lg border border-[#3a3a4a] bg-[#2a2d3b] p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-[#0f62fe] focus:outline-none"
                />
              </div>

              {/* Options */}
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeTests}
                    onChange={(e) => setIncludeTests(e.target.checked)}
                    className="h-4 w-4 rounded border-[#3a3a4a] bg-[#2a2d3b] text-[#0f62fe] focus:ring-[#0f62fe]"
                  />
                  Generate unit tests
                </label>
              </div>

              {/* Generate Button */}
              <button
                onClick={generateEndpoint}
                disabled={isGenerating || !path.trim() || !description.trim()}
                className="w-full rounded-lg bg-[#0f62fe] py-3 text-sm font-medium text-white hover:bg-[#0353e9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : '✨ Generate Endpoint'}
              </button>
            </div>
          </div>

          {/* Right Panel - Generated Code */}
          <div className="flex w-1/2 flex-col overflow-hidden">
            {result ? (
              <>
                <div className="border-b border-[#3a3a4a] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-100">
                        {result.success ? '✅ Generated Successfully' : '❌ Generation Failed'}
                      </h3>
                      <p className="text-xs text-slate-400">{result.file_path}</p>
                    </div>
                    {result.success && (
                      <button
                        onClick={copyToClipboard}
                        className="rounded bg-[#2a2d3b] px-3 py-1 text-xs text-slate-300 hover:bg-[#3a3d4b]"
                      >
                        📋 Copy
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {/* Explanation */}
                  {result.explanation && (
                    <div className="mb-4 rounded-lg bg-[#2a2d3b] p-3">
                      <p className="text-sm text-slate-300">{result.explanation}</p>
                    </div>
                  )}

                  {/* Generated Code */}
                  {result.generated_code && (
                    <div className="mb-4">
                      <div className="mb-2 text-xs font-medium text-slate-400">Generated Code:</div>
                      <pre className="overflow-x-auto rounded-lg bg-[#161616] p-4 text-xs text-slate-100">
                        <code>{result.generated_code}</code>
                      </pre>
                    </div>
                  )}

                  {result.generated_functions?.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 text-xs font-medium text-slate-400">Structured Functions (JSON):</div>
                      <pre className="overflow-x-auto rounded-lg bg-[#161616] p-4 text-xs text-slate-100">
                        <code>{JSON.stringify(result.generated_functions, null, 2)}</code>
                      </pre>
                    </div>
                  )}

                  {/* Suggestions */}
                  {result.suggestions?.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 text-xs font-medium text-slate-400">💡 Suggestions:</div>
                      <ul className="space-y-1">
                        {result.suggestions.map((suggestion, i) => (
                          <li key={i} className="text-xs text-slate-300">
                            • {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {result.warnings?.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-medium text-yellow-400">⚠️ Warnings:</div>
                      <ul className="space-y-1">
                        {result.warnings.map((warning, i) => (
                          <li key={i} className="text-xs text-yellow-300">
                            • {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {result.success && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={resetForm}
                        className="rounded bg-[#2a2d3b] px-4 py-2 text-sm text-slate-300 hover:bg-[#3a3d4b]"
                      >
                        Generate Another
                      </button>
                      <button
                        onClick={onClose}
                        className="rounded bg-[#0f62fe] px-4 py-2 text-sm text-white hover:bg-[#0353e9]"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center">
                <div>
                  <div className="mb-4 text-6xl">🎯</div>
                  <p className="text-sm text-slate-400">
                    Fill in the form and click Generate to create your endpoint
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Made with Bob
