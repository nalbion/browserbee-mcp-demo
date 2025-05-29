# BrowserBee MCP Demo

Minimalist demo of a web app and browser extension which includes an [MCP](https://modelcontextprotocol.io/) server, tested with the [BrowserBee](https://github.com/parsaghaffari/browserbee) extension.

## MCP in the Browser

- All messages are prefixed with `mcp:`
- Additional fields `mcpSessionId` and `source` are added to all messages
- `ping` message is used to advertise the MCP server to the browser extension

## Web App

- `MCPServerTransport` uses `window.postMessage` to communicate with the BrowserBee extension.
