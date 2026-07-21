// Générateur DOCX : Liste simple des tables — version fonctionnelle modifiable
// Colonnes : N°, Noms (Prénom Nom), Nombres (taille du groupe), Table
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  HeadingLevel,
  PageNumber,
  Footer,
  convertInchesToTwip,
} from "docx";
import type { DocxTableWithGuests, DocxGuest } from "./utils";
import { getGroupSize, getGroupSizeMap, COLORS } from "./utils";

export async function generateSimpleTableListDocx(
  eventName: string,
  eventDate: string,
  location: string | null,
  tables: DocxTableWithGuests[],
  totalGuests: number
): Promise<Buffer> {
  const tablesWithGuests = tables.filter((t) => t.guests.length > 0);
  const tablesEmpty = tables.filter((t) => t.guests.length === 0);
  const avgPerTable =
    tablesWithGuests.length > 0
      ? Math.round(totalGuests / tablesWithGuests.length)
      : 0;

  // Calcule la taille des groupes à partir de tous les invités
  const allGuests = tables.flatMap((t) => t.guests);
  const groupSizeMap = getGroupSizeMap(allGuests);

  const formattedDate = new Date(eventDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const printDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 20,
            color: COLORS.deepBlack,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Imprimé le ${printDate} — Page `,
                    size: 16,
                    color: COLORS.anthracite,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: COLORS.anthracite,
                  }),
                  new TextRun({
                    text: " / ",
                    size: 16,
                    color: COLORS.anthracite,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: COLORS.anthracite,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            text: `Liste des tables – ${eventName}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `${formattedDate}${location ? ` — ${location}` : ""}`,
                size: 22,
                color: COLORS.anthracite,
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `Total : ${totalGuests} invité${totalGuests > 1 ? "s" : ""} — ${tables.length} table${tables.length > 1 ? "s" : ""} — Moyenne : ${avgPerTable} invité${avgPerTable > 1 ? "s" : ""} par table`,
                size: 20,
                color: COLORS.anthracite,
              }),
            ],
          }),
          ...tablesWithGuests.flatMap((table) =>
            buildTableSection(table, groupSizeMap)
          ),
          ...(tablesEmpty.length > 0
            ? [
                new Paragraph({
                  text: "Tables vides",
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 300, after: 120 },
                }),
                ...tablesEmpty.map(
                  (table) =>
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: `Table ${table.name}`,
                          bold: true,
                          size: 20,
                        }),
                        new TextRun({
                          text: ` — Capacité : ${table.capacity} places${
                            table.zone_name !== "—"
                              ? ` (${table.zone_name})`
                              : ""
                          }`,
                          size: 20,
                          color: COLORS.anthracite,
                        }),
                      ],
                    })
                ),
              ]
            : []),
          new Paragraph({ spacing: { before: 300 }, children: [] }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc)) as unknown as Buffer;
}

// Construit le titre et le tableau d'une table
function buildTableSection(
  table: DocxTableWithGuests,
  groupSizeMap: Map<string | null, number>
): (Paragraph | Table)[] {
  const isFull = table.guests.length >= table.capacity;
  const available = table.capacity - table.guests.length;

  const rows: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 240, after: 40 },
      children: [
        new TextRun({
          text: `Table ${table.name}`,
          bold: true,
          size: 24,
          color: COLORS.deepBlack,
        }),
        new TextRun({
          text: ` — ${table.guests.length}/${table.capacity} places`,
          size: 20,
          color: COLORS.anthracite,
        }),
      ],
    }),
  ];

  if (table.zone_name !== "—") {
    rows.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `Zone : ${table.zone_name}`,
            size: 18,
            italics: true,
            color: COLORS.anthracite,
          }),
        ],
      })
    );
  }

  rows.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text:
            table.guests.length === 0
              ? "Table vide"
              : isFull
              ? "Complète"
              : `Places disponibles : ${available}`,
          size: 18,
          italics: true,
          color: COLORS.anthracite,
        }),
      ],
    })
  );

  if (table.guests.length === 0) {
    rows.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 120 },
        children: [
          new TextRun({
            text: "Aucun invité attribué",
            size: 20,
            italics: true,
            color: COLORS.anthracite,
          }),
        ],
      })
    );
  } else {
    rows.push(buildGuestTable(table.guests, groupSizeMap, table.name));
  }

  return rows;
}

// Construit le tableau des invités avec les 4 colonnes
function buildGuestTable(
  guests: DocxGuest[],
  groupSizeMap: Map<string | null, number>,
  tableName: string
): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell("N°", 800),
      createHeaderCell("Noms", 3000),
      createHeaderCell("Nombres", 1800),
      createHeaderCell("Table", 2400),
    ],
  });

  const dataRows = guests.map((guest, index) => {
    const groupSize = getGroupSize(guest, groupSizeMap);
    return new TableRow({
      children: [
        createCell(String(index + 1), 800, index),
        createCell(`${guest.first_name} ${guest.last_name}`, 3000, index),
        createCell(String(groupSize), 1800, index),
        createCell(tableName, 2400, index),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function createHeaderCell(text: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: {
      type: ShadingType.CLEAR,
      fill: "1A1A1A",
      color: "1A1A1A",
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text,
            bold: true,
            size: 16,
            color: "FFFFFF",
          }),
        ],
      }),
    ],
  });
}

function createCell(
  text: string,
  width: number,
  rowIndex: number
): TableCell {
  const isEven = rowIndex % 2 === 0;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: isEven
      ? undefined
      : {
          type: ShadingType.CLEAR,
          fill: COLORS.lightGray,
          color: COLORS.lightGray,
        },
    children: [
      new Paragraph({
        spacing: { before: 30, after: 30 },
        children: [
          new TextRun({
            text,
            size: 18,
            color: COLORS.deepBlack,
          }),
        ],
      }),
    ],
  });
}
