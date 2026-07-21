// Template PDF : Livre d'Or (Master Book) — liste alphabétique des invités
// Colonnes : N°, Noms (Prénom Nom), Nombres (taille du groupe), Table
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

interface MasterBookProps {
  eventName: string;
  eventDate: string;
  location: string | null;
  guests: Array<{
    first_name: string;
    last_name: string;
    table_name: string | null;
    group_id: string | null;
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
    fontSize: 8,
    padding: "20mm",
    color: COLORS.deepBlack,
  },
  header: {
    marginBottom: 16,
    borderBottom: `2 solid ${COLORS.gold}`,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: COLORS.gold,
    marginBottom: 6,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: COLORS.anthracite,
    marginBottom: 2,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.deepBlack,
    color: COLORS.offWhite,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 2,
    fontSize: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
  },
  colNum: { width: "8%" },
  colNoms: { width: "42%" },
  colNombres: { width: "18%" },
  colTable: { width: "32%" },
  footer: {
    marginTop: 16,
    borderTop: `1 solid ${COLORS.gold}`,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.anthracite,
  },
  pageNumber: {
    position: "absolute",
    bottom: "15mm",
    right: "20mm",
    fontSize: 7,
    color: COLORS.anthracite,
  },
  printDate: {
    fontSize: 7,
    color: COLORS.anthracite,
  },
});

// Calcule la taille des groupes à partir de la liste des invités
function computeGroupSizes(
  guests: MasterBookProps["guests"]
): Map<string | null, number> {
  const map = new Map<string | null, number>();
  for (const g of guests) {
    const key = g.group_id ?? `__singleton__${g.first_name}_${g.last_name}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

// En-tête du tableau
const TableHeader = () => (
  <View style={styles.tableHeader} fixed>
    <Text style={styles.colNum}>N°</Text>
    <Text style={styles.colNoms}>Noms</Text>
    <Text style={styles.colNombres}>Nombre</Text>
    <Text style={styles.colTable}>Table</Text>
  </View>
);

export function MasterBookDocument({
  eventName,
  eventDate,
  location,
  guests,
}: MasterBookProps) {
  const totalGuests = guests.length;
  const groupSizeMap = computeGroupSizes(guests);
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GUEST MANAGER</Text>
          <Text style={styles.headerSubtitle}>Événement : {eventName}</Text>
          <Text style={styles.headerSubtitle}>
            Date : {new Date(eventDate).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
          {location && <Text style={styles.headerSubtitle}>Lieu : {location}</Text>}
        </View>

        <View style={styles.table}>
          <TableHeader />
          {guests.map((guest, index) => {
            const groupSize = guest.group_id
              ? groupSizeMap.get(guest.group_id) ?? 1
              : 1;
            return (
              <View
                key={`${guest.last_name}-${guest.first_name}-${index}`}
                style={[
                  styles.tableRow,
                  { backgroundColor: index % 2 === 0 ? COLORS.white : COLORS.lightGray },
                ]}
              >
                <Text style={styles.colNum}>{index + 1}</Text>
                <Text style={styles.colNoms}>
                  {guest.first_name} {guest.last_name}
                </Text>
                <Text style={styles.colNombres}>{groupSize}</Text>
                <Text style={styles.colTable}>{guest.table_name ?? "—"}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text>Total : {totalGuests} invité{totalGuests > 1 ? "s" : ""}</Text>
          <Text style={styles.printDate}>Imprimé le {printDate}</Text>
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
