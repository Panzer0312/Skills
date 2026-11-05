import type { LessonStatus, MapNode, MapPath, RoadStep } from "@skills/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gameContent } from "../api.js";
import { SkillMap, type MapFilter } from "./SkillMap.js";

const node = (id: string, extra: Partial<MapNode> = {}): MapNode => ({
  id, title: id, description: id, path: "hafen", rank: 2, x: 100, y: 100, parent: null, quick: false,
  available: true, knownSong: false, techniqueId: null, links: [], songs: [], targetSong: null, ...extra,
});

const nodes = [
  node("Start", { x: 200, y: 200 }),
  node("Mitte", { x: 400, y: 200, parent: "Start", rank: 5, path: "metal" }),
  node("Ende", { x: 600, y: 200, parent: "Mitte", rank: 8, path: "metal", links: [{ to: "Start", reason: "weil" }] }),
  node("Stern", { x: 400, y: 400, parent: "Start", quick: true }),
  node("Später", { x: 200, y: 400, parent: "Start", available: false, path: "lead" }),
  node("Fern", { x: 1500, y: 1000, parent: "Später", path: "lead", available: false }),
];

const paths: MapPath[] = [
  { id: "hafen", title: "Harbor", subtitle: "Grundlagen", color: "#d9bf8a", label: { x: 20, y: 40 } },
  { id: "metal", title: "Iron Hills", subtitle: "Metal", color: "#c9c9c9", label: { x: 500, y: 40 } },
];

const step = (lessonId: string): RoadStep => ({ lessonId, questId: null, months: [1, 1], reason: "r" });
const noFilter: MapFilter = { path: null, tier: null, term: "" };

