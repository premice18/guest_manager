// Générateur DOCX : Liste stylisée des tables — version élégante modifiable dans Word
// Affichage : • Prénom Nom (nombre) — chaque invité sur sa propre ligne
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
  BorderStyle,
  ShadingType,
  HeadingLevel,
  PageNumber,
  Footer,
  convertInchesToTwip,
} from "docx";
import type { DocxTableWithGuests, DocxGuest } from "./utils";
import { getGroupSize, getGroupSizeMap, COLORS } from "./utils";

export async function generateStylizedTableListDocx(
  eventName: string,
  eventDate: string,
  location: string | null,
  tables: DocxTableWithGuests[]
): Promise<Buffer> {
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
              top: convertInchesToTwip(1),
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
                alignment: AlignmentType.CENTER,
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: COLORS.gold,
                    space: 8,
                  },
                },
                spacing: { before: 120 },
                children: [
                  new TextRun({
                    text: "Guest Manager — L'art de recevoir, simplifié.",
                    size: 14,
                    color: COLORS.gold,
                    italics: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    color: COLORS.anthracite,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            border: {
              top: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: COLORS.gold,
                space: 0,
              },
            },
            spacing: { after: 40 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "✦ GUEST MANAGER ✦",
                size: 18,
                color: COLORS.gold,
                bold: true,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "Plan de table",
                size: 36,
                bold: true,
                color: COLORS.gold,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: eventName,
                size: 24,
                color: COLORS.deepBlack,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `${formattedDate} à ${formattedTime}${location ? ` — ${location}` : ""}`,
                size: 20,
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
                text: "Bienvenue à tous. Voici le placement prévu pour cette soirée. Nous vous souhaitons une excellente réception.",
                size: 18,
                color: COLORS.anthracite,
                italics: true,
              }),
            ],
          }),
          ...tablesWithGuests.flatMap((table, index) => [
            ...(index > 0
              ? [
                  new Paragraph({
                    border: {
                      top: {
                        style: BorderStyle.SINGLE,
                        size: 4,
                        color: COLORS.gold,
                        space: 8,
                      },
                    },
                    spacing: { before: 200, after: 200 },
                  }),
                ]
              : []),
            ...buildTableCard(table, groupSizeMap),
          ]),
          ...(tablesEmpty.length > 0
            ? [
                new Paragraph({
                  border: {
                    top: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: COLORS.gold,
                      space: 8,
                    },
                  },
                  spacing: { before: 200, after: 200 },
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 120, after: 120 },
                  children: [
                    new TextRun({
                      text: "Tables libres",
                      size: 24,
                      bold: true,
                      color: COLORS.gold,
                      font: "Times New Roman",
                    }),
                  ],
                }),
                ...tablesEmpty.map(
                  (table) =>
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: `Table ${table.name}`,
                          size: 20,
                          bold: true,
                          color: COLORS.deepBlack,
                        }),
                        new TextRun({
                          text: ` — ${table.capacity} places${table.zone_name !== "—" ? ` (${table.zone_name})` : ""}`,
                          size: 18,
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
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1.5),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: [
          new Paragraph({ spacing: { before: 3000 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Merci",
                size: 36,
                bold: true,
                color: COLORS.gold,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "Merci à tous nos invités pour leur présence.",
                size: 22,
                color: COLORS.anthracite,
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Passez une excellente soirée !",
                size: 22,
                color: COLORS.anthracite,
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: {
              top: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: COLORS.gold,
                space: 16,
              },
            },
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: "GUEST MANAGER",
                size: 14,
                color: COLORS.gold,
                bold: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc)) as unknown as Buffer;
}

// Construit une carte table avec la liste stylisée des invités
function buildTableCard(
  table: DocxTableWithGuests,
  groupSizeMap: Map<string | null, number>
): (Paragraph | Table)[] {
  const rows: (Paragraph | Table)[] = [];

  rows.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      shading: {
        type: ShadingType.CLEAR,
        fill: COLORS.offWhite,
        color: COLORS.offWhite,
      },
      border: {
        top: { style: BorderStyle.SINGLE, size: 8, color: COLORS.gold, space: 4 },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.gold, space: 4 },
        left: { style: BorderStyle.SINGLE, size: 8, color: COLORS.gold, space: 8 },
        right: { style: BorderStyle.SINGLE, size: 8, color: COLORS.gold, space: 8 },
      },
      children: [
        new TextRun({
          text: `✦ Table ${table.name} ✦`,
          size: 28,
          bold: true,
          color: COLORS.gold,
          font: "Times New Roman",
        }),
        new TextRun({
          text: table.is_locked ? "  🔒" : "",
          size: 20,
        }),
      ],
    })
  );

  rows.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `${table.guests.length}/${table.capacity} places`,
          size: 18,
          color: COLORS.anthracite,
        }),
        new TextRun({
          text: table.zone_name !== "—" ? ` — ${table.zone_name}` : "",
          size: 18,
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
            text: "Aucun invité attribué pour cette table",
            size: 20,
            italics: true,
            color: COLORS.anthracite,
          }),
        ],
      })
    );
  } else {
    // Construit les paragraphes d'invités
    for (const guest of table.guests) {
      const groupSize = getGroupSize(guest, groupSizeMap);
      rows.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: "• ",
              size: 20,
              color: COLORS.gold,
              bold: true,
            }),
            new TextRun({
              text: `${guest.first_name} ${guest.last_name}`,
              size: 22,
              bold: true,
              color: COLORS.deepBlack,
            }),
            new TextRun({
              text: ` (${groupSize})`,
              size: 18,
              color: COLORS.anthracite,
              italics: true,
            }),
          ],
        })
      );
    }
  }

  return rows;
}
