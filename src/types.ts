export type BarangayName = 'Buang' | 'Nagsipit';

export type AlertStatus = 'SAFE' | 'MODERATE' | 'EMERGENCY';

export type SpecialCategory = 'Senior' | 'PWD' | 'Infant' | 'Pregnant' | 'Medical' | 'None';

export interface FamilyMember {
  id: string;
  name: string;
  age: number;
  relationship: string;
  specialCategory: SpecialCategory;
  notes?: string;
}

export interface Household {
  id: string;
  headOfFamily: string;
  email?: string;
  birthday: string;
  age: number;
  contactNumber: string;
  numberOfMembers: number;
  houseNumber?: string;
  purok: string;
  barangay: BarangayName;
  completeAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  status: AlertStatus;
  statusNote?: string;
  evacuationCenterId?: string;
  verificationStatus: 'Pending' | 'Verified';
  specialNeeds: SpecialCategory[];
  familyMembers: FamilyMember[];
  lastStatusUpdate: string;
  createdAt: string;
}

export interface EvacuationCenter {
  id: string;
  name: string;
  barangay: BarangayName;
  purok: string;
  capacityFamilies: number;
  assignedCount: number;
  location: {
    lat: number;
    lng: number;
  };
  managerName: string;
  managerContact: string;
  status: 'Open' | 'Full' | 'Standby';
  facilities: string[];
}

export interface ReliefDistribution {
  id: string;
  householdId: string;
  recipientName: string;
  barangay: BarangayName;
  purok: string;
  item: string;
  qty: string;
  location: string;
  timestamp: string;
  officerName: string;
  notes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  barangay: BarangayName;
  type: 'emergency' | 'moderate' | 'safe' | 'info' | 'relief' | 'evacuation';
  timestamp: string;
  read: boolean;
  householdId?: string;
  householdName?: string;
}

export interface OfficialAccount {
  username: string;
  passwordHash: string; // Plaintext for demo login validation
  barangay: BarangayName;
  officialName: string;
  position: string;
  phone: string;
  email?: string;
}

export interface HouseholdAccount {
  id: string;
  householdId: string;
  email: string;
  passwordHash: string;
  headOfFamily: string;
  barangay: BarangayName;
  contactNumber: string;
  createdAt: string;
}

export type LogActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'CENTER_ASSIGNED'
  | 'RELIEF_DISTRIBUTED'
  | 'VERIFICATION_TOGGLE'
  | 'HOTLINE_UPDATE'
  | 'PASSWORD_RESET'
  | 'SECURITY_ALERT';

export interface BarangayConfig {
  name: BarangayName;
  center: { lat: number; lng: number };
  puroks: string[];
  hotline: string;
  evacuationLead: string;
  alternateHotline?: string;
  emergencyRadioChannel?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actionType: LogActionType;
  actorName: string;
  actorRole: string;
  barangay: BarangayName;
  target: string;
  details: string;
  isWorkingHours: boolean;
  workShiftTag: string;
  terminal?: string;
  read?: boolean;
}

export type AppView = 
  | 'login'
  | 'official-login'
  | 'resident-login'
  | 'reset-password'
  | 'barangay-dashboard'
  | 'household-dashboard'
  | 'household-form';
