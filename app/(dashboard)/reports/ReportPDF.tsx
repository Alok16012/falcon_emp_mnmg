import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
    page: { fontFamily: "Helvetica", padding: 36, fontSize: 10, backgroundColor: "#ffffff" },
    header: { marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1.5, borderBottomColor: "#1a1a18" },
    headerTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1a1a18", marginBottom: 3 },
    headerSub: { fontSize: 8.5, color: "#6b6860" },
    sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1a1a18", marginBottom: 6, marginTop: 18, textTransform: "uppercase", letterSpacing: 0.5 },
    statsGrid: { flexDirection: "row", gap: 6, marginBottom: 6 },
    statCard: { flex: 1, backgroundColor: "#f9f8f5", borderRadius: 5, padding: "9 11", borderWidth: 1, borderColor: "#e8e6e1" },
    statLabel: { fontSize: 7.5, color: "#9e9b95", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
    statValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#1a1a18" },
    tableHeaderRow: { flexDirection: "row", backgroundColor: "#f9f8f5", paddingVertical: 5, paddingHorizontal: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomWidth: 1, borderBottomColor: "#e8e6e1" },
    tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: "#f0f0f0" },
    tableRowAlt: { backgroundColor: "#f9f8f5" },
    th: { flex: 1, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#9e9b95", textTransform: "uppercase" },
    td: { flex: 1, fontSize: 9, color: "#1a1a18" },
    tdGreen: { flex: 1, fontSize: 9, color: "#1a9e6e", fontFamily: "Helvetica-Bold" },
    tdOrange: { flex: 1, fontSize: 9, color: "#d97706", fontFamily: "Helvetica-Bold" },
    tdRed: { flex: 1, fontSize: 9, color: "#dc2626", fontFamily: "Helvetica-Bold" },
    defectRow: { flexDirection: "row", alignItems: "center", marginBottom: 7, paddingHorizontal: 4 },
    rankBadge: { width: 18, height: 18, backgroundColor: "#fef2f2", borderRadius: 9, alignItems: "center", justifyContent: "center", marginRight: 8 },
    rankText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#dc2626" },
    defectName: { flex: 1, fontSize: 9.5, color: "#1a1a18", fontFamily: "Helvetica-Bold" },
    defectCount: { fontSize: 9.5, color: "#dc2626", fontFamily: "Helvetica-Bold", marginRight: 5 },
    defectPct: { fontSize: 8.5, color: "#9e9b95" },
    progressTrack: { flex: 1.2, height: 4, backgroundColor: "#f0f0f0", borderRadius: 2, marginLeft: 10, marginRight: 8 },
    progressFill: { height: 4, backgroundColor: "#dc2626", borderRadius: 2 },
    pageNum: { position: "absolute", bottom: 22, right: 36, fontSize: 8, color: "#9e9b95" },
    footer: { position: "absolute", bottom: 22, left: 36, fontSize: 8, color: "#9e9b95" },
})

