// Template PDF : Liste stylisée des tables — version élégante pour impression qualité
// Affichage : • Prénom Nom (nombre) — chaque invité sur une ligne, plus de badges ni de regroupement couples
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

interface StylizedTableListProps {
  eventName: string;
  eventDate: string;
  location: string | null;
  tables: TableWithGuestsExport[];
  organizerContact?: string;
}

const COLORS = {
  gold: "#C9A96E",
  deepBlack: "#1A1A1A",
  anthracite: "#2D2D2D",
  offWhite: "#F8F6F0",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: "20mm",
    color: COLORS.deepBlack,
    backgroundColor: COLORS.offWhite,
  },
  topOrnament: {
    borderTop: `1.5 solid ${COLORS.gold}`,
    marginBottom: 4,
    width: "100%",
  },
  topOrnamentInner: {
    borderTop: `0.5 solid ${COLORS.gold}`,
    marginBottom: 16,
    width: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerLogo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 3,
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: COLORS.gold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 10,
    color: COLORS.anthracite,
    textAlign: "center",
    marginBottom: 2,
  },
  headerWelcome: {
    fontSize: 8,
    color: COLORS.anthracite,
    textAlign: "center",
    marginTop: 10,
    fontStyle: "italic",
    maxWidth: 300,
  },
  tableCard: {
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: 4,
    padding: 14,
    backgroundColor: COLORS.white,
  },
  tableHeader: {
    borderBottom: `0.5 solid ${COLORS.gold}`,
    paddingBottom: 8,
    marginBottom: 10,
  },
  tableNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tableName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  tableSubtitle: {
    fontSize: 8,
    color: COLORS.anthracite,
    marginTop: 2,
  },
  guestLine: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 0.3,
    borderBottomColor: "#E5E5E5",
  },
  guestBullet: {
    fontSize: 10,
    color: COLORS.gold,
    marginRight: 8,
    marginTop: 1,
  },
  guestText: {
    fontSize: 11,
    color: COLORS.deepBlack,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  guestGroupSize: {
    fontSize: 9,
    color: COLORS.anthracite,
    marginLeft: 4,
  },
  lockedIndicator: {
    fontSize: 10,
    color: COLORS.anthracite,
    marginLeft: 6,
  },
  emptyTable: {
    textAlign: "center",
    color: COLORS.anthracite,
    fontSize: 9,
    fontStyle: "italic",
    paddingVertical: 16,
  },
  bottomOrnament: {
    borderBottom: `0.5 solid ${COLORS.gold}`,
    marginTop: 20,
    marginBottom: 4,
    width: "100%",
  },
  bottomOrnamentInner: {
    borderBottom: `1.5 solid ${COLORS.gold}`,
    marginBottom: 8,
    width: "100%",
  },
  footer: {
    alignItems: "center",
    marginBottom: 12,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  thanksPage: {
    fontFamily: "Helvetica",
    fontSize: 11,
    padding: "30mm",
    color: COLORS.deepBlack,
    backgroundColor: COLORS.offWhite,
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  thanksTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: COLORS.gold,
    marginBottom: 12,
    letterSpacing: 1,
  },
  thanksText: {
    fontSize: 10,
    color: COLORS.anthracite,
    marginBottom: 4,
    fontStyle: "italic",
  },
  pageNumber: {
    position: "absolute",
    bottom: "15mm",
    right: "20mm",
    fontSize: 7,
    color: COLORS.anthracite,
  },
});

// Ligne d'invité stylisée : • Prénom Nom (nombre)
function GuestLine({
  guest,
  groupSize,
}: {
  guest: TableListGuest;
  groupSize: number;
}) {
  return (
    <View style={styles.guestLine}>
      <Text style={styles.guestBullet}>•</Text>
      <Text style={styles.guestText}>
        {guest.first_name} {guest.last_name}
      </Text>
      <Text style={styles.guestGroupSize}>({groupSize})</Text>
    </View>
  );
}

