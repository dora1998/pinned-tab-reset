const $ = (id) => document.getElementById(id);

async function call(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) throw new Error(res?.error ?? "不明なエラーが発生しました");
  return res.data;
}

let toastTimer;
function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2500);
}

async function run(fn, successMessage) {
  try {
    await fn();
    if (successMessage) toast(successMessage);
  } catch (e) {
    toast(e.message, true);
  }
  refresh();
}

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else if (value !== undefined && value !== false) el.setAttribute(key, value === true ? "" : value);
  }
  el.append(...children.filter((c) => c != null));
  return el;
}

function favicon(url) {
  const img = h("img", { class: "favicon", alt: "", width: 16, height: 16 });
  if (url) {
    img.src = url;
    img.addEventListener("error", () => img.removeAttribute("src"), { once: true });
  }
  return img;
}

function tabHead(tab) {
  return h(
    "div",
    { class: "item-head" },
    favicon(tab.favIconUrl),
    h("span", { class: "title", title: tab.title }, tab.title || tab.url || "(無題)"),
    tab.pinned ? h("span", { class: "badge" }, "固定") : null,
  );
}

// 再描画しても編集途中の入力が消えないよう、行ごとのキーで未保存の値を退避する
const drafts = new Map();

function homeForm({ key, value, onSave, extraButtons = [] }) {
  const input = h("input", {
    type: "url",
    required: true,
    spellcheck: "false",
    "aria-label": "初期URL",
    "data-key": key,
  });
  input.value = drafts.get(key) ?? value;
  const save = h("button", { type: "submit", class: "primary" }, "保存");
  const sync = () => {
    const dirty = input.value !== value;
    if (dirty) drafts.set(key, input.value);
    else drafts.delete(key);
    input.classList.toggle("dirty", dirty);
    save.disabled = !dirty;
  };
  input.addEventListener("input", sync);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = value;
      sync();
    }
  });
  sync();

  return h(
    "form",
    {
      class: "home-form",
      onsubmit: (e) => {
        e.preventDefault();
        const next = input.value;
        run(async () => {
          await onSave(next);
          drafts.delete(key);
        }, "初期URLを保存しました");
      },
    },
    h("label", {}, "初期URL"),
    input,
    save,
    ...extraButtons,
  );
}

function boundItem(tab) {
  const key = `tab:${tab.tabId}`;
  const form = homeForm({
    key,
    value: tab.home,
    onSave: (newUrl) => call("edit", { tabId: tab.tabId, newUrl }),
    extraButtons: [
      h(
        "button",
        {
          type: "button",
          disabled: !tab.url || tab.url === tab.home,
          title: tab.url,
          onclick: () => {
            drafts.delete(key);
            run(() => call("edit", { tabId: tab.tabId, newUrl: tab.url }), "現在のURLを初期URLにしました");
          },
        },
        "現在のURLにする",
      ),
    ],
  });

  return h(
    "li",
    { class: "item" },
    tabHead(tab),
    h("div", { class: "current", title: tab.url }, `現在: ${tab.url ?? ""}`),
    form,
    h(
      "div",
      { class: "actions" },
      h("button", { type: "button", onclick: () => run(() => call("focus", tab)) }, "タブを表示"),
      h(
        "button",
        {
          type: "button",
          class: "danger",
          onclick: () => {
            drafts.delete(key);
            run(() => call("clear", { tabId: tab.tabId }), "初期URLを解除しました");
          },
        },
        "解除",
      ),
    ),
  );
}

function pinnedItem(tab) {
  return h(
    "li",
    { class: "item" },
    tabHead(tab),
    h("div", { class: "current", title: tab.url }, `現在: ${tab.url ?? ""}`),
    h(
      "div",
      { class: "actions" },
      h(
        "button",
        {
          type: "button",
          class: "primary",
          disabled: !tab.url,
          onclick: () => run(() => call("set", { tabId: tab.tabId, url: tab.url }), "初期URLを設定しました"),
        },
        "現在のURLを初期URLにする",
      ),
      h("button", { type: "button", onclick: () => run(() => call("focus", tab)) }, "タブを表示"),
    ),
  );
}

function orphanItem(url, i) {
  const key = `orphan:${i}:${url}`;
  return h(
    "li",
    { class: "item" },
    homeForm({
      key,
      value: url,
      onSave: (newUrl) => call("edit", { oldUrl: url, newUrl }),
      extraButtons: [
        h(
          "button",
          {
            type: "button",
            class: "danger",
            onclick: () => {
              drafts.delete(key);
              run(() => call("removeOrphan", { url }), "削除しました");
            },
          },
          "削除",
        ),
      ],
    }),
  );
}

function renderList(listId, countId, items, renderItem) {
  $(listId).replaceChildren(...items.map(renderItem));
  $(countId).textContent = items.length ? `(${items.length})` : "";
}

async function render() {
  const { bound, pinnedWithoutHome, orphans } = await call("list");

  const active = document.activeElement;
  const focusKey = active?.dataset?.key;
  const selection = focusKey ? [active.selectionStart, active.selectionEnd] : null;

  renderList("bound-list", "bound-count", bound, boundItem);
  $("bound-empty").hidden = bound.length > 0;
  renderList("pinned-list", "pinned-count", pinnedWithoutHome, pinnedItem);
  $("pinned-section").hidden = pinnedWithoutHome.length === 0;
  renderList("orphan-list", "orphan-count", orphans, orphanItem);
  $("orphan-section").hidden = orphans.length === 0;

  const liveKeys = new Set([...document.querySelectorAll("input[data-key]")].map((el) => el.dataset.key));
  for (const key of drafts.keys()) if (!liveKeys.has(key)) drafts.delete(key);

  if (focusKey) {
    const el = document.querySelector(`input[data-key="${CSS.escape(focusKey)}"]`);
    if (el) {
      el.focus();
      el.setSelectionRange(...selection);
    }
  }
}

let refreshTimer;
function refresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => render().catch((e) => toast(e.message, true)), 150);
}

async function renderShortcut() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === "reset-to-home")?.shortcut;
  $("shortcut").textContent = shortcut || "未設定";
}

$("open-shortcuts").addEventListener("click", () => call("openShortcuts"));

chrome.storage.onChanged.addListener(refresh);
for (const event of ["onCreated", "onRemoved", "onMoved", "onAttached", "onDetached", "onReplaced"]) {
  chrome.tabs[event].addListener(refresh);
}
chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  if ("url" in changeInfo || "title" in changeInfo || "pinned" in changeInfo || "favIconUrl" in changeInfo) refresh();
});
// ショートカットは別タブで変更されるので、戻ってきたときに読み直す
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderShortcut();
});

renderShortcut();
render().catch((e) => toast(e.message, true));
