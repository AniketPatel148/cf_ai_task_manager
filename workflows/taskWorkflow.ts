/*
 * Example Workflow for the AI Task Manager.
 *
 * This Workflow demonstrates how you could encapsulate long‑running or
 * multi‑step logic separate from the main Worker.  Workflows can persist
 * intermediate state, schedule retries, and execute for minutes or hours.
 *
 * In this simple example the Workflow calls Workers AI to generate a reply
 * using the same system prompt as the Worker.  The input payload must
 * include a `message` and `userId`.  The Workflow is not actively used by
 * the Worker in this project, but it is provided as a reference for
 * implementing more complex flows.
 */

import { defineWorkflow } from "@cloudflare/workflows";

export interface TaskWorkflowInput {
  message: string;
  userId: string;
}

export interface TaskWorkflowOutput {
  reply: string;
}

const SYSTEM_PROMPT = `You are a friendly AI assistant that helps users manage their to‑do tasks.  
You can perform the following actions when prompted:
* Add a task to the user’s list when they say things like “add buy groceries by Friday”.
* List the current tasks when asked to “list tasks” or similar.
For unrecognised queries respond conversationally and offer to help manage tasks.  Do not invent tasks on the user’s behalf.`;

export default defineWorkflow<TaskWorkflowInput, TaskWorkflowOutput>(async ({ input, env }) => {
  const { message } = input;
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: message },
  ];
  const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages });
  const reply = typeof result === "string" ? result : (result.response ?? result?.choices?.[0]?.message?.content ?? JSON.stringify(result));
  return { reply };
});