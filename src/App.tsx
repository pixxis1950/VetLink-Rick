import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthWrapper } from './Auth';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  Stethoscope, Calendar, MessageSquare, AlertCircle, ChevronRight, CheckCircle2,
  Phone, Clock, ArrowLeft, Camera, Send, CreditCard, ChevronLeft, ShieldAlert,
  Inbox, CheckSquare, Settings as SettingsIcon, Image as ImageIcon, FileText,
  Plus, Trash2, Save, Upload, Sparkles, X, User, Edit3, Building, Users, PawPrint
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

type Role = 'owner' | 'vet';
type Screen = 'home' | 'triage' | 'chat' | 'booking' | 'checkout' | 'success' | 'vet-dashboard' | 'vet-pricing' | 'vet-availability' | 'vet-templates' | 'add-pet' | 'vet-active-case' | 'owner-case-view' | 'owner-settings' | 'vet-settings' | 'vet-earnings' | 'vet-chats' | 'vet-visits' | 'owner-pet-profile' | 'vet-clinic-card' | 'owner-scan' | 'vet-client-card' | 'clinic-search' | 'owner-profile' | 'vet-clients' | 'vet-pet-profile';

export type Pet = {
  id: string;
  name: string;
  species?: string;
  age?: string;
  weight?: string;
  color?: string;
  breed?: string;
  photo?: string;
};

export type ChatCase = {
  id: string;
  petId: string;
  petName: string;
  issue: string; // From triage OR chat flow manually typed
  urgency: string; // 24h, 2h, 30m
  status: 'pending' | 'replied';
  price: number;
  timeAdded: Date;
  ownerText: string;
  hasPhoto: boolean;
  vetReply?: string;
};

export type VetSettings = {
  pricing: { id: string, label: string, price: number }[];
  availability: { chat: boolean, visit: boolean, schedule: string };
  templates: { id: string, title: string, content: string }[];
  clinic: { name: string, address: string, code: string };
};

function DeleteAccountModal({ isOpen, onClose, role, confirmText, onConfirm }: any) {
  const [inputVal, setInputVal] = useState("");
  
  if (!isOpen) return null;

  const isMatch = inputVal.trim() === confirmText;

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] p-6 shadow-xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
         <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
            <AlertCircle size={24} />
         </div>
         <h2 className="text-xl font-bold text-center mb-2">Delete Account</h2>
         <p className="text-sm font-medium text-slate-500 text-center mb-6">
           This process is irreversible. All your data will be permanently deleted.
         </p>
         <div className="mb-6">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
              Type <strong className="text-slate-800">{confirmText}</strong> to confirm:
            </label>
            <input 
              type="text" 
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:border-red-500" 
              placeholder={confirmText}
            />
         </div>
         <div className="flex gap-3">
           <button onClick={() => { setInputVal(''); onClose(); }} className="flex-1 font-bold text-slate-500 py-3 active:scale-95 transition-transform bg-slate-100 rounded-xl">Cancel</button>
           <button onClick={onConfirm} disabled={!isMatch} className="flex-1 font-bold text-white py-3 active:scale-95 transition-transform bg-red-500 rounded-xl disabled:opacity-50 disabled:active:scale-100 shadow-sm">Delete</button>
         </div>
      </div>
    </div>
  );
}

import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeCanvas } from 'qrcode.react';

