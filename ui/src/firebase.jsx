// firebase.js - Firebase configuration and authentication methods
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from 'firebase/firestore';

// Replace with your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC4gjF6o04EM3m4-wM6ybCLdwhv8Ygw0P8",
    authDomain: "agriverseai-db0d5.firebaseapp.com",
    projectId: "agriverseai-db0d5",
    storageBucket: "agriverseai-db0d5.firebasestorage.app",
    messagingSenderId: "481808736656",
    appId: "1:481808736656:web:dcf6c3277022db39931315"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Anonymous sign in
export const signInUserAnonymously = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("Anonymous user signed in:", userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in anonymously:", error);
    throw error;
  }
};

// Update user profile with display name
export const updateUserProfile = async (displayName) => {
  try {
    const user = auth.currentUser;
    if (user) {
      await updateProfile(user, { displayName });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

// Save user data to Firestore
export const saveUserData = async (userData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found");
    
    await setDoc(doc(db, "users", user.uid), {
      ...userData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error("Error saving user data:", error);
    throw error;
  }
};

// Get user data from Firestore
export const getUserData = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found");
    
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export { auth, db };