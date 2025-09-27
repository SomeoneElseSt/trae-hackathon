import React, { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { Code, CheckCircle, Copy } from 'lucide-react';
import { toast, Toaster } from 'sonner';

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedApi, setGeneratedApi] = useState<CreateApiResponse | null>(null);

  const generateApi = async () => {
    console.log('🚀 [FRONTEND] Generate API button clicked');
    console.log('🚀 [FRONTEND] API Name:', apiName);
    console.log('🚀 [FRONTEND] API Description:', apiDescription);
    console.log('🚀 [FRONTEND] Python Code Length:', code.length);
    
    if (!apiName.trim()) {
      console.log('❌ [FRONTEND] Validation failed: API name is empty');
      toast.error('Please enter an API name');
      return;
    }

    if (!code.trim()) {
      console.log('❌ [FRONTEND] Validation failed: Python code is empty');
      toast.error('Please enter some Python code');
      return;
    }

    console.log('✅ [FRONTEND] Validation passed, starting API generation');
    setIsGenerating(true);
    
    try {
      const requestBody = {
        name: apiName,
        description: apiDescription,
        python_code: code
      };
      
      console.log('📤 [FRONTEND] Sending request to /api/generate');
      console.log('📤 [FRONTEND] Request body:', requestBody);
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 [FRONTEND] Response received');
      console.log('📥 [FRONTEND] Response status:', response.status);
      console.log('📥 [FRONTEND] Response ok:', response.ok);
      
      if (!response.ok) {
        console.log('❌ [FRONTEND] Response not ok, status:', response.status);
        const errorText = await response.text();
        console.log('❌ [FRONTEND] Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('📥 [FRONTEND] Parsed response:', result);
      
      if (result.success) {
        console.log('✅ [FRONTEND] API generation successful!');
        console.log('✅ [FRONTEND] Generated API ID:', result.api_id);
        console.log('✅ [FRONTEND] Generated API URL:', result.api_url);
        setGeneratedApi(result);
        if (result.warning) {
          console.log('⚠️ [FRONTEND] Warning received:', result.warning);
          toast.warning(result.warning);
        } else {
          toast.success('API generated successfully!');
        }
      } else {
        console.log('❌ [FRONTEND] API generation failed:', result.error);
        toast.error(result.error || 'Failed to generate API');
      }
    } catch (error) {
      console.log('💥 [FRONTEND] Exception caught in generateApi:');
      console.error('💥 [FRONTEND] Error details:', error);
      console.log('💥 [FRONTEND] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.log('💥 [FRONTEND] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast.error(`Failed to generate API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('🏁 [FRONTEND] generateApi function completed');
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
            Write your code and get a working API endpoint.
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

            <div className="mt-4 p-4 rounded-lg border bg-blue-50 border-blue-200 text-blue-800">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  Ready to Generate API
                </span>
              </div>
              <p className="mt-2 text-sm">Your Python code will be validated during API generation.</p>
            </div>
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
                disabled={isGenerating}
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