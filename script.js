/* ------------------------------------
   0) FIREBASE IMPORTS & CONFIG
------------------------------------ */
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

// Your Firebase config object
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

/***********************************************************
  1) GLOBALS & REFS
************************************************************/
let currentGroupedExpenses = {}; // For storing grouped expenses
let editingExpenseId = null;
let editingIncomeId = null;
let balanceChart = null; // Global Chart instance

// Grab references to the two modals
const editExpenseModalEl = document.getElementById("editExpenseModal");
const editIncomeModalEl = document.getElementById("editIncomeModal");

// Turn them into Bootstrap modal instances
const editExpenseModal = new bootstrap.Modal(editExpenseModalEl);
const editIncomeModal = new bootstrap.Modal(editIncomeModalEl);

/***********************************************************
  Helper Function: Get Current Month
  Returns a string in the format "YYYY-MM" (e.g., "2025-02")
************************************************************/
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/***********************************************************
  2) LOGIN / LOGOUT
************************************************************/
function loginWithGoogle() {
  showSpinner();
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log("Logged in as:", user.email);

      // Restrict access to a certain user
      if (user.email === "dariusz.jendryczka@gmail.com") {
        document.getElementById("app-container").style.display = "block";
        document.getElementById("login-container").style.display = "none";

        // Load data
        loadExpenses();
        loadIncomes();
        loadBalanceChart();
      } else {
        alert("You do not have access to this application.");
        auth.signOut();
      }
    })
    .catch((error) => {
      console.error("Error during login:", error.message);
    })
    .finally(() => hideSpinner());
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

/***********************************************************
  3) HAMBURGER MENU
************************************************************/
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

/***********************************************************
  4) ADD EXPENSE
************************************************************/
document
  .getElementById("expense-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("amount").value);
    const description = document.getElementById("description").value;

    const user = auth.currentUser;
    if (!user) return;

    try {
      const ref = collection(db, "users", user.uid, "expenses");
      await addDoc(ref, {
        amount,
        description,
        createdAt: new Date(),
        paid: false
      });
      console.log("Expense added!");
      // Clear form
      document.getElementById("amount").value = "";
      document.getElementById("description").value = "";
      // Reload
      loadExpenses();
    } catch (err) {
      console.error("Error adding expense:", err);
    }
  });

/***********************************************************
  5) LOAD & GROUP EXPENSES
************************************************************/
async function loadExpenses() {
  showSpinner();
  const user = auth.currentUser;
  if (!user) return;

  try {
    const expensesRef = collection(db, "users", user.uid, "expenses");
    const snapshot = await getDocs(expensesRef);
    const expenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const grouped = groupExpensesByMonth(expenses);
    currentGroupedExpenses = grouped;
    populateMonthSelector(grouped);
    renderGroupedExpenses(grouped);
  } catch (error) {
    console.error("Error loading expenses:", error);
  } finally {
    hideSpinner();
  }
}

function groupExpensesByMonth(expenses) {
  const grouped = {};
  expenses.forEach((exp) => {
    let dateObj = exp.createdAt;
    if (dateObj?.toDate) {
      dateObj = dateObj.toDate();
    }
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(exp);
  });
  return grouped;
}

/***********************************************************
  6) MONTH SELECTOR
************************************************************/
function populateMonthSelector(grouped) {
  const monthSelector = document.getElementById("month-selector");
  if (!monthSelector) return;

  const currentMonth = getCurrentMonth();
  // Create a set of months from the grouped data and include the current month
  const monthsSet = new Set(Object.keys(grouped));
  monthsSet.add(currentMonth);

  // Convert to array and sort (descending so that the latest months appear first)
  const months = Array.from(monthsSet).sort().reverse();

  // Clear any existing options and populate new ones
  monthSelector.innerHTML = "";
  months.forEach((m) => {
    const option = document.createElement("option");
    option.value = m;
    option.textContent = m;
    monthSelector.appendChild(option);
  });

  // Set the default selection to the current month
  monthSelector.value = currentMonth;
}

