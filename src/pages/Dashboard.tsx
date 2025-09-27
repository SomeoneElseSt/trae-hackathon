import React, { useState, useEffect } from 'react';
import { Search, Play, Clock, CheckCircle, XCircle, Eye, Code2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';

interface ApiRecord {
  id: string;
  api_id: string;
  name: string;
  description?: string;
  python_code: string;
  function_name: string;
  input_schema: object;
  output_schema?: object;
  created_at: string;
  updated_at: string;
}

interface ExecutionRecord {
  id: string;
  api_id: string;
  input_data: object;
  output_data?: object;
  status: 'pending' | 'success' | 'error';
  error_message?: string;
  execution_time_ms?: number;
  created_at: string;
}

interface ApiDetailsResponse {
  success: boolean;
  api?: ApiRecord;
  recent_executions?: ExecutionRecord[];
  error?: string;
}

export default function Dashboard() {
  const [apis, setApis] = useState<ApiRecord[]>([]);
  const [selectedApi, setSelectedApi] = useState<ApiRecord | null>(null);
  const [apiDetails, setApiDetails] = useState<ApiDetailsResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    loadApis();
  }, []);

  const loadApis = async () => {
    try {
      const response = await fetch('/api/list');
      const result = await response.json();
      
      if (result.success) {
        setApis(result.apis || []);
      } else {
        toast.error('Failed to load APIs');
      }
    } catch (error) {
      toast.error('Failed to load APIs');
    } finally {
      setIsLoading(false);
    }
  };

  const loadApiDetails = async (apiId: string) => {
    try {
      const response = await fetch(`/api/details/${apiId}`);
      const result = await response.json();
      
      if (result.success) {
        setApiDetails(result);
        setSelectedApi(result.api);
        
        // Generate sample input based on schema
        if (result.api?.input_schema) {
          const sampleInput = generateSampleInput(result.api.input_schema);
          setTestInput(JSON.stringify(sampleInput, null, 2));
        }
      } else {
        toast.error(result.error || 'Failed to load API details');
      }
    } catch (error) {
      toast.error('Failed to load API details');
    }
  };

  const generateSampleInput = (schema: any): object => {
    const sample: any = {};
    
    if (schema.properties) {
      Object.keys(schema.properties).forEach(key => {
        const prop = schema.properties[key];
        switch (prop.type) {
          case 'string':
            sample[key] = 'sample text';
            break;
          case 'integer':
            sample[key] = 42;
            break;
          case 'number':
            sample[key] = 3.14;
            break;
          case 'boolean':
            sample[key] = true;
            break;
          case 'array':
            sample[key] = ['item1', 'item2'];
            break;
          case 'object':
            sample[key] = { key: 'value' };
            break;
          default:
            sample[key] = 'sample';
        }
      });
    }
    
    return sample;
  };

  const testApi = async () => {
    if (!selectedApi) return;
    
    try {
      const inputData = JSON.parse(testInput);
      setIsTesting(true);
      
      const response = await fetch(`/api/exec/${selectedApi.api_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inputData)
      });
      
      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        toast.success('API executed successfully!');
        // Reload details to get updated executions
        loadApiDetails(selectedApi.api_id);
      } else {
        toast.error(result.error || 'API execution failed');
      }
    } catch (error) {
      toast.error('Invalid JSON input or execution failed');
      setTestResult({ success: false, error: 'Invalid JSON input' });
    } finally {
      setIsTesting(false);
    }
  };

  const filteredApis = apis.filter(api => 
    api.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    api.api_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading APIs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Toaster position="top-right" richColors />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            API Dashboard
          </h1>
          <p className="text-gray-600">
            Manage and test your generated APIs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* API List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search APIs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {filteredApis.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {apis.length === 0 ? 'No APIs created yet' : 'No APIs match your search'}
                  </div>
                ) : (
                  filteredApis.map((api) => (
                    <div
                      key={api.id}
                      onClick={() => loadApiDetails(api.api_id)}
                      className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedApi?.id === api.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <h3 className="font-medium text-gray-900 truncate">
                        {api.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {api.api_id}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(api.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* API Details */}
          <div className="lg:col-span-2">
            {selectedApi ? (
              <div className="space-y-6">
                {/* API Info */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedApi.name}
                      </h2>
                      <p className="text-gray-600 mt-1">
                        {selectedApi.description || 'No description provided'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCode(!showCode)}
                      className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Code2 className="w-4 h-4" />
                      {showCode ? 'Hide Code' : 'View Code'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">API ID:</span>
                      <p className="font-mono">{selectedApi.api_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Function:</span>
                      <p className="font-mono">{selectedApi.function_name}</p>
                    </div>
                  </div>
                  
                  {showCode && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Python Code:</h4>
                      <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-x-auto border">
                        <code>{selectedApi.python_code}</code>
                      </pre>
                    </div>
                  )}
                </div>

                {/* Input Schema */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Input Schema
                  </h3>
                  <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-x-auto border">
                    {JSON.stringify(selectedApi.input_schema, null, 2)}
                  </pre>
                </div>

                {/* API Testing */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Test API
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Input JSON
                      </label>
                      <textarea
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="Enter JSON input..."
                      />
                    </div>
                    
                    <button
                      onClick={testApi}
                      disabled={isTesting}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      {isTesting ? 'Testing...' : 'Test API'}
                    </button>
                    
                    {testResult && (
                      <div className={`p-4 rounded-lg border ${
                        testResult.success 
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <h4 className="font-medium mb-2">
                          {testResult.success ? 'Success' : 'Error'}
                        </h4>
                        <pre className="text-sm overflow-x-auto">
                          {JSON.stringify(testResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Executions */}
                {apiDetails?.recent_executions && apiDetails.recent_executions.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Recent Executions
                    </h3>
                    
                    <div className="space-y-3">
                      {apiDetails.recent_executions.map((execution) => (
                        <div key={execution.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(execution.status)}
                              <span className="text-sm font-medium capitalize">
                                {execution.status}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(execution.created_at)}
                              {execution.execution_time_ms && (
                                <span className="ml-2">
                                  ({execution.execution_time_ms}ms)
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-xs">
                            <div className="mb-1">
                              <span className="text-gray-500">Input:</span>
                              <code className="ml-1 bg-gray-100 px-1 rounded">
                                {JSON.stringify(execution.input_data)}
                              </code>
                            </div>
                            
                            {execution.output_data && (
                              <div className="mb-1">
                                <span className="text-gray-500">Output:</span>
                                <code className="ml-1 bg-gray-100 px-1 rounded">
                                  {JSON.stringify(execution.output_data)}
                                </code>
                              </div>
                            )}
                            
                            {execution.error_message && (
                              <div className="text-red-600">
                                <span className="text-gray-500">Error:</span>
                                <span className="ml-1">{execution.error_message}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select an API
                </h3>
                <p className="text-gray-600">
                  Choose an API from the list to view details and test it
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}