export function ReportDocument({ data, companyName, period, project, inspector }: {
    data: any, companyName: string, period: string, project: string, inspector: string
}) {
    const s = data?.summary
    const topDefects: any[] = (data?.topDefects || []).slice(0, 5)
    const dayWise: any[] = data?.dayWise || []
    const partWise: any[] = data?.partWise || []
    const inspectorWise: any[] = data?.inspectorWise || []

    return (
        <Document>
            {/* PAGE 1: Summary + Top 5 Defects */}
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{companyName} — Quality Inspection Report</Text>
                    <Text style={styles.headerSub}>Period: {period}   |   Project: {project}   |   Inspector: {inspector}</Text>
                </View>

                <Text style={styles.sectionTitle}>Summary Statistics</Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Inspected</Text>
                        <Text style={styles.statValue}>{(s?.totalInspected || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Accepted</Text>
                        <Text style={[styles.statValue, { color: "#1a9e6e" }]}>{(s?.totalAccepted || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Rework</Text>
                        <Text style={[styles.statValue, { color: "#d97706" }]}>{(s?.totalRework || 0).toLocaleString()}</Text>
                    </View>
                </View>
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Rejected</Text>
                        <Text style={[styles.statValue, { color: "#dc2626" }]}>{(s?.totalRejected || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Rework PPM</Text>
                        <Text style={[styles.statValue, { color: "#d97706" }]}>{(s?.reworkPPM || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Rejection PPM</Text>
                        <Text style={[styles.statValue, { color: "#dc2626" }]}>{(s?.rejectionPPM || 0).toLocaleString()}</Text>
                    </View>
                </View>
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { flex: 1 }]}>
                        <Text style={styles.statLabel}>Acceptance Rate</Text>
                        <Text style={[styles.statValue, { color: "#1a9e6e" }]}>{(s?.acceptanceRate || 0).toFixed(2)}%</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 1 }]}>
                        <Text style={styles.statLabel}>Rework Rate</Text>
                        <Text style={[styles.statValue, { color: "#d97706" }]}>{(s?.reworkRate || 0).toFixed(2)}%</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 1 }]}>
                        <Text style={styles.statLabel}>Overall PPM</Text>
                        <Text style={[styles.statValue, { color: "#dc2626" }]}>{(s?.overallPPM || 0).toLocaleString()}</Text>
                    </View>
                </View>

                {topDefects.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Top 5 Defects</Text>
                        {topDefects.map((d: any, i: number) => (
                            <View key={i} style={styles.defectRow}>
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{i + 1}</Text>
                                </View>
                                <Text style={styles.defectName}>{d.defectName}</Text>
                                <View style={[styles.progressTrack]}>
                                    <View style={[styles.progressFill, { width: `${Math.min(d.percentage, 100)}%` }]} />
                                </View>
                                <Text style={styles.defectCount}>{d.count}</Text>
                                <Text style={styles.defectPct}>({d.percentage.toFixed(1)}%)</Text>
                            </View>
                        ))}
                    </>
                )}

                <Text style={styles.footer}>Generated: {new Date().toLocaleDateString("en-IN")}  |  CIMS Quality Report</Text>
                <Text style={styles.pageNum}>Page 1</Text>
            </Page>

            {/* PAGE 2: Day-wise + Inspector-wise */}
            {(dayWise.length > 0 || inspectorWise.length > 0) && (
                <Page size="A4" style={styles.page}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{companyName} — Day-wise & Inspector-wise</Text>
                        <Text style={styles.headerSub}>Period: {period}   |   Project: {project}</Text>
                    </View>

                    {dayWise.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>Day-wise Inspection Log</Text>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.th, { flex: 1.8 }]}>Date</Text>
                                <Text style={styles.th}>Inspected</Text>
                                <Text style={styles.th}>Accepted</Text>
                                <Text style={styles.th}>Rework</Text>
                                <Text style={styles.th}>Rejected</Text>
                                <Text style={styles.th}>Quality %</Text>
                            </View>
                            {dayWise.map((d: any, i: number) => (
                                <View key={i} style={[styles.tableRow, i % 2 !== 0 ? styles.tableRowAlt : {}]}>
                                    <Text style={[styles.td, { flex: 1.8 }]}>{d.date}</Text>
                                    <Text style={styles.td}>{d.totalInspected.toLocaleString()}</Text>
                                    <Text style={styles.tdGreen}>{d.totalAccepted.toLocaleString()}</Text>
                                    <Text style={styles.tdOrange}>{d.totalRework.toLocaleString()}</Text>
                                    <Text style={styles.tdRed}>{d.totalRejected.toLocaleString()}</Text>
                                    <Text style={styles.td}>{d.qualityRate.toFixed(1)}%</Text>
                                </View>
                            ))}
                        </>
                    )}

                    {inspectorWise.length > 0 && (
                        <>
                            <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Inspector-wise Summary</Text>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.th, { flex: 2 }]}>Inspector</Text>
                                <Text style={styles.th}>Inspected</Text>
                                <Text style={styles.th}>Accepted</Text>
                                <Text style={styles.th}>Rework</Text>
                                <Text style={styles.th}>Rejected</Text>
                                <Text style={styles.th}>Quality %</Text>
                            </View>
                            {inspectorWise.map((d: any, i: number) => (
                                <View key={i} style={[styles.tableRow, i % 2 !== 0 ? styles.tableRowAlt : {}]}>
                                    <Text style={[styles.td, { flex: 2 }]}>{d.inspectorName}</Text>
                                    <Text style={styles.td}>{d.totalInspected.toLocaleString()}</Text>
                                    <Text style={styles.tdGreen}>{d.totalAccepted.toLocaleString()}</Text>
                                    <Text style={styles.tdOrange}>{d.totalRework.toLocaleString()}</Text>
                                    <Text style={styles.tdRed}>{d.totalRejected.toLocaleString()}</Text>
                                    <Text style={styles.td}>{d.qualityRate.toFixed(1)}%</Text>
                                </View>
                            ))}
                        </>
                    )}

                    <Text style={styles.footer}>Generated: {new Date().toLocaleDateString("en-IN")}  |  CIMS Quality Report</Text>
                    <Text style={styles.pageNum}>Page 2</Text>
                </Page>
            )}

            {/* PAGE 3: Part-wise */}
            {partWise.length > 0 && (
                <Page size="A4" style={styles.page}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{companyName} — Part-wise Analysis</Text>
                        <Text style={styles.headerSub}>Period: {period}   |   Project: {project}</Text>
                    </View>

                    <Text style={styles.sectionTitle}>Part-wise Performance</Text>
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.th, { flex: 2.5 }]}>Part / Component</Text>
                        <Text style={styles.th}>Inspected</Text>
                        <Text style={styles.th}>Accepted</Text>
                        <Text style={styles.th}>Rework</Text>
                        <Text style={styles.th}>Rejected</Text>
                        <Text style={styles.th}>Quality %</Text>
                        <Text style={styles.th}>Rej %</Text>
                    </View>
                    {partWise.map((p: any, i: number) => (
                        <View key={i} style={[styles.tableRow, i % 2 !== 0 ? styles.tableRowAlt : {}]}>
                            <Text style={[styles.td, { flex: 2.5 }]}>{p.partName}</Text>
                            <Text style={styles.td}>{p.totalInspected.toLocaleString()}</Text>
                            <Text style={styles.tdGreen}>{p.totalAccepted.toLocaleString()}</Text>
                            <Text style={styles.tdOrange}>{p.totalRework.toLocaleString()}</Text>
                            <Text style={styles.tdRed}>{p.totalRejected.toLocaleString()}</Text>
                            <Text style={styles.td}>{p.qualityRate.toFixed(1)}%</Text>
                            <Text style={styles.tdRed}>{p.rejectionPercent?.toFixed(1) || "0.0"}%</Text>
                        </View>
                    ))}

                    <Text style={styles.footer}>Generated: {new Date().toLocaleDateString("en-IN")}  |  CIMS Quality Report</Text>
                    <Text style={styles.pageNum}>Page 3</Text>
                </Page>
            )}
        </Document>
    )
}
