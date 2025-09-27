import { LambdaClient, CreateFunctionCommand, InvokeCommand, UpdateFunctionCodeCommand, AddPermissionCommand } from '@aws-sdk/client-lambda';
import { APIGatewayClient, CreateRestApiCommand, CreateResourceCommand, PutMethodCommand, PutIntegrationCommand, CreateDeploymentCommand, GetResourcesCommand } from '@aws-sdk/client-api-gateway';
import { IAMClient, CreateRoleCommand, AttachRolePolicyCommand } from '@aws-sdk/client-iam';
import archiver from 'archiver';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

export class AWSService {
  private lambdaClient: LambdaClient;
  private apiGatewayClient: APIGatewayClient;
  private iamClient: IAMClient;
  private region: string;

  constructor() {
    console.log('☁️ [AWS] Initializing AWS Service');
    
    this.region = process.env.AWS_REGION || 'us-east-1';
    console.log('☁️ [AWS] Region:', this.region);
    
    // Check AWS credentials
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const accountId = process.env.AWS_ACCOUNT_ID;
    
    console.log('🔑 [AWS] Credentials check:');
    console.log('🔑 [AWS] - AWS_ACCESS_KEY_ID present:', !!accessKeyId);
    console.log('🔑 [AWS] - AWS_ACCESS_KEY_ID length:', accessKeyId?.length || 0);
    console.log('🔑 [AWS] - AWS_SECRET_ACCESS_KEY present:', !!secretAccessKey);
    console.log('🔑 [AWS] - AWS_SECRET_ACCESS_KEY length:', secretAccessKey?.length || 0);
    console.log('🔑 [AWS] - AWS_ACCOUNT_ID present:', !!accountId);
    console.log('🔑 [AWS] - AWS_ACCOUNT_ID:', accountId);
    
    if (!accessKeyId || !secretAccessKey) {
      console.log('❌ [AWS] Missing required AWS credentials!');
      throw new Error('Missing AWS credentials: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required');
    }
    
    const config = {
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    };
    
    console.log('☁️ [AWS] Creating AWS clients...');
    this.lambdaClient = new LambdaClient(config);
    this.apiGatewayClient = new APIGatewayClient(config);
    this.iamClient = new IAMClient(config);
    console.log('✅ [AWS] AWS Service initialized successfully');
  }

  async createLambdaExecutionRole(roleName: string): Promise<string> {
    console.log('🔐 [AWS] Creating IAM role:', roleName);
    
    const assumeRolePolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    };

