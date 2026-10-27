import { groupByDate } from "./queries";

const c = (id: string, at: string) => ({ id, title: id, projectId: null, pinned: false, archived: false, lastMessageAt: at, createdAt: at });

describe("groupByDate", () => {
  it("groups under Today, Yesterday, the last 7 and 30 days, then months", () => {
    const now = new Date(2026, 9, 27, 15, 0);
    const groups = groupByDate(
      [c("a", new Date(2026, 9, 27, 9).toISOString()), c("b", new Date(2026, 9, 26, 22).toISOString()), c("d", new Date(2026, 9, 22).toISOString()), c("e", new Date(2026, 9, 5).toISOString()), c("f", new Date(2026, 6, 1).toISOString())],
      now
    );
    expect(groups.map((g) => [g.label.replace(/\d{4}/, "YYYY"), g.items.map((i) => i.id)])).toEqual([
      ["Today", ["a"]],
      ["Yesterday", ["b"]],
      ["Previous 7 days", ["d"]],
      ["Previous 30 days", ["e"]],
      [expect.stringMatching(/YYYY/), ["f"]],
    ]);
  });
});
