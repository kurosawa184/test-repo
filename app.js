const STORAGE_KEY = "prompt-generator-state-v1";
const HOWTO_KEY = "prompt-generator-howto-closed";

const CATEGORY_OPTIONS = [
  ["要件定義・仕様整理", "作る前の条件を整理します"],
  ["画面設計（情報設計）", "ページ構成と導線を決めます"],
  ["UIデザイン方針 → 実装ガイド", "見た目ルールを実装へつなげます"],
  ["HTML/CSS/JS 実装（静的サイト/部品）", "3ファイルで画面を作ります"],
  ["既存コード改修（差分・互換性優先）", "今あるコードを安全に直します"],
  ["不具合調査・原因切り分け", "原因と検証手順を明確にします"],
  ["自動化・運用設計（バッチ/定期処理）", "定期作業を安定して回します"],
  ["ブラウザ拡張機能（MV3/Thunderbird等）設計・実装", "拡張機能の設計と実装を行います"],
];

const QUESTIONS = [
  {
    key: "category",
    label: "用途カテゴリをカードから選んでください",
    placeholder: "カテゴリは上のカードから選択してください",
    optional: false,
  },
  {
    key: "siteType",
    label: "どんなサイト/画面を作りますか？",
    placeholder: "例: 企業紹介サイト、採用LP、管理画面ダッシュボード",
    optional: false,
  },
  {
    key: "goal",
    label: "この依頼の目的は何ですか？",
    placeholder: "例: 問い合わせ数を増やす、更新しやすい構成にする",
    optional: false,
  },
  {
    key: "references",
    label: "参考/競合URL（任意）",
    placeholder: "例: https://example.com\n複数URLは改行で分けて入力",
    optional: true,
  },
  {
    key: "designStyle",
    label: "デザイン方向性（任意）",
    placeholder: "例: シンプル、信頼感、丸みのあるやわらかい印象",
    optional: true,
  },
  {
    key: "techStack",
    label: "使用技術（任意）",
    placeholder: "例: HTML/CSS/JS, React, TypeScript",
    optional: true,
  },
  {
    key: "outputFormat",
    label: "出力形式を指定してください",
    placeholder: "例: 手順＋コード全文、チェックリスト形式",
    optional: false,
  },
  {
    key: "constraints",
    label: "制約・ルール（任意）",
    placeholder: "例: 外部ライブラリ禁止、納期3日、既存UIを維持",
    optional: true,
  },
];

const DEFAULT_STATE = {
  flowAnswers: {
    category: "",
    siteType: "",
    goal: "",
    references: "",
    designStyle: "",
    techStack: "",
    outputFormat: "",
    constraints: "",
  },
  freeQuestions: [],
  chatLog: [],
  stepIndex: 0,
  mode: "collect",
  autosaveEnabled: true,
};

let state = loadState();
let isFreeQuestionMode = false;

const progressText = document.getElementById("progressText");
const howToCard = document.getElementById("howToCard");
const closeHowToBtn = document.getElementById("closeHowToBtn");
const autosaveToggle = document.getElementById("autosaveToggle");
const storageHint = document.getElementById("storageHint");
const clearStorageBtn = document.getElementById("clearStorageBtn");
const chatLogEl = document.getElementById("chatLog");
const categoryPicker = document.getElementById("categoryPicker");
const questionLabel = document.getElementById("questionLabel");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");
const addFreeBtn = document.getElementById("addFreeBtn");
const resetBtn = document.getElementById("resetBtn");
const toastEl = document.getElementById("toast");
const inputBar = document.getElementById("inputBar");
const chatSection = document.getElementById("chatSection");
const resultSection = document.getElementById("resultSection");
const resultText = document.getElementById("resultText");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const backToEditBtn = document.getElementById("backToEditBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const freeQuestionList = document.getElementById("freeQuestionList");
const copyFreeListBtn = document.getElementById("copyFreeListBtn");

init();

function init() {
  autosaveToggle.checked = state.autosaveEnabled;
  applyStorageHint();
  renderHowTo();
  renderAll();

  closeHowToBtn.addEventListener("click", () => {
    localStorage.setItem(HOWTO_KEY, "1");
    howToCard.classList.add("hidden");
  });

  autosaveToggle.addEventListener("change", () => {
    state.autosaveEnabled = autosaveToggle.checked;
    applyStorageHint();
    saveState();
  });

  clearStorageBtn.addEventListener("click", handleClearStorage);
  submitBtn.addEventListener("click", handleSubmit);
  addFreeBtn.addEventListener("click", toggleFreeQuestionMode);
  resetBtn.addEventListener("click", handleResetAll);
  resetAllBtn.addEventListener("click", handleResetAll);

  copyPromptBtn.addEventListener("click", () => copyText(resultText.value));
  backToEditBtn.addEventListener("click", () => {
    state.mode = "collect";
    renderAll();
  });

  copyFreeListBtn.addEventListener("click", () => {
    const text = state.freeQuestions.length
      ? state.freeQuestions.map((q) => `- ${q}`).join("\n")
      : "なし";
    copyText(text);
  });

  answerInput.addEventListener("input", () => {
    if (!isFreeQuestionMode && state.mode === "collect") {
      const current = QUESTIONS[state.stepIndex];
      if (current && current.key !== "category") {
        state.flowAnswers[current.key] = answerInput.value;
      }
    }

    if (state.autosaveEnabled) {
      saveState();
    }
  });

  answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  });
}

