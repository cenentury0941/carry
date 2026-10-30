import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { MoveProject, RankedDestination } from "@/contracts";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#18181b",
  },
  eyebrow: {
    fontSize: 9,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    color: "#3f3f46",
    marginBottom: 16,
    lineHeight: 1.4,
  },
  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#27272a",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingVertical: 6,
  },
  muted: {
    color: "#71717a",
    fontSize: 9,
  },
  bullet: {
    marginBottom: 3,
    paddingLeft: 8,
  },
  score: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 8,
    color: "#a1a1aa",
    lineHeight: 1.4,
  },
});

function originBlurb(move: MoveProject): string {
  const from = move.residence?.name ?? "your current home";
  const toward = move.target
    ? move.target.kind === "ambiguous"
      ? ` toward ${move.target.region}`
      : ` across ${move.target.places.length} candidate targets`
    : "";
  return `From ${from}${toward}. Generated ${move.result?.generatedAt ?? move.updatedAt}.`;
}

function RankingPage({
  move,
  ranked,
}: {
  move: MoveProject;
  ranked: RankedDestination[];
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>Carry relocation brief</Text>
      <Text style={styles.title}>All destinations</Text>
      <Text style={styles.subtitle}>{originBlurb(move)}</Text>
      {ranked.map((d, i) => (
        <View key={`${d.id}-${i}`} style={styles.row}>
          <Text>
            #{i + 1} {d.label}
          </Text>
          <Text style={styles.muted}>
            {(d.score * 100).toFixed(0)} · cont {d.continuity}
          </Text>
        </View>
      ))}
      <Text style={styles.disclaimer}>
        Continuity and match scores are Carry metrics derived from Qloo Taste AI
        affinities and tag overlap. They are cultural taste signals, not
        predictions of housing cost, commute, safety, or personal happiness.
        Powered by Qloo.
      </Text>
    </Page>
  );
}

function DestinationDetailPage({
  move,
  focus,
  index,
  total,
}: {
  move: MoveProject;
  focus: RankedDestination;
  index?: number;
  total?: number;
}) {
  const pageLabel =
    typeof index === "number" && typeof total === "number"
      ? `Destination ${index + 1} of ${total}`
      : "Carry relocation brief";

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>{pageLabel}</Text>
      <Text style={styles.title}>{focus.label}</Text>
      <Text style={styles.subtitle}>{originBlurb(move)}</Text>

      <View style={{ flexDirection: "row", gap: 24, marginBottom: 12 }}>
        <View>
          <Text style={styles.score}>{focus.continuity}</Text>
          <Text style={styles.muted}>continuity / 100</Text>
        </View>
        <View>
          <Text style={styles.score}>{(focus.score * 100).toFixed(0)}</Text>
          <Text style={styles.muted}>match score</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text>{focus.summary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Familiar taste signals</Text>
        {focus.matches.slice(0, 8).map((t) => (
          <Text key={t.id} style={styles.bullet}>
            • {t.name}
          </Text>
        ))}
        {focus.matches.length === 0 && (
          <Text style={styles.muted}>None surfaced</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stronger at the destination</Text>
        {focus.mismatches.slice(0, 8).map((t) => (
          <Text key={t.id} style={styles.bullet}>
            • {t.name}
          </Text>
        ))}
        {focus.mismatches.length === 0 && (
          <Text style={styles.muted}>No strong differences</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What to expect</Text>
        {focus.expect.map((line) => (
          <Text key={line} style={styles.bullet}>
            • {line}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Places of interest</Text>
        {focus.venues.slice(0, 8).map((v) => (
          <View key={v.id} style={{ marginBottom: 8 }}>
            <View style={styles.row}>
              <Text>{v.name}</Text>
              <Text style={styles.muted}>
                {typeof v.affinity === "number"
                  ? `${Math.round(v.affinity * 100)}% affinity`
                  : ""}
              </Text>
            </View>
            {v.address ? <Text style={styles.muted}>{v.address}</Text> : null}
            {v.evidenceTags?.length ? (
              <Text style={{ marginTop: 2 }}>
                Shared: {v.evidenceTags.slice(0, 5).join(", ")}
              </Text>
            ) : null}
            {v.distinctTags?.length ? (
              <Text style={styles.muted}>
                Stronger here: {v.distinctTags.slice(0, 4).join(", ")}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        Continuity and match scores are Carry metrics derived from Qloo Taste AI
        affinities and tag overlap. They are cultural taste signals, not
        predictions of housing cost, commute, safety, or personal happiness.
        Powered by Qloo.
      </Text>
    </Page>
  );
}

export function MovePdfDocument({
  move,
  focus,
}: {
  move: MoveProject;
  /** When set, export only this destination. When null, export every destination. */
  focus: RankedDestination | null;
}) {
  const ranked = move.result?.destinations ?? [];

  if (focus) {
    return (
      <Document>
        <DestinationDetailPage move={move} focus={focus} />
        <RankingPage move={move} ranked={ranked} />
      </Document>
    );
  }

  return (
    <Document>
      <RankingPage move={move} ranked={ranked} />
      {ranked.map((d, i) => (
        <DestinationDetailPage
          key={`${d.id}-${i}`}
          move={move}
          focus={d}
          index={i}
          total={ranked.length}
        />
      ))}
    </Document>
  );
}
