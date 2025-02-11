// Import statements (including updateDoc) remain the same:
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  setDoc  
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

// Global variable to store grouped expenses
let currentGroupedExpenses = {};

// --------------------
// 1) LOGIN/LOGOUT (unchanged)
// --------------------
function loginWithGoogle() {

  showSpinner();
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log("Logged in as:", user.email);

      if (user.email === "dariusz.jendryczka@gmail.com") {
        document.getElementById("app-container").style.display = "block";
        document.getElementById("login-container").style.display = "none";
        loadExpenses(); // Load existing expenses
        loadIncomes(); // Load existing incomes
      } else {
        alert("You do not have access to this application.");
        auth.signOut();
      }
    })
    .catch((error) => {
      console.error("Error during login:", error.message);
    })
    .finally(() => {
      hideSpinner(); // <-- Hide spinner regardless of success or error
    });
}

document.getElementById("google-login-button")
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
// 2) HAMBURGER MENU (unchanged)
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

    // Reload expenses
    loadExpenses();
  } catch (err) {
    console.error("Error adding expense:", err);
  }
});

// --------------------
// 4) LOAD & GROUP EXPENSES 
// --------------------
async function loadExpenses() {
  showSpinner();
  const user = auth.currentUser;
  if (!user) return;

  const expensesRef = collection(db, "users", user.uid, "expenses");
  try {
    const snapshot = await getDocs(expensesRef);
    const expenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Group expenses by month (unchanged)
    const grouped = groupByMonth(expenses);
    // Store grouped data in a global variable
    currentGroupedExpenses = grouped;
    // Populate the month selector dropdown
    populateMonthSelector(grouped);
    // Render expenses for the selected month (see below)
    renderGroupedExpenses(grouped);
  } catch (error) {
    console.error("Error loading expenses:", error);
  } finally {
    hideSpinner(); // <-- Hide spinner regardless of success or error
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
// 6) POPULATE THE MONTH SELECTOR
// --------------------
function populateMonthSelector(grouped) {
  const monthSelector = document.getElementById("month-selector");
  if (!monthSelector) return;

  // Preserve the previously selected month (if any)
  const previousSelected = monthSelector.value;

  // Clear the selector
  monthSelector.innerHTML = "";

  // Get the available months and sort them (latest first)
  const monthKeys = Object.keys(grouped).sort().reverse();
  monthKeys.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    monthSelector.appendChild(option);
  });

  // Reapply the previous selection if it still exists
  if (previousSelected && monthKeys.includes(previousSelected)) {
    monthSelector.value = previousSelected;
  } else if (monthKeys.length > 0) {
    // If there's no previous selection or it's not available anymore,
    // fall back to the current month if available
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (monthKeys.includes(currentMonth)) {
      monthSelector.value = currentMonth;
    } else {
      // Otherwise, select the first available month
      monthSelector.selectedIndex = 0;
    }
  }
}


// --------------------
// 7) RENDER GROUPED EXPENSES (modified to render only selected month)
// --------------------
function renderGroupedExpenses(grouped) {
  const container = document.getElementById("grouped-expense-list");
  container.innerHTML = "";

  const monthSelector = document.getElementById("month-selector");
  const selectedMonth = monthSelector ? monthSelector.value : null;

  if (selectedMonth && grouped[selectedMonth]) {
    const monthlyExpenses = grouped[selectedMonth];
    const monthlyTotal = monthlyExpenses.reduce((acc, exp) => acc + exp.amount, 0);

    // Create a wrapper for the month group
    const monthDiv = document.createElement("div");
    monthDiv.classList.add("mb-4");

    // Heading for the month and total
    const heading = document.createElement("h2");
    heading.textContent = `Month: ${selectedMonth} | Total: ${monthlyTotal}`;
    monthDiv.appendChild(heading);

    // Create a table for the expenses
    const table = document.createElement("table");
    table.classList.add("table", "table-striped");

    // Table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = ["Description", "Amount", "Paid", "Actions"];
    headers.forEach(headerText => {
      const th = document.createElement("th");
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body with expense rows
    const tbody = document.createElement("tbody");
    monthlyExpenses.forEach(expense => {
      const tr = document.createElement("tr");

      // Description cell
      const descTd = document.createElement("td");
      descTd.textContent = expense.description;
      tr.appendChild(descTd);

      // Amount cell
      const amountTd = document.createElement("td");
      amountTd.textContent = expense.amount;
      tr.appendChild(amountTd);

      // Paid cell with a checkbox
      const paidTd = document.createElement("td");
      const paidCheckbox = document.createElement("input");
      paidCheckbox.type = "checkbox";
      paidCheckbox.checked = expense.paid === true;
      paidCheckbox.addEventListener("change", () => {
        togglePaid(expense.id, paidCheckbox.checked);
      });
      paidTd.appendChild(paidCheckbox);
      tr.appendChild(paidTd);

      // Actions cell with a delete button
      const actionsTd = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add("btn", "btn-danger", "btn-sm");
      deleteBtn.addEventListener("click", () => {
        deleteExpense(expense.id);
      });
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Append table to the month wrapper and then to the container
    monthDiv.appendChild(table);
    container.appendChild(monthDiv);
  } else {
    container.textContent = "No expenses found for the selected month.";
  }
}

// --------------------
// 8) RE-RENDER WHEN THE USER CHANGES THE SELECTED MONTH
// --------------------
const monthSelectorElement = document.getElementById("month-selector");
if (monthSelectorElement) {
  monthSelectorElement.addEventListener("change", () => {
    renderGroupedExpenses(currentGroupedExpenses);
  });
}

// --------------------
// 9) TOGGLE PAID (unchanged)
// --------------------
async function togglePaid(expenseId, newValue) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const ref = doc(db, "users", user.uid, "expenses", expenseId);
    // Using setDoc with merge: true to update just the 'paid' field.
    await setDoc(ref, { paid: newValue }, { merge: true });
    console.log(`Expense ${expenseId} updated to paid=${newValue}`);

    // Refresh expenses
    loadExpenses();
  } catch (err) {
    console.error("Error updating 'paid' field:", err);
  }
}

// --------------------
// 10) DELETE EXPENSE (unchanged)
// --------------------
async function deleteIncome(incomeId) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const ref = doc(db, "users", user.uid, "incomes", incomeId);
    await deleteDoc(ref);
    console.log("Deleted income with ID:", incomeId);
    loadIncomes(); // Reload incomes after deletion
  } catch (error) {
    console.error("Error deleting income:", error);
  }
}


