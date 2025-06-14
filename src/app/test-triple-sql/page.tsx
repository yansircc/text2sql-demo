"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, Users } from "lucide-react";

export default function TestTripleSql() {
  const [query, setQuery] = useState("找一下对文档管理相关产品感兴趣的德国3星以上的客户，帮我调出他们的手机号");
  const [useTriple, setUseTriple] = useState(true);
  
  // Run workflow with standard SQL builder
  const standardMutation = api.workflow.execute.useMutation();
  
  // Run workflow with triple SQL builder
  const tripleMutation = api.workflow.execute.useMutation();
  
  const handleTest = async (triple: boolean) => {
    try {
      console.log(`Running workflow with ${triple ? 'Triple' : 'Standard'} SQL Builder...`);
      
      // Get database schema
      const schemaResponse = await fetch('/db-schema.json');
      const databaseSchema = await schemaResponse.text();
      
      const mutation = triple ? tripleMutation : standardMutation;
      
      await mutation.mutateAsync({
        query,
        databaseSchema,
        options: {
          useTripleSqlBuilder: triple,
          enableCache: false,
        },
      });
      
    } catch (error) {
      console.error("Test failed:", error);
    }
  };
  
  const isExecuting = standardMutation.isPending || tripleMutation.isPending;
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Triple SQL Builder vs Standard Comparison</h1>
      
      {/* Query Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Query</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your natural language query..."
            className="min-h-[100px]"
          />
          <div className="flex gap-4">
            <Button 
              onClick={() => handleTest(false)} 
              disabled={isExecuting || !query}
              variant={!useTriple ? "default" : "outline"}
            >
              {standardMutation.isPending ? "Running Standard..." : "Run Standard SQL Builder"}
            </Button>
            <Button 
              onClick={() => handleTest(true)} 
              disabled={isExecuting || !query}
              variant={useTriple ? "default" : "outline"}
            >
              {tripleMutation.isPending ? "Running Triple..." : "Run Triple SQL Builder (3+3)"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Results Comparison */}
      <div className="grid grid-cols-2 gap-6">
        {/* Standard Result */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Standard SQL Builder
          </h2>
          {standardMutation.data && (
            <ResultDisplay result={standardMutation.data} type="standard" />
          )}
          {standardMutation.isError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-600">{standardMutation.error?.message}</p>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Triple Result */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Triple SQL Builder (3+3 Strategy)
          </h2>
          {tripleMutation.data && (
            <ResultDisplay result={tripleMutation.data} type="triple" />
          )}
          {tripleMutation.isError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-600">{tripleMutation.error?.message}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultDisplay({ result, type }: { result: any; type: 'standard' | 'triple' }) {
  const sqlStep = result.metadata?.steps?.find((s: any) => s.name === 'SQLBuilding');
  const executionStep = result.metadata?.steps?.find((s: any) => s.name === 'SQLExecution');
  
  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Execution Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Status</span>
            <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
              {result.status}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Strategy</span>
            <Badge variant="outline">{result.strategy}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Time</span>
            <span className="font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {(result.metadata.totalTime / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Row Count</span>
            <span className="font-semibold">{result.rowCount || 0}</span>
          </div>
          {sqlStep && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">SQL Build Time</span>
              <span className="font-mono">{(sqlStep.time / 1000).toFixed(2)}s</span>
            </div>
          )}
          {result.metadata.sqlModel && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Model</span>
              <Badge variant="secondary">{result.metadata.sqlModel}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* SQL Display */}
      {result.metadata.sql && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generated SQL</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              <code>{result.metadata.sql}</code>
            </pre>
          </CardContent>
        </Card>
      )}
      
      {/* Data Preview */}
      {result.data && result.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Result Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs overflow-x-auto">
              <pre>{JSON.stringify(result.data.slice(0, 3), null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}