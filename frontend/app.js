'use strict';

const VIEW_CONFIG = {
  home: { title: 'Home', eyebrow: 'OVERVIEW', description: 'View the current users stored in the database.', endpoint: '/app/home' },
  deleteUser: { title: 'DeleteUser', eyebrow: 'REMOVE RECORDS', description: 'Review all users and remove a record when needed.', endpoint: '/app/getUser' },
  updateUser: { title: 'UpdateUser', eyebrow: 'EDIT RECORDS', description: 'Choose a row to edit the user fields and save changes.', endpoint: '/app/getUser' },
  addUser: { title: 'AddUser', eyebrow: 'CREATE RECORD', description: 'Add a new user to the MySQL database.' },
  getUser: { title: 'GetUser', eyebrow: 'READ RECORDS', description: 'Fetch the latest user records from the backend.', endpoint: '/app/getUser' }
};
const FIELDS = [
  { key: 'name', label: 'Name', maxLength: 100 },
  { key: 'fathername', label: 'Fathername', maxLength: 100 },
  { key: 'address', label: 'Address', maxLength: 255 },
  { key: 'pincode', label: 'Pincode', maxLength: 20 }
];
const notice = document.getElementById('notice');
const recordCount = document.getElementById('recordCount');
let activeView = 'home';
let noticeTimer;

function showNotice(message, isError = false) {
  window.clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.classList.toggle('error', isError);
  notice.hidden = false;
  noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 5500);
}

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
  } catch (_error) {
    throw new Error('Could not reach the backend. Check that all Docker services are running.');
  }
  let result;
  try { result = await response.json(); }
  catch (_error) { throw new Error(`The server returned an unexpected response (${response.status}).`); }
  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed (${response.status}).`);
  }
  return result;
}

function setBusy(button, busy, busyText = 'Working…') {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    delete button.dataset.originalText;
  }
}

function makeCell(value) {
  const td = document.createElement('td');
  td.textContent = value == null ? '' : String(value);
  return td;
}

function makeButton(text, className, clickHandler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', clickHandler);
  return button;
}

function renderPlainTable(tbody, users, emptyColspan = 4) {
  tbody.replaceChildren();
  if (!users.length) {
    const tr = document.createElement('tr');
    const td = makeCell('No users found. Add a user to get started.');
    td.colSpan = emptyColspan;
    td.className = 'empty-cell';
    tr.append(td);
    tbody.append(tr);
    return;
  }
  for (const user of users) {
    const tr = document.createElement('tr');
    FIELDS.forEach(field => tr.append(makeCell(user[field.key])));
    tbody.append(tr);
  }
}

function renderDeleteTable(tbody, users) {
  tbody.replaceChildren();
  if (!users.length) {
    const tr = document.createElement('tr');
    const td = makeCell('No users found.'); td.colSpan = 5; td.className = 'empty-cell';
    tr.append(td); tbody.append(tr); return;
  }
  for (const user of users) {
    const tr = document.createElement('tr');
    FIELDS.forEach(field => tr.append(makeCell(user[field.key])));
    const actionCell = document.createElement('td');
    actionCell.append(makeButton('Delete', 'button button-danger button-small', async () => {
      const confirmed = window.confirm(`Delete ${user.name} (ID ${user.id})? This cannot be undone.`);
      if (!confirmed) return;
      try {
        await apiRequest(`/app/deleteUser/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
        showNotice('User deleted successfully.');
        await loadUsersForView('deleteUser');
      } catch (error) { showNotice(error.message, true); }
    }));
    tr.append(actionCell);
    tbody.append(tr);
  }
}

function renderUpdateTable(tbody, users) {
  tbody.replaceChildren();
  if (!users.length) {
    const tr = document.createElement('tr');
    const td = makeCell('No users found.'); td.colSpan = 5; td.className = 'empty-cell';
    tr.append(td); tbody.append(tr); return;
  }
  for (const user of users) {
    const tr = document.createElement('tr');
    FIELDS.forEach(field => tr.append(makeCell(user[field.key])));
    const actionCell = document.createElement('td');
    actionCell.append(makeButton('Update', 'button button-secondary button-small', () => beginInlineEdit(tr, user)));
    tr.append(actionCell);
    tbody.append(tr);
  }
}

