/**
 * Renders an answer's markdown as native views: headings in the display face, paragraphs
 * in the answer size, lists (nested, numbered, tasks), quotes, tables that scroll
 * sideways, code blocks and display math. Links open in the in-app browser; "[n]" marks
 * become tappable citations when a source with that number exists. Raw HTML is never
 * interpreted: it shows as text.
 *
 * Blocks are memoised on their raw text, so while an answer streams only the block being
 * written re-renders.
 */
import { memo, useMemo, type ReactNode } from "react";
import { Linking, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import InAppBrowser from "react-native-inappbrowser-reborn";
import type { Token, Tokens } from "marked";
import { useTheme } from "../../../ui/theme/ThemeProvider";
import { fonts, space, type } from "../../../ui/theme/tokens";
import type { Palette } from "../../../ui/theme/tokens";
import { CodeBlock } from "./CodeBlock";
import { MathBlock } from "./MathBlock";
import { parseMarkdown, splitInline } from "./parse";
import { texToText } from "./tex";

export interface MarkdownProps {
  text: string;
  /** Source numbers an answer may cite; others stay plain "[n]" text. */
  citable?: (n: number) => boolean;
  onCite?: (n: number) => void;
  testID?: string;
}

/** Opens http(s) links in the in-app browser; anything else (javascript:, file:) is ignored. */
export async function openLink(href: string): Promise<void> {
  if (!/^https?:\/\//i.test(href)) {
    if (/^mailto:/i.test(href)) await Linking.openURL(href).catch(() => undefined);
    return;
  }
  try {
    if (await InAppBrowser.isAvailable())
      await InAppBrowser.open(href, {
        modalPresentationStyle: "pageSheet",
        showTitle: true,
        enableUrlBarHiding: true,
      });
    else await Linking.openURL(href);
  } catch {
    await Linking.openURL(href).catch(() => undefined);
  }
}

interface Ctx {
  colors: Palette;
  citable: (n: number) => boolean;
  onCite?: (n: number) => void;
}

function inline(tokens: Token[] | undefined, ctx: Ctx, keyBase: string): ReactNode[] {
  if (!tokens) return [];
  return tokens.map((t, i) => inlineToken(t, ctx, `${keyBase}.${i}`));
}

function textWithCitations(text: string, ctx: Ctx, key: string): ReactNode {
  const pieces = splitInline(text, ctx.citable);
  if (pieces.length === 1 && pieces[0]!.kind === "text") return text;
  return pieces.map((p, i) => {
    if (p.kind === "text") return p.text;
    if (p.kind === "math")
      return (
        <RNText key={`${key}.${i}`} style={styles.math}>
          {texToText(p.tex)}
        </RNText>
      );
    return (
      <RNText
        key={`${key}.${i}`}
        accessibilityRole="link"
        accessibilityLabel={`Source ${p.n}`}
        onPress={ctx.onCite ? () => ctx.onCite!(p.n) : undefined}
        style={[styles.cite, { color: ctx.colors.link }]}
        suppressHighlighting={false}
      >
        {` [${p.n}]`}
      </RNText>
    );
  });
}

function inlineToken(t: Token, ctx: Ctx, key: string): ReactNode {
  switch (t.type) {
    case "text": {
      const tt = t as Tokens.Text;
      return tt.tokens?.length ? <RNText key={key}>{inline(tt.tokens, ctx, key)}</RNText> : <RNText key={key}>{textWithCitations(tt.text, ctx, key)}</RNText>;
    }
    case "escape":
      return <RNText key={key}>{(t as Tokens.Escape).text}</RNText>;
    case "strong":
      return (
        <RNText key={key} style={styles.strong}>
          {inline((t as Tokens.Strong).tokens, ctx, key)}
        </RNText>
      );
    case "em":
      return (
        <RNText key={key} style={styles.em}>
          {inline((t as Tokens.Em).tokens, ctx, key)}
        </RNText>
      );
    case "del":
      return (
        <RNText key={key} style={styles.del}>
          {inline((t as Tokens.Del).tokens, ctx, key)}
        </RNText>
      );
    case "codespan":
      return (
        <RNText key={key} style={[styles.inlineCode, { backgroundColor: ctx.colors.muted }]}>
          {(t as Tokens.Codespan).text}
        </RNText>
      );
    case "br":
      return <RNText key={key}>{"\n"}</RNText>;
    case "link": {
      const l = t as Tokens.Link;
      return (
        <RNText
          key={key}
          accessibilityRole="link"
          onPress={() => {
            openLink(l.href);
          }}
          style={[styles.link, { color: ctx.colors.link }]}
        >
          {inline(l.tokens, ctx, key)}
        </RNText>
      );
    }
    case "image": {
      const im = t as Tokens.Image;
      return (
        <RNText
          key={key}
          accessibilityRole="link"
          onPress={() => {
            openLink(im.href);
          }}
          style={{ color: ctx.colors.link }}
        >
          {im.text || im.href}
        </RNText>
      );
    }
    default:
      return <RNText key={key}>{"text" in t ? String((t as { text: string }).text) : t.raw}</RNText>;
  }
}

function ListBlock({ list, ctx, depth }: { list: Tokens.List; ctx: Ctx; depth: number }) {
  const start = typeof list.start === "number" ? list.start : 1;
  return (
    <View style={[styles.list, depth > 0 && styles.nested]}>
      {list.items.map((item, i) => {
        const marker = item.task ? (item.checked ? "☑" : "☐") : list.ordered ? `${start + i}.` : depth % 2 === 0 ? "•" : "◦";
        return (
          <View key={i} style={styles.item}>
            <RNText style={[styles.answer, styles.marker, { color: ctx.colors.mutedForeground }, list.ordered && styles.markerNumber]}>{marker}</RNText>
            <View style={styles.itemBody}>
              {item.tokens.map((child, j) =>
                child.type === "list" ? (
                  <ListBlock key={j} list={child as Tokens.List} ctx={ctx} depth={depth + 1} />
                ) : child.type === "text" || child.type === "paragraph" ? (
                  <RNText key={j} style={[styles.answer, { color: ctx.colors.foreground }]}>
                    {inline((child as Tokens.Text).tokens ?? [child], ctx, `li${i}.${j}`)}
                  </RNText>
                ) : (
                  <BlockView key={j} block={child} ctx={ctx} />
                )
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TableBlock({ table, ctx }: { table: Tokens.Table; ctx: Ctx }) {
  const cell = (c: Tokens.TableCell, header: boolean, key: string) => (
    <View key={key} style={[styles.cell, { borderColor: ctx.colors.border }]}>
      <RNText style={[styles.cellText, { color: ctx.colors.foreground }, header && styles.strong]}>{inline(c.tokens, ctx, key)}</RNText>
    </View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll} testID="md-table">
      <View>
        <View style={[styles.row, { borderBottomColor: ctx.colors.input }]}>{table.header.map((c, i) => cell(c, true, `h${i}`))}</View>
        {table.rows.map((r, ri) => (
          <View key={ri} style={[styles.row, { borderBottomColor: ctx.colors.border }]}>
            {r.map((c, ci) => cell(c, false, `r${ri}.${ci}`))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function BlockView({ block, ctx }: { block: Token; ctx: Ctx }) {
  const color = { color: ctx.colors.foreground };
  switch (block.type) {
    case "heading": {
      const h = block as Tokens.Heading;
      const style = h.depth <= 1 ? type.title : h.depth === 2 ? type.heading : type.subheading;
      return (
        <RNText accessibilityRole="header" style={[style, color, styles.heading]}>
          {inline(h.tokens, ctx, "h")}
        </RNText>
      );
    }
    case "paragraph":
      return <RNText style={[styles.answer, color, styles.paragraph]}>{inline((block as Tokens.Paragraph).tokens, ctx, "p")}</RNText>;
    case "text":
      return <RNText style={[styles.answer, color, styles.paragraph]}>{inline((block as Tokens.Text).tokens ?? [block], ctx, "t")}</RNText>;
    case "code": {
      const c = block as Tokens.Code;
      if (c.lang === "math") return <MathBlock tex={c.text} />;
      return <CodeBlock code={c.text} lang={c.lang || null} />;
    }
    case "list":
      return <ListBlock list={block as Tokens.List} ctx={ctx} depth={0} />;
    case "blockquote":
      return (
        <View style={[styles.quote, { borderLeftColor: ctx.colors.input }]}>
          {(block as Tokens.Blockquote).tokens.map((b, i) => (
            <BlockView key={i} block={b} ctx={ctx} />
          ))}
        </View>
      );
    case "table":
      return <TableBlock table={block as Tokens.Table} ctx={ctx} />;
    case "hr":
      return <View style={[styles.hr, { backgroundColor: ctx.colors.border }]} />;
    case "html":
      return <RNText style={[styles.answer, color, styles.paragraph]}>{block.raw}</RNText>;
    default:
      return block.raw.trim() ? <RNText style={[styles.answer, color, styles.paragraph]}>{block.raw}</RNText> : null;
  }
}

const MemoBlock = memo(BlockView, (a, b) => a.block.raw === b.block.raw && a.ctx === b.ctx);

export const Markdown = memo(function MarkdownImpl({ text, citable, onCite, testID }: MarkdownProps) {
  const { colors } = useTheme();
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const ctx = useMemo<Ctx>(() => ({ colors, citable: citable ?? (() => false), onCite }), [colors, citable, onCite]);
  return (
    <View testID={testID}>
      {blocks.map((b, i) => (
        <MemoBlock key={`${i}:${b.type}`} block={b} ctx={ctx} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  nested: { marginTop: 2 },
  link: { textDecorationLine: "underline" },
  answer: { ...type.answer },
  paragraph: { marginBottom: space[3] },
  heading: { marginTop: space[2], marginBottom: space[2] },
  strong: { fontFamily: fonts.body.semibold },
  em: { fontStyle: "italic" },
  del: { textDecorationLine: "line-through" },
  inlineCode: { fontFamily: fonts.mono, fontSize: 14 },
  math: { fontStyle: "italic" },
  cite: { fontFamily: fonts.body.semibold, fontSize: 13 },
  list: { marginBottom: space[3] },
  item: { flexDirection: "row", marginBottom: 2 },
  marker: { width: 22 },
  markerNumber: { fontFamily: fonts.body.medium },
  itemBody: { flex: 1 },
  quote: { borderLeftWidth: 3, paddingLeft: space[3], marginBottom: space[3] },
  tableScroll: { marginBottom: space[3] },
  row: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  cell: {
    minWidth: 96,
    maxWidth: 260,
    paddingVertical: space[2],
    paddingRight: space[4],
  },
  cellText: { ...type.body },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: space[4] },
});
