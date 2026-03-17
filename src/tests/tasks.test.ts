/**
 * Tasks API — Full Test Suite
 */

import { AurinkoClient } from "../client";
import { NotFoundError, ValidationError } from "../errors";
import {
  makeFetchMock, mockOnce, getRequestBody, getRequestUrl,
  getRequestMethod, makeDeltaSyncFetch, fixtures,
} from "./helpers";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

// ─── Task Lists ───────────────────────────────────────────────────────────────

describe("Tasks — lists.list", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls GET /tasklists", async () => {
    const mock = mockOnce(200, { records: [fixtures.taskList()] });
    global.fetch = mock;
    const result = await client.tasks.lists.list();
    expect(getRequestUrl(mock)).toContain("/tasklists");
    expect(getRequestMethod(mock)).toBe("GET");
    expect(result.records[0]?.id).toBe("list-abc123");
  });
});

describe("Tasks — lists.get", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls GET /tasklists/{id}", async () => {
    const mock = mockOnce(200, fixtures.taskList());
    global.fetch = mock;
    const result = await client.tasks.lists.get("list-abc123");
    expect(getRequestUrl(mock)).toContain("/tasklists/list-abc123");
    expect(result.id).toBe("list-abc123");
  });

  it("URL-encodes list ID with special chars", async () => {
    const mock = mockOnce(200, fixtures.taskList());
    global.fetch = mock;
    await client.tasks.lists.get("list==abc");
    expect(getRequestUrl(mock)).toContain("/tasklists/list%3D%3Dabc");
  });

  it("throws NotFoundError on 404", async () => {
    global.fetch = mockOnce(404, { message: "List not found" });
    await expect(client.tasks.lists.get("ghost")).rejects.toThrow(NotFoundError);
  });
});

describe("Tasks — lists.getDefault", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls GET /tasklists/default", async () => {
    const mock = mockOnce(200, { ...fixtures.taskList(), id: "default" });
    global.fetch = mock;
    await client.tasks.lists.getDefault();
    expect(getRequestUrl(mock)).toContain("/tasklists/default");
  });
});

describe("Tasks — lists.create", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls POST /tasklists with name", async () => {
    const mock = mockOnce(201, { id: "new-list", name: "Shopping" });
    global.fetch = mock;
    const result = await client.tasks.lists.create({ name: "Shopping" });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/tasklists");
    expect(getRequestBody(mock)).toMatchObject({ name: "Shopping" });
    expect(result.id).toBe("new-list");
  });
});

describe("Tasks — lists.update", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls PATCH /tasklists/{id}", async () => {
    const mock = mockOnce(200, { id: "list-1", name: "Renamed" });
    global.fetch = mock;
    await client.tasks.lists.update("list-1", { name: "Renamed" });
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/tasklists/list-1");
    expect(getRequestBody(mock)).toMatchObject({ name: "Renamed" });
  });

  it("URL-encodes list ID", async () => {
    const mock = mockOnce(200, fixtures.taskList());
    global.fetch = mock;
    await client.tasks.lists.update("id/abc", { name: "x" });
    expect(getRequestUrl(mock)).toContain("/tasklists/id%2Fabc");
  });
});

describe("Tasks — lists.delete", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls DELETE /tasklists/{id}", async () => {
    const mock = mockOnce(204, null, { "content-length": "0" });
    global.fetch = mock;
    await client.tasks.lists.delete("list-1");
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/tasklists/list-1");
  });

  it("returns null on success", async () => {
    global.fetch = mockOnce(204, null);
    const result = await client.tasks.lists.delete("list-1");
    expect(result).toBeNull();
  });
});

// ─── Tasks (via forList) ──────────────────────────────────────────────────────

describe("Tasks — forList().list", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls GET /tasklists/{id}/tasks", async () => {
    const mock = mockOnce(200, { records: [fixtures.task()] });
    global.fetch = mock;
    const result = await client.tasks.forList("list-abc123").list();
    expect(getRequestUrl(mock)).toContain("/tasklists/list-abc123/tasks");
    expect(result.records[0]?.id).toBe("task-abc123");
  });

  it("passes status filter", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.tasks.forList("default").list({ status: "notStarted" });
    expect(getRequestUrl(mock)).toContain("status=notStarted");
  });

  it("passes pageToken for pagination", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.tasks.forList("default").list({ pageToken: "tok-123" });
    expect(getRequestUrl(mock)).toContain("pageToken=tok-123");
  });

  it("passes limit param", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.tasks.forList("default").list({ limit: 30 });
    expect(getRequestUrl(mock)).toContain("limit=30");
  });
});

