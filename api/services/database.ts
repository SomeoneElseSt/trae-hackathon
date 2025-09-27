import { createClient } from '@supabase/supabase-js';
import { ApiRecord, ExecutionRecord } from '../types/python';

const supabaseUrl = 'https://jmzkfsbhqeivbgubrigl.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptemtmc2JocWVpdmJndWJyaWdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODk0OTcxNywiZXhwIjoyMDc0NTI1NzE3fQ.IeDZZG3SS-hJZ0Z98Ak233bDnpBODcRpXbuXZV8Ae5A';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class DatabaseService {
  /**
   * Creates a new API record
   */
  static async createApi(data: {
    api_id: string;
    name: string;
    description?: string;
    python_code: string;
    function_name: string;
    input_schema: object;
    output_schema?: object;
  }): Promise<ApiRecord> {
    const { data: result, error } = await supabase
      .from('apis')
      .insert({
        api_id: data.api_id,
        name: data.name,
        description: data.description,
        python_code: data.python_code,
        function_name: data.function_name,
        input_schema: data.input_schema,
        output_schema: data.output_schema
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create API: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Gets an API record by API ID
   */
  static async getApiByApiId(apiId: string): Promise<ApiRecord | null> {
    const { data, error } = await supabase
      .from('apis')
      .select('*')
      .eq('api_id', apiId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get API: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Gets all API records
   */
  static async getAllApis(): Promise<ApiRecord[]> {
    const { data, error } = await supabase
      .from('apis')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get APIs: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Creates a new execution record
   */
  static async createExecution(data: {
    api_id: string;
    input_data: object;
    output_data?: object;
    status: 'pending' | 'success' | 'error';
    error_message?: string;
    execution_time_ms?: number;
  }): Promise<ExecutionRecord> {
    const { data: result, error } = await supabase
      .from('executions')
      .insert({
        api_id: data.api_id,
        input_data: data.input_data,
        output_data: data.output_data,
        status: data.status,
        error_message: data.error_message,
        execution_time_ms: data.execution_time_ms
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create execution: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Gets recent executions for an API
   */
  static async getRecentExecutions(apiId: string, limit: number = 10): Promise<ExecutionRecord[]> {
    const { data, error } = await supabase
      .from('executions')
      .select('*')
      .eq('api_id', apiId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get executions: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Updates an execution record
   */
  static async updateExecution(id: string, data: {
    output_data?: object;
    status?: 'pending' | 'success' | 'error';
    error_message?: string;
    execution_time_ms?: number;
  }): Promise<ExecutionRecord> {
    const { data: result, error } = await supabase
      .from('executions')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update execution: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Checks if an API ID already exists
   */
  static async apiIdExists(apiId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('apis')
      .select('api_id')
      .eq('api_id', apiId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return false; // Not found
    }
    
    return !!data;
  }
}