const monthSelectorEl = document.getElementById("month-selector");
if (monthSelectorEl) {
  monthSelectorEl.addEventListener("change", () => {
    renderGroupedExpenses(currentGroupedExpenses);
    loadIncomes(); // refresh incomes too
    loadBalanceChart(); // refresh balance chart for the selected month
  });
}

/***********************************************************
  7) RENDER EXPENSES (with a btn-group for Edit/Delete)
************************************************************/
function renderGroupedExpenses(grouped) {
  const container = document.getElementById("grouped-expense-list");
  container.innerHTML = "";

  const selectedMonth = document.getElementById("month-selector")?.value;
  if (!selectedMonth || !grouped[selectedMonth]) {
    container.textContent = "No expenses found for the selected month.";
    return;
  }

  const monthlyExpenses = grouped[selectedMonth];
  const monthlyTotal = monthlyExpenses.reduce((acc, ex) => acc + ex.amount, 0);

  const monthDiv = document.createElement("div");
  monthDiv.classList.add("mb-4");

  const heading = document.createElement("h2");
  heading.textContent = `Month: ${selectedMonth} | Total: ${monthlyTotal}`;
  monthDiv.appendChild(heading);

  const table = document.createElement("table");
  table.classList.add("table", "table-striped");

  // Table header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Description", "Amount", "Paid", "Actions"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Table body
  const tbody = document.createElement("tbody");
  monthlyExpenses.forEach((expense) => {
    const tr = document.createElement("tr");

    // Description
    const descTd = document.createElement("td");
    descTd.textContent = expense.description;
    tr.appendChild(descTd);

    // Amount
    const amountTd = document.createElement("td");
    amountTd.textContent = expense.amount;
    tr.appendChild(amountTd);

    // Paid?
    const paidTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!expense.paid;
    checkbox.addEventListener("change", () => {
      togglePaid(expense.id, checkbox.checked);
    });
    paidTd.appendChild(checkbox);
    tr.appendChild(paidTd);

    // Actions
    const actionsTd = document.createElement("td");
    // Create a .btn-group container to keep Edit/Delete side by side
    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("btn-group", "btn-group-sm"); // small horizontal group

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.classList.add("btn", "btn-warning");
    editBtn.addEventListener("click", () => openEditExpenseModal(expense));
    buttonGroup.appendChild(editBtn);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.classList.add("btn", "btn-danger");
    delBtn.addEventListener("click", () => deleteExpense(expense.id));
    buttonGroup.appendChild(delBtn);

    // Put the group in the Actions cell
    actionsTd.appendChild(buttonGroup);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  monthDiv.appendChild(table);
  container.appendChild(monthDiv);
}

/***********************************************************
  8) TOGGLE PAID
************************************************************/
async function togglePaid(expenseId, newValue) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const ref = doc(db, "users", user.uid, "expenses", expenseId);
    await setDoc(ref, { paid: newValue }, { merge: true });
    loadExpenses();
  } catch (err) {
    console.error("Error updating 'paid' field:", err);
  }
}

/***********************************************************
  9) DELETE EXPENSE
************************************************************/
async function deleteExpense(expenseId) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const ref = doc(db, "users", user.uid, "expenses", expenseId);
    await deleteDoc(ref);
    loadExpenses();
  } catch (error) {
    console.error("Error deleting expense:", error);
  }
}

/***********************************************************
  10) OPEN EDIT EXPENSE MODAL
************************************************************/
function openEditExpenseModal(expense) {
  editingExpenseId = expense.id;

  // Populate the fields in the modal
  document.getElementById("edit-amount").value = expense.amount;
  document.getElementById("edit-description").value = expense.description;

  // Show the Bootstrap modal
  editExpenseModal.show();
}

/***********************************************************
  11) SAVE CHANGES TO EXPENSE
************************************************************/
document
  .getElementById("edit-expense-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingExpenseId) return;

    const user = auth.currentUser;
    if (!user) return;

    const newAmount = parseFloat(document.getElementById("edit-amount").value);
    const newDescription = document.getElementById("edit-description").value;

    const expenseRef = doc(db, "users", user.uid, "expenses", editingExpenseId);
    try {
      await updateDoc(expenseRef, {
        amount: newAmount,
        description: newDescription
      });
      console.log("Expense updated!");
      // Hide modal
      editExpenseModal.hide();
      editingExpenseId = null;
      // Reload
      loadExpenses();
    } catch (error) {
      console.error("Error updating expense:", error);
    }
  });