function beginInlineEdit(row, user) {
  row.replaceChildren();
  const inputs = {};
  for (const field of FIELDS) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.className = 'inline-input';
    input.type = 'text';
    input.name = field.key;
    input.maxLength = field.maxLength;
    input.value = user[field.key] == null ? '' : String(user[field.key]);
    input.setAttribute('aria-label', field.label);
    inputs[field.key] = input;
    td.append(input);
    row.append(td);
  }
  const actionCell = document.createElement('td');
  const actions = document.createElement('div'); actions.className = 'row-actions';
  const save = makeButton('Save', 'button button-primary button-small', async () => {
    const payload = {};
    for (const field of FIELDS) {
      payload[field.key] = inputs[field.key].value.trim();
      if (!payload[field.key]) { showNotice(`${field.label} is required.`, true); inputs[field.key].focus(); return; }
    }
    try {
      setBusy(save, true, 'Saving…');
      await apiRequest(`/app/updateUser/${encodeURIComponent(user.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      showNotice('User updated successfully.');
      await loadUsersForView('updateUser');
    } catch (error) {
      showNotice(error.message, true);
      setBusy(save, false);
    }
  });
  const cancel = makeButton('Cancel', 'button button-ghost button-small', () => loadUsersForView('updateUser').catch(error => showNotice(error.message, true)));
  actions.append(save, cancel); actionCell.append(actions); row.append(actionCell);
  inputs.name.focus();
}

async function loadUsersForView(view, button = null) {
  const config = VIEW_CONFIG[view];
  if (!config || !config.endpoint) return;
  setBusy(button, true, 'Loading…');
  try {
    const result = await apiRequest(config.endpoint);
    const users = Array.isArray(result.data) ? result.data : [];
    recordCount.textContent = String(users.length);
    if (view === 'home') renderPlainTable(document.getElementById('homeTable'), users);
    if (view === 'getUser') renderPlainTable(document.getElementById('getTable'), users);
    if (view === 'updateUser') renderUpdateTable(document.getElementById('updateTable'), users);
    if (view === 'deleteUser') renderDeleteTable(document.getElementById('deleteTable'), users);
    if (view === 'getUser') showNotice(`Fetched ${users.length} user record(s).`);
  } finally {
    setBusy(button, false);
  }
}

function navigate(view) {
  if (!VIEW_CONFIG[view]) view = 'home';
  activeView = view;
  document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== view; });
  document.querySelectorAll('.nav-link').forEach(link => {
    const active = link.dataset.view === view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.getElementById('pageEyebrow').textContent = VIEW_CONFIG[view].eyebrow;
  document.getElementById('pageTitle').textContent = VIEW_CONFIG[view].title;
  document.getElementById('pageDescription').textContent = VIEW_CONFIG[view].description;
  document.getElementById('pageActions').replaceChildren();
  if (view === 'home') document.getElementById('pageActions').append(makeButton('Refresh table', 'button button-primary', () => loadUsersForView('home')));
  if (view === 'addUser') recordCount.textContent = '—';
  if (view === 'addUser') return;
  loadUsersForView(view).catch(error => {
    recordCount.textContent = '—';
    showNotice(error.message, true);
    const tableId = { home: 'homeTable', getUser: 'getTable', updateUser: 'updateTable', deleteUser: 'deleteTable' }[view];
    if (tableId) {
      const tbody = document.getElementById(tableId);
      const tr = document.createElement('tr'); const td = makeCell('Could not load users. Use Refresh to try again.');
      td.className = 'empty-cell'; td.colSpan = view === 'home' || view === 'getUser' ? 4 : 5; tr.append(td); tbody.replaceChildren(tr);
    }
  });
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const view = link.dataset.view;
    if (window.location.hash !== `#${view}`) window.location.hash = view;
    else navigate(view);
  });
});
window.addEventListener('hashchange', () => navigate(window.location.hash.slice(1) || 'home'));

document.getElementById('homeRefresh').addEventListener('click', () => navigate('home'));
document.getElementById('getRefresh').addEventListener('click', event => loadUsersForView('getUser', event.currentTarget).catch(error => showNotice(error.message, true)));
document.getElementById('updateRefresh').addEventListener('click', event => loadUsersForView('updateUser', event.currentTarget).catch(error => showNotice(error.message, true)));
document.getElementById('deleteRefresh').addEventListener('click', event => loadUsersForView('deleteUser', event.currentTarget).catch(error => showNotice(error.message, true)));

document.getElementById('addForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = document.getElementById('addSubmit');
  const payload = Object.fromEntries(new FormData(form).entries());
  for (const field of FIELDS) payload[field.key] = String(payload[field.key] || '').trim();
  const missing = FIELDS.find(field => !payload[field.key]);
  if (missing) { showNotice(`${missing.label} is required.`, true); form.elements[missing.key].focus(); return; }
  try {
    setBusy(submit, true, 'Adding…');
    const result = await apiRequest('/app/addUser', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    recordCount.textContent = '—';
    showNotice(`${result.message || 'User added successfully.'}${result.id ? ` New user ID: ${result.id}.` : ''}`);
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    setBusy(submit, false);
  }
});

const initialView = window.location.hash.slice(1) || 'home';
navigate(initialView);
