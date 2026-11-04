import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourseRenderer } from "./CourseRenderer.js";

const FIRST = "01-haltung";
const SECOND = "02-anschlag";

function serve(lessons: { lessonId: string; status: string }[]) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ lessons, ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderCourse(props: { ignoreLocks?: boolean; initialLessonId?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CourseRenderer skillId="guitar" title="Kurs" {...props} />
    </QueryClientProvider>,
  );
  return client;
}

/** The lesson remounts once the progress arrives, so wait for that before clicking in it. */
async function checkpointButton(client: QueryClient) {
  await waitFor(() => expect(client.isFetching()).toBe(0));
  return lessonButton(/Geschafft/);
}

const lessonButton = (name: RegExp) => screen.findByRole("button", { name });
const puts = (fetchMock: ReturnType<typeof serve>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");

afterEach(() => vi.unstubAllGlobals());

describe("CourseRenderer", () => {
  it("keeps a locked lesson disabled by default", async () => {
    serve([]);
    renderCourse();
    expect(await lessonButton(/Anschlag/)).toBeDisabled();
    expect(await lessonButton(/Anschlag.*gesperrt/)).toBeInTheDocument();
  });

  it("makes a locked lesson clickable with ignoreLocks", async () => {
    serve([]);
    renderCourse({ ignoreLocks: true });
    const button = await lessonButton(/Anschlag/);
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent("offen");
    await userEvent.click(button);
    expect(await lessonButton(/Zurück zur Übersicht/)).toBeInTheDocument();
  });

  it("opens the lesson given by initialLessonId", async () => {
    serve([]);
    renderCourse({ initialLessonId: SECOND });
    expect(await lessonButton(/Zurück zur Übersicht/)).toBeInTheDocument();
  });

  it("shows the overview when initialLessonId is not in this folder", async () => {
    serve([]);
    renderCourse({ initialLessonId: "nice-to-know" });
    expect(await lessonButton(/Anschlag/)).toBeInTheDocument();
  });

  it.each(["done", "gelernt", "gemeistert"])("treats %s as finished", async (status) => {
    serve([{ lessonId: FIRST, status }]);
    renderCourse();
    await waitFor(async () => expect(await lessonButton(/Haltung/)).toHaveTextContent("abgeschlossen"));
    expect(await lessonButton(/Anschlag/)).toBeEnabled();
  });

  it("writes done from the checkpoint of an unfinished lesson", async () => {
    const fetchMock = serve([]);
    const client = renderCourse({ initialLessonId: SECOND });
    await userEvent.click(await checkpointButton(client));
    await waitFor(() => expect(puts(fetchMock)).toHaveLength(1));
    const [url, init] = puts(fetchMock)[0]!;
    expect(url).toBe(`/api/progress/guitar/${SECOND}`);
    expect(JSON.parse(String(init?.body))).toEqual({ status: "done", checkpoint: {} });
  });

  it("confirms the checkpoint visibly, also once the progress has refreshed", async () => {
    const fetchMock = serve([]);
    const client = renderCourse({ initialLessonId: SECOND });
    const button = await checkpointButton(client);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await userEvent.click(button);
    await waitFor(() => expect(puts(fetchMock)).toHaveLength(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Lektion abgeschlossen");
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("confirms nothing when the checkpoint cannot be saved", async () => {
    const quiet = () => undefined;
    process.on("unhandledRejection", quiet);
    serve([]);
    const client = renderCourse({ initialLessonId: SECOND });
    const button = await checkpointButton(client);
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Response(JSON.stringify({ error: { code: "x", message: "kaputt" } }), { status: 500 })
        : new Response(JSON.stringify({ lessons: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await userEvent.click(button);
    await waitFor(() => expect(puts(fetchMock as never)).toHaveLength(1));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    process.off("unhandledRejection", quiet);
  });

  it("does not lower a mastered lesson from the checkpoint", async () => {
    const fetchMock = serve([{ lessonId: SECOND, status: "gemeistert" }]);
    const client = renderCourse({ initialLessonId: SECOND });
    await userEvent.click(await checkpointButton(client));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(puts(fetchMock)).toHaveLength(0);
  });

  it("does not lower a lesson mastered since the progress was cached", async () => {
    serve([]);
    const client = renderCourse({ initialLessonId: SECOND });
    const button = await checkpointButton(client);
    const fetchMock = serve([{ lessonId: SECOND, status: "gemeistert" }]);
    await userEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(puts(fetchMock)).toHaveLength(0);
  });
});
