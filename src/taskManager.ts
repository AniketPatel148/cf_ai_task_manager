/*
 * Durable Object for storing tasks and conversation history.
 *
 * Each Durable Object instance is keyed by a unique user identifier.  The
 * Worker calls `env.TASK_MANAGER.idFromName(userId)` to obtain a stub
 * associated with a given user.  All tasks for that user are persisted in
 * this object’s storage under the key "tasks".  The object exposes a
 * simple HTTP API:
 *
 *   POST /add { title, dueDate? }   – add a new task
 *   GET  /list                       – return all tasks
 */

export interface Task {
  id: string;
  title: string;
  dueDate?: string;
  createdAt: string;
}

export class TaskManager {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  /**
   * Fetch handler for the Durable Object.  Parses the URL path to
   * determine which action to perform.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Ensure that tasks array exists
    let tasks: Task[] = (await this.state.storage.get<Task[]>("tasks")) || [];

    if (request.method === "POST" && path.endsWith("/add")) {
      // Add a new task
      const { title, dueDate } = await request.json();
      const task: Task = {
        id: crypto.randomUUID(),
        title: String(title),
        dueDate: dueDate ? String(dueDate) : undefined,
        createdAt: new Date().toISOString(),
      };
      tasks.push(task);
      await this.state.storage.put("tasks", tasks);
      return new Response(JSON.stringify(task), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "GET" && path.endsWith("/list")) {
      return new Response(JSON.stringify(tasks), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }
}