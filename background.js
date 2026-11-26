const MENU_SET = "set-home";
const MENU_RESET = "reset-home";
const MENU_CLEAR = "clear-home";
const MENU_CLOSE = "close-for-good";
const MENU_OPTIONS = "open-options";

// 初期URLは2層で管理する。
// - local.homes: 永続化する初期URLのリスト。ブラウザ再起動後も残る
// - session.bindings: tabId -> { url, windowId, index, pinned }。タブIDは再起動で変わるため、セッション内だけで持つ
// 再起動後は bindings が空になるので、開いているタブの URL / オリジンから homes を紐付け直す。
// 閉じたタブを同じ位置に復活させるため、紐付け済みタブの位置と固定状態はタブ操作のたびに更新する。

let queue = Promise.resolve();
function serial(fn) {
  const p = queue.then(fn);
  queue = p.catch((e) => console.error(e));
  return p;
}

async function load() {
  const [{ homes = [] }, { bindings = {} }] = await Promise.all([
    chrome.storage.local.get("homes"),
    chrome.storage.session.get("bindings"),
  ]);
  return { homes, bindings };
}

function save({ homes, bindings }) {
  return Promise.all([
    chrome.storage.local.set({ homes }),
    chrome.storage.session.set({ bindings }),
  ]);
}

function removeOne(list, value) {
  const i = list.indexOf(value);
  if (i >= 0) list.splice(i, 1);
  return list;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function meta(tab, url) {
  return { url, windowId: tab.windowId, index: tab.index, pinned: tab.pinned };
}

function unboundHomes({ homes, bindings }) {
  const list = [...homes];
  for (const b of Object.values(bindings)) removeOne(list, b.url);
  return list;
}

function findHome(candidates, tab, allowOrigin) {
  const url = tab.url || tab.pendingUrl;
  if (!url) return null;
  const exact = candidates.find((home) => home === url);
  if (exact || !allowOrigin) return exact ?? null;
  const origin = originOf(url);
  return (origin && candidates.find((home) => originOf(home) === origin)) ?? null;
}

function setHome(tab, url) {
  return serial(async () => {
    const state = await load();
    const prev = state.bindings[tab.id];
    if (prev) removeOne(state.homes, prev.url);
    state.homes.push(url);
    state.bindings[tab.id] = meta(tab, url);
    await save(state);
  });
}

function clearHome(tabId) {
  return serial(async () => {
    const state = await load();
    const prev = state.bindings[tabId];
    if (!prev) return;
    removeOne(state.homes, prev.url);
    delete state.bindings[tabId];
    await save(state);
  });
}

function resolveHome(tab) {
  return serial(async () => {
    const state = await load();
    if (state.bindings[tab.id]) return state.bindings[tab.id].url;
    // ユーザー操作起点なので、固定タブ以外でもオリジン一致で紐付ける
    const found = findHome(unboundHomes(state), tab, true);
    if (!found) return null;
    state.bindings[tab.id] = meta(tab, found);
    await save(state);
    return found;
  });
}

// 未紐付けの初期URLを開いているタブに割り当てる。
// 同一オリジンの通常タブを誤って拾わないよう、オリジン一致は固定タブに限る。
function bindAll() {
  return serial(async () => {
    const state = await load();
    let candidates = unboundHomes(state);
    if (candidates.length === 0) return;

    const tabs = (await chrome.tabs.query({})).filter((t) => !state.bindings[t.id]);
    tabs.sort((a, b) => Number(b.pinned) - Number(a.pinned));

    let changed = false;
    for (const allowOrigin of [false, true]) {
      for (const tab of tabs) {
        if (state.bindings[tab.id] || (allowOrigin && !tab.pinned)) continue;
        const found = findHome(candidates, tab, allowOrigin);
        if (!found) continue;
        state.bindings[tab.id] = meta(tab, found);
        candidates = removeOne(candidates, found);
        changed = true;
      }
    }
    if (changed) await save(state);
  });
}

function refreshPositions() {
  return serial(async () => {
    const state = await load();
    const ids = Object.keys(state.bindings);
    if (ids.length === 0) return;
    const tabs = new Map((await chrome.tabs.query({})).map((t) => [String(t.id), t]));
    for (const id of ids) {
      const tab = tabs.get(id);
      if (tab) state.bindings[id] = meta(tab, state.bindings[id].url);
    }
    await save(state);
  });
}

function handleRemoved(tabId, isWindowClosing) {
  return serial(async () => {
    const state = await load();
    const prev = state.bindings[tabId];
    if (!prev) return;
    delete state.bindings[tabId];

    // ウィンドウごと閉じる（ブラウザ終了を含む）場合は、再起動後の復元に備えて homes を残す
    if (isWindowClosing) {
      await save(state);
      return;
    }

    try {
      const tab = await chrome.tabs.create({
        windowId: prev.windowId,
        index: prev.index,
        pinned: prev.pinned,
        url: prev.url,
        active: false,
      });
      state.bindings[tab.id] = meta(tab, prev.url);
    } catch (e) {
      console.error("failed to restore tab", e);
    }
    await save(state);
  });
}

function normalizeUrl(url) {
  try {
    return new URL(String(url).trim()).href;
  } catch {
    throw new Error("URL の形式が正しくありません");
  }
}

function editHome({ tabId, oldUrl, newUrl }) {
  const url = normalizeUrl(newUrl);
  return serial(async () => {
    const state = await load();
    if (tabId !== undefined) {
      const prev = state.bindings[tabId];
      if (!prev) throw new Error("対象のタブが見つかりません");
      removeOne(state.homes, prev.url);
      state.bindings[tabId] = { ...prev, url };
    } else {
      if (!unboundHomes(state).includes(oldUrl)) throw new Error("対象の初期URLが見つかりません");
      removeOne(state.homes, oldUrl);
    }
    state.homes.push(url);
    await save(state);
  });
}

function removeOrphan(url) {
  return serial(async () => {
    const state = await load();
    if (!unboundHomes(state).includes(url)) return;
    removeOne(state.homes, url);
    await save(state);
  });
}

function listState() {
  return serial(async () => {
    const state = await load();
    const bound = [];
    const pinnedWithoutHome = [];
    for (const tab of await chrome.tabs.query({})) {
      const info = {
        tabId: tab.id,
        windowId: tab.windowId,
        pinned: tab.pinned,
        title: tab.title,
        url: tab.url || tab.pendingUrl,
        favIconUrl: tab.favIconUrl,
      };
      const b = state.bindings[tab.id];
      if (b) bound.push({ ...info, home: b.url });
      else if (tab.pinned) pinnedWithoutHome.push(info);
    }
    return { bound, pinnedWithoutHome, orphans: unboundHomes(state) };
  });
}

const messageHandlers = {
  list: () => listState(),
  set: async ({ tabId, url }) => setHome(await chrome.tabs.get(tabId), normalizeUrl(url)),
  edit: (msg) => editHome(msg),
  clear: ({ tabId }) => clearHome(tabId),
  removeOrphan: ({ url }) => removeOrphan(url),
  focus: async ({ tabId, windowId }) => {
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(windowId, { focused: true });
  },
  openShortcuts: () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = messageHandlers[msg?.type];
  if (sender.id !== chrome.runtime.id || !handler) return false;
  Promise.resolve()
    .then(() => handler(msg))
    .then(
      (data) => sendResponse({ ok: true, data }),
      (e) => sendResponse({ ok: false, error: e.message }),
    );
  return true;
});

