const STORAGE_KEY = "prompt-generator-state-v1";
const HOWTO_KEY = "prompt-generator-howto-closed";

const CATEGORY_OPTIONS = [
  ["要件定義・仕様整理", "機能や条件を整理して、作る前の設計を固めます。"],
  ["画面設計（情報設計）", "ページ構成や導線【ユーザーの移動】を決めます。"],
  ["UIデザイン方針 → 実装ガイド", "見た目ルールを決めて実装につなげます。"],
  ["HTML/CSS/JS 実装（静的サイト/部品）", "3ファイル中心で動く画面を作ります。"],
  ["既存コード改修（差分・互換性優先）", "今あるコードを壊さず直す方針です。"],
  ["不具合調査・原因切り分け", "原因の仮説と検証手順を明確にします。"],
  ["自動化・運用設計（バッチ/定期処理）", "繰り返し作業を安全に回す設計を作ります。"],
  ["ブラウザ拡張機能（MV3/Thunderbird等）設計・実装", "拡張機能の構成と実装の流れを固めます。"],
];

const QUESTIONS = [
  {
    key: "category",
    label: "用途カテゴリを選んでください（番号で入力）",
    placeholder:
      "例: 4（HTML/CSS/JS 実装）",
    optional: false,
    helper: CATEGORY_OPTIONS.map((item, idx) => `${idx + 1}. ${item[0]}：${item[1]}`).join("\n"),
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

const progressText = document.getElementById("progressText");
const howToCard = document.getElementById("howToCard");
const closeHowToBtn = document.getElementById("closeHowToBtn");
const autosaveToggle = document.getElementById("autosaveToggle");
const storageHint = document.getElementById("storageHint");
const chatLogEl = document.getElementById("chatLog");
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
const clearStorageBtn = document.getElementById("clearStorageBtn");
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

  submitBtn.addEventListener("click", handleSubmit);
  addFreeBtn.addEventListener("click", handleAddFreeQuestion);
  resetBtn.addEventListener("click", handleResetAll);
  resetAllBtn.addEventListener("click", handleResetAll);
  clearStorageBtn.addEventListener("click", handleClearStorage);
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

function renderQuestionInputArea() {
  const question = QUESTIONS[state.stepIndex];
  const inCollect = state.mode === "collect";

  chatSection.classList.toggle("hidden", !inCollect);
  inputBar.classList.toggle("hidden", !inCollect);

  if (!inCollect) {
    return;
  }

  const optional = question.optional ? "（任意）" : "";
  questionLabel.textContent = `${question.label} ${optional}`.trim();
  if (question.helper) {
    questionLabel.textContent += `\n${question.helper}`;
  }

  answerInput.placeholder = question.placeholder;
  answerInput.value = state.flowAnswers[question.key] || "";
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

  state.freeQuestions.forEach((question, index) => {
    const li = document.createElement("li");
    li.className = "free-item";
    li.textContent = question;

    const btn = document.createElement("button");
    btn.className = "inline-copy";
    btn.textContent = "個別コピー";
    btn.addEventListener("click", () => copyText(question));

    li.appendChild(btn);
    freeQuestionList.appendChild(li);
  });
}

function handleSubmit() {
  if (state.mode !== "collect") return;

  const question = QUESTIONS[state.stepIndex];
  let answer = answerInput.value.trim();

  if (!answer && question.optional) {
    answer = "未入力";
  }

  if (!answer) {
    showToast("入力してから送信してください");
    return;
  }

  if (question.key === "category") {
    answer = normalizeCategory(answer);
    if (!answer) {
      showToast("用途カテゴリは1〜8の番号または候補名で入力してください");
      return;
    }
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

function handleAddFreeQuestion() {
  const text = window.prompt("自由質問を入力してください（あとで「追加の確認事項」に入ります）", "例: スマホでの表示崩れを避けるコツは？");

  if (!text) return;

  const value = text.trim();
  if (!value) return;

  state.freeQuestions.push(value);
  pushLog("free", `自由質問メモ: ${value}`);

  if (state.autosaveEnabled) saveState();
  renderAll();
}

function handleResetAll() {
  const ok = window.confirm("最初からやり直します。入力内容は画面上から消えます。よろしいですか？");
  if (!ok) return;

  const autosaveEnabled = state.autosaveEnabled;
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  state.autosaveEnabled = autosaveEnabled;
  appendQuestionToLog(QUESTIONS[0]);
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
  let text = `案内: ${question.label}${optional}`;
  if (question.helper) {
    text += `\n${question.helper}`;
  }
  pushLog("question", text);
}

function pushLog(type, text) {
  state.chatLog.push({ type, text, at: Date.now() });
}

function normalizeCategory(raw) {
  const trimmed = raw.trim();
  const asNumber = Number(trimmed);

  if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= CATEGORY_OPTIONS.length) {
    return CATEGORY_OPTIONS[asNumber - 1][0];
  }

  const found = CATEGORY_OPTIONS.find((item) => item[0] === trimmed);
  return found ? found[0] : "";
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
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();
  showToast("コピーできない場合は Ctrl+C / 長押しコピーを使ってください");
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
    return {
      ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
      ...parsed,
      flowAnswers: {
        ...DEFAULT_STATE.flowAnswers,
        ...(parsed.flowAnswers || {}),
      },
      freeQuestions: Array.isArray(parsed.freeQuestions) ? parsed.freeQuestions : [],
      chatLog: Array.isArray(parsed.chatLog) ? parsed.chatLog : [],
    };
  } catch (error) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState() {
  if (!state.autosaveEnabled) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
