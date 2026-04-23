import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export interface ScanRecord {
  id?: string;
  userId: string;
  title: string;
  resultText: string;
  timestamp: any;
}

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

export const saveScan = async (userId: string, title: string, resultText: string) => {
  try {
    const docRef = await addDoc(collection(db, 'scans'), {
      userId,
      title,
      resultText,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Save Scan Error:", error);
    throw error;
  }
};

export const getUserScans = async (userId: string): Promise<ScanRecord[]> => {
  try {
    const q = query(
      collection(db, 'scans'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ScanRecord[];
  } catch (error) {
    console.error("Get Scans Error:", error);
    throw error;
  }
};

export const deleteScan = async (scanId: string) => {
  try {
    await deleteDoc(doc(db, 'scans', scanId));
  } catch (error) {
    console.error("Delete Scan Error:", error);
    throw error;
  }
};