// Section d'une table avec cadre doré
function TableCard({
  table,
  groupSizeMap,
}: {
  table: TableWithGuestsExport;
  groupSizeMap: Map<string | null, number>;
}) {
  return (
    <View style={styles.tableCard} wrap={false}>
      <View style={styles.tableHeader}>
        <View style={styles.tableNameRow}>
          <Text style={styles.tableName}>
            ✦ Table {table.name}
            {table.is_locked ? (
              <Text style={styles.lockedIndicator}> 🔒</Text>
            ) : null}
          </Text>
        </View>
        <Text style={styles.tableSubtitle}>
          {table.guests.length}/{table.capacity} places
          {table.zone_name !== "—" ? ` — ${table.zone_name}` : ""}
        </Text>
      </View>

      {table.guests.length === 0 ? (
        <Text style={styles.emptyTable}>
          Aucun invité attribué pour cette table
        </Text>
      ) : (
        table.guests.map((guest, gIndex) => (
          <GuestLine
            key={`${guest.last_name}-${guest.first_name}-${gIndex}`}
            guest={guest}
            groupSize={getGroupSize(guest, groupSizeMap)}
          />
        ))
      )}
    </View>
  );
}

// Document complet de la liste stylisée des tables
export function StylizedTableListDocument({
  eventName,
  eventDate,
  location,
  tables,
  organizerContact,
}: StylizedTableListProps) {
  const tablesWithGuests = tables.filter((t) => t.guests.length > 0);
  const tablesEmpty = tables.filter((t) => t.guests.length === 0);

  // Calcule la taille des groupes à partir de tous les invités
  const allGuests = tables.flatMap((t) => t.guests);
  const groupSizeMap = getGroupSizeMap(allGuests);

  const formattedDate = new Date(eventDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = new Date(eventDate).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topOrnament} />
        <View style={styles.topOrnamentInner} />

        <View style={styles.header}>
          <Text style={styles.headerLogo}>✦ GUEST MANAGER ✦</Text>
          <Text style={styles.headerTitle}>Plan de table</Text>
          <Text style={styles.headerSubtitle}>{eventName}</Text>
          <Text style={styles.headerSubtitle}>
            {formattedDate} à {formattedTime}
            {location ? ` — ${location}` : ""}
          </Text>
          <Text style={styles.headerWelcome}>
            Bienvenue à tous. Voici le placement prévu pour cette soirée.
            Nous vous souhaitons une excellente réception.
          </Text>
        </View>

        {tablesWithGuests.map((table) => (
          <TableCard key={table.id} table={table} groupSizeMap={groupSizeMap} />
        ))}

        {tablesEmpty.length > 0 && (
          <View style={styles.tableCard}>
            <Text
              style={{
                fontFamily: "Helvetica-Bold",
                fontSize: 14,
                color: COLORS.gold,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Tables libres
            </Text>
            {tablesEmpty.map((table) => (
              <Text
                key={table.id}
                style={{
                  textAlign: "center",
                  fontSize: 9,
                  color: COLORS.anthracite,
                  marginBottom: 3,
                }}
              >
                Table {table.name} — {table.capacity} places
                {table.zone_name !== "—" ? ` (${table.zone_name})` : ""}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.bottomOrnament} />
        <View style={styles.bottomOrnamentInner} />
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Guest Manager — L&apos;art de recevoir, simplifié.
          </Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>

      <Page size="A4" style={styles.thanksPage}>
        <Text style={styles.thanksTitle}>Merci</Text>
        <Text style={styles.thanksText}>
          Merci à tous nos invités pour leur présence.
        </Text>
        <Text style={styles.thanksText}>
          Passez une excellente soirée&nbsp;!
        </Text>
        {organizerContact && (
          <Text
            style={{
              marginTop: 24,
              fontSize: 8,
              color: COLORS.anthracite,
            }}
          >
            Contact : {organizerContact}
          </Text>
        )}
        <View style={{ marginTop: 32 }}>
          <View style={{ borderTop: `0.5 solid ${COLORS.gold}`, width: 120, marginBottom: 4 }} />
          <Text style={{ fontSize: 7, color: COLORS.gold, letterSpacing: 1 }}>
            GUEST MANAGER
          </Text>
        </View>
      </Page>
    </Document>
  );
}
