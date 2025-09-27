import { LambdaClient, CreateFunctionCommand, InvokeCommand, UpdateFunctionCodeCommand, AddPermissionCommand } from '@aws-sdk/client-lambda';
import { APIGatewayClient, CreateRestApiCommand, CreateResourceCommand, PutMethodCommand, PutIntegrationCommand, CreateDeploymentCommand, GetResourcesCommand } from '@aws-sdk/client-api-gateway';
import { IAMClient, CreateRoleCommand, AttachRolePolicyCommand } from '@aws-sdk/client-iam';
import * as archiver from 'archiver';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

export class AWSService {
  private lambdaClient: LambdaClient;
  private apiGatewayClient: APIGatewayClient;
  private iamClient: IAMClient;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    
    const config = {
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    };

    this.lambdaClient = new LambdaClient(config);
    this.apiGatewayClient = new APIGatewayClient(config);
    this.iamClient = new IAMClient(config);
  }

  async createLambdaExecutionRole(roleName: string): Promise<string> {
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
      const createRoleCommand = new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument),
      });

      const roleResult = await this.iamClient.send(createRoleCommand);
      
      // Attach basic execution policy
      const attachPolicyCommand = new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      });
      
      await this.iamClient.send(attachPolicyCommand);
      
      return roleResult.Role!.Arn!;
    } catch (error: any) {
      if (error.name === 'EntityAlreadyExistsException') {
        // Role already exists, return its ARN
        return `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/${roleName}`;
      }
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
        input_data = event.get('body', {})
        if isinstance(input_data, str):
            input_data = json.loads(input_data)
        
        # Capture stdout
        old_stdout = sys.stdout
        sys.stdout = captured_output = StringIO()
        
        # Execute user code
        exec_globals = {'input_data': input_data}
        exec('''${pythonCode.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n')}''', exec_globals)
        
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
    const zipBuffer = await this.createLambdaDeploymentPackage(pythonCode);

    try {
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

      const result = await this.lambdaClient.send(createFunctionCommand);
      return result.FunctionArn!;
    } catch (error: any) {
      if (error.name === 'ResourceConflictException') {
        // Function exists, update it
        const updateCommand = new UpdateFunctionCodeCommand({
          FunctionName: functionName,
          ZipFile: zipBuffer,
        });
        
        const result = await this.lambdaClient.send(updateCommand);
        return result.FunctionArn!;
      }
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