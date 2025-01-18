import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAjBxTwbQ3ooz-9KQr0feQwKI_rnzdQfNI",
    authDomain: "dpds-21cbd.firebaseapp.com",
    projectId: "dpds-21cbd",
    storageBucket: "dpds-21cbd.firebasestorage.app",
    messagingSenderId: "54458072155",
    appId: "1:54458072155:web:90a242808b98b11df9137e",
    measurementId: "G-2ZGD8DP1XS"
  };

  const app = initializeApp(firebaseConfig);

const auth = getAuth();
const provider = new GoogleAuthProvider();

function loginWithGoogle() {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log("Logged in as:", user.email);
     
      if (user.email == "dariusz.jendryczka@gmail.com") {
        
       
        document.getElementById("app-container").style.display = "block";
        document.getElementById("login-container").style.display = "none";
      } else {
        alert("You do not have access to this application.");
        auth.signOut();
      }
    })
    .catch((error) => {
      console.error("Error during login:", error.message);
    });
}

document.getElementById("logout-button").addEventListener("click", () => {
    signOut(auth)
      .then(() => {
        console.log("User signed out");
      
        document.getElementById("app-container").style.display = "none";
        document.getElementById("login-container").style.display = "flex";
      })
      .catch((error) => {
        console.error("Error during logout:", error.message);
      });
  });

document.getElementById("google-login-button").addEventListener("click", loginWithGoogle);

const hamburgerMenu = document.querySelector('.hamburger-menu');
const navMenu       = document.querySelector('.nav-menu');

  // 1) Hamburger menu toggle
  hamburgerMenu.addEventListener('click', () => {
    hamburgerMenu.classList.toggle('active');
    navMenu.classList.toggle('show');
  });
  navMenu.addEventListener('click', () => {
    hamburgerMenu.classList.remove('active');
    navMenu.classList.remove('show');
  });
