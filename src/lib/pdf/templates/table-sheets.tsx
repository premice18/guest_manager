// Template PDF : Fiches par table — une page par table avec liste des invités
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

interface TableSheetsProps {
  eventName: string;
  tables: Array<{
    name: string;
    capacity: number;
    zone_name: string;
    guests: Array<{
      first_name: string;
      last_name: string;
      category: string | null;
      age_type: string;
      dietary_notes: string | null;
      needs_accessibility: boolean;
    }>;
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
  eventHeader: {
    marginBottom: 16,
    borderBottom: `2 solid ${COLORS.gold}`,
    paddingBottom: 8,
  },
  eventTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  tableSection: {
    marginBottom: 20,
  },
  tableHeader: {
    borderLeft: `3 solid ${COLORS.gold}`,
    paddingLeft: 8,
    marginBottom: 8,
  },
  tableName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: COLORS.deepBlack,
    marginBottom: 2,
  },
  tableMeta: {
    fontSize: 9,
    color: COLORS.anthracite,
    marginBottom: 1,
  },
  guestRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    fontSize: 8,
  },
  guestHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.deepBlack,
    color: COLORS.offWhite,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  colName: { width: "30%" },
  colCategory: { width: "20%" },
  colAge: { width: "15%" },
  colDiet: { width: "35%" },
  emptyMessage: {
    textAlign: "center",
    color: COLORS.anthracite,
    fontSize: 9,
    fontStyle: "italic",
    marginVertical: 12,
  },
  dietarySummary: {
    fontSize: 8,
    color: COLORS.anthracite,
    marginTop: 6,
    marginBottom: 4,
  },
  notes: {
    marginTop: 20,
    borderTop: `1 dashed ${COLORS.gold}`,
    paddingTop: 8,
  },
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLORS.anthracite,
    marginBottom: 4,
  },
  notesLines: {
    borderBottom: `1 dotted #CCCCCC`,
    height: 14,
    marginBottom: 4,
  },
});

export function TableSheetsDocument({ eventName, tables }: TableSheetsProps) {
  return (
    <Document>
      {tables.map((table, tIndex) => {
        const dietarySummary = extractDietarySummary(table.guests);

        return (
          <Page key={tIndex} size="A4" style={styles.page}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>{eventName}</Text>
            </View>

            <View style={styles.tableSection}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableName}>Table : {table.name}</Text>
                <Text style={styles.tableMeta}>Capacité : {table.capacity} personne{table.capacity > 1 ? "s" : ""}</Text>
                <Text style={styles.tableMeta}>Zone : {table.zone_name}</Text>
              </View>

              {dietarySummary.length > 0 && (
                <Text style={styles.dietarySummary}>
                  Régimes : {dietarySummary.map((d) => `${d.type} (×${d.count})`).join(", ")}
                </Text>
              )}

              {table.guests.length === 0 ? (
                <Text style={styles.emptyMessage}>Aucun invité attribué</Text>
              ) : (
                <>
                  <View style={styles.guestHeader}>
                    <Text style={styles.colName}>Nom Prénom</Text>
                    <Text style={styles.colCategory}>Catégorie</Text>
                    <Text style={styles.colAge}>Âge</Text>
                    <Text style={styles.colDiet}>Restrictions / Accessibilité</Text>
                  </View>
                  {table.guests.map((guest, gIndex) => (
                    <View
                      key={gIndex}
                      style={[
                        styles.guestRow,
                        { backgroundColor: gIndex % 2 === 0 ? COLORS.white : COLORS.lightGray },
                      ]}
                    >
                      <Text style={styles.colName}>
                        {guest.last_name} {guest.first_name}
                      </Text>
                      <Text style={styles.colCategory}>{guest.category ?? "—"}</Text>
                      <Text style={styles.colAge}>
                        {guest.age_type === "adult"
                          ? "Adulte"
                          : guest.age_type === "child"
                          ? "Enfant"
                          : "Bébé"}
                      </Text>
                      <Text style={styles.colDiet}>
                        {[guest.dietary_notes, guest.needs_accessibility ? "♿" : null]
                          .filter(Boolean)
                          .join(" — ") || "—"}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <View style={styles.notes}>
              <Text style={styles.notesLabel}>Notes :</Text>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.notesLines} />
              ))}
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

// Extrait le résumé des régimes alimentaires pour une table
function extractDietarySummary(
  guests: Array<{ dietary_notes: string | null }>
): Array<{ type: string; count: number }> {
  const diets = new Map<string, number>();
  for (const g of guests) {
    if (g.dietary_notes) {
      const types = g.dietary_notes.split(",").map((d) => d.trim().toLowerCase());
      for (const t of types) {
        diets.set(t, (diets.get(t) ?? 0) + 1);
      }
    }
  }
  return Array.from(diets.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
