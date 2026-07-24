import { authFetch } from './apiAuth';
import { API_URL } from '../config/api';
import { httpError } from './errorMessages';

export async function reportContent({
  username,
  targetType,
  targetId,
  targetUsername,
  reason,
}) {
  const response = await authFetch(`${API_URL}/social?action=report`, {
    method: 'POST',
    body: JSON.stringify({
      username,
      targetType,
      targetId,
      targetUsername,
      reason,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response, data);
  return data;
}

export async function blockUser(username, targetUsername) {
  const response = await authFetch(`${API_URL}/social?action=block`, {
    method: 'POST',
    body: JSON.stringify({ username, targetUsername }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response, data);
  return data;
}

export async function unblockUser(username, targetUsername) {
  const response = await authFetch(`${API_URL}/social?action=unblock`, {
    method: 'POST',
    body: JSON.stringify({ username, targetUsername }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response, data);
  return data;
}

export async function fetchBlockedUsers(username) {
  const params = new URLSearchParams({ username });
  const response = await authFetch(
    `${API_URL}/social?action=blockedUsers&${params}`,
    { method: 'GET' }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response, data);
  return data.blockedUsers || [];
}
