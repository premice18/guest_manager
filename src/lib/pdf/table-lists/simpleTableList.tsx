// Template PDF : Liste simple des tables — version fonctionnelle pour le personnel
// Colonnes : N°, Noms (Prénom Nom), Nombres (taille du groupe), Table
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type { TableWithGuestsExport, TableListGuest } from "./utils";
import { getGroupSize, getGroupSizeMap } from "./utils";

interface SimpleTableListProps {
  eventName: string;
  eventDate: string;
  location: string | null;
  tables: TableWithGuestsExport[];
  totalGuests: number;
}

const COLORS = {
  gold: "#C9A96E",
  deepBlack: "#1A1A1A",
  anthracite: "#2D2D2D",
  offWhite: "#F8F6F0",
  lightGray: "#F3F4F6",
  borderGray: "#D1D5DB",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: "15mm",
    color: COLORS.deepBlack,
    backgroundColor: COLORS.offWhite,
  },
  docHeader: {
    marginBottom: 16,
    borderBottom: `2 solid ${COLORS.gold}`,
    paddingBottom: 10,
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: COLORS.gold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  docSubtitle: {
    fontSize: 10,
    color: COLORS.anthracite,
    marginBottom: 2,
  },
  docSummary: {
    fontSize: 8,
    color: COLORS.anthracite,
    marginTop: 4,
  },
  tableSection: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderGray,
  },
  tableHeader: {
    borderLeft: `3 solid ${COLORS.gold}`,
    paddingLeft: 8,
    marginBottom: 6,
  },
  tableName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: COLORS.deepBlack,
    marginBottom: 2,
  },
  tableMeta: {
    fontSize: 8,
    color: COLORS.anthracite,
    marginBottom: 1,
  },
  tableStatus: {
    fontSize: 8,
    color: COLORS.anthracite,
    marginTop: 2,
  },
  guestTable: {
    marginTop: 4,
  },
  guestHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.deepBlack,
    color: COLORS.offWhite,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  guestRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 2,
    fontSize: 7.5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderGray,
  },
  colNum: { width: "8%" },
  colNoms: { width: "38%" },
  colNombres: { width: "22%" },
  colTable: { width: "32%" },
  emptyMessage: {
    textAlign: "center",
    color: COLORS.anthracite,
    fontSize: 9,
    fontStyle: "italic",
    marginVertical: 10,
  },
  footer: {
    marginTop: 12,
    borderTop: `1 solid ${COLORS.gold}`,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.anthracite,
  },
  pageNumber: {
    position: "absolute",
    bottom: "12mm",
    right: "15mm",
    fontSize: 7,
    color: COLORS.anthracite,
  },
});

// En-tête du tableau des invités
const GuestTableHeader = () => (
  <View style={styles.guestHeader} fixed>
    <Text style={styles.colNum}>N°</Text>
    <Text style={styles.colNoms}>Noms</Text>
    <Text style={styles.colNombres}>Nombre</Text>
    <Text style={styles.colTable}>Table</Text>
  </View>
);

// Section d'une table individuelle
function TableSection({
  table,
  tableIndex,
  groupSizeMap,
}: {
  table: TableWithGuestsExport;
  tableIndex: number;
  groupSizeMap: Map<string | null, number>;
}) {
  const guestsAtTable = table.guests;
  const isFull = guestsAtTable.length >= table.capacity;
  const available = table.capacity - guestsAtTable.length;

  return (
    <View style={styles.tableSection} wrap={false}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableName}>
          Table {table.name} — Capacité : {guestsAtTable.length}/{table.capacity} places
        </Text>
        {table.zone_name !== "—" && (
          <Text style={styles.tableMeta}>Zone : {table.zone_name}</Text>
        )}
        <Text style={styles.tableStatus}>
          {guestsAtTable.length === 0
            ? "Table vide"
            : isFull
            ? "Complète"
            : `Places disponibles : ${available}`}
        </Text>
      </View>

      {guestsAtTable.length === 0 ? (
        <Text style={styles.emptyMessage}>Aucun invité attribué</Text>
      ) : (
        <View style={styles.guestTable}>
          <GuestTableHeader />
          {guestsAtTable.map((guest, gIndex) => (
            <View
              key={`${guest.last_name}-${guest.first_name}-${gIndex}`}
              style={[
                styles.guestRow,
                {
                  backgroundColor:
                    gIndex % 2 === 0 ? COLORS.white : COLORS.lightGray,
                },
              ]}
            >
              <Text style={styles.colNum}>{gIndex + 1}</Text>
              <Text style={styles.colNoms}>
                {guest.first_name} {guest.last_name}
              </Text>
              <Text style={styles.colNombres}>
                {getGroupSize(guest, groupSizeMap)}
              </Text>
              <Text style={styles.colTable}>{table.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Document complet de la liste simple des tables
export function SimpleTableListDocument({
  eventName,
  eventDate,
  location,
  tables,
  totalGuests,
}: SimpleTableListProps) {
  const tablesWithGuests = tables.filter((t) => t.guests.length > 0);
  const tablesEmpty = tables.filter((t) => t.guests.length === 0);
  const avgPerTable =
    tablesWithGuests.length > 0
      ? Math.round(totalGuests / tablesWithGuests.length)
      : 0;

  // Calcule la taille des groupes à partir de tous les invités de toutes les tables
  const allGuests = tables.flatMap((t) => t.guests);
  const groupSizeMap = getGroupSizeMap(allGuests);

  const printDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.docHeader}>
          <Text style={styles.docTitle}>Liste des tables</Text>
          <Text style={styles.docSubtitle}>{eventName}</Text>
          <Text style={styles.docSubtitle}>
            {new Date(eventDate).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {location ? ` — ${location}` : ""}
          </Text>
          <Text style={styles.docSummary}>
            Total : {totalGuests} invité{totalGuests > 1 ? "s" : ""} —{" "}
            {tables.length} table{tables.length > 1 ? "s" : ""} —{" "}
            Moyenne : {avgPerTable} invité{avgPerTable > 1 ? "s" : ""} par table
          </Text>
        </View>

        {tablesWithGuests.map((table, tIndex) => (
          <TableSection
            key={table.id}
            table={table}
            tableIndex={tIndex}
            groupSizeMap={groupSizeMap}
          />
        ))}

        {tablesEmpty.length > 0 && (
          <View style={styles.tableSection}>
            <Text
              style={{
                fontFamily: "Helvetica-Bold",
                fontSize: 11,
                color: COLORS.anthracite,
                marginBottom: 6,
              }}
            >
              Tables vides
            </Text>
            {tablesEmpty.map((table) => (
              <Text key={table.id} style={{ fontSize: 8, marginBottom: 2 }}>
                Table {table.name} — Capacité : {table.capacity} places
              </Text>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text>Imprimé le {printDate}</Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
