import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { DonationReceipt } from '@/types';

// 한글 폰트 등록 (NanumGothic)
Font.register({
  family: 'NanumGothic',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@aspect-ratio/nanum-gothic@1.0.0/fonts/NanumGothic-Regular.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@aspect-ratio/nanum-gothic@1.0.0/fonts/NanumGothic-Bold.ttf',
      fontWeight: 'bold',
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'NanumGothic',
    fontSize: 10,
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 5,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    padding: 5,
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 5,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
  },
  value: {
    width: '70%',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 5,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 4,
  },
  colDate: {
    width: '25%',
    textAlign: 'center',
  },
  colType: {
    width: '35%',
    textAlign: 'center',
  },
  colAmount: {
    width: '40%',
    textAlign: 'right',
    paddingRight: 10,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingVertical: 8,
    marginTop: 5,
  },
  totalLabel: {
    width: '60%',
    fontWeight: 'bold',
    textAlign: 'right',
    paddingRight: 10,
  },
  totalAmount: {
    width: '40%',
    fontWeight: 'bold',
    textAlign: 'right',
    paddingRight: 10,
    fontSize: 12,
  },
  footer: {
    marginTop: 30,
    textAlign: 'center',
  },
  footerText: {
    marginBottom: 5,
  },
  issueDate: {
    marginTop: 20,
    textAlign: 'right',
  },
  churchInfo: {
    marginTop: 30,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  donorList: {
    marginTop: 5,
  },
  donorRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  donorName: {
    width: '30%',
  },
  donorRelation: {
    width: '20%',
    textAlign: 'center',
  },
  donorRegNum: {
    width: '50%',
    textAlign: 'center',
  },
});

interface DonationReceiptPDFProps {
  receipt: DonationReceipt;
  churchName: string;
  churchAddress: string;
  churchLeader: string;
  issueNumber: string;
}

export function DonationReceiptPDF({
  receipt,
  churchName,
  churchAddress,
  churchLeader,
  issueNumber,
}: DonationReceiptPDFProps) {
  const issueDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 주민등록번호 마스킹
  const maskRegNum = (regNum: string) => {
    if (!regNum || regNum.length < 7) return regNum;
    return regNum.substring(0, 8) + '******';
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>기 부 금 영 수 증</Text>
          <Text style={styles.subtitle}>발급번호: {issueNumber}</Text>
        </View>

        {/* 기부자 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 기부자 정보</Text>
          <View style={styles.row}>
            <Text style={styles.label}>대표자명</Text>
            <Text style={styles.value}>{receipt.representative}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>주소</Text>
            <Text style={styles.value}>{receipt.address || '(미등록)'}</Text>
          </View>

          {/* 기부자 목록 */}
          {receipt.donors.length > 0 && (
            <View style={styles.donorList}>
              <View style={[styles.donorRow, { backgroundColor: '#f5f5f5' }]}>
                <Text style={[styles.donorName, { fontWeight: 'bold' }]}>성명</Text>
                <Text style={[styles.donorRelation, { fontWeight: 'bold' }]}>관계</Text>
                <Text style={[styles.donorRegNum, { fontWeight: 'bold' }]}>주민등록번호</Text>
              </View>
              {receipt.donors.map((donor, idx) => (
                <View key={idx} style={styles.donorRow}>
                  <Text style={styles.donorName}>{donor.donor_name}</Text>
                  <Text style={styles.donorRelation}>{donor.relationship || '-'}</Text>
                  <Text style={styles.donorRegNum}>
                    {maskRegNum(donor.registration_number) || '(미등록)'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 기부 내역 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 기부 내역 ({receipt.year}년)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colDate}>날짜</Text>
              <Text style={styles.colType}>구분</Text>
              <Text style={styles.colAmount}>금액</Text>
            </View>
            {receipt.donations.map((donation, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.colDate}>{formatDate(donation.date)}</Text>
                <Text style={styles.colType}>{donation.offering_type}</Text>
                <Text style={styles.colAmount}>{formatAmount(donation.amount)}</Text>
              </View>
            ))}
          </View>

          {/* 합계 */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>합계</Text>
            <Text style={styles.totalAmount}>{formatAmount(receipt.total_amount)}</Text>
          </View>
        </View>

        {/* 발급 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 기부금 단체 정보</Text>
          <View style={styles.row}>
            <Text style={styles.label}>단체명</Text>
            <Text style={styles.value}>{churchName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>소재지</Text>
            <Text style={styles.value}>{churchAddress}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>대표자</Text>
            <Text style={styles.value}>{churchLeader}</Text>
          </View>
        </View>

        {/* 발급일 */}
        <View style={styles.issueDate}>
          <Text>발급일: {issueDate}</Text>
        </View>

        {/* 안내문 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            위 금액을 기부금으로 수령하였음을 증명합니다.
          </Text>
          <Text style={{ marginTop: 30, fontSize: 12, fontWeight: 'bold' }}>
            {churchName}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
