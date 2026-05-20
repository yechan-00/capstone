import { initializeApp, getApps, FirebaseApp } from "@firebase/app";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { Platform } from "react-native";

function initFirestoreDb(app: FirebaseApp): Firestore {
  if (Platform.OS === "web") {
    try {
      return initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
    } catch {
      return getFirestore(app);
    }
  }
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
}

const firebaseConfig = {
  apiKey: "AIzaSyDI6LwcKowFy0bAagu8UyKZvmyVasTMxfc",
  authDomain: "regret-wallet-3db60.firebaseapp.com",
  projectId: "regret-wallet-3db60",
  storageBucket: "regret-wallet-3db60.firebasestorage.app",
  messagingSenderId: "692126576936",
  appId: "1:692126576936:web:f6fb84c68d37e03b37601d",
  measurementId: "G-RVT5597JJE",
};

let app: FirebaseApp;
let auth: import("@firebase/auth").Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);

  if (Platform.OS === "web") {
    const { getAuth } = require("firebase/auth");
    auth = getAuth(app);
  } else {
    const {
      initializeAuth,
      getReactNativePersistence,
    } = require("@firebase/auth/dist/rn");
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }

  db = initFirestoreDb(app);
  storage = getStorage(app);
} else {
  app = getApps()[0];
  if (Platform.OS === "web") {
    const { getAuth } = require("firebase/auth");
    auth = getAuth(app);
  } else {
    const { getAuth } = require("@firebase/auth/dist/rn");
    auth = getAuth(app);
  }
  db = getFirestore(app);
  storage = getStorage(app);
}

export { auth, db, storage };
export default app;
