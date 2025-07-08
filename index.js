const express = require('express');
const app = express();

// Config
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check route
app.get('/', (_req, res) => {
  res.json({ message: 'MCP server running!' });
});

// Example API route
app.get('/api/ping', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Basic in-memory list of SSE clients
const sseClients = new Set();

// Helper to send SSE data
function sendSSE(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// Sample MCP metadata
const MCP_VERSION = "2025-06-18";
const SERVER_INFO = { name: "sample-mcp-node", version: "1.0.0" };
// Centralized base for Hushh API
const HUSHH_BASE = "https://hushh-api-53407187172.us-central1.run.app";
const TOOLS = [
  {
    name: "echo",
    description: "Echo back a message",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Message to echo back"
        }
      },
      required: ["message"],
    },
  },
  {
    name: "ping_api",
    description: "Call GET /api/ping endpoint and return the JSON response",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "generate_token",
    description: "Generate an API key for a given email using the external Hushh endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        mail: {
          type: "string",
          description: "Email address to generate the API key for",
        },
      },
      required: [],
    },
  },
  {
    name: "generate_session_token",
    description: "Generate a session token using the external Hushh endpoint (requires api_key).",
    inputSchema: {
      type: "object",
      properties: {
        mail: { type: "string", description: "Email address" },
        api_key: { type: "string", description: "Previously generated API key" },
      },
      required: ["mail", "api_key"],
    },
  },
  {
    name: "validate_token",
    description: "Validate a session token using the external Hushh endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Session token to validate" },
      },
      required: ["token"],
    },
  },
  {
    name: "get_all_installed_cards",
    description: "Retrieve all installed cards for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string", description: "Phone number" },
        token: { type: "string", description: "Session token" },
      },
      required: ["phone_number", "token"],
    },
  },
  {
    name: "get_consented_cards",
    description: "Retrieve all consented cards for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string", description: "Phone number" },
        token: { type: "string", description: "Session token" },
      },
      required: ["phone_number", "token"],
    },
  },
  {
    name: "request_consent",
    description: "Request consent for a card with bid value.",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        access_token: { type: "string" },
        card_name: { type: "string" },
        expiry: { type: "string" },
        bid_value: { type: "number" },
      },
      required: ["phone_number", "access_token", "card_name", "expiry", "bid_value"],
    },
  },
  {
    name: "insert_receipt_data",
    description: "Insert receipt data for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
        brand: { type: "string" },
        location: { type: "string" },
        purchase_category: { type: "string" },
        brand_category: { type: "string" },
        Date: { type: "string" },
        currency: { type: "string" },
        payment_method: { type: "string" },
        total_cost: { type: "number" },
        inr_total_cost: { type: "number" },
        usd_total_cost: { type: "number" },
      },
      required: [
        "phone_number",
        "token",
        "brand",
        "location",
        "purchase_category",
        "brand_category",
        "Date",
        "currency",
        "payment_method",
        "total_cost",
        "inr_total_cost",
        "usd_total_cost",
      ],
    },
  },
  {
    name: "get_receipt_data",
    description: "Retrieve receipt data for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string", description: "Phone number" },
        token: { type: "string", description: "Session token" },
      },
      required: ["phone_number", "token"],
    },
  },
  {
    name: "insert_health_data",
    description: "Insert health data answers for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
        answers: {
          type: "array",
          description: "Array of answer objects",
          items: { type: "object" },
        },
      },
      required: ["phone_number", "token", "answers"],
    },
  },
  {
    name: "get_health_data",
    description: "Retrieve health data for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
      },
      required: ["phone_number", "token"],
    },
  },
  {
    name: "insert_browsing_data",
    description: "Insert browsing data for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
        website_url: { type: "string" },
        visit_time: { type: "string" },
        product_clicks: { type: "number" },
        interest_keywords: { type: "string" },
        brand: { type: "string" },
        source: { type: "string" },
        duration: { type: "number" },
      },
      required: [
        "phone_number",
        "token",
        "website_url",
        "visit_time",
        "product_clicks",
        "interest_keywords",
        "brand",
        "source",
        "duration",
      ],
    },
  },
  {
    name: "get_browsing_data",
    description: "Retrieve browsing data for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
      },
      required: ["phone_number", "token"],
    },
  },
  {
    name: "insert_brand_preference_data",
    description: "Insert brand preference answers for a given phone number and brand (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        brand_name: { type: "string" },
        token: { type: "string" },
        answers: {
          type: "array",
          items: { type: "object" },
          description: "Array of answer objects",
        },
      },
      required: ["phone_number", "brand_name", "token", "answers"],
    },
  },
  {
    name: "get_brand_preference",
    description: "Retrieve brand preference data for a phone number and brand (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        brand_name: { type: "string" },
        token: { type: "string" },
      },
      required: ["phone_number", "brand_name", "token"],
    },
  },
  {
    name: "insert_fashion_data",
    description: "Insert fashion preference answers for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
        answers: {
          type: "array",
          items: { type: "object" },
          description: "Array of answer objects",
        },
      },
      required: ["phone_number", "token", "answers"],
    },
  },
  {
    name: "get_fashion_data",
    description: "Retrieve fashion data for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
      },
      required: ["phone_number", "token"],
    },
  },
  {
    name: "get_food_data",
    description: "Retrieve food data for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
      },
      required: ["phone_number", "token"],
    },
  },
  {
    name: "get_insurance_data",
    description: "Retrieve insurance data for a phone number (requires session token).",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: { type: "string" },
        token: { type: "string" },
      },
      required: ["phone_number", "token"],
    },
  },
];