/***********************************************************
  12) ADD INCOME
************************************************************/
document
  .getElementById("income-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("income-amount").value);
    const description = document.getElementById("income-description").value;

    const user = auth.currentUser;
    if (!user) return;

    try {
      const incomesRef = collection(db, "users", user.uid, "incomes");
      await addDoc(incomesRef, {
        amount,
        description,
        createdAt: new Date()
      });
      console.log("Income added!");
      // Clear
      document.getElementById("income-amount").value = "";
      document.getElementById("income-description").value = "";
      // Reload
      loadIncomes();
    } catch (err) {
      console.error("Error adding income:", err);
    }
  });

/***********************************************************
  13) LOAD & RENDER INCOMES (with btn-group as well)
************************************************************/
async function loadIncomes() {
  showSpinner();
  const user = auth.currentUser;
  if (!user) return;

  try {
    const incomesRef = collection(db, "users", user.uid, "incomes");
    const snapshot = await getDocs(incomesRef);
    const incomes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    const grouped = groupIncomesByMonth(incomes);
    renderGroupedIncomes(grouped);
  } catch (error) {
    console.error("Error loading incomes:", error);
  } finally {
    hideSpinner();
  }
}

function groupIncomesByMonth(incomes) {
  const grouped = {};
  incomes.forEach((inc) => {
    let dateObj = inc.createdAt;
    if (dateObj?.toDate) dateObj = dateObj.toDate();
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(inc);
  });
  return grouped;
}

function renderGroupedIncomes(grouped) {
  const container = document.getElementById("income-list");
  container.innerHTML = "";

  const selectedMonth = document.getElementById("month-selector")?.value;
  if (!selectedMonth || !grouped[selectedMonth]) {
    container.textContent = "No incomes found for the selected month.";
    return;
  }

  const monthlyIncomes = grouped[selectedMonth];
  const monthlyTotal = monthlyIncomes.reduce((acc, i) => acc + i.amount, 0);

  const monthDiv = document.createElement("div");
  monthDiv.classList.add("mb-4");

  const heading = document.createElement("h2");
  heading.textContent = `Month: ${selectedMonth} | Total: ${monthlyTotal}`;
  monthDiv.appendChild(heading);

  const table = document.createElement("table");
  table.classList.add("table", "table-striped");

  // Thead
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Description", "Amount", "Actions"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement("tbody");
  monthlyIncomes.forEach((income) => {
    const tr = document.createElement("tr");

    // Description
    const descTd = document.createElement("td");
    descTd.textContent = income.description;
    tr.appendChild(descTd);

    // Amount
    const amountTd = document.createElement("td");
    amountTd.textContent = income.amount;
    tr.appendChild(amountTd);

    // Actions (Edit + Delete)
    const actionsTd = document.createElement("td");

    // Create a .btn-group for Income as well
    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("btn-group", "btn-group-sm");

    // Edit
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.classList.add("btn", "btn-warning");
    editBtn.addEventListener("click", () => openEditIncomeModal(income));
    buttonGroup.appendChild(editBtn);

    // Delete
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.classList.add("btn", "btn-danger");
    delBtn.addEventListener("click", () => deleteIncome(income.id));
    buttonGroup.appendChild(delBtn);

    actionsTd.appendChild(buttonGroup);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  monthDiv.appendChild(table);
  container.appendChild(monthDiv);
}

/***********************************************************
  14) EDIT INCOME MODAL
************************************************************/
function openEditIncomeModal(income) {
  editingIncomeId = income.id;
  document.getElementById("edit-income-amount").value = income.amount;
  document.getElementById("edit-income-description").value = income.description;

  editIncomeModal.show();
}

document
  .getElementById("edit-income-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingIncomeId) return;

    const user = auth.currentUser;
    if (!user) return;

    const newAmount = parseFloat(
      document.getElementById("edit-income-amount").value
    );
    const newDesc = document.getElementById("edit-income-description").value;

    const incomeRef = doc(db, "users", user.uid, "incomes", editingIncomeId);
    try {
      await updateDoc(incomeRef, {
        amount: newAmount,
        description: newDesc
      });
      console.log("Income updated!");
      editIncomeModal.hide();
      editingIncomeId = null;
      loadIncomes();
    } catch (error) {
      console.error("Error updating income:", error);
    }
  });

/***********************************************************
  15) DELETE INCOME
************************************************************/
async function deleteIncome(incomeId) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const ref = doc(db, "users", user.uid, "incomes", incomeId);
    await deleteDoc(ref);
    loadIncomes();
  } catch (error) {
    console.error("Error deleting income:", error);
  }
}

