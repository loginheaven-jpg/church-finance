import { getDonorInfo, getIncomeRecords } from '@/lib/google-sheets';

export interface FamilyGroup {
  representative: string;
  members: Array<{ name: string; isRepresentative: boolean }>;
}

/**
 * 가족 그룹 결정
 * 1. 헌금자정보에서 representative 찾기 (대표자/구성원 양방향)
 * 2. 수입부 레코드에서 가족 관계 추출 (헌금자정보에 없는 경우)
 * 3. 완전히 없으면 본인만
 */
export async function getFamilyGroup(userName: string): Promise<FamilyGroup> {
  const donorInfos = await getDonorInfo();

  // 1. userName이 대표자
  const asRepresentative = donorInfos.filter(d => d.representative === userName);
  if (asRepresentative.length > 0) {
    const memberNames = new Set<string>();
    asRepresentative.forEach(d => memberNames.add(d.donor_name));
    memberNames.add(userName);
    return {
      representative: userName,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === userName,
      })),
    };
  }

  // 2. userName이 헌금자
  const asDoer = donorInfos.find(d => d.donor_name === userName);
  if (asDoer && asDoer.representative) {
    const rep = asDoer.representative;
    const sameFamilyDonors = donorInfos.filter(d => d.representative === rep);
    const memberNames = new Set<string>();
    sameFamilyDonors.forEach(d => memberNames.add(d.donor_name));
    memberNames.add(rep);
    return {
      representative: rep,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === rep,
      })),
    };
  }

  // 3. 수입부에서 가족 관계 추출
  const currentYear = new Date().getFullYear();
  const incomeRecords = await getIncomeRecords(`${currentYear}-01-01`, `${currentYear}-12-31`);

  const recordsWithUserAsRep = incomeRecords.filter(
    r => r.representative === userName && r.donor_name !== userName
  );
  if (recordsWithUserAsRep.length > 0) {
    const memberNames = new Set<string>();
    memberNames.add(userName);
    recordsWithUserAsRep.forEach(r => memberNames.add(r.donor_name));
    return {
      representative: userName,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === userName,
      })),
    };
  }

  const userOwnRecords = incomeRecords.filter(r => r.donor_name === userName);
  if (userOwnRecords.length > 0 && userOwnRecords[0].representative && userOwnRecords[0].representative !== userName) {
    const rep = userOwnRecords[0].representative;
    const sameFamilyRecords = incomeRecords.filter(r => r.representative === rep);
    const memberNames = new Set<string>();
    memberNames.add(rep);
    sameFamilyRecords.forEach(r => memberNames.add(r.donor_name));
    return {
      representative: rep,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === rep,
      })),
    };
  }

  // 4. 본인만
  return {
    representative: userName,
    members: [{ name: userName, isRepresentative: true }],
  };
}
