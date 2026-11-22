import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import companyLogo from '@/assets/company-logo.png';

export interface CompanyHeaderInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string | null;
}

export interface PreparedByInfo {
  name: string;
  role?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  width: string | number; // percentage like '15%' or fixed number
  align?: 'left' | 'center' | 'right';
}

export interface PdfReportProps {
  company: CompanyHeaderInfo;
  reportTitle: string;
  generatedAt: Date;
  columns: ReportColumn[];
  rows: (string | number)[][];
  preparedBy: PreparedByInfo;
  orientation?: 'portrait' | 'landscape';
  subtitle?: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 110,
    paddingBottom: 70,
    paddingHorizontal: 24,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111827',
  },
  header: {
    position: 'absolute',
    top: 18,
    left: 24,
    right: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#166534',
    paddingBottom: 8,
  },
  logo: { width: 50, height: 50, marginRight: 12 },
  companyBlock: { flex: 1 },
  companyName: { fontSize: 13, fontWeight: 'bold', color: '#166534' },
  companyMeta: { fontSize: 7.5, color: '#374151', marginTop: 1 },
  reportTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginTop: 12 },
  reportMeta: { fontSize: 8, color: '#6b7280', marginTop: 3 },

  table: { width: '100%', borderWidth: 0.5, borderColor: '#9ca3af' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#166534',
  },
  tableHeaderCell: {
    padding: 5,
    fontSize: 8,
    color: '#ffffff',
    fontWeight: 'bold',
    borderRightWidth: 0.5,
    borderRightColor: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
  },
  tableRowAlt: { backgroundColor: '#f9fafb' },
  tableCell: {
    padding: 4,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: '#e5e7eb',
  },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 24,
    right: 24,
    borderTopWidth: 0.5,
    borderTopColor: '#d1d5db',
    paddingTop: 6,
    textAlign: 'center',
    fontSize: 7.5,
    color: '#6b7280',
  },

  preparedBy: {
    marginTop: 30,
    width: 220,
  },
  preparedByLabel: { fontSize: 9, color: '#374151', marginBottom: 28 },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: '#111827', marginBottom: 4 },
  preparedByName: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  preparedByRole: { fontSize: 8, color: '#6b7280', marginTop: 1 },

  emptyState: { padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 9 },
});

function ReportHeader({ company, reportTitle }: { company: CompanyHeaderInfo; reportTitle: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerRow}>
        <Image src={company.logoUrl || companyLogo} style={styles.logo} />
        <View style={styles.companyBlock}>
          <Text style={styles.companyName}>{company.name.toUpperCase()}</Text>
          {company.address && <Text style={styles.companyMeta}>{company.address}</Text>}
          {(company.phone || company.email) && (
            <Text style={styles.companyMeta}>
              {[company.phone, company.email].filter(Boolean).join('  •  ')}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.reportTitle}>{reportTitle}</Text>
    </View>
  );
}

function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={{ width: '100%', textAlign: 'center' }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function PreparedBySection({ preparedBy, generatedAt }: { preparedBy: PreparedByInfo; generatedAt: Date }) {
  return (
    <View style={styles.preparedBy} wrap={false}>
      <Text style={styles.preparedByLabel}>Prepared by:</Text>
      <View style={styles.signatureLine} />
      <Text style={styles.preparedByName}>{preparedBy.name || '—'}</Text>
      {preparedBy.role && <Text style={styles.preparedByRole}>{preparedBy.role}</Text>}
      <Text style={styles.reportMeta}>Date: {format(generatedAt, 'MMM d, yyyy hh:mm a')}</Text>
    </View>
  );
}

export function PdfReportDocument({
  company,
  reportTitle,
  generatedAt,
  columns,
  rows,
  preparedBy,
  orientation = 'portrait',
  subtitle,
}: PdfReportProps) {
  return (
    <Document title={reportTitle} author={preparedBy.name}>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <ReportHeader company={company} reportTitle={reportTitle} />

        {subtitle && <Text style={{ fontSize: 9, marginBottom: 6, color: '#374151' }}>{subtitle}</Text>}

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            {columns.map((c) => (
              <Text
                key={c.key}
                style={[styles.tableHeaderCell, { width: c.width as any, textAlign: c.align || 'left' }]}
              >
                {c.label.replace(' Payroll Deduction', '\nPayroll Deduction')}
              </Text>
            ))}
          </View>

          {rows.length === 0 ? (
            <Text style={styles.emptyState}>No records found.</Text>
          ) : (
            rows.map((row, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                {columns.map((c, j) => (
                  <Text
                    key={c.key}
                    style={[styles.tableCell, { width: c.width as any, textAlign: c.align || 'left' }]}
                  >
                    {row[j] !== null && row[j] !== undefined ? String(row[j]) : ''}
                  </Text>
                ))}
              </View>
            ))
          )}
        </View>

        <PreparedBySection preparedBy={preparedBy} generatedAt={generatedAt} />

        <ReportFooter />
      </Page>
    </Document>
  );
}
