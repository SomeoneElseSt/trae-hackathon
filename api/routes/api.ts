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
  console.log('🚀 [BACKEND] /api/generate route hit');
  console.log('🚀 [BACKEND] Request body:', req.body);
  
  try {
    const { name, description, python_code }: CreateApiRequest = req.body;
    console.log('📋 [BACKEND] Extracted fields:');
    console.log('📋 [BACKEND] - name:', name);
    console.log('📋 [BACKEND] - description:', description);
    console.log('📋 [BACKEND] - python_code length:', python_code?.length || 0);
    
    // Validate required fields
    if (!name || !python_code) {
      console.log('❌ [BACKEND] Validation failed: missing required fields');
      console.log('❌ [BACKEND] - name present:', !!name);
      console.log('❌ [BACKEND] - python_code present:', !!python_code);
      const response: CreateApiResponse = {
        success: false,
        error: 'Name and python_code are required'
      };
      return res.status(400).json(response);
    }
    
    console.log('✅ [BACKEND] Required fields validation passed');
    
    // Validate Python code
    console.log('🔍 [BACKEND] Starting Python code validation');
    const validation = PythonValidator.validateCode(python_code);
    console.log('🔍 [BACKEND] Validation result:', {
      isValid: validation.isValid,
      hasAnalysis: !!validation.analysis,
      error: validation.error
    });
    
    if (!validation.isValid || !validation.analysis) {
      console.log('❌ [BACKEND] Python validation failed:', validation.error);
      const response: CreateApiResponse = {
        success: false,
        error: validation.error || 'Code validation failed'
      };
      return res.status(400).json(response);
    }
    
    console.log('✅ [BACKEND] Python validation passed');
    console.log('✅ [BACKEND] Function name:', validation.analysis.functionName);
    console.log('✅ [BACKEND] Parameters:', validation.analysis.parameters);
    
    // Generate unique API ID
    console.log('🎲 [BACKEND] Generating unique API ID');
    let apiId: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      apiId = IdGenerator.generateApiId();
      attempts++;
      console.log(`🎲 [BACKEND] Generated API ID attempt ${attempts}: ${apiId}`);
      
      if (attempts > maxAttempts) {
        console.log('❌ [BACKEND] Failed to generate unique API ID after max attempts');
        const response: CreateApiResponse = {
          success: false,
          error: 'Failed to generate unique API ID'
        };
        return res.status(500).json(response);
      }
      
      const exists = await DatabaseService.apiIdExists(apiId);
      console.log(`🎲 [BACKEND] API ID ${apiId} exists: ${exists}`);
    } while (await DatabaseService.apiIdExists(apiId));
    
    console.log('✅ [BACKEND] Unique API ID generated:', apiId);
    
    // Generate JSON schema
    console.log('📋 [BACKEND] Generating JSON schema');
    const inputSchema = PythonValidator.generateJsonSchema(validation.analysis.parameters);
    console.log('📋 [BACKEND] Generated schema:', inputSchema);
    
    // Deploy to AWS Lambda and create API Gateway
    console.log('☁️ [BACKEND] Initializing AWS service');
    const awsService = new AWSService();
    const functionName = `codeapi-${apiId}`;
    const roleName = `codeapi-execution-role-${apiId}`;
    console.log('☁️ [BACKEND] AWS function name:', functionName);
    console.log('☁️ [BACKEND] AWS role name:', roleName);
    
    try {
      // Create IAM role for Lambda execution
      console.log('🔐 [BACKEND] Creating IAM role for Lambda execution');
      const roleArn = await awsService.createLambdaExecutionRole(roleName);
      console.log('✅ [BACKEND] IAM role created:', roleArn);
      
      // Wait a bit for role to propagate
      console.log('⏳ [BACKEND] Waiting 10 seconds for role propagation');
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('✅ [BACKEND] Role propagation wait completed');
      
      // Deploy Lambda function
      console.log('🚀 [BACKEND] Deploying Lambda function');
      const lambdaArn = await awsService.deployLambdaFunction(functionName, python_code, roleArn);
      console.log('✅ [BACKEND] Lambda function deployed:', lambdaArn);
      
      // Create API Gateway
      console.log('🌐 [BACKEND] Creating API Gateway');
      const apiGatewayUrl = await awsService.createApiGateway(`codeapi-${apiId}`, lambdaArn);
      console.log('✅ [BACKEND] API Gateway created:', apiGatewayUrl);
      
      // Create API record with AWS details
      console.log('💾 [BACKEND] Saving API record to database');
      const apiRecord = await DatabaseService.createApi({
        api_id: apiId,
        name,
        description,
        python_code,
        function_name: validation.analysis.functionName,
        input_schema: inputSchema
      });
      console.log('✅ [BACKEND] API record saved:', apiRecord.id);
      
      const response: CreateApiResponse = {
        success: true,
        api_id: apiId,
        api_url: apiGatewayUrl,
        input_schema: inputSchema
      };
      
      console.log('🎉 [BACKEND] AWS deployment successful, sending response:', response);
      res.status(201).json(response);
    } catch (awsError) {
      console.log('💥 [BACKEND] AWS deployment error occurred:');
      console.error('💥 [BACKEND] AWS Error details:', awsError);
      console.log('💥 [BACKEND] AWS Error message:', awsError instanceof Error ? awsError.message : 'Unknown AWS error');
      console.log('💥 [BACKEND] AWS Error stack:', awsError instanceof Error ? awsError.stack : 'No stack trace');
      
      // Fallback to local execution for demo
      console.log('🔄 [BACKEND] Falling back to local execution');
      const apiRecord = await DatabaseService.createApi({
        api_id: apiId,
        name,
        description,
        python_code,
        function_name: validation.analysis.functionName,
        input_schema: inputSchema
      });
      console.log('✅ [BACKEND] Local API record saved:', apiRecord.id);
      
      const response: CreateApiResponse = {
        success: true,
        api_id: apiId,
        api_url: `${req.protocol}://${req.get('host')}/api/exec/${apiId}`,
        input_schema: inputSchema,
        warning: 'AWS deployment failed, using local execution'
      };
      
      console.log('⚠️ [BACKEND] Local fallback response:', response);
      res.status(201).json(response);
     }
  } catch (error) {
    console.log('💥 [BACKEND] Main catch block - Unexpected error occurred:');
    console.error('💥 [BACKEND] Main Error details:', error);
    console.log('💥 [BACKEND] Main Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.log('💥 [BACKEND] Main Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const response: CreateApiResponse = {
      success: false,
      error: 'Internal server error'
    };
    
    console.log('💥 [BACKEND] Sending error response:', response);
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