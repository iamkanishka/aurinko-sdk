/**
 * Tasks API Resource
 */

import type { HttpClient } from "../http/client";
import type { RequestOptions } from "../config";
import type {
  Task,
  TaskList,
  TaskSyncStartParams,
  CreateTaskParams,
  CreateTaskListParams,
  ListTasksParams,
  PagedResponse,
  SyncStartResponse,
  UpdateTaskParams,
} from "../types/index";
import { paginate, collectAll, consumeDeltaSync } from "../utils/pagination";
import { defined } from "../utils/defined";

export class TasksResource {
  constructor(private readonly http: HttpClient) {}

  // ─── Task Lists ────────────────────────────────────────────────────────────

  readonly lists = {
    /**
     * List all task lists.
     */
    list: (options?: RequestOptions): Promise<PagedResponse<TaskList>> =>
      this.http.get<PagedResponse<TaskList>>("/tasklists", undefined, options),

    /**
     * Get a single task list. Use "default" as the ID for the default list.
     */
    get: (id: string, options?: RequestOptions): Promise<TaskList> =>
      this.http.get<TaskList>(
        `/tasklists/${encodeURIComponent(id)}`,
        undefined,
        options
      ),

    /**
     * Get the default task list.
     */
    getDefault: (options?: RequestOptions): Promise<TaskList> =>
      this.http.get<TaskList>("/tasklists/default", undefined, options),

    /**
     * Create a new task list.
     */
    create: (
      params: CreateTaskListParams,
      options?: RequestOptions
    ): Promise<TaskList> =>
      this.http.post<TaskList>("/tasklists", params, undefined, options),

    /**
     * Update a task list.
     */
    update: (
      id: string,
      params: Partial<CreateTaskListParams>,
      options?: RequestOptions
    ): Promise<TaskList> =>
      this.http.patch<TaskList>(
        `/tasklists/${encodeURIComponent(id)}`,
        params,
        undefined,
        options
      ),

    /**
     * Delete a task list.
     */
    delete: (id: string, options?: RequestOptions): Promise<null> =>
      this.http.delete<null>(
        `/tasklists/${encodeURIComponent(id)}`,
        undefined,
        options
      ),
  };

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  /**
   * Access task operations scoped to a specific task list.
   * Use "default" as the listId for the default list.
   *
   * @example
   * const tasks = client.tasks.forList('default');
   * await tasks.create({ title: 'Buy groceries', importance: 'high' });
   */
  forList(listId: string) {
    const encodedId = encodeURIComponent(listId);
    const http = this.http;

    return {
      /**
       * List tasks in this task list.
       */
      list: (
        params: ListTasksParams = {},
        options?: RequestOptions
      ): Promise<PagedResponse<Task>> =>
        http.get<PagedResponse<Task>>(
          `/tasklists/${encodedId}/tasks`,
          params as Record<string, string | number | boolean | undefined>,
          options
        ),

      /**
       * Iterate over all task pages automatically.
       */
      iterate: (
        params: ListTasksParams = {},
        options?: RequestOptions
      ) => {
        const { limit, pageToken: _pt, ...rest } = params;
        return paginate<Task>(
          http,
          `/tasklists/${encodedId}/tasks`,
          rest as Record<string, string | number | boolean | undefined>,
          defined({ ...options, limit })
        );
      },

      /**
       * Collect ALL tasks into a flat array.
       */
      listAll: (
        params: ListTasksParams = {},
        options?: RequestOptions
      ): Promise<Task[]> => {
        const { limit, pageToken: _pt, ...rest } = params;
        return collectAll<Task>(
          http,
          `/tasklists/${encodedId}/tasks`,
          rest as Record<string, string | number | boolean | undefined>,
          defined({ ...options, limit })
        );
      },

      /**
       * Get a single task by ID.
       */
      get: (taskId: string, options?: RequestOptions): Promise<Task> =>
        http.get<Task>(
          `/tasklists/${encodedId}/tasks/${encodeURIComponent(taskId)}`,
          undefined,
          options
        ),

      /**
       * Create a new task.
       *
       * @example
       * await client.tasks.forList('default').create({
       *   title: 'Review pull request',
       *   importance: 'high',
       *   due: '2024-12-31T23:59:00Z',
       * });
       */
      create: (
        params: CreateTaskParams,
        options?: RequestOptions
      ): Promise<Task> =>
        http.post<Task>(
          `/tasklists/${encodedId}/tasks`,
          params,
          undefined,
          options
        ),

      /**
       * Update an existing task.
       */
      update: (
        taskId: string,
        params: UpdateTaskParams,
        options?: RequestOptions
      ): Promise<Task> =>
        http.patch<Task>(
          `/tasklists/${encodedId}/tasks/${encodeURIComponent(taskId)}`,
          params,
          undefined,
          options
        ),

      /**
       * Delete a task.
       */
      delete: (taskId: string, options?: RequestOptions): Promise<null> =>
        http.delete<null>(
          `/tasklists/${encodedId}/tasks/${encodeURIComponent(taskId)}`,
          undefined,
          options
        ),

      // ─── Sync ─────────────────────────────────────────────────────────────

      sync: {
        /**
         * Initialize a new tasks sync session for this list.
         */
        start: (
          params: TaskSyncStartParams = {},
          options?: RequestOptions
        ): Promise<SyncStartResponse> =>
          http.post<SyncStartResponse>(
            `/tasklists/${encodedId}/sync`,
            undefined,
            params as Record<string, string | number | boolean | undefined>,
            options
          ),

        /**
         * Fetch updated tasks since last sync.
         */
        updated: (
          deltaToken: string,
          params: { limit?: number } = {},
          options?: RequestOptions
        ) =>
          consumeDeltaSync<Task>(
            http,
            `/tasklists/${encodedId}/sync/updated`,
            deltaToken,
            params as Record<string, string | number | boolean | undefined>,
            options
          ),

        /**
         * Fetch deleted task IDs since last sync.
         */
        deleted: (
          deltaToken: string,
          params: { limit?: number } = {},
          options?: RequestOptions
        ) =>
          consumeDeltaSync<{ id: string }>(
            http,
            `/tasklists/${encodedId}/sync/deleted`,
            deltaToken,
            params as Record<string, string | number | boolean | undefined>,
            options
          ),
      },
    };
  }

  /**
   * Convenience: access operations on the default task list.
   */
  get default() {
    return this.forList("default");
  }
}
