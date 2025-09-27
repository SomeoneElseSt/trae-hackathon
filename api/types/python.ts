export interface FunctionParameter {
  name: string;
  type: string;
  required: boolean;
}

export interface PythonCodeAnalysis {
  hasFunction: boolean;
  hasInput: boolean;
  hasOutput: boolean;
  functionName: string;
  parameters: FunctionParameter[];
  functions: Array<{
    name: string;
    parameters: FunctionParameter[];
    hasReturn: boolean;
    hasPrint: boolean;
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  analysis: PythonCodeAnalysis | null;
}

export interface ApiRecord {
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

export interface ExecutionRecord {
  id: string;
  api_id: string;
  input_data: object;
  output_data?: object;
  status: 'pending' | 'success' | 'error';
  error_message?: string;
  execution_time_ms?: number;
  created_at: string;
}

export interface CreateApiRequest {
  name: string;
  description?: string;
  python_code: string;
}

export interface CreateApiResponse {
  success: boolean;
  api_id?: string;
  api_url?: string;
  input_schema?: object;
  error?: string;
  warning?: string;
}

export interface ExecuteApiRequest {
  [key: string]: any;
}

export interface ExecuteApiResponse {
  success: boolean;
  result?: any;
  execution_time_ms?: number;
  error?: string;
}

export interface ApiDetailsResponse {
  success: boolean;
  api?: ApiRecord;
  recent_executions?: ExecutionRecord[];
  error?: string;
}