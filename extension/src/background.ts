import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { v4 as generateUuid } from 'uuid';

// const browserbeeExtensionId = 'ilkklnfjpfoibgokaobmjhmdamogjcfj'; // prod
const browserbeeExtensionId = 'iegmbfhabdlajoplgfiaamjmknnniiob'; // chrome://extensions/?

function pressLucky() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]?.id) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        files: ['content.js']
      });
    }
  });
}

chrome.commands?.onCommand.addListener((command) => {
  if (command === 'press_lucky') {
    pressLucky();
  }
});

interface MCPMessage {
  method: string;
  source?: string;
}

export default class MCPServerTransport implements Transport {
  private _sessionId: string;
  private sourceId = 'mcp-server';
  private pingInterval: NodeJS.Timeout;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: { /*authInfo?: AuthInfo*/ }) => void;

  constructor() {
    this._sessionId = generateUuid();
    console.info('MCPServerTransport constructor', this._sessionId);

    // Periodically send a ping to notify the extension that the MCP server is available
    this.pingInterval = setInterval(() => {
      this.sendRequestOrNotificationToExtension('ping', {});
    }, 1000);
  }

  async start(): Promise<void> {
    // window.addEventListener('message', (e) => {
    //   this.handleMessage(e.data as MCPMessage);
    // });
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message);
    });

    chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      console.info('MCPServerTransport received external message:', message);
      this.handleMessage(message);
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

  private handleMessage(message: MCPMessage) {
    const { method, source, ...rest } = message;
      if (source === this.sourceId) {
        // ignore messages from this mcp-server
        return;
      }

      if (method?.startsWith('mcp:')) {
        const message = { method: method.slice(4), ...rest } as JSONRPCMessage;
        console.info('Demo MCPServerTransport received MCP message:', message);
        this.onmessage?.(message);
      }
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
    // window.postMessage(message, '*');
    chrome.runtime.sendMessage(browserbeeExtensionId, message).then((response) => {
      console.info('MCPServerTransport received response:', response);
    }, (error) => {
      console.error('MCPServerTransport received error:', error);
    });
  }

  get sessionId(): string {
    return this._sessionId;
  }
}

const server = new McpServer({
  name: 'Google MCP',
  version: '1.0.0'
});

// Add a tool
server.tool('press_lucky',
  `Presses the "I'm Feeling Lucky" button on google.com`,
  async () => {
    pressLucky();
    return { content: [{ type: 'text', text: `The "I'm feeling lucky" button was pressed` }] }
  }
);

const transport = new MCPServerTransport();
server.connect(transport);