export default function App() {
  const [role, setRole] = useState<Role>('owner');
  const [screen, setScreen] = useState<Screen>('home');
  const [pets, setPets] = useState<Pet[]>([]);
  const [cases, setCases] = useState<ChatCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);

  const [connectedVet, setConnectedVet] = useState<any>(null); // changed to object { name, address, id }
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [targetClientId, setTargetClientId] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [availableBlocks, setAvailableBlocks] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const [triageData, setTriageData] = useState<{ petId: string | null, problem: string | null, answers: string[], result: 'low' | 'medium' | 'high' | null }>({
    petId: null,
    problem: null,
    answers: [],
    result: null
  });
  const [chatOption, setChatOption] = useState<{ type: string, timeframe: string, price: number, text: string, hasPhoto: boolean } | null>(null);

  const [vetSettings, setVetSettings] = useState<VetSettings>({
    pricing: [
      { id: '24h', label: '24h Response', price: 3 },
      { id: '2h', label: '2h Response', price: 10 },
      { id: '30m', label: '30m Response (+ urgent alert)', price: 25 },
      { id: 'photo', label: 'Photo/Video surcharge', price: 2 }
    ],
    availability: {
      chat: true,
      visit: true,
      schedule: "Mon-Fri: 8AM-5PM"
    },
    templates: [
       { id: '1', title: 'Mild Diarrhea Protocol', content: 'For mild diarrhea with no other symptoms, please withhold food for 12 hours. Ensure fresh water is always available. After 12h, introduce a bland diet (boiled chicken and white rice) in small, frequent meals for 2-3 days before transitioning back to normal food. If it persists beyond 48h, please book a visit.' },
       { id: '2', title: 'Monitor & Rest', content: 'Given the symptoms described, I recommend strict rest for the next 24-48 hours. No running, jumping, or long walks. Leash walks only for bathroom breaks. If the limping worsens or doesn\'t improve after 48h of rest, we should schedule an in-clinic exam.' }
    ],
    clinic: { name: 'Downtown Vet Clinic', address: '123 Main St, New York, NY', code: 'VET-' + Math.random().toString(36).substr(2, 6) }
  });

  useEffect(() => {
    if (!auth.currentUser || !ownerProfile) return;

    const uid = auth.currentUser.uid;
    const isVet = ownerProfile.role === 'vet';

    // 1. Sync Cases
    const casesQuery = isVet 
      ? query(collection(db, 'cases'), where('clinicId', '==', uid))
      : query(collection(db, 'cases'), where('ownerId', '==', uid));
    const unsubCases = onSnapshot(casesQuery, snap => {
      setCases(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    // 2. Sync Appointments
    const apptsQuery = isVet 
      ? query(collection(db, 'appointments'), where('clinicId', '==', uid))
      : query(collection(db, 'appointments'), where('ownerId', '==', uid));
    const unsubAppts = onSnapshot(apptsQuery, snap => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    // 3. Sync Pets
    let unsubPets: any = null;
    if (!isVet) {
      const petsQuery = query(collection(db, 'pets'), where('ownerId', '==', uid));
      unsubPets = onSnapshot(petsQuery, snap => {
        setPets(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      });
    } else {
      const petsQuery = collection(db, 'pets');
      unsubPets = onSnapshot(petsQuery, snap => {
        setPets(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      });
    }

    // 4. Sync Blocks (Slots)
    let unsubBlocks: any = null;
    if (isVet) {
      const blocksQuery = query(collection(db, 'blocks'), where('clinicId', '==', uid));
      unsubBlocks = onSnapshot(blocksQuery, snap => {
        setAvailableBlocks(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      });
    } else if (ownerProfile.linkedClinicId) {
      const blocksQuery = query(collection(db, 'blocks'), where('clinicId', '==', ownerProfile.linkedClinicId));
      unsubBlocks = onSnapshot(blocksQuery, snap => {
        setAvailableBlocks(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      });
    }

    // 5. Sync Linked Clinic Details for Owner
    let unsubClinic: any = null;
    if (!isVet && ownerProfile.linkedClinicId) {
      unsubClinic = onSnapshot(doc(db, 'clinics', ownerProfile.linkedClinicId), docSnap => {
         if (docSnap.exists()) {
            setConnectedVet({ id: docSnap.id, ...docSnap.data() });
         } else {
            setConnectedVet(null);
         }
      });
    } else if (isVet) {
      // Sync own clinic for vet to vetSettings.clinic
      unsubClinic = onSnapshot(doc(db, 'clinics', uid), docSnap => {
         if (docSnap.exists()) {
            setVetSettings(prev => ({ ...prev, clinic: { ...prev.clinic, name: docSnap.data().name || '', address: docSnap.data().address || '' } }));
         }
      });
    }

    // 6. Sync Connected Clients for Vet
    let unsubClients: any = null;
    if (isVet) {
      const clientsQuery = query(collection(db, 'users'), where('linkedClinicId', '==', uid));
      unsubClients = onSnapshot(clientsQuery, snap => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      });
    }

    return () => {
      unsubCases();
      unsubAppts();
      if (unsubPets) unsubPets();
      if (unsubBlocks) unsubBlocks();
      if (unsubClinic) unsubClinic();
      if (unsubClients) unsubClients();
    };
  }, [ownerProfile]);

  const navigate = (newScreen: Screen) => {
    window.scrollTo(0, 0);
    setScreen(newScreen);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const req = new FileReader();
      req.onload = () => resolve(req.result as string);
      req.onerror = reject;
      req.readAsDataURL(file);
    });
  };

  const renderScreen = () => {
    if (role === 'vet') {
      switch (screen) {
        case 'vet-settings':
          return <VetSettings navigate={navigate} settings={vetSettings} />;
        case 'vet-earnings':
          return <VetEarnings navigate={navigate} cases={cases} />;
        case 'vet-chats':
          return <VetChats navigate={navigate} cases={cases} setActiveCaseId={setActiveCaseId} />;
        case 'vet-visits':
          return <VetVisits navigate={navigate} appointments={appointments} setAppointments={setAppointments} availableBlocks={availableBlocks} setAvailableBlocks={setAvailableBlocks} setTargetClientId={setTargetClientId} />;
        case 'vet-client-card':
          return <VetClientCard navigate={navigate} targetClientId={targetClientId} appointments={appointments} cases={cases} />;
        case 'vet-pricing':
          return <VetPricing navigate={navigate} settings={vetSettings} setSettings={setVetSettings} />;
        case 'vet-availability':
          return <VetAvailability navigate={navigate} settings={vetSettings} setSettings={setVetSettings} />;
        case 'vet-templates':
          return <VetTemplates navigate={navigate} settings={vetSettings} setSettings={setVetSettings} />;
        case 'vet-active-case':
          return <VetActiveCase navigate={navigate} activeCaseId={activeCaseId} cases={cases} setCases={setCases} settings={vetSettings} pets={pets} />;
        case 'vet-clinic-card':
          return <VetClinicCard navigate={navigate} settings={vetSettings} setSettings={setVetSettings} />;
        case 'vet-clients':
          return <VetClients navigate={navigate} clients={clients} setTargetClientId={setTargetClientId} />;
        case 'vet-pet-profile':
          return <OwnerPetProfile navigate={navigate} pets={pets} cases={cases} selectedPetId={selectedPetId} role={role} />;
        default:
          return <VetDashboard navigate={navigate} cases={cases} setActiveCaseId={setActiveCaseId} clients={clients} pets={pets} setSelectedPetId={setSelectedPetId} />;
      }
    }

    switch (screen) {
      case 'owner-settings':
        return <OwnerSettings navigate={navigate} pets={pets} setEditingPetId={setEditingPetId} connectedVet={connectedVet} />;
      case 'owner-profile':
        return <OwnerProfile navigate={navigate} ownerProfile={ownerProfile} setOwnerProfile={setOwnerProfile} />;
      case 'clinic-search':
        return <ClinicSearch navigate={navigate} setConnectedVet={setConnectedVet} />;
      case 'owner-pet-profile':
        return <OwnerPetProfile navigate={navigate} pets={pets} cases={cases} selectedPetId={selectedPetId} />;
      case 'owner-scan':
        return <OwnerScan navigate={navigate} setConnectedVet={setConnectedVet} />;
      case 'home':
        return <OwnerHome navigate={navigate} pets={pets} cases={cases} setActiveCaseId={setActiveCaseId} setEditingPetId={setEditingPetId} setSelectedPetId={setSelectedPetId} connectedVet={connectedVet} />;
      case 'add-pet':
        return <AddPetFlow navigate={navigate} setPets={setPets} fileToBase64={fileToBase64} pets={pets} editingPetId={editingPetId} setEditingPetId={setEditingPetId} />;
      case 'owner-case-view':
        return <OwnerCaseView navigate={navigate} activeCaseId={activeCaseId} cases={cases} pets={pets} />;
      case 'triage':
        return <TriageFlow navigate={navigate} data={triageData} setData={setTriageData} pets={pets} />;
      case 'chat':
        return <ChatFlow navigate={navigate} setChatOption={setChatOption} pricing={vetSettings.pricing} />;
      case 'checkout':
        return <CheckoutFlow navigate={navigate} chatOption={chatOption} setCases={setCases} triageData={triageData} pets={pets} connectedVet={connectedVet} />;
      case 'booking':
        return <BookingFlow navigate={navigate} availableBlocks={availableBlocks} setAvailableBlocks={setAvailableBlocks} setAppointments={setAppointments} pets={pets} connectedVet={connectedVet} ownerProfile={ownerProfile} />;
      case 'success':
        return <SuccessScreen navigate={navigate} />;
      default:
        return <OwnerHome navigate={navigate} pets={pets} cases={cases} setActiveCaseId={setActiveCaseId} setSelectedPetId={setSelectedPetId} connectedVet={connectedVet} />;
    }
  };

  return (
    <AuthWrapper setRole={setRole} setLocalUser={setOwnerProfile}>
      <div className="min-h-screen bg-slate-50 flex justify-center w-full font-sans text-slate-800">
        <div className="w-full max-w-md bg-white min-h-screen shadow-lg overflow-hidden flex flex-col relative border-x border-slate-200">
          {/* Header */}
          <header className="px-5 pt-6 pb-3 flex items-center justify-between bg-white z-10 sticky top-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-[18px] text-emerald-500 tracking-tight">VetLink</h1>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => navigate(role === 'owner' ? 'owner-settings' : 'vet-settings')}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 transition-transform"
              >
                <SettingsIcon size={14} />
              </button>
            </div>
          </header>

          {/* Content area */}
          <main className="flex-1 overflow-y-auto w-full flex flex-col">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={screen}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full px-5 py-2"
                >
                  {renderScreen()}
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Global Disclaimer below header for owners */}
            {role === 'owner' && screen !== 'success' && (
              <div className="bg-slate-100/50 px-5 py-3 text-[10px] text-slate-500 text-center border-t border-slate-200 leading-relaxed mt-auto flex flex-col items-center">
                <strong>VetLink:</strong> Your pet's health, simplified.
                <a href="mailto:support@vetlink.com" className="text-emerald-600 underline font-medium mt-0.5">Report an issue</a>
              </div>
            )}
          </main>
        </div>
      </div>
    </AuthWrapper>
  );
}

function OwnerHome({ navigate, pets, cases, setActiveCaseId, setEditingPetId, setSelectedPetId, connectedVet }: any) {
  const activeCases = cases;

  return (
    <div className="space-y-4 w-full">
      <div className="bg-white border text-left border-slate-200 p-4 rounded-[20px] shadow-sm mb-2 mt-2">
         {connectedVet ? (
           <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-100 shrink-0">
                  <Building size={20} />
               </div>
               <div>
                  <h3 className="font-bold text-sm text-slate-800 leading-tight">{connectedVet.name || connectedVet}</h3>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 max-w-[150px] truncate">{connectedVet.address || 'Clinic Address'}</p>
               </div>
             </div>
             <button onClick={() => navigate('clinic-search')} className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full active:bg-emerald-100 transition-colors shrink-0">Change</button>
           </div>
         ) : (
           <div className="flex justify-between items-center">
             <div className="flex items-center gap-2">
               <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center shrink-0">
                  <Building size={20} />
               </div>
               <div>
                  <h3 className="font-bold text-sm text-slate-800 leading-tight">No Clinic Selected</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Connect to book visits</p>
               </div>
             </div>
             <div className="flex gap-1.5 shrink-0">
               <button onClick={() => navigate('owner-scan')} className="w-8 h-8 flex items-center justify-center text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><Camera size={14}/></button>
               <button onClick={() => navigate('clinic-search')} className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">Find</button>
             </div>
           </div>
         )}
      </div>

      <h1 className="text-[20px] font-bold mb-4 mt-2 text-slate-800">How can we help you today?</h1>

      <div className="grid grid-cols-2 gap-4 mb-6 mt-4">
        <div className="flex flex-col">
          <h2 className="text-sm border-b pb-2 border-slate-200 font-bold text-slate-400 uppercase tracking-wider mb-3">Your Pets</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none' }}>
            {pets.map((pet: Pet) => (
                <button 
                  key={pet.id}
                  onClick={() => { setSelectedPetId(pet.id); navigate('owner-pet-profile'); }}
                  className="flex flex-col items-center gap-2 group snap-start shrink-0 w-16"
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-100 group-active:scale-95 transition-transform bg-slate-100 shadow-sm relative">
                    {pet.photo ? (
                      <img src={pet.photo} className="w-full h-full object-cover" alt={pet.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 truncate w-full text-center">{pet.name}</span>
                </button>
            ))}
            <button 
              onClick={() => { setEditingPetId(null); navigate('add-pet'); }}
              className="flex flex-col items-center gap-2 group snap-start shrink-0 w-16"
            >
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 group-active:scale-95 transition-transform">
                  <Plus size={20} />
                </div>
                <span className="text-[11px] font-bold text-slate-400 truncate w-full text-center">Add Pet</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col">
          <h2 className="text-sm border-b pb-2 border-slate-200 font-bold text-slate-400 uppercase tracking-wider mb-3">Message</h2>
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex-1 text-xs text-slate-600 font-medium leading-relaxed overflow-y-auto w-full relative">
            <div className="absolute top-3 left-3 text-emerald-500 opacity-20"><MessageSquare size={24} /></div>
            <div className="relative z-10 p-2">
              {connectedVet ? (connectedVet.message || `Welcome to ${connectedVet.name || 'our clinic'}! We are here to support your pet's health.`) : 'Please connect to a clinic to see their message.'}
            </div>
          </div>
        </div>
      </div>

      {activeCases.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm border-b pb-2 border-slate-200 font-bold text-slate-400 uppercase tracking-wider mb-3">Active Queries</h2>
          <div className="space-y-3">
            {activeCases.map(c => (
              <button 
                key={c.id} 
                onClick={() => {
                  if (c.status === 'replied') {
                    setActiveCaseId(c.id);
                    navigate('owner-case-view');
                  }
                }}
                className={`w-full text-left rounded-[16px] p-4 flex flex-col relative transition-all border ${c.status === 'replied' ? 'bg-blue-50 border-blue-100 active:scale-[0.98]' : 'bg-emerald-50 border-emerald-100'}`}
              >
                <div className="flex justify-between items-start mb-2 w-full">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">{c.petName} <span className="font-normal text-slate-500">— {c.issue}</span></h3>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`px-2 py-0.5 rounded-full text-[10px] items-center gap-1.5 flex font-bold uppercase tracking-wider ${c.status === 'replied' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {c.status === 'replied' ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> : <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                        {c.status === 'replied' ? 'Vet Replied' : 'Pending Vet Reply'}
                      </div>
                    </div>
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider bg-white px-2 py-1 rounded-md shadow-sm border mt-1 ${c.status === 'replied' ? 'text-blue-500 border-blue-100' : 'text-emerald-500 border-emerald-100'}`}>
                    {c.urgency}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm border-b pb-2 border-slate-200 font-bold text-slate-400 uppercase tracking-wider mb-2">New Actions</h2>
      <div className="space-y-3">
        <HomeCard
          title="Book a visit"
          subtitle="Instant booking, no phone calls"
          icon={<Calendar size={24} />}
          bg="bg-orange-50"
          color="text-orange-500"
          onClick={() => navigate('booking')}
        />
        <HomeCard
          title="Ask a veterinarian"
          subtitle="Get a response from $3"
          icon={<MessageSquare size={24} />}
          bg="bg-emerald-50"
          color="text-emerald-500"
          onClick={() => navigate('chat')}
        />
      </div>
    </div>
  );
}

function HomeCard({ title, subtitle, icon, bg, color, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="w-full bg-white border border-slate-200 p-4 rounded-[16px] flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg} ${color}`}>
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-[15px] mb-0.5">{title}</h3>
        <p className="text-slate-500 text-[12px]">{subtitle}</p>
      </div>
    </button>
  );
}

function OwnerSettings({ navigate, pets, setEditingPetId }: any) {
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('home')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 p-6 shadow-sm mb-6">
        <h2 className="text-sm border-b pb-2 border-slate-200 font-bold text-slate-400 uppercase tracking-wider mb-3">Your Pets</h2>
        <div className="grid grid-cols-2 gap-4">
          {pets.map((pet: Pet) => (
            <div key={pet.id} className="h-[140px] rounded-[16px] overflow-hidden relative shadow-sm border border-slate-200 bg-slate-100 flex flex-col justify-end group">
               {pet.photo ? (
                 <img src={pet.photo} className="absolute inset-0 w-full h-full object-cover" alt={pet.name} />
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center bg-slate-200 text-slate-400">
                   <User size={32} />
                 </div>
               )}
               <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
               
               <button 
                 onClick={(e) => { e.stopPropagation(); setEditingPetId(pet.id); navigate('add-pet'); }}
                 className="absolute top-2 right-2 w-7 h-7 bg-white/20 backdrop-blur-md rounded-full text-white flex items-center justify-center hover:bg-white hover:text-slate-900 transition-colors"
               >
                 <Edit3 size={12} />
               </button>

               <div className="relative p-3 text-white">
                 <div className="font-bold text-sm drop-shadow-sm">{pet.name}</div>
                 <div className="text-[10px] opacity-90 leading-tight drop-shadow-sm truncate">{pet.breed || pet.species || 'Unknown'}</div>
               </div>
            </div>
          ))}
          <button 
            onClick={() => { setEditingPetId(null); navigate('add-pet'); }} 
            className="h-[140px] rounded-[16px] border-2 border-dashed border-slate-300 flex flex-col justify-center items-center gap-2 text-slate-400 active:bg-slate-50 transition-colors"
          >
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
               <Plus size={20} />
             </div>
             <span className="text-[11px] font-bold uppercase tracking-wide">Add Pet</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm overflow-hidden text-left mb-6">
         <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 p-6 pb-2 border-b border-slate-100">Account</h2>
         <div className="flex flex-col">
           <button onClick={() => navigate('owner-profile')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
             <div className="flex flex-col items-start gap-1">
               <span className="font-bold text-sm text-slate-800 flex justify-center items-center gap-2"><User size={16} className="text-emerald-500" /> My Profile</span>
               <span className="text-[11px] font-medium text-slate-500">Edit your details and payment methods</span>
             </div>
             <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
           </button>
           <button onClick={() => navigate('clinic-search')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
             <div className="flex flex-col items-start gap-1">
               <span className="font-bold text-sm text-slate-800 flex justify-center items-center gap-2"><Building size={16} className="text-blue-500" /> Linked Clinic</span>
               <span className="text-[11px] font-medium text-slate-500">Manage your associated veterinary clinic</span>
             </div>
             <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
           </button>
           <button onClick={() => setDeleteModalOpen(true)} className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors border-b border-slate-100 last:border-0 group">
             <div className="flex flex-col items-start gap-1">
               <span className="font-bold text-sm text-red-600 flex justify-center items-center gap-2"><AlertCircle size={16} /> Delete Account</span>
               <span className="text-[11px] font-medium text-slate-500">Permanently remove all your data</span>
             </div>
             <ChevronRight size={16} className="text-slate-300 group-hover:text-red-500 transition-colors" />
           </button>
         </div>
      </div>

      <DeleteAccountModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)} 
        role="owner"
        confirmText={pets.length > 0 ? pets.map((p: any) => p.name).join(', ') : "DELETE"}
        onConfirm={async () => {
          try {
            const { auth, db } = await import('./firebase');
            if (auth.currentUser) {
              const { doc, deleteDoc } = await import('firebase/firestore');
              const { deleteUser, signOut } = await import('firebase/auth');
              await deleteDoc(doc(db, 'users', auth.currentUser.uid));
              
              try {
                await deleteUser(auth.currentUser);
              } catch(err: any) {
                if (err.code === 'auth/requires-recent-login') {
                  // Firestore doc is deleted, logging out will effectively force a new registration later
                  await signOut(auth);
                } else {
                  console.error(err);
                }
              }
            }
          } catch(e) { console.error(e); }
        }}
      />
    </div>
  );
}

function AddPetFlow({ navigate, setPets, fileToBase64, pets, editingPetId, setEditingPetId }: any) {
  const isEditing = Boolean(editingPetId);
  const existingPet = isEditing ? pets.find((p: Pet) => p.id === editingPetId) : null;
  
  const [photo, setPhoto] = useState<string | undefined>(existingPet?.photo);
  const [form, setForm] = useState({ 
    name: existingPet?.name || '', 
    species: existingPet?.species || '', 
    age: existingPet?.age || '', 
    weight: existingPet?.weight || '', 
    color: existingPet?.color || '', 
    breed: existingPet?.breed || '' 
  });

  const handlePhotoUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setPhoto(b64);
  };

  const handleSave = async () => {
     if (!form.name.trim()) return;
     try {
       const { auth, db } = await import('./firebase');
       const { doc, setDoc, updateDoc } = await import('firebase/firestore');
       
       if (isEditing) {
         await updateDoc(doc(db, 'pets', editingPetId), {
           ...form,
           photo: photo || null
         });
       } else {
         const id = Math.random().toString(36).substr(2, 9);
         await setDoc(doc(db, 'pets', id), {
           ...form,
           ownerId: auth.currentUser!.uid,
           photo: photo || null
         });
       }
       setEditingPetId(null);
       navigate('home');
     } catch (e) {
       console.error(e);
     }
  };

  const handleBack = () => {
    setEditingPetId(null);
    navigate('home');
  };

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleBack} className="p-2 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Pet' : 'Add a Pet'}</h2>
      </div>

      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative w-32 h-32 rounded-full border-4 border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center overflow-hidden text-slate-400">
            {photo ? (
              <img src={photo} className="w-full h-full object-cover" alt="pet preview" />
            ) : (
              <Camera size={40} className="opacity-50" />
            )}
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest mt-3">Upload Photo</span>
        </div>

        <div className="space-y-1.5">
           <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Name *</label>
           <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="What is your pet's name?" className="w-full p-4 border border-slate-200 rounded-[16px] bg-slate-50/50 font-bold text-lg outline-none focus:border-emerald-500 focus:bg-white transition-colors" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Species</label>
             <select value={form.species} onChange={e => setForm({...form, species: e.target.value})} className="w-full p-4 border border-slate-200 rounded-[16px] bg-white font-medium text-sm outline-none focus:border-emerald-500 transition-colors">
               <option value="">Select...</option>
               <option value="Dog">Dog</option>
               <option value="Cat">Cat</option>
               <option value="Other">Other</option>
             </select>
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Age</label>
             <input value={form.age} onChange={e => setForm({...form, age: e.target.value})} placeholder="e.g. 3 years" className="w-full p-4 border border-slate-200 rounded-[16px] bg-white text-sm font-medium outline-none focus:border-emerald-500 transition-colors" />
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Breed</label>
             <input value={form.breed} onChange={e => setForm({...form, breed: e.target.value})} placeholder="e.g. Golden Mix" className="w-full p-4 border border-slate-200 rounded-[16px] bg-white text-sm font-medium outline-none focus:border-emerald-500 transition-colors" />
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Weight / Size</label>
             <input value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} placeholder="e.g. 45 lbs" className="w-full p-4 border border-slate-200 rounded-[16px] bg-white text-sm font-medium outline-none focus:border-emerald-500 transition-colors" />
          </div>
          <div className="space-y-1.5 col-span-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Color / Distinguishing Marks</label>
             <input value={form.color} onChange={e => setForm({...form, color: e.target.value})} placeholder="e.g. Brindle with white chest" className="w-full p-4 border border-slate-200 rounded-[16px] bg-white text-sm font-medium outline-none focus:border-emerald-500 transition-colors" />
          </div>
        </div>
        
        <button onClick={handleSave} disabled={!form.name.trim()} className={`w-full mt-4 py-4 font-bold rounded-[16px] flex items-center justify-center gap-2 transition-all ${!form.name.trim() ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500 text-white active:scale-[0.98] shadow-md hover:shadow-lg'}`}>
           <Save size={20} /> {isEditing ? 'Save Changes' : 'Save Pet Profile'}
        </button>
      </div>
    </div>
  );
}

function TriageFlow({ navigate, data, setData, pets }: any) {
  const [step, setStep] = useState(() => {
     if (pets && pets.length === 1) return 0; // Auto-apply single pet if they only have one
     return -1; // Force selection
  });

  const problems = ["Vomiting", "Diarrhea", "Limping", "Loss of appetite", "Other"];
  const questions = [
    { text: "How long has this been happening?", options: ["Just started (< 2h)", "A few hours", "More than 24h"] },
    { text: "Is your pet behaving normally otherwise?", options: ["Yes, totally normal", "A bit sluggish", "Very weak / Unresponsive"] },
    { text: "Are there any other symptoms?", options: ["No other symptoms", "Yes, one more", "Multiple other symptoms"] }
  ];

  const handleSelectPet = (petId: string) => {
    setData({ ...data, petId });
    setStep(0);
  };

  const handleSelectProblem = (p: string) => {
    setData({ problem: p, answers: [], result: null });
    setStep(1);
  };

  const handleSelectAnswer = (ans: string) => {
    const newAnswers = [...data.answers, ans];
    if (step < questions.length) {
      setData({ ...data, answers: newAnswers });
      setStep(step + 1);
    }
  };

  if (step > questions.length) {
    // Result logic mockup
    const isHighRisk = data.answers.includes("More than 24h") || data.answers.includes("Very weak / Unresponsive");
    const isMediumRisk = data.answers.includes("A bit sluggish") || data.answers.includes("Yes, one more");
    const risk = isHighRisk ? 'high' : isMediumRisk ? 'medium' : 'low';

    return (
      <div className="space-y-6">
        <button onClick={() => navigate('home')} className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-4">
          <ChevronLeft size={16} /> Back
        </button>

        <div className="text-center space-y-4">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${risk === 'high' ? 'bg-red-100 text-red-600' : risk === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
            {risk === 'high' ? <AlertCircle size={40} /> : risk === 'medium' ? <Clock size={40} /> : <CheckCircle2 size={40} />}
          </div>
          <div>
            <h2 className="text-2xl font-bold">
              {risk === 'high' ? 'May be urgent' : risk === 'medium' ? 'Visit recommended' : 'Does not appear urgent'}
            </h2>
            <p className="text-gray-500 mt-2">Based on your answers about {data.problem.toLowerCase()}.</p>
          </div>
        </div>

        <div className="space-y-3 pt-6">
          {risk === 'low' && (
            <button onClick={() => navigate('chat')} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-[16px] shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <MessageSquare size={18} /> Ask a vet
            </button>
          )}
          {risk === 'medium' && (
            <button onClick={() => navigate('booking')} className="w-full bg-orange-500 text-white font-bold py-4 rounded-[16px] shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <Calendar size={18} /> Book appointment
            </button>
          )}
          {risk === 'high' && (
            <>
              <a href="tel:5550198" className="w-full bg-red-500 text-white font-bold py-4 rounded-[16px] shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <Phone size={18} /> Call veterinarian
              </a>
              <button onClick={() => navigate('chat')} className="w-full bg-slate-100 text-slate-800 font-bold py-4 rounded-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <MessageSquare size={18} /> Priority written response
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('home')} className="flex items-center gap-2 text-slate-500 text-sm font-medium">
        <ChevronLeft size={16} /> Cancel
      </button>

      {step === -1 ? (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold leading-tight">Who is this for?</h2>
          {(!pets || pets.length === 0) ? (
            <div className="bg-slate-50 p-8 rounded-[24px] text-center border border-slate-200 shadow-sm">
              <User size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-bold text-slate-800 text-lg mb-2">No pets yet</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium">Create a quick profile so your veterinarian has the right context before providing advice.</p>
              <button onClick={() => navigate('add-pet')} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <Plus size={20} /> Add a Pet Profile
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
               {pets.map((pet: Pet) => (
                 <button 
                   key={pet.id} 
                   onClick={() => handleSelectPet(pet.id)}
                   className="border border-slate-200 rounded-[20px] p-4 text-left active:scale-[0.98] transition-all focus:border-emerald-500 hover:shadow-md bg-white flex flex-col items-center text-center group"
                 >
                   <div className="w-20 h-20 rounded-[16px] bg-slate-100 overflow-hidden mb-3 border border-slate-200 flex items-center justify-center">
                      {pet.photo ? <img src={pet.photo} className="w-full h-full object-cover" alt={pet.name} /> : <User size={32} className="text-slate-400" />}
                   </div>
                   <span className="font-bold text-slate-800 text-sm">{pet.name}</span>
                   <span className="text-[11px] font-medium text-slate-500 mt-0.5 truncate w-full">{pet.breed || pet.species || 'Unknown'}</span>
                 </button>
               ))}
               <button 
                 onClick={() => navigate('add-pet')}
                 className="border-2 border-dashed border-slate-300 rounded-[20px] p-4 text-left active:scale-[0.98] transition-all active:bg-slate-50 flex flex-col items-center justify-center text-center text-slate-400 group"
               >
                   <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-active:bg-slate-200 transition-colors">
                     <Plus size={24} />
                   </div>
                   <span className="font-bold text-xs uppercase tracking-wider">New Pet</span>
               </button>
            </div>
          )}
        </div>
      ) : step === 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">What is the primary problem?</h2>
          <div className="space-y-2">
            {problems.map(p => (
              <button 
                key={p} 
                onClick={() => handleSelectProblem(p)}
                className="w-full p-4 border border-slate-200 rounded-[16px] text-left font-medium active:bg-slate-50 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-1 mb-6">
             {questions.map((_, i) => (
               <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
             ))}
          </div>
          <h2 className="text-2xl font-bold leading-tight">{questions[step - 1].text}</h2>
          <div className="space-y-2 pt-4">
            {questions[step - 1].options.map(opt => (
              <button 
                key={opt} 
                onClick={() => handleSelectAnswer(opt)}
                className="w-full p-4 border border-slate-200 rounded-[16px] text-left font-medium active:bg-slate-50 transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OwnerCaseView({ navigate, activeCaseId, cases, pets }: any) {
  const currentCase = cases.find((c: ChatCase) => c.id === activeCaseId);
  const pet = pets.find((p: Pet) => p.id === currentCase?.petId);

  if (!currentCase) return null;

  return (
    <div className="space-y-6 pb-6 w-full">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('home')} className="p-2 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Vet's Reply</h2>
      </div>

      <div className="bg-white border text-left border-slate-200 p-6 rounded-[24px] shadow-sm flex flex-col items-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-md -mt-12 mb-4 overflow-hidden">
          {pet?.photo ? <img src={pet.photo} className="w-full h-full object-cover"/> : <Stethoscope size={32} className="text-slate-400" />}
        </div>
        <h3 className="font-bold text-lg mb-1">{pet?.name || currentCase.petName}</h3>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-6">Original Query</span>
        <p className="text-slate-700 w-full text-sm italic border-l-2 border-slate-200 pl-4 py-1">"{currentCase.ownerText}"</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-[24px]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
            <Stethoscope size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Dr. Smith</h3>
            <p className="text-[12px] text-blue-600 font-bold uppercase tracking-wider">{currentCase.urgency}</p>
          </div>
        </div>
        <div className="text-slate-800 text-[15px] leading-relaxed whitespace-pre-wrap">
          {currentCase.vetReply}
        </div>
      </div>
    </div>
  );
}

function ChatFlow({ navigate, setChatOption, pricing }: any) {
  const [photoAdded, setPhotoAdded] = useState(false);
  const [text, setText] = useState("");
  const [timeframe, setTimeframe] = useState<number>(1);

  const timeOptions = [
    { id: 1, label: pricing?.find((o:any)=>o.id==='24h')?.label || "24h Response", price: pricing?.find((o:any)=>o.id==='24h')?.price || 3, desc: "Low urgency" },
    { id: 2, label: pricing?.find((o:any)=>o.id==='2h')?.label || "2h Response", price: pricing?.find((o:any)=>o.id==='2h')?.price || 10, desc: "Most popular", badge: "POPULAR" },
    { id: 3, label: pricing?.find((o:any)=>o.id==='30m')?.label || "30m Response (+ urgent alert)", price: pricing?.find((o:any)=>o.id==='30m')?.price || 25, desc: "Premium priority" }
  ];

  const handleContinue = () => {
    if (!text.trim()) return;
    const selected = timeOptions.find(o => o.id === timeframe)!;
    const photoSurcharge = pricing?.find((o: any) => o.id === 'photo')?.price || 2;
    const extraPrice = photoAdded ? photoSurcharge : 0;
    
    setChatOption({
      type: photoAdded ? 'Photo & Text query' : 'Text query',
      timeframe: selected?.label || 'Unknown',
      price: (selected?.price || 0) + extraPrice,
      text: text,
      hasPhoto: photoAdded
    });
    navigate('checkout');
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <button onClick={() => navigate('home')} className="flex items-center gap-2 text-slate-500 text-sm font-medium">
        <ChevronLeft size={16} /> Cancel
      </button>
      
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Ask a veterinarian</h2>
        <p className="text-sm text-slate-500">You may avoid a visit if not necessary.</p>
      </div>

      <div className="space-y-4 flex-1">
        <div>
          <textarea 
            className="w-full border border-slate-200 rounded-xl p-4 text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[120px] bg-slate-50/50 transition-all font-medium"
            placeholder="Describe your pet's problem carefully..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button 
            className={`flex flex-col items-center justify-center p-3 rounded-[16px] border flex-1 transition-colors ${!photoAdded ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 active:bg-slate-50'}`}
            onClick={() => setPhotoAdded(false)}
          >
            <MessageSquare size={20} className="mb-1" />
            <span className="font-bold text-sm">Text only</span>
          </button>
          <button 
            className={`flex flex-col items-center justify-center p-3 rounded-[16px] border flex-1 transition-colors ${photoAdded ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 active:bg-slate-50'}`}
            onClick={() => setPhotoAdded(true)}
          >
            <Camera size={20} className="mb-1" />
            <span className="font-bold text-sm">Include photo</span>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 mt-0.5">+{pricing?.find((o: any) => o.id === 'photo')?.price || 0}$ Surcharge</span>
          </button>
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="font-bold">Select response time</h3>
          <div className="space-y-2">
            {timeOptions.map(opt => (
              <label key={opt.id} className={`flex items-center justify-between p-3 border rounded-[16px] cursor-pointer transition-all ${timeframe === opt.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={timeframe === opt.id} onChange={() => setTimeframe(opt.id)} className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {opt.label}
                      {opt.badge && <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{opt.badge}</span>}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">{opt.desc}</div>
                  </div>
                </div>
                <div className="font-black text-lg">${opt.price}</div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={handleContinue}
        disabled={!text.trim()}
        className={`w-full font-bold py-4 rounded-[16px] shadow-sm transition-transform ${!text.trim() ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white active:scale-[0.98]'}`}
      >
        Proceed to Payment
      </button>
    </div>
  );
}

function CheckoutFlow({ navigate, chatOption, setCases, triageData, pets, connectedVet }: any) {
  return (
    <div className="space-y-6">
      <button onClick={() => navigate('chat')} className="flex items-center gap-2 text-gray-500 text-sm font-medium">
        <ChevronLeft size={16} /> Back to question
      </button>

      <h2 className="text-2xl font-bold leading-tight">Complete your request</h2>
      
      <div className="bg-slate-50 border border-slate-200 p-5 rounded-[20px] space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Service</span>
          <span className="font-semibold">{chatOption?.type}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Timeframe</span>
          <span className="font-semibold">{chatOption?.timeframe}</span>
        </div>
        <hr className="border-slate-200" />
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Total</span>
          <span className="font-bold text-2xl">${chatOption?.price.toFixed(2)}</span>
        </div>
        
        <p className="text-xs text-slate-400 bg-white p-3 rounded-lg border border-slate-100">
          Vet will respond within the selected time. If a physical visit is required immediately, this fee may be credited toward your visit (varies by clinic).
        </p>
      </div>

      <div className="space-y-3 pt-4">
        <button className="flex w-full items-center justify-between p-4 border border-slate-200 rounded-[16px]">
          <div className="flex items-center gap-3">
            <CreditCard className="text-slate-400" />
            <span className="font-medium text-slate-500">Add payment method...</span>
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
        <button 
          onClick={async () => {
            const defaultPetId = triageData?.petId || (pets && pets.length > 0 ? pets[0].id : null);
            const defaultPetName = pets?.find((p:any) => p.id === defaultPetId)?.name || 'Unknown Pet';
            try {
              const { auth, db } = await import('./firebase');
              const { doc, setDoc } = await import('firebase/firestore');
              const id = Math.random().toString(36).substr(2, 9);
              await setDoc(doc(db, 'cases', id), {
                ownerId: auth.currentUser!.uid,
                clinicId: connectedVet.id,
                petId: defaultPetId || 'unknown',
                petName: defaultPetName,
                issue: triageData?.problem ? `${triageData.problem}${chatOption?.hasPhoto ? ' • Photo' : ''}` : `Direct Query${chatOption?.hasPhoto ? ' • Photo' : ''}`,
                urgency: chatOption?.timeframe || 'Unknown',
                status: 'pending',
                price: chatOption?.price || 0,
                timeAdded: Date.now(),
                ownerText: chatOption?.text || '',
                hasPhoto: chatOption?.hasPhoto || false
              });
              navigate('success');
            } catch(e) { console.error(e); }
          }}
          className="w-full bg-emerald-500 text-white font-bold py-4 rounded-[16px] flex items-center justify-center shadow-sm active:scale-[0.98] transition-transform"
        >
          Pay ${chatOption?.price.toFixed(2)} & Send
        </button>
      </div>
    </div>
  );
}

function BookingFlow({ navigate, availableBlocks, setAvailableBlocks, setAppointments, pets, connectedVet, ownerProfile }: any) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<string>('');
  
  const visits = [
    { title: "General Checkup", icon: <Stethoscope size={20} /> },
    { title: "Vaccination", icon: <ShieldAlert size={20} /> },
    { title: "Sick Visit", icon: <AlertCircle size={20} /> }
  ];

  // Group slots by date
  const slotsByDate = availableBlocks.reduce((acc: any, slot: any) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const dates = Object.keys(slotsByDate);

  const handleBook = async (slot: any) => {
    const defaultPet = pets && pets.length > 0 ? pets[0] : { name: 'Unknown Pet' };
    try {
      const { auth, db } = await import('./firebase');
      const { doc, setDoc, deleteDoc } = await import('firebase/firestore');
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'appointments', id), {
        clinicId: connectedVet.id,
        ownerId: auth.currentUser!.uid,
        date: slot.date,
        time: slot.time,
        petName: defaultPet.name,
        type: type,
        ownerName: ownerProfile?.name || 'Current User',
        duration: slot.duration,
        status: 'upcoming'
      });
      await deleteDoc(doc(db, 'blocks', slot.id));
      navigate('success');
    } catch(e) { console.error(e); }
  };

  if (!connectedVet) {
    return (
      <div className="space-y-6 flex flex-col items-center justify-center text-center py-20 px-4">
         <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-2 border-4 border-slate-50 shadow-sm">
           <Building size={40} />
         </div>
         <h2 className="text-2xl font-bold text-slate-800 tracking-tight">No Clinic Selected</h2>
         <p className="text-slate-500 font-medium max-w-xs text-[15px] leading-relaxed">You must connect to a veterinary clinic before you can book an appointment.</p>
         <div className="flex flex-col gap-3 w-full mt-4">
           <button onClick={() => navigate('clinic-search')} className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-transform shadow-md flex items-center justify-center gap-2">
             <Building size={18} /> Find a Clinic
           </button>
           <button onClick={() => navigate('owner-scan')} className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-transform shadow-md flex items-center justify-center gap-2">
             <Camera size={18} /> Scan Clinic QR
           </button>
           <button onClick={() => navigate('home')} className="font-bold text-slate-400 py-3 active:scale-[0.98] transition-transform">
             Cancel
           </button>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('home')} className="flex items-center gap-2 text-gray-500 text-sm font-medium">
        <ChevronLeft size={16} /> Cancel
      </button>

      {step === 1 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold leading-tight">What type of visit?</h2>
          <div className="space-y-3 pt-2">
            {visits.map(v => (
              <button 
                key={v.title}
                onClick={() => { setType(v.title); setStep(2); }}
                className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-[16px] hover:bg-slate-50 active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center gap-3 font-semibold">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">{v.icon}</div>
                  {v.title}
                </div>
                <ChevronRight className="text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold leading-tight">Available times</h2>
          <p className="text-sm font-medium text-emerald-600 bg-emerald-50 p-2 rounded-lg inline-block">For: {type}</p>
          
          <div className="space-y-6 pt-2">
            {dates.map(date => (
              <div key={date} className="space-y-3">
                <h3 className="font-bold text-slate-500">{date}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {slotsByDate[date].map((slot: any) => (
                    <button 
                      key={slot.id}
                      onClick={() => handleBook(slot)}
                      className="py-3 border border-emerald-200 bg-white rounded-[16px] font-bold text-emerald-600 active:bg-emerald-500 active:text-white transition-colors"
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {dates.length === 0 && (
              <div className="text-center py-10 text-slate-400 font-medium">No available slots at this time.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessScreen({ navigate }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
      <div className="bg-emerald-100 text-emerald-600 p-6 rounded-full inline-block">
        <CheckCircle2 size={64} />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">All set!</h2>
        <p className="text-slate-500 max-w-[250px] mx-auto">Your request has been sent. We'll be in touch shortly.</p>
      </div>
      <button 
        onClick={() => navigate('home')}
        className="w-full bg-slate-100 text-slate-800 font-bold py-4 rounded-[16px] mt-8 active:scale-[0.98] transition-transform"
      >
        Back to Home
      </button>
    </div>
  );
}

// ==========================================
// VET DASHBOARD & TOOLS
// ==========================================

function VetDashboard({ navigate, cases, setActiveCaseId, clients, pets, setSelectedPetId }: any) {
  const pendingCases = cases.filter((c: ChatCase) => c.status === 'pending');
  
  const sortedPending = [...pendingCases].sort((a, b) => {
    const getScore = (u: string) => u.includes('30m') ? 1 : u.includes('2h') ? 2 : 3;
    return getScore(a.urgency) - getScore(b.urgency) || a.timeAdded.getTime() - b.timeAdded.getTime();
  });
  const urgentChats = sortedPending.slice(0, 2);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Today</h2>
          <p className="text-slate-500 font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric'})}</p>
        </div>
      </div>

      <div className="space-y-4">
        <button 
          onClick={() => navigate('vet-earnings')}
          className="w-full bg-emerald-50 border border-emerald-100 p-6 rounded-[20px] shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="text-left">
            <h3 className="font-bold text-emerald-800 tracking-tight">Earnings this week</h3>
            <span className="text-2xl font-black text-emerald-600">${cases.reduce((sum: number, c: ChatCase) => sum + c.price, 450)}</span>
          </div>
          <ChevronRight size={24} className="text-emerald-400" />
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => navigate('vet-chats')}
            className="bg-white border border-slate-200 p-5 rounded-[20px] shadow-sm flex flex-col items-center justify-center text-center active:scale-[0.98] transition-transform relative"
          >
            {pendingCases.length > 0 && <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"></div>}
            <span className="text-blue-400 mb-2 bg-blue-50 p-3 rounded-full"><Inbox size={20} /></span>
            <span className="font-bold text-2xl">{pendingCases.length}</span>
            <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider mt-1">Pending Chats</span>
          </button>
          
          <button 
            onClick={() => navigate('vet-visits')}
            className="bg-white border border-slate-200 p-5 rounded-[20px] shadow-sm flex flex-col items-center justify-center text-center active:scale-[0.98] transition-transform"
          >
            <span className="text-emerald-400 mb-2 bg-emerald-50 p-3 rounded-full"><Calendar size={20} /></span>
            <span className="font-bold text-2xl">12</span>
            <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider mt-1">Today's Visits</span>
          </button>
        </div>
      </div>

      {urgentChats.length > 0 && (
        <div className="bg-white border border-slate-200 p-5 rounded-[20px] shadow-sm">
          <h3 className="text-sm font-bold border-b border-slate-100 pb-2 mb-3 flex items-center gap-2 text-slate-800">
            <ShieldAlert size={16} className="text-red-500" /> Action Required (Most Urgent)
          </h3>
          <div className="space-y-2">
            {urgentChats.map((chat: ChatCase, i: number) => (
              <button 
                key={chat.id} 
                onClick={() => {
                  setActiveCaseId(chat.id);
                  navigate('vet-active-case');
                }}
                className={`w-full flex items-center text-left py-2 px-3 rounded-xl gap-3 active:scale-[0.98] transition-colors hover:bg-slate-50 ${chat.urgency.includes('30m') ? 'bg-red-50 border border-red-100' : 'bg-orange-50 border border-orange-100'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                     <strong className="block text-sm leading-tight truncate text-slate-800">{chat.petName}</strong>
                     <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm ${chat.urgency.includes('30m') ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                        {chat.urgency.includes('30m') ? '30m' : chat.urgency.includes('2h') ? '2h' : '24h'}
                     </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">{chat.issue}</div>
                </div>
                <ChevronRight size={16} className={chat.urgency.includes('30m') ? 'text-red-300' : 'text-orange-300'} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 p-5 rounded-[20px] shadow-sm">
         <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
           <div>
             <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-0.5">
               <PawPrint size={16} className="text-orange-500" /> Pet Profiles
             </h3>
             <p className="text-xs text-slate-500 font-medium tracking-tight">Quick access to patient info</p>
           </div>
           <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full">{pets?.length || 0} Managed</span>
         </div>
         <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 snap-x scrollbar-hide">
            {(pets || []).slice(0, 5).map((pet: any) => (
              <button 
                 key={pet.id} 
                 onClick={() => {
                   setSelectedPetId(pet.id);
                   navigate('vet-pet-profile');
                 }}
                 className="snap-start shrink-0 w-24 flex flex-col items-center group cursor-pointer active:scale-[0.98] transition-transform"
              >
                  <div className="w-16 h-16 rounded-full bg-slate-100 mb-2 overflow-hidden border border-slate-200 shadow-sm relative group-hover:border-emerald-300 transition-colors">
                      {pet.photo ? <img src={pet.photo} className="w-full h-full object-cover"/> : <PawPrint size={24} className="text-slate-300 m-auto mt-5"/>}
                  </div>
                  <span className="text-xs font-bold text-slate-800 truncate w-full text-center">{pet.name}</span>
                  <span className="text-[10px] text-slate-500 truncate w-full text-center">{pet.species || 'Unknown'}</span>
              </button>
            ))}
            {pets?.length === 0 && (
              <div className="text-sm font-medium text-slate-400 w-full text-center py-4">No pet profiles connected yet.</div>
            )}
         </div>
      </div>

      <button 
        onClick={() => navigate('vet-clients')}
        className="w-full bg-white border border-slate-200 p-5 rounded-[20px] shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform group hover:border-emerald-300"
      >
        <div className="text-left flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-full">
             <Users size={20} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 tracking-tight group-hover:text-emerald-600 transition-colors">Connected Clients</h3>
            <span className="text-sm font-medium text-slate-500">{clients?.length || 0} active pet owners</span>
          </div>
        </div>
        <ChevronRight size={20} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
      </button>

    </div>
  );
}

function VetSettings({ navigate, settings }: any) {
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('vet-dashboard')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Settings & Monetization</h2>
        <div className="space-y-2">
          <button onClick={() => navigate('vet-clinic-card')} className="w-full flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-xl transition-colors text-left">
            <span className="font-medium text-sm flex items-center gap-3"><Camera size={16} className="text-slate-400"/> Clinic Profile & QR</span>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
          <button onClick={() => navigate('vet-pricing')} className="w-full flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-xl transition-colors text-left">
            <span className="font-medium text-sm flex items-center gap-3"><CreditCard size={16} className="text-slate-400"/> Triage pricing</span>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
          <button onClick={() => navigate('vet-availability')} className="w-full flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-xl transition-colors text-left">
            <span className="font-medium text-sm flex items-center gap-3"><Clock size={16} className="text-slate-400"/> Availability settings</span>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
          <button onClick={() => navigate('vet-templates')} className="w-full flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-xl transition-colors text-left">
            <span className="font-medium text-sm flex items-center gap-3"><FileText size={16} className="text-slate-400"/> Message templates</span>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
          <button onClick={() => setDeleteModalOpen(true)} className="w-full flex items-center justify-between p-3 hover:bg-red-50 rounded-xl border-t border-slate-200 mt-2 transition-colors text-left group">
            <span className="font-medium text-sm flex items-center gap-3 text-red-600"><AlertCircle size={16} className="text-red-500"/> Delete Account</span>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-red-500" />
          </button>
        </div>
      </div>

      <DeleteAccountModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)} 
        role="vet"
        confirmText={settings?.clinic?.name || "DELETE"}
        onConfirm={async () => {
          try {
            const { auth, db } = await import('./firebase');
            if (auth.currentUser) {
              const { doc, deleteDoc } = await import('firebase/firestore');
              const { deleteUser, signOut } = await import('firebase/auth');
              
              await deleteDoc(doc(db, 'users', auth.currentUser.uid));
              await deleteDoc(doc(db, 'clinics', auth.currentUser.uid));
              
              try {
                await deleteUser(auth.currentUser);
              } catch (err: any) {
                if (err.code === 'auth/requires-recent-login') {
                  // Firestore doc is deleted, logging out forces a new registration flow next time
                  await signOut(auth);
                } else {
                  console.error(err);
                }
              }
            }
          } catch(e) { console.error(e); }
        }}
      />
    </div>
  );
}

function VetEarnings({ navigate, cases }: any) {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly'>('daily');

  const dailyData = [
    { name: 'Mon', revenue: 120, visits: 2, chats: 4 },
    { name: 'Tue', revenue: 210, visits: 3, chats: 5 },
    { name: 'Wed', revenue: 150, visits: 1, chats: 6 },
    { name: 'Thu', revenue: 290, visits: 4, chats: 8 },
    { name: 'Fri', revenue: 340, visits: 5, chats: 9 },
    { name: 'Sat', revenue: 420, visits: 6, chats: 12 },
    { name: 'Sun', revenue: 310, visits: 4, chats: 10 }
  ];

  const monthlyData = [
    { name: 'Week 1', revenue: 1200 },
    { name: 'Week 2', revenue: 1500 },
    { name: 'Week 3', revenue: 1400 },
    { name: 'Week 4', revenue: 1840 }
  ];

  const yearlyData = [
    { name: 'Jan', revenue: 5200 },
    { name: 'Feb', revenue: 5600 },
    { name: 'Mar', revenue: 5100 },
    { name: 'Apr', revenue: 5940 },
    { name: 'May', revenue: 0 },
    { name: 'Jun', revenue: 0 }
  ];

  const dataMap = {
    daily: dailyData,
    monthly: monthlyData,
    yearly: yearlyData
  };

  const currentData = dataMap[viewMode];
  const totalPeriod = currentData.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('vet-dashboard')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Financials</h2>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-[16px] mb-4">
        <button onClick={() => setViewMode('daily')} className={`flex-1 py-2 text-sm font-bold rounded-[12px] transition-colors ${viewMode === 'daily' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Daily</button>
        <button onClick={() => setViewMode('monthly')} className={`flex-1 py-2 text-sm font-bold rounded-[12px] transition-colors ${viewMode === 'monthly' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Monthly</button>
        <button onClick={() => setViewMode('yearly')} className={`flex-1 py-2 text-sm font-bold rounded-[12px] transition-colors ${viewMode === 'yearly' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Yearly</button>
      </div>

      <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-slate-500 text-sm tracking-tight uppercase tracking-wider">Total Revenue</h3>
            <span className="text-4xl font-black text-slate-800 tracking-tight block mt-1">${totalPeriod.toLocaleString()}</span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full inline-block mt-2">+12% YoY</p>
          </div>
        </div>
        
        <div className="h-64 w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'daily' ? (
              <BarChart data={currentData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#64748b', fontSize: '12px' }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {currentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === currentData.length - 2 ? '#10b981' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <AreaChart data={currentData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#64748b', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Digital Triage</h3>
            <div className="text-2xl font-black text-slate-800">142 <span className="text-sm font-medium text-slate-500">Chats</span></div>
            <div className="text-emerald-500 text-[10px] font-bold mt-1 bg-emerald-50 inline-block px-1.5 py-0.5 rounded">~$3,550 rev</div>
         </div>
         <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">In-Clinic Visits</h3>
            <div className="text-2xl font-black text-slate-800">48 <span className="text-sm font-medium text-slate-500">Booked</span></div>
            <div className="text-blue-500 text-[10px] font-bold mt-1 bg-blue-50 inline-block px-1.5 py-0.5 rounded">~$2,390 rev</div>
         </div>
      </div>
    </div>
  );
}

function VetClients({ navigate, clients, setTargetClientId }: any) {
  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('vet-dashboard')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
        </div>
        <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-600 rounded-full">{clients.length} Total</span>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {clients.length === 0 && (
           <div className="text-center py-10 text-slate-400 text-sm font-medium">No clients connected yet.</div>
        )}
        {clients.map((client: any, i: number) => (
          <button 
            key={client.id} 
            onClick={() => {
              setTargetClientId(client.id);
              navigate('vet-client-card');
            }}
            className={`flex items-center text-left p-4 gap-4 hover:bg-slate-50 transition-colors ${i !== clients.length - 1 ? 'border-b border-slate-100' : ''}`}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex-shrink-0 flex items-center justify-center border border-emerald-100">
               <User size={20} className="text-emerald-500" />
            </div>
            <div className="flex-1">
              <strong className="block text-base leading-tight text-slate-800">{client.name}</strong>
              <div className="text-[12px] font-medium text-slate-500 mt-0.5">{client.email || 'No email provided'}</div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

function VetChats({ navigate, cases, setActiveCaseId }: any) {
  const pendingCases = cases.filter((c: ChatCase) => c.status === 'pending');
  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('vet-dashboard')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold tracking-tight">Pending Chats</h2>
        </div>
        <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-600 rounded-full">{pendingCases.length} Pending</span>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {pendingCases.length === 0 && (
           <div className="text-center py-10 text-slate-400 text-sm font-medium">No pending chats right now!</div>
        )}
        {pendingCases.map((chat: ChatCase, i: number) => (
          <button 
            key={chat.id} 
            onClick={() => {
              setActiveCaseId(chat.id);
              navigate('vet-active-case');
            }}
            className={`flex items-center text-left p-4 gap-3 hover:bg-slate-50 transition-colors ${i !== pendingCases.length - 1 ? 'border-b border-slate-100' : ''}`}
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center border border-slate-200">
               <Stethoscope size={20} className="text-slate-400" />
            </div>
            <div className="flex-1">
              <strong className="block text-sm leading-tight text-slate-800">{chat.petName}</strong>
              <div className="text-[12px] font-medium text-slate-500 mt-0.5 truncate max-w-[150px]">{chat.issue}</div>
            </div>
            <div className="text-right">
              <span className="font-bold text-emerald-500 text-sm block mb-1">${chat.price}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase py-0.5 px-1.5 bg-slate-100 rounded tracking-wider">{chat.urgency.split(' ')[0]}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function VetVisits({ navigate, appointments, setAppointments, availableBlocks, setAvailableBlocks, setTargetClientId }: any) {
  const [newTime, setNewTime] = useState("");

  const handleAddSlot = async () => {
    if (!newTime) return;
    try {
      const { auth, db } = await import('./firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'blocks', id), {
        clinicId: auth.currentUser!.uid,
        date: 'Today, 17 Apr',
        time: newTime,
        duration: 20
      });
      setNewTime("");
    } catch(e) { console.error(e); }
  };

  const handleClientClick = (appt: any) => {
    setTargetClientId(appt.id);
    navigate('vet-client-card');
  };

  const handleStatusChange = async (e: React.MouseEvent, id: string, newStatus: string) => {
    e.stopPropagation();
    try {
      const { db } = await import('./firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'appointments', id), { status: newStatus });
    } catch(e) { console.error(e); }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      const { db } = await import('./firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'blocks', id));
    } catch(e) { console.error(e); }
  };

  const allItems = [
    ...appointments.map((a: any) => ({ ...a, kind: 'appt' })),
    ...availableBlocks.map((b: any) => ({ ...b, kind: 'block' }))
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('vet-dashboard')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold tracking-tight">Today's Visits</h2>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">17 Apr</span>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{appointments.length} Booked</span>
        </div>
      </div>

      <div className="bg-white border text-left border-slate-200 p-4 rounded-[20px] shadow-sm flex items-center justify-between gap-3 relative">
         <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500" />
         <button onClick={handleAddSlot} disabled={!newTime} className="bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl disabled:opacity-50 flex items-center gap-2">
            <Plus size={16} /> Add 20m Free Block
         </button>
      </div>

      <div className="space-y-4 mt-8">
        {allItems.map((item, i) => (
          <div key={item.id}>
            {item.kind === 'appt' ? (
               <button onClick={() => handleClientClick(item)} className="block w-full text-left">
                 {item.status === 'in-progress' && (
                    <div className="bg-emerald-600 text-white rounded-[24px] shadow-lg p-6 relative overflow-hidden group border border-emerald-700 w-full transition-transform active:scale-[0.98]">
                       <div className="absolute top-0 right-0 p-4">
                         <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> In Progress
                         </span>
                       </div>
                       <div className="flex items-center gap-2 text-emerald-100 font-bold text-sm mb-4">
                          <Clock size={16} /> {item.time} ({item.duration || 20}m)
                       </div>
                       <h3 className="font-black text-2xl mb-1">{item.petName}</h3>
                       <div className="text-emerald-100 font-medium text-sm flex flex-col gap-1 mb-6">
                         <span>{item.type}</span>
                         <span>Owner: {item.ownerName}</span>
                       </div>
                       <div className="pt-4 border-t border-emerald-500/50">
                          <button 
                            onClick={(e) => handleStatusChange(e, item.id, 'done')}
                            className="w-full bg-white text-emerald-600 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-emerald-50 transition-colors"
                          >
                             <CheckCircle2 size={18} /> Mark as Done
                          </button>
                       </div>
                    </div>
                 )}
                 {item.status === 'upcoming' && (
                    <div className="bg-emerald-50 text-emerald-900 border-2 border-emerald-200 rounded-[20px] p-5 relative overflow-hidden group w-full transition-transform active:scale-[0.98]">
                       <div className="flex items-center justify-between mb-3 w-full">
                          <div className="flex items-center gap-2 font-bold text-sm text-emerald-600">
                            <Clock size={16} /> {item.time}
                          </div>
                          <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                            Upcoming
                          </span>
                       </div>
                       <h3 className="font-bold text-lg mb-1">{item.petName}</h3>
                       <p className="text-emerald-700/80 text-sm font-medium mb-4">{item.type} • {item.ownerName}</p>
                       <button 
                         onClick={(e) => handleStatusChange(e, item.id, 'in-progress')}
                         className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-orange-600 transition-colors"
                       >
                          Accept Next Patient
                       </button>
                    </div>
                 )}
                 {(item.status === 'pending' || item.status === 'done') && (
                    <div className={`bg-white rounded-[16px] border border-slate-200 p-4 shadow-sm w-full text-left transition-all ${item.status === 'done' ? 'opacity-60' : 'hover:border-slate-300 active:scale-[0.98]'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className={`font-bold text-slate-800 flex items-center gap-2 ${item.status === 'done' && 'line-through decoration-slate-300'}`}>{item.petName}</h3>
                          <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5"><Clock size={12}/> {item.time} • {item.type}</p>
                        </div>
                        {item.status === 'done' ? (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 flex items-center gap-1 uppercase rounded-md"><CheckCircle2 size={12}/> Done</span>
                        ) : (
                          <ChevronRight size={16} className="text-slate-300 transition-colors" />
                        )}
                      </div>
                    </div>
                 )}
               </button>
            ) : (
               <div className="bg-emerald-50 border border-emerald-200 border-dashed rounded-[16px] p-4 flex justify-between items-center opacity-80">
                 <div>
                    <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2"><Clock size={14} /> {item.time} • Open Slot</h3>
                    <p className="text-xs font-medium text-emerald-600 mt-0.5">{item.duration}m Available</p>
                 </div>
                 <button onClick={() => handleDeleteBlock(item.id)} className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-colors">
                   <Trash2 size={14} />
                 </button>
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VetClientCard({ navigate, targetClientId, appointments, cases }: any) {
  const clientAppt = appointments.find((a: any) => a.id === targetClientId);
  
  if (!clientAppt) return null;

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('vet-visits')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Client record</h2>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
         <div className="w-24 h-24 bg-slate-100 rounded-full border-4 border-slate-50 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
           <User size={32} />
         </div>
         <h2 className="text-xl font-bold text-slate-800">{clientAppt.ownerName}</h2>
         <p className="text-sm font-medium text-slate-500 mt-1">Owner of <span className="font-bold text-emerald-600">{clientAppt.petName}</span></p>

         <div className="flex gap-2 w-full mt-6">
           <button className="flex-1 bg-emerald-50 text-emerald-600 font-bold py-3 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-transform"><MessageSquare size={16}/> Message</button>
           <button className="flex-1 bg-emerald-50 text-emerald-600 font-bold py-3 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-transform"><Phone size={16}/> Call</button>
         </div>
      </div>

      <div className="space-y-3 mt-6">
         <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><User size={18} className="text-emerald-500" /> Client Details</h3>
         <div className="bg-white rounded-[16px] border border-slate-200 shadow-sm p-4 text-left">
            <div className="flex items-start gap-3 mb-4">
               <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Building size={16}/></div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
                 <p className="text-sm font-medium text-slate-700">123 Fake Street, CA</p>
               </div>
            </div>
            <div className="flex items-start gap-3">
               <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><CreditCard size={16}/></div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Method</p>
                 <p className="text-sm font-medium text-slate-700">Visa •••• 4242</p>
               </div>
            </div>
         </div>
      </div>

      <div className="space-y-3 mt-6">
         <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><Calendar size={18} className="text-emerald-500" /> Upcoming Appointment</h3>
         <div className="bg-white rounded-[16px] border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">{clientAppt.date} • {clientAppt.time}</p>
              <h4 className="font-bold text-slate-800 text-sm">{clientAppt.type} for {clientAppt.petName.split(' ')[0]}</h4>
            </div>
            <button className="bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-lg transition-colors"><Edit3 size={16} /></button>
         </div>
      </div>

      <div className="space-y-3 mt-6">
         <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><FileText size={18} className="text-blue-500" /> Triage History</h3>
         <div className="bg-white rounded-[16px] border border-slate-200 shadow-sm divide-y divide-slate-100">
           <div className="p-4">
              <div className="flex justify-between mb-1">
                <span className="font-bold text-sm text-slate-800">Upset STomach</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded uppercase">Mar 12, 2026</span>
              </div>
              <p className="text-xs text-slate-600">Prescribed bland diet for 48 hours for vomiting.</p>
           </div>
         </div>
      </div>
    </div>
  );
}

function VetActiveCase({ navigate, activeCaseId, cases, setCases, settings, pets }: any) {
  const currentCase = cases.find((c: ChatCase) => c.id === activeCaseId);
  const pet = pets.find((p: Pet) => p.id === currentCase?.petId);
  const [replyText, setReplyText] = useState("");

  if (!currentCase) return null;
  const isRedHot = currentCase.urgency.includes('30m');

  const handleSend = () => {
    if (!replyText.trim()) return;
    setCases((prev: ChatCase[]) => prev.map((c: ChatCase) => 
      c.id === currentCase.id ? { ...c, status: 'replied', vetReply: replyText } : c
    ));
    navigate('vet-dashboard');
  };

  return (
    <div className="space-y-6 flex flex-col h-full w-full pb-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('vet-dashboard')} className="p-2 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Active Request</h2>
      </div>

      {isRedHot && (
        <div className="bg-red-500 text-white font-bold p-3 rounded-[16px] flex items-center justify-center gap-2 shadow-sm animate-pulse">
          <ShieldAlert size={20} /> HIGH PRIORITY - 30 MIN RESPONSE
        </div>
      )}

      <div className={`${isRedHot ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'} border p-4 rounded-[20px] flex justify-between items-center`}>
        <div>
           <div className={`${isRedHot ? 'text-red-700' : 'text-emerald-700'} font-bold uppercase tracking-wider text-[10px] mb-1`}>Target Response Time</div>
           <div className={`font-black ${isRedHot ? 'text-red-600' : 'text-emerald-600'} text-lg`}>{currentCase.urgency}</div>
        </div>
        <div className="text-right">
           <div className={`${isRedHot ? 'text-red-700' : 'text-emerald-700'} font-bold uppercase tracking-wider text-[10px] mb-1`}>Earned</div>
           <div className={`font-black ${isRedHot ? 'text-red-600' : 'text-emerald-600'} text-lg`}>${currentCase.price.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white border text-left border-slate-200 p-6 rounded-[24px] shadow-sm flex flex-col relative mt-2">
        <div className="flex gap-4 items-start mb-6">
          <div className="w-16 h-16 bg-slate-100 rounded-[16px] flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
             {pet?.photo ? <img src={pet.photo} className="w-full h-full object-cover"/> : <Stethoscope size={24} className="text-slate-400" />}
          </div>
          <div>
            <h3 className="font-bold text-lg mb-0.5">{pet?.name || currentCase.petName}</h3>
            <div className="text-[11px] font-medium text-slate-500 mb-1">{pet?.species || 'Unknown'} • {pet?.age || 'Unknown'} • {pet?.weight || 'Unknown'}</div>
          </div>
        </div>
        
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b pb-1 border-slate-100">Owner's Query</span>
        <p className="text-slate-800 text-sm italic py-2 whitespace-pre-wrap">{currentCase.ownerText}</p>
      </div>

      <div className="space-y-3 flex-1 flex flex-col">
        <h3 className="font-bold text-slate-800">Your Reply</h3>
        
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none' }}>
           {settings.templates.map((t: any) => (
             <button 
               key={t.id}
               onClick={() => setReplyText(prev => prev + (prev ? " " : "") + t.content)}
               className="shrink-0 snap-start border border-slate-200 bg-white rounded-xl px-4 py-2 text-xs font-bold text-emerald-600 active:bg-emerald-50 transition-colors"
             >
               + {t.title}
             </button>
           ))}
        </div>

        <textarea 
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Type your medical advice or next steps here..."
          className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none flex-1 min-h-[150px] bg-white font-medium"
        />
      </div>

      <button 
        onClick={handleSend}
        disabled={!replyText.trim()}
        className={`w-full font-bold py-4 rounded-[16px] shadow-sm transition-transform flex items-center justify-center gap-2 ${!replyText.trim() ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white active:scale-[0.98]'}`}
      >
        <Send size={18} /> Send Reply
      </button>

    </div>
  );
}

function VetPricing({ navigate, settings, setSettings }: any) {
  const pricing = settings.pricing;

  return (
    <div className="flex flex-col gap-6 w-full pb-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('vet-dashboard')} className="p-2 bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Triage Pricing</h2>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 p-6 shadow-sm space-y-4">
        <p className="text-sm text-slate-500 mb-2">Set your fees for written consultations and response times.</p>
        
        <div className="space-y-4">
          {pricing.map((item: any, idx: number) => (
            <div key={item.id} className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-800">{item.label}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number" 
                  value={item.price}
                  onChange={(e) => {
                    const newPricing = [...pricing];
                    newPricing[idx].price = Number(e.target.value);
                    setSettings({ ...settings, pricing: newPricing });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[12px] py-3 pl-8 pr-4 font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-shadow"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => navigate('vet-dashboard')} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-[16px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform">
        <Save size={18} /> Save Pricing
      </button>
    </div>
  );
}

function VetAvailability({ navigate, settings, setSettings }: any) {
  const { chat, visit, schedule } = settings.availability;
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="flex flex-col gap-6 w-full pb-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('vet-dashboard')} className="p-2 bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Availability</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-[20px] border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Paid Triage & Chats</h3>
              <p className="text-xs text-slate-500 mt-1">Accepting new digital questions</p>
            </div>
            <button 
              onClick={() => setSettings({ ...settings, availability: { ...settings.availability, chat: !chat } })}
              className={`w-12 h-6 rounded-full relative transition-colors ${chat ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${chat ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[20px] border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800">In-clinic Visits</h3>
              <p className="text-xs text-slate-500 mt-1">Accepting automatic bookings</p>
            </div>
            <button 
              onClick={() => setSettings({ ...settings, availability: { ...settings.availability, visit: !visit } })}
              className={`w-12 h-6 rounded-full relative transition-colors ${visit ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${visit ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          
          {visit && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">Working Hours</h3>
                {!editMode && <button onClick={() => setEditMode(true)} className="text-emerald-500 text-xs font-bold uppercase">Edit</button>}
              </div>
              
              {editMode ? (
                <textarea
                  value={schedule}
                  onChange={(e) => setSettings({ ...settings, availability: { ...settings.availability, schedule: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[12px] p-4 text-sm font-medium outline-none h-24 whitespace-pre-wrap"
                />
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-4 text-sm font-medium text-slate-600 whitespace-pre-wrap">
                  {schedule}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button onClick={() => { setEditMode(false); navigate('vet-dashboard'); }} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-[16px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform">
        <Save size={18} /> Save Availability
      </button>
    </div>
  );
}

function VetTemplates({ navigate, settings, setSettings }: any) {
  const templates = settings.templates;
  const [newMode, setNewMode] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) return;
    setSettings({ 
      ...settings, 
      templates: [...templates, { id: Math.random().toString(36), title, content }] 
    });
    setNewMode(false);
    setTitle("");
    setContent("");
  };

  const handleDelete = (id: string) => {
    setSettings({ ...settings, templates: templates.filter((t: any) => t.id !== id) });
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('vet-dashboard')} className="p-2 bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Message Templates</h2>
      </div>

      {newMode ? (
        <div className="bg-white rounded-[20px] border border-emerald-500 p-6 shadow-sm space-y-4">
          <h3 className="font-bold">New Template</h3>
          <input 
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Template Title (e.g., Vomiting Instructions)"
            className="w-full bg-slate-50 border border-slate-200 rounded-[12px] p-3 text-sm font-bold outline-none focus:border-emerald-500"
          />
          <textarea 
            value={content} onChange={e => setContent(e.target.value)}
            placeholder="Medical advice goes here..."
            className="w-full bg-slate-50 border border-slate-200 rounded-[12px] p-3 text-sm font-medium outline-none h-32 focus:border-emerald-500 whitespace-pre-wrap"
          />
          <div className="flex gap-2">
            <button onClick={() => setNewMode(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-[12px] active:scale-[0.98]">Cancel</button>
            <button onClick={handleCreate} disabled={!title || !content} className="flex-1 py-3 text-sm font-bold text-white bg-emerald-500 rounded-[12px] active:scale-[0.98] disabled:opacity-50">Save</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setNewMode(true)} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white p-4 rounded-[16px] font-bold shadow-sm active:scale-[0.98] transition-transform">
          <Plus size={18} /> Create New Template
        </button>
      )}

      <div className="space-y-4">
        {templates.map((t: any) => (
          <div key={t.id} className="bg-white rounded-[20px] border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-slate-800">{t.title}</h3>
              <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
              {t.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerPetProfile({ navigate, pets, cases, selectedPetId, role }: any) {
  const pet = pets.find((p: Pet) => p.id === selectedPetId);
  const petCases = cases.filter((c: ChatCase) => c.petId === selectedPetId);
  
  if (!pet) return null;

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(role === 'vet' ? 'vet-dashboard' : 'home')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Pet Profile</h2>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm overflow-hidden pb-4">
         <div className="h-40 w-full bg-slate-200 relative">
            {pet.photo ? (
               <img src={pet.photo} className="w-full h-full object-cover" />
            ) : (
               <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-200"><ImageIcon size={40} /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <h2 className="absolute bottom-4 left-4 text-white text-3xl font-bold">{pet.name}</h2>
         </div>
         <div className="px-5 pt-5 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Species / Breed</div>
              <div className="font-medium text-slate-800">{pet.species || 'Unknown'} {pet.breed ? `• ${pet.breed}` : ''}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Age</div>
              <div className="font-medium text-slate-800">{pet.age || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Weight</div>
              <div className="font-medium text-slate-800">{pet.weight || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Color/Marks</div>
              <div className="font-medium text-slate-800">{pet.color || 'Unknown'}</div>
            </div>
         </div>
      </div>

      <div className="space-y-3">
         <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><Calendar size={18} className="text-emerald-500" /> Upcoming Appointments</h3>
         <div className="bg-white rounded-[16px] border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 rounded-xl p-3 flex flex-col items-center justify-center w-16 h-16 shrink-0">
               <span className="text-xs font-bold uppercase tracking-widest">AUG</span>
               <span className="text-xl font-black">20</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Annual Checkup & Vaccines</h4>
              <p className="text-xs text-slate-500 mt-0.5">Downtown Vet Clinic • 10:30 AM</p>
            </div>
         </div>
      </div>

      <div className="space-y-3 mt-6">
         <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><AlertCircle size={18} className="text-emerald-500" /> Medical History</h3>
         <div className="bg-white rounded-[16px] border border-slate-200 shadow-sm p-4 divide-y divide-slate-100">
             <div className="pb-3">
               <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vaccinations</span>
               <div className="font-medium text-sm text-slate-800 mt-1">Rabies (Valid to 2027), DAPP (Valid to 2026)</div>
             </div>
             <div className="py-3">
               <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Chronic Conditions</span>
               <div className="font-medium text-sm text-slate-800 mt-1">Mild arthritis in hind legs</div>
             </div>
             <div className="pt-3">
               <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Regular Medications</span>
               <div className="font-medium text-sm text-slate-800 mt-1">Carprofen 25mg (as needed)</div>
             </div>
         </div>
      </div>

      <div className="space-y-3 mt-6">
         <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2"><MessageSquare size={18} className="text-emerald-500" /> Consultations History</h3>
         {petCases.length === 0 ? (
            <div className="text-slate-400 text-sm italic">No past consultations.</div>
         ) : (
            <div className="space-y-2">
              {petCases.map((c: ChatCase) => (
                 <div key={c.id} className="bg-white rounded-[16px] border border-slate-200 p-4 shadow-sm">
                   <div className="flex justify-between items-start mb-2 w-full">
                     <span className="font-bold text-sm text-slate-800">{c.issue}</span>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {c.timeAdded ? new Date(c.timeAdded).toLocaleDateString() : ''}
                     </span>
                   </div>
                   <div className="text-xs text-slate-600 italic">"{c.ownerText.substring(0, 50)}{c.ownerText.length > 50 ? '...' : ''}"</div>
                 </div>
              ))}
            </div>
         )}
      </div>
    </div>
  );
}

function VetClinicCard({ navigate, settings, setSettings }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(settings?.clinic || { name: 'Downtown Vet Clinic', address: '123 Main St, New York, NY', code: 'VET-12345' });
  const [uid, setUid] = useState<string | null>(null);

  React.useEffect(() => {
    import('./firebase').then(({ auth }) => {
      if (auth.currentUser) setUid(auth.currentUser.uid);
    });
  }, []);

  const handleSave = async () => {
    try {
      const { auth, db } = await import('./firebase');
      if (auth.currentUser) {
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'clinics', auth.currentUser.uid), {
          name: form.name,
          address: form.address,
          code: form.code
        }, { merge: true });
        setSettings({ ...settings, clinic: form });
        setEditing(false);
      }
    } catch(e) { console.error(e); }
  };

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('vet-settings')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Clinic Profile & QR</h2>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden relative">
         <div className="h-32 bg-emerald-500 w-full p-6 flex flex-col justify-end relative">
            {!editing && <button onClick={() => setEditing(true)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 backdrop-blur-md transition-colors"><Edit3 size={16} /></button>}
            <h2 className="text-2xl font-bold text-white tracking-tight">{settings?.clinic?.name || 'Clinic Name'}</h2>
            <p className="text-emerald-100 text-sm font-medium">{settings?.clinic?.address || 'Clinic Address'}</p>
         </div>
         
         {editing ? (
           <div className="p-6 space-y-4">
             <div>
               <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Clinic Name</label>
               <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full mt-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-colors" />
             </div>
             <div>
               <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Address</label>
               <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full mt-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-colors" />
             </div>
             <button onClick={handleSave} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl mt-2 active:scale-[0.98] transition-transform">Save Profile</button>
           </div>
         ) : (
           <div className="p-8 flex flex-col items-center justify-center">
              <div className="text-sm text-slate-500 font-medium mb-6 text-center">Have your clients scan this code to connect directly to your digital clinic.</div>
              <div className="w-48 h-48 bg-white border-2 border-slate-200 rounded-3xl p-4 shadow-sm flex items-center justify-center relative">
                 {uid && <QRCodeCanvas value={uid} size={150} level={"H"} fgColor={"#1e293b"} />}
              </div>
              <div className="mt-4 text-[10px] font-mono text-slate-400 tracking-widest">{uid || 'NO-CODE'}</div>
              <button className="mt-6 flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-full hover:bg-emerald-100 transition-colors">
                <FileText size={16} /> Print Poster
              </button>
           </div>
         )}
      </div>
    </div>
  );
}

function OwnerScan({ navigate, setConnectedVet }: any) {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string>('');
  const [scanResult, setScanResult] = useState<string | null>(null);

  React.useEffect(() => {
    let html5QrcodeScanner: Html5QrcodeScanner | null = null;
    if (scanning) {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0 },
        /* verbose= */ false
      );
      html5QrcodeScanner.render((decodedText) => {
        // Success
        html5QrcodeScanner?.clear().catch(console.error);
        setScanResult(decodedText);
        setScanning(false);
      }, (errorMessage) => {
        // Just ignore errors during scanning (happens all the time when no QR is in frame)
      });
    }

    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(console.error);
      }
    };
  }, [scanning]);

  React.useEffect(() => {
    if (scanResult) {
      // It's a clinic uid
      const linkClinic = async () => {
        try {
          const { auth, db } = await import('./firebase');
          const { doc, getDoc, updateDoc } = await import('firebase/firestore');
          if (auth.currentUser) {
            const clinicDoc = await getDoc(doc(db, 'clinics', scanResult));
            if (clinicDoc.exists()) {
              await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                linkedClinicId: clinicDoc.id
              });
              setConnectedVet({ id: clinicDoc.id, ...clinicDoc.data() });
            } else {
              setError("Invalid Clinic QR Code (Clinic not found).");
              setScanning(true);
              setScanResult(null);
            }
          }
        } catch(e) {
          console.error(e);
          setError("Failed to link clinic.");
        }
      };
      linkClinic();
    }
  }, [scanResult, setConnectedVet]);

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
       <div className="p-6 flex items-center justify-between text-white z-10 sticky top-0 bg-transparent">
         <button onClick={() => navigate('home')} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors backdrop-blur-md">
           <X size={20} />
         </button>
         <div className="font-bold tracking-widest uppercase text-xs">Scan Clinic QR</div>
         <div className="w-10"></div>
       </div>

       <div className="flex-1 relative flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[320px] bg-white rounded-2xl overflow-hidden p-2 relative z-10 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            {error && <div className="p-2 bg-red-100 text-red-600 text-xs font-bold text-center rounded mb-2">{error}</div>}
            
            {scanning ? (
              <div id="reader" className="w-full h-full overflow-hidden rounded-xl border-none"></div>
            ) : (
              <div className="flex flex-col items-center justify-center bg-emerald-500 text-white p-8 rounded-xl animate-in fade-in duration-300">
                 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/30">
                   <Building size={32} className="text-emerald-500" />
                 </div>
                 <h3 className="font-bold text-xl text-center mb-1">Connected!</h3>
                 <p className="text-sm text-center text-emerald-50 font-medium mb-6">You are now linked with the clinic.</p>
                 <button onClick={() => navigate('home')} className="w-full bg-white text-emerald-600 font-bold py-3 rounded-xl active:scale-95 transition-transform shadow-md">
                   Continue
                 </button>
              </div>
            )}
            
            {/* Provide css override to hide unused html5-qrcode branding elements if necessary */}
            <style>{`
              #reader__dashboard_section_csr span { color: #1e293b; font-family: sans-serif; font-weight: 500;}
              #reader__dashboard_section_swaplink { color: #10b981; text-decoration: none; font-weight: 600;}
              #reader__dashboard_section_csr button { background-color: #10b981; color: white; border: none; cursor: pointer; border-radius: 8px; padding: 6px 12px; margin: 5px; font-weight: 600;}
              #reader__header_message { display: none; }
              #reader a { color: #10b981; text-decoration: none; }
            `}</style>
          </div>
       </div>
    </div>
  );
}

function OwnerProfile({ navigate, ownerProfile, setOwnerProfile }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(ownerProfile);

  const handleSave = () => {
    setOwnerProfile(form);
    setEditing(false);
  };

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('owner-settings')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Your Profile</h2>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden text-center p-6">
         <div className="w-24 h-24 bg-slate-100 rounded-full border-4 border-slate-50 flex items-center justify-center text-slate-400 mb-4 shadow-sm mx-auto">
           <User size={32} />
         </div>
         {editing ? (
            <div className="space-y-4 text-left">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full mt-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Home Address</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full mt-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Payment Method</label>
                <input value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})} className="w-full mt-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <button onClick={handleSave} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl mt-2 active:scale-[0.98] transition-transform">Save Profile</button>
            </div>
         ) : (
            <div>
               <h2 className="text-xl font-bold text-slate-800">{ownerProfile.name}</h2>
               <div className="mt-6 text-left space-y-4">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Building size={16}/></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
                      <p className="text-sm font-medium text-slate-700">{ownerProfile.address}</p>
                    </div>
                 </div>
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><CreditCard size={16}/></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Payment</p>
                      <p className="text-sm font-medium text-slate-700">{ownerProfile.paymentMethod}</p>
                    </div>
                 </div>
               </div>
               <button onClick={() => setEditing(true)} className="w-full border-2 border-emerald-100 text-emerald-600 font-bold py-3 rounded-xl mt-6 active:scale-[0.98] transition-transform">Edit Profile</button>
            </div>
         )}
      </div>
    </div>
  );
}

function ClinicSearch({ navigate, setConnectedVet }: any) {
  const [search, setSearch] = useState("");
  const [clinics, setClinics] = useState<any[]>([]);

  useEffect(() => {
    import('./firebase').then(async ({ db }) => {
       const { collection, getDocs } = await import('firebase/firestore');
       const querySnapshot = await getDocs(collection(db, 'clinics'));
       const fetchedClinics: any[] = [];
       querySnapshot.forEach((doc) => {
         fetchedClinics.push({ id: doc.id, ...doc.data() });
       });
       setClinics(fetchedClinics);
    });
  }, []);

  const filtered = clinics.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.address?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (clinic: any) => {
    setConnectedVet(clinic);
    try {
      const { auth, db } = await import('./firebase');
      if (auth.currentUser) {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          linkedClinicId: clinic.id
        });
      }
    } catch(e) { console.error(e); }
    navigate('home');
  };

  return (
    <div className="space-y-6 w-full pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('home')} className="p-2 w-10 h-10 bg-slate-100 rounded-full text-slate-600 active:scale-[0.98] transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Select Clinic</h2>
      </div>

      <div className="mb-6 relative">
         <input 
            type="text" 
            placeholder="Search by name or address..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 p-4 pl-12 rounded-[16px] shadow-sm font-medium outline-none focus:border-emerald-500 transition-colors"
         />
         <Building size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      <div className="space-y-3">
        {filtered.map(c => (
           <button 
             key={c.id}
             onClick={() => handleSelect(c)}
             className="w-full bg-white border border-slate-200 p-4 rounded-[16px] flex items-center justify-between text-left shadow-sm hover:border-emerald-300 active:scale-[0.98] transition-all group"
           >
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">{c.name}</h3>
                <p className="text-sm font-medium text-slate-500 mt-0.5">{c.address}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                {c.distance && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{c.distance}</span>}
                <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </div>
           </button>
        ))}
        {filtered.length === 0 && (
           <div className="text-center text-slate-400 py-10 font-medium">No clinics found matching '{search}'.</div>
        )}
      </div>

      <div className="mt-8">
         <div className="relative">
           <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
           <div className="relative flex justify-center text-xs"><span className="bg-slate-50 px-2 text-slate-400 font-bold uppercase tracking-wider">or</span></div>
         </div>
         <button onClick={() => navigate('owner-scan')} className="w-full mt-6 bg-slate-800 text-white font-bold py-4 rounded-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
            <Camera size={18} /> Scan Clinic QR Code
         </button>
      </div>
    </div>
  );
}

