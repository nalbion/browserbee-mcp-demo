import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { v4 as generateUuid } from 'uuid';
import { z } from "zod";

const app = document.getElementById('app')!;

export default class MCPServerTransport implements Transport {
  private _sessionId: string;
  private sourceId = 'mcp-server';
  private pingInterval: number;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: { /*authInfo?: AuthInfo*/ }) => void;

  constructor() {
    this._sessionId = generateUuid();

    // Periodically send a ping to notify the extension that the MCP server is available
    this.pingInterval = setInterval(() => {
      this.sendRequestOrNotificationToExtension('ping', {});
    }, 1000);
  }

  async start(): Promise<void> {
    window.addEventListener('message', (e) => {
      const { method, source, ...rest } = e.data as { method?: string, source?: string };
      if (source === this.sourceId) {
        // ignore messages from this mcp-server
        return;
      }

      if (method?.startsWith('mcp:')) {
        const message = { method: method.slice(4), ...rest } as JSONRPCMessage;
        console.info('Demo MCPServerTransport received MCP message:', message);
        this.onmessage?.(message);
      }
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if ('method' in message) {
      const { method, params } = message as { method: string, params?: any };
      this.sendRequestOrNotificationToExtension(method, params);
    } else {
      this.sendMessageToExtension(message);
    }
  }

  async close(): Promise<void> {
    this.onclose?.();
    clearInterval(this.pingInterval);
  }

  private sendRequestOrNotificationToExtension(method: string, params: any) {
    method = 'mcp:' + method;
    this.sendMessageToExtension({ method, params });
  }

  protected sendMessageToExtension(message: any) {
    if (message.method !== 'mcp:ping') {
      console.info('MCPServerTransport sending message:', message);
    }
    message.mcpSessionId = this.sessionId;
    message.source = this.sourceId;
    window.postMessage(message, '*');
  }

  get sessionId(): string {
    return this._sessionId;
  }
}

const server = new McpServer({
  name: "Hello World",
  version: "1.0.0"
});

// Add a tool
server.tool("update_greeting",
  { greeting: z.string(), name: z.string() },
  // "Update the greeting and name",
  async ({ greeting, name }) => {
    render(greeting, name)
    return { content: [{ type: "text", text: "Updated greeting and name" }] }
  }
);

const transport = new MCPServerTransport();
server.connect(transport);

function render(greeting: string = "Hello", username: string = "World") {
  console.info("rendering", app);
  app.innerHTML = `
    <div style="max-width: 400px; margin: 2em auto; font-family: sans-serif; border: 1px solid #ccc; padding: 2em; border-radius: 8px;">
      <h1>${greeting}, ${username}!</h1>
      <div style="margin-bottom: 1em;">
        <label>Greeting: <input id="greetingInput" value="${greeting}" /></label>
      </div>
      <div style="margin-bottom: 1em;">
        <label>Name: <input id="nameInput" value="${username}" /></label>
      </div>
      <button id="updateBtn">Update</button>
    </div>
  `;

  (document.getElementById('updateBtn') as HTMLButtonElement).onclick = () => {
    const greeting = (document.getElementById('greetingInput') as HTMLInputElement).value;
    const username = (document.getElementById('nameInput') as HTMLInputElement).value;
    render(greeting, username);
  };
}

render();
