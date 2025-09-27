import { PythonCodeAnalysis, ValidationResult, FunctionParameter } from '../types/python';

export class PythonValidator {
  /**
   * Validates Python code and extracts function information
   */
  static validateCode(code: string): ValidationResult {
    try {
      const analysis = this.analyzeCode(code);
      
      if (!analysis.hasFunction) {
        return {
          isValid: false,
          error: 'Code must contain at least one function definition',
          analysis: null
        };
      }
      
      if (!analysis.hasInput) {
        return {
          isValid: false,
          error: 'Function must have at least one input parameter',
          analysis: null
        };
      }
      
      if (!analysis.hasOutput) {
        return {
          isValid: false,
          error: 'Function must have a return statement or print statement',
          analysis: null
        };
      }
      
      return {
        isValid: true,
        error: null,
        analysis
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Code analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        analysis: null
      };
    }
  }
  
  /**
   * Analyzes Python code to extract function information
   */
  private static analyzeCode(code: string): PythonCodeAnalysis {
    const lines = code.split('\n').map(line => line.trim());
    const functions: Array<{
      name: string;
      parameters: FunctionParameter[];
      hasReturn: boolean;
      hasPrint: boolean;
    }> = [];
    
    let currentFunction: string | null = null;
    let currentParams: FunctionParameter[] = [];
    let hasReturn = false;
    let hasPrint = false;
    let inFunction = false;
    
    for (const line of lines) {
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      // Function definition
      const funcMatch = line.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:?/);
      if (funcMatch) {
        // Save previous function if exists
        if (currentFunction) {
          functions.push({
            name: currentFunction,
            parameters: currentParams,
            hasReturn,
            hasPrint
          });
        }
        
        currentFunction = funcMatch[1];
        currentParams = this.parseParameters(funcMatch[2]);
        hasReturn = false;
        hasPrint = false;
        inFunction = true;
        continue;
      }
      
      // Check for return statement
      if (inFunction && line.includes('return')) {
        hasReturn = true;
      }
      
      // Check for print statement
      if (inFunction && (line.includes('print(') || line.startsWith('print('))) {
        hasPrint = true;
      }
      
      // End of function (new function or class definition)
      if (inFunction && (line.startsWith('def ') || line.startsWith('class ')) && currentFunction) {
        functions.push({
          name: currentFunction,
          parameters: currentParams,
          hasReturn,
          hasPrint
        });
        inFunction = false;
      }
    }
    
    // Add last function if exists
    if (currentFunction) {
      functions.push({
        name: currentFunction,
        parameters: currentParams,
        hasReturn,
        hasPrint
      });
    }
    
    // Find the main function (first function with parameters)
    const mainFunction = functions.find(f => f.parameters.length > 0) || functions[0];
    
    return {
      hasFunction: functions.length > 0,
      hasInput: mainFunction ? mainFunction.parameters.length > 0 : false,
      hasOutput: mainFunction ? (mainFunction.hasReturn || mainFunction.hasPrint) : false,
      functionName: mainFunction?.name || '',
      parameters: mainFunction?.parameters || [],
      functions
    };
  }
  
  /**
   * Parses function parameters from parameter string
   */
  private static parseParameters(paramStr: string): FunctionParameter[] {
    if (!paramStr.trim()) {
      return [];
    }
    
    const params = paramStr.split(',').map(p => p.trim());
    const result: FunctionParameter[] = [];
    
    for (const param of params) {
      if (!param) continue;
      
      // Handle type hints (e.g., "name: str", "age: int")
      const typeMatch = param.match(/^(\w+)\s*:\s*(\w+)/);
      if (typeMatch) {
        result.push({
          name: typeMatch[1],
          type: this.mapPythonTypeToJsonType(typeMatch[2]),
          required: true
        });
        continue;
      }
      
      // Handle default values (e.g., "name='default'")
      const defaultMatch = param.match(/^(\w+)\s*=/);
      if (defaultMatch) {
        result.push({
          name: defaultMatch[1],
          type: 'string', // Default to string for parameters with defaults
          required: false
        });
        continue;
      }
      
      // Simple parameter name
      const nameMatch = param.match(/^(\w+)$/);
      if (nameMatch) {
        result.push({
          name: nameMatch[1],
          type: 'string', // Default to string
          required: true
        });
      }
    }
    
    return result;
  }
  
  /**
   * Maps Python types to JSON Schema types
   */
  private static mapPythonTypeToJsonType(pythonType: string): string {
    const typeMap: Record<string, string> = {
      'str': 'string',
      'string': 'string',
      'int': 'integer',
      'integer': 'integer',
      'float': 'number',
      'number': 'number',
      'bool': 'boolean',
      'boolean': 'boolean',
      'list': 'array',
      'dict': 'object',
      'object': 'object'
    };
    
    return typeMap[pythonType.toLowerCase()] || 'string';
  }
  
  /**
   * Generates JSON schema from function parameters
   */
  static generateJsonSchema(parameters: FunctionParameter[]): object {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    for (const param of parameters) {
      properties[param.name] = {
        type: param.type,
        description: `Parameter: ${param.name}`
      };
      
      if (param.required) {
        required.push(param.name);
      }
    }
    
    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    };
  }
}