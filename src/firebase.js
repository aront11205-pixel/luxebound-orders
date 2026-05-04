import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBDFGy_CqybHAwZrrPX0HXRkLBEZB5zQms",
  authDomain: "luxebound-orders.firebaseapp.com",
  projectId: "luxebound-orders",
  storageBucket: "luxebound-orders.firebasestorage.app",
  messagingSenderId: "891313099200",
  appId: "1:891313099200:web:26ee2c0be0b82329a24625"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
