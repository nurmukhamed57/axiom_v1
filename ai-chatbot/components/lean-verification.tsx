"use client";

import React from "react";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface LeanVerificationResult {
  code: string;
  result: {
    success: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
  };
}

interface LeanVerificationProps {
  originalResults?: string;
  correctedResults?: string;
  allPassed: boolean;
  verifications?: LeanVerificationResult[];
}

export function LeanVerification({
  originalResults,
  correctedResults,
  allPassed,
  verifications
}: LeanVerificationProps) {
  const [isExpanded, setIsExpanded] = React.useState(!allPassed);

  const statusIcon = allPassed ? (
    <CheckCircle className="w-5 h-5 text-green-500" />
  ) : (
    <XCircle className="w-5 h-5 text-red-500" />
  );

  const statusText = allPassed
    ? "All Lean code verified successfully"
    : "Lean verification found issues";

  return (
    <div className="border rounded-lg p-4 my-4 bg-gray-50 dark:bg-gray-900">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {statusIcon}
        <span className="font-medium">Lean Verification</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {statusText}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {originalResults && (
            <div>
              <h4 className="font-medium mb-2 text-sm">Initial Verification</h4>
              <div className="bg-white dark:bg-gray-800 rounded p-3 text-sm">
                <pre className="whitespace-pre-wrap">{originalResults}</pre>
              </div>
            </div>
          )}

          {correctedResults && (
            <div>
              <h4 className="font-medium mb-2 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Corrected Code Verification
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded p-3 text-sm">
                <pre className="whitespace-pre-wrap">{correctedResults}</pre>
              </div>
            </div>
          )}

          {verifications && verifications.length > 0 && (
            <div className="space-y-3">
              {verifications.map((verification, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {verification.result.success ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      Code Block {index + 1}
                    </span>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 mb-2">
                    <pre className="text-xs overflow-x-auto">
                      <code>{verification.code}</code>
                    </pre>
                  </div>

                  {verification.result.stdout && (
                    <div className="text-sm">
                      <span className="font-medium text-green-600">Output: </span>
                      <code className="bg-green-50 dark:bg-green-900/20 px-1 rounded">
                        {verification.result.stdout.trim()}
                      </code>
                    </div>
                  )}

                  {verification.result.stderr && (
                    <div className="text-sm text-red-600">
                      <span className="font-medium">Error: </span>
                      <code className="bg-red-50 dark:bg-red-900/20 px-1 rounded">
                        {verification.result.stderr.trim()}
                      </code>
                    </div>
                  )}

                  {verification.result.error && (
                    <div className="text-sm text-red-600">
                      <span className="font-medium">Compilation Error: </span>
                      {verification.result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}