function setup(props: Partial<Parameters<typeof SkillMap>[0]> = {}) {
  const onSelect = vi.fn();
  const view = render(
    <SkillMap
      nodes={nodes}
      paths={paths}
      road={[step("Start"), step("Mitte"), step("Ende")]}
      statuses={{}}
      selectedId={null}
      bestId={null}
      filter={noFilter}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { ...view, onSelect, svg: view.container.querySelector("svg") as SVGSVGElement };
}

const button = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name},`) });
const shape = (el: HTMLElement) => el.querySelector(".map-shape") as SVGElement;
const labels = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".map-label")).map((label) => label.textContent);

// jsdom has no PointerEvent, and without it fireEvent drops the coordinates.
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeEach(() => {
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1600, height: 1100, right: 1600, bottom: 1100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

describe("SkillMap nodes", () => {
  it("draws every node with a keyboard-reachable button", () => {
    setup({ nodes: gameContent.nodes, paths: gameContent.paths, road: gameContent.road });
    const buttons = screen.getAllByRole("button").filter((el) => el.classList.contains("map-node"));
    expect(buttons).toHaveLength(gameContent.nodes.length);
    for (const el of buttons) expect(el).toHaveAttribute("tabindex", "0");
  });

  it("names title, status and difficulty", () => {
    setup({ statuses: { Mitte: "aktiv" } });
    expect(button("Mitte")).toHaveAccessibleName("Mitte, aktiv, Schwierigkeit 5 von 10");
    expect(button("Start")).toHaveAccessibleName("Start, offen, Schwierigkeit 2 von 10");
    expect(button("Später")).toHaveAccessibleName("Später, in Vorbereitung, Schwierigkeit 2 von 10");
  });

  it("selects a node with Enter", async () => {
    const { onSelect } = setup();
    act(() => button("Mitte").focus());
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("Mitte");
  });

  it("selects a node with Space and a click", async () => {
    const { onSelect } = setup();
    act(() => button("Ende").focus());
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenLastCalledWith("Ende");
    await userEvent.click(button("Start"));
    expect(onSelect).toHaveBeenLastCalledWith("Start");
  });

  it("colours nodes by rank tier", () => {
    setup();
    expect(shape(button("Start"))).toHaveAttribute("fill", "#5f9e3f");
    expect(shape(button("Mitte"))).toHaveAttribute("fill", "#d08a1d");
    expect(shape(button("Ende"))).toHaveAttribute("fill", "#b23a2e");
  });

  it("shows done, quick and unavailable nodes differently", () => {
    const statuses: Record<string, LessonStatus> = { Start: "gelernt", Mitte: "gemeistert", Ende: "aktiv" };
    setup({ statuses });
    expect(within(button("Start")).getByText("✓")).toBeInTheDocument();
    expect(within(button("Mitte")).getByText("✓✓")).toBeInTheDocument();
    expect(within(button("Ende")).getByText("8")).toBeInTheDocument();
    expect(button("Ende").querySelector(".map-active-ring")).not.toBeNull();
    expect(button("Start").querySelector(".map-active-ring")).toBeNull();

    expect(shape(button("Stern")).tagName).toBe("polygon");
    expect(shape(button("Start")).tagName).toBe("circle");

    expect(shape(button("Später"))).toHaveAttribute("fill", "#77756c");
    expect(shape(button("Später"))).toHaveAttribute("stroke-dasharray");
    expect(shape(button("Start"))).not.toHaveAttribute("stroke-dasharray");
  });

  it("marks best next", () => {
    setup({ bestId: "Mitte" });
    expect(button("Mitte").querySelector(".map-best-pulse")).not.toBeNull();
    expect(button("Mitte")).toHaveAccessibleName(/beste nächste Lektion/);
    expect(button("Start").querySelector(".map-best-pulse")).toBeNull();
  });
});

describe("SkillMap lines", () => {
  it("draws its layers in order", () => {
    const { container } = setup();
    const layers = Array.from(container.querySelectorAll("svg > g[data-layer]")).map((g) => g.getAttribute("data-layer"));
    expect(layers).toEqual(["regions", "decor", "parents", "road", "quick", "links", "nodes", "labels", "titles"]);
  });

  it("runs the gold road along the path, with no line straight across the map", () => {
    const { container } = setup({ road: [step("Start"), step("Mitte"), step("Später"), step("Ende")] });
    const ends = Array.from(container.querySelectorAll(".map-road")).map((line) =>
      ["x1", "y1", "x2", "y2"].map((name) => line.getAttribute(name)).join(" "),
    );
    expect(ends).toEqual(["200 200 400 200", "200 200 200 400", "400 200 600 200"]);
  });

  it("draws quick side paths on their own and cross-links from both ends", () => {
    const { container } = setup();
    expect(container.querySelectorAll(".map-quick")).toHaveLength(1);
    expect(container.querySelectorAll(".map-link")).toHaveLength(1);
  });

  it("highlights relations and brightens cross-links of the selected node", () => {
    const { container, rerender } = setup();
    expect(container.querySelector(".map-link")).not.toHaveClass("is-on");
    rerender(
      <SkillMap nodes={nodes} paths={paths} road={[]} statuses={{}} selectedId="Start" bestId={null} filter={noFilter} onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".map-link")).toHaveClass("is-on");
    for (const name of ["Mitte", "Ende", "Stern", "Später"]) expect(button(name)).toHaveClass("is-related");
    expect(button("Fern")).not.toHaveClass("is-related");
    expect(button("Start")).toHaveClass("is-selected");
  });
});

describe("SkillMap labels", () => {
  it("hides labels on the whole map, except selected, best and hovered", () => {
    const { container } = setup({ selectedId: "Mitte", bestId: "Ende" });
    expect(labels(container)).toEqual(["Mitte", "Ende"]);
    fireEvent.pointerEnter(button("Stern"));
    expect(labels(container)).toEqual(["Mitte", "Ende", "Stern"]);
    fireEvent.pointerLeave(button("Stern"));
    expect(labels(container)).toEqual(["Mitte", "Ende"]);
  });

  it("shows all labels once zoomed to 900 or less", async () => {
    const { container } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Hineinzoomen" }));
    expect(labels(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Hineinzoomen" }));
    expect(labels(container)).toHaveLength(nodes.length);
  });

  it("shows labels of filter matches", () => {
    const { container } = setup({ filter: { path: "metal", tier: null, term: "" } });
    expect(labels(container)).toEqual(["Mitte", "Ende"]);
  });

  it("centres labels below the node, in the box the content test checks", () => {
    const { container } = setup({ selectedId: "Mitte" });
    const label = container.querySelector(".map-label") as SVGTextElement;
    expect(label).toHaveAttribute("x", "400");
    expect(label).toHaveAttribute("text-anchor", "middle");
    const y = Number(label.getAttribute("y"));
    expect(y).toBeGreaterThan(200 + 16);
    expect(y).toBeLessThanOrEqual(200 + 32);
  });

  it("always shows region titles", () => {
    setup();
    expect(screen.getByText(/Iron Hills/)).toBeInTheDocument();
  });
});

describe("SkillMap filter", () => {
  const opacity = (name: string) => button(name).getAttribute("opacity");

  it("dims nodes outside the filter without removing them", () => {
    setup({ filter: { path: "metal", tier: null, term: "" } });
    expect(screen.getAllByRole("button").filter((el) => el.classList.contains("map-node"))).toHaveLength(nodes.length);
    expect(opacity("Start")).toBe("0.22");
    expect(opacity("Mitte")).toBeNull();
  });

  it("filters by tier and by a term in any case", () => {
    const { rerender } = setup({ filter: { path: null, tier: 3, term: "" } });
    expect(opacity("Ende")).toBeNull();
    expect(opacity("Mitte")).toBe("0.22");
    rerender(
      <SkillMap nodes={nodes} paths={paths} road={[]} statuses={{}} selectedId={null} bestId={null} filter={{ path: null, tier: null, term: " STE " }} onSelect={vi.fn()} />,
    );
    expect(opacity("Stern")).toBeNull();
    expect(opacity("Ende")).toBe("0.22");
  });
});

describe("SkillMap viewport", () => {
  const box = (svg: SVGSVGElement) => svg.getAttribute("viewBox");

  it("starts on the whole map", () => {
    expect(box(setup().svg)).toBe("0 0 1600 1100");
  });

  it("returns to the whole map with Ganze Karte", async () => {
    const { svg } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Hineinzoomen" }));
    expect(box(svg)).not.toBe("0 0 1600 1100");
    await userEvent.click(screen.getByRole("button", { name: "Ganze Karte" }));
    expect(box(svg)).toBe("0 0 1600 1100");
  });

  it("zooms back out with the button", async () => {
    const { svg } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Hineinzoomen" }));
    await userEvent.click(screen.getByRole("button", { name: "Herauszoomen" }));
    expect(box(svg)).toBe("0 0 1600 1100");
  });

  const drag = (target: Element, distance: number) => {
    fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 100 + distance, clientY: 100 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 100 + distance, clientY: 100 });
    fireEvent.click(target);
  };

  it("does not select after a drag", () => {
    const { onSelect } = setup();
    drag(button("Mitte"), 4);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("counts a drag under four pixels as a click", () => {
    const { onSelect } = setup();
    drag(button("Mitte"), 3);
    expect(onSelect).toHaveBeenCalledWith("Mitte");
  });

  it("pans by dragging", async () => {
    const { svg } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Hineinzoomen" }));
    await userEvent.click(screen.getByRole("button", { name: "Hineinzoomen" }));
    const [x, y] = (box(svg) as string).split(" ").map(Number) as [number, number];
    drag(svg, -80);
    const [movedX, movedY] = (box(svg) as string).split(" ").map(Number) as [number, number];
    expect(movedX).toBeGreaterThan(x);
    expect(movedY).toBe(y);
  });

  it("prevents the page from scrolling on wheel", () => {
    const { svg } = setup();
    const notPrevented = fireEvent.wheel(svg, { deltaY: -200, clientX: 400, clientY: 300 });
    expect(notPrevented).toBe(false);
    expect(box(svg)).not.toBe("0 0 1600 1100");
  });

  it("brings a node into view when the keyboard reaches it", async () => {
    const { svg } = setup();
    for (let i = 0; i < 4; i += 1) await userEvent.click(screen.getByRole("button", { name: "Hineinzoomen" }));
    act(() => button("Fern").focus());
    const [x, y, width, height] = (box(svg) as string).split(" ").map(Number) as [number, number, number, number];
    expect(1500).toBeGreaterThan(x);
    expect(1500).toBeLessThan(x + width);
    expect(1000).toBeGreaterThan(y);
    expect(1000).toBeLessThan(y + height);
  });
});

describe("SkillMap decoration", () => {
  it("keeps sprites clear of nodes, labels and region titles", () => {
    const { container } = setup({ nodes: gameContent.nodes, paths: gameContent.paths, road: gameContent.road });
    const images = Array.from(container.querySelectorAll("g[data-layer=decor] image")).map((image) => {
      const [x, y, w, h] = ["x", "y", "width", "height"].map((name) => Number(image.getAttribute(name))) as [number, number, number, number];
      return { left: x, top: y, right: x + w, bottom: y + h };
    });
    expect(images.length).toBeGreaterThan(30);
    const boxes = gameContent.nodes.flatMap((n) => {
      const half = (n.title.length * 6.4) / 2;
      return [
        { left: n.x - half, right: n.x + half, top: n.y + 16, bottom: n.y + 32 },
        { left: n.x - 16, right: n.x + 16, top: n.y - 16, bottom: n.y + 16 },
      ];
    });
    for (const image of images) {
      for (const b of boxes) {
        const hit = image.left < b.right && b.left < image.right && image.top < b.bottom && b.top < image.bottom;
        expect(hit, JSON.stringify({ image, b })).toBe(false);
      }
    }
  });
});
