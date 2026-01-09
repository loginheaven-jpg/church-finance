import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  pdf,
} from '@react-pdf/renderer';
import type { DonationReceipt } from '@/types';

// 폰트 등록 싱글톤 (동시 호출 방지용 뮤텍스)
let fontRegistrationPromise: Promise<void> | null = null;
let fontsRegistered = false;

// 폰트 사전 로드 (브라우저 캐시에 로드)
async function prefetchFonts(baseUrl: string): Promise<void> {
  const regularUrl = `${baseUrl}/fonts/NotoSansKR-Regular.ttf`;
  const boldUrl = `${baseUrl}/fonts/NotoSansKR-Bold.ttf`;

  // HEAD 요청으로 폰트 파일 존재 확인 및 캐시 워밍
  const [regularRes, boldRes] = await Promise.all([
    fetch(regularUrl, { method: 'HEAD' }),
    fetch(boldUrl, { method: 'HEAD' }),
  ]);

  if (!regularRes.ok || !boldRes.ok) {
    throw new Error('Font files not found');
  }
}

// 한글 폰트 등록 함수 (뮤텍스 패턴으로 동시 호출 방지)
async function registerFonts(): Promise<void> {
  // 이미 등록 완료된 경우
  if (fontsRegistered) return;

  // 등록 진행 중인 경우 기존 Promise 반환
  if (fontRegistrationPromise) {
    return fontRegistrationPromise;
  }

  // 새로운 등록 시작
  fontRegistrationPromise = (async () => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

      // 폰트 파일 사전 확인
      await prefetchFonts(baseUrl);

      // 직접 URL 경로로 폰트 등록 (.ttf 확장자 포함)
      Font.register({
        family: 'NotoSansKR',
        fonts: [
          { src: `${baseUrl}/fonts/NotoSansKR-Regular.ttf`, fontWeight: 'normal' },
          { src: `${baseUrl}/fonts/NotoSansKR-Bold.ttf`, fontWeight: 'bold' },
        ],
      });

      fontsRegistered = true;
    } catch (error) {
      // 실패 시 Promise 초기화하여 재시도 가능하게
      fontRegistrationPromise = null;
      console.error('Font registration error:', error);
      throw error;
    }
  })();

  return fontRegistrationPromise;
}

// 스타일 정의
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'NotoSansKR',
    fontSize: 10,
    backgroundColor: '#ffffff',
  },
  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: '1px solid #e5e5e5',
  },
  headerLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  headerText: {
    fontSize: 11,
    color: '#2C3E50',
  },
  // 제목
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 6,
  },
  issueNumber: {
    fontSize: 10,
    color: '#666666',
  },
  // 섹션
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    padding: '6 10',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderBottomWidth: 0,
  },
  // 테이블
  table: {
    borderWidth: 1,
    borderColor: '#333333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableHeaderCell: {
    backgroundColor: '#f5f5f5',
    padding: '6 10',
    fontWeight: 'bold',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#333333',
  },
  tableCell: {
    padding: '6 10',
    borderRightWidth: 1,
    borderRightColor: '#333333',
  },
  tableCellLast: {
    padding: '6 10',
  },
  // 법적 문구
  legalBox: {
    marginBottom: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#cccccc',
    backgroundColor: '#fafafa',
  },
  legalText: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  legalNote: {
    fontSize: 9,
    color: '#666666',
  },
  // 서명란
  signatureSection: {
    textAlign: 'center',
    marginBottom: 14,
  },
  applicantRow: {
    fontSize: 13,
    marginBottom: 10,
  },
  applicantName: {
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
  certifyText: {
    fontSize: 11,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  // 수령인
  recipientRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipientText: {
    fontSize: 13,
  },
  sealContainer: {
    width: 60,
    height: 60,
    marginLeft: 10,
    position: 'relative',
  },
  sealImage: {
    width: 60,
    height: 60,
    opacity: 0.85,
  },
  sealPlaceholder: {
    fontSize: 10,
    color: '#aaaaaa',
    textAlign: 'center',
    marginTop: 20,
  },
});

// 금액 포맷
const formatAmount = (amount: number): string => {
  return amount.toLocaleString('ko-KR');
};

// 영수증 PDF 문서 컴포넌트
interface ReceiptDocumentProps {
  receipt: DonationReceipt;
  year: string;
  baseUrl?: string;
}

