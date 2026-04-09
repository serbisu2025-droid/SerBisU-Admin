import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBTnQMZTQ5lw0ZQmuP7KjmpIzUjMLOLWUU",
    authDomain: "serbisu-d3fef.firebaseapp.com",
    projectId: "serbisu-d3fef",
    storageBucket: "serbisu-d3fef.firebasestorage.app",
    messagingSenderId: "795888443068",
    appId: "1:795888443068:web:a71c62e314ff04857e7ab9"
};

import { getStorage } from "firebase/storage";

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, app };
