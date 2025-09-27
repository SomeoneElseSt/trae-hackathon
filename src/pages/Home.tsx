import React, { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { Play, Code, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { toast, Toaster } from 'sonner';

interface ValidationResult {
  isValid: boolean;
  error?: string;
  analysis?: {
    functionName: string;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
  };
}

interface CreateApiResponse {
  success: boolean;
  api_id?: string;
  api_url?: string;
  input_schema?: object;
  error?: string;
  warning?: string;
}

const defaultCode = `def greet(name: str, age: int):
    """A simple greeting function"""
    return f"Hello {name}, you are {age} years old!"`;

export default function Home() {
  const [code, setCode] = useState(defaultCode);
  const [apiName, setApiName] = useState('');
  const [apiDescription, setApiDescription] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [generatedApi, setGeneratedApi] = useState<CreateApiResponse | null>(null);

  const validateCode = async () => {
    if (!code.trim()) {
      setValidationResult({
        isValid: false,
        error: 'Please enter some Python code'
      });
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'validation-test',
          python_code: code
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setValidationResult({
          isValid: true,
          analysis: {
            functionName: 'Function detected',
            parameters: []
          }
        });
        toast.success('Code validation passed!');
      } else {
        setValidationResult({
          isValid: false,
          error: result.error
        });
        toast.error(result.error);
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: 'Failed to validate code'
      });
      toast.error('Failed to validate code');
    } finally {
      setIsValidating(false);
    }
  };

  const generateApi = async () => {
    if (!apiName.trim()) {
      toast.error('Please enter an API name');
      return;
    }

    if (!validationResult?.isValid) {
      toast.error('Please validate your code first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: apiName,
          description: apiDescription,
          python_code: code
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setGeneratedApi(result);
        if (result.warning) {
          toast.warning(result.warning);
        } else {
          toast.success('API generated successfully!');
        }
      } else {
        toast.error(result.error || 'Failed to generate API');
      }
    } catch (error) {
      toast.error('Failed to generate API');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="p-6">
      <Toaster position="top-right" richColors />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            CodeAPI Generator
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your Python functions into REST APIs instantly. 
            Write your code, validate it, and get a working API endpoint.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Code Editor Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Python Code Editor
              </h2>
            </div>
            
            <div className="mb-4">
              <div className="border rounded-lg overflow-hidden">
                <Editor
                  height="400px"
                  defaultLanguage="python"
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on'
                  }}
                />
              </div>
            </div>

            <button
              onClick={validateCode}
              disabled={isValidating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {isValidating ? 'Validating...' : 'Validate Code'}
            </button>

            {/* Validation Result */}
            {validationResult && (
              <div className={`mt-4 p-4 rounded-lg border ${
                validationResult.isValid 
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {validationResult.isValid ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">
                    {validationResult.isValid ? 'Validation Passed' : 'Validation Failed'}
                  </span>
                </div>
                {validationResult.error && (
                  <p className="mt-2 text-sm">{validationResult.error}</p>
                )}
              </div>
            )}
          </div>

          {/* API Generation Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Generate API
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Name *
                </label>
                <input
                  type="text"
                  value={apiName}
                  onChange={(e) => setApiName(e.target.value)}
                  placeholder="e.g., My Greeting API"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={apiDescription}
                  onChange={(e) => setApiDescription(e.target.value)}
                  placeholder="Describe what your API does..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <button
                onClick={generateApi}
                disabled={isGenerating || !validationResult?.isValid}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {isGenerating ? 'Generating...' : 'Generate API'}
              </button>
            </div>

            {/* Generated API Result */}
            {generatedApi && generatedApi.success && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-3">
                  ✅ API Generated Successfully!
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      API ID
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 bg-white border rounded text-sm">
                        {generatedApi.api_id}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedApi.api_id!)}
                        className="p-1 text-green-600 hover:text-green-800"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      API URL
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 bg-white border rounded text-sm break-all">
                        {generatedApi.api_url}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedApi.api_url!)}
                        className="p-1 text-green-600 hover:text-green-800"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {generatedApi.input_schema && (
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-1">
                        Input Schema
                      </label>
                      <pre className="px-2 py-1 bg-white border rounded text-sm overflow-x-auto">
                        {JSON.stringify(generatedApi.input_schema, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}