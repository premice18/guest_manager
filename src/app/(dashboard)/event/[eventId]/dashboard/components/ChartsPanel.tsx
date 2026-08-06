"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Table, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Composant « charts » isolé du dashboard pour être chargé en dynamic import
// (next/dynamic), de façon à ne pas embarquer Recharts (lourd) dans le bundle
// initial de la page.

const graphVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 150,
      damping: 24,
      delay: 0.2 + i * 0.1,
    },
  }),
};

const CATEGORY_COLORS = [
  "#C9A96E", "#4CAF50", "#2196F3", "#FF9800",
  "#9C27B0", "#F44336", "#00BCD4", "#607D8B",
];

const AGE_BAR_COLORS = {
  inscrits: "#C9A96E",
  presents: "#4CAF50",
};

interface TooltipPayloadItem {
  value?: number | string | Array<number | string>;
  name?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
  dataKey?: string | number;
}

interface BaseTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}

function ArrivalsTooltip({ active, payload, label }: BaseTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-gold">{payload[0].value} arrivée(s)</p>
    </div>
  );
}

function CategoryTooltip({ active, payload }: BaseTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{data.name}</p>
      <p className="text-sm font-bold" style={{ color: data.color }}>
        {data.value} invité{data.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function AgeTooltip({ active, payload, label }: BaseTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

interface TableOccupancyItem {
  name: string;
  fill?: string;
  guests?: number;
  capacity?: number;
  percentage?: number;
}

function TableTooltip({ active, payload }: BaseTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as TableOccupancyItem | undefined;
  if (!data) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{data.name}</p>
      <p className="text-sm font-bold" style={{ color: data.fill }}>
        {data.guests}/{data.capacity} ({Math.round(data.percentage ?? 0)}%)
      </p>
    </div>
  );
}

export interface ChartsPanelProps {
  totalGuests: number;
  arrivalsByHour: { hour: string; count: number }[];
  categoryDistribution: { name: string; value: number }[];
  ageDistribution: { name: string; inscrits: number; presents: number }[];
  tableOccupancy: TableOccupancyItem[];
}

export default function ChartsPanel({
  totalGuests,
  arrivalsByHour,
  categoryDistribution,
  ageDistribution,
  tableOccupancy,
}: ChartsPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-2">
      {/* Graphique 1 : Évolution des arrivées */}
      <motion.div
        custom={0}
        variants={graphVariants}
        initial={prefersReducedMotion ? false : "hidden"}
        animate={prefersReducedMotion ? {} : "visible"}
      >
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="size-4 text-gold" />
              Évolution des arrivées
            </CardTitle>
          </CardHeader>
          <CardContent>
            {arrivalsByHour.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={arrivalsByHour} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="arrivalsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A96E" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C9A96E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="#999" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#999" />
                    <Tooltip content={<ArrivalsTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#C9A96E"
                      strokeWidth={2}
                      fill="url(#arrivalsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune arrivée enregistrée pour le moment
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Graphique 2 : Répartition par catégorie */}
      <motion.div
        custom={1}
        variants={graphVariants}
        initial={prefersReducedMotion ? false : "hidden"}
        animate={prefersReducedMotion ? {} : "visible"}
      >
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 text-gold" />
              Répartition par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryDistribution.length > 0 ? (
              <div className="flex h-64 items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryDistribution.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CategoryTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute flex flex-col items-center">
                  <span className="text-2xl font-bold text-deep-black">{totalGuests}</span>
                  <span className="text-xs text-muted-foreground">total</span>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune donnée de catégorie
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Graphique 3 : Tranches d'âge */}
      <motion.div
        custom={2}
        variants={graphVariants}
        initial={prefersReducedMotion ? false : "hidden"}
        animate={prefersReducedMotion ? {} : "visible"}
      >
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 text-gold" />
              Tranches d&rsquo;âge
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ageDistribution.some((a) => a.inscrits > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#999" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#999" />
                    <Tooltip content={<AgeTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      formatter={(value: string) => (
                        <span className="text-xs text-muted-foreground">{value}</span>
                      )}
                    />
                    <Bar
                      dataKey="inscrits"
                      name="Inscrits"
                      fill={AGE_BAR_COLORS.inscrits}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                    <Bar
                      dataKey="presents"
                      name="Présents"
                      fill={AGE_BAR_COLORS.presents}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune donnée d&rsquo;âge
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Graphique 4 : Occupation des tables */}
      <motion.div
        custom={3}
        variants={graphVariants}
        initial={prefersReducedMotion ? false : "hidden"}
        animate={prefersReducedMotion ? {} : "visible"}
      >
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Table className="size-4 text-gold" />
              Occupation des tables
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tableOccupancy.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={tableOccupancy}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#999" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#999" width={60} />
                    <Tooltip content={<TableTooltip />} />
                    <Bar dataKey="percentage" name="Occupation" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {tableOccupancy.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune table configurée
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}