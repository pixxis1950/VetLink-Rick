import React, { useState } from 'react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export function AuthWrapper({ children, setRole, setLocalUser }: any) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requireRoleChoice, setRequireRoleChoice] = useState(false);

  React.useEffect(() => {
    let unsubSnap: any = null;
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (u) {
        unsubSnap = onSnapshot(doc(db, 'users', u.uid), (userDoc) => {
           if (userDoc.exists()) {
              const data = userDoc.data();
              setRole(data.role);
              setUser(u);
              setLocalUser(data);
              setRequireRoleChoice(false);
           } else {
              setUser(u);
              setRequireRoleChoice(true);
           }
           setLoading(false);
        });
      } else {
        if (unsubSnap) unsubSnap();
        setUser(null);
        setLocalUser(null);
        setLoading(false);
      }
    });
    return () => {
       unsubAuth();
       if (unsubSnap) unsubSnap();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const chooseRole = async (chosenRole: 'owner' | 'vet') => {
    if (!user) return;
    const userData = {
      role: chosenRole,
      name: user.displayName || 'Unnamed User',
      email: user.email || '',
      linkedClinicId: '',
      address: '',
      paymentMethod: ''
    };
    await setDoc(doc(db, 'users', user.uid), userData);
    setRole(chosenRole);
    setLocalUser(userData);
    setRequireRoleChoice(false);

    // If vet, auto create clinic profile
    if (chosenRole === 'vet') {
       await setDoc(doc(db, 'clinics', user.uid), {
         ownerId: user.uid,
         name: user.displayName ? `${user.displayName}'s Clinic` : 'My Veterinary Clinic',
         address: '123 Vet Street'
       });
    }
  };

  if (loading) {
     return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center w-full font-sans">
        <div className="w-full max-w-sm bg-white p-8 rounded-[24px] shadow-lg text-center">
           <h1 className="text-3xl font-black text-emerald-500 mb-2">VetLink</h1>
           <p className="text-slate-500 mb-8 font-medium">Your pet's health, simplified.</p>
           <button onClick={loginWithGoogle} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-md">
             Sign in with Google
           </button>
        </div>
      </div>
    );
  }

  if (requireRoleChoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center w-full font-sans">
        <div className="w-full max-w-sm bg-white p-8 rounded-[24px] shadow-lg text-center">
           <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to VetLink!</h2>
           <p className="text-slate-500 mb-8 font-medium">How will you be using the app?</p>
           
           <div className="space-y-4">
             <button onClick={() => chooseRole('owner')} className="w-full border-2 border-emerald-100 bg-emerald-50 text-emerald-700 font-bold py-4 rounded-xl hover:bg-emerald-100 active:scale-95 transition-all text-left px-5 flex items-center justify-between">
                <span>I am a Pet Owner</span>
             </button>
             <button onClick={() => chooseRole('vet')} className="w-full border-2 border-slate-200 bg-slate-50 text-slate-800 font-bold py-4 rounded-xl hover:bg-slate-100 active:scale-95 transition-all text-left px-5 flex items-center justify-between">
                <span>I am a Veterinarian</span>
             </button>
           </div>
        </div>
      </div>
    );
  }

  return children;
}
