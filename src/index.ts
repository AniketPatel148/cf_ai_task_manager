/*
 * Main Worker script for the AI Task Manager.
 *
 * This Worker exposes two routes:
 *   GET  /          – returns a simple HTML chat client for testing
 *   POST /api/chat  – accepts JSON { userId, message } and returns a reply
 *
 * The Worker uses a Durable Object to persist tasks and conversation history
 * and invokes Workers AI to generate human‑friendly responses when a message
 * does not match a known command.  A Workflow binding is included to
 * illustrate how you might orchestrate longer running logic.
 */

import { parseCommand, Command } from "./utils";

// Define the system prompt for the LLM.  This prompt instructs the model
// to behave as a friendly task management assistant.  The Worker sets this
// prompt on every call to the model.
const SYSTEM_PROMPT = `You are a friendly AI assistant that helps users manage their to‑do tasks.  
You can perform the following actions when prompted:
* Add a task to the user’s list when they say things like “add buy groceries by Friday”.
* List the current tasks when asked to “list tasks” or similar.
For unrecognised queries respond conversationally and offer to help manage tasks.  Do not invent tasks on the user’s behalf.`;

// Minimal HTML client.  This page provides a simple chat interface so you
// can interact with the Worker locally.  For production deployments you
// should build a proper front‑end using your preferred framework or Cloudflare Pages.
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Task Manager</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; }
      #chat { max-width: 600px; margin: auto; }
      .message { margin-bottom: 1rem; }
      .user { text-align: right; font-weight: bold; }
      .assistant { text-align: left; color: #2c3e50; }
      #input { width: 100%; padding: 0.5rem; }
      #send { padding: 0.5rem 1rem; }
    </style>
  </head>
  <body>
    <h1>AI Task Manager</h1>
    <div id="chat"></div>
    <div>
      <input id="input" type="text" placeholder="Type a message..." />
      <button id="send">Send</button>
    </div>
    <script>
      const chat = document.getElementById('chat');
      const input = document.getElementById('input');
      const send = document.getElementById('send');
      const userId = 'demo-user';

      function addMessage(text, role) {
        const div = document.createElement('div');
        div.className = 'message ' + role;
        div.textContent = text;
        chat.appendChild(div);
      }

      send.addEventListener('click', async () => {
        const message = input.value.trim();
        if (!message) return;
        addMessage(message, 'user');
        input.value = '';
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message }),
        });
        const data = await res.json();
        addMessage(data.reply, 'assistant');
      });
    </script>
  </body>
</html>`;

export interface Env {
  AI: Ai;
  TASK_MANAGER: DurableObjectNamespace;
  TASK_WORKFLOW: any; // Workflow binding; not used in this example but defined for completeness
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Serve the chat UI
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // Chat API endpoint
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const { userId, message } = await request.json();
        if (typeof userId !== "string" || typeof message !== "string") {
          return new Response("Invalid request body", { status: 400 });
        }

        // Determine if the user issued a known command locally
        const cmd: Command = parseCommand(message);
        const stubId = env.TASK_MANAGER.idFromName(userId);
        const stub = env.TASK_MANAGER.get(stubId);

        // Handle add command
        if (cmd.type === "add") {
          await stub.fetch(`https://task/${userId}/add`, {
            method: "POST",
            body: JSON.stringify({ title: cmd.title, dueDate: cmd.dueDate }),
          });
          const reply = `Added task \"${cmd.title}\"${cmd.dueDate ? ` due by ${cmd.dueDate}` : ''}.`;
          return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });
        }

        // Handle list command
        if (cmd.type === "list") {
          const listRes = await stub.fetch(`https://task/${userId}/list`, { method: "GET" });
          const tasks = await listRes.json();
          let reply;
          if (Array.isArray(tasks) && tasks.length > 0) {
            reply = tasks
              .map((t: any, idx: number) => `${idx + 1}. ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ''}`)
              .join('\n');
          } else {
            reply = "You have no tasks.";
          }
          return new Response(JSON.stringify({ reply, tasks }), { headers: { "Content-Type": "application/json" } });
        }

        // Fallback: ask the LLM to respond
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ];
        try {
          const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
            messages,
          });
          // The response structure can vary; attempt to extract plain text
          const reply = typeof result === "string" ? result : (result.response ?? result?.choices?.[0]?.message?.content ?? JSON.stringify(result));
          return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });
        } catch (err) {
          console.error("AI model invocation failed", err);
          return new Response(JSON.stringify({ reply: "The AI model is currently unavailable. Please try again later." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (err) {
        return new Response("Bad Request", { status: 400 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};