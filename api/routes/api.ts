import { Router, Request, Response } from 'express';
import { PythonValidator } from '../services/pythonValidator';
import { PythonExecutor } from '../services/pythonExecutor';
import { AWSService } from '../services/awsService';
import { DatabaseService } from '../services/database';
import { IdGenerator } from '../utils/idGenerator';
import {
  CreateApiRequest,
  CreateApiResponse,
  ExecuteApiRequest,
  ExecuteApiResponse,
  ApiDetailsResponse
} from '../types/python';

const router = Router();

/**
 * POST /api/generate
 * Validates Python code and creates a new API
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { name, description, python_code }: CreateApiRequest = req.body;
    
    // Validate required fields
    if (!name || !python_code) {
      const response: CreateApiResponse = {
        success: false,
        error: 'Name and python_code are required'
      };
      return res.status(400).json(response);
    }
    
    // Validate Python code
    const validation = PythonValidator.validateCode(python_code);
    if (!validation.isValid || !validation.analysis) {
      const response: CreateApiResponse = {
        success: false,
        error: validation.error || 'Code validation failed'
      };
      return res.status(400).json(response);
    }
    
    // Generate unique API ID
    let apiId: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      apiId = IdGenerator.generateApiId();
      attempts++;
      
      if (attempts > maxAttempts) {
        const response: CreateApiResponse = {
          success: false,
          error: 'Failed to generate unique API ID'
        };
        return res.status(500).json(response);
      }
    } while (await DatabaseService.apiIdExists(apiId));
    
    // Generate JSON schema
    const inputSchema = PythonValidator.generateJsonSchema(validation.analysis.parameters);
    
    // Deploy to AWS Lambda and create API Gateway
    const awsService = new AWSService();
    const functionName = `codeapi-${apiId}`;
    const roleName = `codeapi-execution-role-${apiId}`;
    
    try {
      // Create IAM role for Lambda execution
      const roleArn = await awsService.createLambdaExecutionRole(roleName);
      
      // Wait a bit for role to propagate
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Deploy Lambda function
      const lambdaArn = await awsService.deployLambdaFunction(functionName, python_code, roleArn);
      
      // Create API Gateway
      const apiGatewayUrl = await awsService.createApiGateway(`codeapi-${apiId}`, lambdaArn);
      
      // Create API record with AWS details
      const apiRecord = await DatabaseService.createApi({
        api_id: apiId,
        name,
        description,
        python_code,
        function_name: validation.analysis.functionName,
        input_schema: inputSchema
      });
      
      const response: CreateApiResponse = {
        success: true,
        api_id: apiId,
        api_url: apiGatewayUrl,
        input_schema: inputSchema
      };
      
      res.status(201).json(response);
    } catch (awsError) {
      console.error('AWS deployment error:', awsError);
      
      // Fallback to local execution for demo
      const apiRecord = await DatabaseService.createApi({
        api_id: apiId,
        name,
        description,
        python_code,
        function_name: validation.analysis.functionName,
        input_schema: inputSchema
      });
      
      const response: CreateApiResponse = {
        success: true,
        api_id: apiId,
        api_url: `${req.protocol}://${req.get('host')}/api/exec/${apiId}`,
        input_schema: inputSchema,
        warning: 'AWS deployment failed, using local execution'
      };
      
      res.status(201).json(response);
     }
  } catch (error) {
    console.error('Error generating API:', error);
    const response: CreateApiResponse = {
      success: false,
      error: 'Internal server error'
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/exec/:apiId
 * Executes an API with provided input data
 */
router.post('/exec/:apiId', async (req: Request, res: Response) => {
  try {
    const { apiId } = req.params;
    const inputData: ExecuteApiRequest = req.body;
    
    // Validate API ID format
    if (!IdGenerator.isValidApiId(apiId)) {
      const response: ExecuteApiResponse = {
        success: false,
        error: 'Invalid API ID format'
      };
      return res.status(400).json(response);
    }
    
    // Get API record
    const apiRecord = await DatabaseService.getApiByApiId(apiId);
    if (!apiRecord) {
      const response: ExecuteApiResponse = {
        success: false,
        error: 'API not found'
      };
      return res.status(404).json(response);
    }
    
    // Create execution record
    const execution = await DatabaseService.createExecution({
      api_id: apiId,
      input_data: inputData,
      status: 'pending'
    });
    
    try {
      // Validate Python code to get parameters
      const validation = PythonValidator.validateCode(apiRecord.python_code);
      if (!validation.isValid || !validation.analysis) {
        throw new Error('Invalid Python code in stored API');
      }
      
      // Execute the code
      const { result, executionTime } = await PythonExecutor.executeCode(
        apiRecord.python_code,
        apiRecord.function_name,
        validation.analysis.parameters,
        inputData
      );
      
      // Update execution record with success
      await DatabaseService.updateExecution(execution.id, {
        output_data: result,
        status: 'success',
        execution_time_ms: executionTime
      });
      
      const response: ExecuteApiResponse = {
        success: true,
        result,
        execution_time_ms: executionTime
      };
      
      res.json(response);
    } catch (executionError) {
      // Update execution record with error
      await DatabaseService.updateExecution(execution.id, {
        status: 'error',
        error_message: executionError instanceof Error ? executionError.message : 'Unknown error'
      });
      
      const response: ExecuteApiResponse = {
        success: false,
        error: executionError instanceof Error ? executionError.message : 'Execution failed'
      };
      
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('Error executing API:', error);
    const response: ExecuteApiResponse = {
      success: false,
      error: 'Internal server error'
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/details/:apiId
 * Gets API details and recent executions
 */
router.get('/details/:apiId', async (req: Request, res: Response) => {
  try {
    const { apiId } = req.params;
    
    // Validate API ID format
    if (!IdGenerator.isValidApiId(apiId)) {
      const response: ApiDetailsResponse = {
        success: false,
        error: 'Invalid API ID format'
      };
      return res.status(400).json(response);
    }
    
    // Get API record
    const apiRecord = await DatabaseService.getApiByApiId(apiId);
    if (!apiRecord) {
      const response: ApiDetailsResponse = {
        success: false,
        error: 'API not found'
      };
      return res.status(404).json(response);
    }
    
    // Get recent executions
    const recentExecutions = await DatabaseService.getRecentExecutions(apiId, 10);
    
    const response: ApiDetailsResponse = {
      success: true,
      api: apiRecord,
      recent_executions: recentExecutions
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting API details:', error);
    const response: ApiDetailsResponse = {
      success: false,
      error: 'Internal server error'
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/list
 * Gets all APIs
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const apis = await DatabaseService.getAllApis();
    
    res.json({
      success: true,
      apis
    });
  } catch (error) {
    console.error('Error listing APIs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;