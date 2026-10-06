const STORAGE_KEY = "ledger-transactions-v1";
const CATEGORIES = ["식대", "교통비", "회의비", "비품", "접대비", "숙박비", "기타"];
const CATEGORY_COLORS = {
  식대: "#e5a16b",
  교통비: "#739cc4",
  회의비: "#9a87c8",
  비품: "#63a995",
  접대비: "#d47d76",
  숙박비: "#6fabc0",
  기타: "#a4abb2",
};
const MERCHANT_COLORS = [
  ["#edf5f2", "#38836f"],
  ["#f2eef9", "#8068af"],
  ["#faf0e9", "#c27a4d"],
  ["#edf2f8", "#6283a7"],
  ["#f8eeee", "#b46b6d"],
  ["#eef4f7", "#658998"],
];

const $ = (selector) => document.querySelector(selector);
const listElement = $("#transaction-list");
const dialog = $("#transaction-dialog");
const form = $("#transaction-form");
let toastTimeout;

function dateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sampleTransactions() {
  const current = new Date();
  const date = (daysAgo) => {
    const itemDate = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    itemDate.setDate(itemDate.getDate() - daysAgo);
    return dateString(itemDate);
  };
  return [
    { id: "sample-1", date: date(0), merchant: "스타벅스 강남R점", category: "식대", cardholder: "김민지", cardLastFour: "4821", amount: 28500, memo: "파트너사 미팅" },
    { id: "sample-2", date: date(1), merchant: "우버 코리아", category: "교통비", cardholder: "박지훈", cardLastFour: "1094", amount: 18400, memo: "외근 이동" },
    { id: "sample-3", date: date(2), merchant: "아웃백 스테이크하우스", category: "접대비", cardholder: "김민지", cardLastFour: "4821", amount: 156000, memo: "고객사 저녁 식사" },
    { id: "sample-4", date: date(3), merchant: "오피스디포 역삼점", category: "비품", cardholder: "이서연", cardLastFour: "7362", amount: 42300, memo: "사무용품 구매" },
    { id: "sample-5", date: date(4), merchant: "카페 노티드 강남", category: "회의비", cardholder: "박지훈", cardLastFour: "1094", amount: 32000, memo: "팀 주간 회의" },
    { id: "sample-6", date: date(6), merchant: "서울역 KTX", category: "교통비", cardholder: "최준호", cardLastFour: "2915", amount: 59800, memo: "부산 출장" },
    { id: "sample-7", date: date(8), merchant: "배달의민족", category: "식대", cardholder: "이서연", cardLastFour: "7362", amount: 67500, memo: "야근 식대" },
    { id: "sample-8", date: date(12), merchant: "그랜드 인터컨티넨탈 서울", category: "숙박비", cardholder: "최준호", cardLastFour: "2915", amount: 245000, memo: "부산 출장 전일 숙박" },
  ];
}

function loadTransactions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      const samples = sampleTransactions();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
      return samples;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("저장된 사용 내역 형식이 올바르지 않습니다.");
    return parsed;
  } catch (error) {
    console.error("사용 내역을 불러오지 못했습니다.", error);
    showToast("저장된 내역을 읽지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
    return [];
  }
}

let transactions = loadTransactions();

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error("사용 내역을 저장하지 못했습니다.", error);
    showToast("내역을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
  }
}

function currency(amount) {
  return `₩${Number(amount).toLocaleString("ko-KR")}`;
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(date);
}