    try {
      console.log('🔐 [AWS] Sending CreateRoleCommand...');
      const createRoleCommand = new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument),
      });

      const roleResult = await this.iamClient.send(createRoleCommand);
      console.log('✅ [AWS] Role created successfully:', roleResult.Role?.Arn);
      
      // Attach basic execution policy
      console.log('🔐 [AWS] Attaching basic execution policy...');
      const attachPolicyCommand = new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      });
      
      await this.iamClient.send(attachPolicyCommand);
      console.log('✅ [AWS] Policy attached successfully');
      
      return roleResult.Role!.Arn!;
    } catch (error: any) {
      console.log('⚠️ [AWS] Role creation error:', error.name, error.message);
      if (error.name === 'EntityAlreadyExistsException') {
        // Role already exists, return its ARN
        const existingRoleArn = `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/${roleName}`;
        console.log('ℹ️ [AWS] Role already exists, using existing ARN:', existingRoleArn);
        return existingRoleArn;
      }
      console.log('❌ [AWS] Failed to create role:', error);
      throw error;
    }
  }

  async createLambdaDeploymentPackage(pythonCode: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Create lambda_function.py with user code
      const lambdaHandler = `
import json
import sys
from io import StringIO

def lambda_handler(event, context):
    try:
        # Get input data from event
        # Handle API Gateway proxy integration (body is a string)
        if 'body' in event:
            if isinstance(event['body'], str):
                # API Gateway sends body as JSON string
                input_data = json.loads(event['body']) if event['body'] else {}
            else:
                # Direct Lambda invocation (body is already parsed)
                input_data = event['body'] or {}
        else:
            # Fallback: event itself might be the input data
            input_data = event
        
        # Capture stdout
        old_stdout = sys.stdout
        sys.stdout = captured_output = StringIO()
        
        # Execute user code
        exec_globals = {}
        user_code = '''${pythonCode}'''
        exec(user_code, exec_globals)
        
        # Get captured output
        output = captured_output.getvalue()
        sys.stdout = old_stdout
        
        # Try to get return value if function was defined
        result = None
        if 'main' in exec_globals and callable(exec_globals['main']):
            result = exec_globals['main'](input_data)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps({
                'result': result,
                'output': output,
                'success': True
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'success': False
            })
        }
`;

      archive.append(lambdaHandler, { name: 'lambda_function.py' });
      archive.finalize();
    });
  }

  async deployLambdaFunction(functionName: string, pythonCode: string, roleArn: string): Promise<string> {
    console.log('🚀 [AWS] Starting Lambda deployment...');
    console.log('🚀 [AWS] Function name:', functionName);
    console.log('🚀 [AWS] Role ARN:', roleArn);
    console.log('🚀 [AWS] Python code length:', pythonCode.length);
    
    console.log('📦 [AWS] Creating deployment package...');
    const zipBuffer = await this.createLambdaDeploymentPackage(pythonCode);
    console.log('📦 [AWS] Deployment package size:', zipBuffer.length, 'bytes');

    try {
      console.log('🚀 [AWS] Creating Lambda function...');
      const createFunctionCommand = new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: 'python3.9',
        Role: roleArn,
        Handler: 'lambda_function.lambda_handler',
        Code: {
          ZipFile: zipBuffer,
        },
        Timeout: 30,
        MemorySize: 128,
      });

      console.log('🚀 [AWS] Sending CreateFunctionCommand...');
      const result = await this.lambdaClient.send(createFunctionCommand);
      console.log('✅ [AWS] Lambda function created successfully:', result.FunctionArn);
      return result.FunctionArn!;
    } catch (error: any) {
      console.log('⚠️ [AWS] Lambda creation error:', error.name, error.message);
      console.log('⚠️ [AWS] Full error details:', error);
      
      if (error.name === 'ResourceConflictException') {
        console.log('🔄 [AWS] Function exists, updating code...');
        // Function exists, update it
        const updateCommand = new UpdateFunctionCodeCommand({
          FunctionName: functionName,
          ZipFile: zipBuffer,
        });
        
        console.log('🔄 [AWS] Sending UpdateFunctionCodeCommand...');
        const result = await this.lambdaClient.send(updateCommand);
        console.log('✅ [AWS] Lambda function updated successfully:', result.FunctionArn);
        return result.FunctionArn!;
      }
      
      console.log('❌ [AWS] Failed to deploy Lambda function:', error);
      throw error;
    }
  }

  async createApiGateway(apiName: string, lambdaArn: string): Promise<string> {
    // Create REST API
    const createApiCommand = new CreateRestApiCommand({
      name: apiName,
      description: 'Auto-generated API for Python code execution',
    });

    const apiResult = await this.apiGatewayClient.send(createApiCommand);
    const apiId = apiResult.id!;

    // Get root resource ID
    const getResourcesCommand = new GetResourcesCommand({
      restApiId: apiId
    });
    const resources = await this.apiGatewayClient.send(getResourcesCommand);
    
    const rootResourceId = resources.items![0].id!;

    // Create resource
    const createResourceCommand = new CreateResourceCommand({
      restApiId: apiId,
      parentId: rootResourceId,
      pathPart: 'execute',
    });

    const resourceResult = await this.apiGatewayClient.send(createResourceCommand);
    const resourceId = resourceResult.id!;

    // Create POST method
    const putMethodCommand = new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'POST',
      authorizationType: 'NONE',
    });

    await this.apiGatewayClient.send(putMethodCommand);

    // Create integration
    const putIntegrationCommand = new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'POST',
      type: 'AWS_PROXY',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`,
    });

    await this.apiGatewayClient.send(putIntegrationCommand);

    // Add permission for API Gateway to invoke Lambda
    try {
      const addPermissionCommand = new AddPermissionCommand({
        FunctionName: lambdaArn,
        StatementId: `apigateway-invoke-${Date.now()}`,
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        SourceArn: `arn:aws:execute-api:${this.region}:*:${apiId}/*/*`,
      });
      
      await this.lambdaClient.send(addPermissionCommand);
    } catch (permissionError: any) {
      // Permission might already exist, continue
      console.log('Permission might already exist:', permissionError.message);
    }

    // Deploy API
    const createDeploymentCommand = new CreateDeploymentCommand({
      restApiId: apiId,
      stageName: 'prod',
    });

    await this.apiGatewayClient.send(createDeploymentCommand);

    return `https://${apiId}.execute-api.${this.region}.amazonaws.com/prod/execute`;
  }

  async invokeLambda(functionName: string, payload: any): Promise<any> {
    const invokeCommand = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
    });

    const result = await this.lambdaClient.send(invokeCommand);
    const responsePayload = JSON.parse(new TextDecoder().decode(result.Payload));
    
    return responsePayload;
  }
}