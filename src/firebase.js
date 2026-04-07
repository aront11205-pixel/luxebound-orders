import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBDFGy_CqybHAwZrrPX0NXRkLBEZB5zQmw",
  authDomain: "luxebound-orders.firebaseapp.com",
  projectId: "luxebound-orders",
  storageBucket: "luxebound-orders.firebasestorage.app",
  messagingSenderId: "892313099200",
  appId: "1:892313099200:web:26ee2cd0a0b82329a24625"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
