"use client";

import { useCallback, useRef } from "react";

export type ApiLog = {
  type: string;
  method: string;
  url: string;
  status: number;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  timestamp: string;
};

/**
 * Convert the API logs into a Postman Collection v2.1 JSON
 */
function buildPostmanCollection(logs: ApiLog[]) {
  const items = logs.map((log, i) => {
    const cleanUrl = log.url
      .replace(/^\/api\/paypal\//, "{{baseUrl}}/")
      .replace(/\/orders\/([^/]+)\/final/, "{{baseUrl}}/orders/{{orderId}}/final");

    return {
      name: `${i + 1}. ${log.type}`,
      event: [
        {
          listen: "test",
          script: {
            exec: [
              'pm.test("Status code is ' + log.status + '", function () {',
              "  pm.response.to.have.status(" + log.status + ");",
              "});",
            ],
            type: "text/javascript",
          },
        },
      ],
      request: {
        method: log.method,
        header: [
          {
            key: "Content-Type",
            value: "application/json",
          },
          {
            key: "Authorization",
            value: "Bearer {{accessToken}}",
          },
        ],
        url: {
          raw: `https://api-m.sandbox.paypal.com${log.url
            .replace(/^\/api\/paypal\//, "/v2/checkout/")
            .replace(/\/orders\/[^/]+\/final/, "/v2/checkout/orders/{{orderId}}")}`,
          host: ["https://api-m.sandbox.paypal.com"],
          path: log.url
            .replace(/^\/api\/paypal\//, "")
            .replace(/\/orders\/[^/]+\/final/, "/orders/{{orderId}}")
            .split("/"),
          variable: log.url.includes("orderId=")
            ? [
                {
                  key: "orderId",
                  value: "{{orderId}}",
                },
              ]
            : [],
          query: log.url.includes("?")
            ? [
                {
                  key: log.url.split("?")[1]?.split("=")[0],
                  value: "{{orderId}}",
                },
              ]
            : [],
        },
        body:
          log.method !== "GET" && log.request && Object.keys(log.request).length > 0
            ? {
                mode: "raw",
                raw: JSON.stringify(log.request, null, 2),
              }
            : undefined,
        description: `API Call: ${log.type} — ${log.method} ${log.url}`,
      },
      response: [
        {
          name: `${log.type} Response`,
          status: log.status < 400 ? "OK" : "Error",
          code: log.status,
          header: [
            {
              key: "Content-Type",
              value: "application/json",
            },
          ],
          body: JSON.stringify(log.response, null, 2),
        },
      ],
    };
  });

  return {
    info: {
      name: "PayPal Sandbox — ECS Flow Export",
      description:
        "Auto-exported from PayPal Demo confirmation page. Load this into Postman to replay the exact API calls.",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      {
        key: "baseUrl",
        value: "https://api-m.sandbox.paypal.com/v2/checkout",
        type: "string",
      },
      {
        key: "accessToken",
        value: "YOUR_ACCESS_TOKEN",
        type: "string",
      },
      {
        key: "orderId",
        value: "",
        type: "string",
      },
    ],
    item: items,
  };
}

export default function ApiHistoryPanel({ logs }: { logs: ApiLog[] }) {
  const exportRef = useRef<HTMLAnchorElement>(null);

  const handleExport = useCallback(() => {
    const collection = buildPostmanCollection(logs);
    const blob = new Blob([JSON.stringify(collection, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paypal-ecs-flow-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.postman_collection.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  return (
    <div className="w-[480px] shrink-0 border-l border-[var(--border)] bg-[#0d1117] text-[#c9d1d9] flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-[#30363d]">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b949e]">API History</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#484f58]">{logs.length} calls</span>
          {logs.length > 0 && (
            <button
              onClick={handleExport}
              className="text-[10px] px-2 py-1 rounded bg-[#21262d] text-[#58a6ff] hover:bg-[#30363d] cursor-pointer"
              title="Export to Postman"
            >
              ⬇ Export
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-[11px]">
        {logs.length === 0 && (
          <p className="text-[#484f58] italic text-center pt-8">No API calls yet</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className="bg-[#161b22] rounded p-2 border border-[#21262d]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#58a6ff] font-semibold">{log.type}</span>
              <span className="text-[#484f58]">{log.timestamp}</span>
            </div>
            <div className="text-[#8b949e] mb-1">
              {log.method} {log.url}{" "}
              <span className={log.status < 400 ? "text-[#3fb950]" : "text-[#f85149]"}>
                {log.status}
              </span>
            </div>
            {log.request && (
              <details className="mb-1">
                <summary className="text-[#d2a8ff] cursor-pointer text-[10px]">Request</summary>
                <pre className="text-[#e6edf3] whitespace-pre-wrap break-all mt-1 pl-2 text-[10px]">
                  {JSON.stringify(log.request, null, 2)}
                </pre>
              </details>
            )}
            {log.response && (
              <details>
                <summary className="text-[#7ee787] cursor-pointer text-[10px]">Response</summary>
                <pre className="text-[#e6edf3] whitespace-pre-wrap break-all mt-1 pl-2 text-[10px]">
                  {JSON.stringify(log.response, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
