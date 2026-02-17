document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("transactionForm");
    const transactionList = document.getElementById("transactionList");
    const totalIncomeEl = document.getElementById("totalIncome");
    const totalExpenseEl = document.getElementById("totalExpense");
    const netBalanceEl = document.getElementById("netBalance");
    const exportBtn = document.getElementById("exportBtn");
    const accountFilter = document.getElementById("accountFilter");

    const openFormBtn = document.getElementById("openFormBtn");
    const closeFormBtn = document.getElementById("closeFormBtn");
    const formModal = document.getElementById("formModal");

    let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    }

    function formatCurrency(amount) {
        return "₹ " + amount.toLocaleString("en-IN");
    }

    function getFilteredTransactions() {
        const selectedAccount = accountFilter.value;

        return selectedAccount === "All"
            ? transactions
            : transactions.filter(t => t.account === selectedAccount);
    }

    function renderTransactions() {

        transactionList.innerHTML = "";

        let totalIncome = 0;
        let totalExpense = 0;

        const filteredTransactions = getFilteredTransactions();

        filteredTransactions.forEach((transaction, index) => {

            const originalIndex = transactions.indexOf(transaction);

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
                    <button class="delete-btn" data-index="${originalIndex}">
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

    /* ===== ADD TRANSACTION ===== */

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const account = document.getElementById("account").value;
        const type = document.getElementById("type").value;
        const amount = parseFloat(document.getElementById("amount").value);
        const date = document.getElementById("date").value;
        const notes = document.getElementById("notes").value;

        if (!account || !type || !amount || amount <= 0 || !date) {
            alert("Please fill all required fields correctly.");
            return;
        }

        const transaction = { account, type, amount, date, notes };

        transactions.push(transaction);
        saveTransactions();
        renderTransactions();
        form.reset();

        // Auto close modal after submit
        formModal.style.display = "none";
    });

    /* ===== DELETE TRANSACTION (EVENT DELEGATION) ===== */

    transactionList.addEventListener("click", function (e) {
        if (e.target.classList.contains("delete-btn")) {

            const index = e.target.getAttribute("data-index");

            if (confirm("Are you sure you want to delete this transaction?")) {
                transactions.splice(index, 1);
                saveTransactions();
                renderTransactions();
            }
        }
    });

    /* ===== ACCOUNT FILTER ===== */

    accountFilter.addEventListener("change", renderTransactions);

    /* ===== EXPORT CSV (FILTERED DATA) ===== */

    exportBtn.addEventListener("click", function () {

        const filteredTransactions = getFilteredTransactions();

        if (filteredTransactions.length === 0) {
            alert("No transactions to export.");
            return;
        }

        let csvContent = "Account,Date,Type,Amount,Notes\n";

        filteredTransactions.forEach(transaction => {
            csvContent += `${transaction.account},${transaction.date},${transaction.type},${transaction.amount},"${transaction.notes || ""}"\n`;
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "digica-cash-flow.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    /* ===== MODAL OPEN / CLOSE ===== */

    openFormBtn.addEventListener("click", function () {
        formModal.style.display = "flex";
    });

    closeFormBtn.addEventListener("click", function () {
        formModal.style.display = "none";
    });

    // Close modal if clicking outside content
    formModal.addEventListener("click", function (e) {
        if (e.target === formModal) {
            formModal.style.display = "none";
        }
    });

    renderTransactions();

});