// Add Income Functionality
document.getElementById("income-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Get values from the income form
  const amount = parseFloat(document.getElementById("income-amount").value);
  const description = document.getElementById("income-description").value;

  // Ensure the user is logged in
  const user = auth.currentUser;
  if (!user) return;

  // Reference the "incomes" collection for the current user
  const incomesRef = collection(db, "users", user.uid, "incomes");

  try {
    // Create a new income document
    const docRef = await addDoc(incomesRef, {
      amount,
      description,
      createdAt: new Date()
    });
    console.log("Income added with ID:", docRef.id);

    // Clear the income form
    document.getElementById("income-amount").value = "";
    document.getElementById("income-description").value = "";

    // Optionally, you can call a function to reload or display incomes
    loadIncomes();
  } catch (err) {
    console.error("Error adding income:", err);
  }
});


async function loadIncomes() {
  showSpinner();
  const user = auth.currentUser;
  if (!user) return;

  const incomesRef = collection(db, "users", user.uid, "incomes");
  try {
    const snapshot = await getDocs(incomesRef);
    const incomes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Group incomes by month
    const grouped = groupIncomesByMonth(incomes);
    renderGroupedIncomes(grouped);
  } catch (error) {
    console.error("Error loading incomes:", error);
  } finally {
    hideSpinner(); // <-- Hide spinner regardless of success or error
  }
}


function groupIncomesByMonth(incomes) {
  const grouped = {};

  incomes.forEach((income) => {
    let dateObj = income.createdAt;
    if (dateObj?.toDate) {
      dateObj = dateObj.toDate();
    }
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(income);
  });

  return grouped;
}

function renderGroupedIncomes(grouped) {
  const container = document.getElementById("income-list");
  container.innerHTML = "";

  const monthSelector = document.getElementById("month-selector");
  const selectedMonth = monthSelector ? monthSelector.value : null;

  if (selectedMonth && grouped[selectedMonth]) {
    const monthlyIncomes = grouped[selectedMonth];
    const monthlyTotal = monthlyIncomes.reduce((acc, inc) => acc + inc.amount, 0);

    const monthDiv = document.createElement("div");
    monthDiv.classList.add("mb-4");

    const heading = document.createElement("h2");
    heading.textContent = `Month: ${selectedMonth} | Total: ${monthlyTotal}`;
    monthDiv.appendChild(heading);

    const table = document.createElement("table");
    table.classList.add("table", "table-striped");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = ["Description", "Amount", "Actions"];
    headers.forEach(headerText => {
      const th = document.createElement("th");
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    monthlyIncomes.forEach(income => {
      const tr = document.createElement("tr");

      const descTd = document.createElement("td");
      descTd.textContent = income.description;
      tr.appendChild(descTd);

      const amountTd = document.createElement("td");
      amountTd.textContent = income.amount;
      tr.appendChild(amountTd);

      const actionsTd = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add("btn", "btn-danger", "btn-sm");
      deleteBtn.addEventListener("click", () => {
        deleteIncome(income.id);
      });
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    monthDiv.appendChild(table);
    container.appendChild(monthDiv);
  } else {
    container.textContent = "No incomes found for the selected month.";
  }
}

function showSpinner() {
  const spinnerOverlay = document.getElementById("spinner-overlay");
  if (spinnerOverlay) {
    spinnerOverlay.style.display = "flex"; 
  }
}

function hideSpinner() {
  const spinnerOverlay = document.getElementById("spinner-overlay");
  if (spinnerOverlay) {
    spinnerOverlay.style.display = "none"; 
  }
}


document.getElementById("month-selector").addEventListener("change", () => {
  renderGroupedExpenses(currentGroupedExpenses);
  loadIncomes(); // Now refresh incomes as well!
});