function monthLabel(value) {
  const [year, month] = value.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function activeMonth() {
  return $("#month-filter").value;
}

function populateCategoryOptions() {
  $("#category").innerHTML = CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("");
  $("#category-filter").innerHTML = `<option value="">모든 항목</option>${CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}`;
}

function populateMonthOptions(preferredMonth) {
  const filter = $("#month-filter");
  const previousMonth = preferredMonth || filter.value;
  const current = new Date();
  const months = new Set([`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`]);
  transactions.forEach((item) => months.add(item.date.slice(0, 7)));
  const sorted = [...months].sort().reverse();
  filter.innerHTML = sorted.map((month) => `<option value="${month}">${monthLabel(month)}</option>`).join("");
  filter.value = months.has(previousMonth) ? previousMonth : sorted[0];
}

function selectedTransactions() {
  const month = activeMonth();
  const category = $("#category-filter").value;
  const query = $("#search-input").value.trim().toLocaleLowerCase("ko-KR");
  return transactions
    .filter((item) => item.date.startsWith(month))
    .filter((item) => !category || item.category === category)
    .filter((item) => !query || [item.merchant, item.memo, item.cardholder, item.category].some((value) => (value || "").toLocaleLowerCase("ko-KR").includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function updateSummary() {
  const month = activeMonth();
  const monthly = transactions.filter((item) => item.date.startsWith(month));
  const total = monthly.reduce((sum, item) => sum + Number(item.amount), 0);
  const byCategory = monthly.reduce((groups, item) => {
    groups[item.category] = (groups[item.category] || 0) + Number(item.amount);
    return groups;
  }, {});
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  $("#summary-period").textContent = monthLabel(month);
  $("#monthly-total").textContent = currency(total);
  $("#monthly-count").textContent = `${monthly.length}건`;
  $("#monthly-transaction-count").textContent = `${monthly.length}건`;
  $("#monthly-average").textContent = currency(monthly.length ? Math.round(total / monthly.length) : 0);
  $("#top-category").textContent = topCategory ? topCategory[0] : "-";
  $("#top-category-total").textContent = topCategory ? `${currency(topCategory[1])} 지출` : "지출 내역을 등록해 주세요";
}

function renderRows(items) {
  listElement.replaceChildren();
  items.forEach((item, index) => {
    const row = document.createElement("tr");
    const [background, foreground] = MERCHANT_COLORS[index % MERCHANT_COLORS.length];
    const firstLetter = [...item.merchant][0] || "?";
    row.innerHTML = `
      <td>${formatDate(item.date)}</td>
      <td><div class="merchant-cell"><span class="merchant-icon" style="background:${background};color:${foreground}">${escapeHtml(firstLetter)}</span><span class="merchant-copy"><strong>${escapeHtml(item.merchant)}</strong><small>${escapeHtml(item.memo || "메모 없음")}</small></span></div></td>
      <td><span class="category-badge" style="--badge-color:${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.기타}">${escapeHtml(item.category)}</span></td>
      <td class="owner-cell">${escapeHtml(item.cardholder)}</td>
      <td class="card-last-four">•••• ${escapeHtml(item.cardLastFour || "0000")}</td>
      <td class="amount-cell">${currency(item.amount)}</td>
      <td class="row-actions"><button class="row-action-button" type="button" aria-label="${escapeHtml(item.merchant)} 내역 관리" aria-expanded="false">···</button>
        <div class="row-action-menu" hidden><button type="button" data-action="edit">수정하기</button><button class="delete-action" type="button" data-action="delete">삭제하기</button></div>
      </td>`;
    row.dataset.id = item.id;
    listElement.append(row);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function render(preferredMonth) {
  populateMonthOptions(preferredMonth);
  updateSummary();
  const items = selectedTransactions();
  renderRows(items);
  const hasItems = items.length > 0;
  $("#empty-state").hidden = hasItems;
  $("#transaction-list").parentElement.hidden = !hasItems;
  if (!hasItems) {
    const hasAnyRecordsInMonth = transactions.some((item) => item.date.startsWith(activeMonth()));
    $("#empty-title").textContent = hasAnyRecordsInMonth ? "조건에 맞는 내역이 없어요" : "아직 등록된 사용 내역이 없어요";
    $("#empty-description").textContent = hasAnyRecordsInMonth ? "검색어나 필터를 바꾸어 다시 확인해 보세요." : "첫 내역을 등록해 팀의 카드 지출을 관리해 보세요.";
    $("#empty-add").hidden = hasAnyRecordsInMonth;
  }
  $("#result-count").textContent = String(items.length);
  $("#nav-count").textContent = String(transactions.length);
  $("#table-summary").textContent = `전체 ${items.length}건`;
  $("#current-date").textContent = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date());
  $("#copyright-year").textContent = String(new Date().getFullYear());
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2800);
}

function openDialog(item) {
  form.reset();
  $("#transaction-id").value = item ? item.id : "";
  $("#dialog-title").textContent = item ? "사용 내역 수정" : "사용 내역 등록";
  $("#save-transaction").innerHTML = item ? "수정 완료 <span aria-hidden=\"true\">→</span>" : "등록하기 <span aria-hidden=\"true\">→</span>";
  $("#merchant").value = item?.merchant || "";
  $("#transaction-date").value = item?.date || dateString(new Date());
  $("#amount").value = item?.amount || "";
  $("#category").value = item?.category || CATEGORIES[0];
  $("#cardholder").value = item?.cardholder || "";
  $("#card-last-four").value = item?.cardLastFour || "";
  $("#memo").value = item?.memo || "";
  dialog.showModal();
  $("#merchant").focus();
}

function closeDialog() {
  dialog.close();
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv() {
  const items = selectedTransactions();
  if (!items.length) {
    showToast("다운로드할 내역이 없습니다.");
    return;
  }
  const headers = ["사용 일자", "가맹점", "항목", "카드 소유자", "카드 끝 4자리", "금액", "사용 메모"];
  const rows = items.map((item) => [item.date, item.merchant, item.category, item.cardholder, item.cardLastFour, item.amount, item.memo]);
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `법인카드-사용내역-${activeMonth()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${items.length}건의 내역을 다운로드했습니다.`);
}

populateCategoryOptions();
render();

$("#add-transaction").addEventListener("click", () => openDialog());
$("#empty-add").addEventListener("click", () => openDialog());
$("#close-dialog").addEventListener("click", closeDialog);
$("#cancel-dialog").addEventListener("click", closeDialog);
$("#category-filter").addEventListener("change", render);
$("#month-filter").addEventListener("change", render);
$("#search-input").addEventListener("input", render);
$("#export-csv").addEventListener("click", downloadCsv);
$("#notification-button").addEventListener("click", () => showToast("새 알림이 없습니다."));
$("#help-button").addEventListener("click", () => showToast("사용 내역 등록 버튼에서 카드 지출을 추가해 보세요."));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const lastFour = $("#card-last-four").value.trim();
  if (lastFour && !/^\d{4}$/.test(lastFour)) {
    $("#card-last-four").setCustomValidity("카드 번호 끝 4자리를 숫자로 입력해 주세요.");
    $("#card-last-four").reportValidity();
    $("#card-last-four").setCustomValidity("");
    return;
  }
  const id = $("#transaction-id").value;
  const entry = {
    id: id || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    date: $("#transaction-date").value,
    merchant: $("#merchant").value.trim(),
    category: $("#category").value,
    cardholder: $("#cardholder").value.trim(),
    cardLastFour: lastFour,
    amount: Number($("#amount").value),
    memo: $("#memo").value.trim(),
  };
  if (id) {
    transactions = transactions.map((item) => item.id === id ? entry : item);
  } else {
    transactions.push(entry);
  }
  saveTransactions();
  closeDialog();
  render(entry.date.slice(0, 7));
  showToast(id ? "사용 내역을 수정했습니다." : "사용 내역을 등록했습니다.");
});

listElement.addEventListener("click", (event) => {
  const actionButton = event.target.closest(".row-action-button");
  if (actionButton) {
    const menu = actionButton.nextElementSibling;
    const wasOpen = !menu.hidden;
    document.querySelectorAll(".row-action-menu").forEach((item) => { item.hidden = true; });
    document.querySelectorAll(".row-action-button").forEach((item) => item.setAttribute("aria-expanded", "false"));
    menu.hidden = wasOpen;
    actionButton.setAttribute("aria-expanded", String(!wasOpen));
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const row = action.closest("tr");
  const item = transactions.find((transaction) => transaction.id === row.dataset.id);
  if (!item) return;
  if (action.dataset.action === "edit") {
    openDialog(item);
  } else if (action.dataset.action === "delete" && window.confirm(`"${item.merchant}" 사용 내역을 삭제할까요?`)) {
    transactions = transactions.filter((transaction) => transaction.id !== item.id);
    saveTransactions();
    render();
    showToast("사용 내역을 삭제했습니다.");
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".row-actions")) {
    document.querySelectorAll(".row-action-menu").forEach((menu) => { menu.hidden = true; });
    document.querySelectorAll(".row-action-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#search-input").focus();
  }
  if (event.key === "Escape" && dialog.open) closeDialog();
});
