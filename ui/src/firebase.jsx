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
    apiKey: "AIzaSyC4gjF6o04EM3m4-wM6ybCLdwhv8Ygw0P8", // Replace with your actual API key if necessary
    authDomain: "agriverseai-db0d5.firebaseapp.com",
    projectId: "agriverseai-db0d5",
    storageBucket: "agriverseai-db0d5.appspot.com", // Corrected storage bucket domain
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
      console.log("User profile updated with display name:", displayName); // Added log
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

// Save user data to Firestore - Simplified version
export const saveUserData = async (userData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found");

    // Data should already be prepared by 'prepareDataForFirebase' in UserOnboarding.jsx
    const dataToSave = { ...userData }; // Use the already prepared data

    // Add/update timestamp
    dataToSave.updatedAt = new Date().toISOString();

    // Use merge: true to avoid overwriting fields unintentionally if needed,
    // or set merge: false / remove it if you intend to replace the entire document.
    await setDoc(doc(db, "users", user.uid), dataToSave, { merge: true });
    console.log("User data saved successfully for user:", user.uid);
    return true;
  } catch (error) {
    // Log the data that failed to save for easier debugging
    console.error("Error saving user data in firebase.jsx:", error);
    console.error("Data that failed:", JSON.stringify(userData, null, 2)); // Stringify for better readability
    throw error; // Re-throw the error to be caught by handleSubmit
  }
};


// Get user data from Firestore
// Get user data from Firestore with improved boundary parsing
export const getUserData = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found");

    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      const fetchedData = docSnap.data();
      
      // --- IMPORTANT: Parse farmBoundary if it exists ---
      if (fetchedData && typeof fetchedData.farmBoundary === 'string' && fetchedData.farmBoundary.trim() !== '') {
        try {
          const parsedBoundary = JSON.parse(fetchedData.farmBoundary);
          
          // Validate that it's a proper GeoJSON Feature
          if (parsedBoundary && 
              parsedBoundary.type === 'Feature' && 
              parsedBoundary.geometry && 
              parsedBoundary.geometry.coordinates) {
            
            fetchedData.farmBoundary = parsedBoundary;
            console.log("Successfully parsed farmBoundary from Firestore string.");
          } else {
            console.warn("Parsed farmBoundary is not a valid GeoJSON Feature:", parsedBoundary);
            fetchedData.farmBoundary = null;
          }
        } catch (e) {
          console.error("Error parsing farmBoundary JSON from Firestore:", e);
          fetchedData.farmBoundary = null; // Handle invalid JSON
        }
      } else if (fetchedData && fetchedData.farmBoundary === '') {
        // Handle empty string boundary (could happen with old data)
        console.warn("farmBoundary exists but is an empty string. Setting to null.");
        fetchedData.farmBoundary = null;
      }
      // --- End Parsing Logic ---
      
      // Convert Firestore map objects back to arrays for UI display
      const mapKeysToConvert = ['waterSources', 'cropTypes', 'learningGoals', 'trackingGoals', 'currentCrops'];
      mapKeysToConvert.forEach(key => {
        if (fetchedData[key] && typeof fetchedData[key] === 'object' && !Array.isArray(fetchedData[key])) {
          // Convert map back to array
          const array = [];
          const map = fetchedData[key];
          
          // Sort by index to maintain original order
          const sortedKeys = Object.keys(map)
            .filter(k => k.startsWith('item_'))
            .sort((a, b) => {
              const indexA = parseInt(a.split('_')[1]);
              const indexB = parseInt(b.split('_')[1]);
              return indexA - indexB;
            });
            
          sortedKeys.forEach(k => {
            array.push(map[k]);
          });
          
          fetchedData[key] = array;
          console.log(`Converted map '${key}' back to array:`, array);
        } else if (!fetchedData[key]) {
          // Handle missing keys - initialize as empty array for consistency
          fetchedData[key] = [];
        }
      });
      
      return fetchedData;
    } else {
      console.log("No user document found for:", user.uid);
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