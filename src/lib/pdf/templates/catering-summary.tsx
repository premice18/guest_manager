// Template PDF : Synthèse logistique (Catering Summary) — vue globale pour le traiteur
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

interface CateringSummaryProps {
  eventName: string;
  eventDate: string;
  totalGuests: number;
  ageBreakdown: { adults: number; children: number; babies: number };
  dietarySummary: Array<{ type: string; count: number }>;
  tables: Array<{
    name: string;
    guests: Array<{
      first_name: string;
      last_name: string;
      dietary_notes: string | null;
      needs_accessibility: boolean;
    }>;
  }>;
  accessibilityGuests: Array<{
    first_name: string;
    last_name: string;
    table_name: string;
  }>;
}

const COLORS = {
  gold: "#C9A96E",
  deepBlack: "#1A1A1A",
  offWhite: "#F8F6F0",
  anthracite: "#2D2D2D",
  lightGray: "#F0F0F0",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: "20mm",
    color: COLORS.deepBlack,
  },
  header: {
    marginBottom: 16,
    borderBottom: `2 solid ${COLORS.gold}`,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 9,
    color: COLORS.anthracite,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: COLORS.deepBlack,
    marginTop: 14,
    marginBottom: 6,
    borderBottom: `1 solid ${COLORS.gold}`,
    paddingBottom: 3,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    paddingHorizontal: 2,
    fontSize: 9,
  },
  summaryRowAlt: {
    backgroundColor: COLORS.lightGray,
  },
  summaryLabel: {
    color: COLORS.anthracite,
  },
  summaryValue: {
    fontFamily: "Helvetica-Bold",
  },
  tableDietRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    fontSize: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.deepBlack,
    color: COLORS.offWhite,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    fontSize: 8,
  },
  colTableName: { width: "25%" },
  colGuestName: { width: "30%" },
  colDiet: { width: "45%" },
  accessibilityItem: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    fontSize: 8,
  },
  accessibilityColName: { width: "35%" },
  accessibilityColTable: { width: "25%" },
  accessibilityColNote: { width: "40%" },
  emptyText: {
    fontStyle: "italic",
    color: COLORS.anthracite,
    fontSize: 8,
    marginVertical: 4,
  },
});

export function CateringSummaryDocument({
  eventName,
  eventDate,
  totalGuests,
  ageBreakdown,
  dietarySummary,
  tables,
  accessibilityGuests,
}: CateringSummaryProps) {
  const specialDietsCount = tables.reduce((acc, t) => {
    return acc + t.guests.filter((g) => g.dietary_notes).length;
  }, 0);

  const accessibilityCount = accessibilityGuests.length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Synthèse logistique – {eventName}</Text>
          <Text style={styles.headerDate}>
            {new Date(eventDate).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Résumé global */}
        <Text style={styles.sectionTitle}>Résumé global</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total invités</Text>
          <Text style={styles.summaryValue}>{totalGuests}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowAlt]}>
          <Text style={styles.summaryLabel}>Adultes</Text>
          <Text style={styles.summaryValue}>{ageBreakdown.adults}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Enfants</Text>
          <Text style={styles.summaryValue}>{ageBreakdown.children}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowAlt]}>
          <Text style={styles.summaryLabel}>Bébés</Text>
          <Text style={styles.summaryValue}>{ageBreakdown.babies}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Régimes spéciaux</Text>
          <Text style={styles.summaryValue}>{specialDietsCount}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowAlt]}>
          <Text style={styles.summaryLabel}>Besoins accessibilité</Text>
          <Text style={styles.summaryValue}>{accessibilityCount}</Text>
        </View>

        {/* Détail des régimes alimentaires */}
        {dietarySummary.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Régimes alimentaires</Text>
            <View style={styles.tableHeader}>
              <Text style={{ width: "60%" }}>Type</Text>
              <Text style={{ width: "40%", textAlign: "right" }}>Nombre</Text>
            </View>
            {dietarySummary.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.tableDietRow,
                  { backgroundColor: i % 2 === 0 ? COLORS.white : COLORS.lightGray },
                ]}
              >
                <Text style={{ width: "60%" }}>{d.type}</Text>
                <Text style={{ width: "40%", textAlign: "right" }}>{d.count}</Text>
              </View>
            ))}
          </>
        )}

        {/* Détail par table */}
        <Text style={styles.sectionTitle}>Détail par table</Text>
        {tables.map((table, tIndex) => {
          const guestsWithDiet = table.guests.filter((g) => g.dietary_notes || g.needs_accessibility);
          return (
            <View key={tIndex} style={{ marginBottom: 6 }}>
              <View style={styles.tableHeader}>
                <Text style={styles.colTableName}>Table : {table.name}</Text>
                <Text style={styles.colGuestName}>Invité</Text>
                <Text style={styles.colDiet}>Restrictions</Text>
              </View>
              {guestsWithDiet.length === 0 ? (
                <Text style={styles.emptyText}>Aucune restriction alimentaire</Text>
              ) : (
                guestsWithDiet.map((g, gIndex) => (
                  <View
                    key={gIndex}
                    style={[
                      styles.tableRow,
                      { backgroundColor: gIndex % 2 === 0 ? COLORS.white : COLORS.lightGray },
                    ]}
                  >
                    <Text style={styles.colTableName}>{table.name}</Text>
                    <Text style={styles.colGuestName}>
                      {g.last_name} {g.first_name}
                    </Text>
                    <Text style={styles.colDiet}>
                      {[g.dietary_notes, g.needs_accessibility ? "♿" : null]
                        .filter(Boolean)
                        .join(" — ") || "—"}
                    </Text>
                  </View>
                ))
              )}
            </View>
          );
        })}

        {/* Besoins accessibilité */}
        {accessibilityGuests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Besoins en accessibilité</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.accessibilityColName}>Nom Prénom</Text>
              <Text style={styles.accessibilityColTable}>Table</Text>
              <Text style={styles.accessibilityColNote}>Note</Text>
            </View>
            {accessibilityGuests.map((g, i) => (
              <View
                key={i}
                style={[
                  styles.accessibilityItem,
                  { backgroundColor: i % 2 === 0 ? COLORS.white : COLORS.lightGray },
                ]}
              >
                <Text style={styles.accessibilityColName}>
                  {g.last_name} {g.first_name}
                </Text>
                <Text style={styles.accessibilityColTable}>{g.table_name}</Text>
                <Text style={styles.accessibilityColNote}>♿ Accès prioritaires</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
