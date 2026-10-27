import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithProviders } from "../../../../test/render";
import { Markdown } from "./Markdown";
import { mathHtml } from "./MathBlock";

describe("Markdown", () => {
  it("renders headings, lists, code with a copy button and tables", async () => {
    await renderWithProviders(<Markdown text={"# Hello\n\n- one\n- two\n\n```ts\nconst a = 1\n```\n\n|a|b|\n|-|-|\n|1|2|"} />, { navigation: false });
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("one")).toBeTruthy();
    expect(screen.getByTestId("code-block")).toBeTruthy();
    expect(screen.getByLabelText("Copy code")).toBeTruthy();
    expect(screen.getByTestId("md-table")).toBeTruthy();
  });

  it("turns [n] into a citation only when that source exists, and reports taps", async () => {
    const onCite = jest.fn();
    await renderWithProviders(<Markdown text="Tides follow the moon [1], mostly [7]." citable={(n) => n === 1} onCite={onCite} />, { navigation: false });
    fireEvent.press(screen.getByLabelText("Source 1"));
    expect(onCite).toHaveBeenCalledWith(1);
    expect(screen.queryByLabelText("Source 7")).toBeNull();
  });

  it("shows display math in a sandboxed view and bad TeX as code", async () => {
    expect(mathHtml("x=\\frac{1}{2}", "#000")).toContain("<math");
    expect(mathHtml("x=\\frac{1}{2}", "#000")).toContain("default-src 'none'");
    expect(mathHtml("\\frac{", "#000")).toBeNull();
    await renderWithProviders(<Markdown text={"$$\\frac{$$"} />, { navigation: false });
    expect(screen.getByTestId("code-block")).toBeTruthy();
  });
});
