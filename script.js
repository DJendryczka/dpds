import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAjBxTwbQ3ooz-9KQr0feQwKI_rnzdQfNI",
  authDomain: "dpds-21cbd.firebaseapp.com",
  projectId: "dpds-21cbd",
  storageBucket: "dpds-21cbd.firebasestorage.app",
  messagingSenderId: "54458072155",
  appId: "1:54458072155:web:90a242808b98b11df9137e",
  measurementId: "G-2ZGD8DP1XS",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --------------------
// 1) LOGIN/LOGOUT
// --------------------
function loginWithGoogle() {
    signInWithPopup(auth, provider)
      .then((result) => {
        const user = result.user;
        console.log("Logged in as:", user.email);
  
        if (user.email === "dariusz.jendryczka@gmail.com") {
          document.getElementById("app-container").style.display = "block";
          document.getElementById("login-container").style.display = "none";
          loadExpenses(); // Load existing expenses
        } else {
          alert("You do not have access to this application.");
          auth.signOut();
        }
      })
      .catch((error) => {
        console.error("Error during login:", error.message);
      });
  }
  
  document
    .getElementById("google-login-button")
    .addEventListener("click", loginWithGoogle);
  
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
  
  // --------------------
  // 2) HAMBURGER MENU
  // --------------------
  const hamburgerMenu = document.querySelector(".hamburger-menu");
  const navMenu = document.querySelector(".nav-menu");
  
  hamburgerMenu.addEventListener("click", () => {
    hamburgerMenu.classList.toggle("active");
    navMenu.classList.toggle("show");
  });
  
  navMenu.addEventListener("click", () => {
    hamburgerMenu.classList.remove("active");
    navMenu.classList.remove("show");
  });
  
  // --------------------
  // 3) ADD EXPENSE
  // --------------------
  document.getElementById("expense-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("amount").value);
    const description = document.getElementById("description").value;
  
    const user = auth.currentUser;
    if (!user) return;
  
    const expensesRef = collection(db, "users", user.uid, "expenses");
    try {
      const docRef = await addDoc(expensesRef, {
        amount,
        description,
        createdAt: new Date(),
        paid: false, // new field
      });
      console.log("Expense added with ID:", docRef.id);
  
      // Clear the form
      document.getElementById("amount").value = "";
      document.getElementById("description").value = "";
  
      // Reload
      loadExpenses();
    } catch (err) {
      console.error("Error adding expense:", err);
    }
  });
  
  // --------------------
  // 4) LOAD & GROUP
  // --------------------
  async function loadExpenses() {
    const user = auth.currentUser;
    if (!user) return;
  
    const expensesRef = collection(db, "users", user.uid, "expenses");
    try {
      const snapshot = await getDocs(expensesRef);
      const expenses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      const grouped = groupByMonth(expenses);
      renderGroupedExpenses(grouped);
    } catch (error) {
      console.error("Error loading expenses:", error);
    }
  }
  
  // --------------------
  // 5) GROUPING LOGIC
  // --------------------
  function groupByMonth(expenses) {
    const grouped = {};
  
    expenses.forEach((expense) => {
      let dateObj = expense.createdAt;
      if (dateObj?.toDate) {
        dateObj = dateObj.toDate();
      }
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${m}`;
  
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(expense);
    });
  
    return grouped;
  }
  
  // --------------------
  // 6) RENDER GROUPED + SUMMARY
  // --------------------
  function renderGroupedExpenses(grouped) {
    const container = document.getElementById("grouped-expense-list");
    container.innerHTML = "";
  
    for (const monthKey in grouped) {
      // 1) Compute the total for this month
      const monthlyExpenses = grouped[monthKey];
      const monthlyTotal = monthlyExpenses.reduce((acc, exp) => acc + exp.amount, 0);
  
      // 2) Heading with month + total
      const heading = document.createElement("h4");
      heading.textContent = `Month: ${monthKey} | Total: ${monthlyTotal}`;
      container.appendChild(heading);
  
      // 3) Build a <ul> of expenses
      const ul = document.createElement("ul");
      monthlyExpenses.forEach((expense) => {
        const li = document.createElement("li");
  
        // Show basic info
        const infoSpan = document.createElement("span");
        infoSpan.textContent = `Amount: ${expense.amount}, Desc: ${expense.description} `;
  
        // "Paid" checkbox
        const paidCheckbox = document.createElement("input");
        paidCheckbox.type = "checkbox";
        paidCheckbox.checked = expense.paid === true;
        paidCheckbox.style.marginLeft = "10px";
        paidCheckbox.addEventListener("change", () => {
          togglePaid(expense.id, paidCheckbox.checked);
        });
  
        // "Delete" button
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.style.marginLeft = "10px";
        deleteBtn.classList.add("btn", "btn-danger", "btn-sm");
        deleteBtn.addEventListener("click", () => {
          deleteExpense(expense.id);
        });
  
        li.appendChild(infoSpan);
        li.appendChild(paidCheckbox);
        li.appendChild(deleteBtn);
        ul.appendChild(li);
      });
  
      container.appendChild(ul);
    }
  }
  
  // --------------------
  // 7) TOGGLE PAID
  // --------------------
  async function togglePaid(expenseId, newValue) {
    const user = auth.currentUser;
    if (!user) return;
  
    try {
      const ref = doc(db, "users", user.uid, "expenses", expenseId);
      await updateDoc(ref, { paid: newValue });
      console.log(`Expense ${expenseId} updated to paid=${newValue}`);
  
      // Refresh
      loadExpenses();
    } catch (err) {
      console.error("Error updating 'paid' field:", err);
    }
  }
  
  // --------------------
  // 8) DELETE
  // --------------------
  async function deleteExpense(expenseId) {
    const user = auth.currentUser;
    if (!user) return;
  
    try {
      const ref = doc(db, "users", user.uid, "expenses", expenseId);
      await deleteDoc(ref);
      console.log("Deleted expense with ID:", expenseId);
      loadExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  }