function renderHowTo() {
  const closed = localStorage.getItem(HOWTO_KEY) === "1";
  howToCard.classList.toggle("hidden", closed);
}

function applyStorageHint() {
  storageHint.textContent = state.autosaveEnabled
    ? "保存=この端末のブラウザ内に自動保存されます。"
    : "この端末には保存しません（既存の保存データはそのまま残ります）。";
}

function renderAll() {
  renderProgress();
  renderChatLog();
  renderQuestionInputArea();
  renderCategoryPicker();
  renderResult();
  scrollChatToBottom();
}

function renderProgress() {
  const index = Math.min(state.stepIndex + 1, QUESTIONS.length);
  progressText.textContent = `質問 ${index}/${QUESTIONS.length}`;
}

function renderChatLog() {
  chatLogEl.innerHTML = "";

  state.chatLog.forEach((entry) => {
    const div = document.createElement("div");
    div.className = `bubble ${entry.type}`;
    div.textContent = entry.text;
    chatLogEl.appendChild(div);
  });

  if (state.chatLog.length === 0 && state.mode === "collect") {
    appendQuestionToLog(QUESTIONS[state.stepIndex]);
  }
}

function renderCategoryPicker() {
  const show = state.mode === "collect" && state.stepIndex === 0;
  categoryPicker.classList.toggle("hidden", !show);
  if (!show) {
    categoryPicker.innerHTML = "";
    return;
  }

  const current = state.flowAnswers.category;
  const wrap = document.createElement("div");

  const title = document.createElement("p");
  title.className = "category-title";
  title.textContent = "カテゴリ選択（クリックまたはEnter/Space）";
  wrap.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "category-grid";

  CATEGORY_OPTIONS.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-card";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(current === item[0]));

    if (current === item[0]) {
      button.classList.add("selected");
    }

    button.innerHTML = `
      <span class="category-no">${index + 1}</span>
      <span class="category-name">${item[0]}</span>
      <span class="category-desc">${item[1]}</span>
    `;

    button.addEventListener("click", () => selectCategory(item[0]));
    button.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        selectCategory(item[0]);
      }
    });

    grid.appendChild(button);
  });

  wrap.appendChild(grid);

  const help = document.createElement("details");
  help.innerHTML = "<summary>補足（カテゴリの見分け方）</summary><p>迷ったら「4. HTML/CSS/JS 実装」から始めると進めやすいです。</p>";
  wrap.appendChild(help);

  categoryPicker.innerHTML = "";
  categoryPicker.appendChild(wrap);
}

function selectCategory(categoryName) {
  state.flowAnswers.category = categoryName;
  if (state.autosaveEnabled) saveState();
  renderCategoryPicker();
}