export const ReceiptDocument = ({ receipt, year, baseUrl = '' }: ReceiptDocumentProps) => {
  const today = new Date();
  const issueDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 헤더 - 예봄교회 재정부 */}
        <View style={styles.header}>
          <Text style={styles.headerText}>⛪ 예봄교회 재정부</Text>
        </View>

        {/* 제목 */}
        <View style={styles.title}>
          <Text style={styles.titleText}>기 부 금 영 수 증</Text>
          <Text style={styles.issueNumber}>발급번호: {receipt.issue_number || ''}</Text>
        </View>

        {/* 1. 기부자 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>1. 기부자</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>성 명</Text>
              </View>
              <View style={[styles.tableCell, { width: '38%' }]}>
                <Text>{receipt.representative}</Text>
              </View>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>주민등록번호</Text>
              </View>
              <View style={[styles.tableCellLast, { width: '38%' }]}>
                <Text>{receipt.resident_id ? `${receipt.resident_id}-*******` : '(미등록)'}</Text>
              </View>
            </View>
            <View style={styles.tableRowLast}>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>주 소</Text>
              </View>
              <View style={[styles.tableCellLast, { width: '88%' }]}>
                <Text>{receipt.address || '(미등록)'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. 기부금 단체 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>2. 기부금 단체</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>단 체 명</Text>
              </View>
              <View style={[styles.tableCell, { width: '38%' }]}>
                <Text>대한예수교장로회 예봄교회</Text>
              </View>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>고유번호</Text>
              </View>
              <View style={[styles.tableCellLast, { width: '38%' }]}>
                <Text>117-82-60597</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>소 재 지</Text>
              </View>
              <View style={[styles.tableCellLast, { width: '88%' }]}>
                <Text>경기도 성남시 분당구 운중로 285 (판교동)</Text>
              </View>
            </View>
            <View style={styles.tableRowLast}>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>대 표 자</Text>
              </View>
              <View style={[styles.tableCellLast, { width: '88%' }]}>
                <Text>최 병 희</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. 기부내용 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>3. 기부내용</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>유 형</Text>
              </View>
              <View style={[styles.tableHeaderCell, { width: '8%' }]}>
                <Text>코 드</Text>
              </View>
              <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                <Text>구 분</Text>
              </View>
              <View style={[styles.tableHeaderCell, { width: '38%' }]}>
                <Text>기부기간</Text>
              </View>
              <View style={[styles.tableHeaderCell, { width: '30%', borderRightWidth: 0 }]}>
                <Text>기부금액</Text>
              </View>
            </View>
            <View style={styles.tableRowLast}>
              <View style={[styles.tableCell, { width: '12%', textAlign: 'center' }]}>
                <Text>종교단체</Text>
              </View>
              <View style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>
                <Text>41</Text>
              </View>
              <View style={[styles.tableCell, { width: '12%', textAlign: 'center' }]}>
                <Text>헌금</Text>
              </View>
              <View style={[styles.tableCell, { width: '38%', textAlign: 'center' }]}>
                <Text>{year}년 1월 1일 ~ 12월 31일</Text>
              </View>
              <View style={[styles.tableCellLast, { width: '30%', textAlign: 'right' }]}>
                <Text style={{ fontWeight: 'bold' }}>{formatAmount(receipt.total_amount)} 원</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 법적 문구 */}
        <View style={styles.legalBox}>
          <Text style={styles.legalText}>
            「소득세법」 제34조, 「조세특례제한법」 제76조·제88조의4 및 「법인세법」 제24조에 따른 기부금을 위와 같이 기부받았음을 증명하여 드립니다.
          </Text>
          <Text style={styles.legalNote}>
            ※ 이 영수증은 소득세·법인세 신고 시 기부금 영수증으로 사용할 수 있습니다.
          </Text>
        </View>

        {/* 신청인 및 발급일 */}
        <View style={styles.signatureSection}>
          <Text style={styles.applicantRow}>
            신 청 인 : <Text style={styles.applicantName}>{receipt.representative}</Text>
          </Text>
          <Text style={styles.certifyText}>
            위와 같이 기부금을 기부받았음을 증명합니다.
          </Text>
          <Text style={styles.dateText}>{issueDate}</Text>
        </View>

        {/* 기부금 수령인 */}
        <View style={styles.recipientRow}>
          <Text style={styles.recipientText}>
            기부금 수령인 : 대한예수교장로회 예봄교회
          </Text>
          <View style={styles.sealContainer}>
            <Text style={styles.sealPlaceholder}>(직인)</Text>
            <Image style={styles.sealImage} src={`${baseUrl}/church-seal.png`} />
          </View>
        </View>
      </Page>
    </Document>
  );
};

// PDF Blob 생성 함수
export async function generateReceiptPdf(
  receipt: DonationReceipt,
  year: string
): Promise<Blob> {
  // 폰트 등록 (비동기)
  await registerFonts();

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const doc = <ReceiptDocument receipt={receipt} year={year} baseUrl={baseUrl} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}

// PDF 다운로드 함수
export async function downloadReceiptPdf(
  receipt: DonationReceipt,
  year: string
): Promise<boolean> {
  try {
    const blob = await generateReceiptPdf(receipt, year);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${receipt.representative}님${year}기부금영수증_예봄교회.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('PDF generation error:', error);
    return false;
  }
}
