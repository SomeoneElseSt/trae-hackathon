-- Create APIs table
CREATE TABLE apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  python_code TEXT NOT NULL,
  function_name VARCHAR(255) NOT NULL,
  input_schema JSONB NOT NULL,
  output_schema JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create executions table
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id VARCHAR(255) NOT NULL REFERENCES apis(api_id) ON DELETE CASCADE,
  input_data JSONB NOT NULL,
  output_data JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_apis_api_id ON apis(api_id);
CREATE INDEX idx_executions_api_id ON executions(api_id);
CREATE INDEX idx_executions_created_at ON executions(created_at);

-- Enable Row Level Security
ALTER TABLE apis ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a demo app)
CREATE POLICY "Allow all operations on apis" ON apis
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on executions" ON executions
  FOR ALL USING (true);

-- Grant permissions to anon and authenticated roles
GRANT ALL PRIVILEGES ON apis TO anon;
GRANT ALL PRIVILEGES ON apis TO authenticated;
GRANT ALL PRIVILEGES ON executions TO anon;
GRANT ALL PRIVILEGES ON executions TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;