function renderQuestionInputArea() {
  const inCollect = state.mode === "collect";
  const question = QUESTIONS[state.stepIndex];

  chatSection.classList.toggle("hidden", !inCollect);
  inputBar.classList.toggle("hidden", !inCollect);

  if (!inCollect) {
    return;
  }

  if (isFreeQuestionMode) {
    questionLabel.textContent = "自由質問メモを入力してください（任意回数）";
    answerInput.placeholder = "例: スマホ表示で気をつける点は？";
    answerInput.value = "";
    submitBtn.textContent = "メモ追加";
    addFreeBtn.textContent = "通常入力に戻る";
    return;
  }

  const optional = question.optional ? "（任意）" : "";
  questionLabel.textContent = `${question.label}${optional}`;
  answerInput.placeholder = question.placeholder;
  if (question.key === "category") {
    answerInput.value = state.flowAnswers.category || "";
    answerInput.readOnly = true;
  } else {
    answerInput.readOnly = false;
    answerInput.value = state.flowAnswers[question.key] || "";
  }

  submitBtn.textContent = "送信";
  addFreeBtn.textContent = "＋自由質問";
}

function renderResult() {
  const isResult = state.mode === "result";
  resultSection.classList.toggle("hidden", !isResult);
  if (!isResult) return;

  resultText.value = buildPrompt();
  freeQuestionList.innerHTML = "";

  if (!state.freeQuestions.length) {
    const li = document.createElement("li");
    li.textContent = "なし";
    freeQuestionList.appendChild(li);
    return;
  }

  state.freeQuestions.forEach((question) => {
    const li = document.createElement("li");
    li.className = "free-item";
    li.textContent = question;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "inline-copy secondary";
    btn.textContent = "個別コピー";
    btn.addEventListener("click", () => copyText(question));

    li.appendChild(btn);
    freeQuestionList.appendChild(li);
  });
}

function handleSubmit() {
  if (state.mode !== "collect") return;

  if (isFreeQuestionMode) {
    handleFreeQuestionSubmit();
    return;
  }

  const question = QUESTIONS[state.stepIndex];
  let answer = answerInput.value.trim();

  if (question.key === "category") {
    answer = state.flowAnswers.category;
  }

  if (!answer && question.optional) {
    answer = "未入力";
  }

  if (!answer) {
    showToast("入力してから送信してください");
    return;
  }

  state.flowAnswers[question.key] = answer;
  pushLog("answer", `あなた: ${answer}`);

  if (state.stepIndex < QUESTIONS.length - 1) {
    state.stepIndex += 1;
    appendQuestionToLog(QUESTIONS[state.stepIndex]);
    if (state.autosaveEnabled) saveState();
    renderAll();
    return;
  }

  state.mode = "result";
  if (state.autosaveEnabled) saveState();
  renderAll();
}

function toggleFreeQuestionMode() {
  if (state.mode !== "collect") return;
  isFreeQuestionMode = !isFreeQuestionMode;
  renderQuestionInputArea();
  answerInput.focus();
}

function handleFreeQuestionSubmit() {
  const value = answerInput.value.trim();
  if (!value) {
    showToast("自由質問メモを入力してください");
    return;
  }

  state.freeQuestions.push(value);
  pushLog("free", `自由質問メモ: ${value}`);
  isFreeQuestionMode = false;

  if (state.autosaveEnabled) saveState();
  renderAll();
}

function handleResetAll() {
  const ok = window.confirm("最初からやり直します。入力内容は画面上から消えます。よろしいですか？");
  if (!ok) return;

  const autosaveEnabled = state.autosaveEnabled;
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  state.autosaveEnabled = autosaveEnabled;
  state.chatLog.push({ type: "question", text: `案内: ${QUESTIONS[0].label}`, at: Date.now() });
  isFreeQuestionMode = false;

  if (state.autosaveEnabled) saveState();
  renderAll();
}

function handleClearStorage() {
  const ok = window.confirm("この端末に保存されたデータを削除します。よろしいですか？");
  if (!ok) return;

  localStorage.removeItem(STORAGE_KEY);
  showToast("保存データを削除しました");
}

function appendQuestionToLog(question) {
  const optional = question.optional ? "（任意）" : "";
  pushLog("question", `案内: ${question.label}${optional}`);
}

function pushLog(type, text) {
  state.chatLog.push({ type, text, at: Date.now() });
}

