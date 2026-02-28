// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyARxAYAWbL_pjjlMDhfqt84QAETnEm8rSI",
  authDomain: "csci614-bfc57.firebaseapp.com",
  projectId: "csci614-bfc57",
  storageBucket: "csci614-bfc57.firebasestorage.app",
  messagingSenderId: "507383390768",
  appId: "1:507383390768:web:dc8ab7f5e44c52132c43f5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const shoppingdata = collection(db, "shoppinglist");
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;