describe("Tasks — forList().iterate", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("iterates all task pages", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "t1" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "t2" }] } },
    ]);
    const ids: string[] = [];
    for await (const page of client.tasks.default.iterate()) {
      ids.push(...page.records.map((t) => t.id));
    }
    expect(ids).toEqual(["t1", "t2"]);
  });
});

describe("Tasks — forList().listAll", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("flattens all task pages", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "t1" }, { id: "t2" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "t3" }] } },
    ]);
    const all = await client.tasks.default.listAll();
    expect(all).toHaveLength(3);
    expect(all.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });
});

describe("Tasks — forList().get", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls GET /tasklists/{listId}/tasks/{taskId}", async () => {
    const mock = mockOnce(200, fixtures.task());
    global.fetch = mock;
    const result = await client.tasks.forList("my-list").get("task-abc123");
    expect(getRequestUrl(mock)).toContain("/tasklists/my-list/tasks/task-abc123");
    expect(result.id).toBe("task-abc123");
  });

  it("URL-encodes both listId and taskId", async () => {
    const mock = mockOnce(200, fixtures.task());
    global.fetch = mock;
    await client.tasks.forList("list/id").get("task==id");
    expect(getRequestUrl(mock)).toContain("/tasklists/list%2Fid/tasks/task%3D%3Did");
  });

  it("throws NotFoundError on 404", async () => {
    global.fetch = mockOnce(404, { message: "Task not found" });
    await expect(client.tasks.default.get("ghost")).rejects.toThrow(NotFoundError);
  });
});

describe("Tasks — forList().create", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls POST /tasklists/{id}/tasks", async () => {
    const mock = mockOnce(201, fixtures.task());
    global.fetch = mock;
    await client.tasks.default.create({ title: "Write unit tests" });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/tasklists/default/tasks");
  });

  it("sends title in body", async () => {
    const mock = mockOnce(201, fixtures.task());
    global.fetch = mock;
    await client.tasks.default.create({ title: "Buy groceries" });
    expect(getRequestBody(mock)).toMatchObject({ title: "Buy groceries" });
  });

  it("sends importance field in body", async () => {
    const mock = mockOnce(201, fixtures.task());
    global.fetch = mock;
    await client.tasks.default.create({ title: "Urgent task", importance: "high" });
    expect(getRequestBody(mock)).toMatchObject({ importance: "high" });
  });

  it("sends due date in body", async () => {
    const mock = mockOnce(201, fixtures.task());
    global.fetch = mock;
    await client.tasks.default.create({
      title: "Deadline task",
      due: "2024-12-31T23:59:00Z",
    });
    expect(getRequestBody(mock)).toMatchObject({ due: "2024-12-31T23:59:00Z" });
  });

  it("sends notes in body", async () => {
    const mock = mockOnce(201, fixtures.task());
    global.fetch = mock;
    await client.tasks.default.create({
      title: "Task with notes",
      notes: "Remember to check the requirements doc.",
    });
    expect(getRequestBody(mock)).toMatchObject({ notes: "Remember to check the requirements doc." });
  });

  it("throws ValidationError on 400", async () => {
    global.fetch = mockOnce(400, { message: "Title is required" });
    await expect(
      client.tasks.default.create({ title: "" })
    ).rejects.toThrow(ValidationError);
  });
});

describe("Tasks — forList().update", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls PATCH /tasklists/{listId}/tasks/{taskId}", async () => {
    const mock = mockOnce(200, { ...fixtures.task(), status: "completed" });
    global.fetch = mock;
    const result = await client.tasks.default.update("task-abc123", { status: "completed" });
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/tasklists/default/tasks/task-abc123");
    expect(result.status).toBe("completed");
  });

  it("sends only changed fields in body", async () => {
    const mock = mockOnce(200, fixtures.task());
    global.fetch = mock;
    await client.tasks.default.update("t1", { title: "New title" });
    expect(getRequestBody(mock)).toMatchObject({ title: "New title" });
  });

  it("can update to all status values", async () => {
    for (const status of ["notStarted", "inProgress", "completed", "waitingOnOthers", "deferred"] as const) {
      const mock = mockOnce(200, { ...fixtures.task(), status });
      global.fetch = mock;
      const result = await client.tasks.default.update("t1", { status });
      expect(result.status).toBe(status);
    }
  });
});

