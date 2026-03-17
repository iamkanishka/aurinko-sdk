/**
 * Tasks API Types
 */
import type { PagedResponse } from "./common";

export type TaskStatus = "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred";
export type TaskImportance = "low" | "normal" | "high";

export interface TaskList {
  id: string;
  name: string;
  isDefault?: boolean;
  isReadOnly?: boolean;
}

export interface Task {
  id: string;
  taskListId?: string;
  parentId?: string;
  title?: string;
  notes?: string;
  status?: TaskStatus;
  importance?: TaskImportance;
  due?: string;
  startDateTime?: string;
  completedDateTime?: string;
  isReminderOn?: boolean;
  recurrence?: unknown;
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
}

export interface CreateTaskParams {
  title: string;
  parentId?: string;
  notes?: string;
  status?: TaskStatus;
  importance?: TaskImportance;
  due?: string;
  startDateTime?: string;
  isReminderOn?: boolean;
}

export interface UpdateTaskParams extends Partial<CreateTaskParams> {}

export interface CreateTaskListParams {
  name: string;
}

export interface ListTasksParams {
  q?: string;
  pageToken?: string;
  limit?: number;
  status?: TaskStatus;
}

export interface TaskSyncStartParams {
  skipCompletedBeforeDate?: string;
  awaitReady?: boolean;
}

export type TaskSyncResponse = PagedResponse<Task>;
