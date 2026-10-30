import React, { useState, useEffect } from 'react';
import { AlertStatus, BarangayConfig, BarangayName, EvacuationCenter, FamilyMember, Household, HouseholdAccount, SpecialCategory } from '../types';
import { BARANGAY_CONFIG, INITIAL_CENTERS } from '../data/initialData';
import { InteractiveMap } from './InteractiveMap';
import {
  Users,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  Navigation,
  AlertCircle,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Building,
  Phone,
  Calendar,
  FileCheck2,
  Building2,
  Clock,
  Lock,
  Loader2,
  Timer,
  Mail,
  Eye,
  EyeOff,
  UserCheck,
  ArrowRight,
  Shield,
  UserPlus,
  RefreshCw,
  LogOut,
} from 'lucide-react';

interface HouseholdFormProps {
  initialHousehold?: Household | null;
  defaultBarangay?: BarangayName;
  barangayConfigs?: Record<BarangayName, BarangayConfig>;
  centers?: EvacuationCenter[];
  existingHouseholds?: Household[];
  onSave: (household: Household) => void;
  onCancel: () => void;
  onLogout?: () => void;
  onSwitchToOfficial?: () => void;
  onAccountCreated?: (household: Household, account: HouseholdAccount) => void;
  isOfficialLoggedIn?: boolean;
  isResidentLoggedIn?: boolean;
}

