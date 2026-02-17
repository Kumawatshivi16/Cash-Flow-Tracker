document.addEventListener("DOMContentLoaded", function () {

const form = document.getElementById("transactionForm");
const transactionList = document.getElementById("transactionList");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const netBalanceEl = document.getElementById("netBalance");
const exportBtn = document.getElementById("exportBtn");
const accountFilter = document.getElementById("accountFilter");

let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

function saveTransactions() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

function formatCurrency(amount) {
    return "₹ " + amount.toLocaleString("en-IN");
}

function renderTransactions() {
    transactionList.innerHTML = "";

    let totalIncome = 0;
    let totalExpense = 0;

    const selectedAccount = accountFilter.value;

    const filteredTransactions = selectedAccount === "All"
        ? transactions
        : transactions.filter(t => t.account === selectedAccount);

    filteredTransactions.forEach((transaction, index) => {

        const li = document.createElement("li");
        li.classList.add("transaction-item");

        const isIncomeType =
            transaction.type === "Income" || transaction.type === "Sale";

        if (isIncomeType) {
            totalIncome += transaction.amount;
        } else {
            totalExpense += transaction.amount;
        }

        li.innerHTML = `
            <div class="transaction-info">
                <span><strong>${transaction.account}</strong> | ${transaction.type} - ${transaction.notes || "No notes"}</span>
                <small>${transaction.date}</small>
            </div>
            <div>
                <span class="transaction-amount">
                    ${isIncomeType ? "+" : "-"}${formatCurrency(transaction.amount)}
                </span>
                <button class="delete-btn" onclick="deleteTransaction(${transactions.indexOf(transaction)})">
                    Delete
                </button>
            </div>
        `;

        transactionList.appendChild(li);
    });

    const netBalance = totalIncome - totalExpense;

    totalIncomeEl.textContent = formatCurrency(totalIncome);
    totalExpenseEl.textContent = formatCurrency(totalExpense);
    netBalanceEl.textContent = formatCurrency(netBalance);

    if (netBalance < 0) {
        netBalanceEl.classList.add("negative");
        netBalanceEl.classList.remove("positive");
    } else {
        netBalanceEl.classList.add("positive");
        netBalanceEl.classList.remove("negative");
    }
}

form.addEventListener("submit", function (e) {
    e.preventDefault();

    const account = document.getElementById("account").value;
    const type = document.getElementById("type").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const date = document.getElementById("date").value;
    const notes = document.getElementById("notes").value;

    if (!account || !type || !amount || amount <= 0) {
        alert("Please fill all required fields correctly.");
        return;
    }

    const transaction = { account, type, amount, date, notes };

    transactions.push(transaction);
    saveTransactions();
    renderTransactions();
    form.reset();
});

window.deleteTransaction = function(index) {
    if (confirm("Are you sure you want to delete this transaction?")) {
        transactions.splice(index, 1);
        saveTransactions();
        renderTransactions();
    }
};

accountFilter.addEventListener("change", renderTransactions);

// Export to CSV
exportBtn.addEventListener("click", function () {

    if (transactions.length === 0) {
        alert("No transactions to export.");
        return;
    }

    let csvContent = "Account,Date,Type,Amount,Notes\n";

    transactions.forEach(transaction => {
        csvContent += `${transaction.account},${transaction.date},${transaction.type},${transaction.amount},"${transaction.notes || ""}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "cash-flow-data.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

renderTransactions();

});
