import { FunctionParameter } from '../types/python';

export class PythonExecutor {
  /**
   * Simulates Python code execution with given input data
   * This is a safe simulation that doesn't actually execute Python code
   */
  static async executeCode(
    pythonCode: string,
    functionName: string,
    parameters: FunctionParameter[],
    inputData: Record<string, any>
  ): Promise<{ result: any; executionTime: number }> {
    const startTime = Date.now();
    
    try {
      // Validate input data against parameters
      this.validateInputData(parameters, inputData);
      
      // Simulate execution based on code analysis
      const result = this.simulateExecution(pythonCode, functionName, inputData);
      
      const executionTime = Date.now() - startTime;
      
      return {
        result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      throw new Error(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Validates input data against function parameters
   */
  private static validateInputData(
    parameters: FunctionParameter[],
    inputData: Record<string, any>
  ): void {
    // Check required parameters
    for (const param of parameters) {
      if (param.required && !(param.name in inputData)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
      
      if (param.name in inputData) {
        const value = inputData[param.name];
        const isValidType = this.validateType(value, param.type);
        
        if (!isValidType) {
          throw new Error(`Invalid type for parameter ${param.name}. Expected ${param.type}, got ${typeof value}`);
        }
      }
    }
  }
  
  /**
   * Validates if a value matches the expected type
   */
  private static validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'integer':
        return Number.isInteger(value);
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true; // Allow unknown types
    }
  }
  
  /**
   * Simulates code execution based on code patterns
   */
  private static simulateExecution(
    pythonCode: string,
    functionName: string,
    inputData: Record<string, any>
  ): any {
    const codeLines = pythonCode.split('\n').map(line => line.trim());
    
    // Look for return patterns to simulate realistic output
    for (const line of codeLines) {
      if (line.includes('return')) {
        return this.simulateReturnValue(line, inputData);
      }
      
      if (line.includes('print(')) {
        return this.simulatePrintOutput(line, inputData);
      }
    }
    
    // Default simulation based on input data
    return this.generateDefaultOutput(inputData);
  }
  
  /**
   * Simulates return value based on return statement
   */
  private static simulateReturnValue(returnLine: string, inputData: Record<string, any>): any {
    // Simple pattern matching for common return patterns
    if (returnLine.includes('"') || returnLine.includes("'")) {
      // String return
      const match = returnLine.match(/["']([^"']*)["']/);
      return match ? match[1] : 'Simulated string result';
    }
    
    if (returnLine.match(/return\s+\d+/)) {
      // Number return
      const match = returnLine.match(/return\s+(\d+)/);
      return match ? parseInt(match[1]) : 42;
    }
    
    if (returnLine.includes('True') || returnLine.includes('False')) {
      // Boolean return
      return returnLine.includes('True');
    }
    
    if (returnLine.includes('[') || returnLine.includes('list(')) {
      // Array return
      return Object.values(inputData);
    }
    
    if (returnLine.includes('{') || returnLine.includes('dict(')) {
      // Object return
      return { ...inputData, result: 'processed' };
    }
    
    // Check if return uses input parameters
    const paramNames = Object.keys(inputData);
    for (const paramName of paramNames) {
      if (returnLine.includes(paramName)) {
        const value = inputData[paramName];
        
        // Simulate operations on the parameter
        if (typeof value === 'string') {
          return `Processed: ${value}`;
        }
        if (typeof value === 'number') {
          return value * 2; // Simple transformation
        }
        if (Array.isArray(value)) {
          return [...value, 'processed'];
        }
        if (typeof value === 'object') {
          return { ...value, processed: true };
        }
        
        return value;
      }
    }
    
    return 'Simulated result';
  }
  
  /**
   * Simulates print output
   */
  private static simulatePrintOutput(printLine: string, inputData: Record<string, any>): string {
    // Extract content from print statement
    const match = printLine.match(/print\(([^)]+)\)/);
    if (match) {
      const content = match[1].trim();
      
      // If it's a string literal
      if (content.startsWith('"') || content.startsWith("'")) {
        return content.slice(1, -1);
      }
      
      // If it references input parameters
      const paramNames = Object.keys(inputData);
      for (const paramName of paramNames) {
        if (content.includes(paramName)) {
          return `Output: ${inputData[paramName]}`;
        }
      }
      
      return `Print output: ${content}`;
    }
    
    return 'Print output';
  }
  
  /**
   * Generates default output based on input data
   */
  private static generateDefaultOutput(inputData: Record<string, any>): any {
    const keys = Object.keys(inputData);
    
    if (keys.length === 0) {
      return 'No input provided';
    }
    
    if (keys.length === 1) {
      const value = inputData[keys[0]];
      if (typeof value === 'string') {
        return `Hello, ${value}!`;
      }
      if (typeof value === 'number') {
        return value * 2;
      }
      return value;
    }
    
    // Multiple inputs - return a summary
    return {
      message: 'Function executed successfully',
      inputs: inputData,
      processed_at: new Date().toISOString()
    };
  }
}