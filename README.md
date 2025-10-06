# AI Task Manager on Cloudflare

## Overview

This project demonstrates how to build a simple **AI‑powered task manager** using Cloudflare’s developer platform.  The application lets a user manage a list of tasks through a conversational interface.  A large language model (LLM) running on **Workers AI** interprets natural‑language requests (such as *"Remind me to send the report tomorrow at 9am"*) and turns them into structured actions.  A **Durable Object** stores the user’s tasks and conversation history so that each chat session has memory.  The Worker coordinates these pieces together and returns human‑friendly responses.  A minimal **Workflow** is included to illustrate how long‑running orchestration could work, though the primary logic lives in the Worker and Durable Object.

This project is intended as a learning exercise and starting point for more sophisticated agents.  The code is deliberately verbose and well‑documented to match a professional coding standard.

## Features

* **LLM integration** – uses Cloudflare Workers AI to call Meta’s `@cf/meta/llama‑3.3‑70b‑instruct‑fp8‑fast` model.  The model receives a system prompt instructing it to act as a task management assistant and returns a natural language reply to the user.
* **Natural‑language parsing** – a simple parser looks for commands like `add` and `list` in the user’s message.  When no command is found, the system falls back to the LLM for a general response.
* **Stateful memory** – a **Durable Object** called `TaskManager` stores tasks and conversation history for a given user.  Each user is associated with a unique ID so that multiple users can chat with the agent concurrently without interfering with each other.
* **Workflow example** – a minimal Cloudflare **Workflow** (`TaskWorkflow`) shows how you could run long‑lived processes, including interacting with Workers AI and Durable Objects.  In this sample the Worker calls the Workflow for demo purposes.
* **Chat API** – exposes a JSON HTTP API under `/api/chat` for sending messages to the assistant.  A basic HTML client is included for local testing.

## Repository Layout

```
cf_ai_task_manager/
├── README.md             – project documentation (this file)
├── wrangler.toml         – configuration for deploying to Cloudflare
├── package.json          – Node dependencies and scripts
├── tsconfig.json         – TypeScript configuration
├── src/
│   ├── index.ts          – main Worker script
│   ├── taskManager.ts    – Durable Object implementation
│   └── utils.ts          – helper functions
└── workflows/
    └── taskWorkflow.ts   – example Cloudflare Workflow
```

## Running Locally

### Prerequisites

* [Node.js](https://nodejs.org) ≥ v18
* [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler) ≥ v3.  Install it globally with:

```sh
npm install -g wrangler
```

### Install Dependencies

Navigate into the project directory and install dependencies:

```sh
cd cf_ai_task_manager
npm install
```

### Start the Worker in Local Mode

Use Wrangler to start a local development server.  The LLM calls will work only when you are authenticated against a Cloudflare account with Workers AI enabled.  Without authentication the AI calls will be simulated with a placeholder response.

```sh
wrangler dev
```

Once running, you can interact with the agent by opening `http://localhost:8787` in your browser.  A simple chat UI will appear.  Alternatively, send a POST request to the API directly:

```sh
curl -X POST http://localhost:8787/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"userId": "alice", "message": "add finish the report by Friday"}'
```

### Deploying to Cloudflare

1.  Log in to Cloudflare and create a new Worker project or reuse an existing one.
2.  Copy `wrangler.toml.example` to `wrangler.toml` and update the `account_id`, `compatibility_date`, and other bindings to match your account.
3.  Deploy with:

    ```sh
    wrangler deploy
    ```

Refer to the official [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/) for further details.

## Architecture and Design

The assistant is composed of three primary components:

1.  **Worker (`src/index.ts`)** – exposes the HTTP API, handles routing, calls the AI model, and interacts with the Durable Object and Workflow.  It parses the user’s message for basic commands:
    * `add <title> [by <dueDate>]` – stores a new task in the Durable Object.
    * `list` – returns the current list of tasks.
    * anything else – passes the message to the LLM for a conversational response.
    The Worker uses the AI binding (`env.AI`) to call the LLM.  A simple system prompt instructs the model to act as a helpful assistant.

2.  **Durable Object (`src/taskManager.ts`)** – provides a persistent store for each user’s tasks and conversation history.  It supports two methods:
    * `addTask(title: string, dueDate?: string)` – appends a task to an array stored in the object’s storage.
    * `listTasks()` – returns all stored tasks.
    The object identifies a user via a deterministic ID derived from `userId` in the chat request.  This isolation ensures that different users do not share state.

3.  **Workflow (`workflows/taskWorkflow.ts`)** – demonstrates how a Workflow might coordinate long‑running or multi‑step logic.  In this example the Workflow simply calls the LLM and returns its response.  A Worker can bind to this Workflow and invoke it as needed.  Real applications could expand the Workflow to handle asynchronous events, retries, or external API calls.

## Future Enhancements

This project is intentionally simple to keep the focus on showing how various Cloudflare primitives fit together.  Possible extensions include:

* **Voice input** – integrate with Workers Calls to accept voice calls and transcribe speech into text.
* **User authentication** – restrict access with Cloudflare Access or a custom auth system.
* **Function calling** – use the LLM’s function‑calling capability to return structured data directly instead of using naive text parsing.
* **Reminder notifications** – use Cron triggers or Workflows to send reminders at the specified due dates via email, SMS, or push notifications.
* **Vector search** – integrate Cloudflare Vectorize to embed task descriptions and enable semantic search or recommendations.

## License

This code is provided for educational purposes under the MIT license.  See the `LICENSE` file for details.