function buildPrompt() {
  const a = state.flowAnswers;
  const freeText = state.freeQuestions.length
    ? state.freeQuestions.map((q) => `- ${q}`).join("\n")
    : "なし";

  const base = [
    "あなたはプロのフロントエンドエンジニアです。以下の要件でコーディング/設計を行ってください。",
    `【用途カテゴリ】${a.category || "未入力"}`,
    `【サイト種別】${a.siteType || "未入力"}`,
    `【目的】${a.goal || "未入力"}`,
    `【参考/競合URL】${a.references || "未入力"}`,
    `【デザイン方向性】${a.designStyle || "未入力"}`,
    `【使用技術】${a.techStack || "未入力"}`,
    `【出力形式】${a.outputFormat || "未入力"}`,
    `【制約・ルール】${a.constraints || "未入力"}`,
    "【追加の確認事項（ユーザーからの自由質問）】",
    freeText,
    "",
    getCategoryDirective(a.category),
    "",
    "出力は日本語で、読みやすく。必要に応じてセクション見出し・箇条書きを使い、コードにはコメントを付けてください。",
  ];

  return base.join("\n");
}

function getCategoryDirective(category) {
  switch (category) {
    case "要件定義・仕様整理":
      return "必須観点: 機能/非機能/制約/優先度/受け入れ条件【OK判定基準】を必ず示してください。";
    case "画面設計（情報設計）":
      return "必須観点: ナビ、主要セクション、CTA【行動ボタン】、文量目安、コンポーネント構造、レスポンシブ方針を必ず示してください。";
    case "UIデザイン方針 → 実装ガイド":
      return "必須観点: 色/余白/タイポ/グリッド、アクセシビリティ【使いやすさ基準】の最低要件、レスポンシブ戦略、代替案を必ず示してください。";
    case "HTML/CSS/JS 実装（静的サイト/部品）":
      return "必須観点: 3ファイル構成、スマホ優先、必要最小限で動く実装、コメント付きコードを必ず示してください。";
    case "既存コード改修（差分・互換性優先）":
      return "必須観点: 変更点サマリ、影響範囲、テスト/実行手順、ロールバック手順【戻す手順】を必ず示してください。";
    case "不具合調査・原因切り分け":
      return "必須観点: 仮説→検証手順→期待結果→分岐（Aなら…/Bなら…）を必ず示してください。";
    case "自動化・運用設計（バッチ/定期処理）":
      return "必須観点: 実行手順、ログ設計、失敗時対応、監視項目を必ず示してください。";
    case "ブラウザ拡張機能（MV3/Thunderbird等）設計・実装":
      return "必須観点: 権限、イベント、ストレージ、UI、デバッグ手順を必ず示してください。";
    default:
      return "必須観点: 上記入力内容を過不足なく整理し、実行できる形で提案してください。";
  }
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("コピーしました");
  } catch (error) {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement("textarea");
  temp.value = text;
  temp.setAttribute("readonly", "");
  temp.style.position = "fixed";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.focus();
  temp.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }

  document.body.removeChild(temp);

  if (copied) {
    showToast("コピーしました");
  } else {
    showToast("Ctrl+C / 長押しコピーでコピーしてください");
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initState = JSON.parse(JSON.stringify(DEFAULT_STATE));
      initState.chatLog.push({ type: "question", text: `案内: ${QUESTIONS[0].label}`, at: Date.now() });
      return initState;
    }

    const parsed = JSON.parse(raw);
    const loaded = {
      ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
      ...parsed,
      flowAnswers: {
        ...DEFAULT_STATE.flowAnswers,
        ...(parsed.flowAnswers || {}),
      },
      freeQuestions: Array.isArray(parsed.freeQuestions) ? parsed.freeQuestions : [],
      chatLog: Array.isArray(parsed.chatLog) ? parsed.chatLog : [],
    };

    if (loaded.chatLog.length === 0 && loaded.mode === "collect") {
      loaded.chatLog.push({ type: "question", text: `案内: ${QUESTIONS[loaded.stepIndex].label}`, at: Date.now() });
    }

    return loaded;
  } catch (error) {
    const fallback = JSON.parse(JSON.stringify(DEFAULT_STATE));
    fallback.chatLog.push({ type: "question", text: `案内: ${QUESTIONS[0].label}`, at: Date.now() });
    return fallback;
  }
}

function saveState() {
  if (!state.autosaveEnabled) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