function handleReplaced(addedTabId, removedTabId) {
  return serial(async () => {
    const state = await load();
    const prev = state.bindings[removedTabId];
    if (!prev) return;
    delete state.bindings[removedTabId];
    state.bindings[addedTabId] = prev;
    await save(state);
  });
}

async function flashBadge(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {}), 1500);
}

async function resetTab(tab) {
  if (!tab?.id) return;
  const current = await chrome.tabs.get(tab.id);
  const home = await resolveHome(current);
  if (!home) {
    await flashBadge(current.id, "?", "#888888");
    return;
  }
  await chrome.tabs.update(current.id, { url: home });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    const contexts = ["page", "action"];
    chrome.contextMenus.create({ id: MENU_SET, title: "このページをタブの初期URLに設定", contexts });
    chrome.contextMenus.create({ id: MENU_RESET, title: "初期URLに戻す", contexts });
    chrome.contextMenus.create({ id: MENU_CLEAR, title: "このタブの初期URLを解除", contexts });
    chrome.contextMenus.create({ id: MENU_CLOSE, title: "初期URLを解除してタブを閉じる", contexts });
    chrome.contextMenus.create({ id: MENU_OPTIONS, title: "初期URLの一覧・編集…", contexts: ["page"] });
  });
  bindAll();
});

chrome.runtime.onStartup.addListener(() => bindAll());

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  switch (info.menuItemId) {
    case MENU_SET: {
      const current = await chrome.tabs.get(tab.id);
      const url = info.pageUrl ?? current.url;
      if (!url) return;
      await setHome(current, url);
      await flashBadge(tab.id, "✓", "#2e7d32");
      break;
    }
    case MENU_RESET:
      await resetTab(tab);
      break;
    case MENU_CLEAR:
      await clearHome(tab.id);
      await flashBadge(tab.id, "×", "#888888");
      break;
    case MENU_CLOSE:
      await clearHome(tab.id);
      await chrome.tabs.remove(tab.id);
      break;
    case MENU_OPTIONS:
      await chrome.runtime.openOptionsPage();
      break;
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "reset-to-home") return;
  tab ??= (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  await resetTab(tab);
});

chrome.action.onClicked.addListener((tab) => resetTab(tab));

chrome.tabs.onRemoved.addListener((tabId, { isWindowClosing }) => {
  handleRemoved(tabId, isWindowClosing).then(refreshPositions);
});
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  handleReplaced(addedTabId, removedTabId);
});
chrome.tabs.onCreated.addListener(() => refreshPositions());
chrome.tabs.onMoved.addListener(() => refreshPositions());
chrome.tabs.onAttached.addListener(() => refreshPositions());
chrome.tabs.onDetached.addListener(() => refreshPositions());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.pinned !== undefined) refreshPositions();
  // セッション復元直後は onStartup 時点で URL が揃っていないことがあるため、読み込み完了のたびに再試行する
  if (changeInfo.status === "complete") bindAll();
});