/***********************************************************
  16) SPINNER UTILS
************************************************************/
function showSpinner() {
  const overlay = document.getElementById("spinner-overlay");
  if (overlay) overlay.style.display = "flex";
}
function hideSpinner() {
  const overlay = document.getElementById("spinner-overlay");
  if (overlay) overlay.style.display = "none";
}

/***********************************************************
  17) LOAD BALANCE CHART
************************************************************/
async function loadBalanceChart() {
  const user = auth.currentUser;
  if (!user) return;

  const monthSelector = document.getElementById("month-selector");
  const selectedMonth =
    monthSelector && monthSelector.value ? monthSelector.value : getCurrentMonth();
  console.log("📅 Selected Month:", selectedMonth);

  const incomesRef = collection(db, "users", user.uid, "incomes");
  const expensesRef = collection(db, "users", user.uid, "expenses");

  try {
      const incomeSnapshot = await getDocs(incomesRef);
      const expenseSnapshot = await getDocs(expensesRef);

      // Filter incomes & expenses to include only selected month
      const totalIncome = incomeSnapshot.docs
          .filter(doc => isSameMonth(doc.data().createdAt, selectedMonth))
          .reduce((sum, doc) => sum + doc.data().amount, 0);

      const totalExpenses = expenseSnapshot.docs
          .filter(doc => isSameMonth(doc.data().createdAt, selectedMonth))
          .reduce((sum, doc) => sum + doc.data().amount, 0);

      const balance = totalIncome - totalExpenses;

      console.log("💰 Total Income (Filtered):", totalIncome);
      console.log("💸 Total Expenses (Filtered):", totalExpenses);
      console.log("📊 Balance (Filtered):", balance);

      renderBalanceChart(totalIncome, totalExpenses, balance, selectedMonth);
  } catch (error) {
      console.error("⚠️ Error loading balance data:", error);
  }
}

// Helper function to check if a date is in the selected month
function isSameMonth(timestamp, selectedMonth) {
  let dateObj = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}` === selectedMonth;
}

function renderBalanceChart(totalIncome, totalExpenses, balance, selectedMonth) {
  const ctx = document.getElementById("balanceChart").getContext("2d");

  // Destroy previous chart instance if it exists
  if (balanceChart) {
    balanceChart.destroy();
  }

  balanceChart = new Chart(ctx, {
      type: "bar",  // You can change to "pie", "doughnut", "line"
      data: {
          labels: ["Income", "Expenses", "Balance"],
          datasets: [{
              label: `Financial Overview for ${selectedMonth}`,
              data: [totalIncome, totalExpenses, balance],
              backgroundColor: ["#28a745", "#dc3545", "#007bff"], // Green, Red, Blue
          }]
      },
      options: {
          responsive: true,
          plugins: {
              legend: { display: false },
              title: { display: true, text: `Income vs Expenses - ${selectedMonth}` }
          },
          scales: {
              y: { beginAtZero: true }
          }
      }
  });
}

// Call this function after user logs in
document.addEventListener("DOMContentLoaded", () => {
  loadBalanceChart();
});

console.log("Chart.js version:", Chart.version);
