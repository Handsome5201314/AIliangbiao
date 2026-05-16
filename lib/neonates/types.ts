export type BirthGestation = {
  weeks: number;
  days: number;
};

export type DoctorNeonateBilirubinContext = 'AMBIENT' | 'PHOTOTHERAPY';

export type DoctorNeonateGrowthRecordView = {
  id: string;
  recordDate: string;
  recordTime: string | null;
  length: number | null;
  weight: number | null;
  headCircumference: number | null;
  bilirubinUmol: number | null;
  bilirubinContext: DoctorNeonateBilirubinContext | null;
  currentGestation: BirthGestation;
};

export type DoctorNeonateArchiveSummary = {
  id: string;
  babyName: string;
  sex: 'boy' | 'girl';
  birthGestation: BirthGestation;
  birthDate: string;
  birthTime: string | null;
  recordCount: number;
  latestRecordDate: string | null;
  latestRecordTime: string | null;
  effectiveAccessRole: 'OWNER' | 'COLLABORATOR' | 'READONLY';
  accessSource: 'OWNER' | 'GRANT';
  ownerDoctorProfile: {
    id: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  } | null;
  latestMetrics: {
    length: number | null;
    weight: number | null;
    headCircumference: number | null;
    bilirubinUmol: number | null;
  } | null;
};

export type DoctorNeonateArchiveDetail = DoctorNeonateArchiveSummary & {
  records: DoctorNeonateGrowthRecordView[];
};