/**
 * GET /sse — establishes the server-sent events stream that Cursor listens to.
 * We immediately push an `mcp/hello` notification containing protocol version
 * and our capabilities.
 */
app.get('/sse', (req, res) => {
  // Set required SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Flush the headers to establish SSE
  res.flushHeaders?.(); // flushHeaders is only present when using compression middleware

  // Store connection so we can push notifications later if desired
  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });

  // Send initial hello notification
  const helloMsg = {
    jsonrpc: '2.0',
    method: 'mcp/hello',
    params: {
      protocolVersion: MCP_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
    },
  };
  sendSSE(res, helloMsg);
});

/**
 * POST /sse — Cursor sends JSON-RPC requests here; we reply synchronously
 * with the JSON-RPC response object.
 */
app.post('/sse', async (req, res) => {
  const message = req.body;
  if (!message || message.jsonrpc !== '2.0') {
    return res.status(400).json({ error: 'Invalid JSON-RPC message' });
  }

  const { id, method, params } = message;

  // Helper to return success
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  // Helper to return error
  const errorReply = (code, messageStr) => ({
    jsonrpc: '2.0',
    id,
    error: { code, message: messageStr },
  });

  switch (method) {
    case 'initialize': {
      return res.json(
        reply({
          protocolVersion: MCP_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        })
      );
    }
    case 'tools/list': {
      return res.json(reply({ tools: TOOLS }));
    }
    case 'tools/call': {
      if (!params || !params.name) {
        return res.json(errorReply(-32602, 'Missing tool name'));
      }
      // Echo tool
      if (params.name === 'echo') {
        const { message: msg } = params.arguments || {};
        const contentText = typeof msg === 'string' ? `Echo: ${msg}` : 'No message provided';
        return res.json(
          reply({
            content: [
              { type: 'text', text: contentText },
            ],
            isError: false,
          }),
        );
      }
      // Ping API tool
      if (params.name === 'ping_api') {
        try {
          const apiRes = await fetch(`http://localhost:${PORT}/api/ping`).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(apiRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to call /api/ping: ${err.message}`));
        }
      }
      // Generate token tool
      if (params.name === 'generate_token') {
        try {
          const mail = params.arguments?.mail || 'i-sanipatel@hushh.ai';
          const url = `${HUSHH_BASE}/generateapikey?mail=${encodeURIComponent(mail)}`;
          const tokenRes = await fetch(url, {
            method: 'POST',
            headers: { accept: 'application/json' },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(tokenRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to generate token: ${err.message}`));
        }
      }
      // Generate session token tool
      if (params.name === 'generate_session_token') {
        try {
          const { mail, api_key } = params.arguments || {};
          if (!mail || !api_key) {
            return res.json(errorReply(-32602, 'mail and api_key are required'));
          }
          const url = `${HUSHH_BASE}/sessiontoken?mail=${encodeURIComponent(mail)}&api_key=${encodeURIComponent(api_key)}`;
          const sessionRes = await fetch(url, {
            method: 'POST',
            headers: { accept: 'application/json' },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(sessionRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to generate session token: ${err.message}`));
        }
      }
      // Validate token tool
      if (params.name === 'validate_token') {
        try {
          const { token } = params.arguments || {};
          if (!token) {
            return res.json(errorReply(-32602, 'token is required'));
          }
          const url = `${HUSHH_BASE}/validatetoken?token=${encodeURIComponent(token)}`;
          const validateRes = await fetch(url, {
            method: 'POST',
            headers: { accept: 'application/json' },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(validateRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to validate token: ${err.message}`));
        }
      }
      // Get installed cards tool
      if (params.name === 'get_all_installed_cards') {
        try {
          const { phone_number, token } = params.arguments || {};
          if (!phone_number || !token) {
            return res.json(errorReply(-32602, 'phone_number and token are required'));
          }
          const url = `${HUSHH_BASE}/api/v1/list-installed-cards?phone_number=${encodeURIComponent(phone_number)}`;
          const cardsRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
            },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(cardsRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to list installed cards: ${err.message}`));
        }
      }
      // Get consented cards tool
      if (params.name === 'get_consented_cards') {
        try {
          const { phone_number, token } = params.arguments || {};
          if (!phone_number || !token) {
            return res.json(errorReply(-32602, 'phone_number and token are required'));
          }
          const url = `${HUSHH_BASE}/api/v1/list-consented-cards?phone_number=${encodeURIComponent(phone_number)}`;
          const cardsRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
            },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(cardsRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to list consented cards: ${err.message}`));
        }
      }
      // Request consent tool
      if (params.name === 'request_consent') {
        try {
          const { phone_number, access_token, card_name, expiry, bid_value } = params.arguments || {};
          if (!phone_number || !access_token || !card_name || !expiry || bid_value === undefined) {
            return res.json(errorReply(-32602, 'All fields are required'));
          }
          const url = ;
          const body = JSON.stringify({ phone_number, access_token, card_name, expiry, bid_value });
          const consentRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body,
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(consentRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to request consent: ${err.message}`));
        }
      }
      // Insert receipt data tool
      if (params.name === 'insert_receipt_data') {
        try {
          const {
            phone_number,
            token,
            brand,
            location,
            purchase_category,
            brand_category,
            Date: purchaseDate,
            currency,
            payment_method,
            total_cost,
            inr_total_cost,
            usd_total_cost,
          } = params.arguments || {};
          if (
            !phone_number ||
            !token ||
            !brand ||
            !location ||
            !purchase_category ||
            !brand_category ||
            !purchaseDate ||
            !currency ||
            !payment_method ||
            total_cost === undefined ||
            inr_total_cost === undefined ||
            usd_total_cost === undefined
          ) {
            return res.json(errorReply(-32602, 'All fields are required'));
          }
          const url = `${HUSHH_BASE}/api/v1/insert-receipt-data?phone_number=${encodeURIComponent(phone_number)}`;
          const body = JSON.stringify({
            brand,
            location,
            purchase_category,
            brand_category,
            Date: purchaseDate,
            currency,
            payment_method,
            total_cost,
            inr_total_cost,
            usd_total_cost,
          });
          const receiptRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
              'Content-Type': 'application/json',
            },
            body,
          }).then((r) => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(receiptRes, null, 2) },
              ],
              isError: false,
            }),
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to insert receipt data: ${err.message}`));
        }
      }
      // Get receipt data tool
      if (params.name === 'get_receipt_data') {
        try {
          const { phone_number, token } = params.arguments || {};
          if (!phone_number || !token) {
            return res.json(errorReply(-32602, 'phone_number and token are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/get-receipt-data?phone_number=${encodeURIComponent(phone_number)}`;
          const dataRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
            },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(dataRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to get receipt data: ${err.message}`));
        }
      }
      // Insert health data tool
      if (params.name === 'insert_health_data') {
        try {
          const { phone_number, token, answers } = params.arguments || {};
          if (!phone_number || !token || !Array.isArray(answers)) {
            return res.json(errorReply(-32602, 'phone_number, token and answers array are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/insert-health-data?phone_number=${encodeURIComponent(phone_number)}`;
          const body = JSON.stringify({ answers });
          const healthRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
              'Content-Type': 'application/json',
            },
            body,
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(healthRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to insert health data: ${err.message}`));
        }
      }
      // Get health data tool
      if (params.name === 'get_health_data') {
        try {
          const { phone_number, token } = params.arguments || {};
          if (!phone_number || !token) {
            return res.json(errorReply(-32602, 'phone_number and token are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/health-data?phone_number=${encodeURIComponent(phone_number)}`;
          const healthRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
            },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(healthRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to get health data: ${err.message}`));
        }
      }
      // Insert browsing data tool
      if (params.name === 'insert_browsing_data') {
        try {
          const {
            phone_number,
            token,
            website_url,
            visit_time,
            product_clicks,
            interest_keywords,
            brand,
            source,
            duration,
          } = params.arguments || {};
          if (
            !phone_number ||
            !token ||
            !website_url ||
            !visit_time ||
            product_clicks === undefined ||
            !interest_keywords ||
            !brand ||
            !source ||
            duration === undefined
          ) {
            return res.json(errorReply(-32602, 'All fields are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/insert-browsing-data?phone_number=${encodeURIComponent(phone_number)}`;
          const body = JSON.stringify({
            website_url,
            visit_time,
            product_clicks,
            interest_keywords,
            brand,
            source,
            duration,
          });
          const browseRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
              'Content-Type': 'application/json',
            },
            body,
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(browseRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to insert browsing data: ${err.message}`));
        }
      }
      // Get browsing data tool
      if (params.name === 'get_browsing_data') {
        try {
          const { phone_number, token } = params.arguments || {};
          if (!phone_number || !token) {
            return res.json(errorReply(-32602, 'phone_number and token are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/browsing-data?phone_number=${encodeURIComponent(phone_number)}`;
          const browseRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
            },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(browseRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to get browsing data: ${err.message}`));
        }
      }
      // Get food data tool
      if (params.name === 'get_food_data') {
        try {
          const { phone_number, token } = params.arguments || {};
          if (!phone_number || !token) {
            return res.json(errorReply(-32602, 'phone_number and token are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/food-data?phone_number=${encodeURIComponent(phone_number)}`;
          const foodRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
            },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(foodRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to get food data: ${err.message}`));
        }
      }
      // Get insurance data tool
      if (params.name === 'get_insurance_data') {
        try {
          const { phone_number, token } = params.arguments || {};
          if (!phone_number || !token) {
            return res.json(errorReply(-32602, 'phone_number and token are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/insurance-data?phone_number=${encodeURIComponent(phone_number)}`;
          const insRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
            },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(insRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to get insurance data: ${err.message}`));
        }
      }
      // Insert brand preference data tool
      if (params.name === 'insert_brand_preference_data') {
        try {
          const { phone_number, brand_name, token, answers } = params.arguments || {};
          if (!phone_number || !brand_name || !token || !Array.isArray(answers)) {
            return res.json(errorReply(-32602, 'phone_number, brand_name, token and answers array are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/insert-brand-preference-data?phone_number=${encodeURIComponent(phone_number)}&brand_name=${encodeURIComponent(brand_name)}`;
          const body = JSON.stringify({ answers });
          const prefRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
              'Content-Type': 'application/json',
            },
            body,
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(prefRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to insert brand preference data: ${err.message}`));
        }
      }
      // Get brand preference tool
      if (params.name === 'get_brand_preference') {
        try {
          const { phone_number, brand_name, token } = params.arguments || {};
          if (!phone_number || !brand_name || !token) {
            return res.json(errorReply(-32602, 'phone_number, brand_name and token are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/brand-preferences?phone_number=${encodeURIComponent(phone_number)}&brand_name=${encodeURIComponent(brand_name)}`;
          const prefRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
            },
            body: ''
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(prefRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to get brand preference data: ${err.message}`));
        }
      }
      // Insert fashion data tool
      if (params.name === 'insert_fashion_data') {
        try {
          const { phone_number, token, answers } = params.arguments || {};
          if (!phone_number || !token || !Array.isArray(answers)) {
            return res.json(errorReply(-32602, 'phone_number, token and answers array are required'));
          }
          const url = `https://hushh-api-53407187172.us-central1.run.app/api/v1/insert-fashion-data?phone_number=${encodeURIComponent(phone_number)}`;
          const body = JSON.stringify({ answers });
          const fashionRes = await fetch(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              token,
              'Content-Type': 'application/json',
            },
            body,
          }).then(r => r.json());
          return res.json(
            reply({
              content: [
                { type: 'text', text: JSON.stringify(fashionRes, null, 2) },
              ],
              isError: false,
            })
          );
        } catch (err) {
          return res.json(errorReply(-32000, `Failed to insert fashion data: ${err.message}`));
        }
      }
      // Unknown tool
      return res.json(errorReply(-32601, 'Unknown tool'));
    }
    default:
      return res.json(errorReply(-32601, 'Method not found'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP server listening at http://localhost:${PORT}`);
}); 
