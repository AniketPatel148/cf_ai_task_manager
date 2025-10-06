/**
 * Helper functions for parsing user input into commands.
 */

export type Command =
  | { type: "add"; title: string; dueDate?: string }
  | { type: "list" }
  | { type: "none" };

/**
 * Naïvely parse a chat message to determine whether the user is trying to
 * add a task, list existing tasks, or issue an unrecognised command.
 *
 * This parser is intentionally simple and works best for short commands like:
 *
 *   add buy groceries by Friday
 *   add finish the report
 *   list
 *   list tasks
 *
 * The return value informs the Worker how to handle the request without
 * involving the LLM.  Complex natural language should fall through and
 * be processed by the LLM instead.
 *
 * @param message The raw user message
 */
export function parseCommand(message: string): Command {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Check for list commands
  if (lower === "list" || lower === "list tasks" || lower.startsWith("show tasks")) {
    return { type: "list" };
  }

  // Check for add commands.  Accept variations like "add" or "add task"
  if (lower.startsWith("add ") || lower.startsWith("add task ") || lower.startsWith("create ")) {
    // Remove the command keyword
    let remainder = trimmed.replace(/^\s*(add task|add|create)\s+/i, "");
    let dueDate: string | undefined;

    // Look for "by" or "on" followed by a date expression.  This simple
    // implementation treats everything after "by" or "on" as the due date.
    const byIndex = remainder.toLowerCase().lastIndexOf(" by ");
    const onIndex = remainder.toLowerCase().lastIndexOf(" on ");
    const idx = Math.max(byIndex, onIndex);
    if (idx >= 0) {
      const keywordLength = byIndex > onIndex ? 4 : 4; // both " by " and " on " are 4 chars
      dueDate = remainder.substring(idx + keywordLength).trim();
      remainder = remainder.substring(0, idx).trim();
    }

    const title = remainder.trim();
    if (title.length === 0) {
      return { type: "none" };
    }
    return { type: "add", title, dueDate: dueDate || undefined };
  }

  return { type: "none" };
}