export const HouseholdForm: React.FC<HouseholdFormProps> = ({
  initialHousehold,
  defaultBarangay = 'Buang',
  barangayConfigs,
  centers = INITIAL_CENTERS,
  existingHouseholds = [],
  onSave,
  onCancel,
  onLogout,
  onSwitchToOfficial,
  onAccountCreated,
  isOfficialLoggedIn = false,
  isResidentLoggedIn = false,
}) => {
  const [isSyncSuccess, setIsSyncSuccess] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [headOfFamily, setHeadOfFamily] = useState(initialHousehold?.headOfFamily || '');
  const [birthday, setBirthday] = useState(initialHousehold?.birthday || '');
  const [age, setAge] = useState<number | ''>(
    initialHousehold?.age !== undefined && initialHousehold.age !== null ? initialHousehold.age : ''
  );
  const [contactNumber, setContactNumber] = useState(initialHousehold?.contactNumber || '');
  const [houseNumber, setHouseNumber] = useState(initialHousehold?.houseNumber || '');
  const [barangay, setBarangay] = useState<BarangayName>(initialHousehold?.barangay || defaultBarangay);
  const [purok, setPurok] = useState(initialHousehold?.purok || 'Purok 1');
  const [completeAddress, setCompleteAddress] = useState(initialHousehold?.completeAddress || '');
  const [status, setStatus] = useState<AlertStatus>(initialHousehold?.status || 'SAFE');
  const [statusNote, setStatusNote] = useState(initialHousehold?.statusNote || '');
  const [selectedEvacuationCenterId, setSelectedEvacuationCenterId] = useState<string>(
    initialHousehold?.evacuationCenterId || ''
  );

  // Active Hotline from Barangay Command Center
  const activeHotline =
    barangayConfigs?.[barangay]?.hotline || BARANGAY_CONFIG[barangay]?.hotline || '0917-555-0101';

  // Evacuation Centers for selected barangay
  const barangayCenters = centers.filter((c) => c.barangay === barangay);

  // Coordinates
  const initialCoords = initialHousehold?.location || BARANGAY_CONFIG[barangay].center;
  const [location, setLocation] = useState<{ lat: number; lng: number }>(initialCoords);

  // Family Members list
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(
    initialHousehold?.familyMembers || [
      {
        id: 'mem-1',
        name: initialHousehold?.headOfFamily || '',
        age: initialHousehold?.age || 0,
        relationship: 'Head of Family',
        specialCategory: 'None',
      },
    ]
  );

  const [geoLocating, setGeoLocating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<Household | null>(null);

  // Registration Form Step State (Appears after "Submit Household Response")
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [pendingHouseholdPayload, setPendingHouseholdPayload] = useState<Household | null>(null);
  const [regEmail, setRegEmail] = useState(initialHousehold?.email || '');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [accountCreatedSuccess, setAccountCreatedSuccess] = useState(false);
  const [showCenterSuccessPopup, setShowCenterSuccessPopup] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [createdHouseholdResult, setCreatedHouseholdResult] = useState<{
    household: Household;
    account: HouseholdAccount;
  } | null>(null);

  // Check password criteria for "long password not easy to guess" with asterisk guides
  const checkPasswordCriteria = (pwd: string, name: string) => {
    const isLong = pwd.length >= 10;
    const hasMinLen = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);

    // "Not easy to guess" validation:
    const cleanWords = name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3);
    const containsName = cleanWords.some((word) => pwd.toLowerCase().includes(word));
    const isObvious = /^(password|123456|12345678|123456789|admin123|qwerty|111111|000000|abcdef|letmein|welcome)/i.test(
      pwd.toLowerCase()
    );
    const notEasyToGuess = !containsName && !isObvious && pwd.length >= 8;

    let guessReason = '';
    if (containsName) {
      guessReason = 'Password contains your personal name, making it easy to guess.';
    } else if (isObvious) {
      guessReason = 'Password contains a common dictionary word or sequential numbers.';
    } else if (pwd.length > 0 && pwd.length < 8) {
      guessReason = 'Password is too short to be secure (minimum 8-10 characters required).';
    }

    let score = 0;
    if (hasMinLen) score++;
    if (isLong) score++;
    if (hasUpper && hasLower) score++;
    if (hasNumber && hasSymbol) score++;
    if (notEasyToGuess) score++;

    return {
      hasMinLen,
      isLong,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol,
      notEasyToGuess,
      guessReason,
      score: Math.min(score, 5),
      isValid: hasMinLen && hasUpper && hasLower && hasNumber && hasSymbol && notEasyToGuess,
    };
  };

  const passwordCriteria = checkPasswordCriteria(regPassword, headOfFamily);

  // Rapid submit and name existed state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameExisted, setNameExisted] = useState(false);

  // Clear legacy lockout entries if any
  useEffect(() => {
    try {
      localStorage.removeItem('brgy_form_lockout_until');
      localStorage.removeItem('brgy_form_lockout_level');
      localStorage.removeItem('brgy_form_duplicate_count');
    } catch {
      // ignore
    }
  }, []);

  // Reset form to blank state to enter next household response
  const resetForm = () => {
    setHeadOfFamily('');
    setBirthday('');
    setAge('');
    setContactNumber('');
    setHouseNumber('');
    setPurok(BARANGAY_CONFIG[barangay].puroks[0]);
    setCompleteAddress('');
    setFamilyMembers([
      {
        id: 'mem-' + Date.now(),
        name: '',
        age: 0,
        relationship: 'Head of Family',
        specialCategory: 'None',
      },
    ]);
    setLocation(BARANGAY_CONFIG[barangay].center);
    setStatus('SAFE');
    setStatusNote('');
    setSelectedEvacuationCenterId('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirmPassword('');
    setPendingHouseholdPayload(null);
    setCreatedHouseholdResult(null);
    setShowRegistrationModal(false);
    setShowCenterSuccessPopup(false);
    setIsSubmittingAccount(false);
    setAccountCreatedSuccess(false);
    setSubmittedData(null);
    setFormError(null);
    setRegError(null);
    setNameExisted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRedirectToAddHouseholdAgain = () => {
    setShowCenterSuccessPopup(false);
    resetForm();
    window.location.hash = '#/household/register';
  };

  // Countdown effect when Center Success Popup is active to automatically redirect
  useEffect(() => {
    if (!showCenterSuccessPopup) return;

    if (redirectCountdown <= 1) {
      const timer = setTimeout(() => {
        handleRedirectToAddHouseholdAgain();
      }, 1000);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [showCenterSuccessPopup, redirectCountdown]);

  // Auto calculate age if birthday changes
  const handleBirthdayChange = (bday: string) => {
    setBirthday(bday);
    if (bday) {
      const birthDate = new Date(bday);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (calculatedAge >= 0) {
        setAge(calculatedAge);
        setFamilyMembers((prev) =>
          prev.map((m, idx) => {
            if (idx === 0 && m.relationship === 'Head of Family') {
              const updatedCategory: SpecialCategory =
                calculatedAge >= 60 && (m.specialCategory === 'None' || m.specialCategory === 'Senior')
                  ? 'Senior'
                  : m.specialCategory;
              return { ...m, age: calculatedAge, specialCategory: updatedCategory };
            }
            return m;
          })
        );
      }
    } else {
      setAge('');
    }
  };

  const handleAgeChange = (val: string) => {
    if (val === '') {
      setAge('');
    } else {
      const num = Number(val);
      setAge(num);
      setFamilyMembers((prev) =>
        prev.map((m, idx) =>
          idx === 0 && m.relationship === 'Head of Family' ? { ...m, age: num } : m
        )
      );
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strictly strip non-digits and cap at 11 digits
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
    setContactNumber(digitsOnly);
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation, deletion, clipboard shortcuts
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Tab' ||
      e.key === 'Escape' ||
      e.key === 'Enter' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    // Block any non-numeric character
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleBarangayChange = (newBrgy: BarangayName) => {
    setBarangay(newBrgy);
    setPurok(BARANGAY_CONFIG[newBrgy].puroks[0]);
    setLocation(BARANGAY_CONFIG[newBrgy].center);
    // Reset or set default center for new barangay
    const newCenters = centers.filter((c) => c.barangay === newBrgy);
    if (newCenters.length > 0) {
      setSelectedEvacuationCenterId(newCenters[0].id);
    } else {
      setSelectedEvacuationCenterId('');
    }
  };

  const handleAddMember = () => {
    const newMember: FamilyMember = {
      id: 'mem-' + Date.now(),
      name: '',
      age: 18,
      relationship: 'Child',
      specialCategory: 'None',
    };
    setFamilyMembers([...familyMembers, newMember]);
  };

  const handleUpdateMember = (id: string, updates: Partial<FamilyMember>) => {
    setFamilyMembers(
      familyMembers.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const handleRemoveMember = (id: string) => {
    if (familyMembers.length <= 1) return;
    setFamilyMembers(familyMembers.filter((m) => m.id !== id));
  };

  // Detect GPS
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocating(false);
        setLocation({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      (err) => {
        setGeoLocating(false);
        console.warn('GPS detection warning:', err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const normalizeText = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

  const checkIsNameExisted = (nameToCheck?: string) => {
    const raw = nameToCheck !== undefined ? nameToCheck : headOfFamily;
    const target = normalizeText(raw);
    if (!target) return false;

    // Check against existing registered households in this barangay
    if (existingHouseholds && existingHouseholds.length > 0) {
      const isMatched = existingHouseholds.some((hh) => {
        // If editing existing household, don't consider itself
        if (initialHousehold && hh.id === initialHousehold.id) return false;
        if (hh.barangay !== barangay) return false;
        return normalizeText(hh.headOfFamily) === target;
      });
      if (isMatched) return true;
    }

    try {
      const lastSaved = localStorage.getItem('brgy_last_registered_name') || '';
      if (lastSaved && normalizeText(lastSaved) === target) {
        return true;
      }
    } catch {
      // ignore
    }

    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Prevent instantaneous double clicks during in-flight submission
    if (isSubmitting) {
      return;
    }

    if (!headOfFamily.trim()) {
      setFormError('Please provide the Full Name of the Family Leader.');
      return;
    }

    // Verify name existed before proceeding
    if (checkIsNameExisted()) {
      setNameExisted(true);
      setFormError('Name existed');
      return;
    }

    if (!contactNumber.trim()) {
      setFormError('Please enter an active contact phone number.');
      return;
    }
    if (contactNumber.length !== 11) {
      setFormError(`Phone number must be exactly 11 digits (e.g. 09123456789). You entered ${contactNumber.length} digit(s).`);
      return;
    }
    if (!contactNumber.startsWith('09')) {
      setFormError('Phone number must start with "09" (e.g. 09123456789).');
      return;
    }
    if (!birthday) {
      setFormError('Please provide the Birthday / Date of Birth of the Family Leader.');
      return;
    }
    if (!completeAddress.trim()) {
      setFormError('Please specify the complete address.');
      return;
    }

    // Verify name existed before proceeding
    if (checkIsNameExisted()) {
      setNameExisted(true);
      setFormError('Name existed');
      return;
    }

    // Valid unique submission!
    setIsSubmitting(true);
    setNameExisted(false);

    const specialNeedsSet = new Set<SpecialCategory>();
    familyMembers.forEach((m) => {
      if (m.specialCategory && m.specialCategory !== 'None') {
        specialNeedsSet.add(m.specialCategory);
      }
    });

    const leaderAge = Number(age || familyMembers[0]?.age || 35);
    const derivedBirthday = birthday || `${new Date().getFullYear() - leaderAge}-01-01`;

    const householdPayload: Household = {
      id: initialHousehold?.id || 'hh-' + Date.now(),
      headOfFamily: headOfFamily.trim(),
      email: regEmail.trim() || initialHousehold?.email || undefined,
      birthday: derivedBirthday,
      age: leaderAge,
      contactNumber: contactNumber.trim(),
      numberOfMembers: familyMembers.length,
      houseNumber: houseNumber.trim() || undefined,
      barangay,
      purok,
      completeAddress: completeAddress.trim(),
      location,
      status,
      statusNote: statusNote.trim() || undefined,
      evacuationCenterId: selectedEvacuationCenterId || undefined,
      verificationStatus: initialHousehold?.verificationStatus || 'Pending',
      specialNeeds: Array.from(specialNeedsSet),
      familyMembers: familyMembers.map((m, idx) => ({
        ...m,
        name: idx === 0 && !m.name ? headOfFamily : m.name || `Member ${idx + 1}`,
      })),
      lastStatusUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      createdAt: initialHousehold?.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    if (initialHousehold || isResidentLoggedIn) {
      setIsSubmitting(false);
      onSave(householdPayload);
      setIsSyncSuccess(true);
      setSyncMessage(
        `✅ Synced with Barangay ${barangay} Command Dashboard! Household record for "${householdPayload.headOfFamily}" and emergency status (${householdPayload.status}) are live in real-time.`
      );
      setTimeout(() => {
        setIsSyncSuccess(false);
      }, 6000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(false);
    setPendingHouseholdPayload(householdPayload);
    setIsSubmittingAccount(false);
    setAccountCreatedSuccess(false);
    setRegError(null);
    // Show Account Registration modal where email and password are provided
    setShowRegistrationModal(true);
  };

  const handleCompleteRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAccount || accountCreatedSuccess) return;
    setRegError(null);

    if (!pendingHouseholdPayload) {
      setRegError('Household data is missing. Please close and try again.');
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setRegError('Email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setRegError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    const criteria = checkPasswordCriteria(regPassword, pendingHouseholdPayload.headOfFamily);
    if (!criteria.isValid) {
      if (!criteria.hasMinLen) {
        setRegError('Password must be at least 8 to 10 characters long.');
        return;
      }
      if (!criteria.hasUpper || !criteria.hasLower) {
        setRegError('Password must contain both uppercase (A-Z) and lowercase (a-z) letters.');
        return;
      }
      if (!criteria.hasNumber) {
        setRegError('Password must include at least one number (0-9).');
        return;
      }
      if (!criteria.hasSymbol) {
        setRegError('Password must include at least one special symbol like !, @, #, $, %, &.');
        return;
      }
      if (!criteria.notEasyToGuess) {
        setRegError('Password is too easy to guess. Please avoid using personal names, simple sequences, or common words like "password".');
        return;
      }
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match. Please ensure both password fields are identical.');
      return;
    }

    // Trigger Successful Creating Account state on the button!
    setIsSubmittingAccount(true);
    setAccountCreatedSuccess(true);

    // Finalize household with registered email
    const finalHousehold: Household = {
      ...pendingHouseholdPayload,
      email: cleanEmail,
      lastStatusUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    const newAccount: HouseholdAccount = {
      id: 'acc-' + Date.now(),
      householdId: finalHousehold.id,
      email: cleanEmail,
      passwordHash: regPassword.trim(),
      headOfFamily: finalHousehold.headOfFamily,
      barangay: finalHousehold.barangay,
      contactNumber: finalHousehold.contactNumber,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    // Save registered name to prevent immediate duplicate
    try {
      localStorage.setItem('brgy_last_registered_name', finalHousehold.headOfFamily);
    } catch {
      // ignore
    }

    // Store created household & account result
    setCreatedHouseholdResult({ household: finalHousehold, account: newAccount });
    setPendingHouseholdPayload(finalHousehold);

    // Automatically save immediately to PostgreSQL database in real time
    if (onAccountCreated) {
      onAccountCreated(finalHousehold, newAccount);
    } else {
      onSave(finalHousehold);
    }

    // Immediately close registration modal and POP IN THE CENTER with the formal modal!
    setShowRegistrationModal(false);
    setIsSubmittingAccount(false);
    setAccountCreatedSuccess(true);
    setRedirectCountdown(3);
    setShowCenterSuccessPopup(true);
  };

  const handleUpdateSubmittedCenter = (centerId: string) => {
    if (!submittedData) return;
    const updated: Household = {
      ...submittedData,
      evacuationCenterId: centerId || undefined,
      lastStatusUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    onSave(updated);
    setSubmittedData(updated);
    setSelectedEvacuationCenterId(centerId);
  };

  const resetForNewSubmission = () => {
    setSubmittedData(null);
    setHeadOfFamily('');
    setBirthday('');
    setAge('');
    setContactNumber('');
    setHouseNumber('');
    setCompleteAddress('');
    setStatus('SAFE');
    setStatusNote('');
    setSelectedEvacuationCenterId('');
    setNameExisted(false);
    setFormError(null);
    setFamilyMembers([
      {
        id: 'mem-' + Date.now(),
        name: '',
        age: 30,
        relationship: 'Head of Family',
        specialCategory: 'None',
      },
    ]);
  };

  // If already submitted, show the dedicated Resident Confirmation Card
  if (submittedData) {
    const isEmergency = submittedData.status === 'EMERGENCY';
    const isModerate = submittedData.status === 'MODERATE';

    return (
      <div className="min-h-screen bg-slate-100 py-8 px-3 sm:px-6 font-sans text-slate-900 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Top Banner */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-emerald-600 flex items-center justify-center text-white">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight uppercase">
                  Household Report Submitted
                </h1>
                <p className="text-slate-400 text-xs font-medium">
                  Transmitted directly to Barangay {submittedData.barangay} Command Dashboard
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-xs font-bold uppercase">
              Received
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Alert Status Card */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                isEmergency
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : isModerate
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {isEmergency && <Flame className="w-6 h-6 text-red-600 shrink-0 mt-0.5 animate-bounce" />}
              {isModerate && <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />}
              {!isEmergency && !isModerate && <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />}

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider">
                    Official Emergency Alert Level:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-black uppercase ${
                      isEmergency
                        ? 'bg-red-600 text-white'
                        : isModerate
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isEmergency
                      ? '🔴 RED - MUST EVACUATE'
                      : isModerate
                      ? '🟡 YELLOW - MODERATE RISK'
                      : '🟢 GREEN - SAFE AT HOME'}
                  </span>
                </div>
                <p className="text-xs font-medium">
                  {isEmergency
                    ? 'Your emergency evacuation signal has been flagged on the Barangay Incident Map. Officials & rescue responders are alerted.'
                    : isModerate
                    ? 'Your household is marked for monitoring. Please prepare go-bags and stand by for barangay evacuation notices.'
                    : 'Your household is registered as safe and sheltered in place.'}
                </p>
              </div>
            </div>

            {/* Household Summary Card */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Head of Family
                  </span>
                  <strong className="text-sm text-slate-900">{submittedData.headOfFamily}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Reference ID
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {submittedData.id}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Barangay</span>
                  <span className="font-bold text-slate-800">Brgy. {submittedData.barangay}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Purok</span>
                  <span className="font-bold text-slate-800">{submittedData.purok}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Phone</span>
                  <span className="font-bold text-slate-800">{submittedData.contactNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Birthday / Age</span>
                  <span className="font-bold text-slate-800">
                    {submittedData.birthday ? `${submittedData.birthday} (${submittedData.age} yrs)` : `${submittedData.age} yrs`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Family Members</span>
                  <span className="font-bold text-slate-800">{submittedData.numberOfMembers} Person(s)</span>
                </div>
              </div>

              {submittedData.specialNeeds.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Vulnerable Members Tagged
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {submittedData.specialNeeds.map((need) => (
                      <span
                        key={need}
                        className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded text-[10px] font-bold"
                      >
                        {need}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-600" />
                  <span>
                    GPS Location: Lat {submittedData.location.lat}, Lng {submittedData.location.lng}
                  </span>
                </span>
                <span>{submittedData.lastStatusUpdate}</span>
              </div>
            </div>

            {/* Navigation Options */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={resetForNewSubmission}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Fill Up Another Household</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                HH
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-tight uppercase">
                  Household Information & Emergency Fill-Up Form
                </h1>
                <p className="text-slate-400 text-[11px] font-medium">
                  Public Resident Portal — Automatically syncs to Barangay {barangay} Command Dashboard
                </p>
              </div>
            </div>

            {/* Resident Auth Actions */}
            {isResidentLoggedIn && (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Logged In: {headOfFamily || 'Resident Citizen'}</span>
                </span>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-700"
                    title="Log Out of Resident Portal"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            )}

            {/* Official Mode Actions */}
            {isOfficialLoggedIn && (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs font-bold rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span>Official Mode: Registering Household</span>
                </span>
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-700"
                  title="Return to Barangay Command Dashboard"
                >
                  <ArrowRight className="w-3 h-3 rotate-180" />
                  <span>Dashboard</span>
                </button>
              </div>
            )}
          </div>

          {/* Real-time Sync Success Banner */}
          {syncMessage && (
            <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 text-xs shadow-md flex items-center gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-sm text-emerald-950">
                  Household Updated & Synced to Barangay Dashboard!
                </p>
                <p className="text-emerald-800 text-[11px] font-medium mt-0.5">
                  {syncMessage}
                </p>
              </div>
            </div>
          )}

          {formError && (
            <div className="mx-4 sm:mx-5 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-6">
            {/* Section 1: Family Leader Information */}
            <div className="space-y-3">
              <div className="bg-slate-100 text-slate-800 px-3.5 py-2 rounded-lg border border-slate-200 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                <Users className="w-4 h-4 text-blue-600" />
                <span>1. Family Leader Information</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Full Name */}
                <div className="md:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                      Head of Family Full Name
                    </label>
                    {nameExisted && (
                      <span className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        Name existed
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={headOfFamily}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[0-9]/g, '');
                      setHeadOfFamily(val);
                      if (nameExisted) setNameExisted(false);
                      if (formError === 'Name existed') setFormError(null);
                    }}
                    onBlur={() => {
                      if (headOfFamily.trim() && checkIsNameExisted(headOfFamily)) {
                        setNameExisted(true);
                        setFormError('Name existed');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (/[0-9]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Enter Head of Family Full Name"
                    className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 outline-none transition leading-normal ${
                      nameExisted
                        ? 'border-red-500 bg-red-50/50 text-red-950 focus:border-red-600 focus:ring-red-500/20'
                        : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  />
                  {nameExisted && (
                    <p className="mt-1 text-xs font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                      Name existed
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div className="md:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                      Phone Number <span className="text-slate-500 dark:text-slate-300 font-normal lowercase tracking-normal">(09xxxxxxxxx)</span>
                    </label>
                    <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-300">
                      {contactNumber.length}/11 digits
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      required
                      value={contactNumber}
                      onChange={handlePhoneChange}
                      onKeyDown={handlePhoneKeyDown}
                      placeholder="09123456789"
                      className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition tabular-nums tracking-wider leading-normal"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300 leading-tight font-medium">
                    Numbers only (0-9). Must be an 11-digit mobile number starting with 09.
                  </p>
                </div>

                {/* Age (Head of Family) */}
                <div className="md:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                      Age (Years Old)
                    </label>
                    {age !== '' && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {Number(age) >= 60 ? 'Senior Citizen (60+)' : `${age} yrs old`}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="125"
                    required
                    value={age}
                    onChange={(e) => handleAgeChange(e.target.value)}
                    placeholder="Auto-calculated from birthday"
                    className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal"
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300 leading-tight font-medium">
                    Automatically calculated when Birthday is selected, or input manually.
                  </p>
                </div>

                {/* Birthday */}
                <div className="md:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Birthday / Date of Birth</span>
                    </label>
                    {birthday && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {birthday}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={birthday}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleBirthdayChange(e.target.value)}
                      className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300 leading-tight font-medium">
                    Date of birth of the Family Head. Saved directly to database.
                  </p>
                </div>

                {/* Barangay Selection */}
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                    Jurisdiction Barangay
                  </label>
                  <select
                    value={barangay}
                    onChange={(e) => handleBarangayChange(e.target.value as BarangayName)}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal"
                  >
                    <option value="Buang">Barangay Buang</option>
                    <option value="Nagsipit">Barangay Nagsipit</option>
                  </select>
                </div>

                {/* Purok */}
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                    Purok / Zone
                  </label>
                  <select
                    value={purok}
                    onChange={(e) => setPurok(e.target.value)}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal"
                  >
                    {BARANGAY_CONFIG[barangay].puroks.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* House Number */}
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                    House # / Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    placeholder="e.g. 104-A / Near Chapel"
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal"
                  />
                </div>

                {/* Complete Address */}
                <div className="md:col-span-12">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                    Complete Address
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={completeAddress}
                    onChange={(e) => setCompleteAddress(e.target.value)}
                    placeholder="Auto-formatted or enter complete detailed address (e.g., Sitio/Zone, House #, Landmark, Barangay Buang/Nagsipit, Tabaco City, Albay)"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Family Members & Vulnerability Tagging (Under Complete Address) */}
            <div className="space-y-3">
              <div className="bg-slate-100 text-slate-800 px-3.5 py-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>2. Family Members & Vulnerability Tagging</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="px-2.5 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              </div>

              <div className="space-y-2">
                {familyMembers.map((member, index) => (
                  <div
                    key={member.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-1 flex items-center justify-center">
                      <span className="w-6 h-6 rounded bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-0.5">
                        Member Name
                      </label>
                      <input
                        type="text"
                        value={index === 0 && !member.name ? headOfFamily : member.name}
                        onChange={(e) => handleUpdateMember(member.id, { name: e.target.value.replace(/[0-9]/g, '') })}
                        onKeyDown={(e) => {
                          if (/[0-9]/.test(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        placeholder={index === 0 ? headOfFamily || 'Family Head Name' : 'Full Name'}
                        className="w-full h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 outline-none leading-normal"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-0.5">
                        Relation
                      </label>
                      <select
                        value={member.relationship}
                        onChange={(e) => handleUpdateMember(member.id, { relationship: e.target.value })}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 outline-none leading-normal"
                      >
                        <option value="Head of Family">Head of Family</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Child">Child</option>
                        <option value="Parent">Parent</option>
                        <option value="Grandparent">Grandparent</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Relative">Relative</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-0.5">
                        Age
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        placeholder="Age"
                        value={member.age || ''}
                        onChange={(e) =>
                          handleUpdateMember(member.id, {
                            age: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 outline-none leading-normal"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-0.5">
                        Vulnerability
                      </label>
                      <select
                        value={member.specialCategory}
                        onChange={(e) => handleUpdateMember(member.id, { specialCategory: e.target.value as SpecialCategory })}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 outline-none leading-normal"
                      >
                        <option value="None">None</option>
                        <option value="Senior">Senior (60+)</option>
                        <option value="PWD">PWD</option>
                        <option value="Infant">Infant / Child</option>
                        <option value="Pregnant">Pregnant</option>
                        <option value="Medical">Medical / Sick</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      {familyMembers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                          title="Remove Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Current Disaster Situation & Alert Status */}
            <div className="space-y-3">
              <div className="bg-slate-100 text-slate-800 px-3.5 py-2 rounded-lg border border-slate-200 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>3. Current Household Disaster Situation (Alert Response)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Red - Must Evacuate */}
                <button
                  type="button"
                  onClick={() => setStatus('EMERGENCY')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    status === 'EMERGENCY'
                      ? 'bg-red-50 border-red-500 ring-2 ring-red-500/30'
                      : 'bg-slate-50 border-slate-200 hover:border-red-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-xs text-red-700 uppercase flex items-center gap-1">
                      <Flame className="w-4 h-4 text-red-600" />
                      <span>🔴 Must Evacuate</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                      Emergency
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    House flooded, landslide risk, injured members, or immediate rescue needed.
                  </p>
                </button>

                {/* Yellow - Moderate */}
                <button
                  type="button"
                  onClick={() => setStatus('MODERATE')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    status === 'MODERATE'
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/30'
                      : 'bg-slate-50 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-xs text-amber-700 uppercase flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>🟡 Moderate Risk</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      Standby
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    High risk area, rising water nearby, or preparing go-bags to evacuate.
                  </p>
                </button>

                {/* Green - Safe */}
                <button
                  type="button"
                  onClick={() => setStatus('SAFE')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    status === 'SAFE'
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-xs text-emerald-700 uppercase flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>🟢 Safe at Home</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Normal
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    House is on high ground, secure structure, and family is sheltered in place.
                  </p>
                </button>
              </div>

              {/* Status Note */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight mb-1">
                  Specific Emergency Details or Medical Needs (Optional)
                </label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Water rising to knee level; Need insulin medicine; 1 bedridden senior"
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal"
                />
              </div>
            </div>

            {/* Section 4: Interactive Location Pinning */}
            <div className="space-y-2.5">
              <div className="bg-slate-100 text-slate-800 px-3.5 py-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <span>4. Pin Exact House Location on Map</span>
                </div>
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={geoLocating}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Navigation className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
                  <span>{geoLocating ? 'Detecting GPS...' : '📍 Pin My Exact Location'}</span>
                </button>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
                  <div>
                    Tap or click anywhere on the map to place your pin in <strong>Barangay {barangay}</strong>.
                  </div>
                  <div className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-blue-700 text-[11px]">
                    Lat: {location.lat} | Lng: {location.lng}
                  </div>
                </div>

                <InteractiveMap
                  barangay={barangay}
                  mode="pin-picker"
                  selectedLocation={location}
                  onSelectLocation={(newLoc) => setLocation(newLoc)}
                  className="h-[240px] sm:h-[280px] w-full rounded-lg overflow-hidden border border-slate-200"
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-[11px] text-slate-500 flex items-center flex-wrap gap-2">
                <span>🔒 Data is transmitted in real-time to the Barangay {barangay} DRRM Command Center.</span>
                {nameExisted && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 rounded font-bold text-[10px] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    Name existed
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-household-info"
                  disabled={isSubmitting}
                  className={`px-5 py-2.5 font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wider ${
                    isSubmitting
                      ? 'bg-emerald-700 cursor-wait opacity-85 text-white'
                      : isSyncSuccess
                      ? 'bg-emerald-700 ring-4 ring-emerald-300 shadow-emerald-700/40 text-white cursor-pointer scale-102'
                      : initialHousehold || isResidentLoggedIn
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 text-white cursor-pointer shadow-emerald-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Syncing with Barangay Dashboard...</span>
                    </>
                  ) : initialHousehold || isResidentLoggedIn ? (
                    <>
                      <RefreshCw className={`w-4 h-4 ${isSyncSuccess ? 'text-emerald-200 animate-spin' : ''}`} />
                      <span>{isSyncSuccess ? '✓ Synced to Barangay Dashboard' : 'Save & Sync to Barangay Dashboard'}</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Create Account & Submit Household</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Step 2: Account Registration Modal */}
      {showRegistrationModal && pendingHouseholdPayload && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black tracking-tight uppercase">
                      Create Resident Account
                    </h2>
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px] font-bold uppercase">
                      Step 2 of 2
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-medium">
                    Household credentials for Barangay {pendingHouseholdPayload.barangay} Citizen Portal
                  </p>
                </div>
              </div>
            </div>

            {/* Resident Summary Pill */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Head of Family:</span>
                <strong className="text-slate-900 font-bold">{pendingHouseholdPayload.headOfFamily}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Jurisdiction:</span>
                <span className="font-semibold text-slate-700">Brgy. {pendingHouseholdPayload.barangay} ({pendingHouseholdPayload.purok})</span>
              </div>
            </div>

            {/* Registration Form */}
            <div className="p-5 space-y-4">
              {regError && (
                <div className="p-3 bg-red-50 border-2 border-red-300 text-red-900 rounded-xl text-xs flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{regError}</span>
                </div>
              )}

              <form onSubmit={handleCompleteRegistration} className="space-y-4">
                {/* Email Address */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight">
                      Email Address
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Citizen Username / Login ID</span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        setRegError(null);
                      }}
                      placeholder="e.g. resident.head@gmail.com"
                      className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Used to log in to the citizen status portal and receive official barangay emergency updates.
                  </p>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
                    Account Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                        <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      onCopy={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        setRegError(null);
                      }}
                      placeholder="Create a long, secure password"
                      className="w-full h-10 pl-9 pr-10 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Warning if password is easy to guess */}
                  {regPassword.length > 0 && passwordCriteria.guessReason && (
                    <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-[11px] font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>⚠️ {passwordCriteria.guessReason}</span>
                    </div>
                  )}

                  {/* Password Strength Meter & Guide */}
                  {regPassword.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-600">Password Strength:</span>
                        <span
                          className={`font-black uppercase text-[10px] ${
                            passwordCriteria.score <= 2
                              ? 'text-red-600'
                              : passwordCriteria.score <= 3
                              ? 'text-amber-600'
                              : passwordCriteria.score === 4
                              ? 'text-blue-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {passwordCriteria.score <= 1
                            ? 'Too Short / Very Weak'
                            : passwordCriteria.score === 2
                            ? 'Weak'
                            : passwordCriteria.score === 3
                            ? 'Moderate'
                            : passwordCriteria.score === 4
                            ? 'Strong'
                            : 'Very Strong & Secure'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex gap-1">
                        <div
                          className={`h-full transition-all duration-300 ${
                            passwordCriteria.score >= 1
                              ? passwordCriteria.score <= 2
                                ? 'bg-red-500 w-1/4'
                                : passwordCriteria.score <= 3
                                ? 'bg-amber-500 w-2/4'
                                : passwordCriteria.score === 4
                                ? 'bg-blue-500 w-3/4'
                                : 'bg-emerald-500 w-full'
                              : 'w-0'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Criteria Checklist without Asterisks */}
                  <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        Password Security Requirements:
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {passwordCriteria.isValid ? '✅ All Requirements Met' : 'Requirements checklist:'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div className={`flex items-center gap-1.5 ${passwordCriteria.hasMinLen ? 'text-emerald-700 font-bold' : 'text-slate-600 font-medium'}`}>
                        {passwordCriteria.hasMinLen ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">•</span>
                        )}
                        <span>Long password (8-10+ characters)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordCriteria.notEasyToGuess ? 'text-emerald-700 font-bold' : 'text-slate-600 font-medium'}`}>
                        {passwordCriteria.notEasyToGuess ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">•</span>
                        )}
                        <span>Not easy to guess (no names/sequences)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordCriteria.hasUpper ? 'text-emerald-700 font-bold' : 'text-slate-600 font-medium'}`}>
                        {passwordCriteria.hasUpper ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">•</span>
                        )}
                        <span>Uppercase letter (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordCriteria.hasLower ? 'text-emerald-700 font-bold' : 'text-slate-600 font-medium'}`}>
                        {passwordCriteria.hasLower ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">•</span>
                        )}
                        <span>Lowercase letter (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordCriteria.hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-600 font-medium'}`}>
                        {passwordCriteria.hasNumber ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">•</span>
                        )}
                        <span>Number digit (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordCriteria.hasSymbol ? 'text-emerald-700 font-bold' : 'text-slate-600 font-medium'}`}>
                        {passwordCriteria.hasSymbol ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">•</span>
                        )}
                        <span>Special symbol (!, @, #, $, %, &)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight">
                      Confirm Account Password
                    </label>
                    {regConfirmPassword.length > 0 && (
                      <span
                        className={`text-[10px] font-bold flex items-center gap-1 ${
                          regPassword === regConfirmPassword ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {regPassword === regConfirmPassword ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Passwords Match</span>
                          </>
                        ) : (
                          <span>Passwords Do Not Match</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      onCopy={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      value={regConfirmPassword}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value);
                        setRegError(null);
                      }}
                      placeholder="Re-enter password to confirm"
                      className="w-full h-10 pl-9 pr-10 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition leading-normal font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmittingAccount || accountCreatedSuccess}
                    onClick={() => {
                      setShowRegistrationModal(false);
                      setRegError(null);
                    }}
                    className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back to Household Info
                  </button>
                  <button
                    type="submit"
                    id="btn-create-account-and-login"
                    disabled={isSubmittingAccount || accountCreatedSuccess}
                    className={`px-5 py-2.5 font-black rounded-lg text-xs shadow-md transition-all duration-200 flex items-center gap-1.5 uppercase tracking-wider ${
                      accountCreatedSuccess
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-300 shadow-emerald-600/40 cursor-default scale-102'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer'
                    }`}
                  >
                    {accountCreatedSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-100 animate-bounce" />
                        <span className="text-white tracking-wide">Account created successfully</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Create Account</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Formal Centered Success Popup Modal matching image.png */}
      {showCenterSuccessPopup && pendingHouseholdPayload && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-[370px] bg-white rounded-3xl p-7 sm:p-9 shadow-2xl border border-slate-100 text-center transform animate-scale-up">
            {/* Centered green gradient circle with white checkmark */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#8ce024] to-[#2ebf44] flex items-center justify-center shadow-lg shadow-green-500/25 mx-auto mb-5">
              <svg
                className="w-8 h-8 text-white stroke-[3.5]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-[22px] font-semibold text-slate-800 tracking-tight leading-snug">
              Account created successfully
            </h3>

            {/* Subtitle */}
            <p className="text-slate-500 text-sm mt-2 mb-6 font-normal">
              Your account has been created
            </p>

            {/* Formal Gradient Button */}
            <button
              type="button"
              onClick={handleRedirectToAddHouseholdAgain}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#8ce024] via-[#52d137] to-[#2ebf44] hover:opacity-95 text-white font-semibold text-base shadow-md shadow-green-500/25 transition cursor-pointer active:scale-[0.98]"
            >
              Continue
            </button>

            {/* Subtle automatic redirect indicator */}
            <div className="mt-3.5 flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
              <span>Redirecting to household registration in {redirectCountdown}s...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