describe("Tasks — forList().delete", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls DELETE /tasklists/{listId}/tasks/{taskId}", async () => {
    const mock = mockOnce(204, null, { "content-length": "0" });
    global.fetch = mock;
    await client.tasks.default.delete("task-abc123");
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/tasklists/default/tasks/task-abc123");
  });
});

// ─── Tasks — default shorthand ────────────────────────────────────────────────

describe("Tasks — default shorthand", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("client.tasks.default is shorthand for forList('default')", async () => {
    const mock = mockOnce(201, fixtures.task());
    global.fetch = mock;
    await client.tasks.default.create({ title: "Via default shorthand" });
    expect(getRequestUrl(mock)).toContain("/tasklists/default/tasks");
  });

  it("client.tasks.default.list uses /tasklists/default/tasks", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.tasks.default.list();
    expect(getRequestUrl(mock)).toContain("/tasklists/default/tasks");
  });
});

// ─── Tasks — sync ─────────────────────────────────────────────────────────────

describe("Tasks — sync", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("starts sync at POST /tasklists/{id}/sync", async () => {
    const mock = mockOnce(200, fixtures.syncStartResponse());
    global.fetch = mock;
    const result = await client.tasks.default.sync.start();
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/tasklists/default/sync");
    expect(result.syncUpdatedToken).toBe("sync-updated-token-abc");
  });

  it("starts sync with skipCompletedBeforeDate param", async () => {
    const mock = mockOnce(200, fixtures.syncStartResponse());
    global.fetch = mock;
    await client.tasks.default.sync.start({ skipCompletedBeforeDate: "2024-01-01T00:00:00Z" });
    expect(getRequestUrl(mock)).toContain("skipCompletedBeforeDate=2024-01-01");
  });

  it("fetches updated tasks across pages", async () => {
    global.fetch = makeDeltaSyncFetch([
      { records: [{ id: "t1" }], nextPageToken: "p2" },
      { records: [{ id: "t2" }, { id: "t3" }], nextDeltaToken: "tasks-delta" },
    ]);
    const { items, nextDeltaToken } = await client.tasks.default.sync.updated("init-delta");
    expect(items).toHaveLength(3);
    expect(nextDeltaToken).toBe("tasks-delta");
  });

  it("passes deltaToken in first updated request", async () => {
    const mock = makeDeltaSyncFetch([{ records: [], nextDeltaToken: "tok" }]);
    global.fetch = mock;
    await client.tasks.default.sync.updated("my-tasks-delta");
    expect(getRequestUrl(mock)).toContain("deltaToken=my-tasks-delta");
  });

  it("fetches deleted task IDs", async () => {
    global.fetch = makeDeltaSyncFetch([
      { records: [{ id: "dead-t1" }, { id: "dead-t2" }], nextDeltaToken: "del-tok" },
    ]);
    const { items, nextDeltaToken } = await client.tasks.default.sync.deleted("del-init");
    expect(items).toHaveLength(2);
    expect(nextDeltaToken).toBe("del-tok");
  });

  it("sync uses correct listId in path for non-default list", async () => {
    const mock = mockOnce(200, fixtures.syncStartResponse());
    global.fetch = mock;
    await client.tasks.forList("work-tasks").sync.start();
    expect(getRequestUrl(mock)).toContain("/tasklists/work-tasks/sync");
  });

  it("passes limit to sync.updated", async () => {
    const mock = makeDeltaSyncFetch([{ records: [], nextDeltaToken: "tok" }]);
    global.fetch = mock;
    await client.tasks.default.sync.updated("delta", { limit: 25 });
    expect(getRequestUrl(mock)).toContain("limit=25");
  });

  it("throws if sync.updated returns no nextDeltaToken", async () => {
    global.fetch = mockOnce(200, { records: [] });
    await expect(client.tasks.default.sync.updated("token")).rejects.toThrow("nextDeltaToken");
  });
});
