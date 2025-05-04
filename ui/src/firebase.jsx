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
// Save user data to Firestore - Enhanced with better error handling and logging
export const saveUserData = async (userData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found");

    // Make a deep copy to avoid mutation issues
    const dataToSave = JSON.parse(JSON.stringify(userData));
    
    // Add/update timestamp
    dataToSave.updatedAt = new Date().toISOString();
    
    // Debug log of boundary data before saving
    if (dataToSave.farmBoundary) {
      console.log("Saving farmBoundary to Firestore:", 
        typeof dataToSave.farmBoundary === 'string' 
          ? dataToSave.farmBoundary.substring(0, 50) + '...' 
          : 'Object (will be stringified)');
    }

    // Make absolutely sure farmBoundary is a string before saving
    if (dataToSave.farmBoundary && typeof dataToSave.farmBoundary !== 'string') {
      try {
        dataToSave.farmBoundary = JSON.stringify(dataToSave.farmBoundary);
      } catch (stringifyError) {
        console.error("Error stringifying farmBoundary:", stringifyError);
        // Remove problematic field rather than failing the entire save
        delete dataToSave.farmBoundary;
      }
    }

    // Save to Firestore with merge to preserve any fields not included in this update
    await setDoc(doc(db, "users", user.uid), dataToSave, { merge: true });
    console.log("User data saved successfully for user:", user.uid);
    
    return true;
  } catch (error) {
    // Enhanced error logging
    console.error("Error saving user data in firebase.jsx:", error);
    if (userData && userData.farmBoundary) {
      console.error("farmBoundary type:", typeof userData.farmBoundary);
      if (typeof userData.farmBoundary === 'object') {
        console.error("farmBoundary structure:", JSON.stringify({
          type: userData.farmBoundary.type,
          hasGeometry: !!userData.farmBoundary.geometry,
          hasCoordinates: !!(userData.farmBoundary.geometry && userData.farmBoundary.geometry.coordinates)
        }));
      }
    }
    throw error; // Re-throw the error to be caught by handleSubmit
  }
};


// Get user data from Firestore
// Get user data from Firestore with improved boundary parsing
// Get user data from Firestore with robust boundary parsing
// Get user data from Firestore with robust boundary parsing
export const getUserData = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found");
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      const fetchedData = docSnap.data();
      
      // --- Enhanced farmBoundary parsing logic ---
      if (fetchedData && typeof fetchedData.farmBoundary === 'string') {
        if (fetchedData.farmBoundary.trim() !== '') {
          try {
            console.log("Attempting to parse farmBoundary string from Firestore");
            const parsedBoundary = JSON.parse(fetchedData.farmBoundary);
            
            // Validate that it's a proper GeoJSON Feature
            if (parsedBoundary && 
                parsedBoundary.type === 'Feature' && 
                parsedBoundary.geometry && 
                parsedBoundary.geometry.coordinates) {
              
              fetchedData.farmBoundary = parsedBoundary;
              console.log("Successfully parsed farmBoundary from Firestore");
            } else {
              console.warn("Parsed farmBoundary is not a valid GeoJSON Feature:", 
                          JSON.stringify(parsedBoundary).substring(0, 200));
              fetchedData.farmBoundary = null;
            }
          } catch (e) {
            console.error("Error parsing farmBoundary JSON from Firestore:", e);
            console.error("Invalid JSON sample:", 
                        fetchedData.farmBoundary.substring(0, 100));
            fetchedData.farmBoundary = null; // Handle invalid JSON
          }
        } else {
          // Handle empty string boundary
          console.warn("farmBoundary exists but is an empty string. Setting to null.");
          fetchedData.farmBoundary = null;
        }
      } else if (fetchedData && fetchedData.farmBoundary === null) {
        // Keep null as null
        console.log("farmBoundary is explicitly null in Firestore");
      } else if (fetchedData && fetchedData.farmBoundary !== undefined) {
        // Handle unexpected type
        console.warn("farmBoundary exists in Firestore but is not a string:", 
                    typeof fetchedData.farmBoundary);
        fetchedData.farmBoundary = null;
      }
      // --- End farmBoundary parsing logic ---
      
      // Convert Firestore map objects back to arrays for UI display
      const mapKeysToConvert = ['waterSources', 'cropTypes', 'learningGoals', 
                               'trackingGoals', 'currentCrops', 'mainInterests'];
      mapKeysToConvert.forEach(key => {
        if (fetchedData[key] && typeof fetchedData[key] === 'object' && 
            !Array.isArray(fetchedData[key])) {
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
          console.log(`Converted map '${key}' back to array with ${array.length} items`);
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
    throw error;  // Re-throw the error so calling function can handle it
  }
};
// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export { auth, db };